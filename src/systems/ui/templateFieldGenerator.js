/**
 * Template Field Generator
 * Generates UI for template fields and integrates with Guided Generations
 */

import { extensionSettings } from '../../core/state.js';
import { extensionFolderPath } from '../../core/config.js';
import { getChatContext } from '../generation/contextBuilder.js';
import { callLLMForCreation } from './characterCreator.js';

/**
 * Generate HTML for a single template field
 * @param {Object} field - Field object from template parser
 * @param {number} index - Field index
 * @returns {string} HTML string
 */
export function generateFieldHTML(field, index) {
    const fieldId = `field-${index}`;
    const safeName = field.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

    return `
        <div class="rpg-template-field" data-field-index="${index}" data-field-name="${field.name}" data-field-safe-name="${safeName}">
            <details>
                <summary style="cursor: pointer; font-weight: 600; margin-bottom: 12px; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px;">
                    <i class="fa-solid fa-chevron-down" style="margin-right: 8px; font-size: 10px;"></i>
                    ${field.name}
                </summary>

                <div style="padding: 0 12px 12px 12px;">
                    <!-- Instruction Label -->
                    <div style="margin-bottom: 8px; padding: 6px 10px; background: rgba(100,150,255,0.1); border-left: 3px solid rgba(100,150,255,0.5); border-radius: 3px; font-size: 12px; font-style: italic;">
                        ${field.instruction}
                    </div>

                    <!-- Output Textarea -->
                    <label style="display: block; margin-bottom: 4px; font-size: 11px; opacity: 0.8;">
                        <i class="fa-solid fa-file-lines"></i> Output:
                    </label>
                    <textarea
                        id="${fieldId}-output"
                        class="text_pole rpg-field-output"
                        data-field-name="${field.name}"
                        data-field-safe-name="${safeName}"
                        style="width: 100%; min-height: 100px; margin-bottom: 12px; font-size: 13px; resize: vertical;"
                        placeholder="${field.placeholder}"
                    ></textarea>

                    <!-- Guidance Prompt Textarea -->
                    <label style="display: block; margin-bottom: 4px; font-size: 11px; opacity: 0.8;">
                        <i class="fa-solid fa-wand-magic-sparkles"></i> Guidance Prompt:
                    </label>
                    <textarea
                        id="${fieldId}-guidance"
                        class="text_pole rpg-field-guidance"
                        data-field-name="${field.name}"
                        data-field-safe-name="${safeName}"
                        style="width: 100%; min-height: 60px; margin-bottom: 12px; font-size: 12px; font-family: monospace; resize: vertical;"
                        placeholder="Optional: Add specific instructions for generating this field..."
                    ></textarea>

                    <!-- Action Buttons with Max Tokens -->
                    <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                        <button
                            class="menu_button rpg-field-generate"
                            data-field-index="${index}"
                            style="background: #4a90e2; color: white;">
                            <i class="fa-solid fa-wand-magic-sparkles"></i> Generate
                        </button>
                        <button
                            class="menu_button rpg-field-continue"
                            data-field-index="${index}">
                            <i class="fa-solid fa-forward"></i> Continue
                        </button>
                        <button
                            class="menu_button rpg-field-clear"
                            data-field-index="${index}"
                            style="background: rgba(255,100,100,0.2);">
                            <i class="fa-solid fa-eraser"></i> Clear
                        </button>
                        <div style="display: flex; align-items: center; gap: 6px; margin-left: auto;">
                            <label style="font-size: 11px; opacity: 0.8; white-space: nowrap;">
                                <i class="fa-solid fa-hashtag"></i> Max Tokens:
                            </label>
                            <input
                                type="number"
                                id="${fieldId}-max-tokens"
                                class="text_pole rpg-field-max-tokens"
                                data-field-name="${field.name}"
                                data-field-index="${index}"
                                style="width: 90px; height: 28px; text-align: center;"
                                min="50"
                                max="4000"
                                step="50"
                                value="500"
                                placeholder="500"
                            />
                        </div>
                    </div>
                </div>
            </details>
        </div>
    `;
}

/**
 * Render all template fields into a container
 * @param {Array<Object>} fields - Array of field objects
 * @param {string} containerId - ID of the container element
 */
export function renderTemplateFields(fields, containerId) {
    const container = $(`#${containerId}`);
    
    if (!container.length) {
        console.error('[Character Creator] Container not found:', containerId);
        return;
    }
    
    // Generate HTML for all fields
    const html = fields.map((field, index) => generateFieldHTML(field, index)).join('\n');
    container.html(html);
    
    // Attach event handlers
    attachFieldEventHandlers(fields);
}

