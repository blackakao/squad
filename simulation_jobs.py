"""Persistent, single-worker battle jobs. Game data is snapshotted, never mutated."""
from datetime import datetime, timezone
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import threading
import traceback
import uuid

ACTIVE = {"RUNNING", "CANCELLING"}
METRICS = ["winRate", "duration"] + [f"{metric}.{role}" for role in
    ("tank", "melee", "ranged", "healer", "special") for metric in ("dps", "hps")]


class SimulationError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def now():
    return datetime.now(timezone.utc).isoformat()


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def atomic_json(path, value):
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    temp.replace(path)


def parse_targets(markdown):
    result = {}
    for line in markdown.splitlines():
        if not line.strip().startswith("|"):
            continue
        cells = [s.strip() for s in line.split("|")[1:-1]]
        if not cells or cells[0] == "지표" or re.fullmatch(r"-+", cells[0]):
            continue
        if cells[0] not in METRICS or len(cells) != 3 or cells[0] in result:
            raise SimulationError("목표 표 형식을 확인해 주세요.")
        try:
            result[cells[0]] = [None if v == "미정" else float(v) for v in cells[1:]]
        except ValueError as exc:
            raise SimulationError("목표는 숫자 또는 미정이어야 합니다.") from exc
    validate_targets(result)
    return result


def validate_targets(targets):
    if not isinstance(targets, dict) or set(targets) != set(METRICS):
        raise SimulationError("목표 지표가 누락되었거나 잘못되었습니다.")
    for key, values in targets.items():
        if not isinstance(values, list) or len(values) != 2:
            raise SimulationError("목표 범위에는 최소와 최대가 필요합니다.")
        for v in values:
            if v is not None and (type(v) not in (int, float) or not math.isfinite(v)
                                  or v < 0 or (key == "winRate" and v > 100)):
                raise SimulationError("목표는 0 이상의 숫자이며 승률은 100 이하여야 합니다.")
        if all(v is not None for v in values) and values[0] > values[1]:
            raise SimulationError("목표 최솟값은 최댓값보다 클 수 없습니다.")


