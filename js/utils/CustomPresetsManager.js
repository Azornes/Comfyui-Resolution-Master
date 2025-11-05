// CustomPresetsManager.js - Manages custom user presets with persistence
import { createModuleLogger } from "./LoggerUtils.js";

const log = createModuleLogger('CustomPresetsManager');

export class CustomPresetsManager {
    constructor(resolutionMasterInstance) {
        this.rm = resolutionMasterInstance;
        this.customPresets = {};
        this.hiddenBuiltInPresets = {};
        this.loadCustomPresets();
    }
    
    /**
     * Loads custom presets from node properties
     */
    loadCustomPresets() {
        try {
            const props = this.rm.node.properties;
            if (props.customPresetsJSON && typeof props.customPresetsJSON === 'string') {
                const data = JSON.parse(props.customPresetsJSON);
                
                // Support both old and new format
                if (data.customPresets) {
                    // New format with hiddenBuiltInPresets
                    this.customPresets = data.customPresets || {};
                    this.hiddenBuiltInPresets = data.hiddenBuiltInPresets || {};
                } else {
                    // Old format - just custom presets
                    this.customPresets = data;
                    this.hiddenBuiltInPresets = {};
                }
                
                // Clean up empty categories
                this.cleanEmptyCategories();
                
                log.debug('Loaded custom presets:', this.customPresets);
                log.debug('Loaded hidden built-in presets:', this.hiddenBuiltInPresets);
            } else {
                this.customPresets = {};
                this.hiddenBuiltInPresets = {};
                log.debug('No custom presets found, initialized empty');
            }
        } catch (error) {
            log.error('Error loading custom presets:', error);
            this.customPresets = {};
            this.hiddenBuiltInPresets = {};
        }
    }
    
    /**
     * Saves custom presets to node properties
     */
    saveCustomPresets() {
        try {
            // Clean up empty categories before saving
            this.cleanEmptyCategories();
            
            const data = {
                customPresets: this.customPresets,
                hiddenBuiltInPresets: this.hiddenBuiltInPresets
            };
            this.rm.node.properties.customPresetsJSON = JSON.stringify(data);
            log.debug('Saved custom presets and hidden built-in presets to node properties');
        } catch (error) {
            log.error('Error saving custom presets:', error);
        }
    }
    
    /**
     * Removes empty categories from customPresets
     */
    cleanEmptyCategories() {
        Object.keys(this.customPresets).forEach(category => {
            if (!this.customPresets[category] || 
                typeof this.customPresets[category] !== 'object' ||
                Object.keys(this.customPresets[category]).length === 0) {
                delete this.customPresets[category];
                log.debug(`Removed empty category: ${category}`);
            }
        });
    }
    
    /**
     * Gets all custom presets
     * @returns {Object} Custom presets object
     */
    getCustomPresets() {
        return this.customPresets;
    }
    
    /**
     * Gets merged presets (built-in + custom)
     * Custom presets OVERRIDE built-in presets with the same name
     * Hidden built-in presets are FILTERED OUT
     * @param {Object} builtInPresets - Built-in preset categories
     * @returns {Object} Merged presets with custom indicator and hidden flag
     */
    getMergedPresets(builtInPresets) {
        // Start with deep copy of built-in presets
        const merged = {};
        
        // First, copy all built-in presets (including hidden ones, but mark them)
        Object.entries(builtInPresets).forEach(([categoryName, presets]) => {
            merged[categoryName] = {};
            Object.entries(presets).forEach(([presetName, dimensions]) => {
                // Mark as hidden if in hiddenBuiltInPresets list
                const isHidden = this.isBuiltInPresetHidden(categoryName, presetName);
                
                merged[categoryName][presetName] = {
                    width: dimensions.width,
                    height: dimensions.height,
                    isCustom: false,
                    isHidden: isHidden
                };
            });
        });
        
        // Then, add/override with custom presets
        Object.entries(this.customPresets).forEach(([categoryName, presets]) => {
            if (!merged[categoryName]) {
                // New custom category
                merged[categoryName] = {};
            }
            
            Object.entries(presets).forEach(([presetName, dimensions]) => {
                // This will override built-in preset if it exists
                merged[categoryName][presetName] = {
                    width: dimensions.width,
                    height: dimensions.height,
                    isCustom: true,
                    isHidden: false,
                    originalCategory: categoryName
                };
            });
        });
        
        return merged;
    }
    
