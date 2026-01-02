/**
 * Tracker Section Regeneration Module
 * Provides functionality to regenerate individual tracker sections with optional guidance
 */

import { extensionSettings, committedTrackerData, lastGeneratedData } from '../../core/state.js';
import { generateWithExternalAPI } from '../generation/apiClient.js';
import { generateSeparateUpdatePrompt, generateRPGPromptText, generateTrackerInstructions } from '../generation/promptBuilder.js';
import { getContext } from '../../../../../../extensions.js';

const { generateRaw } = SillyTavern.getContext();

/**
 * Merges pinned characters from old data with newly regenerated data
 * Pinned characters that aren't in the new data will be added back
 * @param {string} newData - Newly regenerated Present Characters data
 * @returns {string} Merged data with pinned characters preserved
 */
function mergePinnedCharacters(newData) {
    // If no pinned characters, return new data as-is
    if (!extensionSettings.pinnedCharacters || extensionSettings.pinnedCharacters.length === 0) {
        return newData;
    }

    // Parse existing character data to get pinned character info
    const oldData = lastGeneratedData.characterThoughts || '';
    const oldLines = oldData.split('\n');
    const pinnedCharacterData = {}; // Map of character name -> full character block

    let currentCharName = null;
    let currentCharBlock = [];

    // Extract pinned character blocks from old data
    for (const line of oldLines) {
        const trimmed = line.trim();

        if (trimmed.startsWith('- ')) {
            // Save previous character if it was pinned
            if (currentCharName && extensionSettings.pinnedCharacters.some(
                name => name.toLowerCase() === currentCharName.toLowerCase()
            )) {
                pinnedCharacterData[currentCharName.toLowerCase()] = currentCharBlock.join('\n');
            }

            // Start new character
            currentCharName = trimmed.substring(2).trim();
            currentCharBlock = [line];
        } else if (currentCharName) {
            currentCharBlock.push(line);
        }
    }

    // Save last character if pinned
    if (currentCharName && extensionSettings.pinnedCharacters.some(
        name => name.toLowerCase() === currentCharName.toLowerCase()
    )) {
        pinnedCharacterData[currentCharName.toLowerCase()] = currentCharBlock.join('\n');
    }

    // Parse new data to see which pinned characters are missing
    const newLines = newData.split('\n');
    const newCharacterNames = new Set();

    for (const line of newLines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('- ')) {
            const name = trimmed.substring(2).trim();
            newCharacterNames.add(name.toLowerCase());
        }
    }

    // Find pinned characters that are missing from new data
    const missingPinnedChars = [];
    for (const pinnedName of extensionSettings.pinnedCharacters) {
        if (!newCharacterNames.has(pinnedName.toLowerCase()) &&
            pinnedCharacterData[pinnedName.toLowerCase()]) {
            missingPinnedChars.push(pinnedCharacterData[pinnedName.toLowerCase()]);
        }
    }

    // If no missing pinned characters, return new data as-is
    if (missingPinnedChars.length === 0) {
        return newData;
    }

    // Append missing pinned characters to the end
    let result = newData.trimEnd();
    for (const charBlock of missingPinnedChars) {
        result += '\n\n' + charBlock;
    }

    console.log(`[RPG Companion] Merged ${missingPinnedChars.length} pinned character(s) back into regenerated data`);
    return result;
}

/**
 * Merges frozen characters from stored data with newly regenerated data
 * Frozen characters replace any regenerated version with their locked state
 * @param {string} newData - Newly regenerated Present Characters data
 * @returns {string} Merged data with frozen characters replacing regenerated versions
 */
