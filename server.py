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


ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
IMAGE_SETTINGS_PATH = DATA_DIR / "image-generator-settings.json"
ASSET_IMAGE_DIRS = {
    "portraits": ROOT / "assets" / "images" / "portraits",
    "skills": ROOT / "assets" / "images" / "skills",
    "items": ROOT / "assets" / "images" / "items",
    "icons": ROOT / "assets" / "images" / "icons",
    "generated": ROOT / "assets" / "images" / "generated",
}
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
        if path == "/api/image-settings":
            server_log(f"GET {path} -> {IMAGE_SETTINGS_PATH.relative_to(ROOT)}")
            self.send_json(self.read_json_object(IMAGE_SETTINGS_PATH))
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
        if path == "/api/image-settings":
            self.handle_image_settings_write()
            return

        self.handle_api_write()

    def do_POST(self):
        path = self.path.split("?", 1)[0]
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
