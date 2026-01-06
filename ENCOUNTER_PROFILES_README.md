# Encounter Profiles - Quick Start Guide

## What Are Encounter Profiles?

Encounter Profiles let you reuse the RPG Companion's combat system for **any type of encounter**, not just traditional combat. By redefining what HP, attacks, and statuses represent, you can create:

- **Social encounters** where HP = reputation and attacks = arguments
- **Stealth missions** where HP = cover and attacks = detection attempts  
- **Chase sequences** where HP = stamina and attacks = obstacles
- **Investigations** where HP = leads and attacks = red herrings
- **Negotiations** where HP = leverage and attacks = offers
- **Any custom encounter type you can imagine!**

## Quick Start

### 1. Open the Profile Manager

1. Click the **Settings** button (⚙️) in the RPG Companion panel
2. Scroll to the **Advanced** section
3. Click **"Manage Encounter Profiles"**

### 2. Create Your First Profile

**Option A: Use a Preset**
1. Select a preset from the **"Load from Preset"** dropdown
2. Click **"Save Profile"**
3. Done! The preset is now in your profile list

**Option B: Create Custom**
1. Click the **"New"** button
2. Fill in all 8 fields (see below)
3. Click **"Save Profile"**

### 3. Profile Fields Explained

Each field replaces a specific placeholder in the encounter prompts:

| Field | Placeholder | Description | Example (Social) |
|-------|-------------|-------------|------------------|
| **Profile Name** | - | Unique identifier | "Social Confrontation" |
| **Encounter Type** | `{ENCOUNTER_TYPE}` | Short descriptor | "social" |
| **Encounter Goal** | `{ENCOUNTER_GOAL}` | What success means | "persuade the opposition" |
| **Stakes Level** | `{ENCOUNTER_STAKES}` | Importance (low/medium/high) | "medium" |
| **HP Represents** | `{RESOURCE_INTERPRETATION}` | What the HP bar means | "composure and social standing" |
| **Attacks Represent** | `{ACTION_INTERPRETATION}` | What actions mean | "arguments and appeals" |
| **Statuses Represent** | `{STATUS_INTERPRETATION}` | What status effects mean | "emotional states" |
| **Summary Framing** | `{SUMMARY_FRAMING}` | How to frame summaries | "a diplomatic exchange recap" |

**Note:** These placeholders are automatically replaced in all encounter prompts when you activate a profile. You can customize the base prompts in **Settings → Customize Prompts** while keeping the placeholders intact.

## Built-in Presets

### 🗡️ Traditional Combat
Classic RPG combat with physical health, weapon strikes, and wounds.

### 💬 Social Confrontation
Debates and arguments where you battle with words, not swords.

### 🕵️ Stealth Mission
Sneak past guards and avoid detection to complete your objective.

### 🏃 Chase Sequence
High-speed pursuit where stamina and obstacles determine success.

### 🔍 Investigation
Gather clues and solve mysteries while avoiding red herrings.

### 🤝 Negotiation
Bargain and make deals to reach favorable agreements.

## Managing Profiles

### Edit a Profile
1. Click on the profile in the list
2. Modify the fields
3. Click **"Save Profile"**

### Preview Prompts
1. Select or edit a profile
2. Click **"Preview Prompts"**
3. See exactly how the encounter prompts will look with your profile's word replacements
4. This shows all 4 main encounter prompts with variables replaced

### Delete a Profile
1. Hover over the profile in the list
2. Click the **trash icon** (🗑️)
3. Confirm deletion

### Export a Profile
1. Select the profile
2. Click **"Export"**
3. Save the JSON file

### Import a Profile
1. Click **"Import"**
2. Select a profile JSON file
3. The profile is added to your list

## Using Profiles in Encounters

Once you've created profiles, you can apply them in two ways:

### Set a Default Profile (Active Profile)
1. In the **Manage Encounter Profiles** window, find the profile you want to use by default
2. Click the **checkmark icon** (✓) next to it
3. The profile is now marked as "Active"
4. This profile will be pre-selected when starting new encounters

**Note:** Only one profile can be active at a time.

### Choose Per-Encounter
1. Start an encounter using the **"Start Encounter"** button
2. The **Configure Combat Narrative** dialog appears
3. At the bottom, select your desired profile from the **"Encounter Profile"** dropdown
4. Click **"Proceed"** to start the encounter

**Note:** The per-encounter selection overrides the active profile for that encounter only. When the encounter ends, it resets to the active profile.

### How It Works
- The encounter will use your profile's interpretations for HP, attacks, and statuses
- The AI will generate narrative based on your profile's context
- All encounter prompts automatically use your profile's placeholder values

## Examples

### Example 1: Courtroom Drama

```
Profile Name: Legal Battle
Encounter Type: legal
Encounter Goal: win the case through superior arguments
Stakes Level: high
HP Represents: jury favor and case strength
Attacks Represent: evidence presentation and legal arguments
Statuses Represent: objections and credibility
Summary Framing: a trial proceedings summary
```

### Example 2: Hacking Challenge

```
Profile Name: Cyber Intrusion
Encounter Type: hacking
Encounter Goal: breach the system and extract data
Stakes Level: high
HP Represents: system integrity and firewall strength
Attacks Represent: exploits and intrusion attempts
Statuses Represent: system alerts and trace levels
Summary Framing: a cybersecurity breach report
```

### Example 3: Dance Battle

```
Profile Name: Dance Competition
Encounter Type: performance
Encounter Goal: impress the judges with superior moves
Stakes Level: medium
HP Represents: crowd energy and judge favor
Attacks Represent: dance moves and choreography
Statuses Represent: rhythm, style, and stage presence
Summary Framing: a performance review
```

## Tips for Creating Great Profiles

1. **Be Specific**: Clear descriptions help the AI generate better content
2. **Stay Consistent**: Use consistent terminology within a profile
3. **Test It**: Try your profile in different scenarios to refine it
4. **Start with Presets**: Modify existing presets rather than starting from scratch
5. **Share**: Export successful profiles and share with the community

## Troubleshooting

**Profile won't save?**
- Make sure all 8 fields are filled in
- Check that the profile name is unique

**Can't find my profile?**
- Scroll through the profile list
- Profiles are sorted alphabetically

**Import failed?**
- Make sure the JSON file is valid
- Check that all required fields are present

## Documentation

For more detailed information, see:
- **docs/ENCOUNTER_PROFILES_GUIDE.md** - Comprehensive guide
- **ENCOUNTER_PROFILES_IMPLEMENTATION.md** - Technical details
- **TESTING_GUIDE.md** - Testing procedures

## Support

If you encounter issues or have questions:
1. Check the documentation files
2. Review the testing guide
3. Check the implementation status file
4. Report issues on the GitHub repository

---

**Enjoy creating unique encounters with the Encounter Profiles system!** 🎲

