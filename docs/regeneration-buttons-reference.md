# Regeneration Buttons Reference

This document provides a comprehensive overview of all regeneration buttons in the RPG Companion extension.

## Overview

The extension provides **7 types** of regeneration buttons across different UI components, allowing users to regenerate tracker data, character information, and individual fields using AI.

---

## 1. Main Tracker Section Buttons

**Location:** Section headers in tracker panels  
**Purpose:** Regenerate entire tracker sections with optional user guidance

| Button ID | Section | File | Line |
|-----------|---------|------|------|
| `#rpg-regenerate-user-stats` | User Stats | `src/systems/rendering/userStats.js` | 126, 378 |
| `#rpg-regenerate-info-box` | Environment/Info Box | `src/systems/rendering/infoBox.js` | 290, 540 |
| `#rpg-regenerate-present-characters` | Present Characters | `src/systems/rendering/thoughts.js` | 625, 827 |

**Functionality:**
- Opens modal dialog (`showTrackerRegenerationModal`) with optional guidance input
- Regenerates the entire section based on current chat context
- Defined in: `src/systems/ui/trackerRegeneration.js`

**Icon:** 🔄 (fa-rotate)

---

## 2. Character Card Buttons

**Location:** Individual character cards in Present Characters panel  
**Purpose:** Regenerate all fields for a specific character

| Class | Purpose | File | Line |
|-------|---------|------|------|
| `.rpg-character-regen` | Regenerate entire character | `src/systems/rendering/thoughts.js` | 770, 1024 |

**Functionality:**
- Calls `regenerateCharacterFromCard(characterName)`
- Opens guidance modal for optional user direction
- Regenerates: emoji, relationship, custom fields, stats, and thoughts
- Defined in: `src/systems/ui/characterEditor.js`

**Icon:** 🔄

---

## 3. Thought Bubble Buttons

**Location:** Inside thought bubble widget (floating panel)  
**Purpose:** Regenerate individual character's thought

| Class | Purpose | File | Line |
|-------|---------|------|------|
| `.rpg-thought-regen-btn` | Regenerate single thought | `src/systems/rendering/thoughts.js` | 1517, 1716 |

**Functionality:**
- Calls `regenerateIndividualThought(characterName)`
- Regenerates only the thought text for one character
- No guidance modal (quick regeneration)
- Defined in: `src/systems/rendering/thoughts.js`

**Icon:** 🔄 (small circular button on emoji box)

---

## 4. Advanced Character Editor Buttons

**Location:** Character editor modal (`#rpg-character-editor-modal`)  
**Purpose:** Regenerate characters or individual fields with fine-grained control

### 4a. Full Character Regeneration

| Class | Purpose | File | Line |
|-------|---------|------|------|
| `.rpg-char-regen` | Regenerate entire character | `src/systems/ui/characterEditor.js` | 268, 373 |

**Functionality:**
- Calls `regenerateCharacter(card)`
- Opens guidance modal
- Regenerates all enabled fields and stats
- Updates editor UI in real-time

**Icon:** 🔄 (fa-rotate)

### 4b. Individual Field Regeneration

| Class | Purpose | File | Line |
|-------|---------|------|------|
| `.rpg-char-field-regen` | Regenerate specific field | `src/systems/ui/characterEditor.js` | 305, 339, 379 |

**Functionality:**
- Calls `regenerateCharacterField(card, fieldName)`
- Opens guidance modal
- Regenerates only the specified field (e.g., Appearance, Background, Thoughts)
- Each custom field and the Thoughts field has its own button

**Icon:** 🔄 (fa-rotate)

**Note:** The Thoughts field has a dedicated regeneration button (line 339) that functions identically to other field regeneration buttons but is specifically styled for the textarea layout.

---

## Summary Table

| Button Type | Count | Guidance Modal | Scope |
|-------------|-------|----------------|-------|
| Main Tracker Sections | 3 | ✅ Yes | Entire section |
| Character Card | 1 per card | ✅ Yes | Entire character |
| Thought Bubble | 1 per character | ❌ No | Single thought |
| Editor - Full Character | 1 per card | ✅ Yes | Entire character |
| Editor - Field Regen | 1 per field | ✅ Yes | Single field |

**Total Button Types:** 7  
**Total Buttons in UI:** Variable (depends on number of characters and enabled fields)

---

## Related Files

- **Regeneration Logic:** `src/systems/ui/trackerRegeneration.js`
- **Character Regeneration:** `src/systems/ui/characterRegeneration.js`
- **Character Editor:** `src/systems/ui/characterEditor.js`
- **Rendering:** `src/systems/rendering/userStats.js`, `infoBox.js`, `thoughts.js`

---

## Notes

- All regeneration buttons use the modular prompt builder system
- Guidance modals allow users to provide optional direction for AI generation
- Token limits and stop sequences are configurable per section type
- Regeneration respects enabled/disabled fields in tracker configuration

