from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import os
import re
import base64
import sys
import urllib.error
import urllib.parse
import urllib.request
import subprocess
from datetime import datetime
from entity_store import EntityStore, EntityError
from simulation_jobs import SimulationJobs, SimulationError
import threading
import atexit


ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
ENTITY_STORE = EntityStore(DATA_DIR)
SIMULATION_JOBS = None
SIMULATION_LOCK = threading.Lock()


def get_simulation_jobs():
    global SIMULATION_JOBS
    with SIMULATION_LOCK:
        if SIMULATION_JOBS is None:
            SIMULATION_JOBS = SimulationJobs(ROOT, DATA_DIR)
            atexit.register(SIMULATION_JOBS.close)
        return SIMULATION_JOBS


IMAGE_SETTINGS_PATH = DATA_DIR / "image-generator-settings.json"
ASSET_IMAGE_DIRS = {
    "portraits": ROOT / "assets" / "images" / "portraits",
    "skills": ROOT / "assets" / "images" / "skills",
    "items": ROOT / "assets" / "images" / "items",
    "icons": ROOT / "assets" / "images" / "icons",
    "generated": ROOT / "assets" / "images" / "generated",
}
CHARACTER_PART_CATEGORIES = (
    {"id": "hair", "label": "Hair", "folder": "assets/characters/hair/imported", "attachment": "head-root-space", "hideNodes": ["Hair_Anchor", "Independent_Hair"], "randomAllowNone": False},
    {"id": "eyes", "label": "Eyes", "folder": "assets/characters/parts/eyes", "attachment": "head-root-space", "hideNodes": ["Independent_Eyes"], "randomAllowNone": False},
    {"id": "mouth", "label": "Mouth", "folder": "assets/characters/parts/mouth", "attachment": "head-root-space", "hideNodes": ["Independent_Mouth"], "randomAllowNone": False},
    {"id": "nose", "label": "Nose", "folder": "assets/characters/parts/nose", "attachment": "head-root-space", "hideNodes": ["Independent_Nose"], "randomAllowNone": False},
    {"id": "clothes", "label": "Clothes", "folder": "assets/characters/parts/clothes", "attachment": "character-root", "hideNodes": [], "randomAllowNone": False},
)
CHARACTER_HAIR_IMPORT_DIR = ROOT / CHARACTER_PART_CATEGORIES[0]["folder"]
API_NAME_RE = re.compile(r"^[a-zA-Z0-9_-]+$")
ASSET_NAME_RE = re.compile(r"[^a-zA-Z0-9_-]+")
DATA_URL_RE = re.compile(r"^data:image/(?P<ext>png|jpeg|jpg|webp|gif);base64,(?P<data>.+)$", re.DOTALL)
IMAGE_CONTENT_TYPES = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
}
API_FILE_ALIASES = {
    "records": "battle-records",
}


def list_imported_character_hair():
    """List GLB files from CharacterViewer's fixed, project-local import folder."""
    CHARACTER_HAIR_IMPORT_DIR.mkdir(parents=True, exist_ok=True)
    files = []
    for file_path in CHARACTER_HAIR_IMPORT_DIR.iterdir():
        if not file_path.is_file() or file_path.suffix.lower() != ".glb":
            continue
        stat = file_path.stat()
        files.append({
            "name": file_path.name,
            "path": file_path.relative_to(ROOT).as_posix(),
            "bytes": stat.st_size,
            "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds"),
        })
    files.sort(key=lambda item: (item["name"].casefold(), item["name"]))
    return {
        "folder": CHARACTER_HAIR_IMPORT_DIR.relative_to(ROOT).as_posix(),
        "files": files,
    }


def list_character_parts():
    """Build the development catalog from the fixed character-part registry."""
    categories = []
    for definition in CHARACTER_PART_CATEGORIES:
        folder = ROOT / definition["folder"]
        folder.mkdir(parents=True, exist_ok=True)
        files = []
        for file_path in folder.iterdir():
            if not file_path.is_file() or file_path.suffix.lower() != ".glb":
                continue
            stat = file_path.stat()
            files.append({
                "name": file_path.name,
                "displayName": file_path.stem,
                "path": file_path.relative_to(ROOT).as_posix(),
                "bytes": stat.st_size,
                "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds"),
            })
        files.sort(key=lambda item: (item["name"].casefold(), item["name"]))
        categories.append({**definition, "files": files, "supportsNone": True})
    return {"categories": categories}


