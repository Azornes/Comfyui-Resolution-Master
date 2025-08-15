WEB_DIRECTORY = "./js"

from .aztoolkit import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS
__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS', 'WEB_DIRECTORY']

if "ResolutionMaster" not in NODE_CLASS_MAPPINGS:
    from .aztoolkit import ResolutionMaster
    NODE_CLASS_MAPPINGS["ResolutionMaster"] = ResolutionMaster
    NODE_DISPLAY_NAME_MAPPINGS["ResolutionMaster"] = "Resolution Master"
