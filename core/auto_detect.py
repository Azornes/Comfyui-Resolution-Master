import json
import math

from .log_system import create_module_logger


log = create_module_logger(__name__)


ASPECT_RATIO_TOLERANCE = 0.01
CALCULATION_CONFIG_VERSION = 1
CALCULATION_CONFIG_VERSION_KEY = "__resolutionMasterConfigVersion"
CALCULATION_PROFILE_KEY = "__resolutionMasterProfile"
CALCULATION_PRESETS_KEY = "__resolutionMasterPresets"


LEGACY_MODEL_PROFILES = {
    "Standard": {"strategy": "closest_aspect"},
    "SDXL": {"strategy": "closest_preset"},
    "Flux": {
        "strategy": "flux_like",
        "options": {
            "max_megapixels": 4.0,
            "max_dimension": 2560,
            "min_dimension": 320,
            "multiple": 32,
        },
    },
    "Flux.2": {
        "strategy": "flux_like",
        "options": {
            "max_megapixels": 6.0,
            "max_dimension": 3840,
            "min_dimension": 320,
            "multiple": 16,
        },
    },
    "WAN": {
        "strategy": "wan_pixel_range",
        "options": {"min_pixels": 182080, "max_pixels": 1195560, "multiple": 16},
    },
    "HiDream Dev": {"strategy": "closest_preset"},
    "Qwen-Image": {
        "strategy": "pixel_range",
        "options": {"min_pixels": 589824, "max_pixels": 4194304},
    },
    "ZImageTurbo": {"strategy": "closest_preset"},
    "Krea 2 Turbo": {"strategy": "closest_preset"},
    "Krea 2 RAW": {"strategy": "closest_preset"},
    "Social Media": {"strategy": "closest_aspect"},
    "Print": {"strategy": "closest_aspect"},
    "Cinema": {"strategy": "closest_aspect"},
    "Display Resolutions": {"strategy": "closest_aspect"},
}


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


def load_calculation_config(presets_json):
    try:
        decoded = json.loads(presets_json or "{}")
        if not isinstance(decoded, dict):
            log.warning("Ignoring presets JSON because decoded value is not an object")
            return {}, {}

        if decoded.get(CALCULATION_CONFIG_VERSION_KEY) == CALCULATION_CONFIG_VERSION:
            presets = decoded.get(CALCULATION_PRESETS_KEY)
            profile = decoded.get(CALCULATION_PROFILE_KEY)
            if not isinstance(presets, dict):
                log.warning("Ignoring calculation presets because config value is not an object")
                presets = {}
            if not isinstance(profile, dict):
                profile = {}
            return presets, profile

        return decoded, {}
    except (TypeError, ValueError) as error:
        log.warning("Failed to parse presets JSON", error)
        return {}, {}


def load_presets(presets_json):
    presets, _profile = load_calculation_config(presets_json)
    return presets


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
    candidates = []

    for preset_name, preset in presets.items():
        if not isinstance(preset, dict) or preset.get("isHidden"):
            continue

        preset_width = safe_int(preset.get("width"))
        preset_height = safe_int(preset.get("height"))
        if preset_width <= 0 or preset_height <= 0:
            continue

        for orientation_width, orientation_height in ((preset_width, preset_height), (preset_height, preset_width)):
            preset_aspect = orientation_width / orientation_height
            preset_pixels = orientation_width * orientation_height
            aspect_diff = abs(input_aspect - preset_aspect)
            candidates.append(
                {
                    "name": preset_name,
                    "width": orientation_width,
                    "height": orientation_height,
                    "aspect_diff": aspect_diff,
                    "pixel_diff": abs(math.log(input_pixels / preset_pixels)),
                    "is_flipped": (orientation_width, orientation_height) != (preset_width, preset_height),
                }
            )

    if not candidates:
        return None

    minimum_aspect_diff = min(candidate["aspect_diff"] for candidate in candidates)
    aspect_matched_candidates = (
        candidate
        for candidate in candidates
        if candidate["aspect_diff"] <= minimum_aspect_diff + ASPECT_RATIO_TOLERANCE
    )
    closest = min(
        aspect_matched_candidates,
        key=lambda candidate: (
            candidate["pixel_diff"],
            candidate["aspect_diff"],
            candidate["is_flipped"],
        ),
    )
    return {"name": closest["name"], "width": closest["width"], "height": closest["height"]}


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


