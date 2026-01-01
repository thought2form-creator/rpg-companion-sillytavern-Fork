# RPG Companion Enhanced - Fork Changelog

This document tracks all changes made to the fork of RPG Companion by SpicyMarinara.

**Original Repository:** https://github.com/SpicyMarinara/rpg-companion-sillytavern  
**Original Author:** Marysia (marinara_spaghetti)  
**Fork Version:** 2.1.0  
**Date Started:** 2026-01-01

---

## Version 2.1.0 - Enhanced Edition

### Overview
This fork adds extensive editing capabilities, selective regeneration, character state management, and enhanced encounter system controls.

### Bug Fixes

#### Character Data Corruption Fix
- **Files Modified:** `src/systems/rendering/thoughts.js`
- **Issue:** Editing character fields in the main UI could sometimes overwrite data from other characters or cause character reordering
- **Root Cause:** Stale `data-character` attributes when character names were changed, and insufficient validation in character lookup
- **Fixes Applied:**
  - Added input validation to prevent invalid character names or fields from being processed
  - Improved character matching algorithm: exact match priority, then case-insensitive fallback
  - Auto-update all `data-character` attributes within a character card when the name is changed
  - Added detailed error logging when character is not found during updates, showing available characters
  - Prevents data mixing between characters and maintains stable character order

#### Scroll Position Preservation Fix
- **Files Modified:** `src/systems/rendering/thoughts.js`
- **Issue:** When editing character fields in the Present Characters panel or thought bubble widget, the panels would jump to the top after each edit
- **Root Cause:** `renderThoughts()` and `updateChatThoughts()` completely re-render panels without preserving scroll position
- **Fixes Applied:**
  - **Present Characters Panel:**
    - Save scroll position before calling `renderThoughts()`
    - Restore scroll position after re-rendering completes
    - Applied to all functions that trigger re-renders:
      - `updateCharacterField()` - when editing any character field
      - `removeCharacter()` - when removing a character
      - Avatar upload handlers - when changing character avatars
  - **Thought Bubble Widget:**
    - Save scroll position before removing existing bubble in `updateChatThoughts()`
    - Restore scroll position after new bubble is created
    - Skip fade-in animation when updating (only animate on initial creation)
    - Prevents jumping and visual glitches when editing thoughts or regenerating individual thoughts
    - Added `rpg-no-animation` class to disable animation on updates
  - Maintains user's scroll position for better UX when editing characters lower in the list

### Changes Made

#### 1. Metadata Updates
- **File:** `manifest.json`
  - Changed display_name to "RPG Companion Enhanced"
  - Updated version to 2.1.0
  - Updated author field to indicate fork
  - Updated homePage URL

#### 2. Advanced Character Editor
- **New File:** `src/systems/ui/characterEditor.js`
  - Created modal-based character editor with Quick Reply-style interface
  - Functions: `openCharacterEditor()`, `parseCharactersFromData()`, `renderCharacterEditorCard()`
  - Features:
    - Edit all character fields in one place (emoji, name, custom fields, relationship, stats, thoughts)
    - Individual field editing with dedicated inputs
    - Character removal with confirmation
    - Save/load character states (placeholder implemented)
    - Regenerate entire character or specific fields (placeholder implemented)
    - Responsive grid layout for character stats

- **Modified File:** `src/systems/rendering/thoughts.js`
  - Added section header with "Advanced Character Editor" button
  - Added dynamic import for character editor module
  - Button appears above Present Characters panel

- **Modified File:** `index.js`
  - Added import for `openCharacterEditor` from characterEditor.js module

- **Modified File:** `style.css`
  - Added complete styling for character editor modal (lines 8675-8865)
  - Styles include: card layout, input fields, buttons, stats grid, scrollbar
  - Responsive design with hover effects

#### 3. Add Character Functionality
- **Modified File:** `src/systems/ui/characterEditor.js`
  - Implemented "Add Character" button functionality
  - Functions: `showAddCharacterModal()`, `addCharacterToEditor()`
  - Features:
    - Modal dialog for entering character name
    - Duplicate name detection
    - Option to search chat context (placeholder for future implementation)
    - Creates character with default values (emoji, relationship, stats)
    - Automatically scrolls to new character in editor
    - Proper validation and user feedback

#### 4. Character Regeneration System
- **New File:** `src/systems/ui/characterRegeneration.js`
  - AI-powered character data generation
  - Functions:
    - `buildCharacterRegenerationPrompt()` - Builds prompts for full character regeneration
    - `buildFieldRegenerationPrompt()` - Builds prompts for single field regeneration
    - `callLLMForGeneration()` - Handles LLM API calls (supports both external and internal modes)
    - `parseCharacterRegenerationResponse()` - Parses full character data from LLM response
    - `parseFieldRegenerationResponse()` - Parses single field value from LLM response
  - Features:
    - Uses same prompt style as main extension (character cards, context, structured instructions)
    - Includes recent chat context and tracker data
    - Supports optional user guidance for directed regeneration
    - Works with both external API and SillyTavern's internal generation
    - Thoughts field uses exact same format as main tracker: "Internal monologue (in first person POV, up to three sentences long)"
    - Respects user-configured thoughts description from settings

