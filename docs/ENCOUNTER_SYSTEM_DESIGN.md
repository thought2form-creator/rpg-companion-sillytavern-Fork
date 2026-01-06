# Encounter System - Design Document

## Overview
The Encounter System is a turn-based combat module that allows users to engage in structured battles with AI-generated enemies. It provides a modal-based UI for managing combat, tracking stats, and generating narrative combat descriptions.

## Core Architecture

### State Management (`src/systems/features/encounterState.js`)
**Primary State Object: `currentEncounter`**
- `active` (boolean) - Whether an encounter is currently running
- `initialized` (boolean) - Whether combat has been initialized
- `combatHistory` (array) - Message history for LLM context (role/content pairs)
- `combatStats` (object) - Current combat state (see Combat Stats Structure below)
- `preEncounterContext` (array) - Chat messages from before encounter started
- `encounterStartMessage` (string) - The message that triggered the encounter
- `encounterLog` (array) - Full log of combat actions for final summary
- `displayLog` (array) - Visual log entries shown in UI with swipe support
- `pendingEnemies` (array) - AI-suggested enemies awaiting user approval
- `pendingParty` (array) - AI-suggested party members awaiting user approval

**Persistence:**
- Auto-saves to `extensionSettings.encounterSettings.savedEncounter` after each action
- Allows resuming interrupted encounters
- Cleared when encounter concludes or user starts new encounter

### Combat Stats Structure
```javascript
combatStats: {
    environment: string,           // Combat environment description
    specialInstructions: string,   // Custom AI instructions for this encounter
    party: [                       // Player's party
        {
            name: string,
            hp: number,
            maxHp: number,
            attacks: [{name: string, type: 'single-target'|'AoE'|'both'}],
            items: [string],       // Party members only
            statuses: [{emoji: string, name: string, duration: number}],
            customBars: [{name: string, current: number, max: number, color: string}],
            isPlayer: boolean      // Marks the main player character
        }
    ],
    enemies: [                     // Enemy combatants
        {
            name: string,
            hp: number,
            maxHp: number,
            sprite: string,        // Emoji or text representation
            description: string,
            attacks: [{name: string, type: 'single-target'|'AoE'|'both'}],
            statuses: [{emoji: string, name: string, duration: number}],
            customBars: [{name: string, current: number, max: number, color: string}]
        }
    ]
}
```

## UI Components (`src/systems/ui/encounterUI.js`)

### EncounterModal Class
**Singleton pattern** - Single instance manages all encounter UI

**Key Methods:**
- `open()` - Entry point; checks for saved encounters, shows config modal
- `initialize()` - Sends initial prompt to LLM, parses combat stats, renders UI
- `continueEncounter()` - Resumes a saved encounter
- `renderCombatUI(combatData, preserveLog)` - Renders the main combat interface
- `processCombatAction(action)` - Sends player action to LLM, updates state
- `endCombat(result)` - Generates summary, adds to chat, closes encounter
- `showEntityEditor(type, index, isNew)` - Modal for editing enemies/party members

**UI Sections:**
1. **Header** - Title, conclude button, close button
2. **Combat Log** - Scrollable narrative log with swipe support for regeneration
3. **Enemies Section** - Enemy cards with HP bars, statuses, custom bars
4. **Party Section** - Party member cards with HP bars, statuses, items
5. **Controls** - Player action buttons (attacks, items, custom action input)

### Pending Entity System
- AI can suggest new enemies/party members during combat
- Suggestions go to `pendingEnemies`/`pendingParty` arrays
- Badge indicators show count of pending entities
- User can review and approve/reject via modal

## Prompt Generation (`src/systems/generation/encounterPrompts.js`)

### Three Prompt Types:

1. **Encounter Initialization** (`buildEncounterInitPrompt`)
   - Uses last N chat messages for context
   - Includes world info, character info, persona, tracker data
   - Asks LLM to generate initial combat stats (party + enemies)
   - Returns JSON with full combat state

