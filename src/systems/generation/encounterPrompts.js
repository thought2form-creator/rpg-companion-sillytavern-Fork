/**
 * Encounter Prompt Builder Module
 * Handles all AI prompt generation for combat encounters
 */

import { getContext } from '../../../../../../extensions.js';
import { chat, characters, this_chid, substituteParams } from '../../../../../../../script.js';
import { selected_group, getGroupMembers, groups } from '../../../../../../group-chats.js';
import { extensionSettings, committedTrackerData } from '../../core/state.js';
import { currentEncounter } from '../features/encounterState.js';
import { buildInventorySummary, generateTrackerInstructions, generateTrackerExample } from './promptBuilder.js';
import { DEFAULT_PROMPTS } from '../ui/promptsEditor.js';
import { getActiveProfile, DEFAULT_COMBAT_PROFILE } from '../features/encounterProfiles.js';
import { getFilteredWorldInfo } from './worldInfoFilter.js';

/**
 * Injects encounter profile variables into a prompt template
 * @param {string} template - The prompt template with {VARIABLE} placeholders
 * @param {Object} profile - The encounter profile (optional, defaults to active profile)
 * @returns {string} The prompt with variables replaced
 */
function injectProfileVariables(template, profile = null) {
    try {
        // Get profile (use provided or active profile)
        const activeProfile = profile || getActiveProfile();

        // Replace all placeholder variables
        return template
            .replace(/{ENCOUNTER_TYPE}/g, activeProfile.ENCOUNTER_TYPE)
            .replace(/{ENCOUNTER_GOAL}/g, activeProfile.ENCOUNTER_GOAL)
            .replace(/{ENCOUNTER_STAKES}/g, activeProfile.ENCOUNTER_STAKES)
            .replace(/{RESOURCE_INTERPRETATION}/g, activeProfile.RESOURCE_INTERPRETATION)
            .replace(/{ACTION_INTERPRETATION}/g, activeProfile.ACTION_INTERPRETATION)
            .replace(/{STATUS_INTERPRETATION}/g, activeProfile.STATUS_INTERPRETATION)
            .replace(/{SUMMARY_FRAMING}/g, activeProfile.SUMMARY_FRAMING);
    } catch (error) {
        console.error('[RPG Companion] Error injecting profile variables:', error);
        // Fallback to default combat profile
        return template
            .replace(/{ENCOUNTER_TYPE}/g, DEFAULT_COMBAT_PROFILE.ENCOUNTER_TYPE)
            .replace(/{ENCOUNTER_GOAL}/g, DEFAULT_COMBAT_PROFILE.ENCOUNTER_GOAL)
            .replace(/{ENCOUNTER_STAKES}/g, DEFAULT_COMBAT_PROFILE.ENCOUNTER_STAKES)
            .replace(/{RESOURCE_INTERPRETATION}/g, DEFAULT_COMBAT_PROFILE.RESOURCE_INTERPRETATION)
            .replace(/{ACTION_INTERPRETATION}/g, DEFAULT_COMBAT_PROFILE.ACTION_INTERPRETATION)
            .replace(/{STATUS_INTERPRETATION}/g, DEFAULT_COMBAT_PROFILE.STATUS_INTERPRETATION)
            .replace(/{SUMMARY_FRAMING}/g, DEFAULT_COMBAT_PROFILE.SUMMARY_FRAMING);
    }
}

/**
 * Gets character information from the current chat
 * @returns {Promise<string>} Formatted character information
 */