- **Modified File:** `src/systems/ui/characterEditor.js`
  - Implemented regeneration button handlers
  - Functions:
    - `regenerateCharacter()` - Regenerates all fields for a character
    - `regenerateCharacterField()` - Regenerates a specific field
    - `showGuidanceModal()` - Shows modal for optional user guidance
  - Features:
    - "Regenerate Character" button regenerates all fields
    - Individual field regenerate buttons for targeted updates
    - Optional guidance input for directed generation
    - Proper error handling and user feedback
    - Updates UI immediately after successful regeneration

#### 5. Tracker Section Regeneration System
- **New File:** `src/systems/ui/trackerRegeneration.js`
  - AI-powered tracker section regeneration
  - Functions:
    - `buildUserStatsRegenerationPrompt()` - Builds prompts for User Stats section
    - `buildInfoBoxRegenerationPrompt()` - Builds prompts for Info Box section
    - `buildPresentCharactersRegenerationPrompt()` - Builds prompts for Present Characters section
    - `callLLMForTrackerGeneration()` - Handles LLM API calls (supports both external and internal modes)
    - `parseTrackerRegenerationResponse()` - Cleans up LLM response (removes markdown/XML)
    - `showTrackerRegenerationDialog()` - Shows modal for optional user guidance
    - `regenerateTrackerSection()` - Main regeneration function that updates data and re-renders
    - `regenerateTrackerSectionDirect()` - Direct regeneration without modal (for quick regenerate)
  - Features:
    - Each section has specialized prompts with proper context injection
    - Includes character cards, environment data, and recent chat context
    - Supports optional user guidance (e.g., "Make it nighttime", "Increase health to 80%")
    - Works with both external API and SillyTavern's internal generation
    - Respects tracker configuration (enabled fields, custom names, descriptions)
    - Automatic data persistence to chat metadata and swipe data
    - Per-section max tokens and stop sequences for controlled output length
    - Default stop sequences prevent narrative continuation

- **Modified Files:**
  - `src/systems/rendering/userStats.js`
    - Added section header with "Regenerate User Stats" button
    - Event handler for quick regenerate (no guidance modal)
  - `src/systems/rendering/infoBox.js`
    - Added section header with "Regenerate Info Box" button
    - Event handler for quick regenerate (no guidance modal)
  - `src/systems/rendering/thoughts.js`
    - Added "Regenerate Present Characters" button next to existing editor button
    - Event handler for quick regenerate (no guidance modal)
  - Features:
    - Regenerate buttons (🔄) in section headers
    - Direct regeneration without modal for quick updates
    - Loading toast during generation
    - Success/error feedback to user

#### 6. Tracker Regeneration Context Control & Prompting Improvements
- **Modified File:** `src/core/config.js`
  - Added per-section regeneration settings:
    - `sectionRegenerationSettings.userStats` - Max tokens (500) and stop sequences
    - `sectionRegenerationSettings.infoBox` - Max tokens (300) and stop sequences
    - `sectionRegenerationSettings.characterThoughts` - Max tokens (1000) and stop sequences
  - Added custom prompt settings:
    - `customUserStatsPrompt` - Custom prompt override for User Stats regeneration
    - `customInfoBoxPrompt` - Custom prompt override for Info Box regeneration
    - `customCharacterThoughtsPrompt` - Custom prompt override for Present Characters regeneration
  - Features:
    - Configurable output length per section
    - Stop sequences prevent LLM from continuing into narrative
    - Custom prompts allow fine-tuned control over regeneration behavior

- **Modified File:** `src/systems/ui/trackerRegeneration.js`
  - Implemented per-section settings with fallback to defaults
  - Stop sequences passed to both external API and internal generation
  - Max tokens limits output length appropriately per section
  - Default stop sequences: `['###TRACKER_END###', '\n\n---', '\n\nThe ', '\n\nAs ', '\n\nSuddenly', '\n\n*', 'Here is', 'I hope']`

- **Modified File:** `src/systems/generation/promptBuilder.js`
  - Enhanced `generateSeparateUpdatePrompt()` to support custom prompts per section
  - Checks for `customUserStatsPrompt`, `customInfoBoxPrompt`, `customCharacterThoughtsPrompt`
  - Uses custom prompt as main instruction if available
  - Maintains backwards compatibility when custom prompts are empty

- **New File:** `TRACKER_REGENERATION_GUIDE.md`
  - Comprehensive user guide for tracker regeneration feature
  - Sections:
    - How to use each regeneration button
    - Example guidance inputs
    - Technical details on context injection
    - API configuration notes
    - Data persistence explanation
    - Tips for effective use

