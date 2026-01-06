/**
 * Encounter State Module
 * Manages combat encounter state and history
 */

import { extensionSettings } from '../../core/state.js';
import { saveSettings } from '../../core/persistence.js';

/**
 * Current encounter state
 */
export let currentEncounter = {
    active: false,
    initialized: false,
    combatHistory: [], // Array of {role: 'user'|'assistant'|'system', content: string}
    combatStats: null, // Current combat stats (HP, party, enemies, etc.)
    preEncounterContext: [], // Messages from before the encounter started
    encounterStartMessage: '', // The message that triggered the encounter
    encounterLog: [], // Full log of combat actions for final summary
    displayLog: [], // Visual log entries shown in UI: {message: string, type: string}
    pendingEnemies: [], // Enemies suggested by AI but not yet approved by user
    pendingParty: [] // Party members suggested by AI but not yet approved by user
};

/**
 * Encounter logs storage (per chat)
 */
export let encounterLogs = {
    // chatId: [
    //   {
    //     timestamp: Date,
    //     log: [],
    //     summary: string,
    //     result: 'victory'|'defeat'|'fled'
    //   }
    // ]
};

/**
 * Sets the current encounter state
 * @param {object} encounter - The encounter state object
 */
export function setCurrentEncounter(encounter) {
    currentEncounter = encounter;
}

/**
 * Updates current encounter state with partial data
 * @param {object} updates - Partial encounter state to merge
 */
export function updateCurrentEncounter(updates) {
    Object.assign(currentEncounter, updates);
}

/**
 * Resets the encounter state
 */
export function resetEncounter() {
    currentEncounter = {
        active: false,
        initialized: false,
        combatHistory: [],
        combatStats: null,
        preEncounterContext: [],
        encounterStartMessage: '',
        encounterLog: [],
        displayLog: [],
        pendingEnemies: [],
        pendingParty: []
    };
}

/**
 * Adds a message to combat history
 * @param {string} role - Message role ('user', 'assistant', or 'system')
 * @param {string} content - Message content
 */
export function addCombatMessage(role, content) {
    currentEncounter.combatHistory.push({ role, content });
}

/**
 * Adds an entry to the encounter log
 * @param {string} action - The action taken
 * @param {string} result - The result of the action
 */
export function addEncounterLogEntry(action, result) {
    currentEncounter.encounterLog.push({
        timestamp: Date.now(),
        action,
        result,
        swipes: [result], // Store all alternative results
        swipeIndex: 0 // Currently selected swipe
    });
}

/**
 * Adds an entry to the display log (visual log in UI)
 * @param {string} message - The message to display
 * @param {string} type - The type of log entry (for styling)
 */
export function addDisplayLogEntry(message, type = '') {
    currentEncounter.displayLog.push({
        message,
        type,
        swipes: [message], // Store all alternative messages
        swipeIndex: 0 // Currently selected swipe
    });
}

/**
 * Adds a swipe to an encounter log entry
 * @param {number} entryIndex - Index of the log entry
 * @param {string} newResult - New result to add as a swipe
 */
export function addEncounterLogSwipe(entryIndex, newResult) {
    if (entryIndex < 0 || entryIndex >= currentEncounter.encounterLog.length) {
        console.error('[RPG Companion] Invalid encounter log entry index:', entryIndex);
        return;
    }

    const entry = currentEncounter.encounterLog[entryIndex];
    if (!entry.swipes) {
        entry.swipes = [entry.result];
    }
    entry.swipes.push(newResult);
    entry.swipeIndex = entry.swipes.length - 1;
    entry.result = newResult; // Update current result
}

/**
 * Sets the active swipe for an encounter log entry
 * @param {number} entryIndex - Index of the log entry
 * @param {number} swipeIndex - Index of the swipe to activate
 */
export function setEncounterLogSwipe(entryIndex, swipeIndex) {
    if (entryIndex < 0 || entryIndex >= currentEncounter.encounterLog.length) {
        console.error('[RPG Companion] Invalid encounter log entry index:', entryIndex);
        return;
    }

    const entry = currentEncounter.encounterLog[entryIndex];
    if (!entry.swipes || swipeIndex < 0 || swipeIndex >= entry.swipes.length) {
        console.error('[RPG Companion] Invalid swipe index:', swipeIndex);
        return;
    }

    entry.swipeIndex = swipeIndex;
    entry.result = entry.swipes[swipeIndex];
}

