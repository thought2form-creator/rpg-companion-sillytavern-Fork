# Modular Prompt Builder System

A flexible, reusable prompt construction and injection system for the RPG Companion extension, based on the proven architecture from SillyTavern-WorldInfo-Recommender.

## Overview

This system provides a template-based approach to building AI prompts with support for:

- **Dynamic section composition** - Build prompts from modular, reusable sections
- **Context injection at multiple depths** - Inject prompts at different points in the conversation
- **Customizable templates with placeholders** - Use `{placeholder}` syntax for dynamic content
- **Conditional content inclusion** - Enable/disable sections based on runtime conditions
- **Multiple output formats** - XML, Markdown, or plain text
- **Message array building** - Construct OpenAI-style message arrays
- **Suppression evaluation** - Intelligently suppress injections when needed

## Core Components

### 1. ModularPromptBuilder

The main class for building prompts from sections.

```javascript
import { ModularPromptBuilder } from './modularPromptBuilder.js';

const builder = new ModularPromptBuilder({
    format: 'markdown',  // 'xml', 'markdown', or 'plain'
    placeholders: {
        userName: 'Alice',
        location: 'Forest'
    },
    options: {
        sectionSpacing: true  // Add spacing between sections
    }
});

// Add sections
builder.addSection({
    id: 'context',
    enabled: true,
    content: 'You are in {location}.',
    priority: 100  // Higher priority = appears first
});

// Build the prompt
const prompt = builder.build();
```

### 2. PromptInjectionManager

Manages prompt injections at various depths in the conversation.

```javascript
import { PromptInjectionManager } from './modularPromptBuilder.js';

const manager = new PromptInjectionManager();

manager.register({
    id: 'my-injection',
    content: 'Important context',
    type: 'IN_CHAT',
    depth: 0,  // 0 = most recent
    role: 'system',
    ephemeral: true  // Clear after use
});

// Get injections by depth
const depthZero = manager.getByDepth(0);

// Clear ephemeral injections
manager.clearEphemeral();
```

### 3. ContextBuilder

Utilities for building context from various sources.

```javascript
import { ContextBuilder } from './modularPromptBuilder.js';

// Build chat context
const chatContext = ContextBuilder.buildChatContext(messages, {
    depth: 5,
    includeNames: true,
    format: 'xml'
});

// Build character context
const charContext = ContextBuilder.buildCharacterContext(characters, {
    includeDescription: true,
    includePersonality: true,
    format: 'xml'
});

// Build data context
const dataContext = ContextBuilder.buildDataContext(data, {
    format: 'plain',
    label: 'Game State'
});
```

### 4. MessageArrayBuilder

Constructs message arrays for LLM APIs.

```javascript
import { MessageArrayBuilder } from './modularPromptBuilder.js';

const messages = new MessageArrayBuilder()
    .addSystem('You are a helpful assistant.')
    .addUser('Hello!')
    .addAssistant('Hi there!')
    .addChatHistory(chatMessages, { depth: 5 })
    .build();
```

### 5. TemplateUtils

Helper functions for working with templates.

```javascript
import { TemplateUtils } from './modularPromptBuilder.js';

// Extract placeholders
const placeholders = TemplateUtils.extractPlaceholders('Hello {name}!');
// Returns: ['name']

// Compile template
const render = TemplateUtils.compile('Hello {name}!');
const result = render({ name: 'Alice' });
// Returns: 'Hello Alice!'

// Validate placeholders
const validation = TemplateUtils.validatePlaceholders(
    'Hello {name}!',
    { name: 'Alice' }
);
// Returns: { valid: true, missing: [], required: ['name'] }

// Conditional sections
const merged = TemplateUtils.conditional(
    {
        intro: 'Welcome!',
        stats: 'HP: 100',
        outro: 'Goodbye!'
    },
    {
        intro: true,
        stats: false,  // Skip this
        outro: true
    }
);
```

### 6. SuppressionEvaluator

Determines when to suppress prompt injections.

```javascript
import { SuppressionEvaluator } from './modularPromptBuilder.js';

const suppression = SuppressionEvaluator.evaluate(context, data, {
    mode: 'guided',  // 'none', 'guided', or 'impersonation'
    checkGuided: true,
    checkImpersonation: true,
    checkQuiet: true
});

if (suppression.shouldSuppress) {
    console.log('Suppressing because:', suppression.reasons);
    // Don't inject prompts
}
```

### 7. PresetBuilder

Creates common prompt builder presets.

```javascript
import { PresetBuilder } from './modularPromptBuilder.js';

// Instruction preset
const builder = PresetBuilder.createInstructionPreset({
    format: 'plain',
    systemPrompt: 'You are an RPG narrator.',
    instructionTemplate: 'Describe the scene.',
    exampleTemplate: 'Example: The forest is dark.',
    placeholders: { userName: 'Alice' }
});

// Context preset
const contextBuilder = PresetBuilder.createContextPreset({
    format: 'xml',
    includeCharacters: true,
    includeHistory: true,
    includeInstructions: true
});

// Tracker preset
const trackerBuilder = PresetBuilder.createTrackerPreset({
    format: 'markdown',
    trackerSections: [
        { id: 'stats', enabled: true, template: 'HP: {hp}', priority: 100 }
    ]
});
```

## Usage Examples

See `modularPromptBuilder.examples.js` for comprehensive examples including:

1. Basic prompt building
2. Dynamic section management
3. Message array building
4. Context building from chat history
5. Character context building
6. Template utilities
7. Conditional sections
8. Injection management
9. Suppression evaluation
10. Using presets
11. RPG tracker system
12. Multi-format output
13. Complete generation pipeline

## Integration Guide

This system is designed to be **isolated and reusable**. To integrate it into other mechanisms:

1. Import the classes you need
2. Create builders/managers as needed
3. Build prompts with your data
4. Use the output in your generation pipeline

**Do not hook it up to existing systems yet** - keep it isolated until you're ready to integrate.

## Architecture

Based on the proven design from:
- `src/systems/generation/promptBuilder.js` - Prompt construction
- `src/systems/generation/injector.js` - Injection management
- `src/systems/generation/contextBuilder.js` - Context building
- `src/systems/generation/suppression.js` - Suppression logic

## License

Part of the RPG Companion extension for SillyTavern.

