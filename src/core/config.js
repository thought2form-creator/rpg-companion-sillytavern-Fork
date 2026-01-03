/**
 * Core Configuration Module
 * Extension metadata and configuration constants
 */

// Type imports
/** @typedef {import('../types/inventory.js').InventoryV2} InventoryV2 */

export const extensionName = 'third-party/rpg-companion-sillytavern';

/**
 * Dynamically determine extension path based on current location
 * This supports both global (public/extensions) and user-specific (data/default-user/extensions) installations
 */
const currentScriptPath = import.meta.url;
const isUserExtension = currentScriptPath.includes('/data/') || currentScriptPath.includes('\\data\\');
export const extensionFolderPath = isUserExtension
    ? `data/default-user/extensions/${extensionName}`
    : `scripts/extensions/${extensionName}`;

/**
 * Default extension settings
 */
export const defaultSettings = {
    enabled: true,
    autoUpdate: true,
    updateDepth: 4, // How many messages to include in the context
    generationMode: 'together', // 'together', 'separate', or 'external' - how to generate tracker data
    useSeparatePreset: false, // Use 'RPG Companion Trackers' preset for tracker generation instead of main API model
    showUserStats: true,
    showInfoBox: true,
    showCharacterThoughts: true,
    showInventory: true, // Show inventory section (v2 system)
    showQuests: true, // Show quests section
    showThoughtsInChat: true, // Show thoughts overlay in chat
    alwaysShowThoughtBubble: false, // Auto-expand thought bubble without clicking icon
    enableHtmlPrompt: false, // Enable immersive HTML prompt injection
    enableSpotifyMusic: false, // Enable Spotify music integration (asks AI for Spotify URLs)
    customSpotifyPrompt: '', // Custom Spotify prompt text (empty = use default)
    // Controls when the extension skips injecting tracker instructions/examples/HTML
    // into generations that appear to be user-injected instructions. Valid values:
    //  - 'none'          -> never skip (legacy behavior: always inject)
    //  - 'guided'        -> skip for any guided / instruct or quiet_prompt generation
    //  - 'impersonation' -> skip only for impersonation-style guided generations
    // This setting helps compatibility with other extensions like GuidedGenerations.
    skipInjectionsForGuided: 'none',
    enablePlotButtons: true, // Show plot progression buttons above chat input
    saveTrackerHistory: false, // Save tracker data in chat history for each message
    panelPosition: 'right', // 'left', 'right', or 'top'
    // Per-section custom prompts for regeneration
    customUserStatsPrompt: '', // Custom prompt for User Stats section (empty = use default)
    customInfoBoxPrompt: '', // Custom prompt for Info Box section (empty = use default)
    customCharacterThoughtsPrompt: '', // Custom prompt for Character Thoughts section (empty = use default)
    // Per-section regeneration settings (max tokens and stop sequences)
    sectionRegenerationSettings: {
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
    },
    // Character field regeneration settings
    characterFieldRegenerationSettings: {
        contextDepth: 4, // How many messages to include for field regeneration context
        maxTokens: 100, // Max tokens for field regeneration (short outputs)
        stopSequences: ['\n\n', '\n', '.', '!', '?', '"', "'", '###', 'Here is', 'I hope', 'The ', 'As ', 'Suddenly'], // Stop sequences for short field outputs
        thoughtsMaxTokens: 150, // Max tokens specifically for thoughts field (slightly longer)
        thoughtsStopSequences: ['\n\n', '###', 'Here is', 'I hope', 'The character', 'As the'] // Stop sequences for thoughts
    },
    theme: 'default', // Theme: default, sci-fi, fantasy, cyberpunk, custom
    customColors: {
        bg: '#1a1a2e',
        accent: '#16213e',
        text: '#eaeaea',
        highlight: '#e94560'
    },
    statBarColorLow: '#cc3333', // Color for low stat values (red)
    statBarColorHigh: '#33cc66', // Color for high stat values (green)
    enableAnimations: true, // Enable smooth animations for stats and content updates
    mobileFabPosition: {
        top: 'calc(var(--topBarBlockSize) + 60px)',
        right: '12px'
    }, // Saved position for mobile FAB button
    userStats: {
        health: 100,
        satiety: 100,
        energy: 100,
        hygiene: 100,
        arousal: 0,
        mood: '😐',
        conditions: 'None',
        /** @type {InventoryV3} */
        inventory: {
            version: 3,
            onPerson: {},
            stored: {},
            assets: "None"
        }
    },
    classicStats: {
        str: 10,
        dex: 10,
        con: 10,
        int: 10,
        wis: 10,
        cha: 10
    },
    lastDiceRoll: null, // Store last dice roll result
    collapsedInventoryLocations: [], // Array of collapsed storage location names
    debugMode: false, // Enable debug logging visible in UI (for mobile debugging)
    memoryMessagesToProcess: 16, // Number of messages to process per batch in memory recollection
    // Character Creator settings
    characterCreator: {
        profileId: '', // Connection Profile ID for character generation
        maxTokens: 2048, // Max tokens for character generation (can override profile setting)
        chatContextDepth: 4, // How many chat messages to include in context
        includeWorldInfo: true, // Include world info in generation context
        includeExistingChars: true, // Include existing characters in generation context
        includeTrackers: true, // Include tracker data in generation context
        defaultTemplate: 'default' // Default template to use
    }
};
