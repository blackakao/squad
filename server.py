from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import os
import re
import base64
from datetime import datetime


ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
ASSET_IMAGE_DIRS = {
    "portraits": ROOT / "assets" / "images" / "portraits",
    "skills": ROOT / "assets" / "images" / "skills",
    "items": ROOT / "assets" / "images" / "items",
    "icons": ROOT / "assets" / "images" / "icons",
}
API_NAME_RE = re.compile(r"^[a-zA-Z0-9_-]+$")
ASSET_NAME_RE = re.compile(r"[^a-zA-Z0-9_-]+")
DATA_URL_RE = re.compile(r"^data:image/(?P<ext>png|jpeg|jpg|webp|gif);base64,(?P<data>.+)$", re.DOTALL)
API_FILE_ALIASES = {
    "records": "battle-records",
}


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


class BattleHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        api_file_path = get_api_file_path(path)
        if api_file_path:
            server_log(f"GET {path} -> {api_file_path.relative_to(ROOT)}")
            self.send_json(self.read_json(api_file_path))
            return

        if path == "/":
            self.path = "/index.html"
        super().do_GET()

    def do_PUT(self):
        self.handle_api_write()

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        if path.startswith("/api/assets/"):
            self.handle_asset_upload(path)
            return

        self.handle_api_write()

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

            target_dir.mkdir(parents=True, exist_ok=True)
            stem = slugify_asset_name(body.get("name"))
            timestamp = datetime.now().strftime("%Y%m%d%H%M%S%f")
            file_path = target_dir / f"{stem}-{timestamp}.{ext}"
            file_path.write_bytes(image_bytes)

            relative_path = file_path.relative_to(ROOT).as_posix()
            server_log(f"POST {path} saved {relative_path}")
            self.send_json({"ok": True, "path": relative_path})
        except Exception as error:
            server_log(f"POST {path} failed: {error}")
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


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer(("127.0.0.1", port), BattleHandler)
    print(f"Serving http://127.0.0.1:{port}/index.html")
    server_log("API mapping enabled: /api/<name> -> data/<name>.json, /api/records -> data/battle-records.json")
    server.serve_forever()
