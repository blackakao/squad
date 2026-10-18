import json
import struct
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ASSET = ROOT / "assets/characters/hair/imported/여성_머리_01.glb"


class ExternalHairGlbTest(unittest.TestCase):
    def test_registered_hair_is_self_contained_and_named_by_role(self):
        data = ASSET.read_bytes()
        magic, version, total = struct.unpack_from("<4sII", data, 0)
        self.assertEqual((magic, version, total), (b"glTF", 2, len(data)))
        json_length, chunk_type = struct.unpack_from("<II", data, 12)
        self.assertEqual(chunk_type, 0x4E4F534A)
        gltf = json.loads(data[20:20 + json_length].decode("utf-8").rstrip(" \0"))
        names = {node.get("name", "") for node in gltf.get("nodes", [])}
        self.assertTrue(any(name.startswith("CrownHair") for name in names))
        for role in ("FrontHair", "SideHair", "BackHair"):
            self.assertTrue(any(name.startswith(role) for name in names), role)
        self.assertGreaterEqual(len(gltf.get("meshes", [])), 29)
        self.assertEqual({material.get("name") for material in gltf.get("materials", [])}, {"Hair_Base", "Hair_Highlight"})
        self.assertFalse(gltf.get("skins"))
        self.assertFalse(gltf.get("animations"))
        self.assertFalse(gltf.get("images"))


if __name__ == "__main__":
    unittest.main()