async function getCharactersInfo() {
    let characterInfo = '';

    // Check if in group chat
    if (selected_group) {
        const group = groups.find(g => g.id === selected_group);
        const groupMembers = getGroupMembers(selected_group);

        if (groupMembers && groupMembers.length > 0) {
            characterInfo += 'Characters in this roleplay:\n';

            const disabledMembers = group?.disabled_members || [];
            let characterIndex = 0;

            groupMembers.forEach((member) => {
                if (!member || !member.name) return;

                // Skip muted characters
                if (member.avatar && disabledMembers.includes(member.avatar)) {
                    return;
                }

                characterIndex++;
                characterInfo += `<character${characterIndex}="${member.name}">\n`;

                if (member.description) {
                    characterInfo += `${member.description}\n`;
                }

                if (member.personality) {
                    characterInfo += `${member.personality}\n`;
                }

                characterInfo += `</character${characterIndex}>\n`;
            });
        }
    } else if (this_chid !== undefined && characters && characters[this_chid]) {
        // Single character chat
        const character = characters[this_chid];

        characterInfo += 'Character in this roleplay:\n\n';
        characterInfo += `<character="${character.name}">\n`;

        if (character.description) {
            characterInfo += `${character.description}\n`;
        }

        if (character.personality) {
            characterInfo += `${character.personality}\n`;
        }

        characterInfo += `</character>\n\n`;
    }

    return characterInfo;
}

/**
 * Builds the initial encounter setup prompt
 * This asks the model to generate all combat stats and setup data
 * @returns {Promise<string>} Complete prompt string for Text Completion API
 */
