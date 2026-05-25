import { getPreviewSourceSignatureInfo } from "./shared.js";

function getGenericPreviewDimensions(sourceNode, context = {}) {
    const preview = sourceNode?.imgs?.[0];
    if (context.isIgnoredPreview?.(sourceNode, preview)) {
        return null;
    }

    const width = Number(preview?.naturalWidth || preview?.width || preview?.videoWidth);
    const height = Number(preview?.naturalHeight || preview?.height || preview?.videoHeight);

    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return null;
    }

    const signatureInfo = getPreviewSourceSignatureInfo(sourceNode, preview, width, height);
    return {
        width: Math.round(width),
        height: Math.round(height),
        source: "frontend",
        signature: signatureInfo.signature,
        liveChangeTracking: signatureInfo.hasChangeSignal
    };
}

export const genericPreviewDetector = {
    id: "generic-preview",
    getDimensions: getGenericPreviewDimensions
};
