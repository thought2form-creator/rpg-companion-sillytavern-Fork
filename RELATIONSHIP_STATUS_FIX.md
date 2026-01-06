# Relationship Status Fields Fix

## Issue Description
Relationship Status fields in the Edit Trackers UI (Present Characters tab) were disappearing when users saved or closed the modal. This affected:
1. Relationship field **names** and **emojis** (the available options)
2. Actual character **relationship values** (the data stored per character)

## Root Causes

### Background: Upstream Changes (v2.1.2)
On January 2, 2026, the original repository released v2.1.2 which introduced a **new nested data structure** for relationship fields with an enable/disable toggle. This created two parallel data structures that need to be kept in sync:

**Old structure (legacy):**
```javascript
presentCharacters: {
  relationshipEmojis: { 'Friend': '⭐', ... },
  relationshipFields: ['Friend', ...]
}
```

**New structure (v2.1.2):**
```javascript
presentCharacters: {
  relationships: {
    enabled: true,
    relationshipEmojis: { 'Friend': '⭐', ... }
  },
  // Legacy fields kept for backward compatibility
  relationshipEmojis: { ... },
  relationshipFields: [ ... ]
}
```

When this update was merged, the synchronization between these structures wasn't working properly, causing relationship data to disappear.

### Issue 1: Config Changes Being Discarded
The `closeTrackerEditor()` function had a critical bug where it **always restored the temporary configuration** (`tempConfig`) when closing the modal, effectively discarding all user changes unless the Save button was explicitly clicked.

### Issue 2: Data Structure Synchronization
The new nested structure (`relationships.relationshipEmojis`) and legacy structure (`relationshipEmojis`) weren't being properly synchronized when saving, causing data loss.

### Issue 3: Character Data Not Being Saved
The tracker editor only called `saveSettings()` which saves the **tracker configuration** (field definitions) but not `saveChatData()` which saves the **actual character data** (relationship values per character). This is because:
- **Tracker Config** (`extensionSettings.trackerConfig`) stores relationship field definitions (names, emojis)
- **Character Data** (`lastGeneratedData.characterThoughts`) stores actual character relationship values
- These are saved to different places in SillyTavern's storage system

### The Bug Flow
1. User opens Edit Trackers → `tempConfig` is created as a backup copy
2. User edits relationship fields → Changes written to `extensionSettings.trackerConfig`
3. User closes modal (via X button or background click) → `closeTrackerEditor()` called
4. Function checks `if (tempConfig)` → Always true
5. **All changes discarded** by restoring `tempConfig`

Only clicking the Save button worked because it called `applyTrackerConfig()` which set `tempConfig = null` before closing.

## Fix Applied

### Changes to `src/systems/ui/trackerEditor.js`

#### 1. Modified `closeTrackerEditor()` function
- Added `cancel` parameter (default: `false`)
- Only restores `tempConfig` when `cancel === true`
- Otherwise, clears `tempConfig` without restoring (keeps changes)

```javascript
function closeTrackerEditor(cancel = false) {
    // Only restore from temp if explicitly canceling
    if (cancel && tempConfig) {
        extensionSettings.trackerConfig = tempConfig;
        tempConfig = null;
    } else {
        // Clear temp config without restoring (changes are kept)
        tempConfig = null;
    }
    // ... rest of function
}
```

#### 2. Updated button event handlers
- **Save button**: Calls `applyTrackerConfig()` then `closeTrackerEditor(false)`
- **Cancel button**: Calls `closeTrackerEditor(true)` to restore original config
- **X button**: Calls `applyTrackerConfig()` then `closeTrackerEditor(false)` to save changes
- **Background click**: Calls `applyTrackerConfig()` then `closeTrackerEditor(false)` to save changes

#### 3. Added data structure synchronization
- New `ensureRelationshipStructuresSync()` function keeps both data structures in sync
- Called before opening the editor and before saving
- Syncs between `relationships.relationshipEmojis` (new) and `relationshipEmojis` (legacy)
- Maintains backward compatibility with older versions

```javascript
function ensureRelationshipStructuresSync() {
    const pc = extensionSettings.trackerConfig.presentCharacters;

    // If new structure exists, sync to legacy structure
    if (pc.relationships?.relationshipEmojis) {
        pc.relationshipEmojis = { ...pc.relationships.relationshipEmojis };
        pc.relationshipFields = Object.keys(pc.relationships.relationshipEmojis);
    }
    // If only legacy structure exists, sync to new structure
    else if (pc.relationshipEmojis) {
        if (!pc.relationships) {
            pc.relationships = { enabled: true, relationshipEmojis: {} };
        }
        pc.relationships.relationshipEmojis = { ...pc.relationshipEmojis };
        pc.relationshipFields = Object.keys(pc.relationshipEmojis);
    }
}
```

#### 4. Added chat data persistence
- Modified `applyTrackerConfig()` to call both `saveSettings()` and `saveChatData()`
- Ensures character relationship values are persisted along with field definitions

#### 5. Fixed relationship emoji sync
- Added `relationshipFields` array sync when emoji is updated
- Ensures consistency between `relationshipEmojis` object and `relationshipFields` array

## Behavior After Fix

| Action | Old Behavior | New Behavior |
|--------|-------------|--------------|
| Click Save button | ✅ Changes saved | ✅ Changes saved |
| Click Cancel button | ❌ Changes lost (intended) | ✅ Changes discarded (intended) |
| Click X button | ❌ Changes lost (BUG) | ✅ Changes saved |
| Click background | ❌ Changes lost (BUG) | ✅ Changes saved |

## Testing Instructions

1. Open Edit Trackers UI
2. Go to Present Characters tab
3. Modify a relationship status field (name or emoji)
4. Close the modal using the X button (don't click Save)
5. Reopen Edit Trackers UI
6. **Expected**: Your changes should be preserved
7. Repeat test with background click to close
8. **Expected**: Changes should still be preserved
9. Test Cancel button
10. **Expected**: Changes should be discarded

## Additional Notes

- This fix applies to ALL tracker configuration changes, not just relationship fields
- The dual data structure (`relationshipEmojis` and `relationships.relationshipEmojis`) is maintained for backward compatibility
- Users no longer need to remember to click Save - closing the modal now auto-saves
- Cancel button provides explicit way to discard changes if needed

## How Relationship Data Works

It's important to understand that relationship status works differently than you might expect:

1. **Tracker Config** stores the **mapping** of relationship names to emojis (e.g., "Friend" → "⭐")
2. **Character Data** (in `lastGeneratedData.characterThoughts`) stores the **text** generated by the LLM (e.g., "Relationship: Friend")
3. When **rendering**, the extension looks up the text in the mapping and displays the emoji

This means:
- If you change "Friend" to "Ally" in the tracker config, existing character data still says "Friend"
- The extension won't find "Friend" in the new mapping, so it will display the text "Friend" instead of an emoji
- The LLM-generated character data is stored in **chat metadata** (per-chat), not in extension settings (global)

### Data Storage Locations

| Data Type | Storage Location | Saved By | Scope |
|-----------|-----------------|----------|-------|
| Relationship field definitions (names, emojis) | `extensionSettings.trackerConfig.presentCharacters` | `saveSettings()` | Global (all chats) |
| Character relationship values | `lastGeneratedData.characterThoughts` | `saveChatData()` | Per-chat |

The fix now ensures both are saved when you close the tracker editor.