export async function buildEncounterInitPrompt() {
    const context = getContext();
    const userName = context.name1;
    const depth = extensionSettings.encounterSettings?.historyDepth || 8;

    let prompt = '';

    // System message - use custom prompt or default, then inject profile variables
    const systemPromptTemplate = extensionSettings.customEncounterInitSystemPrompt || DEFAULT_PROMPTS.encounterInitSystem;
    const systemPrompt = injectProfileVariables(systemPromptTemplate);
    prompt += systemPrompt.replace(/{userName}/g, userName) + '\n\n';

    // Add setting information
    prompt += `Here is some information for you about the setting:\n`;
    prompt += `<setting>\n`;

    // Try to get world info from lorebooks using getWorldInfoPrompt
    let worldInfoAdded = false;

    try {
        // Debug logging
        console.log('[RPG Companion] Checking world info:', {
            hasWindowGetWorldInfoPrompt: typeof window.getWorldInfoPrompt === 'function',
            hasContextGetWorldInfoPrompt: typeof context.getWorldInfoPrompt === 'function',
            chatLength: chat?.length,
            contextChatLength: context.chat?.length,
            hasActivatedWorldInfo: !!context.activatedWorldInfo,
            activatedWorldInfoLength: context.activatedWorldInfo?.length
        });

        // Check if lorebook filtering is enabled
        if (extensionSettings.encounterWorldInfo?.enabled &&
            extensionSettings.encounterWorldInfo.selectedLorebooks?.length > 0) {

            // Use filtered world info (loads only selected lorebooks/entries)
            console.log('[RPG Companion] Loading filtered world info...');
            const worldInfoString = await getFilteredWorldInfo(
                extensionSettings.encounterWorldInfo.selectedLorebooks,
                extensionSettings.encounterWorldInfo.selectedEntryUids
            );

            if (worldInfoString && worldInfoString.trim()) {
                console.log('[RPG Companion] 📋 Filtered World Info Content Being Added:');
                console.log('---START WORLD INFO---');
                console.log(worldInfoString.trim());
                console.log('---END WORLD INFO---');
                prompt += worldInfoString.trim();
                worldInfoAdded = true;
                console.log('[RPG Companion] ✅ Added filtered world info');
            }
        } else {
            // Use SillyTavern's default world info activation
            const getWorldInfoFn = context.getWorldInfoPrompt || window.getWorldInfoPrompt;
            const currentChat = context.chat || chat;

            if (typeof getWorldInfoFn === 'function' && currentChat && currentChat.length > 0) {
                const chatForWI = currentChat.map(x => x.mes || x.message || x).filter(m => m && typeof m === 'string');

                console.log('[RPG Companion] Calling getWorldInfoPrompt with', chatForWI.length, 'messages');

                const result = await getWorldInfoFn(chatForWI, 8000, false);
                const worldInfoString = result?.worldInfoString || result;

                console.log('[RPG Companion] World info result:', { worldInfoString, length: worldInfoString?.length, type: typeof worldInfoString });

                if (worldInfoString && typeof worldInfoString === 'string' && worldInfoString.trim()) {
                    console.log('[RPG Companion] 📋 World Info Content Being Added:');
                    console.log('---START WORLD INFO---');
                    console.log(worldInfoString.trim());
                    console.log('---END WORLD INFO---');
                    prompt += worldInfoString.trim();
                    worldInfoAdded = true;
                    console.log('[RPG Companion] ✅ Added world info from getWorldInfoPrompt');
                }
            } else {
                console.log('[RPG Companion] getWorldInfoPrompt not available or no chat');
            }
        }
    } catch (e) {
        console.warn('[RPG Companion] Failed to get world info from getWorldInfoPrompt:', e);
    }

    // Fallback to activatedWorldInfo
    if (!worldInfoAdded && context.activatedWorldInfo && Array.isArray(context.activatedWorldInfo) && context.activatedWorldInfo.length > 0) {
        console.log('[RPG Companion] Using fallback activatedWorldInfo:', context.activatedWorldInfo.length, 'entries');
        console.log('[RPG Companion] 📋 Activated World Info Entries:');
        context.activatedWorldInfo.forEach((entry, index) => {
            if (entry && entry.content) {
                console.log(`Entry ${index + 1}:`, entry.comment || entry.key || 'Unnamed', '|', entry.content.substring(0, 100) + '...');
                prompt += `${entry.content}\n\n`;
                worldInfoAdded = true;
            }
        });
    }

    if (!worldInfoAdded) {
        console.warn('[RPG Companion] ⚠️ No world information available');
        prompt += 'No world information available.';
    }

    prompt += `\n</setting>\n\n`;

    // Add character information
    const charactersInfo = await getCharactersInfo();
    if (charactersInfo) {
        prompt += `Here is the information available to you about the characters participating in the fight:\n`;
        prompt += `<characters>\n${charactersInfo}</characters>\n\n`;
    }

    // Add persona information
    prompt += `Here are details about the user's ${userName}:\n`;
    prompt += `<persona>\n`;

    try {
        const personaText = substituteParams('{{persona}}');
        if (personaText && personaText !== '{{persona}}') {
            prompt += personaText;
        } else {
            prompt += 'No persona information available.';
        }
    } catch (e) {
        prompt += 'No persona information available.';
    }

    prompt += `\n</persona>\n\n`;

    // Add chat history from before the encounter
    prompt += `Here is the chat history from before the encounter started between the user and the assistant:\n`;
    prompt += `<history>\n`;

    // Add recent chat history (last X messages before encounter)
    // Format as simple text for Text Completion API
    if (chat && chat.length > 0) {
        const recentMessages = chat.slice(-depth - 1, -1); // Exclude the last message (encounter trigger)

        for (const message of recentMessages) {
            const content = message.mes?.trim();
            // Skip empty messages
            if (content) {
                const speaker = message.is_user ? userName : (message.name || 'Assistant');
                prompt += `${speaker}: ${content}\n\n`;
            }
        }

        // Add the encounter trigger message (MOST IMPORTANT - goes last)
        const lastMessage = chat[chat.length - 1];
        if (lastMessage && lastMessage.mes?.trim()) {
            currentEncounter.encounterStartMessage = lastMessage.mes;
            const speaker = lastMessage.is_user ? userName : (lastMessage.name || 'Assistant');
            prompt += `${speaker}: ${lastMessage.mes.trim()}\n\n`;
        }
    }

    prompt += `</history>\n\n`;

    // Build user's current stats (IMPORTANT CONTEXT - near the end)
    prompt += `Here is some additional tracked context for the scene:\n`;
    prompt += `<context>\n`;

    // Add HP and other stats from committed tracker data
    if (committedTrackerData.userStats) {
        prompt += `${userName}'s Current Stats:\n${committedTrackerData.userStats}\n\n`;
    }

    // Add skills if available
    const skillsSection = extensionSettings.trackerConfig?.userStats?.skillsSection;
    if (skillsSection?.enabled && skillsSection.customFields && skillsSection.customFields.length > 0) {
        prompt += `${userName}'s Skills: ${skillsSection.customFields.join(', ')}\n`;
    }

    // Add inventory
    const inventory = extensionSettings.userStats?.inventory;
    if (inventory) {
        const inventorySummary = buildInventorySummary(inventory);
        prompt += `${userName}'s Inventory:\n${inventorySummary}\n\n`;
    }

    // Add classic stats/attributes
    if (extensionSettings.classicStats) {
        const stats = extensionSettings.classicStats;
        prompt += `${userName}'s Attributes: `;
        prompt += `STR ${stats.str}, DEX ${stats.dex}, CON ${stats.con}, INT ${stats.int}, WIS ${stats.wis}, CHA ${stats.cha}, LVL ${extensionSettings.level}\n\n`;
    }

    // Add present characters info for party members
    if (committedTrackerData.characterThoughts) {
        prompt += `Present Characters (potential party members):\n${committedTrackerData.characterThoughts}\n\n`;
    }

    prompt += `</context>\n\n`;

    prompt += `The encounter starts now.\n\n`;

    // Use custom instructions or default, then inject profile variables (MOST IMPORTANT - at the very end)
    const instructionsTemplate = extensionSettings.customEncounterInitInstructionsPrompt || DEFAULT_PROMPTS.encounterInitInstructions;
    const instructionsPrompt = injectProfileVariables(instructionsTemplate);
    prompt += instructionsPrompt.replace(/{userName}/g, userName);

    // Validate that we have content
    if (!prompt.trim()) {
        throw new Error('Unable to build encounter prompt - no valid content available');
    }

    return prompt;
}

