<h1 align="center">ResolutionMaster – Precise resolution and aspect ratio control for ComfyUI</h1>


<p align="center"><i>ResolutionMaster A powerful and feature-rich ComfyUI custom node for precise resolution and aspect ratio control in AI image generation workflows. This node provides an intuitive interface with advanced scaling options, preset management, and model-specific optimizations.</i></p>

<p align="center">

<a href="https://registry.comfy.org/publishers/azornes/nodes/resolutionmaster" style="display:inline-flex; align-items:center; gap:6px;">
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


## Features

### 🎯 Core Functionality
- **Interactive 2D Canvas Control**: Visually select resolution with real-time preview
- **Multiple Input Modes**: Manual, Manual Sliders, Common Resolutions, and Aspect Ratios
- **Smart Rescaling**: Automatic calculation of rescale factors for upscaling workflows
- **Dimension Swapping**: Quick swap between width and height values
- **Snap to Grid**: Align dimensions to customizable grid increments (16px to 256px)

### 📐 Advanced Scaling Options
- **Manual Scale**: Direct multiplier control (0.1x to 4.0x)
- **Resolution Targeting**: Scale to standard resolutions (480p, 720p, 1080p, 1440p, 2160p, 4320p)
- **Megapixel Targeting**: Scale to specific megapixel counts (0.5 MP to 12 MP)
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

## Installation

1. Navigate to your ComfyUI custom nodes directory:
   ```
   ComfyUI/custom_nodes/
   ```

2. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/comfyui-resolution-master
   ```

3. Restart ComfyUI or reload custom nodes

## Usage

### Basic Operation

1. Add the "Resolution Master" node to your workflow
2. Connect the outputs to your image generation nodes:
   - `width`: Current width value
   - `height`: Current height value
   - `rescale_factor`: Calculated scale factor for upscaling

### Input Modes

#### Manual Mode
- Interactive 2D canvas for visual resolution selection
- Click and drag on the canvas to adjust both dimensions simultaneously
- Dots grid shows snap points
- Frame visualization shows the selected area

#### Manual Sliders Mode
- Independent horizontal sliders for width and height
- Precise control over each dimension
- Ideal for fine-tuning specific values

#### Common Resolutions Mode
- Dropdown selection of standard resolutions
- Quick access to commonly used dimensions

#### Aspect Ratios Mode
- Select from predefined aspect ratios
- Maintains proportions while adjusting scale

### Working with Presets

1. **Select a Category**: Choose from the dropdown (e.g., "SDXL", "Social Media")
2. **Choose a Preset**: Select specific aspect ratio or resolution
3. **Enable Custom Calc** (optional): Activates model-specific constraints
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
- **Adjustable Grid**: 16px to 256px increments
- **Smart Snapping**: Respects model constraints when Custom Calc is enabled

## Output Values

- **width** (INT): Selected width in pixels
- **height** (INT): Selected height in pixels  
- **rescale_factor** (FLOAT): Calculated scaling factor for achieving target resolution

### Rescale Factor Modes

The rescale factor adapts based on your selection:
- **Manual Mode**: Uses the manual scale slider value
- **Resolution Mode**: Calculates factor to reach target resolution
- **Megapixels Mode**: Calculates factor to reach target pixel count

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

## Technical Details

### File Structure
```
comfyui-resolution-master/
├── __init__.py
├── aztoolkit.py              # Python backend
├── js/
│   ├── ResolutionMaster.js     # Frontend interface
│   ├── css/
│   │   └── ultimate_aspect_ratio.css
│   └── utils/
│       ├── ResourceManager.js
│       └── LoggerUtils.js
└── README.md
```

### Requirements
- ComfyUI (latest version recommended)
- Modern web browser with Canvas support
- No additional Python dependencies required

## Node Properties

### Visible Properties
- `mode`: Selection mode (Manual/Sliders/Resolutions/Ratios)
- `width`: Current width value (64-4096px)
- `height`: Current height value (64-4096px)

### Hidden Properties
- `rescale_mode`: Current scaling method (manual/resolution/megapixels)
- `rescale_value`: Calculated rescale factor

### Internal Properties
- Min/Max ranges for X and Y axes
- Step values for grid snapping
- Decimal precision settings
- Visual options (dots, frame, snap)

## Troubleshooting

### Common Issues

**Q: The canvas doesn't appear**
- A: Ensure JavaScript is enabled and refresh the ComfyUI interface

**Q: Presets aren't loading**
- A: Check browser console for errors, clear cache if needed

**Q: Custom Calc isn't working**
- A: Make sure you've selected a compatible category (SDXL/Flux/WAN)

**Q: Dimensions reset unexpectedly**
- A: Check if Custom Calc is enforcing model constraints

## License

MIT License - See LICENSE file for details

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## Credits

Created by Azornes (2025)
Part of the azToolkit for ComfyUI

## Version History

- **v8.0.0** (2025): Complete rewrite with separate canvas implementation
  - Added model-specific optimizations
  - Improved preset system
  - Enhanced scaling options
  - Better visual feedback

## Support

For issues, questions, or suggestions, please open an issue on GitHub or contact through the ComfyUI community forums.
