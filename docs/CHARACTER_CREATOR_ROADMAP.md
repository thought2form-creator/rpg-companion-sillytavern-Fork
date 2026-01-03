# Character Creator - Development Roadmap

## Overview
A system to create NEW character cards from scratch using AI, with context from the current scene/world.

**Target Backend:** Text Completion (oobabooga)  
**UI Style:** Inline panels (not modals)

---

## ✅ COMPLETED

### Core Backend Functions (`characterCreator.js`)
- [x] Context gathering (world info, existing chars, trackers, chat)
- [x] Prompt building for full character creation
- [x] Prompt building for individual field generation
- [x] LLM calling (internal + external API modes)
- [x] Template management (save/load/delete)
- [x] WIP auto-save (localStorage)
- [x] Export functions (text/JSON/download)
- [x] Preset token detection (needs fixing for oobabooga)

### DEV/Test UI (`characterCreatorUI.js`)
- [x] Modal with test scenarios
- [x] Debug output panel
- [x] Basic generation testing
- [x] WIP save/load testing

---

## 🔧 TO DO - CRITICAL

### 1. Use SillyTavern Connection Profiles ✅ IMPLEMENTED
**Reference:** https://github.com/bmen25124/SillyTavern-Character-Creator
- [x] Use `SillyTavern.getContext().ConnectionManagerRequestService.sendRequest()`
- [x] Let user select a Connection Profile in settings
- [x] Connection Profile handles ALL generation settings (API, preset, model, instruct, temperature, max tokens)
- [x] No need to manually handle Text Completion vs Chat Completion
- [x] Works with oobabooga, OpenAI, and all other backends automatically
- [x] Add profile selector to dev UI
- [x] Graceful fallback to legacy method if no profile selected
- [ ] Add UI overrides for:
  - [ ] Max Response Tokens (override preset setting)
  - [ ] Temperature (override preset setting)
- [ ] Test with oobabooga Text Completion profile
- [ ] Add to production UI (when built)

### 2. Build Production UI (Inline, Not Modal)
- [ ] Decide WHERE the UI should appear (character list? sidebar? button?)
- [ ] Design inline panel layout
- [ ] Create character creator button/trigger
- [ ] Build step-by-step wizard UI:
  - [ ] Step 1: Enter character concept
  - [ ] Step 2: Select template or custom fields
  - [ ] Step 3: Configure context options (chat depth, world info, etc.)
  - [ ] Step 4: Generate & review
  - [ ] Step 5: Edit & finalize
- [ ] Add progress indicators
- [ ] Add field-by-field editing
- [ ] Add regenerate buttons per field

### 3. Character Creator Settings
- [ ] Create dedicated settings section in extension settings
- [ ] Add setting: Max tokens for generation
- [ ] Add setting: Chat context depth (separate from RPG Companion's `updateDepth`)
- [ ] Add setting: Default template selection
- [ ] Add setting: Auto-save WIP toggle
- [ ] Add setting: Include world info toggle
- [ ] Add setting: Include existing chars toggle
- [ ] Add setting: Include trackers toggle

### 4. Template System
- [ ] Create default templates (Fantasy, Sci-Fi, Modern, etc.)
- [ ] Build template editor UI
- [ ] Add template import/export
- [ ] Add field type definitions (text, long text, tags, etc.)
- [ ] Add field validation

### 5. Integration with Character Library
- [ ] Add "Create Character" button to character list
- [ ] Save generated character to SillyTavern's character library
- [ ] Support character card format (PNG with embedded JSON)
- [ ] Add avatar generation option (or placeholder)
- [ ] Test character import into chat

### 6. Field Regeneration
- [ ] Add regenerate button per field (like in Character Editor)
- [ ] Support guidance input for directed regeneration
- [ ] Use same stop sequences as field regeneration system
- [ ] Add undo/redo for field changes

---

## 🎯 TO DO - ENHANCEMENTS

### 7. Advanced Features
- [ ] Batch character creation (create multiple NPCs at once)
- [ ] Character relationship mapping
- [ ] Auto-detect character mentions in chat for quick creation
- [ ] Import character from text description
- [ ] Character variation generator (create similar characters)

### 8. Quality of Life
- [ ] Preview mode before finalizing
- [ ] Character comparison (compare with existing chars)
- [ ] Duplicate detection
- [ ] Character naming suggestions
- [ ] Tag suggestions based on content

### 9. Documentation
- [ ] Create CHARACTER_CREATOR_GUIDE.md
- [ ] Add usage examples
- [ ] Add template creation guide
- [ ] Add troubleshooting section

---

## 🚨 IMMEDIATE PRIORITIES

1. **Fix for oobabooga (Text Completion)**
   - Remove chat message format
   - Use raw text prompts
   - Fix token settings

2. **Decide on UI placement**
   - Where should the character creator appear?
   - Inline panel design

3. **Create Character Creator settings section**
   - Separate from RPG Companion settings
   - Chat depth, max tokens, etc.

---

## Notes
- Current DEV UI is modal-based for testing only
- Production UI must be inline panels
- Must work with Text Completion backends (oobabooga)
- Settings should be independent from main RPG Companion settings

## Key Discovery - Connection Profiles
**We should use SillyTavern's Connection Profile system instead of building our own generation system!**

### Why Connection Profiles?
1. **Handles everything automatically**: API, preset, model, instruct mode, temperature, max tokens
2. **Works with ALL backends**: Text Completion (oobabooga), Chat Completion (OpenAI), etc.
3. **No manual format handling**: No need to check if it's chat vs text completion
4. **User-friendly**: Users already know how to create/manage connection profiles
5. **Proven approach**: Used by SillyTavern-Character-Creator extension successfully

### How It Works:
```javascript
const context = SillyTavern.getContext();
const response = await context.ConnectionManagerRequestService.sendRequest(
    profileId,        // User selects this in settings
    messages,         // Array of {role, content} objects
    maxResponseToken  // Optional override
);
```

### What We Need:
- Profile selector dropdown in Character Creator settings
- Optional overrides for max tokens and temperature in UI
- That's it! Everything else is handled by the profile.