/**
 * Attach event handlers to field buttons
 * @param {Array<Object>} fields - Array of field objects
 */
function attachFieldEventHandlers(fields) {
    // Generate button
    $('.rpg-field-generate').off('click').on('click', async function() {
        const index = $(this).data('field-index');
        await generateField(index, fields);
    });
    
    // Continue button
    $('.rpg-field-continue').off('click').on('click', async function() {
        const index = $(this).data('field-index');
        await continueField(index, fields);
    });
    
    // Clear button
    $('.rpg-field-clear').off('click').on('click', function() {
        const index = $(this).data('field-index');
        clearField(index);
    });
}

// Store last captured prompt globally
let lastCapturedPrompt = null;

/**
 * Get the last captured prompt
 * @returns {string|null} The last captured prompt or null
 */
export function getLastCapturedPrompt() {
    return lastCapturedPrompt;
}

/**
 * Generate content for a specific field using standard /gen command
 * @param {number} index - Field index
 * @param {Array<Object>} fields - Array of all fields
 */
async function generateField(index, fields) {
    const field = fields[index];
    const outputTextarea = $(`#field-${index}-output`);
    const guidanceTextarea = $(`#field-${index}-guidance`);

    const guidance = guidanceTextarea.val().trim();
    const existingOutput = outputTextarea.val().trim();

    console.log('[Character Creator] generateField called for:', field.name);

    // Build the prompt
    let prompt = buildFieldPrompt(field, fields, index, guidance);

    console.log('[Character Creator] Built prompt length:', prompt.length);

    // Capture prompt if toggle is enabled
    const shouldCapturePrompt = $('#show-raw-prompt-toggle').is(':checked');
    if (shouldCapturePrompt) {
        lastCapturedPrompt = prompt;
        $('#show-last-prompt-btn').prop('disabled', false);
        console.log('[Character Creator] Prompt captured for field:', field.name);
    }

    try {
        toastr.info(`Generating ${field.name}...`, 'Character Creator');

        // Get per-field max tokens setting
        const fieldMaxTokensValue = $(`#field-${index}-max-tokens`).val();
        const fieldMaxTokens = parseInt(fieldMaxTokensValue);

        console.log('[Character Creator] Field max tokens raw value:', fieldMaxTokensValue);
        console.log('[Character Creator] Field max tokens parsed:', fieldMaxTokens);

        // Build options object
        const options = {};
        if (!isNaN(fieldMaxTokens) && fieldMaxTokens > 0) {
            options.maxTokens = fieldMaxTokens;
            console.log('[Character Creator] Using field-specific max tokens:', fieldMaxTokens);
        } else {
            console.log('[Character Creator] Using profile default max tokens (field value was empty or invalid)');
        }

        console.log('[Character Creator] Final generation options:', options);

        // Use callLLMForCreation which respects connection profile and overrides
        const result = await callLLMForCreation(prompt, options);

        if (result && typeof result === 'string' && result.trim()) {
            outputTextarea.val(result.trim());
            toastr.success(`${field.name} generated!`, 'Character Creator');
        } else {
            throw new Error('No response from generation');
        }
    } catch (error) {
        console.error('[Character Creator] Generation error:', error);
        toastr.error(`Failed to generate ${field.name}: ${error.message}`, 'Character Creator');
    }
}

/**
 * Continue generating content for a specific field using standard /gen command
 * @param {number} index - Field index
 * @param {Array<Object>} fields - Array of all fields
 */