function mergeFrozenCharacters(newData) {
    // If no frozen characters, return new data as-is
    if (!extensionSettings.frozenCharacters || Object.keys(extensionSettings.frozenCharacters).length === 0) {
        return newData;
    }

    const newLines = newData.split('\n');
    const result = [];
    let currentCharName = null;
    let currentCharBlock = [];
    let skipCurrentChar = false;
    let frozenCharsReplaced = 0;

    for (let i = 0; i < newLines.length; i++) {
        const line = newLines[i];
        const trimmed = line.trim();

        if (trimmed.startsWith('- ')) {
            // Save previous character block if we weren't skipping it
            if (currentCharName && !skipCurrentChar) {
                result.push(...currentCharBlock);
            }

            // Start new character
            currentCharName = trimmed.substring(2).trim();
            const lowerName = currentCharName.toLowerCase();

            // Check if this character is frozen
            if (extensionSettings.frozenCharacters[lowerName]) {
                // Use frozen data instead of regenerated data
                result.push(extensionSettings.frozenCharacters[lowerName]);
                skipCurrentChar = true;
                frozenCharsReplaced++;
                console.log(`[RPG Companion] Replaced regenerated data with frozen state for: ${currentCharName}`);
            } else {
                // Use regenerated data
                currentCharBlock = [line];
                skipCurrentChar = false;
            }
        } else if (!skipCurrentChar) {
            currentCharBlock.push(line);
        }
    }

    // Save last character block if we weren't skipping it
    if (currentCharName && !skipCurrentChar) {
        result.push(...currentCharBlock);
    }

    if (frozenCharsReplaced > 0) {
        console.log(`[RPG Companion] Replaced ${frozenCharsReplaced} frozen character(s) with their locked state`);
    }

    return result.join('\n');
}

/**
 * Merges both pinned and frozen characters with regenerated data
 * First applies frozen character replacements, then adds missing pinned characters
 * @param {string} newData - Newly regenerated Present Characters data
 * @returns {string} Fully merged data
 */
function mergeProtectedCharacters(newData) {
    // First, replace frozen characters with their locked state
    let result = mergeFrozenCharacters(newData);

    // Then, add back any pinned characters that are missing
    result = mergePinnedCharacters(result);

    return result;
}

/**
 * Builds prompt for regenerating User Stats section
 * @param {string} guidance - Optional user guidance
 * @returns {Promise<Array>} Message array for generateRaw
 */
export async function buildUserStatsRegenerationPrompt(guidance) {
    const messages = await generateSeparateUpdatePrompt('userStats');

    // Add user guidance if provided
    if (guidance && guidance.trim()) {
        const lastMessage = messages[messages.length - 1];
        lastMessage.content = `User guidance: ${guidance.trim()}\n\n` + lastMessage.content;
    }

    return messages;
}

/**
 * Builds prompt for regenerating Info Box section
 * @param {string} guidance - Optional user guidance
 * @returns {Promise<Array>} Message array for generateRaw
 */
export async function buildInfoBoxRegenerationPrompt(guidance) {
    const messages = await generateSeparateUpdatePrompt('infoBox');

    // Add user guidance if provided
    if (guidance && guidance.trim()) {
        const lastMessage = messages[messages.length - 1];
        lastMessage.content = `User guidance: ${guidance.trim()}\n\n` + lastMessage.content;
    }

    return messages;
}

/**
 * Builds prompt for regenerating Present Characters section
 * @param {string} guidance - Optional user guidance
 * @returns {Promise<Array>} Message array for generateRaw
 */
export async function buildPresentCharactersRegenerationPrompt(guidance) {
    const messages = await generateSeparateUpdatePrompt('characterThoughts');

    // Add user guidance if provided
    if (guidance && guidance.trim()) {
        const lastMessage = messages[messages.length - 1];
        lastMessage.content = `User guidance: ${guidance.trim()}\n\n` + lastMessage.content;
    }

    return messages;
}

/**
 * Default per-section regeneration settings (fallback if not configured)
 */
const DEFAULT_SECTION_SETTINGS = {
    userStats: {
        maxTokens: 500,
        stopSequences: ['###TRACKER_END###', '\n\n---', '\n\nThe ', '\n\nAs ', '\n\nSuddenly', '\n\n*', 'Here is', 'I hope']
    },
    infoBox: {
        maxTokens: 300,
        stopSequences: ['###TRACKER_END###', '\n\n---', '\n\nThe ', '\n\nAs ', '\n\nSuddenly', '\n\n*', 'Here is', 'I hope']
    },
    characterThoughts: {
        maxTokens: 1000,
        stopSequences: ['###TRACKER_END###', '\n\n---', '\n\nThe ', '\n\nAs ', '\n\nSuddenly', '\n\n*', '\n\nMeanwhile', 'Here is', 'I hope']
    }
};

/**
 * Calls the LLM to generate tracker section data
 * @param {Array} messages - Message array for the LLM
 * @param {string} section - Section being regenerated ('userStats', 'infoBox', 'characterThoughts')
 * @returns {Promise<string>} The LLM response
 */
