/**
 * Character Creator Module
 * Handles AI-powered creation of new character cards from scratch
 *
 * This module allows users to create new character cards by providing:
 * - A character concept/description
 * - Optional world info context (from lorebooks)
 * - Optional chat history context
 * - Template-based field generation
 *
 * All data is saved using the existing extension persistence system:
 * - Templates saved in extensionSettings (via saveSettings())
 * - Work-in-progress saved in localStorage (auto-save)
 * - Final output exported as text/JSON
 */

import { getContext } from '../../../../../../extensions.js';
import { chat, characters, this_chid, generateRaw } from '../../../../../../../script.js';
import { selected_group, getGroupMembers, groups } from '../../../../../../group-chats.js';
import { power_user } from '../../../../../../power-user.js';
import { extensionSettings, committedTrackerData } from '../../core/state.js';
import { saveSettings } from '../../core/persistence.js';
import { generateWithExternalAPI } from '../generation/apiClient.js';

/**
 * Gets available Connection Profiles
 * @returns {Array<{id: string, name: string}>} Array of available profiles
 */
export function getAvailableProfiles() {
    try {
        const context = getContext();
        const profiles = context.extensionSettings?.connectionManager?.profiles || [];
        return profiles.map(p => ({ id: p.id, name: p.name }));
    } catch (error) {
        console.warn('[Character Creator] Error getting profiles:', error);
        return [];
    }
}

/**
 * Gets the currently selected Connection Profile for Character Creator
 * @returns {string} Profile ID or empty string
 */
export function getSelectedProfile() {
    const creatorSettings = extensionSettings.characterCreator || {};
    return creatorSettings.profileId || '';
}

/**
 * Sets the Connection Profile for Character Creator
 * @param {string} profileId - Profile ID to use
 */
export function setSelectedProfile(profileId) {
    if (!extensionSettings.characterCreator) {
        extensionSettings.characterCreator = {};
    }
    extensionSettings.characterCreator.profileId = profileId;
    saveSettings();
    console.log('[Character Creator] Profile set to:', profileId);
}

/**
 * Gets the max tokens setting from the user's active preset
 * @returns {number} Max tokens for output generation
 */
export function getPresetMaxTokens() {
    try {
        const context = getContext();

        // Try to get from preset manager first
        if (context?.getPresetManager) {
            const presetManager = context.getPresetManager();
            if (presetManager?.getSelectedPreset) {
                const preset = presetManager.getSelectedPreset();

                // Handle different preset formats
                if (preset && typeof preset === 'object') {
                    // OpenAI format
                    if (preset.openai_max_tokens) {
                        console.log('[Character Creator] Using preset openai_max_tokens:', preset.openai_max_tokens);
                        return preset.openai_max_tokens;
                    }
                    // Generic max_tokens
                    if (preset.max_tokens) {
                        console.log('[Character Creator] Using preset max_tokens:', preset.max_tokens);
                        return preset.max_tokens;
                    }
                }
            }
        }

        // Fallback to power_user settings
        if (power_user?.openai_max_tokens) {
            console.log('[Character Creator] Using power_user openai_max_tokens:', power_user.openai_max_tokens);
            return power_user.openai_max_tokens;
        }

        // Fallback to extension's external API settings
        if (extensionSettings.externalApiSettings?.maxTokens) {
            console.log('[Character Creator] Using extension external API maxTokens:', extensionSettings.externalApiSettings.maxTokens);
            return extensionSettings.externalApiSettings.maxTokens;
        }

        // Final fallback
        console.log('[Character Creator] Using default maxTokens: 2048');
        return 2048;

    } catch (error) {
        console.warn('[Character Creator] Error getting preset max tokens:', error);
        return 2048;
    }
}

/**
 * Gets the max context tokens setting from the user's active preset
 * @returns {number} Max tokens for context/input
 */
