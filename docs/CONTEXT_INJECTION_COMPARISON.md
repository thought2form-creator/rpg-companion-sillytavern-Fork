# Context Injection System Comparison

## WorldInfo Recommender vs RPG Companion

This document compares the context injection systems used by both extensions to determine compatibility.

---

## WorldInfo Recommender System

### Architecture

**Uses**: `buildPrompt()` from `sillytavern-utils-lib`

**Location**: `src/generate.ts` (lines 39-295)

### Context Building Flow

1. **Profile-Based Configuration** (lines 50-62)
   - Uses SillyTavern Connection Profiles
   - Determines API type from profile
   - Configures preset, context template, instruct template, system prompt

2. **Template Data Preparation** (lines 64-121)
   ```typescript
   const templateData = {
     user: '{{user}}',
     char: '{{char}}',
     persona: '{{persona}}',
     blackListedEntries: session.blackListedEntries,
     userInstructions: compiledUserPrompt,
     currentLorebooks: filteredLorebookEntries,
     suggestedLorebooks: previousSuggestions
   };
   ```

3. **Message Array Construction** (lines 123-169)
   - Iterates through `mainContextList` (user-defined prompt sections)
   - Special handling for `chatHistory` section:
     ```typescript
     if (mainContext.promptName === 'chatHistory') {
       messages.push(...(await buildPrompt(selectedApi, buildPromptOptions)).result);
     }
     ```
   - Other sections: Handlebars template compilation + `substituteParams()`
   - Each section becomes a message with role (system/user/assistant)

4. **BuildPromptOptions** (MainPopup.tsx lines 263-304)
   ```typescript
   {
     presetName: profile.preset,
     contextName: profile.context,
     instructName: profile.instruct,
     syspromptName: profile.sysprompt,
     ignoreCharacterFields: !settings.contextToSend.charCard,
     ignoreWorldInfo: true,  // ← IMPORTANT: They ignore ST's built-in WI
     ignoreAuthorNote: !settings.contextToSend.authorNote,
     maxContext: 'preset' | 'active' | customValue,
     messageIndexesBetween: { start, end }  // Message range selection
   }
   ```

5. **World Info Handling**
   - **Explicitly ignores** SillyTavern's automatic world info injection (`ignoreWorldInfo: true`)
   - Manually filters and includes lorebooks via template data
   - Passes filtered entries to Handlebars templates
   - Templates format the lorebook data as needed

### Key Features

- ✅ **Modular prompt sections** with user-defined roles
- ✅ **Handlebars templating** for flexible formatting
- ✅ **Message-based structure** (array of {role, content})
- ✅ **Granular control** over what context is included
- ✅ **Profile-based configuration** (preset, context, instruct templates)
- ✅ **Message range selection** (first N, last N, range, all, none)

---

## RPG Companion System

### Architecture

**Uses**: Direct string concatenation + `getWorldInfoPrompt()` calls

**Location**: `src/systems/generation/encounterPrompts.js`

### Context Building Flow

1. **String-Based Prompt Building** (lines 115-297)
   ```javascript
   let prompt = '';
   prompt += systemPrompt + '\n\n';
   prompt += '<setting>\n' + worldInfo + '\n</setting>\n\n';
   prompt += '<characters>\n' + characterInfo + '\n</characters>\n\n';
   prompt += '<persona>\n' + personaText + '\n</persona>\n\n';
   prompt += '<history>\n' + chatHistory + '\n</history>\n\n';
   prompt += '<context>\n' + trackerData + '\n</context>\n\n';
   prompt += instructions;
   ```

2. **World Info Injection** (lines 131-193)
   ```javascript
   // Primary method: Call getWorldInfoPrompt()
   const getWorldInfoFn = context.getWorldInfoPrompt || window.getWorldInfoPrompt;
   const result = await getWorldInfoFn(chatMessages, 8000, false);
   const worldInfoString = result?.worldInfoString || result;
   
   // Fallback: Use context.activatedWorldInfo array
   if (!worldInfoAdded && context.activatedWorldInfo) {
     context.activatedWorldInfo.forEach(entry => {
       prompt += entry.content + '\n\n';
     });
   }
   ```

3. **Character Info** (lines 53-108)
   - Manually extracts character descriptions and personalities
   - Formats as XML tags: `<character1="Name">...</character1>`
   - Handles both group chats and single character

4. **Chat History** (lines 220-247)
   - Manually slices last N messages from `chat` array
   - Formats as: `SpeakerName: message content\n\n`
   - No template processing

