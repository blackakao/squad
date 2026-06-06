from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import os
from datetime import datetime


ROOT = Path(__file__).resolve().parent
DATA_FILES = {
    "/api/monsters": ROOT / "data" / "monsters.json",
    "/api/characters": ROOT / "data" / "characters.json",
    "/api/factions": ROOT / "data" / "factions.json",
    "/api/records": ROOT / "data" / "battle-records.json",
    "/api/items": ROOT / "data" / "items.json",
}


def server_log(message):
    print(f"[{datetime.now().isoformat(timespec='seconds')}] {message}", flush=True)


class BattleHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path in DATA_FILES:
            self.send_json(self.read_json(DATA_FILES[path]))
            return

        if path == "/":
            self.path = "/index2.html"
        super().do_GET()

    def do_PUT(self):
        self.handle_api_write()

    def do_POST(self):
        self.handle_api_write()

    def handle_api_write(self):
        path = self.path.split("?", 1)[0]
        if path not in DATA_FILES:
            self.send_error(404, "Not found")
            return

        try:
            content_length = int(self.headers.get("Content-Length", 0))
            payload = self.rfile.read(content_length).decode("utf-8")
            data = json.loads(payload)
            if not isinstance(data, list):
                raise ValueError("JSON root must be an array")
            self.write_json(DATA_FILES[path], data)
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
    print(f"Serving http://127.0.0.1:{port}/index2.html")
    server.serve_forever()
