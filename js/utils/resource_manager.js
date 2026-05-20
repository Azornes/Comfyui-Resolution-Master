import { createModuleLogger } from "../log_system/log_funcs.js";
import { withErrorHandling, createValidationError, createNetworkError } from "./error_handler.js";
const log = createModuleLogger('resource_manager');
export const addStylesheet = withErrorHandling(function (url) {
    if (!url) {
        throw createValidationError("URL is required", { url });
    }
    if (url.endsWith(".js")) {
        url = url.substr(0, url.length - 2) + "css";
    }

    const finalUrl = url.startsWith("http") ? url : getUrl(url);
    const existingLink = Array.from(document.head.querySelectorAll('link[rel="stylesheet"]'))
        .find(link => link.href === finalUrl);
    if (existingLink) {
        log.debug('Stylesheet already present, skipping:', { finalUrl });
        return existingLink;
    }

    log.debug('Adding stylesheet:', { url, finalUrl });
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = finalUrl;
    document.head.appendChild(link);
    log.debug('Stylesheet added successfully:', { finalUrl });
    return link;
}, 'addStylesheet');
export function getUrl(path, baseUrl) {
    if (!path) {
        throw createValidationError("Path is required", { path });
    }
    if (baseUrl) {
        return new URL(path, baseUrl).toString();
    }
    else {
        // @ts-ignore
        return new URL("../" + path, import.meta.url).toString();
    }
}
export const loadTemplate = withErrorHandling(async function (path, baseUrl) {
    if (!path) {
        throw createValidationError("Path is required", { path });
    }
    const url = getUrl(path, baseUrl);
    log.debug('Loading template:', { path, url });
    const response = await fetch(url);
    if (!response.ok) {
        throw createNetworkError(`Failed to load template: ${url}`, {
            url,
            status: response.status,
            statusText: response.statusText
        });
    }
    const content = await response.text();
    log.debug('Template loaded successfully:', { path, contentLength: content.length });
    return content;
}, 'loadTemplate');