    /**
     * Adds a new preset or updates existing one
     * @param {string} category - Category name
     * @param {string} name - Preset name
     * @param {number} width - Width value
     * @param {number} height - Height value
     * @returns {boolean} Success status
     */
    addPreset(category, name, width, height) {
        try {
            if (!this.customPresets[category]) {
                this.customPresets[category] = {};
            }
            
            this.customPresets[category][name] = {
                width: parseInt(width),
                height: parseInt(height)
            };
            
            this.saveCustomPresets();
            log.debug(`Added/Updated preset: ${category}/${name} (${width}x${height})`);
            return true;
        } catch (error) {
            log.error('Error adding preset:', error);
            return false;
        }
    }
    
    /**
     * Deletes a preset
     * @param {string} category - Category name
     * @param {string} name - Preset name
     * @returns {boolean} Success status
     */
    deletePreset(category, name) {
        try {
            if (this.customPresets[category] && this.customPresets[category][name]) {
                delete this.customPresets[category][name];
                
                // Remove category if empty
                if (Object.keys(this.customPresets[category]).length === 0) {
                    delete this.customPresets[category];
                }
                
                this.saveCustomPresets();
                log.debug(`Deleted preset: ${category}/${name}`);
                return true;
            }
            return false;
        } catch (error) {
            log.error('Error deleting preset:', error);
            return false;
        }
    }
    
    /**
     * Renames a preset
     * @param {string} category - Category name
     * @param {string} oldName - Old preset name
     * @param {string} newName - New preset name
     * @returns {boolean} Success status
     */
    renamePreset(category, oldName, newName) {
        try {
            if (this.customPresets[category] && this.customPresets[category][oldName]) {
                const preset = this.customPresets[category][oldName];
                this.customPresets[category][newName] = preset;
                delete this.customPresets[category][oldName];
                
                this.saveCustomPresets();
                log.debug(`Renamed preset: ${category}/${oldName} -> ${newName}`);
                return true;
            }
            return false;
        } catch (error) {
            log.error('Error renaming preset:', error);
            return false;
        }
    }
    
    /**
     * Updates a preset (name and/or dimensions) while preserving its position in the list
     * @param {string} category - Category name
     * @param {string} oldName - Current preset name
     * @param {string} newName - New preset name
     * @param {number} width - New width value
     * @param {number} height - New height value
     * @returns {boolean} Success status
     */
    updatePreset(category, oldName, newName, width, height) {
        try {
            if (!this.customPresets[category] || !this.customPresets[category][oldName]) {
                log.warn(`Preset ${category}/${oldName} does not exist`);
                return false;
            }
            
            // If both name and dimensions are the same, no update needed
            const oldPreset = this.customPresets[category][oldName];
            if (oldName === newName && 
                oldPreset.width === parseInt(width) && 
                oldPreset.height === parseInt(height)) {
                return true;
            }
            
            // Check if new name already exists (and it's not the same preset)
            if (oldName !== newName && this.customPresets[category][newName]) {
                log.warn(`Preset ${category}/${newName} already exists`);
                return false;
            }
            
            // Convert category presets to array of entries to preserve order
            const entries = Object.entries(this.customPresets[category]);
            
            // Find the index of the old preset
            const index = entries.findIndex(([name]) => name === oldName);
            
            if (index === -1) {
                log.warn(`Preset ${category}/${oldName} not found in entries`);
                return false;
            }
            
            // Replace the entry with updated preset
            entries[index] = [newName, {
                width: parseInt(width),
                height: parseInt(height)
            }];
            
            // Rebuild the category object from entries (preserves order)
            this.customPresets[category] = Object.fromEntries(entries);
            
            this.saveCustomPresets();
            log.debug(`Updated preset: ${category}/${oldName} -> ${newName} (${width}x${height})`);
            return true;
        } catch (error) {
            log.error('Error updating preset:', error);
            return false;
        }
    }
    
