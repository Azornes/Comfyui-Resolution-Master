export function getSliderStepDecimals(step) {
    const numericStep = Number(step);
    if (!Number.isFinite(numericStep) || numericStep <= 0) return 1;

    const [coefficient, exponent = "0"] = numericStep.toString().toLowerCase().split("e");
    const fractionLength = coefficient.split(".")[1]?.length || 0;
    return Math.min(3, Math.max(0, fractionLength - Number(exponent)));
}

export function roundSliderValue(value, step) {
    return Number(value.toFixed(getSliderStepDecimals(step)));
}

export function formatMegapixels(value, step) {
    return `${value.toFixed(Math.max(1, getSliderStepDecimals(step)))}MP`;
}

export function formatScaling(value, step) {
    return `${value.toFixed(Math.max(1, getSliderStepDecimals(step)))}x`;
}