async function continueField(index, fields) {
    const field = fields[index];
    const outputTextarea = $(`#field-${index}-output`);
    const guidanceTextarea = $(`#field-${index}-guidance`);

    const existingOutput = outputTextarea.val().trim();

    if (!existingOutput) {
        toastr.warning('No content to continue. Use Generate first.', 'Character Creator');
        return;
    }

    const guidance = guidanceTextarea.val().trim();

    // Build a continuation prompt that includes the existing content
    const continuePrompt = `${field.instruction}\n\nCurrent content:\n${existingOutput}\n\n${guidance || 'Continue writing naturally from where it left off.'}`;

    // Capture prompt if toggle is enabled
    const shouldCapturePrompt = $('#show-raw-prompt-toggle').is(':checked');
    if (shouldCapturePrompt) {
        lastCapturedPrompt = continuePrompt;
        $('#show-last-prompt-btn').prop('disabled', false);
        console.log('[Character Creator] Continue prompt captured for field:', field.name);
    }

    try {
        toastr.info(`Continuing ${field.name}...`, 'Character Creator');

        // Get per-field max tokens setting
        const fieldMaxTokens = parseInt($(`#field-${index}-max-tokens`).val());

        // Build options object
        const options = {};
        if (fieldMaxTokens && fieldMaxTokens > 0) {
            options.maxTokens = fieldMaxTokens;
        }

        console.log('[Character Creator] Continuation options:', options);

        // Use callLLMForCreation which respects connection profile and overrides
        const result = await callLLMForCreation(continuePrompt, options);

        // Append the result to the existing output
        if (result && typeof result === 'string' && result.trim()) {
            outputTextarea.val(existingOutput + '\n\n' + result.trim());
            toastr.success(`${field.name} continued!`, 'Character Creator');
        } else {
            toastr.warning('No continuation generated', 'Character Creator');
        }
    } catch (error) {
        console.error('[Character Creator] Continue error:', error);
        toastr.error(`Failed to continue ${field.name}: ${error.message}`, 'Character Creator');
    }
}

/**
 * Clear a field's output
 * @param {number} index - Field index
 */
function clearField(index) {
    $(`#field-${index}-output`).val('');
    toastr.info('Field cleared', 'Character Creator');
}

/**
 * Build the generation prompt for a field
 * @param {Object} field - Current field
 * @param {Array<Object>} allFields - All fields
 * @param {number} currentIndex - Current field index
 * @param {string} guidance - User guidance
 * @returns {string} Complete prompt
 */
function buildFieldPrompt(field, allFields, currentIndex, guidance) {
    let prompt = '';

    // Add global control prompt if available
    const globalPrompt = $('#global-control-prompt').val();
    if (globalPrompt && globalPrompt.trim()) {
        prompt += globalPrompt.trim() + '\n\n';
    }

    // Add chat context if depth > 0
    const chatDepth = parseInt($('#chat-context-depth').val()) || 0;
    console.log('[Character Creator] Chat context depth:', chatDepth);
    if (chatDepth > 0) {
        const chatContext = getChatContext(chatDepth, {
            includeNames: true,
            filterEmpty: true
        });
        console.log('[Character Creator] Chat context retrieved:', chatContext ? `${chatContext.length} chars` : 'null/empty');
        if (chatContext) {
            prompt += chatContext + '\n';
        }
    }

    // Add character data context if available
    const charContext = $('#char-context-wrapper').val();
    const charData = $('#char-context-data').val();
    if (charContext && charData) {
        prompt += charContext.trim() + '\n' + charData.trim() + '\n\n';
    }

    // Add previously generated fields as context
    const previousFields = [];
    for (let i = 0; i < currentIndex; i++) {
        const prevOutput = $(`#field-${i}-output`).val().trim();
        if (prevOutput) {
            previousFields.push(`**${allFields[i].name}:**\n${prevOutput}`);
        }
    }

    if (previousFields.length > 0) {
        prompt += '=== Previously Generated Fields ===\n';
        prompt += previousFields.join('\n\n') + '\n\n';
    }

    // Add current field instruction
    prompt += `=== Generate: ${field.name} ===\n`;
    prompt += `Instruction: ${field.instruction}\n\n`;

    // Add user guidance if provided
    if (guidance) {
        prompt += `Additional Guidance: ${guidance}\n\n`;
    }

    prompt += `Now generate the ${field.name}:`;

    return prompt;
}

/**
 * Get all field outputs as a structured object
 * @returns {Object} Field name -> output mapping
 */
export function getAllFieldOutputs() {
    const outputs = {};
    $('.rpg-field-output').each(function() {
        const fieldName = $(this).data('field-name');
        const value = $(this).val().trim();
        if (value) {
            outputs[fieldName] = value;
        }
    });
    return outputs;
}

/**
 * Export all fields as formatted text
 * @returns {string} Formatted character card text
 */
export function exportFieldsAsText() {
    let output = '';
    $('.rpg-template-field').each(function() {
        const index = $(this).data('field-index');
        const fieldName = $(this).find('summary').text().trim();
        const fieldOutput = $(`#field-${index}-output`).val().trim();

        if (fieldOutput) {
            output += `**${fieldName}:**\n${fieldOutput}\n\n`;
        }
    });
    return output;
}

