<h1 align="center">ResolutionMaster – Precise resolution and aspect ratio control for ComfyUI</h1>


<p align="center"><i>ResolutionMaster A powerful and feature-rich ComfyUI custom node for precise resolution and aspect ratio control in AI image generation workflows. This node provides an intuitive interface with advanced scaling options, preset management, and model-specific optimizations.</i></p>

<p align="center">

<a href="https://registry.comfy.org/publishers/azornes/nodes/Comfyui-Resolution-Master" style="display:inline-flex; align-items:center; gap:6px;">
  <img alt="ComfyUI" src="https://img.shields.io/badge/ComfyUI-1a1a1a?style=for-the-badge&logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAMAAABF0y+mAAAASFBMVEVHcEwYLtsYLtkXLtkXLdkYLtkWLdcFIdoAD95uerfI1XLR3mq3xIP8/yj0/zvw/0FSYMP5/zKMmKQtPNOuuozj8FOhrZW7x4FMWFFbAAAABnRSTlMAUrPX87KxijklAAAA00lEQVR4AX3SBw6DMAxA0UzbrIzO+9+02GkEpoWP9hPZZs06Hw75aI3k4W/+wkQtnGZNhF1I34BzalQcxkmasY0b9raklNcvLYU1GNiiOeVWauOa/XS526gRyzpV/7HeUOG9Jp6vcsvUrCPeKg/3KBKBQhoTD1dQggPWzPVfFOIgo85/kR4y6oB/8SlIEh7wvmTuKd3wgLVW1sTfRBoR7oWVqy/U2NcrWDYMINE7NUuJuoV+2fhaWmnbjzcOWnRv7XbiLh/Y9dNUqk2y0QcNwTu7wgf+/BhsPUhf4QAAAABJRU5ErkJggg==" />
  <img alt="Downloads" src="https://img.shields.io/badge/dynamic/json?color=%230D2A4A&label=&query=downloads&url=https://gist.githubusercontent.com/Azornes/685c440e952c0eadfefc2ca10fc347dd/raw/top_resolutionmaster.json&style=for-the-badge" />
</a>
<a href='https://github.com/Azornes/Comfyui-Resolution-Master'>
  <img alt='GitHub Clones' src='https://img.shields.io/badge/dynamic/json?color=2F80ED&label=Clone&query=count&url=https://gist.githubusercontent.com/Azornes/dc1baa944bb2145d066bdf4e3f490cfc/raw/clone.json&logo=github&style=for-the-badge'>
</a>
  <a href="https://visitorbadge.io/status?path=https%3A%2F%2Fgithub.com%2FAzornes%2FComfyui-Resolution-Master">
    <img src="https://api.visitorbadge.io/api/combined?path=https%3A%2F%2Fgithub.com%2FAzornes%2FComfyui-Resolution-Master&countColor=%2337d67a&style=for-the-badge&labelStyle=none" />
  </a>
  <img alt="Python 3.10+" src="https://img.shields.io/badge/-Python_3.10+-4B8BBE?logo=python&logoColor=FFFFFF&style=for-the-badge&logoWidth=20">
  <img alt="JavaScript" src="https://img.shields.io/badge/-JavaScript-000000?logo=javascript&logoColor=F7DF1E&style=for-the-badge&logoWidth=20">
</p>


https://github.com/user-attachments/assets/587ea664-32b1-410b-bfa1-fba013f8e700


## Features

### 🎯 Core Functionality
- **Interactive 2D Canvas Control**: Visually select resolution with real-time preview
  - **Shift + Drag**: Preserves aspect ratio while dragging (with snap enabled)
  - **Ctrl + Drag**: Disables snap for fine-tuning without grid constraints
  - **Ctrl + Shift + Drag**: Preserves aspect ratio with 1px precision (no snap)
  - **Normal Drag**: Standard behavior with snap to grid
- **Smart Rescaling**: Automatic calculation of rescale factors for upscaling workflows
- **Snap to Grid**: Align dimensions to customizable grid increments (16px to 256px)
- **Real-time Info Display**: Shows current resolution, megapixels, p-value and aspect ratio
- **Visual Output Values**: Color-coded values at output slots (blue/pink/green)

