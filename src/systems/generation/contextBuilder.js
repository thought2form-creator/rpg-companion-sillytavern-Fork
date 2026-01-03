/**
 * Context Builder Module
 * Shared utilities for building controlled context for LLM generation
 * Used by character regeneration, character creator, and other features
 * 
 * This module provides CONTROLLED context building - we explicitly choose
 * what to include to avoid the context pollution issues we had before.
 */

import { getContext } from '../../../../../../extensions.js';
import { chat, characters, this_chid } from '../../../../../../../script.js';
import { selected_group, getGroupMembers, groups } from '../../../../../../group-chats.js';
import { extensionSettings, committedTrackerData } from '../../core/state.js';

/**
 * Gets character card information for context
 * @param {Object} options - Options for character info
 * @param {boolean} options.includeDescription - Include character description
 * @param {boolean} options.includePersonality - Include character personality
 * @param {boolean} options.includeScenario - Include character scenario
 * @returns {Promise<string>} Formatted character information
 */
export async function getCharacterCardsInfo(options = {}) {
    const {
        includeDescription = true,
        includePersonality = true,
        includeScenario = false
    } = options;

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
                if (includeDescription && member.description) characterInfo += `${member.description}\n`;
                if (includePersonality && member.personality) characterInfo += `${member.personality}\n`;
                if (includeScenario && member.scenario) characterInfo += `Scenario: ${member.scenario}\n`;
                characterInfo += `</character${characterIndex}>\n\n`;
            });
        }
    } else if (this_chid !== undefined && characters && characters[this_chid]) {
        const character = characters[this_chid];
        characterInfo += 'Character in this roleplay:\n\n';
        characterInfo += `<character="${character.name}">\n`;
        if (includeDescription && character.description) characterInfo += `${character.description}\n`;
        if (includePersonality && character.personality) characterInfo += `${character.personality}\n`;
        if (includeScenario && character.scenario) characterInfo += `Scenario: ${character.scenario}\n`;
        characterInfo += `</character>\n\n`;
    }

    return characterInfo;
}

/**
 * Gets recent chat context (last N messages)
 * @param {number} depth - Number of messages to include (default: 4)
 * @param {Object} options - Options for chat context
 * @param {boolean} options.includeNames - Include message sender names
 * @param {boolean} options.filterEmpty - Filter out empty messages
 * @returns {string} Formatted chat context
 */
export function getChatContext(depth = 4, options = {}) {
    const {
        includeNames = true,
        filterEmpty = true
    } = options;

    console.log('[Context Builder] getChatContext called with depth:', depth);
    console.log('[Context Builder] chat exists:', !!chat, 'length:', chat?.length);

    if (!chat || chat.length === 0) {
        console.log('[Context Builder] No chat available, returning empty string');
        return '';
    }

    const recentMessages = chat.slice(-depth);
    console.log('[Context Builder] Retrieved', recentMessages.length, 'messages');
    let context = 'Recent conversation:\n\n';

    recentMessages.forEach(msg => {
        const message = msg.mes || '';

        // Skip empty messages if filtering is enabled
        if (filterEmpty && !message.trim()) return;

        if (includeNames) {
            const name = msg.name || (msg.is_user ? getContext().name1 : 'Character');
            context += `${name}: ${message}\n\n`;
        } else {
            context += `${message}\n\n`;
        }
    });

    console.log('[Context Builder] Final context length:', context.length);
    return context;
}

/**
 * Gets current scene context from trackers
 * @param {Object} options - Options for tracker context
 * @param {boolean} options.includeInfoBox - Include info box data
 * @param {boolean} options.includeUserStats - Include user stats
 * @param {boolean} options.includeInventory - Include inventory
 * @param {boolean} options.includeQuests - Include quests
 * @returns {string} Formatted tracker context
 */
export function getTrackerContext(options = {}) {
    const {
        includeInfoBox = true,
        includeUserStats = true,
        includeInventory = false,
        includeQuests = false
    } = options;

    let context = '';

    if (includeInfoBox && committedTrackerData.infoBox) {
        context += `Current Environment:\n${committedTrackerData.infoBox}\n\n`;
    }

    if (includeUserStats && committedTrackerData.userStats) {
        context += `User Stats:\n${committedTrackerData.userStats}\n\n`;
    }

    if (includeInventory && committedTrackerData.inventory) {
        context += `Inventory:\n${committedTrackerData.inventory}\n\n`;
    }

    if (includeQuests && committedTrackerData.quests) {
        context += `Quests:\n${committedTrackerData.quests}\n\n`;
    }

    return context;
}

