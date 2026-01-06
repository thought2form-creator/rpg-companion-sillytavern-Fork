# Modular Prompt System

A flexible, UI-driven prompt assembly system for SillyTavern extensions.

## Overview

This system allows you to build complex prompts from modular sections, with full UI control over content, ordering, and settings. It's designed to be reusable across multiple components (user stats, info box, character thoughts, etc.).

## Key Features

- **Modular Sections**: Break prompts into discrete, configurable pieces
- **Priority-Based Ordering**: Control section order with numeric priorities
- **Template Processing**: Use `{placeholders}` while preserving `{{STMacros}}`
- **Settings Persistence**: Auto-save to `extensionSettings`
- **Profile Support**: Save/load named configurations
- **Macro Preservation**: Never resolves `{{macros}}` - leaves them for SillyTavern

## Quick Start

```javascript
import { createPromptBuilder } from './modular-prompt-system/index.js';

// Create a builder for your component
const builder = createPromptBuilder(extensionSettings, 'userStats');

// Initialize with default sections (first time only)
builder.initializeDefaults([
    {
        id: 'system',
        content: 'You are a helpful assistant.',
        priority: 100,
        label: 'System Prompt'
    },
    {
        id: 'context',
        content: 'Current user: {{user}}\nCurrent time: {{time}}',
        priority: 90,
        label: 'Context'
    },
    {
        id: 'instruction',
        content: 'Generate updated stats for {{char}}.',
        priority: 80,
        label: 'Instruction'
    }
]);

// Build the prompt
const prompt = builder.build();

// Or build and send in one step
const response = await builder.generate();
```

## Architecture

```
modular-prompt-system/
├── section.js           - Section and SectionCollection classes
├── template.js          - Template processing with macro preservation
├── assembler.js         - Core prompt assembly engine
├── settings-adapter.js  - extensionSettings integration
├── sender.js            - ConnectionManager integration
└── index.js             - Public API
```

## Core Concepts

### Section

A discrete piece of the prompt with:
- **id**: Unique identifier
- **content**: Template string (may contain `{{macros}}` and `{placeholders}`)
- **priority**: Numeric ordering (higher = earlier in prompt)
- **enabled**: Toggle on/off
- **label**: Human-readable name for UI
- **description**: Tooltip text for UI

### Template Processing

- `{placeholder}` - Replaced with data from `templateData`
- `{{macro}}` - Preserved for SillyTavern's macro engine
- Never resolves macros - just passes them through

### Settings Structure

```javascript
extensionSettings.promptConfigs = {
    userStats: {
        assembler: { /* serialized assembler state */ },
        maxTokens: 2048,
        profileId: 'profile-uuid',
        profiles: {
            'Default': { assembler: {...}, maxTokens: 2048 },
            'Detailed': { assembler: {...}, maxTokens: 4096 }
        }
    },
    infoBox: { /* ... */ },
    // ... other components
}
```

## API Reference

### PromptBuilder

Main interface for building prompts.

#### Methods

- `addSection(section)` - Add a new section
- `getSection(id)` - Get section by ID
- `updateSectionContent(id, content)` - Update section content
- `toggleSection(id, enabled)` - Enable/disable section
- `updateSectionPriority(id, priority)` - Change section priority
- `setTemplateData(data)` - Set placeholder data
- `build(options)` - Build final prompt string
- `generate(options)` - Build and send for generation
- `save()` - Save current state
- `saveAsProfile(name)` - Save as named profile
- `loadProfile(name)` - Load named profile
- `getProfiles()` - List available profiles
- `getMaxTokens()` / `setMaxTokens(n)` - Max tokens setting
- `getProfileId()` / `setProfileId(id)` - Profile ID setting

## Usage Patterns

### Basic Usage

```javascript
const builder = createPromptBuilder(extensionSettings, 'myComponent');
const prompt = builder.build();
```

### With Template Data

```javascript
builder.setTemplateData({
    userName: 'Alice',
    context: 'battle scene'
});
const prompt = builder.build();
// {userName} replaced with 'Alice'
// {{user}} preserved for ST
```

### Managing Sections

```javascript
// Add section
builder.addSection({
    id: 'intro',
    content: 'Hello {{user}}!',
    priority: 100
});

// Update content
builder.updateSectionContent('intro', 'Greetings {{user}}!');

// Toggle enabled
builder.toggleSection('intro', false);

// Change priority
builder.updateSectionPriority('intro', 95);
```

### Profiles

```javascript
// Save current state as profile
builder.saveAsProfile('Detailed Mode');

// Load profile
builder.loadProfile('Detailed Mode');

// List profiles
const profiles = builder.getProfiles();
```

## Integration with UI

The UI should:

1. Display all sections with their labels
2. Allow editing content (textarea)
3. Allow toggling enabled state (checkbox)
4. Allow adjusting priority (number input or drag-to-reorder)
5. Show max tokens setting
6. Show profile selector
7. Auto-save on every change (builder.save() is automatic)

## Testing

See the test component implementation for a working example.