/**
 * Adds a swipe to a display log entry
 * @param {number} entryIndex - Index of the display log entry
 * @param {string} newMessage - New message to add as a swipe
 */
export function addDisplayLogSwipe(entryIndex, newMessage) {
    if (entryIndex < 0 || entryIndex >= currentEncounter.displayLog.length) {
        console.error('[RPG Companion] Invalid display log entry index:', entryIndex);
        return;
    }

    const entry = currentEncounter.displayLog[entryIndex];
    if (!entry.swipes) {
        entry.swipes = [entry.message];
    }
    entry.swipes.push(newMessage);
    entry.swipeIndex = entry.swipes.length - 1;
    entry.message = newMessage; // Update current message
}

/**
 * Sets the active swipe for a display log entry
 * @param {number} entryIndex - Index of the display log entry
 * @param {number} swipeIndex - Index of the swipe to activate
 */
export function setDisplayLogSwipe(entryIndex, swipeIndex) {
    if (entryIndex < 0 || entryIndex >= currentEncounter.displayLog.length) {
        console.error('[RPG Companion] Invalid display log entry index:', entryIndex);
        return;
    }

    const entry = currentEncounter.displayLog[entryIndex];
    if (!entry.swipes || swipeIndex < 0 || swipeIndex >= entry.swipes.length) {
        console.error('[RPG Companion] Invalid swipe index:', swipeIndex);
        return;
    }

    entry.swipeIndex = swipeIndex;
    entry.message = entry.swipes[swipeIndex];
}

/**
 * Saves an encounter log for a specific chat
 * @param {string} chatId - The chat identifier
 * @param {object} logData - The encounter log data
 */
export function saveEncounterLog(chatId, logData) {
    if (!encounterLogs[chatId]) {
        encounterLogs[chatId] = [];
    }
    encounterLogs[chatId].push({
        timestamp: new Date(),
        log: logData.log || [],
        summary: logData.summary || '',
        result: logData.result || 'unknown'
    });
}

/**
 * Gets encounter logs for a specific chat
 * @param {string} chatId - The chat identifier
 * @returns {Array} Array of encounter logs
 */
export function getEncounterLogs(chatId) {
    return encounterLogs[chatId] || [];
}

/**
 * Clears all encounter logs for a specific chat
 * @param {string} chatId - The chat identifier
 */
export function clearEncounterLogs(chatId) {
    if (encounterLogs[chatId]) {
        delete encounterLogs[chatId];
    }
}

/**
 * Exports encounter logs as JSON
 * @param {string} chatId - The chat identifier
 * @returns {string} JSON string of encounter logs
 */
export function exportEncounterLogs(chatId) {
    const logs = getEncounterLogs(chatId);
    return JSON.stringify(logs, null, 2);
}

/**
 * Updates a party member in the current encounter
 * @param {number} index - Index of the party member
 * @param {object} updates - Partial party member data to update
 */
export function updatePartyMember(index, updates) {
    if (!currentEncounter.combatStats || !currentEncounter.combatStats.party) {
        console.error('[RPG Companion] No active encounter to update');
        return;
    }

    if (index < 0 || index >= currentEncounter.combatStats.party.length) {
        console.error('[RPG Companion] Invalid party member index:', index);
        return;
    }

    Object.assign(currentEncounter.combatStats.party[index], updates);
}

/**
 * Updates an enemy in the current encounter
 * @param {number} index - Index of the enemy
 * @param {object} updates - Partial enemy data to update
 */
export function updateEnemy(index, updates) {
    if (!currentEncounter.combatStats || !currentEncounter.combatStats.enemies) {
        console.error('[RPG Companion] No active encounter to update');
        return;
    }

    if (index < 0 || index >= currentEncounter.combatStats.enemies.length) {
        console.error('[RPG Companion] Invalid enemy index:', index);
        return;
    }

    Object.assign(currentEncounter.combatStats.enemies[index], updates);
}

/**
 * Adds a new party member to the current encounter
 * @param {object} memberData - Party member data
 */
export function addPartyMember(memberData) {
    if (!currentEncounter.combatStats || !currentEncounter.combatStats.party) {
        console.error('[RPG Companion] No active encounter to add to');
        return;
    }

    const defaultMember = {
        name: 'New Ally',
        hp: 100,
        maxHp: 100,
        attacks: [{ name: 'Attack', type: 'single-target' }],
        items: [],
        statuses: [],
        customBars: [],
        isPlayer: false
    };

    currentEncounter.combatStats.party.push({ ...defaultMember, ...memberData });
}

