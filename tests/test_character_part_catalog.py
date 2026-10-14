import unittest
from pathlib import Path

import server


class CharacterPartCatalogTests(unittest.TestCase):
    def test_registry_lists_required_categories_and_only_direct_glb_files(self):
        catalog = server.list_character_parts()
        categories = {item["id"]: item for item in catalog["categories"]}
        self.assertEqual(set(categories), {"hair", "eyes", "mouth", "nose", "clothes"})
        self.assertEqual(categories["hair"]["folder"], "assets/characters/hair/imported")
        self.assertEqual(categories["clothes"]["attachment"], "character-root")
        self.assertTrue(all(category["supportsNone"] for category in categories.values()))
        self.assertTrue(all(category["randomAllowNone"] is False for category in categories.values()))
        self.assertTrue(categories["hair"]["files"])
        for category in categories.values():
            names = [item["name"] for item in category["files"]]
            self.assertEqual(names, sorted(names, key=lambda name: (name.casefold(), name)))
            for item in category["files"]:
                self.assertEqual(Path(item["name"]).suffix.lower(), ".glb")
                self.assertEqual(Path(item["path"]).parent.as_posix(), category["folder"])
                self.assertEqual(item["displayName"], Path(item["name"]).stem)


if __name__ == "__main__":
    unittest.main()
