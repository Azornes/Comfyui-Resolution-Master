import { parseDimensionsFromText } from "./shared.js";

const LOCAL_IMAGE_GALLERY_NODE_TYPE = "LocalImageGallery";
const EMPTY_LOCAL_IMAGE_GALLERY_SELECTIONS = new Set(["", "none", "null", "undefined"]);

function isLocalImageGallerySourceNode(sourceNode) {
    return !!(sourceNode?.type === LOCAL_IMAGE_GALLERY_NODE_TYPE
        || sourceNode?.comfyClass === LOCAL_IMAGE_GALLERY_NODE_TYPE
        || sourceNode?.constructor?.nodeData?.name === LOCAL_IMAGE_GALLERY_NODE_TYPE
        || sourceNode?._gallery?.elements?.selectedName);
}

function getSelectedLocalImageGalleryImage(sourceNode) {
    const gallery = sourceNode?._gallery;
    return gallery?.selectedImage ?? sourceNode?.properties?.selected_image ?? "";
}

function hasSelectedLocalImageGalleryImage(sourceNode) {
    const selectedImage = getSelectedLocalImageGalleryImage(sourceNode);
    const normalizedSelection = String(selectedImage ?? "").trim().toLowerCase();
    return !EMPTY_LOCAL_IMAGE_GALLERY_SELECTIONS.has(normalizedSelection);
}

function getLocalImageGalleryDimensions(sourceNode) {
    if (!isLocalImageGallerySourceNode(sourceNode)) return null;

    const gallery = sourceNode?._gallery;
    const selectedImage = getSelectedLocalImageGalleryImage(sourceNode);
    if (!hasSelectedLocalImageGalleryImage(sourceNode)) return null;

    let width = Number(gallery?.selectedImageWidth);
    let height = Number(gallery?.selectedImageHeight);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        const textDimensions = parseDimensionsFromText(gallery?.elements?.selectedName?.textContent);
        width = Number(textDimensions?.width);
        height = Number(textDimensions?.height);
    }
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return null;
    }

    const selectedSource = gallery?.selectedImageSource
        || sourceNode?.properties?.actual_source
        || sourceNode?.properties?.source_folder
        || "";
    return {
        width: Math.round(width),
        height: Math.round(height),
        source: "frontend",
        signature: [
            "frontend:localimagegallery",
            sourceNode?.id ?? "unknown",
            selectedSource,
            selectedImage,
            Math.round(width),
            Math.round(height)
        ].join(":"),
        liveChangeTracking: true
    };
}

function isIgnoredPreview(sourceNode) {
    return isLocalImageGallerySourceNode(sourceNode)
        && !hasSelectedLocalImageGalleryImage(sourceNode);
}

function shouldSuppressBackendFallback(sourceNode) {
    return isIgnoredPreview(sourceNode);
}

function detachWatcher(controller) {
    if (controller.watchedLocalImageGalleryElement && controller.localImageGalleryChangeHandler) {
        controller.watchedLocalImageGalleryElement.removeEventListener?.('click', controller.localImageGalleryChangeHandler);
        controller.watchedLocalImageGalleryElement.removeEventListener?.('change', controller.localImageGalleryChangeHandler);
    }
    controller.watchedLocalImageGalleryElement = null;
}

function attachWatcher(controller, sourceNode) {
    if (!isLocalImageGallerySourceNode(sourceNode)) {
        detachWatcher(controller);
        return;
    }

    const galleryElement = sourceNode?._gallery?.elements?.viewport
        || sourceNode?._gallery?.elements?.container
        || null;
    if (galleryElement === controller.watchedLocalImageGalleryElement) return;

    detachWatcher(controller);
    controller.watchedLocalImageGalleryElement = galleryElement;
    if (!galleryElement?.addEventListener) return;

    if (!controller.localImageGalleryChangeHandler) {
        controller.localImageGalleryChangeHandler = () => {
            globalThis.setTimeout?.(() => {
                controller.markLivePreviewPending('local image gallery selection changed');
                controller.scheduleAutoDetectCheck('local image gallery selection changed', 0);
            }, 0);
        };
    }

    galleryElement.addEventListener('click', controller.localImageGalleryChangeHandler);
    galleryElement.addEventListener('change', controller.localImageGalleryChangeHandler);
}

export const localImageGalleryDetector = {
    id: "localimagegallery",
    isSourceNode: isLocalImageGallerySourceNode,
    getDimensions: getLocalImageGalleryDimensions,
    isIgnoredPreview,
    shouldSuppressBackendFallback,
    attachWatcher,
    detachWatcher
};