class SimulationJobs:
    def __init__(self, root, data_dir=None, storage=None, targets_path=None, legacy_dir=None):
        self.root = Path(root)
        self.data_dir = Path(data_dir or self.root / "data")
        self.storage = Path(storage or self.root / "balance/jobs")
        self.targets_path = Path(targets_path or self.root / "docs/balance/BALANCE_TARGETS.md")
        self.legacy_dir = Path(legacy_dir or self.root / "balance/results")
        self.lock = threading.RLock()
        self.jobs = {}
        self.process = None
        self.closed = False
        self.legacy_cache = {}
        self.storage.mkdir(parents=True, exist_ok=True)
        for path in self.storage.glob("*/job.json"):
            try:
                job = read_json(path)
                if job["simulationId"] != path.parent.name:
                    continue
                if job["status"] in ACTIVE:
                    job.update(status="FAILED", finishedAt=now(),
                               error="서버가 종료되어 실행이 중단되었습니다. 완료 전투 원본은 보존됩니다.")
                    # The worker may have completed immediately before shutdown.
                    result_path = path.parent / "result.json"
                    if result_path.exists():
                        run = read_json(result_path)
                        job.update(self._run_metadata(run))
                    else:
                        journal = path.parent / "battles.ndjson"
                        if journal.exists():
                            job["completed"] = sum(1 for line in journal.read_text(encoding="utf-8").splitlines()
                                                   if line.endswith("}"))
                    atomic_json(path, job)
                self.jobs[job["simulationId"]] = job
            except (OSError, ValueError, KeyError):
                continue

    def targets(self, values=None):
        with self.lock:
            markdown = self.targets_path.read_text(encoding="utf-8")
            current = parse_targets(markdown)
            if values is not None:
                validate_targets(values)
                lines = []
                for line in markdown.splitlines():
                    cells = [s.strip() for s in line.split("|")[1:-1]]
                    if cells and cells[0] in current:
                        line = "| " + cells[0] + " | " + " | ".join(
                            "미정" if v is None else format(v, ".12f").rstrip("0").rstrip(".")
                            for v in values[cells[0]]) + " |"
                    lines.append(line)
                temp = self.targets_path.with_suffix(".tmp")
                temp.write_text("\n".join(lines) + "\n", encoding="utf-8")
                temp.replace(self.targets_path)
                current = values
            return {"targets": current}

    def _snapshot(self):
        data = {name: read_json(self.data_dir / (name + ".json")) for name in
                ("characters", "categories", "items", "skills", "factions", "teams")}
        data["synergies"] = read_json(self.data_dir / "synergies.json") if (self.data_dir / "synergies.json").exists() else []
        if any(not isinstance(value, list) for value in data.values()):
            raise SimulationError("게임 데이터는 배열이어야 합니다.")
        data["entities"] = [read_json(path) for path in sorted((self.data_dir / "entities").glob("*.json"))]
        if any(action.get("summon") for skill in data["skills"] for action in skill.get("actions", [])):
            raise SimulationError("기존 소환 데이터를 게임의 스킬 관리에서 먼저 이전해 주세요.")
        return data

    @staticmethod
    def settings(values):
        if not isinstance(values, dict):
            raise SimulationError("실행 설정은 객체여야 합니다.")
        rules = {"count": (100, 1, 10000), "teamSize": (3, 1, 3), "seed": (12345, 0, 4294967295),
                 "maxSeconds": (600, 1, 3600), "width": (400, 100, 4000),
                 "height": (300, 100, 4000), "minSamples": (30, 1, 10000)}
        result = {}
        for key, (default, low, high) in rules.items():
            value = values.get(key, default)
            if type(value) is not int or not low <= value <= high:
                raise SimulationError(f"{key}: {low}~{high} 범위의 정수를 입력해 주세요.")
            result[key] = value
        return result

    def start(self, values):
        settings = self.settings(values)
        with self.lock:
            if self.closed:
                raise SimulationError("서버가 종료 중입니다.", 503)
            if any(job["status"] in ACTIVE for job in self.jobs.values()):
                raise SimulationError("이미 실행 중인 테스트가 있습니다.", 409)
            node = shutil.which("node")
            if not node:
                raise SimulationError("전투 테스트에는 Node.js 22.8 이상이 필요합니다. 설치 후 서버를 다시 시작해 주세요.", 503)
            data = self._snapshot()
            if len(data["characters"]) < 2 * settings["teamSize"]:
                raise SimulationError("양 팀을 편성할 캐릭터 수가 부족합니다.")
            markdown = self.targets_path.read_text(encoding="utf-8")
            parse_targets(markdown)
            job_id = "simulation_" + datetime.now().strftime("%Y%m%d_%H%M%S_") + uuid.uuid4().hex[:8]
            directory = self.storage / job_id
            directory.mkdir()
            atomic_json(directory / "request.json", {"settings": settings, "inputSnapshot": data, "targetMarkdown": markdown})
            job = {"simulationId": job_id, "startedAt": now(), "finishedAt": None, "status": "RUNNING",
                   "settings": settings, "completed": 0, "total": settings["count"], "elapsedSeconds": 0,
                   "error": None, "resultUrl": f"/api/simulations/{job_id}/result"}
            self.jobs[job_id] = job
            self._save(job)
            try:
                with (directory / "error.log").open("w", encoding="utf-8") as errors:
                    process = subprocess.Popen([node, str(self.root / "balance/simulator/worker.cjs"), str(directory)],
                        cwd=self.root, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=errors,
                        text=True, encoding="utf-8", creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
                self.process = process
                threading.Thread(target=self._monitor, args=(job_id, process), daemon=True).start()
            except OSError as exc:
                job.update(status="FAILED", finishedAt=now(), error=f"실행기를 시작하지 못했습니다: {exc}")
                self._save(job)
            return dict(job)

    def _save(self, job):
        atomic_json(self.storage / job["simulationId"] / "job.json", job)

    @staticmethod
    def _run_metadata(run):
        return {"status": run.get("status", "COMPLETED"), "finishedAt": run.get("finishedAt"),
                "completed": run["summary"]["battles"], "elapsedSeconds": run["elapsedSeconds"],
                "dataHash": run["dataHash"], "engineHash": run["engineHash"], "gitRevision": run["gitRevision"],
                "averageDuration": run["summary"]["duration"]["average"], "error": run.get("error")}

    def _monitor(self, job_id, process):
        directory = self.storage / job_id
        failure = None
        try:
            for line in process.stdout:
                event = json.loads(line)
                if event.get("type") == "progress":
                    with self.lock:
                        self.jobs[job_id].update({key: event[key] for key in ("completed", "total", "elapsedSeconds")})
                        self._save(self.jobs[job_id])
            code = process.wait()
            if code or not (directory / "result.json").exists():
                raise RuntimeError(f"실행기가 종료되었습니다 (exit {code}).")
            update = self._run_metadata(read_json(directory / "result.json"))
        except Exception as exc:
            failure = str(exc)
            with (directory / "error.log").open("a", encoding="utf-8") as errors:
                traceback.print_exc(file=errors)
            update = {"status": "FAILED", "finishedAt": now(), "error": failure + " 개발 로그를 확인해 주세요."}
            details = (directory / "error.log").read_text(encoding="utf-8", errors="replace")
            actionable = next((line for line in details.splitlines() if line.startswith("Error:")), None)
            if actionable:
                update["error"] = actionable[:500] + " · 개발 로그에서 상세 내용을 확인할 수 있습니다."
            journal = directory / "battles.ndjson"
            if journal.exists():
                # A crash may occur after journaling but before the next progress message.
                update["completed"] = sum(1 for line in journal.read_text(encoding="utf-8").splitlines()
                                          if line.endswith("}"))
            update["elapsedSeconds"] = (datetime.now(timezone.utc) -
                datetime.fromisoformat(self.jobs[job_id]["startedAt"])).total_seconds()
        finally:
            if process.stdin:
                process.stdin.close()
            if process.stdout:
                process.stdout.close()
            with self.lock:
                self.jobs[job_id].update(update)
                self._save(self.jobs[job_id])
                if self.process is process:
                    self.process = None

    def cancel(self, job_id):
        with self.lock:
            job = self.get(job_id)
            if job_id in self.jobs and job["status"] in ACTIVE:
                (self.storage / job_id / "cancel").touch()
                self.jobs[job_id]["status"] = "CANCELLING"
                self._save(self.jobs[job_id])
                return dict(self.jobs[job_id])
            return job

    def _legacy(self):
        entries = {}
        for path in self.legacy_dir.glob("*.json"):
            try:
                stamp = path.stat().st_mtime_ns
                cached = self.legacy_cache.get(path.name)
                if not cached or cached[0] != stamp:
                    run = read_json(path)
                    job_id = "legacy_" + path.stem
                    job = {"simulationId": job_id, "startedAt": run["startedAt"], "settings": run["settings"],
                           "total": run["settings"]["count"], "resultUrl": f"/api/simulations/{job_id}/result",
                           **self._run_metadata(run)}
                    self.legacy_cache[path.name] = (stamp, job)
                entries[self.legacy_cache[path.name][1]["simulationId"]] = self.legacy_cache[path.name][1]
            except (OSError, ValueError, KeyError, TypeError):
                continue
        return entries

    def list(self):
        with self.lock:
            jobs = list({**self._legacy(), **self.jobs}.values())
            return {"jobs": sorted(jobs, key=lambda j: j["startedAt"], reverse=True),
                    "activeId": next((j["simulationId"] for j in jobs if j["status"] in ACTIVE), None)}

    def get(self, job_id):
        with self.lock:
            job = self.jobs.get(job_id) or self._legacy().get(job_id)
            if not job:
                raise SimulationError("실행 기록을 찾을 수 없습니다.", 404)
            return dict(job)

    def file(self, job_id, kind):
        self.get(job_id)  # Only known IDs can resolve paths.
        if kind not in ("json", "markdown", "log", "journal"):
            raise SimulationError("알 수 없는 결과 형식입니다.", 404)
        if job_id in self.jobs:
            path = self.storage / job_id / {"json": "result.json", "markdown": "report.md",
                                           "log": "error.log", "journal": "battles.ndjson"}[kind]
        elif kind in ("json", "markdown"):
            path = self.legacy_dir / (job_id.removeprefix("legacy_") + (".json" if kind == "json" else ".md"))
        else:
            raise SimulationError("이 실행에는 해당 파일이 없습니다.", 404)
        if not path.is_file():
            raise SimulationError("결과 파일이 아직 없거나 생성되지 않았습니다.", 404)
        return path

    def result(self, job_id):
        run = read_json(self.file(job_id, "json"))
        # Dashboard responses exclude the large immutable input and per-battle traces.
        return {**{key: value for key, value in run.items() if key not in ("inputSnapshot", "results", "targetMarkdown")},
                "simulationId": job_id, "targets": parse_targets(run.get("targetMarkdown") or
                    self.targets_path.read_text(encoding="utf-8")),
                "targetSource": "snapshot" if run.get("targetMarkdown") else "current"}

    def close(self):
        with self.lock:
            self.closed = True
            for job in self.jobs.values():
                if job["status"] in ACTIVE:
                    (self.storage / job["simulationId"] / "cancel").touch()
            if self.process and self.process.stdin and not self.process.stdin.closed:
                self.process.stdin.close()
