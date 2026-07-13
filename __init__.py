from comfy_api.latest import ComfyExtension, io

from .aztoolkit import ResolutionMaster


class ResolutionMasterExtension(ComfyExtension):
    async def get_node_list(self) -> list[type[io.ComfyNode]]:
        return [ResolutionMaster]


async def comfy_entrypoint() -> ResolutionMasterExtension:
    return ResolutionMasterExtension()

WEB_DIRECTORY = "./js"

__all__ = ["WEB_DIRECTORY", "comfy_entrypoint"]