    /**
     * Renames a category while preserving its position in the list
     * @param {string} oldName - Current category name
     * @param {string} newName - New category name
     * @returns {boolean} Success status
     */
    renameCategory(oldName, newName) {
        // Validate input
        const trimmedNewName = newName.trim();
        if (!trimmedNewName) {
            log.warn('New category name cannot be empty');
            return false;
        }

        // Check if old category exists
        if (!this.customPresets[oldName]) {
            log.warn(`Category ${oldName} does not exist`);
            return false;
        }

        // Check if new name already exists (and it's not the same category)
        if (oldName !== trimmedNewName && this.customPresets[trimmedNewName]) {
            log.warn(`Category ${trimmedNewName} already exists`);
            return false;
        }

        // If names are the same (after trim), no change needed
        if (oldName === trimmedNewName) {
            return true;
        }

        // Convert customPresets to array of entries to preserve order
        const entries = Object.entries(this.customPresets);
        
        // Find the index of the old category
        const index = entries.findIndex(([categoryName]) => categoryName === oldName);
        
        if (index === -1) {
            log.warn(`Category ${oldName} not found in entries`);
            return false;
        }
        
        // Replace the entry with new category name (keeping the same presets)
        entries[index] = [trimmedNewName, entries[index][1]];
        
        // Rebuild the customPresets object from entries (preserves order)
        this.customPresets = Object.fromEntries(entries);

        this.saveCustomPresets();
        log.debug(`Renamed category: ${oldName} -> ${trimmedNewName}`);
        return true;
    }
    
    /**
     * Duplicates a preset (works with both built-in and custom)
     * @param {string} sourceCategory - Source category name
     * @param {string} sourceName - Source preset name
     * @param {string} targetCategory - Target category name
     * @param {string} targetName - Target preset name
     * @param {Object} builtInPresets - Built-in presets to check
     * @returns {boolean} Success status
     */
    duplicatePreset(sourceCategory, sourceName, targetCategory, targetName, builtInPresets) {
        try {
            let sourcePreset = null;
            
            // Check custom presets first
            if (this.customPresets[sourceCategory] && this.customPresets[sourceCategory][sourceName]) {
                sourcePreset = this.customPresets[sourceCategory][sourceName];
            }
            // Check built-in presets
            else if (builtInPresets[sourceCategory] && builtInPresets[sourceCategory][sourceName]) {
                sourcePreset = builtInPresets[sourceCategory][sourceName];
            }
            
            if (sourcePreset) {
                return this.addPreset(targetCategory, targetName, sourcePreset.width, sourcePreset.height);
            }
            
            return false;
        } catch (error) {
            log.error('Error duplicating preset:', error);
            return false;
        }
    }
    
    /**
     * Exports custom presets and hidden built-in presets to JSON string
     * @returns {string} JSON string of custom presets and hidden built-in presets
     */
    exportToJSON() {
        try {
            const data = {
                customPresets: this.customPresets,
                hiddenBuiltInPresets: this.hiddenBuiltInPresets
            };
            return JSON.stringify(data, null, 2);
        } catch (error) {
            log.error('Error exporting presets:', error);
            return null;
        }
    }
    
    /**
     * Imports presets from JSON string
     * Supports both old format (direct presets) and new format (with customPresets and hiddenBuiltInPresets)
     * @param {string} jsonString - JSON string to import
     * @param {boolean} merge - If true, merge with existing. If false, replace.
     * @returns {boolean} Success status
     */
    importFromJSON(jsonString, merge = true) {
        try {
            const imported = JSON.parse(jsonString);
            
            // Validate structure
            if (typeof imported !== 'object' || imported === null) {
                throw new Error('Invalid preset format');
            }
            
            // Detect format: new format has 'customPresets' field, old format doesn't
            let presetsToImport;
            let hiddenToImport = {};
            
            if (imported.customPresets) {
                // New format with customPresets and hiddenBuiltInPresets
                presetsToImport = imported.customPresets;
                hiddenToImport = imported.hiddenBuiltInPresets || {};
                log.debug('Importing new format (with hiddenBuiltInPresets)');
            } else {
                // Old format - direct presets object
                presetsToImport = imported;
                log.debug('Importing old format (without hiddenBuiltInPresets)');
            }
            
            // Validate each preset
            for (const [category, presets] of Object.entries(presetsToImport)) {
                if (typeof presets !== 'object') {
                    throw new Error(`Invalid category format: ${category}`);
                }
                
                for (const [name, dimensions] of Object.entries(presets)) {
                    if (!dimensions.width || !dimensions.height || 
                        typeof dimensions.width !== 'number' || 
                        typeof dimensions.height !== 'number') {
                        throw new Error(`Invalid preset dimensions: ${category}/${name}`);
                    }
                }
            }
            
            if (merge) {
                // Merge with existing presets
                Object.entries(presetsToImport).forEach(([category, presets]) => {
                    if (!this.customPresets[category]) {
                        this.customPresets[category] = {};
                    }
                    Object.assign(this.customPresets[category], presets);
                });
                
                // Merge hidden built-in presets
                Object.entries(hiddenToImport).forEach(([category, hiddenPresets]) => {
                    if (!this.hiddenBuiltInPresets[category]) {
                        this.hiddenBuiltInPresets[category] = [];
                    }
                    // Merge arrays, avoiding duplicates
                    hiddenPresets.forEach(presetName => {
                        if (!this.hiddenBuiltInPresets[category].includes(presetName)) {
                            this.hiddenBuiltInPresets[category].push(presetName);
                        }
                    });
                });
            } else {
                // Replace all presets
                this.customPresets = presetsToImport;
                this.hiddenBuiltInPresets = hiddenToImport;
            }
            
            this.saveCustomPresets();
            log.debug('Imported presets successfully', merge ? '(merged)' : '(replaced)');
            return true;
        } catch (error) {
            log.error('Error importing presets:', error);
            return false;
        }
    }
    
