export function gcd(a, b) {
    a = Math.abs(Math.floor(Number(a))) || 1;
    b = Math.abs(Math.floor(Number(b))) || 1;

    while (b !== 0) {
        const t = a % b;
        a = b;
        b = t;
    }
    return a;
}

export function aspectRatioString(width, height) {
    const divisor = gcd(width, height);
    return `${width / divisor}:${height / divisor}`;
}

export function createAspectLock(width, height) {
    const safeWidth = Math.max(1, Math.round(Number(width) || 1));
    const safeHeight = Math.max(1, Math.round(Number(height) || 1));
    const divisor = gcd(safeWidth, safeHeight);

    return {
        aspect: safeWidth / safeHeight,
        ratioX: safeWidth / divisor,
        ratioY: safeHeight / divisor
    };
}

export function getAspectLockedDimensions(targetWidth, targetHeight, props, lock, snapToGrid = false) {
    const minScale = Math.max(
        1,
        Math.ceil(props.canvas_min_x / lock.ratioX),
        Math.ceil(props.canvas_min_y / lock.ratioY)
    );
    const maxScale = Math.max(minScale, Math.min(
        Math.floor(props.canvas_max_x / lock.ratioX),
        Math.floor(props.canvas_max_y / lock.ratioY)
    ));

    if (snapToGrid) {
        return createGridAspectCandidate(targetWidth, targetHeight, props, lock, minScale, maxScale);
    }

    const rangeX = Math.max(1, props.canvas_max_x - props.canvas_min_x);
    const rangeY = Math.max(1, props.canvas_max_y - props.canvas_min_y);
    const candidates = [
        createAspectCandidate(targetWidth / lock.ratioX, minScale, maxScale, 1, lock),
        createAspectCandidate(targetHeight / lock.ratioY, minScale, maxScale, 1, lock)
    ];

    return candidates.reduce((best, candidate) => {
        const distance = Math.hypot(
            (candidate.width - targetWidth) / rangeX,
            (candidate.height - targetHeight) / rangeY
        );
        if (!best || distance < best.distance) {
            return { ...candidate, distance };
        }
        return best;
    }, null);
}

function createGridAspectCandidate(targetWidth, targetHeight, props, lock, minScale, maxScale) {
    const stepX = Math.max(1, Math.round(Number(props.canvas_step_x) || 1));
    const stepY = Math.max(1, Math.round(Number(props.canvas_step_y) || 1));
    const targetAspect = targetWidth / Math.max(1, targetHeight);
    const widthControls = targetAspect <= lock.aspect;

    const targetScale = widthControls
        ? targetWidth / lock.ratioX
        : targetHeight / lock.ratioY;
    const desiredStep = widthControls ? stepX / lock.ratioX : stepY / lock.ratioY;
    const scaleStep = Math.max(1, Math.round(desiredStep));

    return createAspectCandidate(targetScale, minScale, maxScale, scaleStep, lock);
}

function createAspectCandidate(targetScale, minScale, maxScale, scaleStep, lock) {
    const snappedScale = Math.round(targetScale / scaleStep) * scaleStep;
    const scale = Math.max(minScale, Math.min(maxScale, snappedScale));

    return {
        width: lock.ratioX * scale,
        height: lock.ratioY * scale
    };
}
