/**
 * Section - Represents a single prompt section
 * 
 * A section is a discrete piece of the prompt with:
 * - Content (template string with {{macros}})
 * - Priority (for ordering)
 * - Enabled state (can be toggled on/off)
 * - Metadata (id, label, description)
 */

/**
 * Prompt Section
 * Represents a single configurable section of a prompt
 */
export class Section {
    /**
     * Create a new prompt section
     * @param {Object} config - Section configuration
     * @param {string} config.id - Unique identifier for this section
     * @param {string} config.content - Template content (may contain {{macros}})
     * @param {number} [config.priority=50] - Priority for ordering (higher = earlier in prompt)
     * @param {boolean} [config.enabled=true] - Whether this section is active
     * @param {string} [config.label] - Human-readable label for UI
     * @param {string} [config.description] - Description for UI tooltip
     */
    constructor(config) {
        this.id = config.id;
        this.content = config.content || '';
        this.priority = config.priority !== undefined ? config.priority : 50;
        this.enabled = config.enabled !== undefined ? config.enabled : true;
        this.label = config.label || config.id;
        this.description = config.description || '';
    }

    /**
     * Get the content if enabled, empty string if disabled
     * @returns {string}
     */
    getContent() {
        return this.enabled ? this.content : '';
    }

    /**
     * Update section content
     * @param {string} content - New content
     */
    setContent(content) {
        this.content = content;
    }

    /**
     * Toggle enabled state
     * @param {boolean} [enabled] - If provided, set to this value. Otherwise toggle.
     */
    setEnabled(enabled) {
        this.enabled = enabled !== undefined ? enabled : !this.enabled;
    }

    /**
     * Update priority
     * @param {number} priority - New priority value
     */
    setPriority(priority) {
        this.priority = priority;
    }

    /**
     * Serialize to plain object for storage
     * @returns {Object}
     */
    toJSON() {
        return {
            id: this.id,
            content: this.content,
            priority: this.priority,
            enabled: this.enabled,
            label: this.label,
            description: this.description
        };
    }

    /**
     * Create section from plain object
     * @param {Object} data - Serialized section data
     * @returns {Section}
     */
    static fromJSON(data) {
        return new Section(data);
    }

    /**
     * Clone this section
     * @returns {Section}
     */
    clone() {
        return new Section(this.toJSON());
    }
}

/**
 * Section Collection
 * Manages multiple sections with ordering and filtering
 */
export class SectionCollection {
    constructor() {
        this.sections = new Map();
    }

    /**
     * Add a section to the collection
     * @param {Section} section - Section to add
     */
    add(section) {
        this.sections.set(section.id, section);
    }

    /**
     * Get a section by ID
     * @param {string} id - Section ID
     * @returns {Section|undefined}
     */
    get(id) {
        return this.sections.get(id);
    }

    /**
     * Remove a section by ID
     * @param {string} id - Section ID
     * @returns {boolean} - True if removed, false if not found
     */
    remove(id) {
        return this.sections.delete(id);
    }

    /**
     * Get all sections sorted by priority (highest first)
     * @param {boolean} [enabledOnly=false] - Only return enabled sections
     * @returns {Section[]}
     */
    getSorted(enabledOnly = false) {
        let sections = Array.from(this.sections.values());
        
        if (enabledOnly) {
            sections = sections.filter(s => s.enabled);
        }
        
        // Sort by priority (higher priority first)
        sections.sort((a, b) => b.priority - a.priority);
        
        return sections;
    }

    /**
     * Serialize all sections
     * @returns {Object}
     */
    toJSON() {
        const data = {};
        for (const [id, section] of this.sections) {
            data[id] = section.toJSON();
        }
        return data;
    }

    /**
     * Load sections from serialized data
     * @param {Object} data - Serialized sections
     */
    fromJSON(data) {
        this.sections.clear();
        for (const [id, sectionData] of Object.entries(data)) {
            this.sections.set(id, Section.fromJSON(sectionData));
        }
    }
}

