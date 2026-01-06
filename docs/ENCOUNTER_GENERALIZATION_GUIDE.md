# Encounter System Generalization - Implementation Guide

## Executive Summary

This document outlines the strategy to transform the encounter system from a **combat-specific tool** into a **general-purpose encounter framework** while maintaining:
- Complete backward compatibility
- JSON parsing stability
- Support for ≤13B models
- Existing encounter loop architecture

**Key Principle**: Mechanics and semantics are separate. The same HP/attack/status mechanics can represent different narrative concepts through contextual reinterpretation.

---

## Current System Architecture

### Three Prompt Types

Each prompt type has a **system message** and **instructions** component:

#### 1. Encounter Initialization
- **System**: `encounterInitSystem` - Establishes GM role
- **Instructions**: `encounterInitInstructions` - Requests JSON with party/enemies/environment
- **Purpose**: Generate initial state from chat context
- **Location**: `src/systems/generation/encounterPrompts.js` → `buildEncounterInitPrompt()`

#### 2. Combat Action
- **System**: `combatActionSystem` - Reinforces GM role during encounter
- **Instructions**: `combatActionInstructions` - Requests JSON with updated stats + narrative
- **Purpose**: Process player actions and update state
- **Location**: `src/systems/generation/encounterPrompts.js` → `buildCombatActionPrompt()`

#### 3. Combat Summary
- **System**: `combatSummarySystem` - Sets up summary generation
- **Instructions**: `combatSummaryInstructions` - Requests narrative prose
- **Purpose**: Create canonical summary for chat history
- **Location**: `src/systems/generation/encounterPrompts.js` → `buildCombatSummaryPrompt()`

### Default Prompts Storage
- **Defined in**: `src/systems/ui/promptsEditor.js` → `DEFAULT_PROMPTS` object
- **User overrides**: Stored in `extensionSettings.custom*Prompt` fields
- **Fallback logic**: `extensionSettings.customPrompt || DEFAULT_PROMPTS.promptName`

---

## Current Hardcoded Combat Focus

All prompts explicitly reference "combat":
- "combat encounter"
- "combat state"
- "HP" = physical health
- "attacks" = combat maneuvers
- Victory/defeat based on HP depletion

---

## Proposed Generalization Strategy

### Profile-Based Variable Substitution System

Transform semantic interpretation through **controlled variable injection** without changing mechanics.

### Encounter Profile Schema

```javascript
{
  ENCOUNTER_TYPE: string,           // "combat" | "social" | "stealth" | "investigation"
  ENCOUNTER_GOAL: string,            // What success means
  ENCOUNTER_STAKES: string,          // "low" | "medium" | "high"
  RESOURCE_INTERPRETATION: string,   // What HP represents
  ACTION_INTERPRETATION: string,     // What attacks represent
  STATUS_INTERPRETATION: string,     // What statuses represent
  SUMMARY_FRAMING: string           // How to frame the summary
}
```

### Default Combat Profile (Backward Compatibility)

```javascript
{
  ENCOUNTER_TYPE: "combat",
  ENCOUNTER_GOAL: "defeat opposing forces",
  ENCOUNTER_STAKES: "medium",
  RESOURCE_INTERPRETATION: "physical health and endurance",
  ACTION_INTERPRETATION: "attacks, skills, and combat maneuvers",
  STATUS_INTERPRETATION: "physical or magical conditions",
  SUMMARY_FRAMING: "a complete battle recap"
}
```

---

## Example Alternative Profiles

### Social Encounter
```javascript
{
  ENCOUNTER_TYPE: "social",
  ENCOUNTER_GOAL: "persuade or manipulate the opposition",
  ENCOUNTER_STAKES: "high",
  RESOURCE_INTERPRETATION: "composure, leverage, and social standing",
  ACTION_INTERPRETATION: "arguments, appeals, and social maneuvers",
  STATUS_INTERPRETATION: "emotional states and social conditions",
  SUMMARY_FRAMING: "a diplomatic exchange recap"
}
```
- **HP** = composure/patience (0 = breakdown/concession)
- **Attacks** = rhetorical arguments, emotional appeals
- **Statuses** = "Flustered", "Confident", "Cornered"

