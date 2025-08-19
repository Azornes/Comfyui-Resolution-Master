// IconUtils.js - Utility for loading SVG icons
import { app } from "../../../scripts/app.js";

/**
 * Loads SVG icons and converts them to Image objects
 * @param {Object} icons - Object to store loaded icons
 * @param {string} iconColor - Color for the SVG icons (default: "#dddddd")
 */
export function loadIcons(icons = {}, iconColor = "#dddddd") {
    const svgs = {
        upscale: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>`,
        resolution: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></svg>`,
        megapixels: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>`
    };

    for (const name in svgs) {
        const img = new Image();
        img.onload = () => app.graph.setDirtyCanvas(true);
        img.src = `data:image/svg+xml;base64,${btoa(svgs[name])}`;
        icons[name] = img;
    }
    
    return icons;
}