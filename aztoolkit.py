# ComfyUI - azToolkit - Azornes 2025

import time
import torch
import comfy.model_management


class AnyType(str):
    __slots__ = ()

    def __ne__(self, __value: object) -> bool:
        return False


any_type = AnyType("*")


class ResolutionMaster:
    # Class variable to store image dimensions for auto-detection
    _image_dimensions_cache = {}
    
    def __init__(self):
        self.device = comfy.model_management.intermediate_device()
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "mode": (
                    ["Manual", "Manual Sliders", "Common Resolutions", "Aspect Ratios"],
                ),
                "latent_type": (
                    ["latent_4x8", "latent_128x16"],
                    {"default": "latent_4x8"}
                ),
                "width": ("INT", {"default": 512, "min": 0, "max": 32768, "step": 64}),
                "height": ("INT", {"default": 512, "min": 0, "max": 32768, "step": 64}),
                "auto_detect": ("BOOLEAN", {"default": False, "label_on": "Auto-detect from input", "label_off": "Manual"}),
                "rescale_mode": ("STRING", {"default": "resolution"}),
                "rescale_value": ("FLOAT", {"default": 1.0, "step": 0.001, "min": 0.0, "max": 100.0}),
                "batch_size": ("INT", {"default": 1, "min": 1, "max": 4096, "tooltip": "The number of latent images in the batch."}),
            },
            "optional": {
                "input_image": ("IMAGE",),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ("INT", "INT", "FLOAT", "INT", "LATENT")
    RETURN_NAMES = ("width", "height", "rescale_factor", "batch_size", "latent")
    FUNCTION = "main"
    CATEGORY = "utils/azToolkit"

    def main(self, mode, latent_type, width, height, auto_detect, rescale_mode, rescale_value, batch_size=1, input_image=None, unique_id=None):
        detected_width = width
        detected_height = height

        # If auto_detect is enabled and we have an input image
        if auto_detect and input_image is not None:
            try:
                # Detect dimensions from image tensor
                if input_image.dim() == 4:  # [batch, height, width, channels]
                    detected_height = int(input_image.shape[1])
                    detected_width = int(input_image.shape[2])
                elif input_image.dim() == 3:  # [height, width, channels]
                    detected_height = int(input_image.shape[0])
                    detected_width = int(input_image.shape[1])

                # Store dimensions in cache for frontend access
                if unique_id:
                    ResolutionMaster._image_dimensions_cache[str(unique_id)] = {
                        'width': detected_width,
                        'height': detected_height,
                        'timestamp': time.time()
                    }

                # Only override with detected dimensions if the widget values match the detected values
                # This allows manually set values (like from auto-fit) to take precedence
                if width == detected_width and height == detected_height:
                    # Widget values match detected values, use detected dimensions
                    width = detected_width
                    height = detected_height
                    print(f"[ResolutionMaster] Using auto-detected dimensions: {width}x{height}")
                else:
                    # Widget values differ from detected values, use widget values (manually set)
                    print(f"[ResolutionMaster] Using manual dimensions: {width}x{height} (detected: {detected_width}x{detected_height})")

            except Exception as e:
                print(f"[ResolutionMaster] Error detecting dimensions: {str(e)}")
                # Fall back to manual dimensions

        # The rescale_factor is calculated on the frontend and passed here
        rescale_factor = rescale_value

        # Generate latent tensor based on selected latent type
        if latent_type == "latent_128x16":
            # Flux 2 uses 128 channels and divides by 16
            latent = torch.zeros([batch_size, 128, height // 16, width // 16], device=self.device)
        else:
            # SD1.5/SDXL uses 4 channels and divides by 8
            latent = torch.zeros([batch_size, 4, height // 8, width // 8], device=self.device)

        return (width, height, rescale_factor, batch_size, {"samples": latent})