export function getPresetMaxContext() {
    try {
        const context = getContext();

        // Try to get from preset manager first
        if (context?.getPresetManager) {
            const presetManager = context.getPresetManager();
            if (presetManager?.getSelectedPreset) {
                const preset = presetManager.getSelectedPreset();

                // Handle different preset formats
                if (preset && typeof preset === 'object') {
                    // OpenAI format
                    if (preset.openai_max_context) {
                        console.log('[Character Creator] Using preset openai_max_context:', preset.openai_max_context);
                        return preset.openai_max_context;
                    }
                    // Generic max_context
                    if (preset.max_context) {
                        console.log('[Character Creator] Using preset max_context:', preset.max_context);
                        return preset.max_context;
                    }
                }
            }
        }

        // Fallback to power_user settings
        if (power_user?.openai_max_context) {
            console.log('[Character Creator] Using power_user openai_max_context:', power_user.openai_max_context);
            return power_user.openai_max_context;
        }

        // Final fallback
        console.log('[Character Creator] Using default maxContext: 8192');
        return 8192;

    } catch (error) {
        console.warn('[Character Creator] Error getting preset max context:', error);
        return 8192;
    }
}

/**
 * Gets character card information for context (existing characters in the scene)
 * @returns {Promise<string>} Formatted character information
 */
async function getCharacterCardsInfo() {
    let characterInfo = '';

    // Check if in group chat
    if (selected_group) {
        const group = groups.find(g => g.id === selected_group);
        const groupMembers = getGroupMembers(selected_group);

        if (groupMembers && groupMembers.length > 0) {
            characterInfo += 'Existing characters in this roleplay:\n\n';
            const disabledMembers = group?.disabled_members || [];
            let characterIndex = 0;

            groupMembers.forEach((member) => {
                if (!member || !member.name) return;
                if (member.avatar && disabledMembers.includes(member.avatar)) return;

                characterIndex++;
                characterInfo += `<character${characterIndex}="${member.name}">\n`;
                if (member.description) characterInfo += `${member.description}\n`;
                if (member.personality) characterInfo += `${member.personality}\n`;
                characterInfo += `</character${characterIndex}>\n\n`;
            });
        }
    } else if (this_chid !== undefined && characters && characters[this_chid]) {
        const character = characters[this_chid];
        characterInfo += 'Existing character in this roleplay:\n\n';
        characterInfo += `<character="${character.name}">\n`;
        if (character.description) characterInfo += `${character.description}\n`;
        if (character.personality) characterInfo += `${character.personality}\n`;
        characterInfo += `</character>\n\n`;
    }

    return characterInfo;
}

/**
 * Gets recent chat context (last N messages)
 * @param {number} depth - Number of messages to include
 * @returns {string} Formatted chat context
 */
function getChatContext(depth = 4) {
    if (!chat || chat.length === 0) return '';

    const recentMessages = chat.slice(-depth);
    let context = 'Recent conversation:\n\n';

    recentMessages.forEach(msg => {
        const name = msg.name || (msg.is_user ? getContext().name1 : 'Character');
        const message = msg.mes || '';
        context += `${name}: ${message}\n\n`;
    });

    return context;
}

/**
 * Gets current scene context from trackers
 * @returns {string} Formatted tracker context
 */
function getTrackerContext() {
    let context = '';

    if (committedTrackerData.infoBox) {
        context += `Current Environment:\n${committedTrackerData.infoBox}\n\n`;
    }

    if (committedTrackerData.userStats) {
        context += `User Stats:\n${committedTrackerData.userStats}\n\n`;
    }

    return context;
}

/**
 * Gets world info from lorebooks (scans based on user input)
 * @param {string} userInput - The user's character concept/description
 * @returns {Promise<string>} Formatted world info
 */
