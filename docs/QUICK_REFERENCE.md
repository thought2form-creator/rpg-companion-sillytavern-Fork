# Connection Profile - Quick Reference

## For Users

### Setup (One-Time)
1. **Create Connection Profile** in SillyTavern Settings → Connection Manager
2. **Configure**: API, Model, Preset, Max Tokens, Temperature
3. **Save** the profile

### Using Character Creator
1. **Open** Character Creator modal
2. **Select** your Connection Profile from dropdown
3. **Generate** characters - that's it!

### Troubleshooting
| Problem | Solution |
|---------|----------|
| No profiles in dropdown | Create a Connection Profile first |
| "Profile not found" error | Profile was deleted - select a different one |
| Generation fails | Test profile in regular chat first |
| Using legacy mode | Select a profile to use Connection Profiles |

---

## For Developers

### Key Functions

```javascript
// Get available profiles
const profiles = getAvailableProfiles();
// Returns: [{id: 'abc123', name: 'My Profile'}, ...]

// Get selected profile
const profileId = getSelectedProfile();
// Returns: 'abc123' or ''

// Set profile
setSelectedProfile('abc123');
// Saves to extensionSettings.characterCreator.profileId

// Generate with profile
const response = await callLLMForCreation(prompt, {
    maxTokens: 2048,  // Optional override
    stopSequences: [] // Optional
});
```

### Settings Structure

```javascript
extensionSettings.characterCreator = {
    profileId: '',              // Connection Profile ID
    maxTokens: 2048,            // Max tokens override
    temperature: null,          // Temperature override (null = use profile)
    chatContextDepth: 4,        // Chat messages to include
    includeWorldInfo: true,     // Include world info
    includeExistingChars: true, // Include existing characters
    includeTrackers: true,      // Include tracker data
    defaultTemplate: 'default'  // Default template
};
```

### Flow

```javascript
callLLMForCreation(prompt, options)
    ↓
if (profileId exists && ConnectionManager available)
    → Use Connection Profile ✅
else
    → Use Legacy Method (generateRaw/external API) ⚠️
```

### Error Handling

```javascript
try {
    const response = await callLLMForCreation(prompt);
} catch (error) {
    // Errors:
    // - "No connection profile selected"
    // - "Connection Profile with ID ... not found"
    // - "ConnectionManagerRequestService not available"
    // - API-specific errors
}
```

---

## API Reference

### `getAvailableProfiles()`
**Returns**: `Array<{id: string, name: string}>`  
**Description**: Gets all available Connection Profiles from SillyTavern

### `getSelectedProfile()`
**Returns**: `string` (profile ID or empty string)  
**Description**: Gets currently selected profile for Character Creator

### `setSelectedProfile(profileId)`
**Parameters**: `profileId` (string)  
**Returns**: `void`  
**Description**: Sets and saves the selected profile

### `callLLMForCreation(prompt, options)`
**Parameters**:
- `prompt` (string) - The generation prompt
- `options` (object) - Optional parameters
  - `maxTokens` (number) - Override max tokens
  - `stopSequences` (array) - Stop sequences

**Returns**: `Promise<string>` - Generated text  
**Description**: Main generation function, uses Connection Profile if available

### `callLLMForCreationLegacy(prompt, options)`
**Parameters**: Same as `callLLMForCreation`  
**Returns**: `Promise<string>`  
**Description**: Legacy generation method (fallback)

---

## Configuration

### Default Settings
```javascript
// In src/core/config.js
characterCreator: {
    profileId: '',              // No profile by default
    maxTokens: 2048,            // 2K tokens
    temperature: null,          // Use profile setting
    chatContextDepth: 4,        // 4 messages
    includeWorldInfo: true,     // Include world info
    includeExistingChars: true, // Include existing chars
    includeTrackers: true,      // Include tracker data
    defaultTemplate: 'default'  // Default template
}
```

### Persistence
- Settings saved in `extensionSettings.characterCreator`
- Persists across sessions
- Saved via `saveSettings()` from `src/core/persistence.js`

---

## Testing Commands

### Open Dev Modal
```javascript
import('./data/default-user/extensions/third-party/rpg-companion-sillytavern/src/systems/ui/characterCreatorUI.js')
    .then(m => m.openCharacterCreatorModal());
```

### Check Current Profile
```javascript
import('./data/default-user/extensions/third-party/rpg-companion-sillytavern/src/systems/ui/characterCreator.js')
    .then(m => console.log('Selected Profile:', m.getSelectedProfile()));
```

### List Available Profiles
```javascript
import('./data/default-user/extensions/third-party/rpg-companion-sillytavern/src/systems/ui/characterCreator.js')
    .then(m => console.log('Available Profiles:', m.getAvailableProfiles()));
```

---

## Status Indicators

| Indicator | Meaning |
|-----------|---------|
| ✓ Profile Selected: [Name] | Connection Profile active |
| ⚠ No profile selected | Using legacy mode |
| ❌ Profile not found | Selected profile doesn't exist |
| 🔄 Loading... | Generation in progress |

---

## Links

- **Implementation Details**: `CONNECTION_PROFILE_IMPLEMENTATION.md`
- **Testing Guide**: `TESTING_CONNECTION_PROFILES.md`
- **Summary**: `IMPLEMENTATION_SUMMARY.md`
- **Roadmap**: `CHARACTER_CREATOR_ROADMAP.md`

