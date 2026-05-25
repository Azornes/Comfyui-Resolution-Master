import { app } from "../../scripts/app.js";
import { createModuleLogger } from "./log_system/log_funcs.js";
import { loadIcons } from "./utils/icon_utils.js";
import { tooltips } from "./config/resolution_master_tooltips.js";
import { presetCategories } from "./presets/preset_categories.js";
import { CustomValueDialogManager } from "./dialogs/custom_value_dialog_manager.js";
import { SearchableDropdown } from "./components/searchable_dropdown.js";
import { AspectRatioSelector } from "./components/aspect_ratio_selector.js";
import { CustomPresetsManager } from "./presets/custom_presets_manager.js";
import { PresetManagerDialog } from "./presets/preset_manager/preset_manager_dialog.js";
import { RESOLUTION_OPTIONS } from "./node/default_node_properties.js";
import { calculationMethods } from "./calculations/resolution_master_calculation_methods.js";
import { autoDetectMethods } from "./auto_detect/auto_detect_methods.js";
import { drawingMethods } from "./drawing/resolution_master_draw_methods.js";
import { interactionMethods } from "./interaction/resolution_master_interaction_methods.js";
import { nodeLifecycleMethods } from "./node/resolution_master_node_lifecycle.js";
import { canvasMethods } from "./canvas/resolution_master_canvas_methods.js";
const log = createModuleLogger('resolution_master');

class ResolutionMasterCanvas {    
    constructor(node) {
        this.node = node;
        this.app = app;
        this.node.properties = this.node.properties || {};
        this.initializeProperties();
        this.collapsedSections = {
            actions: this.node.properties.section_actions_collapsed,
            scaling: this.node.properties.section_scaling_collapsed,
            autoDetect: this.node.properties.section_autoDetect_collapsed,
            presets: this.node.properties.section_presets_collapsed,
            extraControls: this.node.properties.section_extraControls_collapsed
        };
        this.node.intpos = { x: 0.5, y: 0.5 };
        this.node.capture = false;
        this.node.configured = false;
        this._isInitializing = true; // Flag to prevent setDirtyCanvas during init
        this._pendingCanvasUpdate = false;
        this._isApplyingAutoSize = false;
        this.userPreferredHeight = this.getStoredPreferredHeight();
        this.hoverElement = null;
        this.scrollOffset = 0;
        this.dropdownOpen = null;
        this.customValueDialogManager = new CustomValueDialogManager(this, app);
        this.searchableDropdown = new SearchableDropdown();
        this.aspectRatioSelector = new AspectRatioSelector();
        this.customPresetsManager = new CustomPresetsManager(this);
        this.presetManagerDialog = new PresetManagerDialog(this.customPresetsManager);
        this.tooltipElement = null;
        this.tooltipTimer = null;
        this.tooltipDelay = 500; 
        this.showTooltip = false;
        this.tooltipMousePos = null; 
        this.detectedDimensions = null;
        this.lastBackendDimensionsTimestamp = null;
        this.autoDetectStartedAtMs = null;
        this.dimensionCheckInterval = null;
        this.autoDetectCheckTimeout = null;
        this.lastAutoDetectCheckReason = null;
        this.watchedLivePreviewSourceNode = null;
        this.watchedLivePreviewElement = null;
        this.watchedLivePreviewWidgets = new Set();
        this.watchedLocalImageGalleryElement = null;
        this.localImageGalleryChangeHandler = null;
        this.lastLivePreviewSignature = null;
        this.lastLivePreviewChangeAtMs = null;
        this.awaitingLivePreviewUntilMs = null;
        this.awaitingLivePreviewReason = null;
        this.manuallySetByAutoFit = false;
        this.canvasDragAspectLock = null;
        this._pendingCanvasPointerDragEvent = null;
        this._pendingCanvasPointerDragCanvas = null;
        this._pendingCanvasPointerDragFrame = null;
        this._pendingCanvasPointerDragCancel = null;
        this.canvasDotsCache = null;
        this.controls = {};
        this.resolutions = [...RESOLUTION_OPTIONS];

        this.icons = {};
        loadIcons(this.icons);
        this.tooltips = tooltips;
        this.presetCategories = presetCategories;

        log.debug('Creating ResolutionMaster node UI', {
            nodeId: this.node.id ?? null,
            widgetCount: this.node.widgets?.length || 0
        });
        
        this.setupNode();
        import('./styles/stylesheet_loader.js').then(module => {
            module.loadStylesWhenNeeded();
        }).catch(error => {
            log.error('Failed to load CSS:', error);
        });
        
        // Mark initialization complete after a short delay to allow ComfyUI to finish setup
        requestAnimationFrame(() => {
            this._isInitializing = false;
            if (this._pendingCanvasUpdate) {
                this.requestCanvasUpdate(true);
            }
            log.debug('ResolutionMaster node UI ready', {
                nodeId: this.node.id ?? null,
                mode: this.node.properties.mode,
                width: this.node.properties.valueX,
                height: this.node.properties.valueY
            });
        });
    }
    
}

Object.assign(ResolutionMasterCanvas.prototype, nodeLifecycleMethods, canvasMethods, drawingMethods, calculationMethods, autoDetectMethods, interactionMethods);

app.registerExtension({
    name: "azResolutionMaster",
    async beforeRegisterNodeDef(nodeType, nodeData, _app) {
        if (nodeData.name === "ResolutionMaster") {
            log.debug('Registering ResolutionMaster node extension');
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function() {
                onNodeCreated?.apply(this, []);
                this.resolutionMaster = new ResolutionMasterCanvas(this);
            };
        }
    }
});
