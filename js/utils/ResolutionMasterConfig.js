// Configuration file for ResolutionMaster
// Contains tooltips and preset categories to reduce main file size

export const tooltips = {
    // Primary controls (excluding sliders and 2D canvas)
    swapBtn: "Swap width and height values",
    snapBtn: "Snap current resolution to the nearest snap value",
    snapValueArea: "Click to set custom snap value",
    
    // Output value areas (editable)
    widthValueArea: "Click to set custom width value",
    heightValueArea: "Click to set custom height value",
    
    // Scaling controls (buttons and dropdowns only)
    scaleBtn: "Apply manual scaling factor and reset to 1.0x",
    upscaleRadio: "Use manual scaling mode for rescale output",
    scaleValueArea: "Click to set custom scale value (e.g., 2.5x)",
    
    resolutionBtn: "Scale to target resolution (e.g., 1080p)",
    resolutionDropdown: "Select target resolution for scaling",
    resolutionRadio: "Use resolution-based scaling for rescale output",
    resolutionValueArea: "Click to set custom resolution scale factor",
    
    megapixelsBtn: "Scale to target megapixel count",
    megapixelsRadio: "Use megapixel-based scaling for rescale output",
    megapixelsValueArea: "Click to set custom megapixel value (e.g., 3.5MP)",
    
    // Auto-detect controls
    autoDetectToggle: "Automatically detect resolution from connected image input",
    autoFitBtn: "Find and apply best preset match for current resolution",
    autoFitCheckbox: "Automatically find and apply the best preset for the new detected image resolution",
    autoResizeBtn: "Apply scaling based on selected mode (Manual/Resolution/Megapixels)",
    autoResizeCheckbox: "Automatically apply scaling when new image is detected",
    detectedInfo: "Click to apply detected image resolution directly",
    
    // Preset controls
    categoryDropdown: "Select preset category (Standard, SDXL, Flux, HiDream Dev, Qwen-Image, etc.)",
    presetDropdown: "Choose specific preset from selected category",
    customCalcCheckbox: "Automatically apply model-specific optimizations for the new detected image resolution (read orange information below)",
    autoCalcBtn: "Apply model-specific optimizations for current resolution (read orange information below)",
    
    // Section headers
    actionsHeader: "Click to collapse/expand Actions section",
    scalingHeader: "Click to collapse/expand Scaling section",
    autoDetectHeader: "Click to collapse/expand Auto-Detect section",
    presetsHeader: "Click to collapse/expand Presets section"
};

