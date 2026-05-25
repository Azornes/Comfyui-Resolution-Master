try:
    from aiohttp import web
    from server import PromptServer
except Exception:
    web = None
    PromptServer = None

from .auto_detect import calculate_resolution, safe_float, safe_int
from .log_system import create_module_logger


log = create_module_logger()
_routes_registered = False


def _payload_bool(payload, key, default=False):
    value = payload.get(key, default)
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.lower() in ("1", "true", "yes", "on")
    return bool(value)


def _normalize_payload(payload):
    return {
        "action": payload.get("action", "rescale"),
        "width": safe_int(payload.get("width"), 512),
        "height": safe_int(payload.get("height"), 512),
        "auto_fit_on_change": _payload_bool(payload, "auto_fit_on_change"),
        "auto_resize_on_change": _payload_bool(payload, "auto_resize_on_change"),
        "auto_snap_on_change": _payload_bool(payload, "auto_snap_on_change"),
        "smart_fit": _payload_bool(payload, "smart_fit"),
        "use_custom_calc": _payload_bool(payload, "use_custom_calc"),
        "preserve_scaling_ratio": _payload_bool(payload, "preserve_scaling_ratio"),
        "selected_category": payload.get("selected_category") or "",
        "snap_value": safe_int(payload.get("snap_value"), 64),
        "upscale_value": safe_float(payload.get("upscale_value"), 1.0),
        "target_resolution": safe_int(payload.get("target_resolution"), 1080),
        "target_megapixels": safe_float(payload.get("target_megapixels"), 2.0),
        "rescale_mode": payload.get("rescale_mode") or "resolution",
        "presets_json": payload.get("presets_json") or "{}",
        "scale_value": safe_float(payload.get("scale_value"), 1.0),
    }


def register_calculation_routes():
    global _routes_registered
    if _routes_registered:
        log.debug("Calculation routes already registered")
        return
    if PromptServer is None or getattr(PromptServer, "instance", None) is None or web is None:
        log.warning("Calculation routes unavailable because PromptServer or aiohttp is missing")
        return

    @PromptServer.instance.routes.post("/resolutionmaster/calculate")
    async def calculate_resolutionmaster(request):
        try:
            payload = await request.json()
            if not isinstance(payload, dict):
                raise ValueError("Request body must be a JSON object.")

            normalized = _normalize_payload(payload)
            log.debug(
                "Calculation request",
                "action=",
                normalized["action"],
                "input=",
                f"{normalized['width']}x{normalized['height']}",
            )
            result = calculate_resolution(**normalized)
            log.debug("Calculation response", result)
            return web.json_response({"ok": True, **result})
        except ValueError as error:
            log.warning("Invalid calculation request", error)
            return web.json_response({"ok": False, "error": str(error)}, status=400)
        except Exception as error:
            log.exception("Unhandled calculation request error")
            return web.json_response({"ok": False, "error": str(error)}, status=500)

    _routes_registered = True
    log.info("Registered calculation route", "/resolutionmaster/calculate")
