"""Exercise the existing save API in isolation, never touching user content."""
import base64
import http.client
import json
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server


class PortraitStorageTest(unittest.TestCase):
    def test_image_and_recipe_round_trip(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            with patch.object(server, 'ROOT', root), patch.object(server, 'DATA_DIR', root / 'data'), patch.dict(server.ASSET_IMAGE_DIRS, {'portraits': root / 'assets/images/portraits'}):
                httpd = server.ThreadingHTTPServer(('127.0.0.1', 0), server.BattleHandler)
                thread = threading.Thread(target=httpd.serve_forever, daemon=True)
                thread.start()
                def request(method, path, body=None):
                    connection = http.client.HTTPConnection(*httpd.server_address)
                    try:
                        connection.request(method, path, json.dumps(body) if body is not None else None, {'Content-Type': 'application/json'})
                        response = connection.getresponse()
                        self.assertEqual(response.status, 200)
                        return response.read()
                    finally:
                        connection.close()
                try:
                    png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZkAAAAASUVORK5CYII='
                    result = json.loads(request('POST', '/api/assets/portraits', {'name': 'portrait-test', 'dataUrl': 'data:image/png;base64,' + png}))
                    recipe = {'version': 1, 'hair': 'm3', 'eyes': 'eye2', 'nose': 'nose3', 'mouth': 'mouth4', 'skin': 'skin5'}
                    character = {'name': '테스트', 'portrait': result['path'], 'appearance': recipe}
                    request('PUT', '/api/characters', [character])
                    self.assertEqual(json.loads(request('GET', '/api/characters')), [character])
                    self.assertEqual(request('GET', '/' + result['path']), base64.b64decode(png))
                    self.assertEqual(json.loads((root / 'data/characters.json').read_text(encoding='utf-8')), [character])
                finally:
                    httpd.shutdown()
                    httpd.server_close()
                    thread.join()


if __name__ == '__main__':
    unittest.main()
