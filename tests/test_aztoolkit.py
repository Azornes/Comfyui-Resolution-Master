import importlib
import sys
import types
import unittest
from types import SimpleNamespace
from unittest.mock import patch


class FakeNodeOutput:
    def __init__(self, *values):
        self.values = values


class FakeComfyNode:
    hidden = SimpleNamespace(unique_id="node-1", prompt={})


class FakeImage:
    def __init__(self, shape):
        self.shape = shape

    def dim(self):
        return len(self.shape)


def load_aztoolkit_with_runtime_stubs():
    fake_torch = types.ModuleType("torch")
    fake_torch.zeros = lambda shape, device=None: {"shape": list(shape), "device": device}

    fake_model_management = types.ModuleType("comfy.model_management")
    fake_model_management.intermediate_device = lambda: "test-device"
    fake_comfy = types.ModuleType("comfy")
    fake_comfy.__path__ = []
    fake_comfy.model_management = fake_model_management

    fake_io = SimpleNamespace(
        ComfyNode=FakeComfyNode,
        Schema=object,
        NodeOutput=FakeNodeOutput,
    )
    fake_latest = types.ModuleType("comfy_api.latest")
    fake_latest.io = fake_io
    fake_comfy_api = types.ModuleType("comfy_api")
    fake_comfy_api.__path__ = []
    fake_comfy_api.latest = fake_latest

    stubs = {
        "torch": fake_torch,
        "comfy": fake_comfy,
        "comfy.model_management": fake_model_management,
        "comfy_api": fake_comfy_api,
        "comfy_api.latest": fake_latest,
    }
    with patch.dict(sys.modules, stubs):
        sys.modules.pop("aztoolkit", None)
        return importlib.import_module("aztoolkit")


class ResolutionMasterTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.aztoolkit = load_aztoolkit_with_runtime_stubs()
        cls.node_class = cls.aztoolkit.ResolutionMaster

    def setUp(self):
        self.node_class.hidden = SimpleNamespace(unique_id="node-1", prompt={})

    def execute_kwargs(self, **overrides):
        values = {
            "mode": "Manual",
            "latent_type": "latent_4x8",
            "width": 1024,
            "height": 768,
            "auto_detect": False,
            "auto_detect_source": "backend",
            "auto_detect_width": 0,
            "auto_detect_height": 0,
            "auto_fit_on_change": False,
            "auto_resize_on_change": False,
            "auto_snap_on_change": False,
            "smart_fit": False,
            "use_custom_calc": False,
            "preserve_scaling_ratio": False,
            "selected_category": "",
            "snap_value": 64,
            "upscale_value": 1.0,
            "target_resolution": 1080,
            "target_megapixels": 2.0,
            "auto_detect_presets_json": "{}",
            "rescale_mode": "manual",
            "rescale_value": 1.0,
            "batch_size": 2,
            "input_image": None,
        }
        values.update(overrides)
        return values

    def test_detect_image_dimensions_supports_hwc_and_bhwc(self):
        self.assertEqual(self.node_class.detect_image_dimensions(FakeImage((600, 800, 3))), (800, 600))
        self.assertEqual(self.node_class.detect_image_dimensions(FakeImage((2, 600, 800, 3))), (800, 600))
        self.assertIsNone(self.node_class.detect_image_dimensions(FakeImage((800, 600))))

    def test_empty_local_image_gallery_selection_is_detected_from_prompt(self):
        self.node_class.hidden = SimpleNamespace(
            unique_id="node-1",
            prompt={
                "node-1": {"inputs": {"input_image": ["gallery", 0]}},
                "gallery": {
                    "class_type": "LocalImageGallery",
                    "inputs": {"selected_image": " none "},
                },
            },
        )

        self.assertTrue(
            self.node_class.is_empty_local_image_gallery_input(
                self.node_class.hidden.prompt,
                self.node_class.hidden.unique_id,
            )
        )

    def test_execute_creates_expected_latent_shapes(self):
        standard = self.node_class.execute(**self.execute_kwargs(width=1025, height=769))
        flux2 = self.node_class.execute(
            **self.execute_kwargs(latent_type="latent_128x16", batch_size=3)
        )

        self.assertEqual(standard.values[4]["samples"]["shape"], [2, 4, 96, 128])
        self.assertEqual(standard.values[4]["samples"]["device"], "test-device")
        self.assertEqual(flux2.values[4]["samples"]["shape"], [3, 128, 48, 64])

    def test_execute_applies_backend_fallback_to_new_tensor_dimensions(self):
        with (
            patch.object(self.aztoolkit, "store_detected_dimensions") as store,
            patch.object(
                self.aztoolkit,
                "apply_backend_auto_detect_fallback",
                return_value=(640, 640),
            ) as fallback,
        ):
            result = self.node_class.execute(
                **self.execute_kwargs(auto_detect=True, input_image=FakeImage((1, 600, 800, 3)))
            )

        store.assert_called_once_with("node-1", 800, 600)
        fallback.assert_called_once()
        self.assertEqual(result.values[:2], (640, 640))
        self.assertEqual(result.values[4]["samples"]["shape"], [2, 4, 80, 80])

    def test_execute_skips_duplicate_fallback_when_frontend_matches_tensor(self):
        with patch.object(self.aztoolkit, "apply_backend_auto_detect_fallback") as fallback:
            result = self.node_class.execute(
                **self.execute_kwargs(
                    auto_detect=True,
                    auto_detect_source="frontend",
                    auto_detect_width=800,
                    auto_detect_height=600,
                    width=800,
                    height=600,
                    input_image=FakeImage((1, 600, 800, 3)),
                )
            )

        fallback.assert_not_called()
        self.assertEqual(result.values[:2], (800, 600))

    def test_execute_skips_detection_when_frontend_source_is_explicitly_empty(self):
        with (
            patch.object(self.aztoolkit, "store_detected_dimensions") as store,
            patch.object(self.aztoolkit, "apply_backend_auto_detect_fallback") as fallback,
        ):
            result = self.node_class.execute(
                **self.execute_kwargs(
                    auto_detect=True,
                    auto_detect_source="frontend-empty",
                    width=512,
                    height=384,
                    input_image=FakeImage((1, 600, 800, 3)),
                )
            )

        store.assert_not_called()
        fallback.assert_not_called()
        self.assertEqual(result.values[:2], (512, 384))


if __name__ == "__main__":
    unittest.main()
