/**
 * Character Regeneration Module
 * Handles AI-powered regeneration of character data in the editor
 *
 * FUTURE ENHANCEMENT: Character Library Integration
 * This module includes hooks for future integration with SillyTavern's character library.
 * The getCharacterLibraryData() function can be implemented to:
 * - Search the user's character library for matching characters
 * - Extract relevant data (description, personality, example dialogues, etc.)
 * - Inject this data into regeneration prompts for better context
 *
 * This will allow users to reference existing character cards when regenerating
 * Present Characters data, ensuring consistency with established character definitions.
 */

import { getContext } from '../../../../../../extensions.js';
import { chat, characters, this_chid, generateRaw } from '../../../../../../../script.js';
import { selected_group, getGroupMembers, groups } from '../../../../../../group-chats.js';
import { extensionSettings, committedTrackerData } from '../../core/state.js';
import { generateWithExternalAPI } from '../generation/apiClient.js';

/**
 * FUTURE HOOK: Character Library Integration
 * This function will be expanded to allow injecting data from character cards in the user's library
 * For now, it returns null. Future implementation should:
 * - Allow user to select a character from their library
 * - Extract relevant data (description, personality, example dialogues, etc.)
 * - Format it for injection into regeneration prompts
 *
 * @param {string} characterName - Name of the character to look up in library
 * @returns {Promise<string|null>} Formatted character library data, or null if not found/not implemented
 */
async function getCharacterLibraryData(characterName) {
    // TODO: Implement character library lookup
    // This could search through SillyTavern's character list and extract data
    // Example implementation:
    // const libraryChar = characters.find(c => c.name.toLowerCase() === characterName.toLowerCase());
    // if (libraryChar) {
    //     return formatLibraryCharacterData(libraryChar);
    // }
    return null;
}

/**
 * Gets character card information for context
 * @returns {Promise<string>} Formatted character information
 */
