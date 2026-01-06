/**
 * World Info Filter System
 * Filters world info strings based on user's lorebook/entry selections
 */

import { loadWorldInfo } from '../../../../../../world-info.js';

/**
 * Loads and filters world info entries based on user's lorebook/entry selections
 * This is the preferred method as it has access to full entry metadata
 * @param {string[]} selectedLorebooks - Array of lorebook names to include
 * @param {Object} selectedEntryUids - Map of { lorebookName: { uid: true } } for selected entries
 * @returns {Promise<string>} Filtered world info string
 */
export async function getFilteredWorldInfo(selectedLorebooks, selectedEntryUids = {}) {
    if (!selectedLorebooks || selectedLorebooks.length === 0) {
        return '';
    }

    console.log('[RPG Companion] Loading filtered world info. Selected lorebooks:', selectedLorebooks);
    console.log('[RPG Companion] Selected entry UIDs:', selectedEntryUids);

    try {
        const allEntries = [];

        // Load entries from each selected lorebook
        for (const bookName of selectedLorebooks) {
            const worldInfo = await loadWorldInfo(bookName);

            if (!worldInfo || !worldInfo.entries) {
                console.warn(`[RPG Companion] Could not load lorebook: ${bookName}`);
                continue;
            }

            const entries = Object.values(worldInfo.entries);
            console.log(`[RPG Companion] Lorebook ${bookName} has ${entries.length} entries`);

            // Get selected entries for this specific lorebook
            const selectedEntriesForBook = selectedEntryUids[bookName] || {};
            const hasSpecificEntries = Object.keys(selectedEntriesForBook).length > 0;

            // Filter entries if specific UIDs are selected for this lorebook
            const filteredEntries = hasSpecificEntries
                ? entries.filter(entry => {
                    const isSelected = selectedEntriesForBook[entry.uid] === true;
                    console.log(`[RPG Companion] Entry ${entry.uid} (${entry.comment}): selected=${isSelected}`);
                    return isSelected;
                })
                : entries;

            console.log(`[RPG Companion] Filtered to ${filteredEntries.length} entries from ${bookName}`);
            allEntries.push(...filteredEntries);
        }

        console.log(`[RPG Companion] Loaded ${allEntries.length} filtered world info entries`);

        // Build world info string from entries
        // Use the entry content directly
        const worldInfoString = allEntries
            .map(entry => entry.content)
            .filter(content => content && content.trim())
            .join('\n\n');

        return worldInfoString;
    } catch (error) {
        console.error('[RPG Companion] Error loading filtered world info:', error);
        return '';
    }
}

/**
 * Filters world info string based on user's lorebook selections
 * @deprecated Use getFilteredWorldInfo() instead for better filtering
 * This function tries to parse an already-generated world info string,
 * but metadata about lorebook names and UIDs is usually not present
 * @param {string|Object} worldInfoInput - Raw world info from getWorldInfoPrompt() (can be string or object)
 * @param {string[]} selectedLorebooks - Array of lorebook names to include
 * @param {Object} selectedEntryUids - Map of {uid: true} for selected entries
 * @returns {string} Filtered world info string
 */