def _unchanged_dimensions(width, height):
    return {"width": width, "height": height}


def _apply_closest_preset_strategy(width, height, presets, _options):
    closest = find_closest_preset(width, height, presets)
    if not closest:
        return _unchanged_dimensions(width, height)
    return {"width": closest["width"], "height": closest["height"]}


def _apply_closest_aspect_strategy(width, height, presets, options):
    closest = find_closest_preset(width, height, presets)
    if not closest:
        return _unchanged_dimensions(width, height)

    preset_aspect = closest["width"] / closest["height"]
    current_aspect = width / height
    tolerance = max(0.0, safe_float(options.get("tolerance"), ASPECT_RATIO_TOLERANCE))
    if abs(current_aspect - preset_aspect) < tolerance:
        return _unchanged_dimensions(width, height)
    return scale_to_preset_aspect_ratio(width, height, preset_aspect)


def _apply_flux_like_strategy(width, height, _presets, options):
    min_dimension = max(1, safe_int(options.get("min_dimension"), 320))
    max_dimension = max(min_dimension, safe_int(options.get("max_dimension"), 2560))
    return apply_flux_like_calculation(
        width,
        height,
        max(0.001, safe_float(options.get("max_megapixels"), 4.0)),
        max_dimension,
        min_dimension,
        max(1, safe_int(options.get("multiple"), 32)),
    )


def _apply_wan_pixel_range_strategy(width, height, _presets, options):
    min_pixels = max(1, safe_int(options.get("min_pixels"), 182080))
    max_pixels = max(min_pixels, safe_int(options.get("max_pixels"), 1195560))
    multiple = max(1, safe_int(options.get("multiple"), 16))
    target_pixels = max(min_pixels, min(max_pixels, width * height))
    aspect = width / height
    target_height = math.sqrt(target_pixels / aspect)
    target_width = target_height * aspect
    return {
        "width": max(multiple, round(target_width / multiple) * multiple),
        "height": max(multiple, round(target_height / multiple) * multiple),
    }


def _apply_pixel_range_strategy(width, height, _presets, options):
    current_pixels = width * height
    min_pixels = max(1, safe_int(options.get("min_pixels"), 589824))
    max_pixels = max(min_pixels, safe_int(options.get("max_pixels"), 4194304))
    if min_pixels <= current_pixels <= max_pixels:
        return _unchanged_dimensions(width, height)
    target_pixels = min_pixels if current_pixels < min_pixels else max_pixels
    aspect = width / height
    target_height = math.sqrt(target_pixels / aspect)
    return {"width": round(target_height * aspect), "height": round(target_height)}


CALCULATION_STRATEGIES = {
    "closest_aspect": _apply_closest_aspect_strategy,
    "closest_preset": _apply_closest_preset_strategy,
    "flux_like": _apply_flux_like_strategy,
    "pixel_range": _apply_pixel_range_strategy,
    "wan_pixel_range": _apply_wan_pixel_range_strategy,
}


def apply_custom_calculation(width, height, category, presets, profile=None):
    resolved_profile = profile if isinstance(profile, dict) and profile.get("strategy") else None
    if resolved_profile is None:
        resolved_profile = LEGACY_MODEL_PROFILES.get(category)
    if not resolved_profile:
        return _unchanged_dimensions(width, height)

    strategy_name = resolved_profile.get("strategy")
    strategy = CALCULATION_STRATEGIES.get(strategy_name)
    if strategy is None:
        log.warning("Unknown calculation strategy", strategy_name, "for category", category)
        return _unchanged_dimensions(width, height)

    options = resolved_profile.get("options")
    if not isinstance(options, dict):
        options = {}
    return strategy(width, height, presets, options)


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
    scale = calculate_rescale_factor(width, height, rescale_mode, upscale_value, target_resolution, target_megapixels)
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
    presets, calculation_profile = load_calculation_config(presets_json)
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
            calculated = apply_custom_calculation(
                width,
                height,
                selected_category,
                presets,
                calculation_profile,
            )
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
            calculated = apply_custom_calculation(
                width,
                height,
                selected_category,
                presets,
                calculation_profile,
            )
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
