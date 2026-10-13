import unittest
from pathlib import Path

import server


class CharacterHairCatalogTests(unittest.TestCase):
    def test_catalog_exposes_only_sorted_glb_files_from_fixed_folder(self):
        catalog = server.list_imported_character_hair()
        self.assertEqual(catalog["folder"], "assets/characters/hair/imported")
        self.assertTrue(catalog["files"])
        names = [item["name"] for item in catalog["files"]]
        self.assertEqual(names, sorted(names, key=lambda name: (name.casefold(), name)))
        for item in catalog["files"]:
            self.assertEqual(Path(item["name"]).suffix.lower(), ".glb")
            self.assertEqual(Path(item["path"]).parent.as_posix(), catalog["folder"])
            self.assertGreater(item["bytes"], 0)


if __name__ == "__main__":
    unittest.main()
