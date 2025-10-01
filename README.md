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
  - **Normal Drag**: Standard behavior with snap to canvas grid (controlled by `canvas_step_x/y`)
  - **Shift + Drag**: Preserves aspect ratio while dragging (with snap enabled)
  - **Ctrl + Drag**: Disables snap for fine-tuning without grid constraints
  - **Ctrl + Shift + Drag**: Preserves aspect ratio with 1px precision (no snap)
- **Smart Rescaling**: Automatic calculation of rescale factors for upscaling workflows
- **Snap Button**: Round current dimensions to the snap value (NOT related to 2D canvas grid)
- **Real-time Info Display**: Shows current resolution, megapixels, p-value and aspect ratio
- **Visual Output Values**: Color-coded clickable values at output slots (blue/pink/green)

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
- **HiDream Dev**: HiDream model optimized presets
- **Qwen-Image**: Qwen-Image model optimized presets
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

#### HiDream Dev Mode
- Preset-based optimization system
- Uses closest matching preset from HiDream Dev category
- Automatically selects best preset based on input dimensions and aspect ratio
- Supports both original and flipped orientations for optimal matching

#### Qwen-Image Mode
- Resolution range: ~0.6MP to 4.2MP (589,824 to 4,194,304 pixels)
- Smart scaling: If input is already within range, dimensions remain unchanged
- Automatic scaling: Input outside range is scaled to fit while maintaining aspect ratio
- Preserves original dimensions when already optimized

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
   - `width`: Current width value (click the blue number to set custom width)
   - `height`: Current height value (click the pink number to set custom height)
   - `rescale_factor`: Calculated scale factor for upscaling (green number)

### Workflow Examples

#### Example 1: Image Resizing Workflow
If you want to resize an input image using Resolution Master:

1. **Load Image**: Add a "Load Image" node and connect your image.
2. **Connect to Resolution Master**: Link the image output to the input of Resolution Master (enables Auto-Detect).
3. **Configure Resolution Master**:
   - Enable **Auto-Detect** toggle to read input image dimensions.
   - Select a preset or set target resolution/aspect ratio.
   - Use **Auto-Fit** or **Auto-Resize** for automatic adaptation.
4. **Resize Image**: Connect Resolution Master's `width` and `height` outputs to a "Resize Image" node's width/height inputs.
5. **Connect Image**: Link the original image from "Load Image" to the "Resize Image" node's image input.
6. **Output**: The resized image will match your target specifications.

**Note**: Resolution Master doesn't process images directly—it calculates dimensions. Always connect it to a resizing node (like "Resize Image") for actual image transformation.

#### Example 2: Generation Workflow
For new image generation:
1. Connect Resolution Master's `width`/`height` to your sampler/checkpoint nodes.
2. Use `rescale_factor` with upscaling nodes if needed.
3. Enable Auto-Detect if using an input image as reference.

## 🎮 Understanding the Controls

### Actions Section
- **⇄ Swap Button**: Swaps width and height values
- **⊞ Snap Button**: Rounds the current width/height to the nearest snap value (e.g., if snap=64 and width=520, clicking Snap makes it 512)
- **Snap Value Slider**: Sets the value used by the Snap button (16-256px). **Important**: This does NOT change the 2D canvas grid behavior!

### 2D Canvas
- **White Dot**: Drag to set resolution visually
- **Grid Dots**: Visual guides controlled by `canvas_step_x/y` properties (NOT by the snap slider)
- **Blue Rectangle**: Shows current resolution selection

### Scaling Section
- **⬆ Manual Scale Button**: Applies the manual scale factor to current dimensions
- **📺 Resolution Button**: Scales to target resolution (e.g., 1080p)
- **📷 Megapixels Button**: Scales to target megapixel count
- **Radio Buttons**: Select which scaling mode affects the `rescale_factor` output

### Auto-Detect Section
- **Auto-detect Toggle**: ON/OFF switch for automatic dimension detection from connected images
  - Monitors input connection every second
  - Updates dimensions when new image is detected
  - Shows detected resolution in green text
- **🎯 Auto-fit Button**: Finds best matching preset for current dimensions
  - Analyzes both aspect ratio and total pixels
  - Checks both normal and flipped orientations
  - Applies category-specific scaling when Custom Calc is enabled
- **Auto Checkbox**: Enable automatic fitting when dimensions change
  - Located next to Auto-Fit button
  - Only active when category is selected and image detected