/**
 * Builds a combat action prompt
 * This is sent when the user takes an action in combat
 * @param {string} action - The action taken by the user
 * @param {object} combatStats - Current combat statistics
 * @returns {Promise<string>} Complete prompt string for Text Completion API
 */
export async function buildCombatActionPrompt(action, combatStats) {
    const context = getContext();
    const userName = context.name1;
    const depth = extensionSettings.encounterSettings?.historyDepth || 8;

    // Get narrative style from settings
    const narrativeStyle = extensionSettings.encounterSettings?.combatNarrative || {};
    const tense = narrativeStyle.tense || 'present';
    const person = narrativeStyle.person || 'third';
    const narration = narrativeStyle.narration || 'omniscient';
    const pov = narrativeStyle.pov || 'narrator';

    let prompt = '';

    // Build system message with setting info - use custom prompt or default, then inject profile variables
    const systemPromptTemplate = extensionSettings.customCombatActionSystemPrompt || DEFAULT_PROMPTS.combatActionSystem;
    const systemPrompt = injectProfileVariables(systemPromptTemplate);
    prompt += systemPrompt.replace(/{userName}/g, userName) + '\n\n';

    // Add setting information
    prompt += `Here is some information for you about the setting:\n`;
    prompt += `<setting>\n`;

    // Get world info
    let worldInfoAdded = false;
    try {
        // Check if lorebook filtering is enabled
        if (extensionSettings.encounterWorldInfo?.enabled &&
            extensionSettings.encounterWorldInfo.selectedLorebooks?.length > 0) {

            // Use filtered world info
            const worldInfoString = await getFilteredWorldInfo(
                extensionSettings.encounterWorldInfo.selectedLorebooks,
                extensionSettings.encounterWorldInfo.selectedEntryUids
            );

            if (worldInfoString && worldInfoString.trim()) {
                prompt += worldInfoString.trim();
                worldInfoAdded = true;
            }
        } else {
            // Use SillyTavern's default world info activation
            const getWorldInfoFn = context.getWorldInfoPrompt || window.getWorldInfoPrompt;
            const currentChat = context.chat || chat;

            if (typeof getWorldInfoFn === 'function' && currentChat && currentChat.length > 0) {
                const chatForWI = currentChat.map(x => x.mes || x.message || x).filter(m => m && typeof m === 'string');
                const result = await getWorldInfoFn(chatForWI, 8000, false);
                const worldInfoString = result?.worldInfoString || result;

                if (worldInfoString && typeof worldInfoString === 'string' && worldInfoString.trim()) {
                    prompt += worldInfoString.trim();
                    worldInfoAdded = true;
                }
            }
        }
    } catch (e) {
        console.warn('[RPG Companion] Failed to get world info for combat action:', e);
    }

    if (!worldInfoAdded && context.activatedWorldInfo && Array.isArray(context.activatedWorldInfo) && context.activatedWorldInfo.length > 0) {
        context.activatedWorldInfo.forEach((entry) => {
            if (entry && entry.content) {
                prompt += `${entry.content}\n\n`;
                worldInfoAdded = true;
            }
        });
    }

    if (!worldInfoAdded) {
        prompt += 'No world information available.';
    }

    prompt += `\n</setting>\n\n`;

    // Add character information
    const charactersInfo = await getCharactersInfo();
    if (charactersInfo) {
        prompt += `Here is the information available to you about the characters:\n`;
        prompt += `<characters>\n${charactersInfo}</characters>\n\n`;
    }

    // Add persona info
    if (context.name1) {
        prompt += `The protagonist is:\n`;
        prompt += `<persona>\n`;

        // Use substituteParams to get {{persona}} like in initial encounter
        try {
            const personaText = substituteParams('{{persona}}');
            if (personaText && personaText !== '{{persona}}') {
                prompt += personaText;
            } else {
                prompt += `Name: ${context.name1}\n`;
                if (extensionSettings.userStats?.personaDescription) {
                    prompt += `${extensionSettings.userStats.personaDescription}\n`;
                }
            }
        } catch (e) {
            prompt += `Name: ${context.name1}\n`;
            if (extensionSettings.userStats?.personaDescription) {
                prompt += `${extensionSettings.userStats.personaDescription}\n`;
            }
        }

        // Add ONLY classic stats/attributes if enabled
        if (extensionSettings.classicStats) {
            const stats = extensionSettings.classicStats;
            prompt += `\nAttributes: STR ${stats.str}, DEX ${stats.dex}, CON ${stats.con}, INT ${stats.int}, WIS ${stats.wis}, CHA ${stats.cha}, LVL ${extensionSettings.level}\n`;
        }

        prompt += `</persona>\n\n`;
    }

    // Add recent chat history for context (formatted as text)
    prompt += `<history>\n`;
    const currentChat = context.chat || chat;
    if (currentChat && currentChat.length > 0) {
        const recentMessages = currentChat.slice(-depth);

        for (const message of recentMessages) {
            const content = message.mes?.trim();
            // Skip empty messages
            if (content) {
                const speaker = message.is_user ? userName : (message.name || 'Assistant');
                prompt += `${speaker}: ${content}\n\n`;
            }
        }
    }
    prompt += `</history>\n\n`;

    // Add combat log as plain text (previous actions)
    if (currentEncounter.encounterLog && currentEncounter.encounterLog.length > 0) {
        prompt += 'Previous Combat Actions:\n';
        currentEncounter.encounterLog.forEach(entry => {
            prompt += `- ${entry.action}\n`;
            if (entry.result) {
                prompt += `  ${entry.result}\n`;
            }
        });
        prompt += '\n';
    }

    // Add current combat state with FULL information (MOST IMPORTANT - at the end)
    prompt += `Current Combat State:\n`;
    prompt += `Environment: ${combatStats.environment || 'Unknown location'}\n\n`;

    prompt += `Party Members:\n`;
    combatStats.party.forEach(member => {
        prompt += `- ${member.name}${member.isPlayer ? ' (Player)' : ''}: ${member.hp}/${member.maxHp} HP\n`;
        if (member.customBars && member.customBars.length > 0) {
            member.customBars.forEach(bar => {
                prompt += `  ${bar.name}: ${bar.current}/${bar.max}\n`;
            });
        }
        if (member.attacks && member.attacks.length > 0) {
            prompt += `  Attacks: ${member.attacks.map(a => typeof a === 'string' ? a : a.name).join(', ')}\n`;
        }
        if (member.items && member.items.length > 0) {
            prompt += `  Items: ${member.items.join(', ')}\n`;
        }
        if (member.statuses && member.statuses.length > 0) {
            const validStatuses = member.statuses.filter(s => s && (s.emoji || s.name));
            if (validStatuses.length > 0) {
                prompt += `  Status Effects: ${validStatuses.map(s => `${s.emoji || ''} ${s.name || ''}`.trim()).join(', ')}\n`;
            }
        }
    });

    prompt += `\nEnemies:\n`;
    combatStats.enemies.forEach(enemy => {
        prompt += `- ${enemy.name} (${enemy.sprite || ''}): ${enemy.hp}/${enemy.maxHp} HP\n`;
        if (enemy.description) {
            prompt += `  ${enemy.description}\n`;
        }
        if (enemy.customBars && enemy.customBars.length > 0) {
            enemy.customBars.forEach(bar => {
                prompt += `  ${bar.name}: ${bar.current}/${bar.max}\n`;
            });
        }
        if (enemy.attacks && enemy.attacks.length > 0) {
            prompt += `  Attacks: ${enemy.attacks.map(a => typeof a === 'string' ? a : a.name).join(', ')}\n`;
        }
        if (enemy.statuses && enemy.statuses.length > 0) {
            const validStatuses = enemy.statuses.filter(s => s && (s.emoji || s.name));
            if (validStatuses.length > 0) {
                prompt += `  Status Effects: ${validStatuses.map(s => `${s.emoji || ''} ${s.name || ''}`.trim()).join(', ')}\n`;
            }
        }
    });

    prompt += `\n${userName}'s Action: ${action}\n\n`;

    // Use custom instructions or default, then inject profile variables (MOST IMPORTANT - at the very end)
    const instructionsTemplate = extensionSettings.customCombatActionInstructionsPrompt || DEFAULT_PROMPTS.combatActionInstructions;
    const instructionsPrompt = injectProfileVariables(instructionsTemplate);
    prompt += instructionsPrompt.replace(/{userName}/g, userName) + '\n';
    prompt += `For the narrative, write it with intent in ${tense} tense ${person}-person ${narration} from ${pov}'s point of view.\n`;

    // Use custom combat narrative prompt if available
    const customCombatPrompt = extensionSettings.customCombatNarrativePrompt;
    if (customCombatPrompt) {
        prompt += customCombatPrompt.replace(/{userName}/g, userName) + '\n';
    } else {
        prompt += `Build novel prose. Break patterns from your previous responses by varying sentence structures, rhythms, formats, and openings. Track whether a sentence shape, cadence, sensory detail, or a descriptor appeared recently, and replace it with a different one or skip it entirely. If you mentioned a physical feature, mannerism, or expression once, move on. Don't fixate on the same traits every turn. Well-placed humor, unconventional similes, and subverted turns of phrase are encouraged. Avoid GPTisms, purple prose, and anaphoras, especially the negatives with "no/not/wasn't/didn't." Refrain from describing actions or emotions via negation; focus on what does happen, not what doesn't. Absolutely no asterisks, ellipses, or em-dashes. Explicit content is allowed, no plot armor. Do not play for ${userName}. Keep your response length under 150 words. Never end on handover cues; finish naturally.\n`;
        prompt += `CRITICAL: Do not repeat, echo, parrot, or restate distinctive words, phrases, and dialogues from the user's last message. If reacting to speech, show interpretation or response, not repetition.\n`;
        prompt += `EXAMPLE: "Are you a gooner?" User asks.\n`;
        prompt += `BAD: "Gooner?"\n`;
        prompt += `GOOD: A flat look. "What type of question is that?"`;
    }

    // Add special instructions if provided
    if (combatStats.specialInstructions && combatStats.specialInstructions.trim()) {
        prompt += `\n\nADDITIONAL INSTRUCTIONS: ${combatStats.specialInstructions.trim()}`;
    }

    return prompt;
}