2. **Combat Action** (`buildCombatActionPrompt`)
   - Includes combat history (previous actions)
   - Current combat stats (HP, statuses, etc.)
   - Player's action
   - Asks LLM to narrate outcome and update stats
   - Returns JSON with narrative, updated stats, enemy/party actions

3. **Combat Summary** (`buildCombatSummaryPrompt`)
   - Full combat log
   - Combat result (victory/defeat/fled)
   - Generates narrative summary of entire battle
   - Returns plain text summary (added to chat via `/sendas`)

### Narrative Style Configuration
- **Combat Narrative** - Used during combat actions
  - Tense: present/past
  - Person: first/second/third
  - Narration: omniscient/limited
  - POV: narrator/player/character
  
- **Summary Narrative** - Used for final summary
  - Separate settings from combat narrative
  - Typically past tense, third person

## Combat Flow

### 1. Initialization
```
User clicks "Start Encounter" 
→ Check for saved encounter (continue/new/cancel)
→ Show narrative config modal (tense, person, POV)
→ Build init prompt with chat context
→ LLM generates combat stats (JSON)
→ Parse and validate JSON
→ Render combat UI
→ Auto-save state
```

### 2. Combat Loop
```
User selects action (attack/item/custom)
→ Build action prompt with combat history
→ LLM generates narrative + updated stats (JSON)
→ Parse response
→ Detect new entities → move to pending
→ Merge stats (preserve manual edits)
→ Add to combat log
→ Update UI (HP bars, statuses, etc.)
→ Auto-save state
→ Check for combat end conditions
```

### 3. Conclusion
```
Combat ends (all enemies dead / player fled / manual conclude)
→ Show combat over screen
→ Build summary prompt with full log
→ LLM generates summary
→ Add summary to chat via /sendas (as Narrator/GM/first group member)
→ Save encounter log to history
→ Close modal
→ Clear saved state
```

## Key Features

### Smart Stat Merging
- AI only updates: HP, maxHP, statuses, customBars
- Preserves user edits: name, attacks, items, sprite, description
- Prevents AI from overwriting manual changes

### Swipe Support
- Each log entry supports multiple swipes (regenerations)
- User can regenerate AI responses
- Swipes stored per log entry

### Entity Protection
- Player character cannot be removed from party
- Manual entity editing via modal
- Add/remove entities manually

### Environment Styling
- AI can provide `styleNotes` in response
- Applies CSS classes to modal for visual theming
- Supports atmosphere effects (rain, snow, etc.)

### Error Handling
- JSON parsing failures show regenerate button
- Validation of required fields (party, enemies)
- Graceful fallbacks for missing data

## File Structure
```
src/systems/
├── features/
│   └── encounterState.js          # State management, persistence
├── ui/
│   └── encounterUI.js              # Modal UI, rendering, user interactions
└── generation/
    └── encounterPrompts.js         # Prompt building, JSON parsing
```

## Integration Points
- Uses `generateRaw()` with `quietPrompt: true` to avoid tracker injection
- Integrates with tracker data (user stats, inventory) in prompts
- Uses `/sendas` command to add summary to chat
- Respects group chat structure for narrator selection

## JSON Response Parsing

### Expected Response Format

**Initialization Response:**
```json
{
    "environment": "Dark forest clearing at midnight",
    "party": [
        {
            "name": "Alice",
            "hp": 100,
            "maxHp": 100,
            "attacks": [{"name": "Sword Slash", "type": "single-target"}],
            "items": ["Health Potion", "Smoke Bomb"],
            "isPlayer": true
        }
    ],
    "enemies": [
        {
            "name": "Goblin Scout",
            "hp": 50,
            "maxHp": 50,
            "sprite": "👺",
            "description": "A small, cunning goblin",
            "attacks": [{"name": "Dagger Stab", "type": "single-target"}]
        }
    ]
}
```

