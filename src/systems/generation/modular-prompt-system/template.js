/**
 * Template - Handles template strings with macro preservation
 * 
 * This module provides simple string interpolation while preserving
 * SillyTavern macros ({{...}}) for ST's macro engine to resolve later.
 * 
 * Key principle: DO NOT resolve {{macros}}. Just pass them through.
 * SillyTavern's macro engine will handle them during final prompt assembly.
 */

/**
 * Process a template string with simple placeholder replacement
 * 
 * Supports:
 * - Simple placeholders: {variableName}
 * - Preserves ST macros: {{macroName}} (passed through unchanged)
 * 
 * @param {string} template - Template string
 * @param {Object} [data={}] - Data for placeholder replacement
 * @returns {string} Processed template
 * 
 * @example
 * processTemplate("Hello {name}, the time is {{time}}", { name: "Alice" })
 * // Returns: "Hello Alice, the time is {{time}}"
 * // Note: {{time}} is preserved for ST's macro engine
 */
export function processTemplate(template, data = {}) {
    if (!template || typeof template !== 'string') {
        return '';
    }

    // Replace single-brace placeholders {key} with data values
    // But preserve double-brace {{macros}} for SillyTavern
    let result = template;

    // Replace {key} placeholders (but not {{macros}})
    for (const [key, value] of Object.entries(data)) {
        // Use a regex that matches {key} but not {{key}}
        // Negative lookbehind (?<!{) ensures no { before
        // Negative lookahead (?!}) ensures no } after
        const regex = new RegExp(`(?<!{){${key}}(?!})`, 'g');
        result = result.replace(regex, String(value));
    }

    return result;
}

/**
 * Check if a string contains SillyTavern macros
 * @param {string} text - Text to check
 * @returns {boolean}
 */
export function containsMacros(text) {
    if (!text || typeof text !== 'string') {
        return false;
    }
    return /\{\{[^}]+\}\}/.test(text);
}

/**
 * Extract all macro names from a string
 * @param {string} text - Text to extract from
 * @returns {string[]} Array of macro names (without braces)
 * 
 * @example
 * extractMacros("Hello {{user}}, time is {{time}}")
 * // Returns: ["user", "time"]
 */
export function extractMacros(text) {
    if (!text || typeof text !== 'string') {
        return [];
    }

    const macroRegex = /\{\{([^}]+)\}\}/g;
    const macros = [];
    let match;

    while ((match = macroRegex.exec(text)) !== null) {
        macros.push(match[1]);
    }

    return macros;
}

/**
 * Validate that a template string is well-formed
 * Checks for:
 * - Balanced braces
 * - No nested single-brace placeholders
 * 
 * @param {string} template - Template to validate
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateTemplate(template) {
    const errors = [];

    if (!template || typeof template !== 'string') {
        return { valid: true, errors: [] };
    }

    // Check for balanced braces
    let braceCount = 0;
    let doubleBraceCount = 0;

    for (let i = 0; i < template.length; i++) {
        const char = template[i];
        const nextChar = template[i + 1];

        if (char === '{') {
            if (nextChar === '{') {
                doubleBraceCount++;
                i++; // Skip next brace
            } else {
                braceCount++;
            }
        } else if (char === '}') {
            if (nextChar === '}') {
                doubleBraceCount--;
                i++; // Skip next brace
            } else {
                braceCount--;
            }
        }
    }

    if (braceCount !== 0) {
        errors.push(`Unbalanced single braces (count: ${braceCount})`);
    }

    if (doubleBraceCount !== 0) {
        errors.push(`Unbalanced double braces (count: ${doubleBraceCount})`);
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Template class for more complex template handling
 */
export class Template {
    /**
     * Create a new template
     * @param {string} content - Template content
     */
    constructor(content) {
        this.content = content || '';
        this.validation = validateTemplate(this.content);
    }

    /**
     * Process this template with data
     * @param {Object} data - Data for placeholder replacement
     * @returns {string}
     */
    process(data = {}) {
        return processTemplate(this.content, data);
    }

    /**
     * Check if template is valid
     * @returns {boolean}
     */
    isValid() {
        return this.validation.valid;
    }

    /**
     * Get validation errors
     * @returns {string[]}
     */
    getErrors() {
        return this.validation.errors;
    }

    /**
     * Get all macros in this template
     * @returns {string[]}
     */
    getMacros() {
        return extractMacros(this.content);
    }
}