/**
 * Adds a new enemy to the current encounter
 * @param {object} enemyData - Enemy data
 */
export function addEnemy(enemyData) {
    if (!currentEncounter.combatStats || !currentEncounter.combatStats.enemies) {
        console.error('[RPG Companion] No active encounter to add to');
        return;
    }

    const defaultEnemy = {
        name: 'New Enemy',
        hp: 100,
        maxHp: 100,
        attacks: [{ name: 'Attack', type: 'single-target' }],
        statuses: [],
        customBars: [],
        description: '',
        sprite: '👹'
    };

    currentEncounter.combatStats.enemies.push({ ...defaultEnemy, ...enemyData });
}

/**
 * Removes a party member from the current encounter
 * @param {number} index - Index of the party member to remove
 */
export function removePartyMember(index) {
    if (!currentEncounter.combatStats || !currentEncounter.combatStats.party) {
        console.error('[RPG Companion] No active encounter to remove from');
        return;
    }

    if (index < 0 || index >= currentEncounter.combatStats.party.length) {
        console.error('[RPG Companion] Invalid party member index:', index);
        return;
    }

    // Don't allow removing the player
    if (currentEncounter.combatStats.party[index].isPlayer) {
        console.warn('[RPG Companion] Cannot remove the player from the party');
        return;
    }

    currentEncounter.combatStats.party.splice(index, 1);
}

/**
 * Removes an enemy from the current encounter
 * @param {number} index - Index of the enemy to remove
 */
export function removeEnemy(index) {
    if (!currentEncounter.combatStats || !currentEncounter.combatStats.enemies) {
        console.error('[RPG Companion] No active encounter to remove from');
        return;
    }

    if (index < 0 || index >= currentEncounter.combatStats.enemies.length) {
        console.error('[RPG Companion] Invalid enemy index:', index);
        return;
    }

    currentEncounter.combatStats.enemies.splice(index, 1);
}

/**
 * Saves the current encounter state to extension settings (autosave)
 */
export function saveEncounterState() {
    if (!extensionSettings.encounterSettings) {
        extensionSettings.encounterSettings = {};
    }

    // Save the entire encounter state
    extensionSettings.encounterSettings.savedEncounter = {
        active: currentEncounter.active,
        initialized: currentEncounter.initialized,
        combatHistory: currentEncounter.combatHistory,
        combatStats: currentEncounter.combatStats,
        preEncounterContext: currentEncounter.preEncounterContext,
        encounterStartMessage: currentEncounter.encounterStartMessage,
        encounterLog: currentEncounter.encounterLog,
        displayLog: currentEncounter.displayLog,
        timestamp: Date.now()
    };

    saveSettings();
    console.log('[RPG Companion] Encounter state saved');
}

/**
 * Loads a saved encounter state from extension settings
 * @returns {boolean} True if a saved encounter was loaded, false otherwise
 */
export function loadEncounterState() {
    if (!extensionSettings.encounterSettings || !extensionSettings.encounterSettings.savedEncounter) {
        console.log('[RPG Companion] No saved encounter found');
        return false;
    }

    const saved = extensionSettings.encounterSettings.savedEncounter;

    // Restore the encounter state
    currentEncounter.active = saved.active;
    currentEncounter.initialized = saved.initialized;
    currentEncounter.combatHistory = saved.combatHistory || [];
    currentEncounter.combatStats = saved.combatStats;
    currentEncounter.preEncounterContext = saved.preEncounterContext || [];
    currentEncounter.encounterStartMessage = saved.encounterStartMessage || '';
    currentEncounter.encounterLog = saved.encounterLog || [];
    currentEncounter.displayLog = saved.displayLog || [];
    currentEncounter.pendingEnemies = saved.pendingEnemies || [];
    currentEncounter.pendingParty = saved.pendingParty || [];

    console.log('[RPG Companion] Encounter state loaded from', new Date(saved.timestamp));
    return true;
}

/**
 * Clears the saved encounter state from extension settings
 */
export function clearSavedEncounterState() {
    if (extensionSettings.encounterSettings && extensionSettings.encounterSettings.savedEncounter) {
        delete extensionSettings.encounterSettings.savedEncounter;
        saveSettings();
        console.log('[RPG Companion] Saved encounter state cleared');
    }
}

/**
 * Checks if there is a saved encounter available
 * @returns {boolean} True if a saved encounter exists
 */
export function hasSavedEncounter() {
    return !!(extensionSettings.encounterSettings && extensionSettings.encounterSettings.savedEncounter);
}