async function getCharacterCardsInfo() {
    let characterInfo = '';

    // Check if in group chat
    if (selected_group) {
        const group = groups.find(g => g.id === selected_group);
        const groupMembers = getGroupMembers(selected_group);

        if (groupMembers && groupMembers.length > 0) {
            characterInfo += 'Characters in this roleplay:\n\n';
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
        characterInfo += 'Character in this roleplay:\n\n';
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
 * Determines if a field should have short output (one sentence or keywords)
 * @param {string} fieldName - Name of the field
 * @returns {boolean} True if field should be short
 */
function isShortField(fieldName) {
    const shortFieldPatterns = [
        'relationship', 'status', 'mood', 'location', 'occupation',
        'class', 'race', 'species', 'age', 'gender', 'alignment',
        'faction', 'title', 'rank', 'role', 'trait', 'goal'
    ];

    const lowerFieldName = fieldName.toLowerCase();
    return shortFieldPatterns.some(pattern => lowerFieldName.includes(pattern));
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
 * Builds the prompt for regenerating a full character
 * @param {string} characterName - Name of the character to regenerate
 * @param {Object} currentData - Current character data
 * @param {string} guidance - Optional user guidance for regeneration
 * @param {Array} enabledFields - Array of enabled custom fields
 * @param {Array} enabledStats - Array of enabled character stats
 * @returns {Promise<string>} The prompt text
 */
export async function buildCharacterRegenerationPrompt(characterName, currentData, guidance, enabledFields, enabledStats) {
    const userName = getContext().name1;
    const characterInfo = await getCharacterCardsInfo();
    const chatContext = getChatContext(extensionSettings.updateDepth || 4);
    const trackerContext = getTrackerContext();

    // FUTURE HOOK: Get character library data if available
    const libraryData = await getCharacterLibraryData(characterName);

    let prompt = '';

    // Add character card context
    if (characterInfo) {
        prompt += `${characterInfo}\n`;
    }

    // FUTURE HOOK: Add character library data if available
    if (libraryData) {
        prompt += `Reference character data from library:\n${libraryData}\n\n`;
    }

    // Add scene context
    if (trackerContext) {
        prompt += `${trackerContext}`;
    }

    // Add chat context
    if (chatContext) {
        prompt += `${chatContext}`;
    }

    // Add current character data for reference
    prompt += `Current data for ${characterName}:\n`;
    prompt += `Emoji: ${currentData.emoji || '😊'}\n`;
    prompt += `Relationship: ${currentData.relationship || 'Neutral'}\n`;
    enabledFields.forEach(field => {
        const value = currentData[field.name] || 'Not set';
        prompt += `${field.name}: ${value}\n`;
    });

    if (enabledStats && enabledStats.length > 0) {
        prompt += `\nCharacter Stats:\n`;
        enabledStats.forEach(stat => {
            const value = currentData.stats?.[stat.name] || 50;
            prompt += `${stat.name}: ${value}\n`;
        });
    }

    prompt += `\n`;

    // Add user guidance if provided
    if (guidance && guidance.trim()) {
        prompt += `User's guidance for regeneration: ${guidance.trim()}\n\n`;
    }

    // Add instructions for regeneration
    prompt += `Task: Generate updated data for the character "${characterName}" based on the current scene, conversation context, and character information provided above.\n\n`;

    if (guidance && guidance.trim()) {
        prompt += `Follow the user's guidance while keeping the character consistent with the roleplay context.\n\n`;
    }

    prompt += `Provide the updated character data in the following format:\n\n`;
    prompt += `Emoji: [single emoji that represents the character]\n`;
    prompt += `Relationship: [choose one: Enemy, Neutral, Friend, Lover]\n`;

    enabledFields.forEach(field => {
        const description = field.description || field.name;
        prompt += `${field.name}: [${description}]\n`;
    });

    if (enabledStats && enabledStats.length > 0) {
        prompt += `\nStats (0-100 scale):\n`;
        enabledStats.forEach(stat => {
            const description = stat.description || stat.name;
            prompt += `${stat.name}: [${description}, value 0-100]\n`;
        });
    }

    // Add thoughts field
    const thoughtsConfig = extensionSettings.trackerConfig?.presentCharacters?.thoughts;
    if (thoughtsConfig?.enabled) {
        const thoughtsLabel = thoughtsConfig.name || 'Thoughts';
        const thoughtsDescription = thoughtsConfig.description || 'Internal monologue (in first person POV, up to three sentences long)';
        prompt += `\n${thoughtsLabel}: [${thoughtsDescription}]\n`;
    }

    prompt += `\nProvide only the character data in the exact format shown above. Do not include any additional commentary or explanation.`;

    return prompt;
}

/**
 * Builds the prompt for regenerating a single field
 * @param {string} characterName - Name of the character
 * @param {string} fieldName - Name of the field to regenerate
 * @param {Object} currentData - Current character data
 * @param {string} guidance - Optional user guidance
 * @param {Object} fieldConfig - Field configuration
 * @returns {Promise<string>} The prompt text
 */
export async function buildFieldRegenerationPrompt(characterName, fieldName, currentData, guidance, fieldConfig) {
    const userName = getContext().name1;
    const characterInfo = await getCharacterCardsInfo();
    const chatContext = getChatContext(extensionSettings.updateDepth || 4);
    const trackerContext = getTrackerContext();

    // FUTURE HOOK: Get character library data if available
    const libraryData = await getCharacterLibraryData(characterName);

    let prompt = '';

    // Add character card context
    if (characterInfo) {
        prompt += `${characterInfo}\n`;
    }

    // FUTURE HOOK: Add character library data if available
    if (libraryData) {
        prompt += `Reference character data from library:\n${libraryData}\n\n`;
    }

    // Add scene context
    if (trackerContext) {
        prompt += `${trackerContext}`;
    }

    // Add chat context
    if (chatContext) {
        prompt += `${chatContext}`;
    }

    // Add current character context
    prompt += `Character: ${characterName}\n`;
    prompt += `Current ${fieldName}: ${currentData[fieldName] || 'Not set'}\n\n`;

    // Add user guidance if provided
    if (guidance && guidance.trim()) {
        prompt += `User's guidance: ${guidance.trim()}\n\n`;
    }

    // Add instructions
    let fieldDescription = fieldConfig?.description || fieldName;

    // Special handling for thoughts field - use the configured description
    if (fieldName.toLowerCase() === 'thoughts') {
        const thoughtsConfig = extensionSettings.trackerConfig?.presentCharacters?.thoughts;
        fieldDescription = thoughtsConfig?.description || 'Internal monologue (in first person POV, up to three sentences long)';
    }

    prompt += `Task: Generate an updated value for the "${fieldName}" field for ${characterName}.\n`;
    prompt += `Field description: ${fieldDescription}\n\n`;

    if (guidance && guidance.trim()) {
        prompt += `Follow the user's guidance while keeping it consistent with the roleplay context.\n\n`;
    }

    prompt += `Provide only the new value for ${fieldName}, without any additional commentary or formatting.`;

    return prompt;
}

/**
 * Calls the LLM to generate character data
 * @param {string} prompt - The prompt to send
 * @param {Object} options - Optional generation parameters
 * @param {number} options.maxTokens - Max tokens for generation
 * @param {Array<string>} options.stopSequences - Stop sequences
 * @returns {Promise<string>} The LLM response
 */
export async function callLLMForGeneration(prompt, options = {}) {
    const isExternalMode = extensionSettings.generationMode === 'external';
    const useSeparatePreset = extensionSettings.useSeparatePreset;

    try {
        let response;

        if (isExternalMode) {
            // Use external API with optional max tokens and stop sequences
            const messages = [
                { role: 'system', content: 'You are a helpful assistant that generates character data for roleplaying scenarios.' },
                { role: 'user', content: prompt }
            ];
            response = await generateWithExternalAPI(messages, {
                maxTokens: options.maxTokens,
                stop: options.stopSequences
            });
        } else {
            // Use SillyTavern's internal generation with optional parameters
            response = await generateRaw({
                prompt: prompt,
                use_mancer: useSeparatePreset,
                quietToLoud: false,
                max_length: options.maxTokens,
                stop_sequence: options.stopSequences
            });
        }

        return response;
    } catch (error) {
        console.error('[RPG Companion] Character regeneration failed:', error);
        throw error;
    }
}

/**
 * Parses the LLM response for full character regeneration
 * @param {string} response - The LLM response text
 * @param {Array} enabledFields - Array of enabled custom fields
 * @param {Array} enabledStats - Array of enabled character stats
 * @returns {Object} Parsed character data
 */
export function parseCharacterRegenerationResponse(response, enabledFields, enabledStats) {
    const result = {
        emoji: '😊',
        relationship: 'Neutral',
        stats: {}
    };

    // Extract emoji
    const emojiMatch = response.match(/Emoji:\s*(.+)/i);
    if (emojiMatch) {
        result.emoji = emojiMatch[1].trim();
    }

    // Extract relationship
    const relationshipMatch = response.match(/Relationship:\s*(.+)/i);
    if (relationshipMatch) {
        result.relationship = relationshipMatch[1].trim();
    }

    // Extract custom fields
    enabledFields.forEach(field => {
        const regex = new RegExp(`${field.name}:\\s*(.+)`, 'i');
        const match = response.match(regex);
        if (match) {
            result[field.name] = match[1].trim();
        }
    });

    // Extract stats
    if (enabledStats && enabledStats.length > 0) {
        enabledStats.forEach(stat => {
            const regex = new RegExp(`${stat.name}:\\s*(\\d+)`, 'i');
            const match = response.match(regex);
            if (match) {
                result.stats[stat.name] = parseInt(match[1], 10);
            }
        });
    }

    // Extract thoughts
    const thoughtsLabel = extensionSettings.trackerConfig?.presentCharacters?.thoughts?.name || 'Thoughts';
    const thoughtsRegex = new RegExp(`${thoughtsLabel}:\\s*(.+?)(?=\\n[A-Z][a-z]+:|$)`, 'is');
    const thoughtsMatch = response.match(thoughtsRegex);
    if (thoughtsMatch) {
        result.thoughts = thoughtsMatch[1].trim();
    }

    return result;
}

/**
 * Parses the LLM response for single field regeneration
 * @param {string} response - The LLM response text
 * @returns {string} The extracted field value
 */
export function parseFieldRegenerationResponse(response) {
    // Clean up the response - remove any markdown, quotes, or extra formatting
    let cleaned = response.trim();

    // Remove markdown code blocks if present
    cleaned = cleaned.replace(/```[\s\S]*?```/g, '');

    // Remove quotes if the entire response is quoted
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
        (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
        cleaned = cleaned.slice(1, -1);
    }

    // If response contains a colon (like "Appearance: tall and strong"), extract the part after the colon
    if (cleaned.includes(':')) {
        const parts = cleaned.split(':');
        if (parts.length >= 2) {
            cleaned = parts.slice(1).join(':').trim();
        }
    }

    return cleaned.trim();
}