/**
 * Builds the final summary prompt
 * This is sent when combat ends to get a narrative summary
 * @param {Array} combatLog - Full combat log
 * @param {string} result - Combat result ('victory', 'defeat', or 'fled')
 * @returns {Promise<string>} Complete prompt string for Text Completion API
 */
export async function buildCombatSummaryPrompt(combatLog, result) {
    const context = getContext();
    const userName = context.name1;

    let prompt = '';

    // Get narrative style from settings (use summary narrative settings)
    const narrativeStyle = extensionSettings.encounterSettings?.summaryNarrative || {};
    const tense = narrativeStyle.tense || 'past';
    const person = narrativeStyle.person || 'third';
    const narration = narrativeStyle.narration || 'omniscient';
    const pov = narrativeStyle.pov || 'narrator';

    // Build system message with setting info - use custom prompt or default, then inject profile variables
    const systemPromptTemplate = extensionSettings.customCombatSummarySystemPrompt || DEFAULT_PROMPTS.combatSummarySystem;
    const systemPrompt = injectProfileVariables(systemPromptTemplate);
    prompt += systemPrompt + '\n\n';

    // Add setting information
    prompt += `Here is some information for you about the setting:\n`;
    prompt += `<setting>\n`;

    // Get world info using the same method as encounter init
    let worldInfoAdded = false;
    try {
        // Check if lorebook filtering is enabled
        if (extensionSettings.encounterWorldInfo?.enabled &&
            extensionSettings.encounterWorldInfo.selectedLorebooks?.length > 0) {

            // Use filtered world info
            const worldInfoString = await getFilteredWorldInfo(
                extensionSettings.encounterWorldInfo.selectedLorebooks,
                extensionSettings.encounterWorldInfo.selectedEntryUids
            );

            if (worldInfoString && worldInfoString.trim()) {
                prompt += worldInfoString.trim();
                worldInfoAdded = true;
            }
        } else {
            // Use SillyTavern's default world info activation
            const getWorldInfoFn = context.getWorldInfoPrompt || window.getWorldInfoPrompt;
            const currentChat = context.chat || chat;

            if (typeof getWorldInfoFn === 'function' && currentChat && currentChat.length > 0) {
                const chatForWI = currentChat.map(x => x.mes || x.message || x).filter(m => m && typeof m === 'string');
                const result = await getWorldInfoFn(chatForWI, 8000, false);
                const worldInfoString = result?.worldInfoString || result;

                if (worldInfoString && typeof worldInfoString === 'string' && worldInfoString.trim()) {
                    prompt += worldInfoString.trim();
                    worldInfoAdded = true;
                }
            }
        }
    } catch (e) {
        console.warn('[RPG Companion] Failed to get world info for summary:', e);
    }

    // Fallback to activatedWorldInfo
    if (!worldInfoAdded && context.activatedWorldInfo && Array.isArray(context.activatedWorldInfo) && context.activatedWorldInfo.length > 0) {
        context.activatedWorldInfo.forEach((entry) => {
            if (entry && entry.content) {
                prompt += `${entry.content}\n\n`;
                worldInfoAdded = true;
            }
        });
    }

    if (!worldInfoAdded) {
        prompt += 'No world information available.';
    }

    prompt += `\n</setting>\n\n`;

    // Add character information
    const charactersInfo = await getCharactersInfo();
    if (charactersInfo) {
        prompt += `Here is the information available to you about the characters:\n`;
        prompt += `<characters>\n${charactersInfo}</characters>\n\n`;
    }

    // Add persona information
    prompt += `Here are details about ${userName}:\n`;
    prompt += `<persona>\n`;

    try {
        const personaText = substituteParams('{{persona}}');
        if (personaText && personaText !== '{{persona}}') {
            prompt += personaText;
        } else {
            prompt += 'No persona information available.';
        }
    } catch (e) {
        prompt += 'No persona information available.';
    }

    prompt += `\n</persona>\n\n`;

    // Add the message that triggered the encounter
    if (currentEncounter.encounterStartMessage) {
        prompt += `Here is the last message before combat started:\n`;
        prompt += `<trigger>\n${currentEncounter.encounterStartMessage}\n</trigger>\n\n`;
    }

    prompt += `Combat has ended with result: ${result}\n\n`;
    prompt += `Full Combat Log:\n`;

    combatLog.forEach((entry, index) => {
        prompt += `\nRound ${index + 1}:\n`;
        prompt += `${entry.action}\n`;
        prompt += `${entry.result}\n`;
    });

    prompt += `\n\n`;

    // Use custom instructions or default, then inject profile variables (MOST IMPORTANT - at the end)
    const instructionsTemplate = extensionSettings.customCombatSummaryInstructionsPrompt || DEFAULT_PROMPTS.combatSummaryInstructions;
    const instructionsPrompt = injectProfileVariables(instructionsTemplate);
    prompt += instructionsPrompt.replace(/{userName}/g, userName) + '\n';
    prompt += `Write with intent in ${tense} tense ${person}-person ${narration} from ${pov}'s point of view.\n\n`;

    // If in Together mode and trackers are enabled, add tracker update instructions
    if (extensionSettings.generationMode === 'together' && (extensionSettings.showUserStats || extensionSettings.showInfoBox || extensionSettings.showCharacterThoughts)) {
        prompt += `\n--- TRACKER UPDATE ---\n\n`;
        prompt += `After the [FIGHT CONCLUDED] summary, update the RPG trackers to reflect ${userName}'s state AFTER the combat encounter. `;
        prompt += `Account for any injuries sustained, resources used, emotional state changes, or other consequences of the battle.\n\n`;

        // Include pre-combat tracker state if available
        if (committedTrackerData.userStats || committedTrackerData.infoBox || committedTrackerData.characterThoughts) {
            prompt += `Pre-combat tracker state:\n`;
            prompt += `<previous>\n`;

            if (committedTrackerData.userStats) {
                prompt += `${userName}'s Stats:\n${committedTrackerData.userStats}\n\n`;
            }

            if (committedTrackerData.infoBox) {
                prompt += `Info Box:\n${committedTrackerData.infoBox}\n\n`;
            }

            if (committedTrackerData.characterThoughts) {
                prompt += `Present Characters:\n${committedTrackerData.characterThoughts}\n\n`;
            }

            prompt += `</previous>\n\n`;
        }

        // Add tracker instructions and example
        const trackerInstructions = generateTrackerInstructions(false, false, true);
        prompt += trackerInstructions;

        const trackerExample = generateTrackerExample();
        if (trackerExample) {
            prompt += `\n${trackerExample}`;
        }
    }

    return prompt;
}