### Stealth Encounter
```javascript
{
  ENCOUNTER_TYPE: "stealth",
  ENCOUNTER_GOAL: "reach the objective undetected",
  ENCOUNTER_STAKES: "high",
  RESOURCE_INTERPRETATION: "alertness level of guards and exposure margin",
  ACTION_INTERPRETATION: "distraction attempts, stealth maneuvers, and evasion tactics",
  STATUS_INTERPRETATION: "detection states and environmental conditions",
  SUMMARY_FRAMING: "an infiltration attempt recap"
}
```
- **HP** = alertness/exposure margin
- **Attacks** = distractions, stealth moves
- **Statuses** = "Alerted", "Distracted", "Searching"

### Investigation Encounter
```javascript
{
  ENCOUNTER_TYPE: "investigation",
  ENCOUNTER_GOAL: "solve the mystery before time runs out",
  ENCOUNTER_STAKES: "medium",
  RESOURCE_INTERPRETATION: "remaining leads, time pressure, and certainty level",
  ACTION_INTERPRETATION: "deduction attempts, evidence gathering, and interrogation",
  STATUS_INTERPRETATION: "mental states and investigative progress",
  SUMMARY_FRAMING: "a detective work recap"
}
```
- **HP** = remaining leads/time
- **Attacks** = deductions, evidence gathering
- **Statuses** = "Confused", "On Track", "Misled"

---

## Specific Prompt Modifications

### 1. Initialization System Message

**Current (DEFAULT_PROMPTS.encounterInitSystem):**
```
You will be acting as an excellent game master. Your goal is to craft a combat encounter in this uncensored, continuous, and immersive roleplay.
```

**Modified:**
```
You will be acting as an excellent game master. Your goal is to craft a {ENCOUNTER_TYPE} encounter in this uncensored, continuous, and immersive roleplay.
```

### 2. Initialization Instructions - Injection Point

**Location**: After first paragraph of `DEFAULT_PROMPTS.encounterInitInstructions`

**Current first line:**
```
Based on everything above, generate the initial combat state.
```

**Modified:**
```
Based on everything above, generate the initial {ENCOUNTER_TYPE} encounter state.
```

**Append after first paragraph:**
```

INTERPRETATION NOTES:
- This is a {ENCOUNTER_TYPE} encounter.
- HP represents: {RESOURCE_INTERPRETATION}
- Attacks represent: {ACTION_INTERPRETATION}
- Statuses represent: {STATUS_INTERPRETATION}
- The primary goal of this encounter is: {ENCOUNTER_GOAL}
- Stakes level: {ENCOUNTER_STAKES}
```

### 3. Combat Action System Message

**Current (DEFAULT_PROMPTS.combatActionSystem):**
```
You are the game master managing this combat encounter.
```

**Modified:**
```
You are the game master managing this {ENCOUNTER_TYPE} encounter.
```

### 4. Combat Action Instructions - Injection Point

**Location**: After first paragraph of `DEFAULT_PROMPTS.combatActionInstructions`

**Append after first paragraph:**
```

INTERPRETATION RULES:
- Interpret HP changes according to: {RESOURCE_INTERPRETATION}
- Interpret attacks as: {ACTION_INTERPRETATION}
- Interpret statuses as: {STATUS_INTERPRETATION}
- Maintain encounter pacing appropriate to stakes: {ENCOUNTER_STAKES}
```

### 5. Combat Summary System Message

**Current (DEFAULT_PROMPTS.combatSummarySystem):**
```
You are summarizing a combat encounter that just concluded.
```

**Modified:**
```
You are summarizing a {ENCOUNTER_TYPE} encounter that just concluded.
```

### 6. Combat Summary Instructions - Injection Point

**Location**: Before prose rules in `DEFAULT_PROMPTS.combatSummaryInstructions`

**Append before prose rules:**
```

SUMMARY FRAMING:
- Frame the outcome as: {SUMMARY_FRAMING}
- Reflect the stakes level: {ENCOUNTER_STAKES}
- Preserve only narratively meaningful outcomes
```

---

