import { genericPreviewDetector } from "./generic_preview_detector.js";
import { layerForgeDetector } from "./layerforge_detector.js";
import { localImageGalleryDetector } from "./local_image_gallery_detector.js";

const customSourceDetectors = [
    layerForgeDetector,
    localImageGalleryDetector
];

export const sourceDetectors = [
    ...customSourceDetectors,
    genericPreviewDetector
];

function isIgnoredPreview(sourceNode, preview) {
    return customSourceDetectors.some(detector => detector.isIgnoredPreview?.(sourceNode, preview));
}

export function getSourceDimensions(sourceNode) {
    if (!sourceNode) return null;

    const context = { isIgnoredPreview };
    for (const detector of sourceDetectors) {
        const dimensions = detector.getDimensions?.(sourceNode, context);
        if (dimensions) return dimensions;
    }

    return null;
}

export function shouldSuppressBackendFallback(sourceNode) {
    if (!sourceNode) return false;

    return customSourceDetectors.some(detector => detector.shouldSuppressBackendFallback?.(sourceNode));
}

export function attachSourceDetectorWatchers(controller, sourceNode) {
    for (const detector of sourceDetectors) {
        detector.attachWatcher?.(controller, sourceNode);
    }
}

export function detachSourceDetectorWatchers(controller) {
    for (const detector of sourceDetectors) {
        detector.detachWatcher?.(controller);
    }
}
