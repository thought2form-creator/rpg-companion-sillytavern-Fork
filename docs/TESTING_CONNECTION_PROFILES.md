# Testing Connection Profiles with Character Creator

## Quick Start Guide

### Step 1: Create a Connection Profile (if you don't have one)

1. In SillyTavern, go to **Settings** → **Connection Manager**
2. Click **"Add Profile"**
3. Configure your profile:
   - **Name**: "Character Creator - oobabooga" (or whatever you want)
   - **API**: Select your backend (e.g., Text Completion, OpenAI, etc.)
   - **Model**: Select your model
   - **Preset**: Select your generation preset
   - **Max Tokens**: Set your preferred max tokens
   - **Temperature**: Set your preferred temperature
4. Click **Save**

### Step 2: Open Character Creator Dev Modal

1. In SillyTavern, make sure RPG Companion extension is loaded
2. Open the browser console (F12)
3. Run this command:
   ```javascript
   // Import and open the Character Creator modal
   import('./data/default-user/extensions/third-party/rpg-companion-sillytavern/src/systems/ui/characterCreatorUI.js')
       .then(m => m.openCharacterCreatorModal());
   ```

### Step 3: Select Your Connection Profile

1. In the modal, find the **"Connection Profile"** dropdown at the top
2. Select your profile (e.g., "Character Creator - oobabooga")
3. You should see: ✓ Profile Selected: [Your Profile Name]

### Step 4: Test Generation

1. Click one of the test buttons:
   - **Test: Wise Wizard**
   - **Test: Brave Warrior**
   - **Test: Sneaky Rogue**
   - **Test: Random NPC**

2. Or enter custom input:
   - Type your character concept in the text area
   - Click **"Generate Custom Character"**

3. Watch the **Debug Output** section for progress
4. Check the **Generated Output** section for results

## Expected Results

### ✅ Success Indicators:
- Debug output shows: `✅ Using Connection Profile: [Your Profile Name]`
- Generation completes without errors
- Output appears in "Generated Output" section
- Works with Text Completion (oobabooga) backend

### ⚠️ Fallback Mode:
If you see: `⚠ No profile selected - will use legacy generation method`
- This means no profile is selected
- It will fall back to the old method (generateRaw or external API)
- This still works, but Connection Profiles are recommended

### ❌ Error Indicators:
- `Connection Profile with ID "..." not found` - Profile was deleted or doesn't exist
- `ConnectionManagerRequestService not available` - SillyTavern version too old
- Other errors - Check console for details

## Troubleshooting

### Problem: "No profiles available in dropdown"
**Solution**: Create a Connection Profile in SillyTavern first (see Step 1)

### Problem: "ConnectionManagerRequestService not available"
**Solution**: 
- Update SillyTavern to latest version
- Connection Profiles are a newer feature
- Fallback to legacy mode will work in the meantime

### Problem: "Generation fails with selected profile"
**Solution**:
1. Test the profile in regular SillyTavern chat first
2. Make sure the profile is configured correctly
3. Check that your backend (oobabooga) is running
4. Check console for detailed error messages

### Problem: "Profile selector doesn't save my selection"
**Solution**:
- Make sure extension settings are saving properly
- Check browser console for errors
- Try selecting the profile again

## Testing Checklist

- [ ] Connection Profile created in SillyTavern
- [ ] Character Creator modal opens
- [ ] Profile selector shows available profiles
- [ ] Profile selection saves (persists after closing/reopening modal)
- [ ] Test generation with "Wise Wizard" works
- [ ] Test generation with custom input works
- [ ] Works with Text Completion (oobabooga) backend
- [ ] Works with Chat Completion (OpenAI) backend
- [ ] Fallback to legacy mode works when no profile selected

## Advanced Testing

### Test Different Backends:
1. Create profiles for different backends:
   - Text Completion (oobabooga)
   - OpenAI
   - Claude
   - KoboldAI
2. Switch between profiles
3. Verify generation works with each

### Test Max Tokens Override:
1. Select a profile with low max tokens (e.g., 100)
2. Generate a character
3. Output should be truncated
4. (Future: Add UI to override max tokens)

### Test Error Handling:
1. Select a profile with invalid settings
2. Try to generate
3. Should show user-friendly error message
4. Should not crash the extension

## Next Steps After Testing

1. **Report Results**: Let the developer know if it works with your oobabooga setup
2. **Suggest Improvements**: Any UI/UX improvements needed?
3. **Production UI**: Once proven stable, integrate into production UI
4. **Documentation**: Update user-facing docs with Connection Profile setup

## Notes

- **Profile selection is saved** in extension settings (persists across sessions)
- **Legacy method still works** if you don't select a profile
- **Connection Profiles are recommended** for best compatibility
- **This is a dev/test UI** - production UI will be different