- **📐 Auto-Resize Button**: Applies scaling based on selected mode (Manual/Resolution/Megapixels)
  - Integrates with active scaling mode from Scaling section
  - Maintains manual scale value without reset to 1.0x
- **Auto Checkbox**: Automatically apply scaling when new image is detected
  - Works in sequence after Auto-fit (if enabled)
  - Applies chosen scaling mode to detected dimensions
- **Detected Text (green)**: Click to apply the detected image's original dimensions
- **⚡ Auto-calc Button**: Applies model-specific calculations to current dimensions
- **Calc Checkbox**: Enables automatic model-specific optimizations

### Presets Section
- **Category Dropdown**: Select preset category (Standard, SDXL, Flux, etc.)
- **Preset Dropdown**: Choose specific preset from selected category

## 🔧 Node Properties Configuration

You can customize various parameters by accessing the node's Properties panel in ComfyUI. Here's a complete list of all configurable properties:

### Canvas Properties
- **`canvas_min_x`** / **`canvas_min_y`**: Minimum values for X and Y axes (default: 0)
- **`canvas_max_x`** / **`canvas_max_y`**: Maximum values for X and Y axes (default: 2048, max: 32768)
  - Increase these for working with higher resolutions (e.g., 8192 for 8K)
- **`canvas_step_x`** / **`canvas_step_y`**: Grid snap increments for the 2D canvas (default: 64)
  - This controls the grid dots and snap behavior when dragging on the 2D canvas
  - **NOT** controlled by the snap slider in the Actions section
- **`canvas_decimals_x`** / **`canvas_decimals_y`**: Decimal precision for X/Y values (default: 0)
- **`canvas_snap`**: Enable/disable grid snapping on 2D canvas (default: true)
- **`canvas_dots`**: Show/hide grid dots on 2D canvas (default: true)
- **`canvas_frame`**: Show/hide the blue selection frame (default: true)

### Action Sliders Range
- **`action_slider_snap_min`**: Minimum value for snap slider (default: 16)
- **`action_slider_snap_max`**: Maximum value for snap slider (default: 256)
- **`action_slider_snap_step`**: Step increment for snap slider (default: 16)

### Scaling Sliders Range
- **`scaling_slider_min`**: Minimum manual scale factor (default: 0.1)
- **`scaling_slider_max`**: Maximum manual scale factor (default: 4.0)
- **`scaling_slider_step`**: Step increment for scale slider (default: 0.1)
- **`megapixels_slider_min`**: Minimum megapixels target (default: 0.5)
- **`megapixels_slider_max`**: Maximum megapixels target (default: 6.0)
- **`megapixels_slider_step`**: Step increment for megapixels slider (default: 0.1)

### Section Collapse States
- **`section_actions_collapsed`**: Actions section collapsed state (default: false)
- **`section_scaling_collapsed`**: Scaling section collapsed state (default: false)
- **`section_autoDetect_collapsed`**: Auto-Detect section collapsed state (default: false)
- **`section_presets_collapsed`**: Presets section collapsed state (default: false)

### Example: Customizing for 8K Workflow
1. Right-click on the ResolutionMaster node
2. Select "Properties"
3. Set `canvas_max_x` and `canvas_max_y` to 8192
4. Set `canvas_step_x` and `canvas_step_y` to 128 for larger grid increments
5. Set `manual_slider_max_w` and `manual_slider_max_h` to 8192

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

## 🔧 Understanding rescale_factor Behavior

**Important**: The `rescale_factor` output is **not** a simple "scale from input" value. It's a **workflow control parameter** designed for professional ComfyUI pipelines.

### How rescale_factor Actually Works

The `rescale_factor` represents your **scaling intent** for downstream nodes (like upscalers), not the relationship between input and current resolution.

#### Key Concepts:

1. **Base Resolution**: The current width/height values (set manually, via presets, or auto-detected)
2. **Scaling Intent**: What you want to achieve (manual scale, target resolution, or target megapixels)
3. **rescale_factor**: The calculated multiplier to achieve your scaling intent

#### Three Scaling Modes Control rescale_factor:

- **Manual Mode**: Uses the manual scale slider value (0.1x to 4.0x)
- **Resolution Mode**: Calculates factor to reach target resolution (p-value based)
- **Megapixels Mode**: Calculates factor to reach target pixel count (0.5 to 6.0 MP)

### Common Misconceptions