#### 7. Character Field Regeneration Improvements
- **Modified File:** `src/core/config.js`
  - Added `characterFieldRegenerationSettings` configuration object:
    - `contextDepth` - Configurable chat context depth for field regeneration (default: 4)
    - `maxTokens` - Max tokens for short field outputs (default: 100)
    - `stopSequences` - Stop sequences for short fields to prevent over-generation
    - `thoughtsMaxTokens` - Specific max tokens for thoughts field (default: 150)
    - `thoughtsStopSequences` - Specific stop sequences for thoughts field
  - Features:
    - Separate control for thoughts vs other fields
    - Prevents LLM from generating overly long field values
    - Stop sequences ensure concise, appropriate outputs

- **Modified File:** `src/systems/ui/characterRegeneration.js`
  - Updated `callLLMForGeneration()` to accept optional parameters:
    - `maxTokens` - Limits output length
    - `stopSequences` - Array of stop sequences
  - Passes parameters to both external API and internal generation
  - Maintains backwards compatibility when parameters not provided

- **Modified File:** `src/systems/ui/characterEditor.js`
  - Updated `regenerateCharacterField()` to use field regeneration settings
  - Applies different settings for thoughts vs regular fields:
    - Thoughts: 150 max tokens, lenient stop sequences
    - Regular fields: 100 max tokens, strict stop sequences for short outputs
  - Ensures field outputs are concise and appropriate

#### 8. Individual Thought Regeneration in Popup Widget
- **Modified File:** `src/systems/rendering/thoughts.js`
  - Added regenerate button (🔄) to each character's emoji box in thought bubble
  - New function: `regenerateIndividualThought(characterName)`
    - Regenerates a single character's thought from the popup widget
    - Parses current character data from Present Characters
    - Uses field regeneration settings for thoughts
    - Updates thought in-place without closing popup
  - Event handler for regenerate button click
  - Features:
    - Quick regeneration without opening character editor
    - Maintains context from current character data
    - Uses same prompting system as character editor
    - Provides user feedback via toasts

- **Modified File:** `style.css`
  - Added styling for `.rpg-thought-regen-btn`:
    - Small circular button positioned at bottom-right of emoji box
    - Hover effects (scale, opacity, color change)
    - Compact design (16x16px) to fit in emoji box
    - High z-index to ensure clickability
  - Updated `.rpg-thought-emoji-box` to use flexbox column layout for button positioning

#### 9. Character Library Integration Hooks
- **Modified File:** `src/systems/ui/characterRegeneration.js`
  - Added future integration hooks for SillyTavern character library
  - Functions:
    - `getCharacterLibraryData()` - Placeholder function for character library lookup (currently returns null)
  - Features:
    - Hook integrated into both full character and single field regeneration prompts
    - When implemented, will inject character card data (description, personality, example dialogues) into regeneration context
    - Backwards compatible - returns null until implemented, system works as before
    - Allows future consistency between Present Characters and library character cards
  - Documentation:
    - Added comprehensive JSDoc comments explaining the hook
    - Module header documents the future enhancement plan
    - Includes implementation examples in comments

- **New File:** `docs/CHARACTER_LIBRARY_HOOKS.md`
  - Complete implementation guide for character library integration
  - Sections:
    - Overview of the hook system
    - Current implementation status
    - Integration points in the codebase
    - Step-by-step implementation guide with code examples
    - Use cases and benefits
    - Implementation checklist
  - Ready for future development when feature is needed

---

## Planned Features (In Progress)

### Present Characters Panel Enhancements
- [ ] Advanced editing panel (Quick Reply-style modal)
- [ ] Character state save/load system
- [ ] Regenerate individual character
- [ ] Regenerate specific fields within character
- [ ] Character card description integration for generation context
- [ ] Duplicate character card handling with image selection
- [ ] Force generation with name prompt and context search

### Overall Tracker Enhancements
- [ ] Field-level regeneration buttons (Status, Inventory, Quests tabs)

### Encounter System Enhancements
- [ ] Edit encounter elements before/after generation
- [ ] Regenerate specific encounter elements
- [ ] Add/remove encounter elements
- [ ] Enhanced control over initial generation

### Documentation
- [ ] Context injection flow documentation
- [ ] Generation system documentation

---

## Technical Notes

### Dependencies
- Requires SillyTavern staging branch
- Compatible with LALib (https://github.com/LenAnderson/SillyTavern-LALib)

### Architecture Notes
- Uses SillyTavern's `setExtensionPrompt()` for context injection
- Supports three generation modes: Together, Separate, External
- Data stored in multi-line format with sections separated by headers

---

## Credits
- **Original Extension:** Marinara (marinara_spaghetti)
- **Fork Enhancements:** [Placeholder]
- **Testing & Feedback:** [To be added]

---

## Notes for Original Author

This fork was created to add functionality requested by users. All changes are documented here for potential integration into the main repository. The code maintains the original architecture and coding style where possible.

If you'd like to integrate any of these features, please feel free to use this code under the original AGPL-3.0 license.