export function filterWorldInfoBySelection(worldInfoInput, selectedLorebooks, selectedEntryUids = {}) {
    // If no filtering needed, return original
    if (!worldInfoInput || !selectedLorebooks || selectedLorebooks.length === 0) {
        return worldInfoInput;
    }

    console.log('[RPG Companion] Filtering world info. Selected lorebooks:', selectedLorebooks);
    console.log('[RPG Companion] Selected entry UIDs:', selectedEntryUids);
    console.log('[RPG Companion] World info input type:', typeof worldInfoInput);

    try {
        // Handle if worldInfoInput is an object (extract the string)
        let worldInfoString = worldInfoInput;
        if (typeof worldInfoInput === 'object') {
            // Try common properties
            worldInfoString = worldInfoInput.worldInfoString ||
                            worldInfoInput.worldInfoBefore ||
                            worldInfoInput.worldInfoAfter ||
                            '';
            console.log('[RPG Companion] Extracted string from object, length:', worldInfoString?.length);
        }

        // Ensure we have a string
        if (typeof worldInfoString !== 'string') {
            console.warn('[RPG Companion] World info is not a string, returning original');
            return worldInfoInput;
        }

        if (!worldInfoString.trim()) {
            console.log('[RPG Companion] World info string is empty');
            return worldInfoString;
        }

        // Parse the world info string into entries
        const entries = parseWorldInfoEntries(worldInfoString);

        console.log('[RPG Companion] Parsed', entries.length, 'world info entries');

        // Check if we have specific entry UIDs selected
        const hasSpecificEntries = selectedEntryUids && Object.keys(selectedEntryUids).length > 0;

        // Filter entries based on selected lorebooks and/or UIDs
        const filtered = entries.filter(entry => {
            // If specific UIDs are selected, only include those entries
            if (hasSpecificEntries) {
                return selectedEntryUids[entry.uid] === true;
            }

            // Otherwise, filter by lorebook name
            return selectedLorebooks.includes(entry.lorebookName);
        });

        console.log('[RPG Companion] Filtered to', filtered.length, 'entries');

        // Reconstruct the world info string
        return filtered.map(e => e.content).join('\n\n');
    } catch (error) {
        console.error('[RPG Companion] Error filtering world info:', error);
        // On error, return original to avoid breaking prompts
        return worldInfoInput;
    }
}

/**
 * Parse world info string into structured entries
 * SillyTavern's world info format varies, so this uses heuristics
 * @param {string} worldInfoString - Raw world info string
 * @returns {Array<{content: string, lorebookName: string, uid: number}>}
 */
function parseWorldInfoEntries(worldInfoString) {
    const entries = [];
    
    // Split by double newlines (common separator)
    const chunks = worldInfoString.split('\n\n').filter(chunk => chunk.trim());

    for (const chunk of chunks) {
        const entry = {
            content: chunk,
            lorebookName: extractLorebookName(chunk),
            uid: extractUID(chunk)
        };
        entries.push(entry);
    }

    return entries;
}

/**
 * Extract lorebook name from entry content
 * Looks for patterns like:
 * - "<!-- lorebook: Name -->"
 * - "[Lorebook: Name]"
 * - Or tries to infer from content
 * @param {string} content - Entry content
 * @returns {string} Lorebook name or 'Unknown'
 */
function extractLorebookName(content) {
    // Try HTML comment format: <!-- lorebook: Name -->
    const htmlCommentMatch = content.match(/<!--\s*lorebook:\s*([^,\-]+)/i);
    if (htmlCommentMatch) {
        return htmlCommentMatch[1].trim();
    }

    // Try bracket format: [Lorebook: Name]
    const bracketMatch = content.match(/\[Lorebook:\s*([^\]]+)\]/i);
    if (bracketMatch) {
        return bracketMatch[1].trim();
    }

    // Try to find book name in first line
    const firstLine = content.split('\n')[0];
    const bookMatch = firstLine.match(/Book:\s*([^,\n]+)/i);
    if (bookMatch) {
        return bookMatch[1].trim();
    }

    // Default to 'Unknown' if no lorebook name found
    return 'Unknown';
}

/**
 * Extract UID from entry content
 * Looks for patterns like:
 * - "<!-- uid: 123 -->"
 * - "[UID: 123]"
 * @param {string} content - Entry content
 * @returns {number|null} UID or null if not found
 */
function extractUID(content) {
    // Try HTML comment format: <!-- uid: 123 -->
    const htmlCommentMatch = content.match(/<!--[^>]*uid:\s*(\d+)/i);
    if (htmlCommentMatch) {
        return parseInt(htmlCommentMatch[1], 10);
    }

    // Try bracket format: [UID: 123]
    const bracketMatch = content.match(/\[UID:\s*(\d+)\]/i);
    if (bracketMatch) {
        return parseInt(bracketMatch[1], 10);
    }

    return null;
}

