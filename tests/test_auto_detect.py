import unittest

from core.auto_detect import find_closest_preset


class FindClosestPresetTests(unittest.TestCase):
    def test_equal_aspect_ratio_uses_pixel_count_tiebreaker(self):
        presets = {
            "small": {"width": 1200, "height": 800},
            "large": {"width": 1500, "height": 1000},
        }

        closest = find_closest_preset(1600, 1000, presets)

        self.assertEqual(closest, {"name": "large", "width": 1500, "height": 1000})

    def test_selection_is_independent_of_preset_order(self):
        presets = {
            "A": {"width": 402, "height": 400},
            "B": {"width": 759, "height": 750},
            "C": {"width": 1021, "height": 1000},
        }

        forward = find_closest_preset(1000, 1000, presets)
        reversed_order = find_closest_preset(1000, 1000, dict(reversed(list(presets.items()))))

        self.assertEqual(forward, reversed_order)
        self.assertEqual(forward["name"], "B")


if __name__ == "__main__":
    unittest.main()
