/**
 * Variable Injector Module
 * Handles injecting data into SillyTavern's variable system for use in prompts
 * 
 * This allows us to set variables programmatically that can then be accessed
 * via {{getvar::variableName}} macros in prompts.
 */

import { executeSlashCommandsOnChatInput } from '../../../../../../../../scripts/slash-commands.js';

/**
 * Set a variable in SillyTavern's variable system
 * @param {string} name - Variable name
 * @param {string|number} value - Variable value
 * @returns {Promise<void>}
 */
export async function setVariable(name, value) {
    try {
        // Use /setvar command to set the variable
        // quiet=true prevents chat output
        await executeSlashCommandsOnChatInput(
            `/setvar key=${name} ${String(value)}`,
            { clearChatInput: false }
        );
        console.log(`[Variable Injector] Set variable: ${name} = ${value}`);
    } catch (error) {
        console.error(`[Variable Injector] Failed to set variable ${name}:`, error);
    }
}

/**
 * Set multiple variables at once
 * @param {Object} variables - Object with variable names as keys and values
 * @returns {Promise<void>}
 */
export async function setVariables(variables) {
    const promises = Object.entries(variables).map(([name, value]) => 
        setVariable(name, value)
    );
    await Promise.all(promises);
}

/**
 * Extract character data from tracker data for a specific character
 * @param {string} characterName - Name of the character
 * @param {string} characterThoughtsData - The characterThoughts tracker data
 * @returns {Object} Extracted character data
 */
export function extractCharacterData(characterName, characterThoughtsData) {
    if (!characterThoughtsData) {
        return {
            currentThought: '',
            currentMood: '',
            currentRelationship: ''
        };
    }

    const lines = characterThoughtsData.split('\n');
    let inCharacter = false;
    let currentThought = '';
    let currentMood = '';
    let currentRelationship = '';

    for (const line of lines) {
        // Check if this is the start of our character's block
        if (line.startsWith('- ') && line.toLowerCase().includes(characterName.toLowerCase())) {
            inCharacter = true;
            continue;
        }

        // If we're in another character's block, stop
        if (inCharacter && line.startsWith('- ')) {
            break;
        }

        if (inCharacter) {
            // Parse Details line (contains emoji/mood)
            if (line.startsWith('Details:')) {
                const parts = line.substring('Details:'.length).split('|').map(p => p.trim());
                if (parts.length > 0) {
                    currentMood = parts[0]; // First part is emoji/mood
                }
                if (parts.length > 1) {
                    currentThought = parts[1]; // Second part is thought
                }
            }

            // Parse Relationship line
            if (line.startsWith('Relationship:')) {
                currentRelationship = line.substring('Relationship:'.length).trim();
            }
        }
    }

    return {
        currentThought: currentThought || 'No previous thought',
        currentMood: currentMood || '😊',
        currentRelationship: currentRelationship || 'Neutral'
    };
}

/**
 * Inject character-specific variables for thought regeneration
 * @param {string} characterName - Name of the character
 * @param {string} characterThoughtsData - The characterThoughts tracker data
 * @returns {Promise<void>}
 */
export async function injectCharacterVariables(characterName, characterThoughtsData) {
    const data = extractCharacterData(characterName, characterThoughtsData);
    
    await setVariables({
        'characterName': characterName,
        'currentThought': data.currentThought,
        'currentMood': data.currentMood,
        'currentRelationship': data.currentRelationship
    });
    
    console.log('[Variable Injector] Injected character variables:', {
        characterName,
        ...data
    });
}