**Combat Action Response:**
```json
{
    "narrative": "Alice swings her sword, striking the goblin for 15 damage!",
    "party": [
        {
            "name": "Alice",
            "hp": 85,
            "maxHp": 100,
            "statuses": [{"emoji": "🔥", "name": "Burning", "duration": 2}]
        }
    ],
    "enemies": [
        {
            "name": "Goblin Scout",
            "hp": 35,
            "maxHp": 50
        }
    ],
    "enemyActions": [
        "The goblin retaliates with a dagger stab, dealing 15 damage to Alice!"
    ],
    "partyActions": [],
    "styleNotes": "dark-forest-theme"
}
```

### Parsing Strategy
1. **Extract JSON** - Use regex to find JSON block in response
2. **Clean** - Remove markdown code fences, trim whitespace
3. **Parse** - `JSON.parse()` with try/catch
4. **Validate** - Check for required fields (party, enemies for init; narrative for action)
5. **Merge** - Combine AI updates with existing state (preserve user edits)

### Validation Rules
- **Initialization:** Must have `party` array and `enemies` array
- **Combat Action:** Must have `narrative` string
- **HP Values:** Clamp to 0-maxHp range
- **Status Durations:** Decrement each turn, remove when ≤ 0
- **Custom Bars:** Clamp to 0-max range

## State Merging Algorithm

When AI returns updated stats, the system merges them carefully:

```javascript
// For each entity in AI response:
1. Find matching entity in current state (by name)
2. If found:
   - Update: hp, maxHp, statuses, customBars
   - Preserve: name, attacks, items, sprite, description, isPlayer
3. If not found:
   - New enemy → add to pendingEnemies
   - New party member → add to pendingParty
4. Remove entities with hp ≤ 0 from enemies (unless user manually edited)
```

This prevents AI from:
- Changing entity names mid-combat
- Removing/adding attacks without user approval
- Deleting items from inventory
- Changing sprite/description

## Combat Log Structure

Each log entry:
```javascript
{
    id: string,              // Unique ID for swipe tracking
    type: 'narrative',       // Entry type
    content: string,         // Display text
    swipes: [string],        // Alternative versions
    currentSwipe: number,    // Active swipe index
    timestamp: number        // For sorting
}
```

**Log Types:**
- `narrative` - Combat action results
- `system` - Status updates, entity changes
- `error` - Parsing failures, warnings

## Settings Structure

```javascript
extensionSettings.encounterSettings = {
    // Narrative style for combat actions
    combatNarrative: {
        tense: 'present',
        person: 'second',
        narration: 'omniscient',
        pov: 'player'
    },

    // Narrative style for final summary
    summaryNarrative: {
        tense: 'past',
        person: 'third',
        narration: 'omniscient',
        pov: 'narrator'
    },

    // Custom system prompts
    customCombatSystemPrompt: string,
    customCombatSummarySystemPrompt: string,

    // Saved encounter state
    savedEncounter: {
        combatStats: object,
        combatHistory: array,
        encounterLog: array,
        displayLog: array,
        // ... other state fields
    },

    // Encounter history
    encounterHistory: {
        [chatId]: {
            log: array,
            summary: string,
            result: string,
            timestamp: number
        }
    }
}
```

## Error Recovery

### JSON Parsing Failures
1. Show error message in UI
2. Display "Regenerate" button
3. Keep previous state intact
4. Allow user to retry or manually edit

### Missing Required Fields
1. Log warning to console
2. Use fallback values (empty arrays, default strings)
3. Continue combat with partial data

### LLM Generation Failures
1. Show error toast
2. Keep combat state
3. Allow retry or manual action

## Future Enhancements
- Multi-target attack selection UI
- Drag-and-drop entity reordering
- Combat replay/history viewer
- Export combat logs as markdown
- Custom entity templates
- Difficulty scaling
- Loot generation system

