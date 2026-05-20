/**
 * Stylesheet Loader
 * Loads all CSS files for the resolution master components
 */

import { addStylesheet, getUrl } from "../utils/resource_manager.js";
import { createModuleLogger } from "../log_system/log_funcs.js";

const log = createModuleLogger('stylesheet_loader');
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
            './styles/design-tokens.css',              // Design tokens - MUST BE FIRST!
            './styles/shared-components.css',          // Shared component styles using cascade
            './styles/aspect-ratio-selector.css',
            './styles/preset-manager-dialog.css',
            './styles/searchable-dropdown.css',
            './styles/rename-dialog.css',
            './styles/json-editor-dialog.css',
            './styles/preset-manager-components.css',
            './styles/preset-list-view.css',
            './styles/preset-editor-view.css',
            './styles/preset-drag-drop.css'
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
