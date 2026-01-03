/**
 * Template Parser for Character Creator
 * Parses template files with the format:
 * **FieldName:**
 * *[Instruction text]*
 */

import { extensionFolderPath } from '../../core/config.js';
import { extensionSettings } from '../../core/state.js';
import { saveSettings } from '../../core/persistence.js';

// User templates directory for data isolation (fallback for file-based templates)
const USER_TEMPLATES_PATH = 'user/files/rpg-companion-templates';

/**
 * Parse a template string into structured field data
 * @param {string} templateContent - The raw template content
 * @returns {Array<Object>} Array of field objects
 */
export function parseTemplate(templateContent) {
    const fields = [];
    const lines = templateContent.split('\n');
    
    let currentField = null;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Match field header: **FieldName:**
        const headerMatch = line.match(/^\*\*(.+?):\*\*$/);
        if (headerMatch) {
            // Save previous field if exists
            if (currentField) {
                fields.push(currentField);
            }
            
            // Start new field
            currentField = {
                name: headerMatch[1].trim(),
                instruction: '',
                placeholder: ''
            };
            continue;
        }
        
        // Match instruction: *[Instruction text]*
        const instructionMatch = line.match(/^\*\[(.+?)\]\*$/);
        if (instructionMatch && currentField) {
            const fullInstruction = instructionMatch[1].trim();
            currentField.instruction = fullInstruction;
            currentField.placeholder = fullInstruction; // Use same text as placeholder
            continue;
        }
    }
    
    // Don't forget the last field
    if (currentField) {
        fields.push(currentField);
    }
    
    return fields;
}

/**
 * Load a template from settings storage or file system
 * @param {string} templateName - Name of the template file (without .txt extension)
 * @returns {Promise<Array<Object>>} Parsed template fields
 */
export async function loadTemplate(templateName) {
    try {
        // First, try to load from extension settings (user-saved templates)
        if (extensionSettings.characterCreator?.templates?.[templateName]) {
            console.log(`[Character Creator] Loading template "${templateName}" from settings`);
            const templateText = extensionSettings.characterCreator.templates[templateName];
            return parseTemplate(templateText);
        }

        // Try user templates directory (file-based fallback)
        let response = await fetch(`/${USER_TEMPLATES_PATH}/${templateName}.txt`);

        // If not found in user directory, fall back to extension templates
        if (!response.ok) {
            console.log(`[Character Creator] Template not found in user directory, trying extension templates...`);
            response = await fetch(`/${extensionFolderPath}/templates/${templateName}.txt`);
        }

        if (!response.ok) {
            throw new Error(`Template "${templateName}" not found in user or extension directories`);
        }

        const content = await response.text();
        return parseTemplate(content);
    } catch (error) {
        console.error('[Character Creator] Error loading template:', error);
        throw error;
    }
}

/**
 * Get list of available templates from settings
 * @returns {Promise<Array<string>>} Array of template names
 */
export async function getAvailableTemplates() {
    try {
        const templates = [];

        // Add user-saved templates from settings
        if (extensionSettings.characterCreator?.templates) {
            templates.push(...Object.keys(extensionSettings.characterCreator.templates));
        }

        return templates.sort();
    } catch (error) {
        console.warn('[Character Creator] Could not load template list:', error);
        return [];
    }
}

/**
 * Save a template to extension settings
 * @param {string} templateName - Name of the template
 * @param {string} templateContent - Template content as text
 */
export function saveTemplateToSettings(templateName, templateContent) {
    // Initialize the templates object if it doesn't exist
    if (!extensionSettings.characterCreator) {
        extensionSettings.characterCreator = {};
    }
    if (!extensionSettings.characterCreator.templates) {
        extensionSettings.characterCreator.templates = {};
    }

    // Save the template
    extensionSettings.characterCreator.templates[templateName] = templateContent;

    // Persist to disk
    saveSettings();

    console.log(`[Character Creator] Template "${templateName}" saved to settings`);
}

/**
 * Get raw template content from settings
 * @param {string} templateName - Name of the template
 * @returns {string|null} Template content or null if not found
 */
export function getTemplateContent(templateName) {
    return extensionSettings.characterCreator?.templates?.[templateName] || null;
}

/**
 * Delete a template from extension settings
 * @param {string} templateName - Name of the template to delete
 * @returns {boolean} True if deleted, false if not found
 */
export function deleteTemplateFromSettings(templateName) {
    if (extensionSettings.characterCreator?.templates?.[templateName]) {
        delete extensionSettings.characterCreator.templates[templateName];
        saveSettings();
        console.log(`[Character Creator] Template "${templateName}" deleted from settings`);
        return true;
    }
    return false;
}

/**
 * Validate template structure
 * @param {Array<Object>} fields - Parsed template fields
 * @returns {boolean} True if valid
 */
export function validateTemplate(fields) {
    if (!Array.isArray(fields) || fields.length === 0) {
        return false;
    }
    
    for (const field of fields) {
        if (!field.name || typeof field.name !== 'string') {
            return false;
        }
        if (!field.instruction || typeof field.instruction !== 'string') {
            return false;
        }
    }
    
    return true;
}

