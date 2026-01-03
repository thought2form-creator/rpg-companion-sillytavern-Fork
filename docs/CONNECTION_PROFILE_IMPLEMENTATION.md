# Connection Profile Implementation for Character Creator

## Overview
The Character Creator now uses SillyTavern's **Connection Profile** system instead of manually handling different API backends. This provides automatic support for Text Completion (oobabooga), Chat Completion (OpenAI), and all other backends.

## What Was Implemented

### 1. Settings Structure (`src/core/config.js`)
Added `characterCreator` settings object:
```javascript
characterCreator: {
    profileId: '',              // Connection Profile ID for character generation
    maxTokens: 2048,            // Max tokens override (can override profile setting)
    temperature: null,          // Temperature override (null = use profile setting)
    chatContextDepth: 4,        // How many chat messages to include in context
    includeWorldInfo: true,     // Include world info in generation context
    includeExistingChars: true, // Include existing characters in generation context
    includeTrackers: true,      // Include tracker data in generation context
    defaultTemplate: 'default'  // Default template to use
}
```

### 2. Core Generation Function (`src/systems/ui/characterCreator.js`)

#### New Functions:
- **`getAvailableProfiles()`** - Returns list of available Connection Profiles
- **`getSelectedProfile()`** - Gets currently selected profile ID
- **`setSelectedProfile(profileId)`** - Sets the profile and saves settings
- **`callLLMForCreation(prompt, options)`** - Main generation function (now uses Connection Profiles)
- **`callLLMForCreationLegacy(prompt, options)`** - Fallback for when profiles aren't available

#### How It Works:
```javascript
// 1. Check if profile is selected
const profileId = extensionSettings.characterCreator.profileId;

// 2. If no profile, fall back to legacy method
if (!profileId) {
    return callLLMForCreationLegacy(prompt, options);
}

// 3. Get SillyTavern context
const context = getContext();

// 4. Verify ConnectionManagerRequestService is available
if (!context.ConnectionManagerRequestService) {
    return callLLMForCreationLegacy(prompt, options);
}

// 5. Build messages array (chat format)
const messages = [
    { role: 'system', content: 'You are a helpful assistant...' },
    { role: 'user', content: prompt }
];

// 6. Call Connection Manager
const response = await context.ConnectionManagerRequestService.sendRequest(
    profileId,
    messages,
    maxTokens  // Optional override
);
```

### 3. Dev UI Updates (`src/systems/ui/characterCreatorUI.js`)

Added:
- **Profile selector dropdown** - Shows all available Connection Profiles
- **Profile info display** - Shows selected profile status
- **Auto-save profile selection** - Saves to extension settings
- **Legacy fallback notice** - Shows when no profile is selected

## Benefits

### ✅ Automatic Backend Support
- **Text Completion** (oobabooga, KoboldAI, etc.) - Works automatically
- **Chat Completion** (OpenAI, Claude, etc.) - Works automatically
- **All other backends** - Works automatically

### ✅ No Manual Format Handling
- Connection Profile handles chat vs text completion conversion
- No need to check API type or format messages differently
- Instruct mode, stop sequences, etc. all handled by profile

### ✅ User-Friendly
- Users already know how to create/manage Connection Profiles
- One setting to configure everything (API, model, preset, etc.)
- Can override max tokens and temperature if needed

### ✅ Proven Approach
- Used successfully by SillyTavern-Character-Creator extension
- Leverages SillyTavern's built-in infrastructure
- Future-proof as SillyTavern updates

## Testing

### To Test:
1. Open Character Creator dev modal
2. Select a Connection Profile from dropdown
3. Run any test scenario (Wizard, Warrior, etc.)
4. Verify generation works with your oobabooga setup

### Expected Behavior:
- If profile selected: Uses Connection Profile (recommended)
- If no profile: Falls back to legacy method (generateRaw/external API)
- Error messages guide user to select a profile

## Next Steps

1. **Test with oobabooga** - Verify Text Completion works
2. **Add profile selector to production UI** - When we build the real UI
3. **Add max tokens override UI** - Let users override per-generation
4. **Add temperature override UI** - Let users override per-generation
5. **Remove legacy code** - Once Connection Profiles are proven stable

## Migration Notes

### For Users:
- **No action required** - Legacy method still works
- **Recommended**: Create a Connection Profile for Character Creator
- **Benefit**: Better compatibility with all backends

### For Developers:
- `callLLMForCreation()` signature unchanged
- Automatically uses profiles if available
- Falls back gracefully if not

## Reference
- **SillyTavern-Character-Creator**: https://github.com/bmen25124/SillyTavern-Character-Creator
- **Connection Manager Docs**: (SillyTavern documentation)

