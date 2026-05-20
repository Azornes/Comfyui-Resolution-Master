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
                    {"tooltip": "Frontend control mode for choosing the output resolution. Resolution Master currently uses Manual mode for the custom 2D canvas interface."}
                ),
                "latent_type": (
                    ["latent_4x8", "latent_128x16"],
                    {"default": "latent_4x8", "tooltip": "Latent tensor format to create: latent_4x8 for SD/SDXL/Flux-style latents, or latent_128x16 for Flux.2-style latents."}
                ),
                "width": ("INT", {"default": 512, "min": 0, "max": 32768, "step": 64, "tooltip": "Output width in pixels. This value is controlled by the Resolution Master canvas and preset tools."}),
                "height": ("INT", {"default": 512, "min": 0, "max": 32768, "step": 64, "tooltip": "Output height in pixels. This value is controlled by the Resolution Master canvas and preset tools."}),
                "auto_detect": ("BOOLEAN", {"default": False, "label_on": "Auto-detect from input", "label_off": "Manual", "tooltip": "When enabled, reads the connected input image dimensions for auto-detect and auto-fit workflows."}),
                "auto_detect_source": ("STRING", {"default": "backend", "tooltip": "Internal auto-detect source marker used to distinguish backend tensor fallback from frontend preview-derived dimensions."}),
                "auto_detect_width": ("INT", {"default": 0, "min": 0, "max": 32768, "tooltip": "Internal raw width detected by the frontend before auto-fit or resize transforms."}),
                "auto_detect_height": ("INT", {"default": 0, "min": 0, "max": 32768, "tooltip": "Internal raw height detected by the frontend before auto-fit or resize transforms."}),
                "auto_fit_on_change": ("BOOLEAN", {"default": False, "tooltip": "Internal backend fallback mirror of Auto-Fit on change."}),
                "auto_resize_on_change": ("BOOLEAN", {"default": False, "tooltip": "Internal backend fallback mirror of Auto-Resize on change."}),
                "auto_snap_on_change": ("BOOLEAN", {"default": False, "tooltip": "Internal backend fallback mirror of Auto-Snap on change."}),
                "use_custom_calc": ("BOOLEAN", {"default": False, "tooltip": "Internal backend fallback mirror of Calc mode."}),
                "preserve_scaling_ratio": ("BOOLEAN", {"default": False, "tooltip": "Internal backend fallback mirror of preserve-ratio scaling."}),
                "selected_category": ("STRING", {"default": "", "tooltip": "Internal backend fallback mirror of the selected preset category."}),
                "snap_value": ("INT", {"default": 64, "min": 1, "max": 32768, "tooltip": "Internal backend fallback mirror of the snap value."}),
                "upscale_value": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 100.0, "tooltip": "Internal backend fallback mirror of the manual upscale value."}),
                "target_resolution": ("INT", {"default": 1080, "min": 1, "max": 32768, "tooltip": "Internal backend fallback mirror of target p-resolution."}),
                "target_megapixels": ("FLOAT", {"default": 2.0, "min": 0.0, "max": 1000.0, "tooltip": "Internal backend fallback mirror of target megapixels."}),
                "auto_detect_presets_json": ("STRING", {"default": "{}", "tooltip": "Internal backend fallback preset data for the selected category."}),
                "rescale_mode": ("STRING", {"default": "resolution", "tooltip": "Frontend-selected scaling intent used for the rescale_factor output: manual, resolution, or megapixels."}),
                "rescale_value": ("FLOAT", {"default": 1.0, "step": 0.001, "min": 0.0, "max": 100.0, "tooltip": "Internal UI cache for the visible scale factor. The backend recalculates the rescale_factor output from the current settings."}),
                "batch_size": ("INT", {"default": 1, "min": 1, "max": 4096, "tooltip": "The number of latent images in the batch."}),
            },
            "optional": {
                "input_image": ("IMAGE", {"tooltip": "Optional image used for auto-detecting source width and height when auto_detect is enabled."}),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ("INT", "INT", "FLOAT", "INT", "LATENT")
    RETURN_NAMES = ("width", "height", "rescale_factor", "batch_size", "latent")
    OUTPUT_TOOLTIPS = (
        "Final output width in pixels.",
        "Final output height in pixels.",
        "Scale factor needed to reach the selected scaling target.",
        "Batch size forwarded from the node input.",
        "Empty latent tensor created at the selected resolution, batch size, and latent type.",
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

        if auto_detect and input_image is not None:
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
