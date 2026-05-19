/**
 * CSS Loader
 * Loads all CSS files for the resolution master components
 */

import { addStylesheet, getUrl } from "./utils/resource_manager.js";
import { createModuleLogger } from "./log_system/log_funcs.js";

const log = createModuleLogger('css_loader');
let stylesLoaded = false;

/**
 * Loads all CSS files for the application
 */
export function loadAllStyles() {
    try {
        if (stylesLoaded) {
            log.debug('CSS files already loaded, skipping');
            return;
        }

        log.info('Loading CSS files...');
        
        // Load all CSS files using getUrl for proper path resolution
        const cssFiles = [
            './css/css-variables.css',        // CSS Custom Properties - MUST BE FIRST!
            './css/common-components.css',    // Shared component styles using cascade
            './css/aspect-ratio-columns.css', // Shared aspect ratio column styles
            './css/preset-manager-dialog.css',
            './css/searchable-dropdown.css',
            './css/rename-dialog.css',
            './css/json-editor-dialog.css',
            './css/preset-ui-components.css',
            './css/preset-list-renderer.css',
            './css/preset-add-view.css',
            './css/drag-drop.css'
        ];
        
        cssFiles.forEach(file => {
            addStylesheet(getUrl(file));
            log.debug(`Loaded: ${file}`);
        });
        
        stylesLoaded = true;
        log.info('All CSS files loaded successfully');
    } catch (error) {
        log.error('Error loading CSS files:', error);
    }
}

/**
 * Call this function when the ResolutionMaster node is actually created/used
 * to load styles only when needed, preventing global UI interference
 */
export function loadStylesWhenNeeded() {
    loadAllStyles();
}