export const presetCategories = {
    'Standard': {
        '1:1 Square': { width: 512, height: 512 },
        '1:2 Tall': { width: 512, height: 1024 },
        '1:3 Ultra Tall': { width: 512, height: 1536 },
        '2:3 Portrait': { width: 512, height: 768 },
        '3:4 Portrait': { width: 576, height: 768 },
        '4:5 Portrait': { width: 512, height: 640 },
        '4:7 Phone': { width: 512, height: 896 },
        '5:12 Banner': { width: 512, height: 1228 },
        '7:9 Vertical': { width: 512, height: 658 },
        '9:16 Mobile': { width: 576, height: 1024 },
        '9:21 Ultra Mobile': { width: 512, height: 1194 },
        '10:16 Monitor': { width: 640, height: 1024 },
        '13:19 Tall Screen': { width: 512, height: 748 },
        '3:2 Landscape': { width: 768, height: 512 },
        '4:3 Classic': { width: 512, height: 384 },
        '16:9 Widescreen': { width: 768, height: 432 },
        '21:9 Ultrawide': { width: 1024, height: 439 }
    },
    'SDXL': {
        '1:1 Square': { width: 1024, height: 1024 },
        '3:4 Portrait': { width: 768, height: 1024 },
        '4:5 Portrait': { width: 915, height: 1144 },
        '5:12 Portrait': { width: 640, height: 1536 },
        '7:9 Portrait': { width: 896, height: 1152 },
        '9:16 Portrait': { width: 768, height: 1344 },
        '13:19 Portrait': { width: 832, height: 1216 },
        '3:2 Landscape': { width: 1254, height: 836 }
    },
    'Flux': {
        '1:1 Square': { width: 1024, height: 1024 },
        '2:3 Portrait': { width: 832, height: 1248 },
        '3:4 Portrait': { width: 896, height: 1184 },
        '4:5 Portrait': { width: 928, height: 1152 },
        '9:16 Portrait': { width: 768, height: 1344 },
        '9:21 Portrait': { width: 672, height: 1440 },
    },
    'WAN': {
       // Community Presets
       '16:9 Landscape': { width: 1280, height: 720 },
       '16:9 Landscape': { width: 832, height: 480 },
       '1:1 Square': { width: 512, height: 512 },
       '1:1 Square': { width: 768, height: 768 },
       // Original Presets
       '1:1 Square': { width: 720, height: 720 },
       '2:3 Portrait': { width: 588, height: 882 },
       '3:4 Portrait': { width: 624, height: 832 },
       '9:21 Portrait': { width: 549, height: 1280 },
       '3:2 Landscape': { width: 1080, height: 720 },
       '4:3 Landscape': { width: 960, height: 720 },
       '21:9 Landscape': { width: 1680, height: 720 }
    },
    'HiDream Dev': {
        '1:1 Square': { width: 1024, height: 1024 },
        '1:1 Square Large': { width: 1280, height: 1280 },
        '1:1 Square XL': { width: 1536, height: 1536 },
        '16:9 Landscape': { width: 1360, height: 768 },
        '3:2 Landscape': { width: 1248, height: 832 },
        '4:3 Landscape': { width: 1168, height: 880 },
    },
    'Qwen-Image': {
        '1:1 Square (Default)': { width: 1328, height: 1328 },
        '16:9 Landscape': { width: 1664, height: 928 },
        '4:3 Landscape': { width: 1472, height: 1140 },
        '3:2 Landscape': { width: 1584, height: 1056 },
        '1:1 Test': { width: 1024, height: 1024 },
        '4:3 Test': { width: 768, height: 1024 }
    },
    'Social Media': {
        // Instagram
        'Instagram Square': { width: 1080, height: 1080 },
        'Instagram Portrait': { width: 1080, height: 1350 },
        'Instagram Landscape': { width: 1080, height: 566 },
        'Instagram Stories/Reels': { width: 1080, height: 1920 },
        'Instagram Profile': { width: 320, height: 320 },
        
        // Facebook
        'Facebook Post': { width: 1200, height: 630 },
        'Facebook Cover Page': { width: 820, height: 312 },
        'Facebook Cover Event': { width: 1920, height: 1005 },
        'Facebook Personal Cover': { width: 1200, height: 445 },
        'Facebook Profile': { width: 180, height: 180 },
        'Facebook Stories': { width: 1080, height: 1920 },
        
        // X (Twitter)
        'Twitter Post': { width: 1200, height: 675 },
        'Twitter Header': { width: 1500, height: 500 },
        'Twitter Profile': { width: 400, height: 400 },
        
        // YouTube
        'YouTube Thumbnail': { width: 1280, height: 720 },
        'YouTube Banner': { width: 2560, height: 1440 },
        'YouTube Channel Icon': { width: 800, height: 800 },
        'YouTube Shorts': { width: 1080, height: 1920 },
        
        // LinkedIn
        'LinkedIn Post': { width: 1200, height: 627 },
        'LinkedIn Cover Profile': { width: 1584, height: 396 },
        'LinkedIn Company Logo': { width: 300, height: 300 },
        'LinkedIn Company Background': { width: 1128, height: 191 },
        
        // TikTok
        'TikTok Video': { width: 1080, height: 1920 },
        'TikTok Profile': { width: 200, height: 200 },
        
        // Pinterest
        'Pinterest Standard Pin': { width: 1000, height: 1500 },
        'Pinterest Max Pin': { width: 1000, height: 2100 },
        'Pinterest Profile': { width: 165, height: 165 },
        'Pinterest Board Cover': { width: 222, height: 150 },
        
        // Snapchat
        'Snapchat Story/Ads': { width: 1080, height: 1920 },
        'Snapchat Profile': { width: 1080, height: 1080 }
    },
    'Print': {
        // ISO Standards (Europe, World)
        'A3 Portrait': { width: 3508, height: 4961 },
        'A4 Portrait': { width: 2480, height: 3508 },
        'A4 Landscape': { width: 3508, height: 2480 },
        'A5 Portrait': { width: 1748, height: 2480 },
        'A6 Portrait': { width: 1240, height: 1748 },
        'Business Card EU': { width: 1004, height: 590 },
        
        // North American Standards
        'Letter Portrait': { width: 2550, height: 3300 },
        'Legal Portrait': { width: 2550, height: 4200 },
        'Tabloid': { width: 3300, height: 5100 },
        
        // Photo Print Standards
        '4x6 Photo': { width: 1200, height: 1800 },
        '5x7 Photo': { width: 1500, height: 2100 },
        '8x10 Photo': { width: 2400, height: 3000 },
        '11x14 Photo': { width: 3300, height: 4200 },
        '16x20 Photo': { width: 4800, height: 6000 },
        '20x24 Photo': { width: 6000, height: 7200 }
    },
    'Cinema': {
        // DCI Standards
        'DCI 2K Flat': { width: 1998, height: 1080 },
        'DCI 2K Scope': { width: 2048, height: 858 }, // professional DCI anamorphic
        'DCI 4K Flat': { width: 3996, height: 2160 },
        'DCI 4K Scope': { width: 4096, height: 1716 },
        'DCI Full 2K': { width: 2048, height: 1080 },
        'DCI Full 4K': { width: 4096, height: 2160 },
        
        // IMAX Formats
        'IMAX Digital': { width: 4096, height: 3020 }, // example resolution, varies by source
        'IMAX 1.90:1': { width: 4096, height: 2160 },
        
        // Classic Cinema Formats (approximate digital equivalents)
        'Ultra Panavision 70': { width: 7680, height: 2782 }, // approximate digital equivalent
        'Cinerama': { width: 7680, height: 2965 }, // approximate digital equivalent
        'Academy 1.375:1': { width: 1378, height: 1000 }, // simplified variant
        'Academy Original': { width: 1474, height: 1072 }, // closer to original
        'Silent Film 1.33:1': { width: 1440, height: 1080 }, // modern transfer standard
        'Silent Film Classic': { width: 1334, height: 1000 }, // classic variant
        
        // Legacy Formats
        '2.39:1 Anamorphic': { width: 2048, height: 858 }, // general anamorphic (same as DCI Scope)
        '1.85:1 Standard': { width: 1998, height: 1080 },
        '2:1 Univisium': { width: 2048, height: 1024 },
        '4:3 Academy': { width: 1440, height: 1080 },
        '1.33:1 Classic': { width: 1436, height: 1080 }
    },
    'Display Resolutions': {
        'CIF': { width: 352, height: 288 },
        'SVGA': { width: 800, height: 600 },
        'XGA': { width: 1024, height: 768 },
        'SXGA': { width: 1280, height: 1024 },
        'WXGA': { width: 1366, height: 768 },
        'WSXGA+': { width: 1680, height: 1050 },
        '240p': { width: 426, height: 240 },
        '360p': { width: 640, height: 360 },
        '480p SD': { width: 854, height: 480 },
        '540p qHD': { width: 960, height: 540 },
        '720p HD': { width: 1280, height: 720 },
        '900p HD+': { width: 1600, height: 900 },
        '1080p Full HD': { width: 1920, height: 1080 },
        'UWFHD': { width: 2560, height: 1080 },
        '1200p WUXGA': { width: 1920, height: 1200 },
        '1440p QHD': { width: 2560, height: 1440 },
        'UWQHD': { width: 3440, height: 1440 },
        '1600p UXGA': { width: 2560, height: 1600 },
        '1800p QHD+': { width: 3200, height: 1800 },
        '4K UHD': { width: 3840, height: 2160 },
        'UW4K (5K2K)': { width: 5120, height: 2160 },
        '5K': { width: 5120, height: 2880 },
        '6K': { width: 6016, height: 3384 },
        '8K UHD': { width: 7680, height: 4320 }
    }
};