    /**
     * Clears all custom presets
     * @returns {boolean} Success status
     */
    clearAllPresets() {
        try {
            this.customPresets = {};
            this.saveCustomPresets();
            log.debug('Cleared all custom presets');
            return true;
        } catch (error) {
            log.error('Error clearing presets:', error);
            return false;
        }
    }
    
    /**
     * Gets preset count statistics
     * @returns {Object} Statistics object
     */
    getStatistics() {
        let totalCategories = 0;
        let totalPresets = 0;
        
        Object.entries(this.customPresets).forEach(([category, presets]) => {
            totalCategories++;
            totalPresets += Object.keys(presets).length;
        });
        
        return {
            categories: totalCategories,
            presets: totalPresets
        };
    }
    
    /**
     * Checks if a preset name exists in a category
     * @param {string} category - Category name
     * @param {string} name - Preset name
     * @returns {boolean} True if exists
     */
    presetExists(category, name) {
        return !!(this.customPresets[category] && this.customPresets[category][name]);
    }
    
    /**
     * Checks if a category exists
     * @param {string} category - Category name
     * @returns {boolean} True if exists
     */
    categoryExists(category) {
        return !!this.customPresets[category];
    }
    
    /**
     * Checks if a preset is a custom preset (vs built-in)
     * @param {string} category - Category name
     * @param {string} name - Preset name
     * @returns {boolean} True if custom preset
     */
    isCustomPreset(category, name) {
        return this.presetExists(category, name);
    }
    
    /**
     * Reorders categories by moving one category to a new position
     * @param {string} categoryName - Category to move
     * @param {number} newIndex - New position index
     * @returns {boolean} Success status
     */
    reorderCategories(categoryName, newIndex) {
        try {
            // Convert to array of entries
            const entries = Object.entries(this.customPresets);
            
            // Find current index
            const currentIndex = entries.findIndex(([name]) => name === categoryName);
            
            if (currentIndex === -1) {
                log.warn(`Category ${categoryName} not found`);
                return false;
            }
            
            // Remove from current position
            const [movedEntry] = entries.splice(currentIndex, 1);
            
            // Insert at new position
            entries.splice(newIndex, 0, movedEntry);
            
            // Rebuild object with new order
            this.customPresets = Object.fromEntries(entries);
            
            this.saveCustomPresets();
            log.debug(`Reordered category ${categoryName}: ${currentIndex} -> ${newIndex}`);
            return true;
        } catch (error) {
            log.error('Error reordering categories:', error);
            return false;
        }
    }
    
    /**
     * Reorders presets within a category
     * @param {string} category - Category name
     * @param {string} presetName - Preset to move
     * @param {number} newIndex - New position index
     * @returns {boolean} Success status
     */
    reorderPresets(category, presetName, newIndex) {
        try {
            if (!this.customPresets[category]) {
                log.warn(`Category ${category} not found`);
                return false;
            }
            
            // Convert to array of entries
            const entries = Object.entries(this.customPresets[category]);
            
            // Find current index
            const currentIndex = entries.findIndex(([name]) => name === presetName);
            
            if (currentIndex === -1) {
                log.warn(`Preset ${presetName} not found in category ${category}`);
                return false;
            }
            
            // Remove from current position
            const [movedEntry] = entries.splice(currentIndex, 1);
            
            // Insert at new position
            entries.splice(newIndex, 0, movedEntry);
            
            // Rebuild category with new order
            this.customPresets[category] = Object.fromEntries(entries);
            
            this.saveCustomPresets();
            log.debug(`Reordered preset ${category}/${presetName}: ${currentIndex} -> ${newIndex}`);
            return true;
        } catch (error) {
            log.error('Error reordering presets:', error);
            return false;
        }
    }
    
