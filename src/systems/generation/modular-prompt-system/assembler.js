/**
 * Assembler - Core prompt assembly engine
 * 
 * Takes sections and assembles them into a final prompt string.
 * Handles ordering, filtering, template processing, and formatting.
 */

import { SectionCollection } from './section.js';
import { processTemplate } from './template.js';

/**
 * Prompt Assembler
 * Assembles multiple sections into a final prompt string
 */
export class PromptAssembler {
    /**
     * Create a new prompt assembler
     * @param {Object} [options={}] - Assembler options
     * @param {string} [options.separator='\n\n'] - Separator between sections
     * @param {Object} [options.templateData={}] - Data for template processing
     */
    constructor(options = {}) {
        this.sections = new SectionCollection();
        this.separator = options.separator !== undefined ? options.separator : '\n\n';
        this.templateData = options.templateData || {};
    }

    /**
     * Add a section to the assembler
     * @param {Section} section - Section to add
     */
    addSection(section) {
        this.sections.add(section);
    }

    /**
     * Get a section by ID
     * @param {string} id - Section ID
     * @returns {Section|undefined}
     */
    getSection(id) {
        return this.sections.get(id);
    }

    /**
     * Remove a section by ID
     * @param {string} id - Section ID
     */
    removeSection(id) {
        this.sections.remove(id);
    }

    /**
     * Update template data
     * @param {Object} data - New template data (merged with existing)
     */
    setTemplateData(data) {
        this.templateData = { ...this.templateData, ...data };
    }

    /**
     * Set the separator between sections
     * @param {string} separator - New separator
     */
    setSeparator(separator) {
        this.separator = separator;
    }

    /**
     * Build the final prompt string
     * @param {Object} [options={}] - Build options
     * @param {Object} [options.templateData] - Override template data for this build
     * @param {string} [options.separator] - Override separator for this build
     * @param {boolean} [options.trim=true] - Trim whitespace from final prompt
     * @returns {string} Assembled prompt
     */
    build(options = {}) {
        const templateData = options.templateData || this.templateData;
        const separator = options.separator !== undefined ? options.separator : this.separator;
        const trim = options.trim !== undefined ? options.trim : true;

        // Get enabled sections sorted by priority
        const enabledSections = this.sections.getSorted(true);

        // Process each section's content through template engine
        const processedSections = enabledSections.map(section => {
            const content = section.getContent();
            return processTemplate(content, templateData);
        });

        // Filter out empty sections
        const nonEmptySections = processedSections.filter(content => content.trim().length > 0);

        // Join with separator
        let prompt = nonEmptySections.join(separator);

        // Trim if requested
        if (trim) {
            prompt = prompt.trim();
        }

        return prompt;
    }

    /**
     * Get a preview of the assembled prompt with metadata
     * @returns {Object} Preview data
     */
    preview() {
        const enabledSections = this.sections.getSorted(true);
        const allSections = this.sections.getSorted(false);

        return {
            totalSections: allSections.length,
            enabledSections: enabledSections.length,
            disabledSections: allSections.length - enabledSections.length,
            sections: enabledSections.map(section => ({
                id: section.id,
                label: section.label,
                priority: section.priority,
                contentLength: section.content.length,
                contentPreview: section.content.substring(0, 100) + (section.content.length > 100 ? '...' : '')
            })),
            estimatedLength: this.build().length
        };
    }

    /**
     * Serialize assembler state
     * @returns {Object}
     */
    toJSON() {
        return {
            sections: this.sections.toJSON(),
            separator: this.separator,
            templateData: this.templateData
        };
    }

    /**
     * Load assembler state from serialized data
     * @param {Object} data - Serialized assembler data
     */
    fromJSON(data) {
        if (data.sections) {
            this.sections.fromJSON(data.sections);
        }
        if (data.separator !== undefined) {
            this.separator = data.separator;
        }
        if (data.templateData) {
            this.templateData = data.templateData;
        }
    }

    /**
     * Create a new assembler from serialized data
     * @param {Object} data - Serialized assembler data
     * @returns {PromptAssembler}
     */
    static fromJSON(data) {
        const assembler = new PromptAssembler();
        assembler.fromJSON(data);
        return assembler;
    }
}

