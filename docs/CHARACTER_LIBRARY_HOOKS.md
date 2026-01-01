# Character Library Integration Hooks

## Overview

The character regeneration system includes hooks for future integration with SillyTavern's character library. This will allow users to reference existing character cards when regenerating Present Characters data.

## Current Implementation

### Hook Function: `getCharacterLibraryData()`

**Location:** `src/systems/ui/characterRegeneration.js`

**Purpose:** Retrieve character data from the user's library for injection into regeneration prompts

**Current Status:** Returns `null` (not implemented)

**Signature:**
```javascript
async function getCharacterLibraryData(characterName)
```

**Parameters:**
- `characterName` (string) - Name of the character to look up in the library

**Returns:**
- `Promise<string|null>` - Formatted character data, or null if not found/not implemented

### Integration Points

The hook is called in two places:

1. **Full Character Regeneration** (`buildCharacterRegenerationPrompt`)
   - Line ~127: `const libraryData = await getCharacterLibraryData(characterName);`
   - Line ~139-141: Injects library data into prompt if available

2. **Single Field Regeneration** (`buildFieldRegenerationPrompt`)
   - Line ~228: `const libraryData = await getCharacterLibraryData(characterName);`
   - Line ~240-242: Injects library data into prompt if available

## Future Implementation Guide

### Step 1: Access Character Library

SillyTavern's character data is available through:
```javascript
import { characters } from '../../../../../../../script.js';
```

### Step 2: Implement Lookup Function

```javascript
async function getCharacterLibraryData(characterName) {
    // Search for character in library (case-insensitive)
    const libraryChar = characters.find(c => 
        c.name.toLowerCase() === characterName.toLowerCase()
    );
    
    if (!libraryChar) {
        return null;
    }
    
    // Format character data for injection
    return formatLibraryCharacterData(libraryChar);
}
```

### Step 3: Format Character Data

```javascript
function formatLibraryCharacterData(character) {
    let formatted = `<library_character name="${character.name}">\n`;
    
    if (character.description) {
        formatted += `Description: ${character.description}\n`;
    }
    
    if (character.personality) {
        formatted += `Personality: ${character.personality}\n`;
    }
    
    if (character.scenario) {
        formatted += `Scenario: ${character.scenario}\n`;
    }
    
    if (character.mes_example) {
        formatted += `Example Dialogue:\n${character.mes_example}\n`;
    }
    
    formatted += `</library_character>`;
    
    return formatted;
}
```

### Step 4: Add UI for Character Selection

Consider adding a dropdown or search field in the character editor to allow users to:
- Select a reference character from their library
- Link a Present Character to a library character
- Auto-populate fields from the library character

## Use Cases

### 1. Consistency with Established Characters
When a Present Character represents a character from the user's library, reference their card data to maintain consistency.

### 2. Quick Character Creation
Allow users to create Present Characters based on existing library characters, auto-populating fields from the card.

### 3. Multi-Character Scenarios
When multiple characters from the library appear in a scene, reference their cards to maintain accurate relationships and interactions.

## Benefits

- **Consistency:** Ensures Present Characters match their library counterparts
- **Efficiency:** Reduces manual data entry by referencing existing cards
- **Accuracy:** AI regeneration uses established character definitions
- **Flexibility:** Users can override library data with custom Present Character fields

## Implementation Checklist

- [ ] Implement `getCharacterLibraryData()` function
- [ ] Create `formatLibraryCharacterData()` helper
- [ ] Add UI for character selection/linking
- [ ] Add setting to enable/disable library integration
- [ ] Add option to auto-link by name matching
- [ ] Add option to manually link Present Characters to library characters
- [ ] Test with various character card formats
- [ ] Document user-facing features

## Notes

- The hook is already integrated into the prompt building pipeline
- No changes to existing functionality - library data is optional
- When `getCharacterLibraryData()` returns `null`, regeneration works as before
- The system is designed to be backwards compatible

## Related Files

- `src/systems/ui/characterRegeneration.js` - Main implementation file
- `src/systems/ui/characterEditor.js` - Character editor UI
- Character library data structure: See SillyTavern's character card format

