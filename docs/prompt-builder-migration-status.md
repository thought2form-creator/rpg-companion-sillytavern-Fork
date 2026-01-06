# Prompt Builder Migration Status

## Overview

This document tracks which regeneration functions are using the new modular prompt builder system vs. the old prompt building system.

---

## ✅ MIGRATED TO PROMPT BUILDER

### Tracker Section Regeneration

| Function | File | Status |
|----------|------|--------|
| `regenerateTrackerSectionDirect()` | `src/systems/ui/trackerRegeneration.js` | ✅ **USING PROMPT BUILDER** |

**Implementation:**
```javascript
// Line 553
const builder = createPromptBuilder(extensionSettings, sectionType);
const response = await builder.generate({ guidance });
```

**Buttons Using This:**
- User Stats regenerate button (`#rpg-regenerate-user-stats`)
- Info Box regenerate button (`#rpg-regenerate-info-box`)
- Present Characters regenerate button (`#rpg-regenerate-present-characters`)

---

## ❌ NOT YET MIGRATED (Still Using Old System)

### Character Regeneration

| Function | File | Called From | Status |
|----------|------|-------------|--------|
| `buildCharacterRegenerationPrompt()` | `src/systems/ui/characterRegeneration.js` | `characterEditor.js:678, 914` | ❌ **OLD SYSTEM** |
| `buildFieldRegenerationPrompt()` | `src/systems/ui/characterRegeneration.js` | `characterEditor.js:748`<br>`thoughts.js:1847` | ❌ **OLD SYSTEM** |

**Current Implementation:**
```javascript
// characterEditor.js:678
const prompt = await buildCharacterRegenerationPrompt(characterName, currentData, guidance, enabledFields, enabledCharStats);
const response = await callLLMForGeneration(prompt);
```

**Buttons Using This:**
- Character card regenerate button (in Present Characters cards)
- Character editor regenerate button (in character editor modal)
- Character field regenerate buttons (in character editor modal)
- Thought bubble regenerate button (in thought bubble widget)

---

## Migration Plan

### Step 1: Character Card Regeneration
**File:** `src/systems/ui/characterEditor.js`  
**Function:** `regenerateCharacter()` (line ~678)  
**Component:** `characterCard` or `characterEditor`

**Change:**
```javascript
// OLD:
const prompt = await buildCharacterRegenerationPrompt(...);
const response = await callLLMForGeneration(prompt);

// NEW:
const builder = createPromptBuilder(extensionSettings, 'characterCard');
const response = await builder.generate({ 
    guidance,
    characterName,
    currentData,
    enabledFields,
    enabledStats
});
```

### Step 2: Character Field Regeneration
**File:** `src/systems/ui/characterEditor.js`  
**Function:** `regenerateCharacterField()` (line ~748)  
**Component:** `characterField`

**Change:**
```javascript
// OLD:
const prompt = await buildFieldRegenerationPrompt(...);
const response = await callLLMForGeneration(prompt, { maxTokens, stopSequences });

// NEW:
const builder = createPromptBuilder(extensionSettings, 'characterField');
const response = await builder.generate({ 
    guidance,
    characterName,
    fieldName,
    currentData,
    fieldConfig
});
```

### Step 3: Thought Bubble Regeneration
**File:** `src/systems/rendering/thoughts.js`  
**Function:** Inline regeneration (line ~1847)  
**Component:** `thoughtBubble`

**Change:**
```javascript
// OLD:
const prompt = await buildFieldRegenerationPrompt(...);
const response = await callLLMForGeneration(prompt, { maxTokens, stopSequences });

// NEW:
const builder = createPromptBuilder(extensionSettings, 'thoughtBubble');
const response = await builder.generate({ 
    characterName,
    currentData
});
```

---

## Why This Matters

### Current State (Mixed System)
- ✅ Tracker sections use prompt builder (customizable via UI)
- ❌ Character regeneration uses old system (hardcoded prompts)
- ❌ Field regeneration uses old system (hardcoded prompts)
- ❌ Thought bubbles use old system (hardcoded prompts)

### After Migration
- ✅ ALL regeneration uses prompt builder
- ✅ ALL prompts customizable via Prompt Builder UI
- ✅ Consistent system across all features
- ✅ Users can customize every regeneration button

---

## Old Functions to Deprecate

Once migration is complete, these functions can be marked as deprecated:

### In `trackerRegeneration.js`:
- `buildUserStatsRegenerationPrompt()` - Line 180 (not used anymore)
- `buildInfoBoxRegenerationPrompt()` - Line 197 (not used anymore)
- `buildPresentCharactersRegenerationPrompt()` - Line 214 (not used anymore)

### In `characterRegeneration.js`:
- `buildCharacterRegenerationPrompt()` - Line 148 (still used - migrate first!)
- `buildFieldRegenerationPrompt()` - Line 258 (still used - migrate first!)
- `callLLMForGeneration()` - Line 320 (still used - migrate first!)

---

## Testing Checklist

After migration, test each button:

- [ ] User Stats regenerate button
- [ ] Info Box regenerate button
- [ ] Present Characters regenerate button
- [ ] Character card regenerate button (from tracker)
- [ ] Character editor regenerate button (full character)
- [ ] Character field regenerate buttons (individual fields)
- [ ] Thought bubble regenerate button

For each button:
1. Click button → guidance modal appears
2. Enter guidance → generation works
3. Open Prompt Builder → can customize prompts
4. Test with custom prompts → uses custom prompts
5. Restore default → reverts to default

---

## Current Issue

**Problem:** Character regeneration buttons are still using the old prompt building system, which means:
- Prompts are hardcoded in `characterRegeneration.js`
- Cannot be customized via Prompt Builder UI
- Not using the modular section system
- Guidance is added differently than tracker sections

**Solution:** Migrate character regeneration functions to use `createPromptBuilder()` like tracker sections do.

