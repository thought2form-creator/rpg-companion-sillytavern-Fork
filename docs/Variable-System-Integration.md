# Variable System Integration

## Overview

The Prompt Builder now integrates with SillyTavern's built-in variable system (`/setvar`, `/getvar`) to handle dynamic data injection. This allows prompts to use `{{getvar::variableName}}` macros that are automatically processed by SillyTavern.

## How It Works

### 1. Variable Injection

Before generating a prompt, we inject data into SillyTavern's variable system:

```javascript
const builder = createPromptBuilder(extensionSettings, 'thoughtBubble');

// Inject variables
await builder.injectVariables({
    characterName: 'Alice',
    currentThought: 'I wonder what they meant by that...',
    currentMood: '🤔',
    currentRelationship: 'Friend'
});

// Generate (macros will be processed by SillyTavern)
const response = await builder.generate();
```

### 2. Macro Processing

In the prompt template, use `{{getvar::variableName}}` macros:

```
Character: {{getvar::characterName}}
Current thought: {{getvar::currentThought}}
Current mood: {{getvar::currentMood}}
Relationship: {{getvar::currentRelationship}}
```

When the prompt is sent via `generateRaw`, SillyTavern's `substituteParams()` function automatically replaces these macros with the injected values.

### 3. SillyTavern Macros

All standard SillyTavern macros work as expected:
- `{{char}}` - Current character name
- `{{user}}` - User/persona name
- `{{lastMessage}}` - Last message in chat
- `{{persona}}` - User persona description
- etc.

## Implementation Details

### Variable Injector Module

**File:** `src/systems/generation/modular-prompt-system/variable-injector.js`

Provides functions to:
- `setVariable(name, value)` - Set a single variable
- `setVariables(variables)` - Set multiple variables
- `extractCharacterData(characterName, trackerData)` - Extract character data from tracker
- `injectCharacterVariables(characterName, trackerData)` - Inject character-specific variables

### Sender Configuration

**File:** `src/systems/generation/modular-prompt-system/sender.js`

- `USE_GENERATE_RAW = true` - Uses `generateRaw` for macro processing
- `USE_GENERATE_RAW = false` - Uses ConnectionManagerRequestService (no macro processing)

Currently set to `true` to enable macro processing.

### Chat Context Depth

**Added to Prompt Builder UI:**
- Setting stored per component (e.g., `thoughtBubble`, `trackerUpdate`)
- Range: 0-50 messages (0 = disabled)
- Automatically injects recent chat messages via `{{CHAT_CONTEXT}}` placeholder
- Special system section that cannot be deleted

## Example: Thought Bubble Regeneration

### Default Sections

**System Prompt (Priority 100):**
```
You are a helpful assistant that generates character thoughts. Respond with ONLY the thought itself, no preamble or explanation.
```

**Context (Priority 90):**
```
Character: {{getvar::characterName}}
Current thought: {{getvar::currentThought}}
Current mood: {{getvar::currentMood}}
Relationship: {{getvar::currentRelationship}}

Recent conversation:
{{lastMessage}}
```

**Chat Context (Priority 50, System Section):**
```
{{CHAT_CONTEXT}}
```

**Instruction (Priority 80):**
```
Generate a brief internal thought for {{getvar::characterName}} based on the recent conversation. Write in first person POV, up to three sentences. Output ONLY the thought itself.
```

### Execution Flow

1. User clicks regenerate button on thought bubble
2. `regenerateIndividualThought(characterName)` is called
3. Extract current character data from tracker
4. Create prompt builder: `createPromptBuilder(extensionSettings, 'thoughtBubble')`
5. Inject variables: `await builder.injectVariables({ characterName, currentThought, currentMood, currentRelationship })`
6. Build prompt: `builder.build()` - injects chat context based on depth setting
7. Generate: `builder.generate()` - sends via `generateRaw` with macro processing
8. SillyTavern processes all macros (`{{getvar::}}`, `{{char}}`, `{{lastMessage}}`, etc.)
9. Parse response and update character thought

## Benefits

1. **Clean Separation**: Variables are set separately from prompt template
2. **SillyTavern Native**: Uses built-in variable system, no custom parsing needed
3. **Macro Support**: Full access to all SillyTavern macros
4. **Flexible**: Easy to add new variables without changing prompt structure
5. **Debuggable**: Variables can be inspected using `/getvar` command in chat

## Migration Notes

- Old system used `{placeholder}` syntax with manual replacement
- New system uses `{{getvar::variableName}}` macros processed by SillyTavern
- `setTemplateData()` is deprecated in favor of `injectVariables()`
- Chat context depth is now a per-component setting (not global)

