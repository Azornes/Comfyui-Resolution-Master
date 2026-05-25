import json
import math

from .log_system import create_module_logger


log = create_module_logger()


def safe_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def safe_float(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def load_presets(presets_json):
    try:
        presets = json.loads(presets_json or "{}")
        if isinstance(presets, dict):
            return presets
        log.warning("Ignoring presets JSON because decoded value is not an object")
        return {}
    except (TypeError, ValueError) as error:
        log.warning("Failed to parse presets JSON", error)
        return {}


def choose_best_scaling_option(current_pixels, option1, option2):
    option1_pixels = option1["width"] * option1["height"]
    option2_pixels = option2["width"] * option2["height"]
    return option1 if abs(option1_pixels - current_pixels) <= abs(option2_pixels - current_pixels) else option2


def scale_to_preset_aspect_ratio(width, height, preset_aspect):
    current_pixels = width * height
    option1 = {"width": width, "height": round(width / preset_aspect)}
    option2 = {"width": round(height * preset_aspect), "height": height}
    return choose_best_scaling_option(current_pixels, option1, option2)


def scale_to_exact_preset_ratio(width, height, preset_width, preset_height):
    divisor = math.gcd(max(1, preset_width), max(1, preset_height))
    ratio_width = preset_width // divisor
    ratio_height = preset_height // divisor
    current_pixels = width * height
    ratio_pixels = ratio_width * ratio_height
    ratio_scale = max(1, round(math.sqrt(current_pixels / ratio_pixels)))
    return {"width": ratio_width * ratio_scale, "height": ratio_height * ratio_scale}


def find_closest_preset(width, height, presets):
    if not presets:
        return None

    input_aspect = width / height
    input_pixels = width * height
    closest = None
    closest_aspect_diff = math.inf
    closest_pixel_diff = math.inf

    for preset_name, preset in presets.items():
        preset_width = safe_int(preset.get("width") if isinstance(preset, dict) else None)
        preset_height = safe_int(preset.get("height") if isinstance(preset, dict) else None)
        if preset_width <= 0 or preset_height <= 0:
            continue

        for orientation_width, orientation_height in ((preset_width, preset_height), (preset_height, preset_width)):
            preset_aspect = orientation_width / orientation_height
            preset_pixels = orientation_width * orientation_height
            aspect_diff = abs(input_aspect - preset_aspect)
            if aspect_diff < 0.01 or aspect_diff < closest_aspect_diff:
                pixel_diff = abs(math.log(input_pixels / preset_pixels))
                if aspect_diff < closest_aspect_diff or (
                    abs(aspect_diff - closest_aspect_diff) < 0.01 and pixel_diff < closest_pixel_diff
                ):
                    closest_aspect_diff = aspect_diff
                    closest_pixel_diff = pixel_diff
                    closest = {"name": preset_name, "width": orientation_width, "height": orientation_height}

    return closest


def apply_flux_like_calculation(width, height, max_mp, max_dim, min_dim, multiple):
    current_mp = (width * height) / 1000000
    w = float(width)
    h = float(height)
    if current_mp > max_mp:
        scale = math.sqrt(max_mp / current_mp)
        w *= scale
        h *= scale

    max_d = max(w, h)
    if max_d > max_dim:
        scale = max_dim / max_d
        w *= scale
        h *= scale

    min_d = min(w, h)
    if min_d < min_dim:
        scale = min_dim / min_d
        w *= scale
        h *= scale

    return {
        "width": max(min_dim, min(max_dim, round(w / multiple) * multiple)),
        "height": max(min_dim, min(max_dim, round(h / multiple) * multiple)),
    }


def apply_custom_calculation(width, height, category, presets):
    if category == "Flux":
        return apply_flux_like_calculation(width, height, 4.0, 2560, 320, 32)
    if category == "Flux.2":
        return apply_flux_like_calculation(width, height, 6.0, 3840, 320, 16)
    if category == "WAN":
        target_pixels = max(182080, min(1195560, width * height))
        aspect = width / height
        target_height = math.sqrt(target_pixels / aspect)
        target_width = target_height * aspect
        return {
            "width": round(target_width / 16) * 16,
            "height": round(target_height / 16) * 16,
        }
    if category == "Qwen-Image":
        current_pixels = width * height
        min_pixels = 589824
        max_pixels = 4194304
        if min_pixels <= current_pixels <= max_pixels:
            return {"width": width, "height": height}
        target_pixels = min_pixels if current_pixels < min_pixels else max_pixels
        aspect = width / height
        target_height = math.sqrt(target_pixels / aspect)
        return {"width": round(target_height * aspect), "height": round(target_height)}

    if category in ("SDXL", "HiDream Dev"):
        closest = find_closest_preset(width, height, presets)
        if not closest:
            return {"width": width, "height": height}
        return {"width": closest["width"], "height": closest["height"]}

    if category not in ("Standard", "Social Media", "Print", "Cinema", "Display Resolutions"):
        return {"width": width, "height": height}

    closest = find_closest_preset(width, height, presets)
    if not closest:
        return {"width": width, "height": height}

    preset_aspect = closest["width"] / closest["height"]
    current_aspect = width / height
    if abs(current_aspect - preset_aspect) < 0.01:
        return {"width": width, "height": height}
    return scale_to_preset_aspect_ratio(width, height, preset_aspect)


def calculate_auto_fit(width, height, category, smart_fit, presets, preserve_scaling_ratio=False):
    closest = find_closest_preset(width, height, presets)
    if not closest:
        return {"width": width, "height": height, "selected_preset": None}

    if not smart_fit:
        return {"width": closest["width"], "height": closest["height"], "selected_preset": closest["name"]}

    if preserve_scaling_ratio:
        scaled = scale_to_exact_preset_ratio(width, height, closest["width"], closest["height"])
        return {"width": scaled["width"], "height": scaled["height"], "selected_preset": closest["name"]}

    preset_aspect = closest["width"] / closest["height"]
    current_aspect = width / height
    if abs(current_aspect - preset_aspect) < 0.01:
        return {"width": width, "height": height, "selected_preset": closest["name"]}

    scaled = scale_to_preset_aspect_ratio(width, height, preset_aspect)
    return {"width": scaled["width"], "height": scaled["height"], "selected_preset": closest["name"]}


def calculate_scaled_dimensions(width, height, scale, preserve_ratio):
    if not preserve_ratio:
        return {"width": round(width * scale), "height": round(height * scale)}

    divisor = math.gcd(max(1, width), max(1, height))
    ratio_x = width // divisor
    ratio_y = height // divisor
    target_pixels = width * height * scale * scale
    ratio_pixels = ratio_x * ratio_y
    ratio_scale = max(1, round(math.sqrt(target_pixels / ratio_pixels)))
    return {"width": ratio_x * ratio_scale, "height": ratio_y * ratio_scale}


def apply_auto_resize(width, height, rescale_mode, upscale_value, target_resolution, target_megapixels, preserve_ratio):
    current_pixels = max(1, width * height)
    if rescale_mode == "manual":
        scale = max(0.0, upscale_value)
    elif rescale_mode == "megapixels":
        scale = math.sqrt(max(0.0, target_megapixels) * 1000000 / current_pixels)
    else:
        target_pixels = (target_resolution * (16 / 9)) * target_resolution
        scale = math.sqrt(target_pixels / current_pixels)
    return calculate_scaled_dimensions(width, height, scale, preserve_ratio)


def calculate_rescale_factor(width, height, rescale_mode, upscale_value, target_resolution, target_megapixels):
    current_pixels = max(1, width * height)
    if rescale_mode == "manual":
        return max(0.0, upscale_value)
    if rescale_mode == "megapixels":
        return math.sqrt(max(0.0, target_megapixels) * 1000000 / current_pixels)

    target_pixels = (target_resolution * (16 / 9)) * target_resolution
    return math.sqrt(target_pixels / current_pixels)


def apply_auto_snap(width, height, snap_value):
    snap = max(1, snap_value)
    return {
        "width": max(snap, round(width / snap) * snap),
        "height": max(snap, round(height / snap) * snap),
    }


def apply_backend_auto_detect_fallback(
    width,
    height,
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
    rescale_mode,
    auto_detect_presets_json,
):
    log.debug(
        "Applying backend auto-detect fallback",
        f"{width}x{height}",
        "category=",
        selected_category,
        "rescale_mode=",
        rescale_mode,
    )
    result = calculate_resolution(
        "auto_detect",
        width,
        height,
        auto_fit_on_change=auto_fit_on_change,
        auto_resize_on_change=auto_resize_on_change,
        auto_snap_on_change=auto_snap_on_change,
        smart_fit=smart_fit,
        use_custom_calc=use_custom_calc,
        preserve_scaling_ratio=preserve_scaling_ratio,
        selected_category=selected_category,
        snap_value=snap_value,
        upscale_value=upscale_value,
        target_resolution=target_resolution,
        target_megapixels=target_megapixels,
        rescale_mode=rescale_mode,
        presets_json=auto_detect_presets_json,
    )
    log.debug("Backend auto-detect fallback result", result)
    return result["width"], result["height"]


def calculate_target_resolution_from_scale(width, height, scale_value):
    target_pixels = max(1, width * height) * max(0.0, scale_value) * max(0.0, scale_value)
    return max(1, round(math.sqrt(target_pixels / (16 / 9))))


def calculate_resolution(
    action,
    width,
    height,
    auto_fit_on_change=False,
    auto_resize_on_change=False,
    auto_snap_on_change=False,
    smart_fit=False,
    use_custom_calc=False,
    preserve_scaling_ratio=False,
    selected_category="",
    snap_value=64,
    upscale_value=1.0,
    target_resolution=1080,
    target_megapixels=2.0,
    rescale_mode="resolution",
    presets_json="{}",
    scale_value=1.0,
):
    width = max(1, safe_int(width, 1))
    height = max(1, safe_int(height, 1))
    snap_value = max(1, safe_int(snap_value, 64))
    upscale_value = max(0.0, safe_float(upscale_value, 1.0))
    target_resolution = max(1, safe_int(target_resolution, 1080))
    target_megapixels = max(0.0, safe_float(target_megapixels, 2.0))
    selected_category = selected_category or ""
    presets = load_presets(presets_json)
    selected_preset = None

    log.debug(
        "Calculating resolution",
        "action=",
        action,
        "input=",
        f"{width}x{height}",
        "category=",
        selected_category,
    )

    if action == "auto_fit":
        if selected_category:
            fitted = calculate_auto_fit(width, height, selected_category, smart_fit, presets, preserve_scaling_ratio)
            width, height = fitted["width"], fitted["height"]
            selected_preset = fitted.get("selected_preset")

    elif action == "auto_resize":
        resized = apply_auto_resize(
            width,
            height,
            rescale_mode,
            upscale_value,
            target_resolution,
            target_megapixels,
            preserve_scaling_ratio,
        )
        width, height = resized["width"], resized["height"]

    elif action == "auto_snap":
        snapped = apply_auto_snap(width, height, snap_value)
        width, height = snapped["width"], snapped["height"]

    elif action == "custom_calc":
        if selected_category:
            calculated = apply_custom_calculation(width, height, selected_category, presets)
            width, height = calculated["width"], calculated["height"]

    elif action == "auto_detect":
        if auto_fit_on_change and selected_category:
            fitted = calculate_auto_fit(width, height, selected_category, smart_fit, presets, preserve_scaling_ratio)
            width, height = fitted["width"], fitted["height"]
            selected_preset = fitted.get("selected_preset")

        if auto_resize_on_change:
            resized = apply_auto_resize(
                width,
                height,
                rescale_mode,
                upscale_value,
                target_resolution,
                target_megapixels,
                preserve_scaling_ratio,
            )
            width, height = resized["width"], resized["height"]

        if auto_snap_on_change:
            snapped = apply_auto_snap(width, height, snap_value)
            width, height = snapped["width"], snapped["height"]

        if use_custom_calc and selected_category:
            calculated = apply_custom_calculation(width, height, selected_category, presets)
            width, height = calculated["width"], calculated["height"]

    elif action in ("rescale", "target_resolution_from_scale"):
        pass

    else:
        log.warning("Unsupported calculation action", action)
        raise ValueError(f"Unsupported calculation action: {action}")

    width = max(1, int(width))
    height = max(1, int(height))
    rescale_factor = calculate_rescale_factor(
        width,
        height,
        rescale_mode,
        upscale_value,
        target_resolution,
        target_megapixels,
    )

    result = {
        "width": width,
        "height": height,
        "rescale_factor": float(rescale_factor),
    }
    if selected_preset is not None:
        result["selected_preset"] = selected_preset
    if action == "target_resolution_from_scale":
        result["target_resolution"] = calculate_target_resolution_from_scale(
            width,
            height,
            safe_float(scale_value, 1.0),
        )
    log.debug("Calculation result", result)
    return result