### 📐 Advanced Scaling Options
- **Manual Scale**: Direct multiplier control (ex. 2.0x)
- **Resolution Targeting**: Scale to standard resolutions (ex. 480p, 720p, 1080p, 2160p)
- **Megapixel Targeting**: Scale to specific megapixel counts (ex. 5 MP)
- **Live Preview**: See resulting dimensions before applying changes

### 🎨 Preset Categories
Extensive preset library organized by use case:

- **Standard**: Common aspect ratios (1:1, 4:3, 16:9, 21:9, etc.)
- **SDXL**: Optimized resolutions for Stable Diffusion XL
- **Flux**: Flux model optimized presets with smart constraints
- **WAN**: Video model presets with resolution recommendations
- **Social Media**: Instagram, Twitter, Facebook, YouTube optimized sizes
- **Print**: Standard print formats (A4, Letter, photo sizes)
- **Cinema**: Professional film aspect ratios (2.39:1, 1.85:1, etc.)

### 🤖 Model-Specific Optimizations

#### SDXL Mode
- Enforces officially supported resolutions
- Fixed dimensions for optimal generation quality

#### Flux Mode
- 32px increment enforcement
- Resolution range: 320px to 2560px
- Maximum 4.0 megapixels constraint
- Sweet spot recommendation: 1920×1080

#### WAN Mode
- Flexible 320p to 820p range
- 16px increments for video encoding compatibility
- Automatic model recommendation (480p vs 720p)
- Maintains proper aspect ratios for video generation

---

## 🚀 Installation

### Install via ComfyUI-Manager
* Search `Comfyui-Resolution-Master` in ComfyUI-Manager and click `Install` button.

