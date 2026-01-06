# Encounter Profiles System

## Overview

The Encounter Profiles system allows you to create reusable templates that control how the AI interprets HP, attacks, statuses, and other combat mechanics for different types of encounters. This enables you to use the same combat system for various scenarios beyond traditional combat.

## What Are Encounter Profiles?

Encounter profiles are templates that redefine what combat mechanics represent in different contexts:

- **Combat Encounter**: HP = physical health, attacks = sword strikes, statuses = wounds
- **Social Encounter**: HP = composure/reputation, attacks = arguments, statuses = emotional states
- **Stealth Encounter**: HP = cover/concealment, attacks = detection attempts, statuses = alert levels
- **Chase Encounter**: HP = stamina/distance, attacks = obstacles, statuses = exhaustion

## Profile Structure

Each profile contains the following fields:

### Required Fields

1. **Profile Name**: A unique identifier for the profile (e.g., "Social Confrontation")

2. **Encounter Type**: A short descriptor of the encounter type (e.g., "social", "combat", "stealth")

3. **Encounter Goal**: What success means in this encounter (e.g., "persuade or manipulate the opposition")

4. **Stakes Level**: How important this encounter is (low/medium/high)

5. **HP Represents**: What the HP bar represents (e.g., "composure, leverage, and social standing")

6. **Attacks Represent**: What attacks/actions represent (e.g., "arguments, appeals, and social maneuvers")

7. **Statuses Represent**: What status effects represent (e.g., "emotional states and social conditions")

8. **Summary Framing**: How the summary should be framed (e.g., "a diplomatic exchange recap")

## Built-in Presets

The system comes with several pre-configured profiles:

### 1. Traditional Combat
- **Type**: combat
- **Goal**: defeat enemies through physical confrontation
- **HP**: physical health and vitality
- **Attacks**: weapon strikes, spells, and physical actions
- **Statuses**: wounds, buffs, debuffs, and conditions

### 2. Social Confrontation
- **Type**: social
- **Goal**: persuade or manipulate the opposition
- **HP**: composure, leverage, and social standing
- **Attacks**: arguments, appeals, and social maneuvers
- **Statuses**: emotional states and social conditions

### 3. Stealth Mission
- **Type**: stealth
- **Goal**: remain undetected while achieving objectives
- **HP**: cover, concealment, and stealth advantage
- **Attacks**: detection attempts and security measures
- **Statuses**: alert levels and visibility conditions

### 4. Chase Sequence
- **Type**: chase
- **Goal**: catch the target or escape pursuit
- **HP**: stamina, distance advantage, and momentum
- **Attacks**: obstacles, hazards, and pursuit actions
- **Statuses**: exhaustion, terrain effects, and speed modifiers

### 5. Investigation
- **Type**: investigation
- **Goal**: uncover clues and solve the mystery
- **HP**: leads, evidence quality, and investigation progress
- **Attacks**: red herrings, false leads, and obstacles
- **Statuses**: insight levels and investigation conditions

### 6. Negotiation
- **Type**: negotiation
- **Goal**: reach a favorable agreement
- **HP**: bargaining position and leverage
- **Attacks**: offers, counteroffers, and pressure tactics
- **Statuses**: negotiation stance and relationship modifiers

## Using Encounter Profiles

### Accessing the Manager

1. Open RPG Companion Settings
2. Scroll to the "Advanced" section
3. Click "Manage Encounter Profiles"

### Creating a New Profile

1. Click the "New" button in the profiles list
2. Optionally select a preset from the dropdown to use as a starting point
3. Fill in all required fields
4. Click "Save Profile"

### Editing a Profile

1. Click on a profile in the list to select it
2. Modify the fields as needed
3. Click "Save Profile" to update

### Deleting a Profile

1. Hover over a profile in the list
2. Click the trash icon that appears
3. Confirm the deletion

### Importing/Exporting Profiles

**Export**:
1. Select the profile you want to export
2. Click the "Export" button
3. Save the JSON file

**Import**:
1. Click the "Import" button
2. Select a profile JSON file
3. The profile will be added to your list

## Integration with Combat System

When you start an encounter using the "Start Encounter" button, the system will:

1. Use the active encounter profile (if set)
2. Apply the profile's interpretations to the combat mechanics
3. Generate appropriate narrative descriptions based on the profile
4. Frame summaries according to the profile's guidelines

## Best Practices

1. **Be Specific**: Clear, specific descriptions help the AI generate better content
2. **Stay Consistent**: Use consistent terminology within a profile
3. **Test Profiles**: Try your custom profiles in different scenarios to refine them
4. **Share Profiles**: Export and share successful profiles with the community
5. **Use Presets**: Start with a preset and modify it rather than creating from scratch

## Examples

### Custom Profile: Hacking Challenge

```
Profile Name: Cyber Intrusion
Encounter Type: hacking
Encounter Goal: breach the system and extract data
Stakes Level: high
HP Represents: system integrity and firewall strength
Attacks Represent: exploits, scripts, and intrusion attempts
Statuses Represent: system alerts, trace levels, and access permissions
Summary Framing: a cybersecurity breach report
```

### Custom Profile: Courtroom Drama

```
Profile Name: Legal Battle
Encounter Type: legal
Encounter Goal: win the case through superior arguments
Stakes Level: high
HP Represents: jury favor and case strength
Attacks Represent: evidence presentation and legal arguments
Statuses Represent: objections, credibility, and procedural advantages
Summary Framing: a trial proceedings summary
```

## Technical Details

- Profiles are stored in `extensionSettings.encounterProfiles`
- Each profile has a unique UUID
- Profiles are saved automatically when modified
- The system validates all required fields before saving
- Profiles can be exported/imported as JSON files

## Future Enhancements

Planned features for the encounter profiles system:

- Profile categories and tags
- Profile search and filtering
- Community profile repository
- Profile templates for common scenarios
- AI-assisted profile generation
- Profile versioning and history

