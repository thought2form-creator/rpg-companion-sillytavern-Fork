/**
 * Settings Adapter - Integration with extensionSettings
 *
 * Handles loading and saving prompt configurations to/from extensionSettings.
 * Provides auto-save functionality and default initialization.
 */

import { PromptAssembler } from './assembler.js';
import { Section } from './section.js';

/**
 * Settings Adapter
 * Manages prompt configuration persistence via extensionSettings
 */
export class SettingsAdapter {
    /**
     * Create a new settings adapter
     * @param {Object} extensionSettings - Reference to the extension's settings object
     * @param {string} componentKey - Key for this component's settings (e.g., 'userStats', 'infoBox')
     */
    constructor(extensionSettings, componentKey) {
        this.extensionSettings = extensionSettings;
        this.componentKey = componentKey;
        
        // Initialize component settings if not exists
        if (!this.extensionSettings.promptConfigs) {
            this.extensionSettings.promptConfigs = {};
        }
        
        if (!this.extensionSettings.promptConfigs[componentKey]) {
            this.extensionSettings.promptConfigs[componentKey] = {
                assembler: null,
                maxTokens: 2048,
                profileId: null,
                chatContextDepth: 10,
                trackerToggles: {
                    userStats: true,
                    infoBox: true,
                    characterThoughts: true,
                    inventory: false,
                    quests: false
                },
                profiles: {}
            };
        }

        // Ensure trackerToggles exists (for backwards compatibility)
        if (!this.extensionSettings.promptConfigs[componentKey].trackerToggles) {
            this.extensionSettings.promptConfigs[componentKey].trackerToggles = {
                userStats: true,
                infoBox: true,
                characterThoughts: true,
                inventory: false,
                quests: false
            };
        }
    }

    /**
     * Get the component's settings object
     * @returns {Object}
     */
    getComponentSettings() {
        return this.extensionSettings.promptConfigs[this.componentKey];
    }

    /**
     * Load assembler from settings
     * @returns {PromptAssembler}
     */
    loadAssembler() {
        const settings = this.getComponentSettings();
        
        if (settings.assembler) {
            return PromptAssembler.fromJSON(settings.assembler);
        }
        
        // Return empty assembler if no saved state
        return new PromptAssembler();
    }

    /**
     * Save assembler to settings
     * @param {PromptAssembler} assembler - Assembler to save
     */
    saveAssembler(assembler) {
        const settings = this.getComponentSettings();
        settings.assembler = assembler.toJSON();
        
        // Trigger settings save (extension should handle this)
        this.triggerSave();
    }

    /**
     * Get max tokens setting
     * @returns {number}
     */
    getMaxTokens() {
        return this.getComponentSettings().maxTokens || 2048;
    }

    /**
     * Set max tokens setting
     * @param {number} maxTokens - Max tokens value
     */
    setMaxTokens(maxTokens) {
        this.getComponentSettings().maxTokens = maxTokens;
        this.triggerSave();
    }

    /**
     * Get profile ID setting
     * @returns {string|null}
     */
    getProfileId() {
        return this.getComponentSettings().profileId;
    }

    /**
     * Set profile ID setting
     * @param {string|null} profileId - Profile ID
     */
    setProfileId(profileId) {
        this.getComponentSettings().profileId = profileId;
        this.triggerSave();
    }

    /**
     * Get chat context depth setting
     * @returns {number}
     */
    getChatContextDepth() {
        return this.getComponentSettings().chatContextDepth || 10;
    }

    /**
     * Set chat context depth setting
     * @param {number} depth - Number of messages to include (0 = disabled)
     */
    setChatContextDepth(depth) {
        this.getComponentSettings().chatContextDepth = depth;
        this.triggerSave();
    }

    /**
     * Get tracker toggles
     * @returns {Object} Tracker toggle states
     */
    getTrackerToggles() {
        return this.getComponentSettings().trackerToggles || {
            userStats: true,
            infoBox: true,
            characterThoughts: true,
            inventory: false,
            quests: false
        };
    }

    /**
     * Set tracker toggle state
     * @param {string} trackerType - Type of tracker (userStats, infoBox, etc.)
     * @param {boolean} enabled - Whether the tracker is enabled
     */
    setTrackerToggle(trackerType, enabled) {
        const toggles = this.getTrackerToggles();
        toggles[trackerType] = enabled;
        this.getComponentSettings().trackerToggles = toggles;
        this.triggerSave();
    }

    /**
     * Save current state as a named profile
     * @param {string} profileName - Name for the profile
     * @param {PromptAssembler} assembler - Assembler to save
     */
    saveProfile(profileName, assembler) {
        const settings = this.getComponentSettings();
        
        if (!settings.profiles) {
            settings.profiles = {};
        }
        
        settings.profiles[profileName] = {
            assembler: assembler.toJSON(),
            maxTokens: settings.maxTokens,
            createdAt: new Date().toISOString()
        };
        
        this.triggerSave();
    }

    /**
     * Load a named profile
     * @param {string} profileName - Name of profile to load
     * @returns {{assembler: PromptAssembler, maxTokens: number}|null}
     */
    loadProfile(profileName) {
        const settings = this.getComponentSettings();
        const profile = settings.profiles?.[profileName];
        
        if (!profile) {
            return null;
        }
        
        return {
            assembler: PromptAssembler.fromJSON(profile.assembler),
            maxTokens: profile.maxTokens
        };
    }

    /**
     * Get list of available profile names
     * @returns {string[]}
     */
    getProfileNames() {
        const settings = this.getComponentSettings();
        return Object.keys(settings.profiles || {});
    }

    /**
     * Delete a named profile
     * @param {string} profileName - Name of profile to delete
     * @returns {boolean} True if deleted, false if not found
     */
    deleteProfile(profileName) {
        const settings = this.getComponentSettings();
        
        if (settings.profiles?.[profileName]) {
            delete settings.profiles[profileName];
            this.triggerSave();
            return true;
        }
        
        return false;
    }

    /**
     * Trigger settings save
     * Calls the extension's saveSettings function to persist to disk
     */
    async triggerSave() {
        // Lazy import to avoid circular dependency issues during module initialization
        const { saveSettings } = await import('../../../core/persistence.js');

        // Save to SillyTavern's extension settings
        saveSettings();
        console.log(`[SettingsAdapter] Settings saved for component: ${this.componentKey}`);
    }

    /**
     * Initialize with default sections if no configuration exists
     * @param {Section[]} defaultSections - Default sections to initialize with
     */
    initializeDefaults(defaultSections) {
        const settings = this.getComponentSettings();
        
        // Only initialize if no assembler exists
        if (!settings.assembler) {
            const assembler = new PromptAssembler();
            
            defaultSections.forEach(section => {
                assembler.addSection(section);
            });
            
            this.saveAssembler(assembler);
            console.log(`[SettingsAdapter] Initialized defaults for component: ${this.componentKey}`);
        }
    }
}