async function getWorldInfo(userInput) {
    const context = getContext();
    let worldInfoAdded = false;
    let worldInfoString = '';

    try {
        // Use SillyTavern's getWorldInfoPrompt to scan lorebooks
        const getWorldInfoFn = context.getWorldInfoPrompt || window.getWorldInfoPrompt;

        if (typeof getWorldInfoFn === 'function') {
            // Create a temporary message array with the user input for scanning
            const scanMessages = [userInput];

            console.log('[Character Creator] Scanning world info with user input');

            const result = await getWorldInfoFn(scanMessages, 8000, false);

            // Handle different return types
            if (typeof result === 'string') {
                worldInfoString = result;
            } else if (result && typeof result === 'object') {
                worldInfoString = result.worldInfoString || result.worldInfoBefore || '';
            }

            // Ensure worldInfoString is a string
            if (typeof worldInfoString !== 'string') {
                worldInfoString = '';
            }

            if (worldInfoString && worldInfoString.trim()) {
                worldInfoAdded = true;
                console.log('[Character Creator] ✅ Found world info:', worldInfoString.length, 'characters');
            }
        }
    } catch (e) {
        console.warn('[Character Creator] Failed to get world info:', e);
    }

    // Fallback to activatedWorldInfo if available
    if (!worldInfoAdded && context.activatedWorldInfo && Array.isArray(context.activatedWorldInfo) && context.activatedWorldInfo.length > 0) {
        console.log('[Character Creator] Using fallback activatedWorldInfo:', context.activatedWorldInfo.length, 'entries');
        context.activatedWorldInfo.forEach((entry) => {
            if (entry && entry.content) {
                worldInfoString += `${entry.content}\n\n`;
                worldInfoAdded = true;
            }
        });
    }

    if (worldInfoAdded && worldInfoString && worldInfoString.trim()) {
        return `World/Setting Information:\n<setting>\n${worldInfoString.trim()}\n</setting>\n\n`;
    }

    return '';
}

/**
 * Builds the prompt for creating a new character
 * @param {string} userInput - User's character concept/description
 * @param {Object} options - Generation options
 * @param {boolean} options.includeChat - Include chat history
 * @param {boolean} options.includeWorldInfo - Include world info
 * @param {boolean} options.includeExistingChars - Include existing character cards
 * @param {boolean} options.includeTrackers - Include tracker context
 * @param {Array} options.fields - Array of field definitions to generate
 * @returns {Promise<string>} The prompt text
 */
export async function buildCharacterCreationPrompt(userInput, options = {}) {
    const {
        includeChat = true,
        includeWorldInfo = true,
        includeExistingChars = true,
        includeTrackers = true,
        fields = []
    } = options;

    const userName = getContext().name1;
    let prompt = '';

    // Add world info if enabled
    if (includeWorldInfo) {
        const worldInfo = await getWorldInfo(userInput);
        if (worldInfo) {
            prompt += worldInfo;
        }
    }

    // Add existing character context if enabled
    if (includeExistingChars) {
        const characterInfo = await getCharacterCardsInfo();
        if (characterInfo) {
            prompt += characterInfo;
        }
    }

    // Add tracker context if enabled
    if (includeTrackers) {
        const trackerContext = getTrackerContext();
        if (trackerContext) {
            prompt += trackerContext;
        }
    }

    // Add chat context if enabled
    if (includeChat) {
        const creatorSettings = extensionSettings.characterCreator || {};
        const chatDepth = creatorSettings.chatContextDepth || 4;
        const chatContext = getChatContext(chatDepth);
        if (chatContext) {
            prompt += chatContext;
        }
    }

    // Add user's character concept
    prompt += `Character Concept:\n${userInput}\n\n`;

    // Add instructions
    prompt += `Task: Create a new character based on the concept provided above.\n\n`;

    if (includeWorldInfo || includeExistingChars || includeTrackers || includeChat) {
        prompt += `Use the provided context (world info, existing characters, current scene, and conversation) to make the character fit naturally into this setting.\n\n`;
    }

    prompt += `Generate the following character data:\n\n`;

    // Add field specifications
    fields.forEach(field => {
        const description = field.description || field.name;
        prompt += `${field.name}: [${description}]\n`;
    });

    prompt += `\nProvide only the character data in the exact format shown above. Do not include any additional commentary or explanation.`;

    return prompt;
}

/**
 * Builds the prompt for generating a single field
 * @param {string} userInput - User's character concept/description
 * @param {string} fieldName - Name of the field to generate
 * @param {Object} fieldConfig - Field configuration
 * @param {Object} currentData - Current character data (for context)
 * @param {Object} options - Generation options
 * @returns {Promise<string>} The prompt text
 */
