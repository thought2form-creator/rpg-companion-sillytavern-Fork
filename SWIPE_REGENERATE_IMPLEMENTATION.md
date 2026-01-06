# Combat Log Swipe and Regenerate Feature

## Overview
This implementation adds ChatGPT-style swipe and regenerate functionality to the combat encounter log, allowing users to:
- Generate multiple alternative responses for narrative entries
- Swipe left/right to view different response variations
- Regenerate responses to get new alternatives
- Persist all swipes through saves and edits

## Changes Made

### 1. Enhanced Encounter State (`src/systems/features/encounterState.js`)

#### Modified Functions:
- **`addEncounterLogEntry()`**: Now stores swipes array and swipeIndex
- **`addDisplayLogEntry()`**: Now stores swipes array and swipeIndex

#### New Functions:
- **`addEncounterLogSwipe(entryIndex, newResult)`**: Adds a new swipe to an encounter log entry
- **`setEncounterLogSwipe(entryIndex, swipeIndex)`**: Sets the active swipe for an encounter log entry
- **`addDisplayLogSwipe(entryIndex, newMessage)`**: Adds a new swipe to a display log entry
- **`setDisplayLogSwipe(entryIndex, swipeIndex)`**: Sets the active swipe for a display log entry

#### Data Structure:
Each log entry now contains:
```javascript
{
    timestamp: Date.now(),
    action: "...",
    result: "...",
    swipes: ["result1", "result2", ...],  // All alternative results
    swipeIndex: 0  // Currently selected swipe
}
```

### 2. Enhanced Encounter UI (`src/systems/ui/encounterUI.js`)

#### New Methods:
- **`renderLogEntry(logEntry, index, container)`**: Renders a single log entry with swipe controls
- **`swipeLogEntry(logIndex, direction)`**: Handles swiping between alternative responses
- **`regenerateLogEntry(logIndex)`**: Regenerates a narrative entry and adds it as a new swipe

#### Modified Methods:
- **`restoreDisplayLog()`**: Now uses `renderLogEntry()` for consistent rendering
- **`addToLog()`**: Now uses `renderLogEntry()` to add entries with controls
- **`attachControlListeners()`**: Added handlers for swipe, regenerate, and restore log buttons
- **`renderCombatUI()`**: Now preserves log content during UI re-renders

#### UI Controls:
For narrative entries, the following controls are added:
- **Left Arrow Button**: Navigate to previous swipe
- **Swipe Counter**: Shows current swipe (e.g., "2/3")
- **Right Arrow Button**: Navigate to next swipe
- **Regenerate Button**: Generate a new alternative response

In the Combat Log header:
- **Restore Log Button**: Manually restore log from saved state if it gets cleared

### 3. Enhanced Prompt Parsing (`src/systems/generation/encounterPrompts.js`)

#### New Function:
- **`parseCombatActionResponse(response)`**: Parses combat action responses and extracts narrative and other data

### 4. Enhanced Styles (`style.css`)

#### New CSS Classes:
- `.rpg-encounter-log-entry-wrapper`: Container for log entry with controls
- `.rpg-encounter-log-controls`: Container for swipe/regenerate buttons
- `.rpg-encounter-log-swipe-btn`: Swipe navigation buttons
- `.rpg-encounter-log-swipe-counter`: Displays current swipe number
- `.rpg-encounter-log-regen-btn`: Regenerate button
- `.rpg-encounter-log-header`: Header container for log title and restore button
- `.rpg-encounter-log-restore-btn`: Restore log button
- `.rpg-regenerating`: Loading state during regeneration

## User Experience

### Viewing Alternative Responses:
1. Narrative entries display swipe controls at the top
2. Click left/right arrows to navigate between swipes
3. Counter shows current position (e.g., "1/3")
4. Disabled arrows indicate no more swipes in that direction

### Regenerating Responses:
1. Click the regenerate button (🔄) on any narrative entry
2. System shows loading state
3. New response is generated and added as a new swipe
4. Automatically switches to the new response
5. Can swipe back to previous responses at any time

### Log Preservation:
- **Combat log is now preserved during UI updates**
- When entities are edited, added, or removed, the log content is maintained
- If the log ever gets cleared, click the "Restore Log" button to repopulate it from saved state
- The restore button is located in the Combat Log header

### Persistence:
- All swipes are saved in the encounter state
- Swipes persist through:
  - Manual saves
  - Auto-saves
  - Entity edits
  - Page refreshes
  - Encounter resumption
  - UI re-renders

## Technical Details

### Log Preservation During UI Updates:
The `renderCombatUI()` method now accepts a `preserveLog` parameter (default: `true`):

**When `preserveLog = true` (entity edits, additions, deletions):**
1. The existing log container's innerHTML is captured before re-rendering
2. The UI is re-rendered with updated entity data
3. The preserved log content is restored to the new log container
4. This ensures the log viewport remains intact during updates

**When `preserveLog = false` (new encounter, continue encounter):**
1. The log is cleared and starts fresh
2. For new encounters: log starts empty (just "Combat begins!")
3. For continued encounters: `restoreDisplayLog()` is called immediately after to rebuild from saved state

### Manual Log Restoration:
If the log ever gets cleared unexpectedly:
1. User clicks the "Restore Log" button in the Combat Log header
2. `restoreDisplayLog()` is called to rebuild the log from saved state
3. All entries are re-rendered with their current swipe states
4. User is notified via toastr that the log was restored

### Regeneration Process:
1. Finds the corresponding action in the encounter log
2. Rebuilds the combat action prompt with the same action
3. Generates a new response using the AI
4. Parses the response to extract the narrative
5. Adds the narrative as a new swipe
6. Updates both display log and encounter log
7. Re-renders the log to show the new swipe

### Error Handling:
- Invalid log indices are caught and logged
- Failed regenerations restore the original content
- User is notified of errors via toastr messages

### Performance:
- Uses event delegation for button handlers
- Only re-renders affected log entries
- Minimal DOM manipulation during swipes
- Log preservation uses simple innerHTML capture/restore

## Future Enhancements

Potential improvements:
1. Add keyboard shortcuts for swiping (Ctrl+Left/Right)
2. Add swipe animations for smoother transitions
3. Allow deleting individual swipes
4. Add "favorite" marking for preferred swipes
5. Export/import swipe history

