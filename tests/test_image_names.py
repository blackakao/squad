import tempfile
import base64
import http.client
import json
import threading
import unittest
from pathlib import Path
from unittest.mock import patch
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server


class ImageNamesTest(unittest.TestCase):
    def test_generated_upload_apis_preserve_name_and_image_bytes(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            with patch.object(server, 'ROOT', root), patch.dict(server.ASSET_IMAGE_DIRS, {'generated': root / 'assets/images/generated'}):
                httpd = server.ThreadingHTTPServer(('127.0.0.1', 0), server.BattleHandler)
                thread = threading.Thread(target=httpd.serve_forever, daemon=True)
                thread.start()
                image = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZkAAAAASUVORK5CYII=')
                def request(method, path, body=None):
                    connection = http.client.HTTPConnection(*httpd.server_address, timeout=5)
                    try:
                        connection.request(method, path, json.dumps(body) if body is not None else None, {'Content-Type': 'application/json'})
                        response = connection.getresponse()
                        self.assertEqual(response.status, 200)
                        return response.read()
                    finally:
                        connection.close()
                try:
                    first = json.loads(request('POST', '/api/assets/generated', {'name': '숲의 기사.png', 'dataUrl': 'data:image/png;base64,' + base64.b64encode(image).decode()}))
                    self.assertEqual(first['path'], 'assets/images/generated/숲의 기사.png')
                    with patch.object(server.BattleHandler, 'fetch_image', return_value=(image, 'image/png')):
                        second = json.loads(request('POST', '/api/assets-url/generated', {'name': '숲의 기사', 'imageUrl': 'https://example.test/image.png'}))
                    self.assertEqual(second['path'], 'assets/images/generated/숲의 기사-2.png')
                    for result in [first, second]:
                        self.assertEqual((root / result['path']).read_bytes(), image)
                        self.assertEqual(request('GET', '/' + server.urllib.parse.quote(result['path'])), image)
                finally:
                    httpd.shutdown()
                    httpd.server_close()
                    thread.join()

    def test_unicode_name_and_duplicate_preserve_existing_file(self):
        with tempfile.TemporaryDirectory() as folder:
            with patch.dict(server.ASSET_IMAGE_DIRS, {'generated': Path(folder)}):
                first = server.save_asset_image('generated', b'first', '숲의 기사.png', 'png')
                second = server.save_asset_image('generated', b'second', '숲의 기사', 'png')
                self.assertEqual(first.name, '숲의 기사.png')
                self.assertEqual(second.name, '숲의 기사-2.png')
                self.assertEqual(first.read_bytes(), b'first')

    def test_names_cannot_escape_folder_or_use_reserved_windows_names(self):
        with tempfile.TemporaryDirectory() as folder:
            with patch.dict(server.ASSET_IMAGE_DIRS, {'generated': Path(folder)}):
                for name in ['../../outside', '..\\outside', 'CON', 'NUL.png', '', 'A:B?C']:
                    result = server.save_asset_image('generated', b'image', name, 'png')
                    self.assertEqual(result.parent.resolve(), Path(folder).resolve())
                    self.assertNotIn(result.stem.upper(), ['CON', 'NUL'])


if __name__ == '__main__':
    unittest.main()