export async function buildFieldCreationPrompt(userInput, fieldName, fieldConfig, currentData = {}, options = {}) {
    const {
        includeChat = true,
        includeWorldInfo = true,
        includeExistingChars = true,
        includeTrackers = true
    } = options;

    let prompt = '';

    // Add world info if enabled
    if (includeWorldInfo) {
        const worldInfo = await getWorldInfo(userInput);
        if (worldInfo) {
            prompt += worldInfo;
        }
    }

    // Add existing character context if enabled
    if (includeExistingChars) {
        const characterInfo = await getCharacterCardsInfo();
        if (characterInfo) {
            prompt += characterInfo;
        }
    }

    // Add tracker context if enabled
    if (includeTrackers) {
        const trackerContext = getTrackerContext();
        if (trackerContext) {
            prompt += trackerContext;
        }
    }

    // Add chat context if enabled
    if (includeChat) {
        const creatorSettings = extensionSettings.characterCreator || {};
        const chatDepth = creatorSettings.chatContextDepth || 4;
        const chatContext = getChatContext(chatDepth);
        if (chatContext) {
            prompt += chatContext;
        }
    }

    // Add user's character concept
    prompt += `Character Concept:\n${userInput}\n\n`;

    // Add any existing character data for context
    if (Object.keys(currentData).length > 0) {
        prompt += `Current character data:\n`;
        Object.entries(currentData).forEach(([key, value]) => {
            if (value && value.trim()) {
                prompt += `${key}: ${value}\n`;
            }
        });
        prompt += `\n`;
    }

    // Add instructions
    const fieldDescription = fieldConfig?.description || fieldName;
    prompt += `Task: Generate the "${fieldName}" field for this character.\n`;
    prompt += `Field description: ${fieldDescription}\n\n`;
    prompt += `Provide only the value for ${fieldName}, without any additional commentary or formatting.`;

    return prompt;
}

/**
 * Builds messages array with chat history for Connection Profile
 * Similar to generateSeparateUpdatePrompt but for character creation
 * @param {string} systemPrompt - System message content
 * @param {string} userPrompt - Final user instruction
 * @param {number} chatDepth - Number of recent messages to include
 * @returns {Array<{role: string, content: string}>} Messages array
 */
function buildCharacterCreationMessages(systemPrompt, userPrompt, chatDepth) {
    const messages = [];

    // Add system message
    messages.push({
        role: 'system',
        content: systemPrompt
    });

    // Add chat history if available and depth > 0
    if (chat && chat.length > 0 && chatDepth > 0) {
        const recentMessages = chat.slice(-chatDepth);

        for (const message of recentMessages) {
            messages.push({
                role: message.is_user ? 'user' : 'assistant',
                content: message.mes
            });
        }
    }

    // Add final user instruction
    messages.push({
        role: 'user',
        content: userPrompt
    });

    return messages;
}

/**
 * Calls the LLM to generate character data using Connection Profiles
 * @param {string} prompt - The prompt to send
 * @param {Object} options - Optional generation parameters
 * @param {number} options.maxTokens - Max tokens for generation (overrides profile setting)
 * @param {Array<string>} options.stopSequences - Stop sequences
 * @returns {Promise<string>} The LLM response
 */
