/**
 * Emoji Picker - Simple fallback implementation
 * No external dependencies
 */

/**
 * Initialize the emoji picker (no-op for fallback)
 * @returns {Promise<void>}
 */
export async function initEmojiPicker() {
    // Fallback picker doesn't need initialization
    console.log('[RPG Companion] Using fallback emoji picker');
}

/**
 * Show the emoji picker - returns false to trigger fallback
 * @param {HTMLElement} targetElement - Element to position near
 * @param {Function} onSelect - Callback when emoji is selected (receives emoji string)
 * @returns {boolean} Success (always false to use fallback)
 */
export function showEmojiPicker(targetElement, onSelect) {
    // Always return false to use the fallback custom picker
    return false;
}

/**
 * Hide the emoji picker (no-op for fallback)
 */
export function hideEmojiPicker() {
    // No-op for fallback
}

/**
 * Check if the emoji picker is currently visible
 * @returns {boolean}
 */
export function isEmojiPickerVisible() {
    return false;
}