/**
 * Parses JSON response from the AI, handling code blocks
 * @param {string} response - The AI response
 * @returns {object|null} Parsed JSON object or null if parsing fails
 */
export function parseEncounterJSON(response) {
    try {
        // Remove code blocks if present
        let cleaned = response.trim();

        // Remove ```json and ``` markers
        cleaned = cleaned.replace(/```json\s*/gi, '');
        cleaned = cleaned.replace(/```\s*/g, '');

        // Find the first { and last }
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1) {
            cleaned = cleaned.substring(firstBrace, lastBrace + 1);
        }

        return JSON.parse(cleaned);
    } catch (error) {
        console.error('[RPG Companion] Failed to parse encounter JSON:', error);
        console.error('[RPG Companion] Response was:', response);
        return null;
    }
}

/**
 * Parses a combat action response and returns the result
 * @param {string} response - The AI response
 * @returns {object|null} Parsed result with narrative and other data
 */
export function parseCombatActionResponse(response) {
    const result = parseEncounterJSON(response);
    if (!result) {
        return null;
    }

    return {
        narrative: result.narrative || '',
        combatStats: result.combatStats || null,
        enemyActions: result.enemyActions || [],
        partyActions: result.partyActions || [],
        combatEnd: result.combatEnd || false,
        result: result.result || null
    };
}
