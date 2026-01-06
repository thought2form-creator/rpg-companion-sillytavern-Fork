# SillyTavern WorldInfo Recommender - Lorebook Selector System

## Overview

The WorldInfo Recommender extension provides a sophisticated lorebook/world info selection system that allows users to control which lorebooks and specific entries are included when running AI-powered world info recommendations.

---

## Architecture

### Core Components

1. **MainPopup.tsx** - Main UI component containing the lorebook selector
2. **SelectEntriesPopup.tsx** - Popup for granular entry selection within lorebooks
3. **Session State** - Persistent storage of user selections per character/group

---

## Lorebook Selection Flow

### 1. Initial Load (Lines 89-174 in MainPopup.tsx)

When the popup opens, the system:

1. **Determines Context**:
   - Individual character: Loads all associated lorebooks
   - Group chat: Loads chat, persona, global, and all group member lorebooks
   - Global mode: Loads all available lorebooks from `world_names`

2. **Loads Lorebook Data**:
   ```typescript
   // For individual characters
   loadedEntries = await getWorldInfos(['all'], true, this_chid);
   
   // For groups
   const groupWorldInfo = await getWorldInfos(['chat', 'persona', 'global'], true);
   // Then iterates through group members to load their character lorebooks
   ```

3. **Restores Previous Selection**:
   - Retrieves saved session from localStorage using key: `worldInfoRecommend_${avatarKey}`
   - Validates that previously selected lorebooks still exist
   - Auto-selects all available lorebooks for new characters (not global mode)

### 2. Lorebook Dropdown (Lines 826-841 in MainPopup.tsx)

**Component**: `STFancyDropdown`

**Features**:
- Multi-select dropdown
- Search/filter capability
- Shows all available lorebooks from the current context

**Behavior**:
```typescript
<STFancyDropdown
  items={worldInfoDropdownItems}
  value={session.selectedWorldNames}
  onChange={(newValues) => {
    // Updates selectedWorldNames
    // Cleans up selectedEntryUids for removed lorebooks
  }}
  multiple
  enableSearch
/>
```

**State Management**:
- `session.selectedWorldNames`: Array of selected lorebook names
- When a lorebook is deselected, its entry-level selections are also removed

---

## Entry-Level Selection

### 3. Select Entries Button (Lines 842-851 in MainPopup.tsx)

Only visible when at least one lorebook is selected.

**Purpose**: Allows users to cherry-pick specific entries from selected lorebooks instead of including all entries.

### 4. SelectEntriesPopup Component

**Key Features**:

#### A. Filter System (Lines 40-59)
```typescript
const filteredEntries = useMemo(() => {
  const lowercasedFilter = filterText.toLowerCase();
  // Filters entries by:
  // - Entry comment (name)
  // - Lorebook name
}, [filterText, entriesByWorldName]);
```

#### B. Selection State (Lines 31-38)
- Uses Set of composite IDs: `${worldName}::${uid}`
- Persists across filter changes
- Initialized from `session.selectedEntryUids`

#### C. Bulk Operations (Lines 88-98)
- **Select All (Filtered)**: Selects all entries matching current filter
- **Deselect All**: Clears all selections

#### D. Individual Toggle (Lines 77-86)
```typescript
const handleToggleSelection = (worldName: string, uid: number) => {
  const id = `${worldName}::${uid}`;
  // Toggles entry in/out of selection Set
};
```

#### E. Export Selection (Lines 62-75)
```typescript
getSelection: () => {
  // Converts Set<string> back to Record<string, number[]>
  // Format: { "LorebookName": [uid1, uid2, ...] }
}
```

---

## Data Flow

### Selection to Context

When generating recommendations:

1. **Lorebook Level** (if no entry-level selection):
   ```typescript
   session.selectedWorldNames = ["Lorebook1", "Lorebook2"]
   session.selectedEntryUids = {} // Empty = use all entries
   ```

2. **Entry Level** (if specific entries selected):
   ```typescript
   session.selectedWorldNames = ["Lorebook1", "Lorebook2"]
   session.selectedEntryUids = {
     "Lorebook1": [101, 105, 203],
     "Lorebook2": [42, 87]
   }
   ```

3. **Context Building** (in generate.ts):
   - Filters `entriesGroupByWorldName` by `selectedWorldNames`
   - If `selectedEntryUids[worldName]` exists, further filters to only those UIDs
   - Passes filtered entries to AI for recommendation generation

---

## Persistence

### Storage Key Format
```typescript
const key = `worldInfoRecommend_${avatarKey}`;
// avatarKey = character filename | group ID | "_global"
```

### Saved Data
```typescript
interface Session {
  suggestedEntries: Record<string, WIEntry[]>;
  blackListedEntries: string[];
  selectedWorldNames: string[];           // Lorebook-level selection
  selectedEntryUids: Record<string, number[]>; // Entry-level selection
  regexIds: Record<string, Partial<RegexScriptData>>;
}
```

### Auto-Save (Lines 176-180)
```typescript
useEffect(() => {
  localStorage.setItem(key, JSON.stringify(session));
}, [session, avatarKey, isLoading]);
```

---

## UI/UX Patterns

1. **Progressive Disclosure**: 
   - Start with lorebook selection
   - Entry selection only shown when lorebooks are selected

2. **Smart Defaults**:
   - New characters: Auto-select all available lorebooks
   - Global mode: Start with empty selection (user must choose)

3. **Validation**:
   - Removes invalid lorebook names on load
   - Removes invalid entry UIDs on load
   - Cleans up entry selections when lorebooks are deselected

4. **Search/Filter**:
   - Lorebook dropdown has built-in search
   - Entry popup has custom filter by name or lorebook

---

## Integration Points

### For RPG Companion Integration

If you want to implement a similar selector:

1. **Use `getWorldInfos()` from sillytavern-utils-lib**:
   ```typescript
   import { getWorldInfos } from 'sillytavern-utils-lib';
   const entries = await getWorldInfos(['all'], true, this_chid);
   ```

2. **Use `STFancyDropdown` for multi-select**:
   ```typescript
   import { STFancyDropdown } from 'sillytavern-utils-lib/components/react';
   ```

3. **Store selections in extension settings or localStorage**

4. **Filter before passing to generation functions**


