/**
 * Modular Prompt System - Public API
 * 
 * A flexible, UI-driven prompt assembly system for SillyTavern extensions.
 * 
 * Key Features:
 * - Modular sections with priority-based ordering
 * - Template processing with SillyTavern macro preservation
 * - Settings persistence via extensionSettings
 * - Profile/preset support
 * - Reusable across multiple components
 * 
 * Usage Example:
 * ```javascript
 * import { createPromptBuilder } from './modular-prompt-system/index.js';
 * 
 * // Create a builder for a specific component
 * const builder = createPromptBuilder(extensionSettings, 'userStats');
 * 
 * // Build the prompt
 * const prompt = builder.build();
 * 
 * // Send for generation
 * const response = await sendTextGeneration(prompt, {
 *     profileId: builder.getProfileId(),
 *     maxTokens: builder.getMaxTokens()
 * });
 * ```
 */

import { Section, SectionCollection } from './section.js';
import { Template, processTemplate, containsMacros, extractMacros, validateTemplate } from './template.js';
import { PromptAssembler } from './assembler.js';
import { SettingsAdapter } from './settings-adapter.js';
import { sendTextGeneration } from './sender.js';
import { getContext } from '../../../../../../../extensions.js';
import { setVariables } from './variable-injector.js';
import { getChatContext, getTrackerContext } from '../contextBuilder.js';
import { committedTrackerData } from '../../../core/state.js';

/**
 * Prompt Builder
 * High-level interface for building and sending prompts
 */
export class PromptBuilder {
    /**
     * Create a new prompt builder
     * @param {Object} extensionSettings - Extension settings object
     * @param {string} componentKey - Component identifier (e.g., 'userStats')
     */
    constructor(extensionSettings, componentKey) {
        this.componentKey = componentKey;
        this.adapter = new SettingsAdapter(extensionSettings, componentKey);
        this.assembler = this.adapter.loadAssembler();
    }

    /**
     * Add a section to the prompt
     * @param {Section|Object} section - Section or section config
     */
    addSection(section) {
        if (!(section instanceof Section)) {
            section = new Section(section);
        }
        this.assembler.addSection(section);
        this.save();
    }

    /**
     * Get a section by ID
     * @param {string} id - Section ID
     * @returns {Section|undefined}
     */
    getSection(id) {
        return this.assembler.getSection(id);
    }

    /**
     * Remove a section by ID
     * @param {string} id - Section ID
     */
    removeSection(id) {
        this.assembler.removeSection(id);
        this.save();
    }

    /**
     * Update a section's content
     * @param {string} id - Section ID
     * @param {string} content - New content
     */
    updateSectionContent(id, content) {
        const section = this.assembler.getSection(id);
        if (section) {
            section.setContent(content);
            this.save();
        }
    }

    /**
     * Toggle a section's enabled state
     * @param {string} id - Section ID
     * @param {boolean} [enabled] - Enabled state (toggles if not provided)
     */
    toggleSection(id, enabled) {
        const section = this.assembler.getSection(id);
        if (section) {
            section.setEnabled(enabled);
            this.save();
        }
    }

    /**
     * Update a section's priority
     * @param {string} id - Section ID
     * @param {number} priority - New priority
     */
    updateSectionPriority(id, priority) {
        const section = this.assembler.getSection(id);
        if (section) {
            section.setPriority(priority);
            this.save();
        }
    }

    /**
     * Set template data for placeholder replacement
     * @param {Object} data - Template data
     */
    setTemplateData(data) {
        this.assembler.setTemplateData(data);
        this.save();
    }

    /**
     * Build the final prompt string
     * Updates chat context and tracker sections before building
     * @param {Object} [options] - Build options
     * @param {string} [options.guidance] - Optional user guidance to include
     * @returns {string}
     */
    build(options = {}) {
        // Update chat context section with latest messages
        this.updateChatContextSection();

        // Update tracker sections with latest tracker data
        this.updateTrackerSections();

        // Update guidance section if provided
        this.updateGuidanceSection(options.guidance);

        return this.assembler.build(options);
    }

