# RPG Companion - TODO & Known Issues

## 🐛 Known Issues

### Character Card Stacking Bug (Low Priority - Not Consistently Reproducible)

**Status:** Documented, Mitigated  
**Priority:** Low (inconvenient, not breaking)  
**Last Updated:** 2026-01-01

#### Symptoms
- Character cards occasionally stack horizontally (side-by-side) instead of vertically in the Present Characters panel
- Only occurs when regenerating a field on the **first character** in the list
- Only happens when that character has an avatar that loads from the character library
- Does NOT occur with:
  - Manual field edits
  - Regenerating second or later characters
  - Characters without avatars
  - Characters with custom uploaded avatars
- Not consistently reproducible - appears to be timing-dependent

#### Root Cause (Suspected)
Race condition between avatar image loading and flex layout calculation:
1. When the first character's avatar loads from the character library via `getSafeThumbnailUrl()`
2. The image load event may trigger a browser layout recalculation
3. This interferes with the `flex-direction: column` property on `.rpg-thoughts-content`
4. The timing changes when multiple characters have avatars (explains why adding another character with an avatar prevents the bug)

#### Current Mitigations
- ✅ CSS hardening with `!important` flags on flex properties
  - `style.css` lines 1703-1721 (`.rpg-thoughts-content`)
  - `style.css` lines 1844-1866 (`.rpg-character-card`)
- ✅ Single render after modal close (prevents double-render race condition)
  - `src/systems/ui/characterEditor.js` line 415-430
- ✅ `forceLayoutRefresh()` helper to manually trigger reflow when needed
  - `src/systems/ui/characterEditor.js` line 24-68

#### Potential Fixes to Investigate
1. **Image Preloading:** Add `image.onload` event handlers in `getCharacterAvatar()` that trigger layout reflow
2. **CSS Containment:** Use CSS `contain` property to isolate character card layouts
3. **Deferred Rendering:** Wait for all avatar images to load before rendering (Promise.all approach)
4. **MutationObserver:** Add observer to detect layout changes and force correction
5. **SillyTavern Integration:** Check if SillyTavern's thumbnail loading has completion callbacks we can hook into

#### Related Files
- `src/systems/ui/characterEditor.js` - Modal and save logic
- `src/systems/rendering/thoughts.js` - Avatar loading (`getCharacterAvatar()`) and rendering (`renderThoughts()`)
- `style.css` - Layout styles with hardening

---

## 📋 Future Enhancements

### Planned Features
- [ ] TBD

### Code Quality
- [ ] Review and optimize avatar loading performance
- [ ] Add unit tests for character data parsing
- [ ] Document all public API functions

---

## 📝 Notes

### Development Guidelines
- Always test with multiple characters (especially first character edge cases)
- Test with both custom avatars and library avatars
- Check layout after regeneration operations
- Verify flex layout properties are maintained

### Testing Checklist for Layout Changes
- [ ] Test with 1 character
- [ ] Test with 3+ characters
- [ ] Test with first character having library avatar
- [ ] Test regeneration on first character
- [ ] Test regeneration on second+ characters
- [ ] Test manual edits
- [ ] Test with custom uploaded avatars
- [ ] Test with no avatars (fallback)