export async function callLLMForTrackerGeneration(messages, section) {
    const isExternalMode = extensionSettings.generationMode === 'external';

    // Get per-section settings (with fallback to defaults)
    const sectionSettings = extensionSettings.sectionRegenerationSettings?.[section] || DEFAULT_SECTION_SETTINGS[section];
    const maxTokens = sectionSettings?.maxTokens || DEFAULT_SECTION_SETTINGS[section].maxTokens;
    const stopSequences = sectionSettings?.stopSequences || DEFAULT_SECTION_SETTINGS[section].stopSequences;

    try {
        let response;

        if (isExternalMode) {
            // Use external API with per-section stop sequences and max_tokens
            response = await generateWithExternalAPI(messages, {
                maxTokens: maxTokens,
                stop: stopSequences
            });
        } else {
            // Use SillyTavern's internal generation with message array format
            // Match the exact parameters used by the main tracker update (apiClient.js)
            // to avoid triggering additional context injection
            response = await generateRaw({
                prompt: messages,
                quietToLoud: false,
                max_length: maxTokens,     // Limit output length (per-section)
                stop_sequence: stopSequences  // Stop sequences (per-section)
            });
        }

        return response;
    } catch (error) {
        console.error('[RPG Companion] Tracker regeneration failed:', error);
        throw error;
    }
}

/**
 * Parses the LLM response for tracker section regeneration
 * Cleans up markdown code blocks and extra formatting
 * @param {string} response - Raw LLM response
 * @returns {string} Cleaned tracker data
 */