    /**
     * Update the chat context section with current chat messages
     * This is called automatically during build() to ensure fresh context
     */
    updateChatContextSection() {
        const CHAT_CONTEXT_ID = '__system_chat_context__';
        const chatDepth = this.getChatContextDepth();

        // Get the chat context section
        let chatSection = this.getSection(CHAT_CONTEXT_ID);

        if (!chatSection) {
            // Create it if it doesn't exist
            chatSection = new Section({
                id: CHAT_CONTEXT_ID,
                content: '',
                priority: 50,
                enabled: false,
                label: '💬 Chat Context (System)',
                description: 'Automatically includes recent chat messages based on depth setting'
            });
            this.addSection(chatSection);
        }

        // Update content with fresh chat messages
        let chatContent = '';
        if (chatDepth > 0) {
            chatContent = getChatContext(chatDepth, {
                includeNames: true,
                filterEmpty: true
            }) || '';
        }

        chatSection.setContent(chatContent);
        chatSection.setEnabled(chatDepth > 0);
        chatSection.description = `Includes last ${chatDepth} messages from chat (controlled by depth setting)`;

        // Save the updated section
        this.save();
    }

    /**
     * Update the guidance section with user input
     * This is called automatically during build() to include user guidance
     * @param {string} [guidance] - Optional user guidance text
     */
    updateGuidanceSection(guidance) {
        const GUIDANCE_ID = '__system_guidance__';

        // Get the guidance section
        let guidanceSection = this.getSection(GUIDANCE_ID);

        if (!guidanceSection) {
            // Create it if it doesn't exist
            guidanceSection = new Section({
                id: GUIDANCE_ID,
                content: '',
                priority: 0, // Lowest priority - appears at the end
                enabled: false,
                label: '✨ User Guidance (System)',
                description: 'Special instructions provided by the user for this generation'
            });
            this.addSection(guidanceSection);
        }

        // Update content with guidance if provided
        let guidanceContent = '';
        if (guidance && guidance.trim()) {
            guidanceContent = `[Take the following into special consideration for your next message: ${guidance.trim()}]`;
        }

        guidanceSection.setContent(guidanceContent);
        guidanceSection.setEnabled(!!guidance && !!guidance.trim());

        // Save the updated section
        this.save();
    }

    /**
     * Update tracker context sections with current tracker data
     * This is called automatically during build() to ensure fresh context
     */
    updateTrackerSections() {
        const toggles = this.getTrackerToggles();

        const trackerConfigs = [
            {
                id: '__system_tracker_userstats__',
                type: 'userStats',
                label: '📊 User Stats (Tracker)',
                icon: '📊',
                priority: 51
            },
            {
                id: '__system_tracker_infobox__',
                type: 'infoBox',
                label: '📍 Info Box (Tracker)',
                icon: '📍',
                priority: 52
            },
            {
                id: '__system_tracker_thoughts__',
                type: 'characterThoughts',
                label: '💭 Character Thoughts (Tracker)',
                icon: '💭',
                priority: 53
            },
            {
                id: '__system_tracker_inventory__',
                type: 'inventory',
                label: '🎒 Inventory (Tracker)',
                icon: '🎒',
                priority: 54
            },
            {
                id: '__system_tracker_quests__',
                type: 'quests',
                label: '📜 Quests (Tracker)',
                icon: '📜',
                priority: 55
            }
        ];

        for (const config of trackerConfigs) {
            let section = this.getSection(config.id);
            const isEnabled = toggles[config.type];

            // Get tracker content
            const options = {
                includeUserStats: config.type === 'userStats',
                includeInfoBox: config.type === 'infoBox',
                includeInventory: config.type === 'inventory',
                includeQuests: config.type === 'quests'
            };

            // For character thoughts, we need to handle it separately
            let content = '';
            if (config.type === 'characterThoughts') {
                content = committedTrackerData.characterThoughts || '';
            } else {
                content = getTrackerContext(options);
            }

            if (!section) {
                // Create the section
                section = new Section({
                    id: config.id,
                    content: content,
                    priority: config.priority,
                    enabled: isEnabled,
                    label: config.label,
                    description: `Auto-generated from RPG Companion tracker data`
                });
                this.addSection(section);
            } else {
                // Update existing section
                section.setContent(content);
                section.setEnabled(isEnabled);
            }
        }

        // Save the updated sections
        this.save();
    }

    /**
     * Get max tokens setting
     * @returns {number}
     */
    getMaxTokens() {
        return this.adapter.getMaxTokens();
    }