    /**
     * Moves a preset from one category to another
     * @param {string} sourceCategory - Source category name
     * @param {string} presetName - Preset name to move
     * @param {string} targetCategory - Target category name
     * @param {number} targetIndex - Index in target category (optional, defaults to end)
     * @returns {boolean} Success status
     */
    movePreset(sourceCategory, presetName, targetCategory, targetIndex = -1) {
        try {
            // Check if source preset exists
            if (!this.customPresets[sourceCategory] || !this.customPresets[sourceCategory][presetName]) {
                log.warn(`Source preset ${sourceCategory}/${presetName} not found`);
                return false;
            }
            
            // Get the preset data
            const presetData = this.customPresets[sourceCategory][presetName];
            
            // Create target category if it doesn't exist
            if (!this.customPresets[targetCategory]) {
                this.customPresets[targetCategory] = {};
            }
            
            // Check if preset with same name already exists in target
            if (this.customPresets[targetCategory][presetName]) {
                log.warn(`Preset ${presetName} already exists in category ${targetCategory}`);
                return false;
            }
            
            // Convert target category to array for insertion at specific index
            const targetEntries = Object.entries(this.customPresets[targetCategory]);
            
            // Insert at specified index (or end if -1)
            if (targetIndex === -1 || targetIndex >= targetEntries.length) {
                targetEntries.push([presetName, presetData]);
            } else {
                targetEntries.splice(targetIndex, 0, [presetName, presetData]);
            }
            
            // Rebuild target category
            this.customPresets[targetCategory] = Object.fromEntries(targetEntries);
            
            // Remove from source category
            delete this.customPresets[sourceCategory][presetName];
            
            // Remove source category if empty
            if (Object.keys(this.customPresets[sourceCategory]).length === 0) {
                delete this.customPresets[sourceCategory];
            }
            
            this.saveCustomPresets();
            log.debug(`Moved preset ${presetName} from ${sourceCategory} to ${targetCategory} at index ${targetIndex}`);
            return true;
        } catch (error) {
            log.error('Error moving preset:', error);
            return false;
        }
    }
    
    /**
     * Gets all hidden built-in presets
     * @returns {Object} Hidden built-in presets object
     */
    getHiddenBuiltInPresets() {
        return this.hiddenBuiltInPresets;
    }
    
    /**
     * Checks if a built-in preset is hidden
     * @param {string} category - Category name
     * @param {string} name - Preset name
     * @returns {boolean} True if hidden
     */
    isBuiltInPresetHidden(category, name) {
        return !!(this.hiddenBuiltInPresets[category] && 
                  this.hiddenBuiltInPresets[category].includes(name));
    }
    
    /**
     * Toggles visibility of a built-in preset (hide/unhide)
     * @param {string} category - Category name
     * @param {string} name - Preset name
     * @returns {boolean} New visibility state (true = now hidden, false = now visible)
     */
    toggleBuiltInPresetVisibility(category, name) {
        try {
            if (!this.hiddenBuiltInPresets[category]) {
                this.hiddenBuiltInPresets[category] = [];
            }
            
            const index = this.hiddenBuiltInPresets[category].indexOf(name);
            
            if (index === -1) {
                // Not hidden yet - hide it
                this.hiddenBuiltInPresets[category].push(name);
                log.debug(`Hidden built-in preset: ${category}/${name}`);
                
                this.saveCustomPresets();
                return true; // Now hidden
            } else {
                // Already hidden - unhide it
                this.hiddenBuiltInPresets[category].splice(index, 1);
                
                // Remove category if empty
                if (this.hiddenBuiltInPresets[category].length === 0) {
                    delete this.hiddenBuiltInPresets[category];
                }
                
                log.debug(`Unhidden built-in preset: ${category}/${name}`);
                
                this.saveCustomPresets();
                return false; // Now visible
            }
        } catch (error) {
            log.error('Error toggling built-in preset visibility:', error);
            return this.isBuiltInPresetHidden(category, name);
        }
    }
}