export function parseTrackerRegenerationResponse(response) {
    if (!response) {
        return '';
    }

    let cleaned = response.trim();

    // Remove markdown code blocks
    cleaned = cleaned.replace(/```[a-z]*\n?/gi, '');
    cleaned = cleaned.replace(/```\n?/g, '');

    // Remove XML tags if present
    cleaned = cleaned.replace(/<\/?trackers>/gi, '');

    // Remove end-of-generation marker if present
    cleaned = cleaned.replace(/###TRACKER_END###/gi, '');

    // Clean up extra whitespace
    cleaned = cleaned.trim();

    return cleaned;
}

/**
 * Shows a clean modal to regenerate a tracker section with optional guidance
 * Uses the same UI style as the character editor guidance modal
 * @param {string} sectionType - Type of section: 'userStats', 'infoBox', or 'presentCharacters'
 */
export async function showTrackerRegenerationModal(sectionType) {
    const sectionNames = {
        userStats: "User's Stats",
        infoBox: 'Environment',
        presentCharacters: 'Present Characters'
    };

    const sectionName = sectionNames[sectionType] || sectionType;

    const placeholders = {
        userStats: 'e.g., Increase health to 80%, add a new skill, etc.',
        infoBox: 'e.g., Make it nighttime, add rain, change location to forest, etc.',
        presentCharacters: 'e.g., Add more tension, make characters more friendly, etc.'
    };

    const placeholder = placeholders[sectionType] || 'Any specific direction for the regeneration?';

    const modalHtml = `
        <div id="rpg-guidance-modal" class="rpg-settings-popup is-open" role="dialog" aria-modal="true">
            <div class="rpg-settings-popup-content" style="max-width: 600px;">
                <header class="rpg-settings-popup-header">
                    <h3>
                        <i class="fa-solid fa-wand-magic-sparkles"></i>
                        <span>Regenerate ${sectionName}</span>
                    </h3>
                    <button id="rpg-guidance-close" class="rpg-popup-close" type="button">&times;</button>
                </header>

                <div class="rpg-settings-popup-body">
                    <p style="margin-bottom: 12px; color: var(--SmartThemeBodyColor);">
                        Regenerate the ${sectionName} section based on current context
                    </p>

                    <div style="margin-bottom: 16px;">
                        <label for="rpg-guidance-input" style="display: block; margin-bottom: 8px; font-weight: 600;">
                            Guidance (Optional):
                        </label>
                        <textarea id="rpg-guidance-input" class="text_pole" placeholder="${placeholder}"
                                  style="width: 100%; min-height: 100px; padding: 8px; border: 1px solid var(--SmartThemeBorderColor);
                                         border-radius: 4px; background: var(--SmartThemeBlurTintColor); color: var(--SmartThemeBodyColor);
                                         resize: vertical; font-family: inherit;"></textarea>
                        <p style="font-size: 12px; color: #888; margin-top: 4px;">
                            Leave empty to regenerate without specific guidance. The AI will use the current scene context.
                        </p>
                    </div>
                </div>

                <footer class="rpg-settings-popup-footer">
                    <button id="rpg-guidance-cancel" class="rpg-btn-secondary" type="button">Cancel</button>
                    <button id="rpg-guidance-confirm" class="rpg-btn-primary" type="button">
                        <i class="fa-solid fa-wand-magic-sparkles"></i> Regenerate
                    </button>
                </footer>
            </div>
        </div>
    `;

    // Remove existing modal if present
    $('#rpg-guidance-modal').remove();

    // Add modal to body
    $('body').append(modalHtml);

    // Focus on input
    setTimeout(() => $('#rpg-guidance-input').focus(), 100);

    // Event handlers
    $('#rpg-guidance-close, #rpg-guidance-cancel').on('click', () => {
        $('#rpg-guidance-modal').removeClass('is-open');
        setTimeout(() => $('#rpg-guidance-modal').remove(), 200);
    });

    $('#rpg-guidance-confirm').on('click', async () => {
        const guidance = $('#rpg-guidance-input').val().trim();

        // Close modal
        $('#rpg-guidance-modal').removeClass('is-open');
        setTimeout(() => $('#rpg-guidance-modal').remove(), 200);

        // Show loading toast
        toastr.info(`Regenerating ${sectionName}...`, 'RPG Companion', { timeOut: 0, extendedTimeOut: 0 });

        try {
            await regenerateTrackerSectionDirect(sectionType, guidance);
            toastr.clear();
            toastr.success(`${sectionName} regenerated successfully!`, 'RPG Companion');
        } catch (error) {
            toastr.clear();
            toastr.error(`Failed to regenerate ${sectionName}: ${error.message}`, 'RPG Companion');
            console.error('[RPG Companion] Tracker regeneration error:', error);
        }
    });

    // Ctrl+Enter to confirm
    $('#rpg-guidance-input').on('keydown', (e) => {
        if (e.ctrlKey && e.which === 13) {
            $('#rpg-guidance-confirm').click();
        }
    });
}

/**
 * Shows a dialog to regenerate a tracker section with optional guidance
 * @deprecated Use showTrackerRegenerationModal instead
 * @param {string} sectionType - Type of section: 'userStats', 'infoBox', or 'presentCharacters'
 */
export async function showTrackerRegenerationDialog(sectionType) {
    const sectionNames = {
        userStats: 'User Stats',
        infoBox: 'Info Box',
        presentCharacters: 'Present Characters'
    };

    const sectionName = sectionNames[sectionType] || sectionType;

    // Create simple guidance dialog
    const dialogHtml = `
        <div id="rpg-tracker-regen-dialog" class="rpg-modal-overlay">
            <div class="rpg-modal-content" style="max-width: 450px;">
                <div class="rpg-modal-header">
                    <h3>Regenerate ${sectionName} with Guidance</h3>
                    <button class="rpg-modal-close" id="rpg-tracker-regen-close">×</button>
                </div>
                <div class="rpg-modal-body">
                    <p style="margin-bottom: 12px;">Provide guidance for the AI:</p>
                    <textarea id="rpg-tracker-regen-guidance" class="rpg-textarea" rows="4" placeholder="e.g., Make it nighttime, add rain, increase health to 80%, etc."></textarea>
                    <div style="margin-top: 12px; display: flex; gap: 8px; justify-content: flex-end;">
                        <button id="rpg-tracker-regen-cancel" class="rpg-btn-secondary">Cancel</button>
                        <button id="rpg-tracker-regen-confirm" class="rpg-btn-primary">
                            <i class="fa-solid fa-rotate"></i> Regenerate
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Remove existing dialog if any
    $('#rpg-tracker-regen-dialog').remove();

    // Add dialog to page
    $('body').append(dialogHtml);

    // Close button
    $('#rpg-tracker-regen-close, #rpg-tracker-regen-cancel').on('click', function() {
        $('#rpg-tracker-regen-dialog').remove();
    });

    // "Regenerate" button (with guidance)
    $('#rpg-tracker-regen-confirm').on('click', async function() {
        const guidance = $('#rpg-tracker-regen-guidance').val().trim();
        $('#rpg-tracker-regen-dialog').remove();

        // Show loading toast
        toastr.info(`Regenerating ${sectionName}...`, 'RPG Companion', { timeOut: 0, extendedTimeOut: 0 });

        try {
            await regenerateTrackerSectionDirect(sectionType, guidance);
            toastr.clear();
            toastr.success(`${sectionName} regenerated successfully!`, 'RPG Companion');
        } catch (error) {
            toastr.clear();
            toastr.error(`Failed to regenerate ${sectionName}: ${error.message}`, 'RPG Companion');
            console.error('[RPG Companion] Tracker regeneration error:', error);
        }
    });

    // Close on overlay click
    $('#rpg-tracker-regen-dialog').on('click', function(e) {
        if (e.target.id === 'rpg-tracker-regen-dialog') {
            $('#rpg-tracker-regen-dialog').remove();
        }
    });

    // Focus on textarea
    $('#rpg-tracker-regen-guidance').focus();
}

/**
 * Regenerates a tracker section using the LLM (exported for direct use)
 * @param {string} sectionType - Type of section: 'userStats', 'infoBox', or 'presentCharacters'
 * @param {string} guidance - Optional user guidance
 */
export async function regenerateTrackerSectionDirect(sectionType, guidance) {
    // Import rendering functions
    const { renderUserStats } = await import('../rendering/userStats.js');
    const { renderInfoBox } = await import('../rendering/infoBox.js');
    const { renderThoughts } = await import('../rendering/thoughts.js');
    const { saveChatData, updateMessageSwipeData } = await import('../../core/persistence.js');

    // Build prompt based on section type
    let prompt;
    switch (sectionType) {
        case 'userStats':
            prompt = await buildUserStatsRegenerationPrompt(guidance);
            break;
        case 'infoBox':
            prompt = await buildInfoBoxRegenerationPrompt(guidance);
            break;
        case 'presentCharacters':
            prompt = await buildPresentCharactersRegenerationPrompt(guidance);
            break;
        default:
            throw new Error(`Unknown section type: ${sectionType}`);
    }

    console.log('[RPG Companion] Regenerating tracker section:', sectionType);
    console.log('[RPG Companion] Prompt:', prompt);

    // Map sectionType to section name for settings lookup
    const sectionMap = {
        'userStats': 'userStats',
        'infoBox': 'infoBox',
        'presentCharacters': 'characterThoughts'
    };
    const section = sectionMap[sectionType];

    // Call LLM with per-section settings
    const response = await callLLMForTrackerGeneration(prompt, section);
    console.log('[RPG Companion] LLM Response:', response);

    // Validate response
    if (!response || typeof response !== 'string' || response.trim().length === 0) {
        throw new Error('LLM returned an empty or invalid response');
    }

    // Parse response
    const cleanedData = parseTrackerRegenerationResponse(response);
    console.log('[RPG Companion] Cleaned data:', cleanedData);

    // Validate cleaned data
    if (!cleanedData || cleanedData.trim().length === 0) {
        throw new Error('LLM response could not be parsed into valid tracker data');
    }

    // Additional validation based on section type
    const sectionNames = {
        userStats: 'User Stats',
        infoBox: 'Info Box',
        presentCharacters: 'Present Characters'
    };

    if (sectionType === 'userStats' && !cleanedData.includes(':')) {
        throw new Error(`${sectionNames[sectionType]} data appears to be invalid - no stat fields found`);
    }

    if (sectionType === 'infoBox' && !cleanedData.includes(':')) {
        throw new Error(`${sectionNames[sectionType]} data appears to be invalid - no info fields found`);
    }

    if (sectionType === 'presentCharacters' && !cleanedData.includes('Present Characters')) {
        throw new Error(`${sectionNames[sectionType]} data appears to be invalid - missing header`);
    }

    // Update the appropriate data
    switch (sectionType) {
        case 'userStats':
            lastGeneratedData.userStats = cleanedData;
            committedTrackerData.userStats = cleanedData;
            break;
        case 'infoBox':
            lastGeneratedData.infoBox = cleanedData;
            committedTrackerData.infoBox = cleanedData;
            break;
        case 'presentCharacters':
            // Merge frozen and pinned characters with regenerated data
            const mergedData = mergeProtectedCharacters(cleanedData);
            lastGeneratedData.characterThoughts = mergedData;
            committedTrackerData.characterThoughts = mergedData;
            break;
    }

    // Save to chat metadata
    saveChatData();
    updateMessageSwipeData();

    // Re-render the appropriate section
    switch (sectionType) {
        case 'userStats':
            renderUserStats();
            break;
        case 'infoBox':
            renderInfoBox();
            break;
        case 'presentCharacters':
            renderThoughts();
            break;
    }

    console.log('[RPG Companion] Tracker section regenerated successfully:', sectionType);
}