    /**
     * Set max tokens setting
     * @param {number} maxTokens - Max tokens
     */
    setMaxTokens(maxTokens) {
        this.adapter.setMaxTokens(maxTokens);
    }

    /**
     * Get profile ID setting
     * @returns {string|null}
     */
    getProfileId() {
        return this.adapter.getProfileId();
    }

    /**
     * Set profile ID setting
     * @param {string|null} profileId - Profile ID
     */
    setProfileId(profileId) {
        this.adapter.setProfileId(profileId);
    }

    /**
     * Get chat context depth setting
     * @returns {number}
     */
    getChatContextDepth() {
        return this.adapter.getChatContextDepth();
    }

    /**
     * Set chat context depth setting
     * @param {number} depth - Number of messages to include (0 = disabled)
     */
    setChatContextDepth(depth) {
        this.adapter.setChatContextDepth(depth);
    }

    /**
     * Get tracker toggles
     * @returns {Object} Tracker toggle states
     */
    getTrackerToggles() {
        return this.adapter.getTrackerToggles();
    }

    /**
     * Set tracker toggle state
     * @param {string} trackerType - Type of tracker
     * @param {boolean} enabled - Whether enabled
     */
    setTrackerToggle(trackerType, enabled) {
        this.adapter.setTrackerToggle(trackerType, enabled);
    }

    /**
     * Inject variables into SillyTavern's variable system
     * These can then be accessed via {{getvar::variableName}} macros
     * @param {Object} variables - Object with variable names as keys and values
     * @returns {Promise<void>}
     */
    async injectVariables(variables) {
        await setVariables(variables);
    }

    /**
     * Save current state
     */
    save() {
        this.adapter.saveAssembler(this.assembler);
    }

    /**
     * Save current state as a named profile
     * @param {string} profileName - Profile name
     */
    saveAsProfile(profileName) {
        this.adapter.saveProfile(profileName, this.assembler);
    }

    /**
     * Load a named profile
     * @param {string} profileName - Profile name
     * @returns {boolean} True if loaded successfully
     */
    loadProfile(profileName) {
        const profile = this.adapter.loadProfile(profileName);
        if (profile) {
            this.assembler = profile.assembler;
            this.adapter.setMaxTokens(profile.maxTokens);
            this.save();
            return true;
        }
        return false;
    }

    /**
     * Get list of available profiles
     * @returns {string[]}
     */
    getProfiles() {
        return this.adapter.getProfileNames();
    }

    /**
     * Delete a named profile
     * @param {string} profileName - Profile name
     * @returns {boolean} True if deleted successfully
     */
    deleteProfile(profileName) {
        return this.adapter.deleteProfile(profileName);
    }

    /**
     * Initialize with default sections (only if not already initialized)
     * @param {Section[]|Object[]} defaultSections - Default sections
     */
    initializeDefaults(defaultSections) {
        const sections = defaultSections.map(s => 
            s instanceof Section ? s : new Section(s)
        );
        this.adapter.initializeDefaults(sections);
        this.assembler = this.adapter.loadAssembler();
    }

    /**
     * Build and send prompt for generation
     * @param {Object} [options] - Generation options
     * @param {string} [options.guidance] - Optional user guidance to include in prompt
     * @returns {Promise<string>} Generated response
     */
    async generate(options = {}) {
        // Build prompt with guidance passed to build()
        const prompt = this.build({ guidance: options.guidance });

        const context = getContext();
        const maxTokens = this.getMaxTokens();

        console.log('[PromptBuilder] Generating with settings:', {
            maxTokens: maxTokens,
            profileId: this.getProfileId(),
            promptLength: prompt.length,
            hasGuidance: !!(options.guidance && options.guidance.trim())
        });

        return await sendTextGeneration(prompt, {
            context,
            profileId: this.getProfileId(),
            maxTokens: maxTokens
        });
    }
}

/**
 * Factory function to create a prompt builder
 * @param {Object} extensionSettings - Extension settings object
 * @param {string} componentKey - Component identifier
 * @returns {PromptBuilder}
 */
export function createPromptBuilder(extensionSettings, componentKey) {
    return new PromptBuilder(extensionSettings, componentKey);
}

// Export all classes and utilities
export {
    Section,
    SectionCollection,
    Template,
    processTemplate,
    containsMacros,
    extractMacros,
    validateTemplate,
    PromptAssembler,
    SettingsAdapter,
    sendTextGeneration
};