### Manual Install
1. Install [ComfyUi](https://github.com/comfyanonymous/ComfyUI).
2. Clone this repo into `custom_modules`:
    ```bash
    cd ComfyUI/custom_nodes/
    git clone https://github.com/Azornes/Comfyui-Resolution-Master.git
    ```
3. Start up ComfyUI.

---



3. Restart ComfyUI or reload custom nodes

## Usage

### Basic Operation

1. Add the "Resolution Master" node to your workflow
2. Connect the outputs to your image generation nodes:
   - `width`: Current width value
   - `height`: Current height value
   - `rescale_factor`: Calculated scale factor for upscaling

### Working with Presets

1. **Select a Category**: Choose from the dropdown (e.g., "SDXL", "Social Media")
2. **Choose a Preset**: Select specific aspect ratio or resolution
3. **Enable Custom Calc** (optional): Checkbox appears next to preset dropdown
   - Activates model-specific constraints
   - Automatically adjusts dimensions to model requirements
4. **Apply**: Dimensions are automatically updated

### Scaling Workflow

The node provides three scaling methods that work together:

1. **Set Base Resolution**: Use presets or manual input
2. **Choose Scaling Method**:
   - Manual: Direct multiplier
   - Resolution: Target specific output resolution
   - Megapixels: Target specific pixel count
3. **Apply Scale**: Updates dimensions while maintaining aspect ratio
4. **Use Rescale Factor**: Connect to upscaling nodes in your workflow

### Snap Functionality

- **Snap Button**: Rounds dimensions to nearest grid value
- **Adjustable Grid**: 16px to 256px increments (adjustable via slider)
- **Smart Snapping**: Respects model constraints when Custom Calc is enabled
- **Canvas Drag Modifiers**:
  - **Normal Drag**: Standard behavior with snap to grid
  - **Shift + Drag**: Preserves aspect ratio while dragging (with snap enabled)
  - **Ctrl + Drag**: Disables snap for fine-tuning without grid constraints
  - **Ctrl + Shift + Drag**: Preserves aspect ratio with 1px precision (no snap)

### Auto-Detect & Auto-Fit

- **Auto-Detect Toggle**: Automatically detects dimensions from connected images
  - Monitors input connection every second
  - Updates dimensions when new image is detected
  - Shows detected resolution in green text
- **Auto-Fit Button**: Intelligently matches detected dimensions to closest preset
  - Analyzes both aspect ratio and total pixels
  - Checks both normal and flipped orientations
  - Applies category-specific scaling when Custom Calc is enabled
- **Auto Checkbox**: Enable automatic fitting when dimensions change
  - Located next to Auto-Fit button
  - Only active when category is selected and image detected

## Output Values

- **width** (INT): Selected width in pixels
- **height** (INT): Selected height in pixels
- **rescale_factor** (FLOAT): Calculated scaling factor for external upscaling nodes
  - This value is used when you want to upscale/downscale your image using external nodes
  - Changes based on selected scaling mode (manual scale, resolution target, or megapixels target)
  - Connect this output to upscaling nodes in your workflow for resolution-independent scaling

Values are shown directly at output slots for quick reference.

### Rescale Factor Modes

The rescale factor adapts based on your selection (choose via radio buttons):
- **Manual Mode**: Uses the manual scale slider value (adjustable 0.1x to 4.0x)
- **Resolution Mode**: Calculates factor to reach target resolution (p-value based)
- **Megapixels Mode**: Calculates factor to reach target pixel count (0.5 to 6.0 MP)

Each scaling row shows:
- Control button for immediate application (⬆, 📺, 📷)
- Adjustment method (slider/dropdown)
- Calculated scale factor
- Preview of resulting dimensions
- Radio button to set as active rescale mode

## Examples

### Example 1: SDXL Portrait Generation
1. Select "SDXL" category
2. Choose "3:4 Portrait (768×1024)"
3. Enable "Custom Calc" for SDXL optimization
4. Connect to your SDXL workflow

### Example 2: Social Media Content
1. Select "Social Media" category
2. Choose "Instagram Square (1080×1080)"
3. Use resolution scaling to target 2160p for high quality
4. Apply rescale factor in upscaling node

### Example 3: Flux Model Generation
1. Select "Flux" category
2. Enable "Custom Calc" for automatic constraints
3. Choose any preset - dimensions auto-adjust to Flux requirements
4. Node enforces 32px increments and 4MP limit

## Tips & Best Practices

1. **Start with Presets**: Use category presets as starting points, then fine-tune
2. **Enable Custom Calc**: For SDXL, Flux, and WAN models to ensure compatibility
3. **Use Snap for Clean Values**: Helps avoid odd dimensions that may cause issues
4. **Monitor Info Messages**: Pay attention to mode-specific recommendations
5. **Leverage Rescale Factor**: Connect to upscaling nodes for resolution-independent workflows

### Working with High Resolutions (Above 2K)

The node now supports outputs up to 32K resolution. When working with very high resolutions:

- **Visual Representation**: The 2D canvas may appear distorted at extreme resolutions as it's optimized for the default 2048x2048 range
- **Actual Outputs**: The width/height outputs maintain correct aspect ratios regardless of canvas appearance
- **Solution**: Use the Properties panel to adjust `canvas_max_x` and `canvas_max_y` values to match your working resolution range
  - Example: For 8K work, set both to 8192
  - Example: For 32K work, set both to 32768
- This adjustment fixes the visual representation while maintaining accurate output values

### Internal Properties
- **canvas_min_x/y**: Minimum values for X and Y axes (default: 0)
- **canvas_max_x/y**: Maximum values for X and Y axes (default: 2048, adjustable up to 32768)
- **canvas_step_x/y**: Step values for grid snapping
- **canvas_decimals_x/y**: Decimal precision settings
- **Visual options**: dots, frame, snap toggles
## ⚠️ Known Issues / Compatibility

- **Conflict with comfyui-mixlab-nodes**  
  Some users have reported that the *Resolution Master* node appears completely blank when added to the canvas.  
  This issue is caused by a conflict with **comfyui-mixlab-nodes**.  

  ✅ Temporary Fix: Disable or uninstall `comfyui-mixlab-nodes` – the node will then display and work correctly.  
  ❌ Unfortunately, I cannot reproduce this bug on my end, since with my setup both node packs work fine together.  
  Until a proper fix is found, the only workaround is disabling `comfyui-mixlab-nodes`.  


## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## 💖 Support / Sponsorship

If you’d like to support my work:  
👉 [GitHub Sponsors](https://github.com/sponsors/Azornes)
