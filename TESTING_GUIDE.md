# Testing Guide - Character Regeneration Features

## Prerequisites
1. Refresh SillyTavern (F5) to load the new code
2. Make sure you have an active chat with Present Characters enabled
3. Ensure you have either:
   - External API configured (Settings → External API)
   - OR SillyTavern's internal API working (Separate mode)

## Test 1: Add Character
1. Open Character Editor (gear icon next to "Present Characters")
2. Click "Add Character" button (bottom left)
3. Enter a character name (e.g., "Test Character")
4. Click "Add Character"
5. **Expected:** Character appears at top of editor with default values

## Test 2: Regenerate Full Character (No Guidance)
1. In the Character Editor, find a character card
2. Click the regenerate button (🔄 icon in the header)
3. Leave the guidance field empty
4. Click "Regenerate"
5. **Expected:** 
   - Toast notification "Regenerating [name]..."
   - After a few seconds, all fields update with AI-generated content
   - Toast notification "Character regenerated successfully"

## Test 3: Regenerate Full Character (With Guidance)
1. Click the regenerate button (🔄 icon)
2. Enter guidance like: "Make them more mysterious and secretive"
3. Click "Regenerate"
4. **Expected:** 
   - Character fields update to reflect the guidance
   - Appearance, personality, etc. should align with "mysterious and secretive"

## Test 4: Regenerate Single Field (No Guidance)
1. Find any field in the character editor (e.g., "Appearance")
2. Click the small 🔄 icon next to that field
3. Leave guidance empty
4. Click "Regenerate"
5. **Expected:** 
   - Only that specific field updates
   - Other fields remain unchanged

## Test 5: Regenerate Single Field (With Guidance)
1. Click the 🔄 icon next to a field (e.g., "Current Action")
2. Enter guidance like: "They should be training with a sword"
3. Click "Regenerate"
4. **Expected:** 
   - Field updates to reflect the guidance
   - Should mention sword training

## Test 6: Save Changes
1. After regenerating, click "Save Changes" button
2. Close the editor
3. Check the Present Characters panel
4. **Expected:** Changes are reflected in the main panel

## Troubleshooting

### Error: "External API base URL is not configured"
- Go to Settings → External API
- Configure your API endpoint (e.g., OpenRouter, local LLM)
- OR switch to "Separate" generation mode to use SillyTavern's internal API

### Error: "Failed to regenerate"
- Check browser console (F12) for detailed error
- Verify your API is working (test with a normal chat message)
- Make sure the character has a name

### Fields don't update
- Check if the LLM response was parsed correctly (console logs)
- Try with guidance to see if it helps
- Verify the field names match your configuration

### Modal doesn't appear
- Check browser console for errors
- Try refreshing the page
- Make sure jQuery is loaded

## Expected Prompt Structure

The regeneration system uses the same prompt style as the main extension:

```
Characters in this roleplay:
<character1="Alice">
Description...
</character1>

Current Environment:
[Info Box data]

User Stats:
[User stats data]

Recent conversation:
[Last 4 messages]

Current data for Bob:
Emoji: 😊
Relationship: Friend
Appearance: Not set
...

User's guidance: Make them more mysterious

Task: Generate updated data for "Bob"...
```

This ensures consistency with how the extension normally generates tracker data.

## Test 10: Encounter Profiles - Access Manager
1. Open RPG Companion Settings (gear icon)
2. Scroll to the "Advanced" section
3. Click "Manage Encounter Profiles" button
4. **Expected:**
   - Modal opens with two-column layout
   - Left column shows profile list (initially empty or with defaults)
   - Right column shows profile editor form
   - "New Profile" title at top of editor

## Test 11: Encounter Profiles - Load Preset
1. In the Encounter Profiles modal, find the "Load from Preset" dropdown
2. Select "Social Confrontation"
3. **Expected:**
   - All form fields populate with preset values
   - Profile Name: "Social Confrontation"
   - Encounter Type: "social"
   - HP Represents: "composure, leverage, and social standing"
   - etc.

## Test 12: Encounter Profiles - Create Profile
1. Load a preset or fill in the form manually:
   - Profile Name: "Test Profile"
   - Encounter Type: "test"
   - Encounter Goal: "test the system"
   - Stakes Level: "medium"
   - HP Represents: "test resource"
   - Attacks Represent: "test actions"
   - Statuses Represent: "test conditions"
   - Summary Framing: "a test summary"
2. Click "Save Profile"
3. **Expected:**
   - Toast notification "Profile 'Test Profile' created"
   - Profile appears in the left column list
   - Profile is highlighted as active

## Test 13: Encounter Profiles - Edit Profile
1. Click on a profile in the list
2. Modify the "Encounter Goal" field
3. Click "Save Profile"
4. **Expected:**
   - Toast notification "Profile '[name]' updated"
   - Changes are saved
   - Profile remains selected

## Test 14: Encounter Profiles - Delete Profile
1. Hover over a profile in the list
2. Click the trash icon that appears
3. **Expected:**
   - Profile is removed from the list
   - Form clears or shows another profile

## Test 15: Encounter Profiles - Export Profile
1. Select a profile from the list
2. Click the "Export" button
3. **Expected:**
   - File download dialog appears
   - JSON file downloads with name like "encounter-profile-social-confrontation.json"
   - File contains valid JSON with all profile data

## Test 16: Encounter Profiles - Import Profile
1. Click the "Import" button
2. Select a previously exported profile JSON file
3. **Expected:**
   - Toast notification "Profile '[name]' imported"
   - Profile appears in the list
   - Profile is automatically selected and displayed in editor

## Test 17: Encounter Profiles - Validation
1. Try to save a profile with empty required fields
2. **Expected:**
   - Toast error notification "Validation failed: [field names]"
   - Profile is not saved
   - Form remains open for editing

## Test 18: Encounter Profiles - All Presets
1. Test loading each preset:
   - Traditional Combat
   - Social Confrontation
   - Stealth Mission
   - Chase Sequence
   - Investigation
   - Negotiation
2. **Expected:**
   - Each preset loads with appropriate values
   - All fields are populated
   - Values make sense for the encounter type