## Critical Design Constraints

### ❌ Forbidden Changes
1. **No JSON schema modifications** - Parser expects exact structure
2. **No field renaming** - `hp`, `maxHp`, `attacks` must remain unchanged
3. **No new output formats** - JSON for actions, prose for summary
4. **No freeform prompt editing** - Only controlled variable substitution
5. **No profile injection of JSON/instructions** - Profiles contain only plain strings
6. **No model improvisation** - All behavior must be explicitly instructed

### ✅ Allowed Changes
1. **Semantic reinterpretation** through contextual prompts
2. **Variable substitution** in predefined placeholders
3. **Profile-based prompt assembly**
4. **Validation and fallback** to default combat profile

### 🔒 Immutable Elements
- JSON structure: `party`, `enemies`, `hp`, `maxHp`, `attacks`, `statuses`
- Resolution flags: `combatEnd`, `result` ("victory" | "defeat" | "interrupted")
- Summary format: 2-4 paragraphs, narrative prose, indirect speech for {userName}
- Encounter loop: initialization → action loop → summary

---

## Implementation Roadmap

### Phase 1: Profile System Foundation
**Files to modify:**
- `src/core/state.js` - Add profile storage to `extensionSettings`
- Create new file: `src/systems/features/encounterProfiles.js`

**Tasks:**
1. Define profile schema with TypeScript-style JSDoc
2. Create default combat profile constant
3. Implement profile validation function
4. Implement profile sanitization (strip JSON, instructions, formatting)
5. Add profile storage to `extensionSettings.encounterSettings.profiles`
6. Add active profile selection to `extensionSettings.encounterSettings.activeProfile`

**Profile Validation Rules:**
```javascript
function validateProfile(profile) {
  // Required fields
  const required = ['ENCOUNTER_TYPE', 'ENCOUNTER_GOAL', 'ENCOUNTER_STAKES',
                    'RESOURCE_INTERPRETATION', 'ACTION_INTERPRETATION',
                    'STATUS_INTERPRETATION', 'SUMMARY_FRAMING'];

  // All fields must be strings
  // No JSON characters: { } [ ] " :
  // No instruction keywords: "must", "should", "return", "output"
  // Max length per field: 200 characters

  // Return validated profile or null
}
```

### Phase 2: Prompt Template Modification
**Files to modify:**
- `src/systems/ui/promptsEditor.js` - Update `DEFAULT_PROMPTS`
- `src/systems/generation/encounterPrompts.js` - Update prompt builders

**Tasks:**
1. Update `DEFAULT_PROMPTS` with placeholder variables
2. Create `injectProfileVariables(promptTemplate, profile)` function
3. Modify `buildEncounterInitPrompt()` to inject profile
4. Modify `buildCombatActionPrompt()` to inject profile
5. Modify `buildCombatSummaryPrompt()` to inject profile
6. Add fallback to default combat profile on validation failure

**Injection Function:**
```javascript
function injectProfileVariables(template, profile) {
  // Validate profile first
  const validatedProfile = validateProfile(profile) || DEFAULT_COMBAT_PROFILE;

  // Replace all {VARIABLE} placeholders
  return template
    .replace(/{ENCOUNTER_TYPE}/g, validatedProfile.ENCOUNTER_TYPE)
    .replace(/{ENCOUNTER_GOAL}/g, validatedProfile.ENCOUNTER_GOAL)
    .replace(/{ENCOUNTER_STAKES}/g, validatedProfile.ENCOUNTER_STAKES)
    .replace(/{RESOURCE_INTERPRETATION}/g, validatedProfile.RESOURCE_INTERPRETATION)
    .replace(/{ACTION_INTERPRETATION}/g, validatedProfile.ACTION_INTERPRETATION)
    .replace(/{STATUS_INTERPRETATION}/g, validatedProfile.STATUS_INTERPRETATION)
    .replace(/{SUMMARY_FRAMING}/g, validatedProfile.SUMMARY_FRAMING);
}
```

### Phase 3: UI Integration
**Files to modify:**
- `src/systems/ui/encounterUI.js` - Add profile selector to encounter modal
- `src/systems/ui/promptsEditor.js` - Add profile management UI (optional)