export async function callLLMForCreation(prompt, options = {}) {
    const creatorSettings = extensionSettings.characterCreator || {};
    const profileId = creatorSettings.profileId;

    // If no profile is selected, fall back to legacy method
    if (!profileId) {
        console.warn('[Character Creator] No Connection Profile selected, using legacy generation method');
        return callLLMForCreationLegacy(prompt, options);
    }

    try {
        const context = getContext();

        // Check if ConnectionManagerRequestService is available
        if (!context.ConnectionManagerRequestService || !context.ConnectionManagerRequestService.sendRequest) {
            console.warn('[Character Creator] ConnectionManagerRequestService not available, using legacy generation method');
            return callLLMForCreationLegacy(prompt, options);
        }

        // Verify profile exists
        const profiles = context.extensionSettings?.connectionManager?.profiles || [];
        const profile = profiles.find(p => p.id === profileId);
        if (!profile) {
            throw new Error(`Connection Profile with ID "${profileId}" not found. Please select a valid profile in Character Creator settings.`);
        }

        // Build system message
        const systemMessage = 'You are a helpful assistant that creates character data for roleplaying scenarios.';

        // Get chat context depth from settings
        const chatDepth = creatorSettings.chatContextDepth || 4;

        // Build messages array with chat history
        const messages = buildCharacterCreationMessages(systemMessage, prompt, chatDepth);

        // Get max tokens (use override from options, then settings, then profile default)
        const maxTokens = options.maxTokens || creatorSettings.maxTokens || 2048;

        // Note: Temperature override is not currently supported by ConnectionManagerRequestService.sendRequest()
        // Temperature is controlled by the Connection Profile's preset settings
        if (options.temperature !== undefined) {
            console.warn('[Character Creator] Temperature override requested but not supported with Connection Profiles. Temperature is controlled by the profile\'s preset settings.');
        }

        console.log('[Character Creator] Using Connection Profile:', {
            profileId: profileId,
            profileName: profile.name,
            maxTokens: maxTokens,
            chatDepth: chatDepth,
            totalMessages: messages.length,
            stopSequences: options.stopSequences?.length || 0,
            temperatureOverrideRequested: options.temperature !== undefined ? options.temperature : 'none'
        });

        // Call the Connection Manager
        const response = await context.ConnectionManagerRequestService.sendRequest(
            profileId,
            messages,
            maxTokens
        );

        // Extract content from response
        let content;
        if (typeof response === 'string') {
            content = response;
        } else if (response && response.content) {
            content = response.content;
        } else {
            throw new Error('Invalid response format from Connection Manager');
        }

        return content;

    } catch (error) {
        console.error('[Character Creator] Generation failed:', error);
        throw error;
    }
}

/**
 * Legacy LLM calling method (fallback when Connection Profiles are not available)
 * Uses the user's active preset settings for max tokens if not overridden
 * @param {string} prompt - The prompt to send
 * @param {Object} options - Optional generation parameters
 * @param {number} options.maxTokens - Max tokens for generation (defaults to preset settings)
 * @param {Array<string>} options.stopSequences - Stop sequences
 * @returns {Promise<string>} The LLM response
 */
export async function callLLMForCreationLegacy(prompt, options = {}) {
    const isExternalMode = extensionSettings.generationMode === 'external';
    const useSeparatePreset = extensionSettings.useSeparatePreset;

    // Get max tokens from preset if not provided
    const maxTokens = options.maxTokens || getPresetMaxTokens();

    console.log('[Character Creator] Generation settings (legacy mode):', {
        mode: isExternalMode ? 'external' : 'internal',
        maxTokens: maxTokens,
        stopSequences: options.stopSequences?.length || 0
    });

    try {
        let response;

        if (isExternalMode) {
            // Use external API with max tokens from preset
            const messages = [
                { role: 'system', content: 'You are a helpful assistant that creates character data for roleplaying scenarios.' },
                { role: 'user', content: prompt }
            ];
            response = await generateWithExternalAPI(messages, {
                maxTokens: maxTokens,
                stop: options.stopSequences
            });
        } else {
            // Use SillyTavern's internal generation with max tokens from preset
            response = await generateRaw({
                prompt: prompt,
                use_mancer: useSeparatePreset,
                quietToLoud: false,
                responseLength: maxTokens,
                stop_sequence: options.stopSequences
            });
        }

        return response;
    } catch (error) {
        console.error('[Character Creator] Generation failed:', error);
        throw error;
    }
}



/**
 * Template Management Functions
 * Templates are saved in extensionSettings.characterCreatorTemplates
 */

/**
 * Gets all saved templates
 * @returns {Array} Array of template objects
 */
export function getTemplates() {
    if (!extensionSettings.characterCreatorTemplates) {
        extensionSettings.characterCreatorTemplates = [];
    }
    return extensionSettings.characterCreatorTemplates;
}

