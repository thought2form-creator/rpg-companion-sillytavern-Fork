# Custom Emojis for RPG Companion

This folder allows you to add custom emoji images that will appear in the emoji picker when editing relationship status fields.

## How to Add Custom Emojis

### Step 1: Add Your Images
Place your custom emoji image files in this folder. Supported formats:
- PNG (recommended for transparency)
- JPG/JPEG
- GIF (animated gifs supported)
- WEBP
- SVG

**Recommended image size:** 32x32 to 128x128 pixels

### Step 2: Update the Manifest
Edit the `manifest.json` file to list your custom emojis:

```json
{
  "emojis": [
    {
      "name": "My Custom Heart",
      "file": "custom-heart.png"
    },
    {
      "name": "Special Star",
      "file": "special-star.gif"
    },
    {
      "name": "Unique Symbol",
      "file": "symbol.webp"
    }
  ]
}
```

- **name**: Display name (shown as tooltip on hover)
- **file**: Filename of the image in this folder

### Step 3: Reload
After adding images and updating the manifest:
1. Save your changes
2. Reload SillyTavern or refresh the page
3. Open the emoji picker in Edit Trackers → Present Characters tab
4. Your custom emojis will appear in the "Custom" section at the top

## Tips

- Keep file sizes small (under 100KB) for best performance
- Use transparent backgrounds (PNG) for better integration
- Square images work best (1:1 aspect ratio)
- Descriptive filenames help with organization
- Custom emojis appear before standard emojis in the picker

## Example Structure

```
custom-emojis/
├── manifest.json
├── README.md
├── heart-gold.png
├── star-rainbow.gif
└── sword-legendary.webp
```

## Troubleshooting

**Custom emojis not showing?**
- Check that `manifest.json` is valid JSON (use a JSON validator)
- Verify image filenames match exactly (case-sensitive)
- Make sure images are in the `custom-emojis` folder
- Check browser console for errors (F12)

**Images look blurry?**
- Use higher resolution images (64x64 or 128x128)
- Avoid upscaling small images

**Need more help?**
Check the main extension documentation or open an issue on GitHub.

