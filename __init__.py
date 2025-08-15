from .aztoolkit import ResolutionMaster


NODE_CLASS_MAPPINGS = {
    "ResolutionMaster": ResolutionMaster
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ResolutionMaster": "Resolution Master"
}

WEB_DIRECTORY = "./js"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