/**
 * Saves a new template
 * @param {Object} template - Template object with name and fields
 * @returns {boolean} Success status
 */
export function saveTemplate(template) {
    try {
        if (!template.name || !template.fields) {
            console.error('[Character Creator] Invalid template:', template);
            return false;
        }

        if (!extensionSettings.characterCreatorTemplates) {
            extensionSettings.characterCreatorTemplates = [];
        }

        // Check if template with same name exists
        const existingIndex = extensionSettings.characterCreatorTemplates.findIndex(t => t.name === template.name);

        if (existingIndex >= 0) {
            // Update existing template
            extensionSettings.characterCreatorTemplates[existingIndex] = template;
        } else {
            // Add new template
            extensionSettings.characterCreatorTemplates.push(template);
        }

        saveSettings();
        console.log('[Character Creator] Template saved:', template.name);
        return true;
    } catch (error) {
        console.error('[Character Creator] Failed to save template:', error);
        return false;
    }
}

/**
 * Deletes a template
 * @param {string} templateName - Name of template to delete
 * @returns {boolean} Success status
 */
export function deleteTemplate(templateName) {
    try {
        if (!extensionSettings.characterCreatorTemplates) {
            return false;
        }

        const index = extensionSettings.characterCreatorTemplates.findIndex(t => t.name === templateName);

        if (index >= 0) {
            extensionSettings.characterCreatorTemplates.splice(index, 1);
            saveSettings();
            console.log('[Character Creator] Template deleted:', templateName);
            return true;
        }

        return false;
    } catch (error) {
        console.error('[Character Creator] Failed to delete template:', error);
        return false;
    }
}

/**
 * Work-in-Progress Auto-Save Functions
 * Uses localStorage for temporary storage
 */

const WIP_STORAGE_KEY = 'rpg_companion_character_creator_wip';

/**
 * Saves work-in-progress data to localStorage
 * @param {Object} data - WIP data to save
 */
export function saveWIP(data) {
    try {
        localStorage.setItem(WIP_STORAGE_KEY, JSON.stringify(data));
        console.log('[Character Creator] WIP saved to localStorage');
    } catch (error) {
        console.error('[Character Creator] Failed to save WIP:', error);
    }
}

/**
 * Loads work-in-progress data from localStorage
 * @returns {Object|null} WIP data or null if not found
 */
export function loadWIP() {
    try {
        const data = localStorage.getItem(WIP_STORAGE_KEY);
        if (data) {
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('[Character Creator] Failed to load WIP:', error);
    }
    return null;
}

/**
 * Clears work-in-progress data from localStorage
 */
export function clearWIP() {
    try {
        localStorage.removeItem(WIP_STORAGE_KEY);
        console.log('[Character Creator] WIP cleared from localStorage');
    } catch (error) {
        console.error('[Character Creator] Failed to clear WIP:', error);
    }
}

/**
 * Export Functions
 * Exports character data as text or JSON
 */

/**
 * Exports character data as formatted text
 * @param {Object} characterData - Character data to export
 * @returns {string} Formatted text
 */
export function exportAsText(characterData) {
    let text = '';

    Object.entries(characterData).forEach(([key, value]) => {
        if (value && value.trim()) {
            text += `${key}:\n${value}\n\n`;
        }
    });

    return text;
}

/**
 * Exports character data as JSON
 * @param {Object} characterData - Character data to export
 * @returns {string} JSON string
 */
export function exportAsJSON(characterData) {
    return JSON.stringify(characterData, null, 2);
}

/**
 * Downloads character data as a file
 * @param {Object} characterData - Character data to export
 * @param {string} format - 'text' or 'json'
 * @param {string} filename - Optional filename (defaults to character name or 'character')
 */
export function downloadCharacter(characterData, format = 'text', filename = null) {
    const name = filename || characterData.name || 'character';
    const extension = format === 'json' ? 'json' : 'txt';
    const content = format === 'json' ? exportAsJSON(characterData) : exportAsText(characterData);

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('[Character Creator] Character downloaded:', a.download);
}