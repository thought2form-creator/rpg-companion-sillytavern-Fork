# Tracker Section Regeneration Guide

## Overview
You can now regenerate individual tracker sections (User Stats, Info Box, Present Characters) using the LLM with optional guidance.

## How to Use

### 1. User Stats Regeneration
**Location:** User Stats section header (top of the stats panel)

**Button:** 🔄 Regenerate button

**What it regenerates:**
- All stat values (Health, Energy, Satiety, etc.)
- Mood emoji
- Conditions/Status
- Inventory items
- Skills (if enabled)

**Example guidance:**
- "Increase health to 80%"
- "Add a sword to inventory"
- "Set mood to happy"
- "Add 'Poisoned' condition"

### 2. Info Box Regeneration
**Location:** Info Box section header (above environment widgets)

**Button:** 🔄 Regenerate button

**What it regenerates:**
- Date (weekday, month, year)
- Weather conditions
- Temperature
- Time of day
- Location description
- Recent events

**Example guidance:**
- "Make it nighttime"
- "Change weather to rainy"
- "Move to a forest location"
- "Add 'Dragon attack' to recent events"

### 3. Present Characters Regeneration
**Location:** Present Characters section header (next to the editor button)

**Button:** 🔄 Regenerate button

**What it regenerates:**
- All characters currently in the scene
- Character emojis, relationships, fields, stats, and thoughts
- Maintains configured custom fields and character stats

**Example guidance:**
- "Add a new merchant character"
- "Make Alice more friendly"
- "Update everyone's thoughts to reflect the recent battle"
- "Remove Bob from the scene"

## How It Works

1. **Click the regenerate button** (🔄) in any section header
2. **Optional: Enter guidance** in the dialog that appears
   - Leave blank for automatic regeneration based on context
   - Or provide specific instructions for targeted changes
3. **Click "Regenerate"**
4. The LLM will generate new data based on:
   - Character card information
   - Recent chat context (last 4 messages by default)
   - Current tracker data
   - Your guidance (if provided)
5. The section updates automatically

## Technical Details

### Context Injection
Each regeneration includes:
- **Character Cards:** Names and descriptions of all characters
- **Chat Context:** Recent conversation (configurable depth)
- **Tracker Data:** Current state of all trackers
- **User Guidance:** Your optional instructions

### API Configuration
Uses the same API settings as main tracker generation:
- **External Mode:** Uses your configured OpenAI-compatible API
- **Separate Mode:** Uses SillyTavern's internal generation

### Data Persistence
Regenerated data is automatically:
- Saved to chat metadata
- Stored in message swipe data
- Persisted across sessions

## Tips

- **Be specific with guidance:** "Increase health to 80%" works better than "make healthier"
- **Use natural language:** The LLM understands conversational instructions
- **Leave blank for auto-update:** If no guidance, the LLM will update based on recent events
- **Combine with editing:** You can manually edit fields and use regeneration for others

## Troubleshooting

**Regeneration fails:**
- Check your API configuration in extension settings
- Ensure you have API credits/access
- Check browser console for error messages

**Generated data doesn't match format:**
- The parser automatically cleans markdown and XML tags
- If issues persist, check the console logs for the raw response

**Guidance not followed:**
- Try being more specific in your instructions
- Check that your guidance doesn't conflict with character cards
- Some LLMs follow instructions better than others

## Examples

### User Stats Example
**Guidance:** "Health at 50%, add 'Exhausted' condition, inventory has healing potion"

**Result:**
```
Health: 50%
Energy: 30%
Satiety: 60%
😓 Exhausted, Minor wounds
Inventory: Healing Potion, Sword, 50 gold
```

### Info Box Example
**Guidance:** "Make it midnight, stormy weather, in a tavern"

**Result:**
```
Date: Friday, December 13th, 1423
Weather: ⛈️ Thunderstorm
Temperature: 8°C
Time: 00:00 - Midnight
Location: The Rusty Tankard Tavern - A dimly lit establishment with creaking floorboards
Recent Events: Storm began, Mysterious stranger arrived
```

### Present Characters Example
**Guidance:** "Add a suspicious hooded figure watching from the corner"

**Result:**
```
Present Characters
---
- Alice
Details: 😊 | Friend
Appearance: Blonde hair, blue eyes, wearing leather armor
Thoughts: I'm glad we made it to the tavern safely. That storm is getting worse.

- Hooded Figure
Details: 😐 | Neutral
Appearance: Dark cloak, face hidden in shadows, sitting alone
Thoughts: These travelers look interesting. I wonder what brings them here...
```

