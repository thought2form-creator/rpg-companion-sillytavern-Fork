# Agent Notes - RPG Companion SillyTavern Extension

## Important Locations & File References

### Core Configuration
- **Extension Config**: `src/core/config.js`
  - `extensionName`: 'third-party/rpg-companion-sillytavern'
  - `extensionFolderPath`: Dynamically determined based on installation location
  - User extension path: `data/default-user/extensions/third-party/rpg-companion-sillytavern`

### Character Creator System
- **Main UI**: `src/systems/ui/characterCreatorUI.js`
  - Handles all character creator UI rendering and interactions
  - Template creation/save/delete functionality
  - Field generation and management

- **Template Parser**: `src/systems/ui/templateParser.js`
  - `parseTemplate()`: Parses template files with format `**Field:**` and `*[instruction]*`
  - `loadTemplate()`: Loads templates from `/${extensionFolderPath}/templates/`
  - `getAvailableTemplates()`: Returns list of available templates

- **Field Generator**: `src/systems/ui/templateFieldGenerator.js`
  - `renderTemplateFields()`: Generates UI for template fields
  - Line 21: Changed `<details open>` to `<details>` to default all dropdowns to closed

### Template System

#### Template Format (CRITICAL)
Templates use this exact format (see `templates/female.txt`):
```
**Field Name:**
*[Instruction text]*

**Another Field:**
*[Another instruction]*
```

Example:
```
**Name:**
*[NPC's full name]*

**Physical Description:**
*[Detailed description of the NPC's appearance]*
```

#### Template Locations
- **Extension templates** (read-only, bundled): `templates/` folder in extension root
  - `female.txt`, `male.txt`, `default.txt`
  - Loaded via: `/${extensionFolderPath}/templates/${templateName}.txt`

- **User templates** (user-created, isolated): `SillyTavern\data\default-user\rpg-companion-templates\`
  - This is where users should save custom templates
  - Keeps user data separate from extension folder
  - NOT affected by extension updates/reinstalls

### Recent Changes Made

#### 1. Template Dropdowns Default to Closed
- File: `src/systems/ui/templateFieldGenerator.js` line 21
- Changed: `<details open>` → `<details>`

#### 2. Template Creation UI
- Added collapsible "Create New Template" section
- Two fields:
  - Template Name input
  - Template Content textarea (with correct format in placeholder)
- Save button downloads `.txt` file

#### 3. Save Template Functionality
- Downloads template content as `.txt` file
- Shows popup with inline CSS (no external classes)
- Displays path: `SillyTavern\data\default-user\rpg-companion-templates\`
- Clears both name and content fields after save

#### 4. Delete Template Button
- Trash icon button next to refresh
- Only enabled when template selected
- Confirmation dialog with inline CSS
- Warning: "This action cannot be undone"

#### 5. Character Generation Collapsible
- Wrapped template fields in `<details>` element
- Header: "Character Generation"
- Starts open by default

### Important Code Patterns

#### Inline CSS Requirement
All popups/dialogs MUST use inline CSS only:
```javascript
const element = document.createElement('div');
element.style.cssText = 'position: fixed; top: 0; ...';
// NOT: element.className = 'some-class'
```

#### Path Construction
- Extension path: Use `extensionFolderPath` from config
- User data path: `data/default-user/rpg-companion-templates/`
- Always use backslashes for Windows paths in user-facing messages

### Key Dependencies
- jQuery: Used throughout for DOM manipulation
- toastr: For toast notifications
- Font Awesome: For icons (fa-solid classes)

### Testing Checklist
- [ ] All dropdowns start closed
- [ ] Template creation UI visible and collapsible
- [ ] Save template downloads correct format
- [ ] Popup shows correct path with inline CSS
- [ ] Delete button works with confirmation
- [ ] Character Generation section is collapsible
- [ ] No syntax errors in browser console

### Common Pitfalls
1. **Template format**: Must be `**Field:**` then `*[instruction]*` - NOT other formats
2. **User data isolation**: Templates go to `data/default-user/rpg-companion-templates/` NOT extension folder
3. **Inline CSS**: All popups need inline styles, no class-based CSS
4. **Template literals**: Use backticks `` ` `` not escaped `\``
5. **Path separators**: Use `\\` for Windows paths in user messages

