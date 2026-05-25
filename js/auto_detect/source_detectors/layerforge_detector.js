import { getWidgetValue } from "./shared.js";

const LAYERFORGE_NODE_TYPE = "LayerForgeNode";

function isLayerForgeSourceNode(sourceNode) {
    return !!(sourceNode?.type === LAYERFORGE_NODE_TYPE
        || sourceNode?.comfyClass === LAYERFORGE_NODE_TYPE
        || sourceNode?.constructor?.nodeData?.name === LAYERFORGE_NODE_TYPE
        || sourceNode?.canvasWidget?.canvas?.outputAreaBounds);
}

function getLayerForgeDimensions(sourceNode) {
    if (!isLayerForgeSourceNode(sourceNode)) return null;

    const canvas = sourceNode?.canvasWidget?.canvas;
    const outputArea = canvas?.outputAreaBounds;
    const width = Number(outputArea?.width ?? canvas?.width);
    const height = Number(outputArea?.height ?? canvas?.height);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return null;
    }

    const showPreview = getWidgetValue(sourceNode, "show_preview");
    return {
        width: Math.round(width),
        height: Math.round(height),
        source: "frontend",
        signature: [
            "frontend:layerforge",
            sourceNode?.id ?? "unknown",
            showPreview === false ? "preview-off" : "preview-on",
            Math.round(width),
            Math.round(height),
            Math.round(Number(outputArea?.x) || 0),
            Math.round(Number(outputArea?.y) || 0)
        ].join(":"),
        liveChangeTracking: true
    };
}

function isIgnoredPreviewPlaceholder(sourceNode, preview) {
    if (!preview) return false;

    const width = Number(preview?.naturalWidth || preview?.width || preview?.videoWidth);
    const height = Number(preview?.naturalHeight || preview?.height || preview?.videoHeight);
    const showPreview = getWidgetValue(sourceNode, "show_preview");

    return isLayerForgeSourceNode(sourceNode)
        && showPreview === false
        && width <= 1
        && height <= 1;
}

export const layerForgeDetector = {
    id: "layerforge",
    isSourceNode: isLayerForgeSourceNode,
    getDimensions: getLayerForgeDimensions,
    isIgnoredPreview: isIgnoredPreviewPlaceholder
};