def server_log(message):
    print(f"[{datetime.now().isoformat(timespec='seconds')}] {message}", flush=True)


def get_api_file_path(path):
    if not path.startswith("/api/"):
        return None

    api_name = path.removeprefix("/api/").strip("/")
    if not api_name or "/" in api_name or not API_NAME_RE.fullmatch(api_name):
        return None

    file_stem = API_FILE_ALIASES.get(api_name, api_name)
    return DATA_DIR / f"{file_stem}.json"


def slugify_asset_name(value):
    slug = ASSET_NAME_RE.sub("-", str(value or "image").strip()).strip("-").lower()
    return slug or "image"


def save_asset_image(asset_kind, image_bytes, name, ext):
    target_dir = ASSET_IMAGE_DIRS[asset_kind]
    target_dir.mkdir(parents=True, exist_ok=True)
    if asset_kind == "generated":
        # Preserve Unicode names, but never allow paths or Windows reserved names.
        stem = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '-', str(name or 'image')).strip(' .')
        stem = re.sub(r'\.(png|jpe?g|webp|gif)$', '', stem, flags=re.IGNORECASE).strip(' .')[:100] or 'image'
        if re.fullmatch(r'(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?', stem, re.IGNORECASE):
            stem = '_' + stem
    else:
        stem = slugify_asset_name(name) + '-' + datetime.now().strftime('%Y%m%d%H%M%S%f')
    number = 1
    while True:
        suffix = '' if number == 1 else f'-{number}'
        file_path = target_dir / f'{stem}{suffix}.{ext}'
        try:
            with file_path.open('xb') as output:
                output.write(image_bytes)
            return file_path
        except FileExistsError:
            number += 1


