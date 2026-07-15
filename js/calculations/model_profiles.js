export const CALCULATION_CONFIG_VERSION = 1;

export const CALCULATION_CONFIG_KEYS = Object.freeze({
    version: "__resolutionMasterConfigVersion",
    profile: "__resolutionMasterProfile",
    presets: "__resolutionMasterPresets"
});

export const SUPPORTED_CALCULATION_STRATEGIES = Object.freeze([
    "closest_aspect",
    "closest_preset",
    "flux_like",
    "pixel_range",
    "wan_pixel_range"
]);

const closestAspectProfile = Object.freeze({
    strategy: "closest_aspect",
    infoMessage: "💡 Calc Mode: Uses the closest preset aspect ratio while keeping the size close to your current resolution."
});

const kreaProfile = Object.freeze({
    strategy: "closest_preset",
    infoMessage: "💡 Krea 2 Mode: Uses the closest Krea 2 preset size (multiples of 16)."
});

export const modelProfiles = Object.freeze({
    "Standard": closestAspectProfile,
    "SDXL": Object.freeze({
        strategy: "closest_preset",
        infoMessage: "💡 SDXL Mode: Uses the closest SDXL preset size."
    }),
    "Flux": Object.freeze({
        strategy: "flux_like",
        options: Object.freeze({
            max_megapixels: 4.0,
            max_dimension: 2560,
            min_dimension: 320,
            multiple: 32
        }),
        infoMessage: "💡 FLUX Mode: Round to: 32px | Edge range: 320-2560px | Max resolution: 4.0 MP"
    }),
    "Flux.2": Object.freeze({
        strategy: "flux_like",
        options: Object.freeze({
            max_megapixels: 6.0,
            max_dimension: 3840,
            min_dimension: 320,
            multiple: 16
        }),
        infoMessage: "💡 FLUX.2 Mode: Round to: 16px | Edge range: 320-3840px | Max resolution: 6.0 MP"
    }),
    "WAN": Object.freeze({
        strategy: "wan_pixel_range",
        options: Object.freeze({
            min_pixels: 182080,
            max_pixels: 1195560,
            multiple: 16
        }),
        infoMessage({ width, height }) {
            const numericWidth = Number(width);
            const numericHeight = Number(height);
            if (!Number.isFinite(numericWidth) || !Number.isFinite(numericHeight)) return null;
            const model = numericWidth * numericHeight < 600000 ? "480p" : "720p";
            return `💡 WAN Mode: Suggesting ${model} model | Round to: 16px | Resolution range: 320p-820p`;
        }
    }),
    "HiDream Dev": Object.freeze({
        strategy: "closest_preset",
        infoMessage: "💡 HiDream Dev: Uses the closest HiDream Dev preset size."
    }),
    "Qwen-Image": Object.freeze({
        strategy: "pixel_range",
        options: Object.freeze({
            min_pixels: 589824,
            max_pixels: 4194304
        }),
        infoMessage: "💡 Qwen-Image: Resolution range: ~0.6MP-4.2MP. If input is already in this range, it remains unchanged."
    }),
    "ZImageTurbo": Object.freeze({
        strategy: "closest_preset",
        infoMessage: "💡 ZImageTurbo Mode: Uses the closest active preset size while preserving orientation. Built-in presets use official resolutions."
    }),
    "Krea 2 Turbo": kreaProfile,
    "Krea 2 RAW": kreaProfile,
    "Social Media": closestAspectProfile,
    "Print": closestAspectProfile,
    "Cinema": closestAspectProfile,
    "Display Resolutions": closestAspectProfile
});

export function getModelProfile(category) {
    return modelProfiles[category] || null;
}

export function getSerializableModelProfile(category) {
    const profile = getModelProfile(category);
    if (!profile) return null;
    return {
        strategy: profile.strategy,
        options: { ...(profile.options || {}) }
    };
}

export function createCalculationConfig(category, presets) {
    return {
        [CALCULATION_CONFIG_KEYS.version]: CALCULATION_CONFIG_VERSION,
        [CALCULATION_CONFIG_KEYS.profile]: getSerializableModelProfile(category),
        [CALCULATION_CONFIG_KEYS.presets]: presets
    };
}

export function getModelInfoMessage(category, dimensions = {}) {
    const message = getModelProfile(category)?.infoMessage;
    return typeof message === "function" ? message(dimensions) : (message || null);
}
