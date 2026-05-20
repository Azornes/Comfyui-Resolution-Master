import { gcd } from "../canvas/aspect_ratio_math.js";

export function calculateScaleFactor(width, height, props, mode = props.rescaleMode) {
    const safeWidth = Math.max(1, Number(width) || 1);
    const safeHeight = Math.max(1, Number(height) || 1);
    const currentPixels = Math.max(1, safeWidth * safeHeight);

    if (mode === 'manual') {
        return Math.max(0, Number(props.upscaleValue) || 0);
    }
    if (mode === 'megapixels') {
        return Math.sqrt(Math.max(0, Number(props.targetMegapixels) || 0) * 1000000 / currentPixels);
    }

    const targetResolution = Math.max(1, Number(props.targetResolution) || 1080);
    const targetPixels = (targetResolution * (16 / 9)) * targetResolution;
    return Math.sqrt(targetPixels / currentPixels);
}

export function calculateScaledDimensions(width, height, scale, preserveRatio) {
    const safeWidth = Math.max(1, Math.round(Number(width) || 1));
    const safeHeight = Math.max(1, Math.round(Number(height) || 1));

    if (!preserveRatio) {
        return {
            width: Math.max(1, Math.round(safeWidth * scale)),
            height: Math.max(1, Math.round(safeHeight * scale))
        };
    }

    const divisor = gcd(safeWidth, safeHeight);
    const ratioX = safeWidth / divisor;
    const ratioY = safeHeight / divisor;
    const targetPixels = safeWidth * safeHeight * scale * scale;
    const ratioPixels = ratioX * ratioY;
    const ratioScale = Math.max(1, Math.round(Math.sqrt(targetPixels / ratioPixels)));

    return {
        width: ratioX * ratioScale,
        height: ratioY * ratioScale
    };
}

export function formatClosestPResolution(width, height) {
    const pValue = Math.sqrt(width * height * 9 / 16);
    return `(${Math.round(pValue)}p)`;
}