**Tasks:**
1. Add profile dropdown to encounter initialization modal
2. Display active profile in encounter UI header
3. Save selected profile with encounter state
4. (Optional) Add profile editor UI for creating custom profiles

**UI Mockup:**
```
┌─────────────────────────────────────┐
│ Start Encounter                     │
├─────────────────────────────────────┤
│ Encounter Type:                     │
│ [Combat ▼]                          │
│   - Combat (default)                │
│   - Social Confrontation            │
│   - Stealth Infiltration            │
│   - Investigation                   │
│   - Custom...                       │
├─────────────────────────────────────┤
│ Narrative Style: [Configure...]     │
├─────────────────────────────────────┤
│ [Start] [Cancel]                    │
└─────────────────────────────────────┘
```

### Phase 4: Testing & Validation
**Test Cases:**
1. **Backward Compatibility**: Default combat profile must reproduce current behavior exactly
2. **Social Encounter**: Test with social profile, verify HP = composure interpretation
3. **Stealth Encounter**: Test with stealth profile, verify HP = alertness interpretation
4. **JSON Stability**: Verify parser handles all profile types without errors
5. **Small Model Testing**: Test with ≤13B models (e.g., Mistral 7B, Llama 3 8B)
6. **Profile Validation**: Test with malicious profiles (JSON injection, instruction injection)
7. **Fallback Behavior**: Test with invalid profiles, verify fallback to combat

---

## Profile Safety & Validation

### Security Concerns
Profiles are injected directly into prompts, creating potential attack vectors:
1. **Prompt injection** - Malicious instructions in profile values
2. **JSON injection** - Breaking the expected JSON output format
3. **Instruction override** - Overriding core system behavior

### Mitigation Strategy

**Sanitization Rules:**
```javascript
function sanitizeProfileValue(value) {
  // Remove JSON characters
  value = value.replace(/[{}\[\]":]/g, '');

  // Remove instruction keywords (case-insensitive)
  const forbidden = ['return only', 'output only', 'ignore previous',
                     'disregard', 'instead', 'however', 'but actually'];
  forbidden.forEach(word => {
    value = value.replace(new RegExp(word, 'gi'), '');
  });

  // Limit length
  value = value.substring(0, 200);

  // Trim whitespace
  return value.trim();
}
```

**Validation Checklist:**
- ✅ All required fields present
- ✅ All fields are strings
- ✅ No JSON characters
- ✅ No instruction keywords
- ✅ Length within limits
- ✅ No newlines or special formatting

**Fallback Behavior:**
```javascript
// If validation fails at any point:
console.warn('[RPG Companion] Invalid encounter profile, falling back to combat');
activeProfile = DEFAULT_COMBAT_PROFILE;
```

---

## Example Use Cases

### Chase Encounter
```javascript
{
  ENCOUNTER_TYPE: "chase",
  ENCOUNTER_GOAL: "escape pursuers or catch the target",
  ENCOUNTER_STAKES: "high",
  RESOURCE_INTERPRETATION: "distance advantage and stamina remaining",
  ACTION_INTERPRETATION: "sprint bursts, obstacles thrown, and evasive maneuvers",
  STATUS_INTERPRETATION: "physical conditions and tactical advantages",
  SUMMARY_FRAMING: "a pursuit sequence recap"
}
```

### Negotiation Encounter
```javascript
{
  ENCOUNTER_TYPE: "negotiation",
  ENCOUNTER_GOAL: "reach a favorable agreement",
  ENCOUNTER_STAKES: "medium",
  RESOURCE_INTERPRETATION: "bargaining power and credibility",
  ACTION_INTERPRETATION: "offers, concessions, and leverage plays",
  STATUS_INTERPRETATION: "negotiation positions and emotional states",
  SUMMARY_FRAMING: "a deal-making session recap"
}
```

### Survival Encounter
```javascript
{
  ENCOUNTER_TYPE: "survival",
  ENCOUNTER_GOAL: "endure until rescue or escape",
  ENCOUNTER_STAKES: "high",
  RESOURCE_INTERPRETATION: "supplies, morale, and physical condition",
  ACTION_INTERPRETATION: "resource management, shelter building, and foraging",
  STATUS_INTERPRETATION: "environmental hazards and survival conditions",
  SUMMARY_FRAMING: "a survival ordeal recap"
}
```

