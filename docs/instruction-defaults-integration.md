# Instruction Defaults Integration

## Overview

The Prompt Builder now uses the same default instruction prompts as the Response Token Settings menu. This ensures consistency between the two systems and allows users to restore instructions to their defaults.

---

## Changes Made

### 1. Default Instruction Prompts

Added `DEFAULT_INSTRUCTION_PROMPTS` constant in `promptBuilderUI.js` that mirrors the prompts from `tokenSettingsEditor.js`:

```javascript
const DEFAULT_INSTRUCTION_PROMPTS = {
    userStats: '...',
    infoBox: '...',
    presentCharacters: '...',
    characterField: '...',
    thoughtBubble: '...',
    characterCard: '...',
    characterEditor: '...'
};
```

These prompts are sourced from the "Regeneration Prompt Instructions" fields in the Response Token Settings modal.

### 2. Updated Default Sections

All component default sections now use `DEFAULT_INSTRUCTION_PROMPTS` for their instruction content:

```javascript
{
    id: 'instruction',
    content: DEFAULT_INSTRUCTION_PROMPTS.userStats,  // Instead of hardcoded text
    priority: 80,
    label: 'Instruction',
    description: 'Main generation instruction'
}
```

### 3. Restore Default Button

**Added:**
- "Restore Default" button for instruction sections
- Button appears in place of delete button for instruction sections
- Icon: `fa-undo` with text "Restore Default"

**Removed:**
- Delete button from instruction sections (instruction is required)

**Behavior:**
- Clicking "Restore Default" shows confirmation dialog
- Restores instruction content to the default from `DEFAULT_INSTRUCTION_PROMPTS`
- Shows success toast notification
- Automatically saves and refreshes preview

### 4. Helper Function

Added `getDefaultInstructionPrompt(componentKey)` function:
- Returns the default instruction prompt for a given component
- Used by the restore button handler
- Returns empty string if no default exists

---

## UI Changes

### Before
```
[✓] Instruction                    Priority: 80    [🗑️ Delete]
```

### After
```
[✓] Instruction                    Priority: 80    [↶ Restore Default]
```

---

## Component Mapping

| Component Key | Default Instruction Source |
|---------------|---------------------------|
| `thoughtBubble` | Character Field (Thoughts) prompt |
| `userStats` | User Stats section prompt |
| `infoBox` | Info Box section prompt |
| `presentCharacters` | Character Thoughts section prompt |
| `characterCard` | Full Character Regeneration prompt |
| `characterEditor` | Full Character Regeneration prompt |
| `characterField` | Character Field prompt |

---

## User Workflow

### Customizing Instructions

1. Open Prompt Builder UI
2. Select component type
3. Edit instruction section content
4. Save changes

### Restoring to Default

1. Open Prompt Builder UI
2. Select component type
3. Click "Restore Default" button on instruction section
4. Confirm restoration
5. Instruction content reverts to default from Response Token Settings

### Changing Defaults

1. Open Response Token Settings
2. Edit "Regeneration Prompt Instructions" for desired section
3. Save settings
4. New defaults will be used when creating new components
5. Existing components can be restored to new defaults using "Restore Default" button

---

## Technical Details

### Section Identification

```javascript
const isInstructionSection = section.id === 'instruction';
```

The instruction section is identified by its ID being exactly `'instruction'`.

### Button Rendering Logic

```javascript
let actionButton = '';
if (isInstructionSection) {
    actionButton = `<button class="rpg-pb-section-restore">...</button>`;
} else if (!isSystemSection) {
    actionButton = `<button class="rpg-pb-section-delete">...</button>`;
}
```

- Instruction sections get restore button
- System sections get no button (read-only)
- Other sections get delete button

### Event Handler

```javascript
$section.find('.rpg-pb-section-restore').on('click', function() {
    const defaultPrompt = getDefaultInstructionPrompt(currentComponent);
    if (defaultPrompt) {
        if (confirm('Restore instruction to default prompt?')) {
            section.setContent(defaultPrompt);
            currentBuilder.save();
            renderSections();
            refreshPreview();
            toastr.success('Instruction restored to default');
        }
    }
});
```

---

## Benefits

✅ **Consistency** - Same defaults across Response Token Settings and Prompt Builder  
✅ **Flexibility** - Users can customize and restore as needed  
✅ **Safety** - Instruction section cannot be deleted (required for generation)  
✅ **Discoverability** - Clear "Restore Default" button makes it obvious how to reset  
✅ **Maintainability** - Single source of truth for default prompts  

---

## Files Modified

- `src/systems/ui/promptBuilderUI.js`
  - Added `DEFAULT_INSTRUCTION_PROMPTS` constant
  - Updated `getDefaultSections()` to use defaults
  - Added `getDefaultInstructionPrompt()` helper
  - Modified `createSectionElement()` to show restore button
  - Added restore button event handler
  - Removed delete button from instruction sections

---

## Future Enhancements

1. **Sync with Token Settings**
   - When user changes prompt in Token Settings, update Prompt Builder defaults
   - Show indicator if instruction differs from current default

2. **Import/Export**
   - Allow exporting instruction prompts
   - Allow importing from other profiles

3. **Version History**
   - Track changes to instruction prompts
   - Allow reverting to previous versions