5. **Tracker Context** (lines 249-283)
   - Directly includes committed tracker data
   - User stats, inventory, skills, attributes
   - Present characters from characterThoughts

6. **Profile Variables** (lines 21-47)
   - Custom system: `{ENCOUNTER_TYPE}`, `{ENCOUNTER_GOAL}`, etc.
   - Simple string replacement (not Handlebars)
   - Applied to system prompts and instructions

### Key Features

- ✅ **Direct control** over prompt structure
- ✅ **XML-tagged sections** for clear boundaries
- ✅ **Uses ST's native world info system** (`getWorldInfoPrompt()`)
- ✅ **Simple string concatenation** (no message array)
- ✅ **Profile variable injection** (custom system)
- ❌ **No message-based structure** (single string prompt)
- ❌ **No Handlebars templating**
- ❌ **Fixed prompt order** (less flexible)

---

## Compatibility Analysis

### ✅ Compatible Aspects

1. **World Info Access**
   - Both can access SillyTavern's world info system
   - WI Recommender: Uses `buildPrompt()` which calls `getWorldInfoPrompt()` internally
   - RPG Companion: Calls `getWorldInfoPrompt()` directly
   - **Result**: Both get the same activated lorebook entries

2. **Character Context**
   - Both extract character cards (description, personality)
   - Both handle group chats vs single character
   - Different formatting, but same source data

3. **Chat History**
   - Both access the `chat` array
   - Both can limit depth/range
   - Different formatting approaches

4. **Persona/User Info**
   - Both use `substituteParams('{{persona}}')`
   - Both include user name

### ⚠️ Incompatible Aspects

1. **Prompt Structure**
   - **WI Recommender**: Message array `[{role, content}, ...]`
   - **RPG Companion**: Single concatenated string
   - **Impact**: Cannot directly swap systems

2. **Template System**
   - **WI Recommender**: Handlebars templates
   - **RPG Companion**: Simple string replacement
   - **Impact**: Different variable syntax and capabilities

3. **Configuration**
   - **WI Recommender**: Connection Profiles (preset, context, instruct)
   - **RPG Companion**: Extension settings + encounter profiles
   - **Impact**: Different configuration UIs

4. **World Info Control**
   - **WI Recommender**: Manually filters and formats lorebooks
   - **RPG Companion**: Uses ST's automatic activation
   - **Impact**: Different levels of control

---

## Integration Strategy

### Option 1: Hybrid Approach (Recommended)

**Keep RPG Companion's current system** for encounters, but **add WI Recommender's selector UI**:

1. Add lorebook selector UI (multi-select dropdown + entry picker)
2. Store selections in extension settings
3. **Modify `getWorldInfoPrompt()` call** to filter results:
   ```javascript
   const result = await getWorldInfoFn(chatMessages, 8000, false);
   let worldInfoString = result?.worldInfoString || result;
   
   // NEW: Filter based on user selection
   if (extensionSettings.selectedLorebooks) {
     worldInfoString = filterWorldInfoBySelection(
       worldInfoString,
       extensionSettings.selectedLorebooks,
       extensionSettings.selectedEntryUids
     );
   }
   ```

**Pros**:
- ✅ Minimal changes to existing prompt system
- ✅ Keeps XML structure and string-based approach
- ✅ Adds granular lorebook control
- ✅ No breaking changes

**Cons**:
- ❌ Requires parsing/filtering world info string
- ❌ Less elegant than message-based system

### Option 2: Adopt Message-Based System

**Rewrite encounter prompts** to use `buildPrompt()` and message arrays:

**Pros**:
- ✅ More flexible and modular
- ✅ Better alignment with ST's architecture
- ✅ Easier to add/remove context sections
- ✅ Native lorebook filtering

**Cons**:
- ❌ Major refactor required
- ❌ Breaking changes to custom prompts
- ❌ Need to migrate all prompt templates

---

## Recommendation

**Use Option 1 (Hybrid Approach)** because:

1. RPG Companion's string-based system works well for its use case
2. The XML-tagged structure is clear and debuggable
3. Minimal disruption to existing functionality
4. Can add lorebook selector without rewriting core system
5. Users' custom prompts continue to work

**Implementation Steps**:
1. Add lorebook selector UI (copy from WI Recommender)
2. Store selections in `extensionSettings`
3. Create filter function to parse and filter world info string
4. Apply filter after `getWorldInfoPrompt()` call
5. Add debug logging to show what's being filtered