class BattleHandler(SimpleHTTPRequestHandler):
    def handle_simulation_request(self, path):
        if not (path == "/api/simulation-targets" or path == "/api/simulations" or path.startswith("/api/simulations/")):
            return False
        try:
            jobs = get_simulation_jobs()
            body = None
            if self.command in ("POST", "PUT"):
                size = int(self.headers.get("Content-Length", "0"))
                if size < 0 or size > 16384:
                    raise SimulationError("요청 크기가 너무 큽니다.")
                body = json.loads(self.rfile.read(size) or b"{}")
            if path == "/api/simulation-targets" and self.command in ("GET", "PUT"):
                if self.command == "PUT" and (not isinstance(body, dict) or body.get("targets") is None):
                    raise SimulationError("목표 설정이 필요합니다.")
                result = jobs.targets(body["targets"] if self.command == "PUT" else None)
            elif path == "/api/simulations" and self.command in ("GET", "POST"):
                result = jobs.start(body) if self.command == "POST" else jobs.list()
            else:
                match = re.fullmatch(r"/api/simulations/([A-Za-z0-9_.-]+)(?:/(result|cancel|json|markdown|log|journal))?", path)
                if not match:
                    raise SimulationError("지원하지 않는 전투 테스트 요청입니다.", 404)
                job_id, action = match.groups()
                if action == "cancel" and self.command == "POST":
                    result = jobs.cancel(job_id)
                elif self.command == "GET" and action in (None, "result"):
                    result = jobs.result(job_id) if action else jobs.get(job_id)
                elif self.command == "GET" and action in ("json", "markdown", "log", "journal"):
                    content = jobs.file(job_id, action).read_bytes()
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json; charset=utf-8" if action == "json" else "text/plain; charset=utf-8")
                    self.send_header("Content-Length", str(len(content)))
                    self.send_header("Cache-Control", "no-store")
                    self.end_headers()
                    self.wfile.write(content)
                    return True
                else:
                    raise SimulationError("지원하지 않는 요청 방식입니다.", 405)
            self.send_json(result)
        except SimulationError as exc:
            self.send_json_error(exc.status, str(exc))
        except (ValueError, UnicodeError):
            self.send_json_error(400, "JSON 형식과 입력값을 확인해 주세요.")
        except OSError as exc:
            server_log(f"Simulation API: {exc}")
            self.send_json_error(500, "테스트 파일을 읽거나 저장하지 못했습니다. 서버 로그를 확인해 주세요.")
        return True

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if self.handle_simulation_request(path):
            return
        if path.rstrip("/") == "/api/entities" or path.startswith("/api/entities/"):
            self.handle_entities(path)
            return
        if path.rstrip("/") == "/api/skills":
            ENTITY_STORE.migrate()
        if path == "/api/image-settings":
            server_log(f"GET {path} -> {IMAGE_SETTINGS_PATH.relative_to(ROOT)}")
            self.send_json(self.read_json_object(IMAGE_SETTINGS_PATH))
            return
        if path == "/api/character-assets/hair":
            server_log(f"GET {path} -> {CHARACTER_HAIR_IMPORT_DIR.relative_to(ROOT)}")
            self.send_json(list_imported_character_hair())
            return
        if path == "/api/character-assets/parts":
            server_log(f"GET {path} -> character part registry")
            self.send_json(list_character_parts())
            return

        api_file_path = get_api_file_path(path)
        if api_file_path:
            server_log(f"GET {path} -> {api_file_path.relative_to(ROOT)}")
            self.send_json(self.read_json(api_file_path))
            return

        if path == "/":
            self.path = "/index.html"
        super().do_GET()

    def do_PUT(self):
        path = self.path.split("?", 1)[0]
        if self.handle_simulation_request(path):
            return
        if path.rstrip("/") == "/api/entities" or path.startswith("/api/entities/"):
            self.handle_entities(path)
            return
        if path == "/api/image-settings":
            self.handle_image_settings_write()
            return

        self.handle_api_write()

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        if self.handle_simulation_request(path):
            return
        if path.rstrip("/") == "/api/entities" or path.startswith("/api/entities/"):
            self.handle_entities(path)
            return
        if path.startswith("/api/open-folder/"):
            self.handle_open_folder(path)
            return

        if path == "/api/image/generate":
            self.handle_image_generation()
            return

        if path.startswith("/api/assets-url/"):
            self.handle_asset_url_upload(path)
            return

        if path.startswith("/api/assets/"):
            self.handle_asset_upload(path)
            return

        self.handle_api_write()

    def do_DELETE(self):
        self.handle_entities(self.path.split("?", 1)[0])

    def handle_entities(self, path):
        try:
            if path.rstrip("/") != "/api/entities" and not path.startswith("/api/entities/"):
                raise EntityError("Unknown API", 404)
            parts = path.removeprefix("/api/entities").strip("/").split("/")
            entity_id = parts[0].removesuffix(".json")
            with ENTITY_STORE.lock:
                ENTITY_STORE.migrate()
                if self.command == "GET":
                    if not entity_id:
                        result = ENTITY_STORE.list()
                    elif len(parts) == 2 and parts[1] == "usages":
                        ENTITY_STORE.get(entity_id)
                        result = ENTITY_STORE.usages(entity_id)
                    elif len(parts) == 1:
                        result = ENTITY_STORE.get(entity_id)
                    else:
                        raise EntityError("Unknown Entity API", 404)
                elif self.command in {"POST", "PUT"}:
                    if len(parts) != 1 or (self.command == "POST" and entity_id) or (self.command == "PUT" and not entity_id):
                        raise EntityError("POST /api/entities/ 또는 PUT /api/entities/<id>를 사용하세요.")
                    body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))).decode("utf-8"))
                    if self.command == "PUT" and body.get("entityId") != entity_id:
                        raise EntityError("수정 시 Entity ID를 변경할 수 없습니다. 새 Entity로 저장하세요.")
                    result = ENTITY_STORE.save(body, create=self.command == "POST")
                elif self.command == "DELETE" and entity_id and len(parts) == 1:
                    ENTITY_STORE.delete(entity_id)
                    result = {"ok": True}
                else:
                    raise EntityError("Unknown Entity API", 404)
                self.send_json(result)
        except Exception as error:
            self.send_json_error(getattr(error, "status", 400), str(error))

    def handle_open_folder(self, path):
        asset_kind = path.removeprefix("/api/open-folder/").strip("/")
        target_dir = ASSET_IMAGE_DIRS.get(asset_kind)
        if not target_dir:
            self.send_json_error(404, "Unknown folder kind")
            return

        try:
            target_dir.mkdir(parents=True, exist_ok=True)
            if os.name == "nt":
                os.startfile(target_dir)
            elif sys.platform == "darwin":
                subprocess.Popen(["open", str(target_dir)])
            else:
                subprocess.Popen(["xdg-open", str(target_dir)])

            server_log(f"POST {path} opened {target_dir.relative_to(ROOT)}")
            self.send_json({"ok": True, "path": target_dir.relative_to(ROOT).as_posix()})
        except Exception as error:
            server_log(f"POST {path} failed: {error}")
            self.send_json_error(400, str(error))

    def handle_image_generation(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            payload = self.rfile.read(content_length).decode("utf-8")
            body = json.loads(payload)

            prompt = str(body.get("prompt", "")).strip()
            style = str(body.get("style", "")).strip()
            provider = str(body.get("provider", "pollinations")).strip().lower()
            model = str(body.get("model", "")).strip()
            width = self.clamp_int(body.get("width"), 256, 1536, 768)
            height = self.clamp_int(body.get("height"), 256, 1536, 768)
            seed = self.clamp_int(body.get("seed"), 0, 2147483647, 0)

            if not prompt:
                raise ValueError("prompt is required")

            full_prompt = ", ".join(part for part in [prompt, style] if part)
            server_log(f"POST /api/image/generate provider={provider} size={width}x{height}")

            if provider == "huggingface":
                image_bytes, content_type = self.generate_with_huggingface(full_prompt, model)
            elif provider == "pollinations":
                image_bytes, content_type = self.generate_with_pollinations(full_prompt, width, height, seed, model)
            else:
                raise ValueError("provider must be pollinations or huggingface")

            ext = IMAGE_CONTENT_TYPES.get(content_type.split(";", 1)[0].lower(), "png")
            data_url = f"data:image/{ext};base64,{base64.b64encode(image_bytes).decode('ascii')}"
            self.send_json({
                "ok": True,
                "provider": provider,
                "model": model,
                "dataUrl": data_url,
                "contentType": content_type,
            })
        except Exception as error:
            server_log(f"POST /api/image/generate failed: {error}")
            self.send_response(400)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "error": str(error)}, ensure_ascii=False).encode("utf-8"))

    def handle_asset_url_upload(self, path):
        asset_kind = path.removeprefix("/api/assets-url/").strip("/")
        target_dir = ASSET_IMAGE_DIRS.get(asset_kind)
        if not target_dir:
            self.send_error(404, "Unknown asset kind")
            return

        try:
            content_length = int(self.headers.get("Content-Length", 0))
            payload = self.rfile.read(content_length).decode("utf-8")
            body = json.loads(payload)
            image_url = str(body.get("imageUrl", "")).strip()
            parsed_url = urllib.parse.urlparse(image_url)
            if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
                raise ValueError("imageUrl must be an http or https URL")

            image_bytes, content_type = self.fetch_image(image_url)
            content_type_key = content_type.split(";", 1)[0].lower()
            ext = IMAGE_CONTENT_TYPES.get(content_type_key)
            if not ext:
                raise ValueError(f"unsupported image content type: {content_type}")

            file_path = save_asset_image(asset_kind, image_bytes, body.get("name"), ext)

            relative_path = file_path.relative_to(ROOT).as_posix()
            server_log(f"POST {path} saved {relative_path}")
            self.send_json({"ok": True, "path": relative_path})
        except Exception as error:
            server_log(f"POST {path} failed: {error}")
            self.send_response(400)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "error": str(error)}, ensure_ascii=False).encode("utf-8"))

    def generate_with_pollinations(self, prompt, width, height, seed, model):
        query = {
            "width": str(width),
            "height": str(height),
            "nologo": "true",
            "private": "true",
            "safe": "true",
        }
        if seed:
            query["seed"] = str(seed)
        if model:
            query["model"] = model

        encoded_prompt = urllib.parse.quote(prompt)
        url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?{urllib.parse.urlencode(query)}"
        return self.fetch_image(url)

    def generate_with_huggingface(self, prompt, model):
        token = os.environ.get("HF_TOKEN", "").strip()
        if not token:
            raise ValueError("HF_TOKEN environment variable is required for Hugging Face generation")

        model_name = model or os.environ.get("HF_IMAGE_MODEL", "stabilityai/stable-diffusion-xl-base-1.0")
        url = f"https://api-inference.huggingface.co/models/{urllib.parse.quote(model_name, safe='/')}"
        payload = json.dumps({"inputs": prompt}).encode("utf-8")
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "image/png",
        }
        return self.fetch_image(url, payload, headers)

    def fetch_image(self, url, payload=None, headers=None):
        request = urllib.request.Request(url, data=payload, headers=headers or {}, method="POST" if payload else "GET")
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                content_type = response.headers.get("Content-Type", "image/png")
                data = response.read()
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            raise ValueError(f"image provider failed: HTTP {error.code} {detail}") from error

        if not data:
            raise ValueError("image provider returned an empty response")
        if not content_type.lower().startswith("image/"):
            detail = data[:500].decode("utf-8", errors="replace")
            raise ValueError(f"image provider returned non-image response: {detail}")
        return data, content_type

    def clamp_int(self, value, minimum, maximum, fallback):
        try:
            number = int(value)
        except (TypeError, ValueError):
            return fallback
        return max(minimum, min(maximum, number))

    def handle_asset_upload(self, path):
        asset_kind = path.removeprefix("/api/assets/").strip("/")
        target_dir = ASSET_IMAGE_DIRS.get(asset_kind)
        if not target_dir:
            self.send_error(404, "Unknown asset kind")
            return

        try:
            content_length = int(self.headers.get("Content-Length", 0))
            payload = self.rfile.read(content_length).decode("utf-8")
            body = json.loads(payload)
            match = DATA_URL_RE.fullmatch(str(body.get("dataUrl", "")))
            if not match:
                raise ValueError("dataUrl must be a supported image data URL")

            ext = "jpg" if match.group("ext") == "jpeg" else match.group("ext")
            image_bytes = base64.b64decode(match.group("data"), validate=True)
            if not image_bytes:
                raise ValueError("image payload is empty")

            file_path = save_asset_image(asset_kind, image_bytes, body.get("name"), ext)

            relative_path = file_path.relative_to(ROOT).as_posix()
            server_log(f"POST {path} saved {relative_path}")
            self.send_json({"ok": True, "path": relative_path})
        except Exception as error:
            server_log(f"POST {path} failed: {error}")
            self.send_response(400)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "error": str(error)}, ensure_ascii=False).encode("utf-8"))

    def handle_image_settings_write(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            payload = self.rfile.read(content_length).decode("utf-8")
            data = json.loads(payload)
            if not isinstance(data, dict):
                raise ValueError("JSON root must be an object")

            data["updatedAt"] = datetime.now().isoformat(timespec="seconds")
            self.write_json(IMAGE_SETTINGS_PATH, data)
            server_log(f"PUT /api/image-settings saved {IMAGE_SETTINGS_PATH.relative_to(ROOT)}")
            self.send_json({"ok": True, "settings": data})
        except Exception as error:
            server_log(f"PUT /api/image-settings failed: {error}")
            self.send_response(400)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "error": str(error)}, ensure_ascii=False).encode("utf-8"))

    def handle_api_write(self):
        path = self.path.split("?", 1)[0]
        api_file_path = get_api_file_path(path)
        if not api_file_path:
            self.send_error(404, "Not found")
            return

        try:
            content_length = int(self.headers.get("Content-Length", 0))
            payload = self.rfile.read(content_length).decode("utf-8")
            data = json.loads(payload)
            if not isinstance(data, list):
                raise ValueError("JSON root must be an array")
            if api_file_path == DATA_DIR / "skills.json":
                ENTITY_STORE.save_skills(data)
            else:
                self.write_json(api_file_path, data)
            server_log(f"{self.command} {path} saved {len(data)} records")
            self.send_json({"ok": True})
        except Exception as error:
            server_log(f"{self.command} {path} failed: {error}")
            self.send_response(400)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "error": str(error)}, ensure_ascii=False).encode("utf-8"))

    def read_json(self, file_path):
        if not file_path.exists():
            return []
        with file_path.open("r", encoding="utf-8") as file:
            return json.load(file)

    def read_json_object(self, file_path):
        if not file_path.exists():
            return {}
        with file_path.open("r", encoding="utf-8") as file:
            data = json.load(file)
        return data if isinstance(data, dict) else {}

    def write_json(self, file_path, data):
        file_path.parent.mkdir(parents=True, exist_ok=True)
        with file_path.open("w", encoding="utf-8") as file:
            json.dump(data, file, ensure_ascii=False, indent=2)
            file.write("\n")

    def send_json(self, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_json_error(self, status, message):
        body = json.dumps({"ok": False, "error": message}, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer(("127.0.0.1", port), BattleHandler)
    print(f"Serving http://127.0.0.1:{port}/index.html")
    server_log("API mapping enabled: /api/<name> -> data/<name>.json, /api/records -> data/battle-records.json")
    server.serve_forever()
