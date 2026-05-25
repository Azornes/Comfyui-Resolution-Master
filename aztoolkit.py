# ComfyUI - azToolkit - Azornes 2025

import torch
import comfy.model_management

try:
    from .core.auto_detect import (
        apply_backend_auto_detect_fallback,
        calculate_rescale_factor,
        safe_float,
        safe_int,
    )
    from .core.calculation_api import register_calculation_routes
    from .core.dimension_cache import register_dimension_routes, store_detected_dimensions
    from .core.log_system import create_module_logger
except ImportError:
    from core.auto_detect import (
        apply_backend_auto_detect_fallback,
        calculate_rescale_factor,
        safe_float,
        safe_int,
    )
    from core.calculation_api import register_calculation_routes
    from core.dimension_cache import register_dimension_routes, store_detected_dimensions
    from core.log_system import create_module_logger


log = create_module_logger()


class ResolutionMaster:
    def __init__(self):
        self.device = comfy.model_management.intermediate_device()
        log.debug("Initialized node on device", self.device)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "mode": (
                    ["Manual", "Manual Sliders", "Common Resolutions", "Aspect Ratios"],
                    {"tooltip": "Choose how to control the output size. Manual mode uses the Resolution Master canvas."}
                ),
                "latent_type": (
                    ["latent_4x8", "latent_128x16"],
                    {"default": "latent_4x8", "tooltip": "Choose the latent type. Use 4x8 for most models, or 128x16 for Flux.2."}
                ),
                "width": ("INT", {"default": 512, "min": 0, "max": 32768, "step": 64, "tooltip": "Final output width in pixels."}),
                "height": ("INT", {"default": 512, "min": 0, "max": 32768, "step": 64, "tooltip": "Final output height in pixels."}),
                "auto_detect": ("BOOLEAN", {"default": False, "label_on": "Auto-detect from input", "label_off": "Manual", "tooltip": "Detect the size from the connected input image."}),
                "auto_detect_source": ("STRING", {"default": "backend", "tooltip": "Technical setting used by the Resolution Master interface."}),
                "auto_detect_width": ("INT", {"default": 0, "min": 0, "max": 32768, "tooltip": "Detected input width used by auto-detect."}),
                "auto_detect_height": ("INT", {"default": 0, "min": 0, "max": 32768, "tooltip": "Detected input height used by auto-detect."}),
                "auto_fit_on_change": ("BOOLEAN", {"default": False, "tooltip": "When a new image is detected, fit it to the closest preset automatically."}),
                "auto_resize_on_change": ("BOOLEAN", {"default": False, "tooltip": "When a new image is detected, resize it automatically using the selected scaling mode."}),
                "auto_snap_on_change": ("BOOLEAN", {"default": False, "tooltip": "When a new image is detected, round its size to the selected snap step."}),
                "smart_fit": ("BOOLEAN", {"default": False, "tooltip": "Fit to the closest preset aspect ratio while keeping the size close to the current resolution."}),
                "use_custom_calc": ("BOOLEAN", {"default": False, "tooltip": "When a new image is detected, apply the selected model or category size rules automatically."}),
                "preserve_scaling_ratio": ("BOOLEAN", {"default": False, "tooltip": "Keep the image proportions while scaling."}),
                "selected_category": ("STRING", {"default": "", "tooltip": "Selected preset category."}),
                "snap_value": ("INT", {"default": 64, "min": 1, "max": 32768, "tooltip": "Snap step used when rounding width and height."}),
                "upscale_value": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 100.0, "tooltip": "Manual scale multiplier."}),
                "target_resolution": ("INT", {"default": 1080, "min": 1, "max": 32768, "tooltip": "Target p-resolution used for scaling."}),
                "target_megapixels": ("FLOAT", {"default": 2.0, "min": 0.0, "max": 1000.0, "tooltip": "Target megapixels used for scaling."}),
                "auto_detect_presets_json": ("STRING", {"default": "{}", "tooltip": "Technical preset data used by auto-detect."}),
                "rescale_mode": ("STRING", {"default": "resolution", "tooltip": "Scaling mode used for the Rescale Factor output."}),
                "rescale_value": ("FLOAT", {"default": 1.0, "step": 0.001, "min": 0.0, "max": 100.0, "tooltip": "Current Rescale Factor value shown by the interface."}),
                "batch_size": ("INT", {"default": 1, "min": 1, "max": 4096, "tooltip": "How many latent images to create in one batch."}),
            },
            "optional": {
                "input_image": ("IMAGE", {"tooltip": "Optional image used for auto-detecting width and height."}),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "prompt": "PROMPT",
            },
        }

    RETURN_TYPES = ("INT", "INT", "FLOAT", "INT", "LATENT")
    RETURN_NAMES = ("width", "height", "rescale_factor", "batch_size", "latent")
    OUTPUT_TOOLTIPS = (
        "Final output width in pixels.",
        "Final output height in pixels.",
        "Scale factor calculated from the selected scaling mode.",
        "Number of latent images created in one batch.",
        "Empty latent created with the selected size, batch size, and latent type.",
    )
    DESCRIPTION = "Interactive resolution, scaling, preset, and latent-size helper with optional input-image auto-detection."
    FUNCTION = "main"
    CATEGORY = "utils/azToolkit"

    @staticmethod
    def detect_image_dimensions(input_image):
        if input_image.dim() == 4:  # [batch, height, width, channels]
            return int(input_image.shape[2]), int(input_image.shape[1])
        if input_image.dim() == 3:  # [height, width, channels]
            return int(input_image.shape[1]), int(input_image.shape[0])
        log.warning("Unsupported input image tensor dimensions", input_image.dim())
        return None

    @staticmethod
    def _is_empty_local_image_gallery_selection(value):
        return str(value or "").strip().lower() in ("", "none", "null", "undefined")

    @classmethod
    def is_empty_local_image_gallery_input(cls, prompt, unique_id):
        if not isinstance(prompt, dict) or unique_id is None:
            return False

        current_node = prompt.get(str(unique_id)) or prompt.get(unique_id)
        input_link = current_node.get("inputs", {}).get("input_image") if isinstance(current_node, dict) else None
        if not isinstance(input_link, (list, tuple)) or not input_link:
            return False

        source_node_id = str(input_link[0])
        source_node = prompt.get(source_node_id) or prompt.get(input_link[0])
        if not isinstance(source_node, dict) or source_node.get("class_type") != "LocalImageGallery":
            return False

        selected_image = source_node.get("inputs", {}).get("selected_image", "")
        return cls._is_empty_local_image_gallery_selection(selected_image)

    def main(
        self,
        mode,
        latent_type,
        width,
        height,
        auto_detect,
        auto_detect_source,
        auto_detect_width,
        auto_detect_height,
        auto_fit_on_change,
        auto_resize_on_change,
        auto_snap_on_change,
        smart_fit,
        use_custom_calc,
        preserve_scaling_ratio,
        selected_category,
        snap_value,
        upscale_value,
        target_resolution,
        target_megapixels,
        auto_detect_presets_json,
        rescale_mode,
        rescale_value,
        batch_size=1,
        input_image=None,
        unique_id=None,
        prompt=None,
    ):
        log.debug(
            "Executing",
            "mode=",
            mode,
            "latent_type=",
            latent_type,
            "width=",
            width,
            "height=",
            height,
            "auto_detect=",
            auto_detect,
        )

        frontend_source_empty = auto_detect_source == "frontend-empty"
        local_image_gallery_empty = self.is_empty_local_image_gallery_input(prompt, unique_id)

        if auto_detect and (frontend_source_empty or local_image_gallery_empty):
            log.debug(
                "Skipping backend auto-detect fallback because frontend source has no active selection",
                "frontend_source_empty=",
                frontend_source_empty,
                "local_image_gallery_empty=",
                local_image_gallery_empty,
            )
        elif auto_detect and input_image is not None:
            detected_dimensions = self.detect_image_dimensions(input_image)
            if detected_dimensions is not None:
                detected_width, detected_height = detected_dimensions
                store_detected_dimensions(unique_id, detected_width, detected_height)
                log.debug(
                    "Detected input dimensions",
                    detected_width,
                    "x",
                    detected_height,
                    "unique_id=",
                    unique_id,
                )

                frontend_matches_tensor = (
                    auto_detect_source == "frontend"
                    and safe_int(auto_detect_width) == detected_width
                    and safe_int(auto_detect_height) == detected_height
                )

                if not frontend_matches_tensor:
                    previous_width, previous_height = width, height
                    width, height = apply_backend_auto_detect_fallback(
                        detected_width,
                        detected_height,
                        auto_fit_on_change,
                        auto_resize_on_change,
                        auto_snap_on_change,
                        smart_fit,
                        use_custom_calc,
                        preserve_scaling_ratio,
                        selected_category,
                        safe_int(snap_value, 64),
                        safe_float(upscale_value, 1.0),
                        safe_int(target_resolution, 1080),
                        safe_float(target_megapixels, 2.0),
                        rescale_mode,
                        auto_detect_presets_json,
                    )
                    log.info(
                        "Applied backend auto-detect fallback",
                        f"{previous_width}x{previous_height}",
                        "->",
                        f"{width}x{height}",
                    )

        rescale_factor = calculate_rescale_factor(
            width,
            height,
            rescale_mode,
            safe_float(upscale_value, 1.0),
            safe_int(target_resolution, 1080),
            safe_float(target_megapixels, 2.0),
        )

        if latent_type == "latent_128x16":
            latent = torch.zeros([batch_size, 128, height // 16, width // 16], device=self.device)
        else:
            latent = torch.zeros([batch_size, 4, height // 8, width // 8], device=self.device)

        log.debug(
            "Returning result",
            "width=",
            width,
            "height=",
            height,
            "rescale_factor=",
            rescale_factor,
            "batch_size=",
            batch_size,
        )
        return (width, height, rescale_factor, batch_size, {"samples": latent})


register_dimension_routes()
register_calculation_routes()
