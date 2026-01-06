# Prompt Builder Implementation Summary

## What We Built

A complete **modular prompt assembly system** with a **central configuration UI** for the RPG Companion extension.

## Components Created

### 1. Modular Prompt System (`src/systems/generation/modular-prompt-system/`)

**Core Modules:**
- `section.js` - Section and SectionCollection classes for managing prompt pieces
- `template.js` - Template processing that preserves `{{STMacros}}`
- `assembler.js` - Core prompt assembly engine with priority-based ordering
- `settings-adapter.js` - Integration with extensionSettings (auto-save/load)
- `sender.js` - ConnectionManager integration (already existed)
- `index.js` - Public API and PromptBuilder class
- `README.md` - Complete documentation

**Key Features:**
✅ Modular sections with priority-based ordering
✅ Template processing: `{placeholders}` replaced, `{{macros}}` preserved
✅ Auto-save to extensionSettings on every change
✅ Profile/preset support (save/load/delete)
✅ Reusable across multiple components
✅ UI-driven (all logic exposed through settings)

### 2. Central Prompt Builder UI (`src/systems/ui/promptBuilderUI.js`)

**UI Features:**
- Component selector (Thought Bubble, User Stats, Info Box, Present Characters)
- Profile management (save/load/delete named configurations)
- Generation settings (max tokens, connection profile ID)
- Section editor with:
  - Enable/disable toggles
  - Priority controls (for ordering)
  - Content editing (textarea with macro support)
  - Add/delete sections
- Live preview with stats
- Test generation button

**HTML Template:** Added to `template.html`
**CSS Styling:** Added to `style.css`
**Settings Button:** Added to `settings.html`

### 3. Integration

**Files Modified:**
- `index.js` - Added import and initialization of `initPromptBuilderUI()`
- `src/systems/rendering/thoughts.js` - Updated `regenerateIndividualThought()` to use prompt builder
- `settings.html` - Added "Configure Prompt Builder" button
- `template.html` - Added prompt builder modal UI
- `style.css` - Added prompt builder styling

## How It Works

### Settings Persistence

All prompt configurations are stored in:
```javascript
extensionSettings.promptConfigs = {
    thoughtBubble: {
        assembler: { /* sections, separator, templateData */ },
        maxTokens: 150,
        profileId: null,
        profiles: {
            'Default': { assembler: {...}, maxTokens: 150 },
            'Detailed': { assembler: {...}, maxTokens: 300 }
        }
    },
    userStats: { /* ... */ },
    infoBox: { /* ... */ },
    // ... other components
}
```

**Auto-save:** Every change triggers `saveSettings()` which calls `saveSettingsDebounced()`
**Auto-load:** On UI open, settings are loaded from `extensionSettings`

### Thought Bubble Regeneration Flow

1. User clicks small 🔄 button on thought bubble
2. `regenerateIndividualThought(characterName)` is called
3. Creates `PromptBuilder` for 'thoughtBubble' component
4. Loads saved configuration from `extensionSettings.promptConfigs.thoughtBubble`
5. Sets template data: `{characterName}`, `{currentThought}`, `{currentMood}`, etc.
6. Builds prompt by:
   - Getting enabled sections sorted by priority
   - Processing templates (replacing `{placeholders}`, preserving `{{macros}}`)
   - Joining sections with separator
7. Sends to ConnectionManager with configured maxTokens and profileId
8. Parses response and updates character thought

### Default Sections for Thought Bubble

**System Prompt (Priority 100):**
```
You are a helpful assistant that generates character thoughts. Respond with ONLY the thought itself, no preamble or explanation.
```

**Context (Priority 90):**
```
Character: {characterName}
Current thought: {currentThought}
Current mood: {currentMood}
Relationship: {currentRelationship}

Recent conversation:
{{lastMessage}}
```

**Instruction (Priority 80):**
```
Generate a brief internal thought for {characterName} based on the recent conversation. Write in first person POV, up to three sentences. Output ONLY the thought itself.
```

## Usage

### For Users

1. Go to Extensions tab → RPG Companion settings
2. Click "Configure Prompt Builder" button
3. Select component (e.g., "Thought Bubble (Individual)")
4. Edit sections, adjust priorities, change max tokens
5. Changes auto-save immediately
6. Test with "Test Generate" button
7. Save as named profile for later use

### For Developers

```javascript
import { createPromptBuilder } from './modular-prompt-system/index.js';

// Create builder for a component
const builder = createPromptBuilder(extensionSettings, 'myComponent');

// Set template data
builder.setTemplateData({
    userName: 'Alice',
    context: 'battle scene'
});

// Build and send
const response = await builder.generate();
```

## Next Steps

To add prompt builder to other components:

1. Add default sections in `promptBuilderUI.js` → `getDefaultSections()`
2. Update the component's regeneration function to use `createPromptBuilder()`
3. Set appropriate template data for that component
4. Add component option to the UI selector

## Testing

1. Open RPG Companion settings
2. Click "Configure Prompt Builder"
3. Select "Thought Bubble (Individual)"
4. Verify sections are loaded
5. Edit a section, check auto-save
6. Click "Test Generate" to verify it works
7. In chat, click 🔄 on a thought bubble to test live regeneration