❌ **Wrong**: "rescale_factor should reset to 1.0 when I connect a new image"
✅ **Correct**: rescale_factor maintains your scaling intent regardless of input changes

❌ **Wrong**: "rescale_factor should show the ratio between input and current resolution"
✅ **Correct**: rescale_factor shows the multiplier needed to achieve your target scaling

### Practical Example

```
Workflow Setup:
1. Connect 512×512 image → auto-detect sets base resolution to 512×512
2. Set resolution target to 1080p → rescale_factor calculates ~2.81x
3. Connect different 1024×1024 image → base resolution updates to 1024×1024
4. rescale_factor recalculates to ~1.41x (to still reach 1080p target)
```

**Why this happens**: Your scaling intent (reach 1080p) remains constant, but the required multiplier changes based on the new input resolution.

### Auto-Detect + Scaling Workflow

When using auto-detect with scaling:

1. **Auto-detect updates base resolution** from connected images
2. **Your scaling mode remains active** (manual/resolution/megapixel)
3. **rescale_factor recalculates** to maintain your scaling intent
4. **Canvas drag operations** update base resolution but preserve scaling intent

This design allows **resolution-independent workflows** where you can swap input images without breaking your scaling logic.

### Canvas Drag Behavior

When dragging the canvas with different modifiers:

- **Normal Drag**: Updates base resolution, rescale_factor adjusts to maintain scaling intent
- **Shift + Drag**: Preserves aspect ratio, rescale_factor adjusts accordingly
- **Ctrl + Drag**: Fine-tuning without snap, rescale_factor adjusts
- **Ctrl + Shift + Drag**: Precise aspect ratio control, rescale_factor adjusts

The rescale_factor **always reflects your active scaling mode**, not the drag operation itself.

## Examples

### Example 1: Understanding Snap Button vs Canvas Grid
**Snap Button (Actions Section)**:
- Current resolution: 520×380
- Snap value slider: 64
- Click Snap button → Resolution becomes 512×384 (rounded to nearest 64)

**2D Canvas Grid** (controlled by properties):
- `canvas_step_x` = 32, `canvas_step_y` = 32
- When dragging on canvas, resolution snaps to 32px increments
- The snap slider does NOT affect this - only `canvas_step_x/y` properties do!

### Example 2: SDXL Portrait Generation
1. Select "SDXL" category
2. Choose "3:4 Portrait (768×1024)"
3. Enable "Custom Calc" for SDXL optimization
4. Connect to your SDXL workflow

### Example 3: Social Media Content
1. Select "Social Media" category
2. Choose "Instagram Square (1080×1080)"
3. Use resolution scaling to target 2160p for high quality
4. Apply rescale factor in upscaling node

### Example 4: Flux Model Generation
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
  👉 Until a proper fix is implemented in `comfyui-mixlab-nodes`, the only workaround is disabling `comfyui-mixlab-nodes` or manual patch (see below).  

<details>
<summary>🔧 Advanced explanation and manual patch (click to expand)</summary>

If you *really* want or need to use comfyui-mixlab-nodes despite this, here’s the deal:  

The problem occurs because **mixlab overrides the `onDrawForeground` method of other nodes**, which breaks their display. This behavior is, frankly, unacceptable since it hijacks a method other nodes legitimately rely on. The good news is that mixlab only uses this override if the method is defined in the prototype, which means we can adjust it safely.  

### ✅ Patch  
In `ui_mixlab.js` (see [source line here](https://github.com/shadowcz007/comfyui-mixlab-nodes/blob/67c974c96e6472316cb4bf4326281d9f86a25ae6/web/javascript/ui_mixlab.js#L2186C11-L2186C55)), replace this part:  

```js
const orig = node.__proto__.onDrawForeground;
```

with this safer version:  

```js
const orig = node.onDrawForeground ?? node.__proto__.onDrawForeground;
```

With this modification, the Resolution Master node (and potentially other affected nodes) will render correctly again.  
You can either apply this tweak manually or report it to the mixlab authors so it can be properly integrated upstream.  

📌 Full discussion and context are available here:  
[github.com/Smirnov75/ComfyUI-mxToolkit/issues/28#issuecomment-2603091317](https://github.com/Smirnov75/ComfyUI-mxToolkit/issues/28#issuecomment-2603091317)

</details>


## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## 💖 Support / Sponsorship

If you’d like to support my work:  
👉 [GitHub Sponsors](https://github.com/sponsors/Azornes)
