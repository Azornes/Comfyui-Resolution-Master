import time

try:
    from aiohttp import web
    from server import PromptServer
except Exception:
    web = None
    PromptServer = None


_image_dimensions_cache = {}
_routes_registered = False


def store_detected_dimensions(node_id, width, height):
    if node_id is None:
        return

    _image_dimensions_cache[str(node_id)] = {
        "width": int(width),
        "height": int(height),
        "timestamp": time.time(),
    }


def get_detected_dimensions(node_id):
    return _image_dimensions_cache.get(str(node_id))


def register_dimension_routes():
    global _routes_registered
    if _routes_registered:
        return
    if PromptServer is None or getattr(PromptServer, "instance", None) is None or web is None:
        return

    @PromptServer.instance.routes.get("/resolutionmaster/dimensions/{node_id}")
    async def get_resolutionmaster_dimensions(request):
        node_id = request.match_info.get("node_id")
        dimensions = get_detected_dimensions(node_id)
        if dimensions is None:
            return web.json_response({"found": False})

        return web.json_response({
            "found": True,
            "width": dimensions["width"],
            "height": dimensions["height"],
            "timestamp": dimensions["timestamp"],
        })

    _routes_registered = True

