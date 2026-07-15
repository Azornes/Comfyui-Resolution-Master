import json
import math
import unittest

from core.auto_detect import (
    apply_auto_resize,
    apply_auto_snap,
    apply_custom_calculation,
    calculate_rescale_factor,
    calculate_resolution,
    calculate_target_resolution_from_scale,
    find_closest_preset,
    load_presets,
)


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

    def test_flipped_orientation_can_be_selected(self):
        presets = {"landscape": {"width": 1000, "height": 700}}

        closest = find_closest_preset(700, 1000, presets)

        self.assertEqual(closest, {"name": "landscape", "width": 700, "height": 1000})

    def test_invalid_presets_are_ignored(self):
        presets = {
            "not-an-object": "1024x1024",
            "zero": {"width": 0, "height": 1024},
            "invalid": {"width": "wide", "height": 1024},
        }

        self.assertIsNone(find_closest_preset(1000, 1000, presets))


class PresetLoadingTests(unittest.TestCase):
    def test_load_presets_accepts_only_json_objects(self):
        self.assertEqual(load_presets('{"square": {"width": 512, "height": 512}}')["square"]["width"], 512)
        self.assertEqual(load_presets("[]"), {})
        self.assertEqual(load_presets("not-json"), {})
        self.assertEqual(load_presets(None), {})


class ScalingTests(unittest.TestCase):
    def test_rescale_factor_modes(self):
        self.assertEqual(calculate_rescale_factor(640, 480, "manual", 1.5, 1080, 2.0), 1.5)
        self.assertEqual(calculate_rescale_factor(1000, 1000, "megapixels", 1.0, 1080, 4.0), 2.0)
        self.assertTrue(
            math.isclose(
                calculate_rescale_factor(1920, 1080, "resolution", 1.0, 1080, 2.0),
                1.0,
            )
        )

    def test_auto_resize_supports_each_mode(self):
        self.assertEqual(apply_auto_resize(640, 480, "manual", 1.5, 1080, 2.0, False), {"width": 960, "height": 720})
        self.assertEqual(
            apply_auto_resize(1000, 1000, "megapixels", 1.0, 1080, 4.0, False),
            {"width": 2000, "height": 2000},
        )
        self.assertEqual(
            apply_auto_resize(1920, 1080, "resolution", 1.0, 720, 2.0, False),
            {"width": 1280, "height": 720},
        )

    def test_preserve_ratio_returns_an_exact_reduced_ratio(self):
        result = apply_auto_resize(1000, 600, "manual", 1.5, 1080, 2.0, True)

        self.assertEqual(result["width"] * 3, result["height"] * 5)
        self.assertGreater(result["width"], 1000)

    def test_snap_never_returns_zero(self):
        self.assertEqual(apply_auto_snap(1, 31, 64), {"width": 64, "height": 64})

    def test_target_resolution_from_scale_uses_sixteen_by_nine_pixel_equivalent(self):
        self.assertEqual(calculate_target_resolution_from_scale(512, 512, 2.0), 768)


class ModelCalculationTests(unittest.TestCase):
    def test_flux_applies_megapixel_dimension_and_multiple_constraints(self):
        self.assertEqual(
            apply_custom_calculation(4000, 2000, "Flux", {}),
            {"width": 2560, "height": 1280},
        )
        self.assertEqual(
            apply_custom_calculation(100, 100, "Flux", {}),
            {"width": 320, "height": 320},
        )

    def test_flux2_output_stays_within_bounds_and_uses_multiples_of_sixteen(self):
        result = apply_custom_calculation(8000, 4000, "Flux.2", {})

        self.assertLessEqual(max(result.values()), 3840)
        self.assertGreaterEqual(min(result.values()), 320)
        self.assertEqual(result["width"] % 16, 0)
        self.assertEqual(result["height"] % 16, 0)
        self.assertLessEqual(result["width"] * result["height"], 6_100_000)

    def test_wan_clamps_small_inputs_and_uses_multiples_of_sixteen(self):
        result = apply_custom_calculation(100, 100, "WAN", {})

        self.assertEqual(result, {"width": 432, "height": 432})
        self.assertEqual(result["width"] % 16, 0)
        self.assertEqual(result["height"] % 16, 0)

    def test_qwen_scales_out_of_range_inputs_and_preserves_valid_inputs(self):
        self.assertEqual(
            apply_custom_calculation(100, 100, "Qwen-Image", {}),
            {"width": 768, "height": 768},
        )
        self.assertEqual(
            apply_custom_calculation(1024, 1024, "Qwen-Image", {}),
            {"width": 1024, "height": 1024},
        )
        self.assertEqual(
            apply_custom_calculation(3000, 3000, "Qwen-Image", {}),
            {"width": 2048, "height": 2048},
        )

    def test_preset_matched_model_selects_flipped_orientation(self):
        presets = {"landscape": {"width": 1216, "height": 832}}

        result = apply_custom_calculation(800, 1200, "HiDream Dev", presets)

        self.assertEqual(result, {"width": 832, "height": 1216})

    def test_unknown_category_leaves_dimensions_unchanged(self):
        self.assertEqual(
            apply_custom_calculation(1024, 768, "Unknown Model", {}),
            {"width": 1024, "height": 768},
        )


class CalculateResolutionTests(unittest.TestCase):
    def test_auto_detect_applies_actions_in_documented_order(self):
        presets = json.dumps({"square": {"width": 512, "height": 512}})

        result = calculate_resolution(
            "auto_detect",
            1000,
            700,
            auto_fit_on_change=True,
            auto_resize_on_change=True,
            auto_snap_on_change=True,
            use_custom_calc=True,
            selected_category="Flux",
            snap_value=300,
            upscale_value=2.0,
            rescale_mode="manual",
            presets_json=presets,
        )

        self.assertEqual(result["width"], 896)
        self.assertEqual(result["height"], 896)
        self.assertEqual(result["selected_preset"], "square")
        self.assertEqual(result["rescale_factor"], 2.0)

    def test_invalid_dimensions_are_normalized_to_positive_integers(self):
        result = calculate_resolution("rescale", "invalid", 0)

        self.assertEqual(result["width"], 1)
        self.assertEqual(result["height"], 1)

    def test_unsupported_action_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "Unsupported calculation action"):
            calculate_resolution("unknown-action", 512, 512)


if __name__ == "__main__":
    unittest.main()
