# Character Field Regeneration Guide

## Overview

Character fields in the editor and thought bubbles can now be regenerated with improved context control and output formatting. The system ensures short, concise outputs appropriate for each field type.

## Features

### 1. Context Control
- **Configurable Depth:** Control how many chat messages are included in regeneration context
- **Default:** 4 messages (configurable in `characterFieldRegenerationSettings.contextDepth`)
- Provides relevant context without overwhelming the LLM

### 2. Output Length Control
- **Short Fields:** Max 100 tokens with strict stop sequences
  - Examples: Relationship, Status, Mood, Location, Class, etc.
  - Output: Single word, short phrase, or one sentence maximum
- **Thoughts Field:** Max 150 tokens with lenient stop sequences
  - Output: 1-3 sentences in first person POV
- **Stop Sequences:** Prevent LLM from generating overly long outputs

### 3. Field Type Detection
Fields are automatically categorized as "short" based on common patterns:
- Relationship, Status, Mood, Location
- Occupation, Class, Race, Species
- Age, Gender, Alignment, Faction
- Title, Rank, Role, Trait, Goal

## How to Use

### In Character Editor

1. **Open Character Editor** - Click the "Advanced Character Editor" button
2. **Find the field** you want to regenerate
3. **Click the regenerate button** (🔄) next to the field
4. **Optional:** Enter guidance for directed regeneration
5. **Click "Regenerate"**

The field will update with a concise, context-appropriate value.

### In Thought Bubble Widget

1. **Ensure thoughts are visible** in chat (toggle in settings)
2. **Click the thought bubble icon** (💭) near a character message
3. **Find the character** whose thought you want to regenerate
4. **Click the small regenerate button** (🔄) in the emoji box
5. The thought updates immediately

## Configuration

### Settings Location
`src/core/config.js` → `characterFieldRegenerationSettings`

### Available Settings

```javascript
characterFieldRegenerationSettings: {
    contextDepth: 4,              // Chat messages to include
    maxTokens: 100,               // Max tokens for regular fields
    stopSequences: [...],         // Stop sequences for short fields
    thoughtsMaxTokens: 150,       // Max tokens for thoughts
    thoughtsStopSequences: [...]  // Stop sequences for thoughts
}
```

### Default Stop Sequences

**Regular Fields:**
- `'\n\n'`, `'\n'` - Prevent multi-line outputs
- `'.'`, `'!'`, `'?'` - Stop at sentence end
- `'"'`, `"'"` - Stop at quote end
- `'###'`, `'Here is'`, `'I hope'` - Prevent meta-commentary

**Thoughts Field:**
- `'\n\n'` - Prevent excessive length
- `'###'` - Prevent meta-commentary
- `'Here is'`, `'I hope'` - Prevent explanations
- `'The character'`, `'As the'` - Prevent third-person narration

## Examples

### Short Field Regeneration

**Field:** Relationship  
**Output:** "Friendly ally"

**Field:** Status  
**Output:** "Exhausted but determined"

**Field:** Location  
**Output:** "Tavern in the merchant district"

### Thoughts Field Regeneration

**Output:** "I can't believe they said that... I need to stay calm and think this through. Maybe there's a way to turn this to my advantage."

## Technical Details

### Prompt Building
- Uses existing character card context
- Includes recent chat messages (configurable depth)
- Includes current tracker data (environment, stats)
- Shows other character fields for context
- Adds field-specific instructions based on type

### API Integration
- Works with both External API and SillyTavern internal generation
- Passes max tokens and stop sequences to both modes
- Maintains consistency with tracker regeneration system

### Data Flow
1. User clicks regenerate button
2. System builds prompt with context
3. Determines field type (short vs thoughts)
4. Applies appropriate max tokens and stop sequences
5. Calls LLM with parameters
6. Parses and cleans response
7. Updates field in UI and data

## Tips

### For Best Results
- **Use guidance** for specific changes (e.g., "Make them more suspicious")
- **Keep fields updated** - accurate current data improves regeneration
- **Adjust context depth** if regenerations don't match recent events
- **Use short field names** that match common patterns for automatic detection

### Troubleshooting
- **Output too long?** Check stop sequences in settings
- **Output too short?** Increase max tokens for that field type
- **Not enough context?** Increase `contextDepth` setting
- **Too much context?** Decrease `contextDepth` setting

## Related Features

- **Character Editor:** Full character regeneration with all fields
- **Tracker Regeneration:** Section-level regeneration with guidance
- **Thought Bubbles:** Visual display of character thoughts in chat

## Future Enhancements

- Per-field custom prompts
- Field-specific max tokens (beyond short/thoughts distinction)
- User-defined field type patterns
- Batch field regeneration
- Regeneration history/undo

