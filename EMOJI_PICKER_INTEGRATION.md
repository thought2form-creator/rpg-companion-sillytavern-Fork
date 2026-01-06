# Emoji Picker Integration

## Overview

The RPG Companion extension now features **smart emoji picker integration** that automatically detects and uses the professional [Extension-EmojiPicker](https://github.com/SillyTavern/Extension-EmojiPicker) if installed, while gracefully falling back to a custom picker if not available.

## Features

### With Extension-EmojiPicker Installed ⭐
- **1000+ emojis** organized by category (Smileys, People, Nature, Food, etc.)
- **Search functionality** - Type to find emojis (e.g., "heart", "sword")
- **Skin tone selection** - For people emojis
- **Recent emojis** - Remembers frequently used emojis
- **Multi-language support** - 20+ languages
- **Custom emoji support** - Via emoji-mart's built-in API
- **Professional UI** - Consistent with SillyTavern's design

### Without Extension-EmojiPicker (Fallback)
- **140+ curated emojis** - Hand-picked for RPG use
- **Themed design** - Matches RPG Companion's visual style
- **Thought bubble styling** - Consistent with extension aesthetics
- **Smart positioning** - Automatically adjusts to screen edges

## Installation

### Option 1: Enhanced Experience (Recommended)

1. Install the Extension-EmojiPicker:
   - Open SillyTavern
   - Go to Extensions → Install Extension
   - Paste: `https://github.com/SillyTavern/Extension-EmojiPicker`
   - Click Install

2. The RPG Companion will automatically detect and use it!

### Option 2: Standalone

The RPG Companion works perfectly fine without Extension-EmojiPicker. The custom emoji picker will be used automatically.

## How It Works

### Detection Logic

When you click an emoji field, the system:

1. **Checks** if emoji-mart's `Picker` class is available globally
2. **If found**: Loads emoji-mart data from CDN and creates a professional picker
3. **If not found**: Falls back to the custom thought-bubble picker

### Technical Details

```javascript
// Main entry point
export async function openEmojiPicker($input) {
    // Try emoji-mart first
    if (typeof Picker !== 'undefined') {
        return await openEmojiMartPicker($input);
    }
    // Fallback to custom picker
    return openCustomEmojiPicker($input);
}
```

### Where It's Used

The emoji picker is available in:
- **Tracker Editor** → Present Characters → Relationship status emojis
- **Character Editor** → Character emoji fields
- **Encounter Modal** → Entity status emojis

## Troubleshooting

### Emoji picker not appearing?
- Check browser console (F12) for errors
- Ensure you're clicking on an emoji input field
- Try refreshing SillyTavern

### Still seeing the basic picker?
- The Extension-EmojiPicker may not be installed
- Check Extensions → Manage Extensions to verify installation
- The fallback picker is working as intended!

### emoji-mart fails to load?
- Check your internet connection (CDN access required)
- The system will automatically fall back to the custom picker
- Check console for specific error messages

## For Developers

### Adding Emoji Picker to New Fields

```javascript
import { openEmojiPicker } from './trackerEditor.js';

// For input fields
$('.my-emoji-input').on('click', function(e) {
    e.preventDefault();
    openEmojiPicker($(this));
});

// For contenteditable elements
$('.my-emoji-div').on('click', function(e) {
    e.preventDefault();
    const $tempInput = $('<input type="text">');
    $tempInput.val($(this).text());
    
    $tempInput.on('blur', function() {
        $('.my-emoji-div').text($(this).val());
        $tempInput.remove();
    });
    
    openEmojiPicker($tempInput);
});
```

### Customizing emoji-mart Options

Edit `openEmojiMartPicker()` in `src/systems/ui/trackerEditor.js`:

```javascript
const picker = new Picker({
    data: data,
    onEmojiSelect: (emoji) => { /* ... */ },
    theme: 'auto',              // 'auto', 'light', 'dark'
    previewPosition: 'none',    // 'none', 'top', 'bottom'
    skinTonePosition: 'search', // 'search', 'preview', 'none'
    maxFrequentRows: 2,         // Number of recent emoji rows
    perLine: 8,                 // Emojis per row
    navPosition: 'bottom',      // 'top', 'bottom', 'none'
    searchPosition: 'sticky',   // 'sticky', 'static', 'none'
});
```

## Benefits

✅ **No Breaking Changes** - Works with or without Extension-EmojiPicker  
✅ **Better UX** - Professional picker when available  
✅ **Maintained** - emoji-mart is actively maintained  
✅ **Consistent** - Same picker across all SillyTavern extensions  
✅ **Graceful Degradation** - Always works, even offline  

## Credits

- **emoji-mart**: https://github.com/missive/emoji-mart
- **Extension-EmojiPicker**: https://github.com/SillyTavern/Extension-EmojiPicker
- **RPG Companion**: Custom fallback picker implementation

