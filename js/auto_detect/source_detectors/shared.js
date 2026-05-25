export const LIVE_PREVIEW_WIDGET_NAMES = new Set([
    "image",
    "upload",
    "file",
    "filename",
    "path",
    "url",
    "image_path",
    "show_preview",
    "width",
    "height",
    "canvas_width",
    "canvas_height",
    "selected_image",
    "source_folder",
    "actual_source"
]);

export function isLivePreviewWidget(widget) {
    const name = String(widget?.name || "").toLowerCase();
    return LIVE_PREVIEW_WIDGET_NAMES.has(name) || typeof widget?.value === "string";
}

export function getWidgetValue(node, widgetName) {
    return node?.widgets?.find(widget => widget?.name === widgetName)?.value;
}

export function getPreviewSourceSignatureInfo(sourceNode, preview, width, height) {
    const nodeId = sourceNode?.id ?? "unknown";
    const widgetParts = (sourceNode?.widgets || [])
        .filter(widget => {
            const name = String(widget?.name || "").toLowerCase();
            const value = widget?.value;
            return LIVE_PREVIEW_WIDGET_NAMES.has(name) || typeof value === "string";
        })
        .map(widget => `${widget?.name || ""}:${String(widget?.value ?? "")}`)
        .join("|");
    const previewParts = [
        preview?.currentSrc,
        preview?.src,
        preview?.dataset?.filename,
        preview?.dataset?.name,
        preview?.alt,
        preview?.title
    ].filter(Boolean).join("|");

    return {
        signature: `frontend:${nodeId}:${widgetParts}:${previewParts}:${Math.round(width)}x${Math.round(height)}`,
        hasChangeSignal: !!(widgetParts || previewParts)
    };
}

export function parseDimensionsFromText(text) {
    const match = String(text || "").match(/\((\d+)\s*(?:x|\u00d7)\s*(\d+)\)/i);
    if (!match) return null;

    const width = Number(match[1]);
    const height = Number(match[2]);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return null;
    }

    return { width: Math.round(width), height: Math.round(height) };
}
