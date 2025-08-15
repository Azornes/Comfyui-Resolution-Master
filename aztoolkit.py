# ComfyUI - azToolkit - Azornes 2025

import math


class AnyType(str):
    __slots__ = ()

    def __ne__(self, __value: object) -> bool:
        return False


any_type = AnyType("*")


class ResolutionMaster:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "mode": (
                    ["Manual", "Manual Sliders", "Common Resolutions", "Aspect Ratios"],
                ),
                "width": ("INT", {"default": 512, "min": 64, "max": 4096, "step": 64}),
                "height": ("INT", {"default": 512, "min": 64, "max": 4096, "step": 64}),
            },
            "hidden": {
                "rescale_mode": "STRING",
                "rescale_value": "FLOAT",
            },
        }

    RETURN_TYPES = ("INT", "INT", "FLOAT")
    RETURN_NAMES = ("width", "height", "rescale_factor")
    FUNCTION = "main"
    CATEGORY = "utils/azToolkit"

    def main(self, mode, width, height, rescale_mode="resolution", rescale_value=None):
        # If rescale_value is provided from frontend, use it
        if rescale_value is not None:
            rescale_factor = rescale_value
        else:
            # Default calculation based on 1080p target resolution
            target_resolution = 1080
            target_pixels = (target_resolution * (16.0 / 9.0)) * target_resolution
            current_pixels = width * height
            rescale_factor = math.sqrt(target_pixels / current_pixels)

        # In the future, different modes can process width/height differently
        # For now, just pass through the values with rescale factor
        return (width, height, rescale_factor)
