# User Guidance System Implementation

## Overview

The User Guidance system allows users to provide special instructions when generating content through the Prompt Builder. The guidance is automatically formatted and added to the prompt as a system section.

---

## How It Works

### 1. User Flow

1. User clicks **"Test Generate"** button in Prompt Builder
2. A modal appears asking for optional guidance
3. User enters guidance (or leaves empty) and clicks **"Generate"**
4. The guidance is added to the prompt and generation proceeds

### 2. Technical Implementation

#### Modal Dialog (`promptBuilderUI.js`)

- **Function:** `showGenerationGuidanceModal(callback)`
- **Location:** `src/systems/ui/promptBuilderUI.js` (lines 548-622)
- **Features:**
  - Clean modal UI matching existing style
  - Textarea for user input
  - Placeholder with examples
  - Cancel and Generate buttons
  - Ctrl+Enter keyboard shortcut
  - Auto-focus on input field

#### Guidance Section (System Section)

- **Section ID:** `__system_guidance__`
- **Priority:** `0` (lowest - appears at end of prompt)
- **Type:** System section (cannot be deleted)
- **Label:** `✨ User Guidance (System)`
- **Visibility:** Always visible in Prompt Builder UI

#### Prompt Formatting

When user provides guidance, it's formatted as:

```
[Take the following into special consideration for your next message: <USER INPUT>]
```

**Example:**
- User input: `Make it more dramatic and add tension`
- Formatted output: `[Take the following into special consideration for your next message: Make it more dramatic and add tension]`

If the user enters nothing, the section is disabled and not included in the prompt.

---

## Code Changes

### 1. `src/systems/generation/modular-prompt-system/index.js`

#### Modified `build()` method (lines 135-153)
- Now accepts `options.guidance` parameter
- Calls `updateGuidanceSection()` before building

#### New `updateGuidanceSection()` method (lines 196-230)
- Creates guidance section if it doesn't exist
- Formats user input with special consideration wrapper
- Enables/disables section based on whether guidance is provided
- Updates section content dynamically

#### Modified `generate()` method (lines 455-480)
- Passes guidance to `build()` method
- Logs whether guidance was provided

### 2. `src/systems/ui/promptBuilderUI.js`

#### Modified `initializeComponentDefaults()` (lines 138-146)
- Calls `ensureGuidanceSection()` during initialization

#### New `ensureGuidanceSection()` function (lines 205-227)
- Creates the guidance system section
- Sets priority to 0 (lowest)
- Marks as disabled by default
- Adds descriptive label and tooltip

#### Modified `testGenerate()` function (lines 551-545)
- Shows guidance modal before generating
- Passes guidance to `generate()` method

#### New `showGenerationGuidanceModal()` function (lines 548-622)
- Creates and displays modal dialog
- Handles user input and callbacks
- Manages modal lifecycle (open/close)

---

## UI Behavior

### In Prompt Builder

The guidance section appears in the sections list as:

```
✨ User Guidance (System)
Priority: 0
[Enabled checkbox] [Priority input]
[Read-only content preview]
```

**Notes:**
- No delete button (system section)
- Content is read-only (auto-generated)
- Shows "(Auto-generated)" when guidance is provided
- Shows empty state when no guidance
- Priority can be adjusted (default: 0)

### During Generation

1. Modal appears with textarea
2. User can type guidance or leave empty
3. Clicking "Generate" proceeds with generation
4. Guidance section updates automatically
5. Section is enabled only if guidance provided

---

## Benefits

✅ **Flexible:** Users can provide guidance on-demand  
✅ **Optional:** Empty input = no guidance added  
✅ **Visible:** Guidance section always visible in UI  
✅ **Configurable:** Priority can be adjusted  
✅ **Consistent:** Uses same formatting as other regeneration modals  
✅ **Clean:** Automatically managed - no manual editing needed

---

## Related Files

- `src/systems/generation/modular-prompt-system/index.js` - Core prompt builder
- `src/systems/ui/promptBuilderUI.js` - UI and modal implementation
- `src/systems/generation/modular-prompt-system/section.js` - Section class
- `src/systems/ui/trackerRegeneration.js` - Similar guidance modal pattern

---

## Future Enhancements

- [ ] Save recent guidance inputs for quick reuse
- [ ] Add guidance presets/templates
- [ ] Allow guidance to be saved with profiles
- [ ] Add guidance history dropdown

