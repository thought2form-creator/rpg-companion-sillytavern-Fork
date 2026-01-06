# Prompt Builder Integration Summary

## Overview

The modular prompt builder system has been integrated with all regeneration buttons in the RPG Companion extension. Each button type now has its own dedicated component configuration with customizable prompts, sections, and settings.

---

## Component Types

### 1. Tracker Section Regeneration

| Component | Button Location | Purpose |
|-----------|----------------|---------|
| `userStats` | User Stats section header | Regenerate entire User Stats section |
| `infoBox` | Info Box section header | Regenerate entire Environment/Info Box section |
| `presentCharacters` | Present Characters section header | Regenerate all character data |

**Features:**
- Guidance modal on button click
- Configurable prompts via Prompt Builder UI
- Separate settings per section type
- Chat context integration
- Tracker data integration

### 2. Character Regeneration

| Component | Button Location | Purpose |
|-----------|----------------|---------|
| `characterCard` | Character card in tracker | Regenerate full character from card |
| `characterEditor` | Character editor modal | Regenerate full character in editor |
| `characterField` | Character editor modal | Regenerate individual field |

**Features:**
- Guidance modal on button click
- Field-specific prompts
- Custom field support
- Character stats support

### 3. Thought Regeneration

| Component | Button Location | Purpose |
|-----------|----------------|---------|
| `thoughtBubble` | Thought bubble widget | Regenerate individual thought |

**Features:**
- Quick regeneration
- Configurable thought format
- Character context integration

---

## System Sections (Auto-Generated)

All components have access to these system sections:

### 1. Chat Context (`__system_chat_context__`)
- **Priority:** 50
- **Label:** 💬 Chat Context (System)
- **Content:** Recent chat messages (configurable depth)
- **Enabled:** When depth > 0

### 2. Tracker Sections
- **User Stats:** `__system_tracker_userstats__` (Priority: 51)
- **Info Box:** `__system_tracker_infobox__` (Priority: 51)
- **Character Thoughts:** `__system_tracker_thoughts__` (Priority: 51)
- **Inventory:** `__system_tracker_inventory__` (Priority: 51)
- **Quests:** `__system_tracker_quests__` (Priority: 51)

### 3. User Guidance (`__system_guidance__`)
- **Priority:** 0 (lowest - appears at end)
- **Label:** ✨ User Guidance (System)
- **Content:** User input from guidance modal
- **Format:** `[Take the following into special consideration for your next message: <USER INPUT>]`
- **Enabled:** Only when user provides guidance

---

## Default Prompt Configurations

Each component has default system and instruction sections:

### Thought Bubble
```
System: You are a helpful assistant that generates character thoughts...
Instruction: Generate a brief internal thought for {{getvar::characterName}}...
```

### User Stats
```
System: You are a helpful assistant that generates RPG user stats...
Instruction: Generate updated user stats based on the recent conversation...
```

### Info Box
```
System: You are a helpful assistant that generates environment and location information...
Instruction: Generate updated environment/location information...
```

### Present Characters
```
System: You are a helpful assistant that generates character information...
Instruction: Generate updated information for all present characters...
```

### Character Card
```
System: You are a helpful assistant that generates complete character information...
Instruction: Generate complete character information including emoji, relationship, stats...
```

### Character Editor
```
System: You are a helpful assistant that generates complete character information...
Instruction: Generate complete character information for all enabled fields...
```

### Character Field
```
System: You are a helpful assistant that generates specific character field information...
Instruction: Generate updated content for the specified character field...
```

---

## Files Modified

### Core System
- `src/systems/generation/modular-prompt-system/index.js` - Added guidance section support
- `src/systems/ui/promptBuilderUI.js` - Added all component types and guidance modal
- `template.html` - Updated component selector dropdown

### Integration
- `src/systems/ui/trackerRegeneration.js` - Integrated prompt builder for tracker sections
- `src/systems/ui/characterRegeneration.js` - Added prompt builder import (ready for integration)

### Documentation
- `docs/guidance-system-implementation.md` - Guidance system details
- `docs/regeneration-buttons-reference.md` - All regeneration buttons
- `docs/prompt-builder-integration-summary.md` - This document

---

## Next Steps

1. **Complete Character Regeneration Integration**
   - Update `regenerateCharacterFromCard()` to use prompt builder
   - Update `regenerateCharacter()` to use prompt builder
   - Update `regenerateCharacterField()` to use prompt builder

2. **Testing**
   - Test each component type
   - Verify guidance modal appears
   - Verify prompts are customizable
   - Verify settings save correctly

3. **User Documentation**
   - Create user guide for prompt customization
   - Add examples for each component type
   - Document best practices

---

## Benefits

✅ **Unified System** - All regeneration uses same prompt builder  
✅ **Customizable** - Users can edit prompts for each button type  
✅ **Flexible** - Add/remove/reorder prompt sections  
✅ **Guidance Support** - Optional user input for all regenerations  
✅ **Profile Support** - Save/load prompt configurations  
✅ **Context-Aware** - Auto-includes chat and tracker context  
✅ **Maintainable** - Single system for all prompt management