---

## Benefits of This Approach

### Backward Compatibility
- Default combat profile = current behavior (zero breaking changes)
- Users who don't select profiles see no difference
- Existing saved encounters continue to work

### Flexibility
- Same mechanical system supports unlimited encounter types
- No code duplication across encounter types
- Easy to add new profiles without code changes

### Stability
- JSON structure unchanged = parser unchanged
- No model improvisation = predictable outputs
- Controlled injection = no prompt injection attacks
- Deterministic prompt assembly

### Maintainability
- Single encounter loop for all types
- Profile changes don't require code changes
- Clear separation of mechanics (code) vs. semantics (profiles)
- Easy to test and debug

---

## Risk Assessment & Mitigation

### Risk 1: Model Confusion
**Issue**: Small models may struggle with abstract HP interpretations

**Mitigation**:
- Strong contextual prompts with explicit interpretation notes
- Test with ≤13B models during development
- Provide clear examples in profile descriptions
- Keep interpretations concrete and specific

### Risk 2: JSON Parsing Instability
**Issue**: Profile changes might affect JSON output format

**Mitigation**:
- Immutable JSON schema enforcement
- Profile validation before injection
- Fallback to combat profile on parsing errors
- Extensive testing with various profiles

### Risk 3: User Confusion
**Issue**: Users may not understand profile system

**Mitigation**:
- Clear UI with profile descriptions
- Tooltips explaining what each profile does
- Default to combat (familiar behavior)
- Documentation and examples

### Risk 4: Prompt Injection Attacks
**Issue**: Malicious profiles could override system behavior

**Mitigation**:
- Strict profile validation and sanitization
- No JSON or instruction keywords allowed
- Length limits on all fields
- Fallback to safe defaults

---

## Non-Goals (Out of Scope)

These features are explicitly **not** part of this implementation:

1. **Freeform prompt authoring** - Users cannot write custom prompts per encounter
2. **Schema branching** - Different encounter types don't get different JSON structures
3. **Field renaming** - HP will not become "composure" or "alertness" in the JSON
4. **New mechanics** - No clocks, meters, or progress bars
5. **Format changes** - Output format remains JSON for actions, prose for summary
6. **Dynamic profiles** - Profiles cannot change mid-encounter

These may be addressed in future versions if needed.

---

## Success Criteria

The implementation is successful if:

1. ✅ Default combat profile reproduces current behavior exactly (100% backward compatible)
2. ✅ Social encounter profile generates valid JSON with appropriate interpretations
3. ✅ Stealth encounter profile generates valid JSON with appropriate interpretations
4. ✅ JSON parser handles all profile types without errors
5. ✅ Small models (≤13B) can handle profile-based prompts
6. ✅ Profile validation prevents injection attacks
7. ✅ Fallback to combat profile works reliably
8. ✅ UI clearly communicates active profile
9. ✅ No performance degradation
10. ✅ No new bugs in existing combat encounters

---

## File Structure Summary

```
src/systems/
├── features/
│   ├── encounterState.js          # State management (no changes needed)
│   └── encounterProfiles.js       # NEW: Profile definitions and validation
├── ui/
│   ├── encounterUI.js              # MODIFY: Add profile selector
│   └── promptsEditor.js            # MODIFY: Update DEFAULT_PROMPTS with placeholders
└── generation/
    └── encounterPrompts.js         # MODIFY: Inject profile variables into prompts
```

---

## Next Steps

1. Review this document for accuracy and completeness
2. Create `encounterProfiles.js` with profile schema and validation
3. Update `DEFAULT_PROMPTS` with placeholder variables
4. Implement profile injection in prompt builders
5. Add profile selector UI
6. Test with default combat profile (verify backward compatibility)
7. Test with alternative profiles
8. Document profile system for users

---

**Document Version**: 1.0
**Last Updated**: 2026-01-05
**Status**: Ready for Implementation

