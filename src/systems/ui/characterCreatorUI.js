/**
 * Character Creator UI Module
 * Handles the UI for the character creator feature
 */

import { extensionSettings } from '../../core/state.js';
import { extensionFolderPath } from '../../core/config.js';
import {
    buildCharacterCreationPrompt,
    buildFieldCreationPrompt,
    callLLMForCreation,
    getPresetMaxTokens,
    getPresetMaxContext,
    getTemplates,
    saveTemplate,
    deleteTemplate,
    saveWIP,
    loadWIP,
    clearWIP,
    exportAsText,
    exportAsJSON,
    downloadCharacter,
    getAvailableProfiles,
    getSelectedProfile,
    setSelectedProfile
} from './characterCreator.js';
import { loadTemplate, getAvailableTemplates, saveTemplateToSettings, deleteTemplateFromSettings, getTemplateContent } from './templateParser.js';
import { renderTemplateFields, exportFieldsAsText, getLastCapturedPrompt } from './templateFieldGenerator.js';

/**
 * Saves the current template's field data to extensionSettings (per-template storage)
 */
function saveCurrentTemplateData() {
    const selectedTemplate = $('#template-selector').val();
    if (!selectedTemplate) return; // No template selected, nothing to save

    if (!extensionSettings.characterCreator) {
        extensionSettings.characterCreator = {};
    }
    if (!extensionSettings.characterCreator.templateData) {
        extensionSettings.characterCreator.templateData = {};
    }

    const templateFields = {};

    // Save all template-generated output fields using field index as key
    $('.rpg-field-output').each(function(index) {
        const fieldValue = $(this).val();
        templateFields[`field_${index}`] = fieldValue;
    });

    // Save all template-generated guidance fields using field index as key
    $('.rpg-field-guidance').each(function(index) {
        const fieldValue = $(this).val();
        templateFields[`field_${index}_guidance`] = fieldValue;
    });

    // Save all template-generated max tokens fields using field index as key
    $('.rpg-field-max-tokens').each(function(index) {
        const fieldValue = $(this).val();
        templateFields[`field_${index}_max_tokens`] = fieldValue;
    });

    extensionSettings.characterCreator.templateData[selectedTemplate] = templateFields;
    SillyTavern.getContext().saveSettingsDebounced();
}

/**
 * Saves the current state of character creator fields to extensionSettings
 */
function saveCharacterCreatorState() {
    if (!extensionSettings.characterCreator) {
        extensionSettings.characterCreator = {};
    }

    // Save current template data first
    saveCurrentTemplateData();

    const wipData = {
        selectedTemplate: $('#template-selector').val() || '',
        globalControlPrompt: $('#global-control-prompt').val() || '',
        connectionProfile: $('#profile-selector').val() || '',
        chatContextDepth: parseInt($('#chat-context-depth').val()) || 10,
        showRawPromptToggle: $('#show-raw-prompt-toggle').prop('checked') || false
    };

    extensionSettings.characterCreator.wipData = wipData;
    SillyTavern.getContext().saveSettingsDebounced();
}

/**
 * Restores the saved template field data for the currently selected template
 */
function restoreCurrentTemplateData() {
    const selectedTemplate = $('#template-selector').val();
    if (!selectedTemplate) return;

    const templateData = extensionSettings.characterCreator?.templateData?.[selectedTemplate];
    if (!templateData) return;

    console.log('[Character Creator] Restoring template data for:', selectedTemplate);

    // Restore template fields (output, guidance, and max tokens) using field index
    Object.entries(templateData).forEach(([key, fieldValue]) => {
        if (key.endsWith('_guidance')) {
            // Restore guidance field by index
            const indexMatch = key.match(/field_(\d+)_guidance/);
            if (indexMatch) {
                const index = indexMatch[1];
                $(`#field-${index}-guidance`).val(fieldValue);
            }
        } else if (key.endsWith('_max_tokens')) {
            // Restore max tokens field by index
            const indexMatch = key.match(/field_(\d+)_max_tokens/);
            if (indexMatch) {
                const index = indexMatch[1];
                $(`#field-${index}-max-tokens`).val(fieldValue);
            }
        } else {
            // Restore output field by index
            const indexMatch = key.match(/field_(\d+)$/);
            if (indexMatch) {
                const index = indexMatch[1];
                $(`#field-${index}-output`).val(fieldValue);
            }
        }
    });
}

/**
 * Restores the saved state to character creator fields
 */
function restoreCharacterCreatorState() {
    const wipData = extensionSettings.characterCreator?.wipData;
    if (!wipData) return;

    console.log('[Character Creator] Restoring saved state:', wipData);

    // Restore persistent fields
    if (wipData.globalControlPrompt) {
        $('#global-control-prompt').val(wipData.globalControlPrompt);
    }
    if (wipData.connectionProfile) {
        $('#profile-selector').val(wipData.connectionProfile);
    }

    // Restore chat context depth
    if (wipData.chatContextDepth !== undefined) {
        $('#chat-context-depth').val(wipData.chatContextDepth);
    }

    // Restore show raw prompt toggle
    if (wipData.showRawPromptToggle !== undefined) {
        $('#show-raw-prompt-toggle').prop('checked', wipData.showRawPromptToggle);
    }

    // Restore selected template
    if (wipData.selectedTemplate) {
        $('#template-selector').val(wipData.selectedTemplate);
        // Trigger change event to load the template and its data
        $('#template-selector').trigger('change');
    }
}

/**
 * Clears only the template-generated output fields (not guidance prompts or persistent settings)
 */
function clearTemplateFields() {
    $('.rpg-field-output').val('');
    saveCharacterCreatorState();
    toastr.success('Template output fields cleared', 'Character Creator');
}

/**
 * Opens the character creator modal
 * @param {Object} characterData - Optional character data from NPC card
 */
export async function openCharacterCreatorModal(characterData = null) {
    console.log('[Character Creator] Opening modal...', characterData ? 'with character data' : 'new character');

    // Prepare character context if provided
    let characterContext = '';
    if (characterData) {
        const fields = Object.entries(characterData)
            .filter(([key]) => !['emoji', 'name'].includes(key))
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');
        characterContext = `Name: ${characterData.name}\n${fields}`;
    }

    // Create the character creator modal
    const modalHtml = `
        <div id="rpg-character-creator-modal" class="rpg-settings-popup is-open">
            <div class="rpg-settings-popup-content" style="max-width: 900px; max-height: 90vh; overflow-y: auto;">
                <header class="rpg-settings-popup-header">
                    <h3>
                        <i class="fa-solid fa-user-plus"></i>
                        <span>Character Creator</span>
                    </h3>
                    <button id="close-creator-modal" class="rpg-popup-close" type="button">&times;</button>
                </header>
                <div class="rpg-settings-popup-body" style="padding: 20px;">

                    <!-- Settings Grid: Connection Profile -->
                    <div style="margin-bottom: 20px;">
                        <div>
                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">
                                <i class="fa-solid fa-plug"></i> Connection Profile:
                            </label>
                            <select id="profile-selector" class="text_pole" style="width: 100%;">
                                <option value="">Main API</option>
                            </select>
                        </div>
                    </div>

                    <!-- Settings Grid: Chat Context -->
                    <div style="margin-bottom: 20px;">
                        <label style="display: flex; align-items: center; margin-bottom: 8px; font-weight: 600;">
                            <i class="fa-solid fa-comments"></i> Chat Context Depth
                        </label>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <input type="number" id="chat-context-depth" class="text_pole" style="width: 120px; height: 28px; text-align: center;" min="0" max="50" step="1" value="10" />
                            <small style="font-size: 10px; color: #888;">0 = no chat context</small>
                        </div>
                    </div>

                    <!-- Note about Generation Settings -->
                    <div style="margin-bottom: 20px; padding: 10px; background: rgba(255, 255, 255, 0.05); border-radius: 5px;">
                        <small style="color: #888;">
                            <i class="fa-solid fa-info-circle"></i> <strong>Note:</strong> Temperature is controlled by your Connection Profile's preset settings. Max tokens can be set per-field below.
                        </small>
                    </div>

                    <!-- Global Control Prompt (Full Width) -->
                    <div style="margin-bottom: 20px;">
                        <details open>
                            <summary style="cursor: pointer; font-weight: 600; margin-bottom: 8px;">
                                <i class="fa-solid fa-scroll"></i> Global Control Prompt
                            </summary>
                            <textarea id="global-control-prompt" class="text_pole" style="width: 100%; min-height: 120px; font-size: 12px; font-family: monospace;">CHARACTER DEVELOPMENT PROTOCOL
Generate detailed, consistent character information following these guidelines:
- Maintain consistency with existing world/chat context
- Create believable, nuanced personalities
- Provide specific, vivid details
- Follow the field guidance for each section</textarea>
                        </details>
                    </div>

                    <!-- Character Data Context (if from card) (Full Width) -->
                    ${characterContext ? `
                    <div style="margin-bottom: 20px;">
                        <details open>
                            <summary style="cursor: pointer; font-weight: 600; margin-bottom: 8px;">
                                <i class="fa-solid fa-id-card"></i> Character Data Context
                            </summary>
                            <div style="background: rgba(0,0,0,0.2); padding: 12px; border-radius: 4px; margin-top: 8px;">
                                <label style="display: block; margin-bottom: 6px; font-size: 12px; opacity: 0.8;">Context Wrapper:</label>
                                <textarea id="char-context-wrapper" class="text_pole" style="width: 100%; min-height: 60px; margin-bottom: 12px; font-size: 12px;" placeholder="Wrapper text...">Review this character data and use it as context when generating the full character card:</textarea>
                                <label style="display: block; margin-bottom: 6px; font-size: 12px; opacity: 0.8;">Character Data:</label>
                                <textarea id="char-context-data" class="text_pole" style="width: 100%; min-height: 100px; background: rgba(0,0,0,0.3); font-size: 12px; font-family: monospace;" readonly>${characterContext}</textarea>
                            </div>
                        </details>
                    </div>
                    ` : ''}

                    <!-- Template Management Section -->
                    <div style="margin-bottom: 20px;">
                        <details>
                            <summary style="cursor: pointer; font-weight: 600; margin-bottom: 12px; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px;">
                                <i class="fa-solid fa-plus-circle"></i> Create New Template
                            </summary>
                            <div style="padding: 12px; background: rgba(0,0,0,0.2); border-radius: 4px; margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 6px; font-size: 12px; font-weight: 600;">
                                    <i class="fa-solid fa-tag"></i> Template Name:
                                </label>
                                <input type="text" id="new-template-name" class="text_pole" style="width: 100%; margin-bottom: 12px;" placeholder="my-custom-template" />

                                <label style="display: block; margin-bottom: 6px; font-size: 12px; font-weight: 600;">
                                    <i class="fa-solid fa-file-code"></i> Template Content:
                                </label>
                                <textarea id="new-template-content" class="text_pole" style="width: 100%; min-height: 300px; font-family: monospace; font-size: 12px; margin-bottom: 12px;" placeholder="**Name:**
*[NPC's full name]*

**Age:**
*[NPC's age]*

**Physical Description:**
*[Detailed description of appearance]*

**Personality Traits:**
*[Brief description of core traits]*

**Background:**
*[NPC's history and connection to {{user}}]*

Format: Each field starts with **Field Name:** followed by *[Instruction text]* on the next line."></textarea>

                                <button id="save-new-template-btn" class="menu_button" style="background: #4a90e2; color: white; width: 100%;">
                                    <i class="fa-solid fa-save"></i> Save Template
                                </button>
                            </div>
                        </details>

                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">
                            <i class="fa-solid fa-file-lines"></i> Template:
                        </label>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <select id="template-selector" class="text_pole" style="flex: 1;">
                                <option value="">-- Select a Template --</option>
                            </select>
                            <button id="edit-template-btn" class="menu_button" title="Edit selected template" style="background: #5cb85c; color: white;" disabled>
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button id="refresh-templates-btn" class="menu_button" title="Refresh template list">
                                <i class="fa-solid fa-rotate"></i>
                            </button>
                            <button id="clear-wip-btn" class="menu_button" title="Clear all saved work-in-progress data" style="background: #f0ad4e; color: white;">
                                <i class="fa-solid fa-eraser"></i>
                            </button>
                            <button id="delete-template-btn" class="menu_button" title="Delete selected template" style="background: #d9534f; color: white;" disabled>
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>

                        <!-- Export Character Section -->
                        <details style="margin-top: 15px;">
                            <summary style="cursor: pointer; font-weight: 600; margin-bottom: 12px; padding: 8px; background: rgba(100,200,100,0.1); border-radius: 4px;">
                                <i class="fa-solid fa-file-export"></i> Export Completed Character
                            </summary>
                            <div style="padding: 12px; background: rgba(0,0,0,0.2); border-radius: 4px; margin-bottom: 15px;">
                                <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                                    <button id="export-character-btn" class="menu_button" style="background: #5cb85c; color: white; flex: 1;">
                                        <i class="fa-solid fa-download"></i> Export Character to Text Box
                                    </button>
                                    <button id="copy-exported-character-btn" class="menu_button" style="background: #4a90e2; color: white;">
                                        <i class="fa-solid fa-copy"></i> Copy to Clipboard
                                    </button>
                                </div>

                                <label style="display: block; margin-bottom: 6px; font-size: 12px; font-weight: 600;">
                                    <i class="fa-solid fa-file-text"></i> Exported Character:
                                </label>
                                <textarea id="exported-character-text" class="text_pole" style="width: 100%; min-height: 400px; font-family: monospace; font-size: 12px;" placeholder="Click 'Export Character to Text Box' to generate the formatted character data here..." readonly></textarea>
                            </div>
                        </details>
                    </div>

                    <!-- Character Generation Area (Collapsible) -->
                    <div style="margin-bottom: 20px;">
                        <details open>
                            <summary style="cursor: pointer; font-weight: 600; margin-bottom: 12px; padding: 8px; background: rgba(100,150,255,0.1); border-radius: 4px;">
                                <i class="fa-solid fa-wand-magic-sparkles"></i> Character Generation
                            </summary>
                            <div id="template-fields-container" style="margin-top: 15px;">
                                <!-- Template fields will be dynamically inserted here -->
                            </div>
                        </details>
                    </div>

                    <hr style="margin: 30px 0; border: none; border-top: 1px solid rgba(255,255,255,0.1);" />

                    <!-- DEV TEST SECTION (Keep for now) -->
                    <div style="margin-bottom: 20px; padding: 15px; background: rgba(255,200,0,0.1); border-radius: 4px;">
                        <h4 style="margin-top: 0;"><i class="fa-solid fa-flask"></i> DEV TEST</h4>

                        <!-- Show Raw Prompt Toggle -->
                        <div style="margin-bottom: 10px; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 4px;">
                            <label class="checkbox_label" style="display: flex; align-items: center; gap: 8px;">
                                <input type="checkbox" id="show-raw-prompt-toggle" />
                                <span><i class="fa-solid fa-square-poll-horizontal"></i> Capture & Show Raw Prompt on Generation</span>
                            </label>
                            <button id="show-last-prompt-btn" class="menu_button" style="margin-top: 8px; width: 100%; background: #4a90e2; color: white;" disabled>
                                <i class="fa-solid fa-eye"></i> View Last Captured Prompt
                            </button>
                        </div>

                        <button id="test-wizard" class="menu_button" style="margin: 5px;">
                            <i class="fa-solid fa-hat-wizard"></i> Test: Wise Wizard
                        </button>
                        <button id="test-warrior" class="menu_button" style="margin: 5px;">
                            <i class="fa-solid fa-shield"></i> Test: Brave Warrior
                        </button>
                        <div id="debug-output" style="margin-top: 10px; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 4px; max-height: 150px; overflow-y: auto; font-size: 11px; font-family: monospace;">Ready...</div>
                        <div id="generated-output" style="margin-top: 10px; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 4px; max-height: 200px; overflow-y: auto; font-size: 12px; white-space: pre-wrap;">No output yet...</div>
                    </div>

                </div>
                <footer class="rpg-settings-popup-footer" style="padding: 15px 20px; border-top: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                    <div style="display: flex; gap: 10px;">
                        <button id="generate-all-btn" class="menu_button" style="background: #4a90e2; color: white;">
                            <i class="fa-solid fa-wand-magic-sparkles"></i> Generate All
                        </button>
                        <button id="copy-output-btn" class="menu_button">
                            <i class="fa-solid fa-copy"></i> Copy Output
                        </button>
                    </div>
                    <button id="clear-template-fields-btn" class="menu_button" style="background: #e94560; color: white;">
                        <i class="fa-solid fa-eraser"></i> Clear Fields
                    </button>
                </footer>
            </div>
        </div>
    `;

    // Remove existing modal if any
    $('#rpg-character-creator-modal').remove();

    // Add modal to page
    $('body').append(modalHtml);

    // Apply theme to modal
    const theme = extensionSettings.theme || 'default';
    $('#rpg-character-creator-modal').attr('data-theme', theme);

    // Populate template selector
    (async () => {
        try {
            const templates = await getAvailableTemplates();
            const selector = $('#template-selector');
            templates.forEach(name => {
                selector.append(`<option value="${name}">${name.charAt(0).toUpperCase() + name.slice(1)}</option>`);
            });
        } catch (error) {
            console.error('[Character Creator] Failed to load templates:', error);
        }
    })();

    // Populate profile selector
    const profiles = getAvailableProfiles();
    const selectedProfileId = getSelectedProfile();

    profiles.forEach(profile => {
        const option = $('<option></option>')
            .val(profile.id)
            .text(profile.name);
        if (profile.id === selectedProfileId) {
            option.prop('selected', true);
        }
        $('#profile-selector').append(option);
    });

    // Update profile info display
    function updateProfileInfo() {
        const profileId = $('#profile-selector').val();
        if (profileId) {
            const profile = profiles.find(p => p.id === profileId);
            $('#profile-info').html(`
                <span style="color: #0f0;">✓ Profile Selected: ${profile ? profile.name : 'Unknown'}</span><br>
                <span style="color: #888; font-size: 10px;">This profile will handle all generation settings (API, model, preset, etc.)</span>
            `);
        } else {
            $('#profile-info').html(`
                <span style="color: #f80;">⚠ No profile selected - will use legacy generation method</span>
            `);
        }
    }

    // Profile selector change handler
    $('#profile-selector').on('change', function() {
        const profileId = $(this).val();
        setSelectedProfile(profileId);
        updateProfileInfo();
        console.log('[Character Creator] Profile changed to:', profileId);
    });

    // Initial profile info update
    updateProfileInfo();

    // Display preset info (legacy fallback)
    const maxTokens = getPresetMaxTokens();
    const maxContext = getPresetMaxContext();
    $('#preset-info').html(`
        Max Output Tokens: <span style="color: #0f0;">${maxTokens}</span><br>
        Max Context Tokens: <span style="color: #0f0;">${maxContext}</span><br>
        <span style="color: #888; font-size: 10px;">Only used if no Connection Profile is selected</span>
    `);

    // Restore saved state
    restoreCharacterCreatorState();

    // Setup autosave on all input changes
    $('#global-control-prompt').on('input', saveCharacterCreatorState);
    $('#profile-selector').on('change', saveCharacterCreatorState);
    $('#chat-context-depth').on('change', saveCharacterCreatorState);
    $('#show-raw-prompt-toggle').on('change', saveCharacterCreatorState);

    // Autosave template fields (delegated event for dynamically created fields)
    $(document).on('input change', '.rpg-field-output, .rpg-field-guidance, .rpg-field-max-tokens', function() {
        saveCurrentTemplateData();
    });

    // Debug logger
    function debugLog(message, isError = false) {
        const timestamp = new Date().toLocaleTimeString();
        const color = isError ? '#f00' : '#0f0';
        const prefix = isError ? '❌ ERROR' : '✅';
        const $output = $('#debug-output');
        $output.append(`<div style="color: ${color};">[${timestamp}] ${prefix} ${message}</div>`);
        $output.scrollTop($output[0].scrollHeight);
        console.log(`[Character Creator] ${message}`);
    }

    // Test function
    async function testCharacterCreation(concept, testName) {
        debugLog(`Starting test: ${testName}`);
        debugLog(`Concept: "${concept}"`);

        try {
            debugLog('Building prompt...');

            const fields = [
                { name: 'Name', description: 'Character name' },
                { name: 'Description', description: 'Physical appearance and notable features (2-3 sentences)' },
                { name: 'Personality', description: 'Personality traits and behavior (2-3 sentences)' },
                { name: 'Background', description: 'Brief backstory (1-2 sentences)' }
            ];

            const prompt = await buildCharacterCreationPrompt(concept, {
                includeChat: true,
                includeWorldInfo: true,
                includeExistingChars: true,
                includeTrackers: true,
                fields: fields
            });

            debugLog(`Prompt built (${prompt.length} chars)`);
            debugLog('Calling LLM...');

            // Use preset's token limits (don't override - let it use settings)
            const response = await callLLMForCreation(prompt, {
                // maxTokens will default to preset settings if not specified
            });

            debugLog(`Response received (${response.length} chars)`);

            // Display output
            $('#generated-output').text(response);

            // Test WIP save
            debugLog('Testing WIP save...');
            const characterData = {
                concept: concept,
                generated: response,
                timestamp: new Date().toISOString()
            };
            saveWIP(characterData);

            const loadedWIP = loadWIP();
            debugLog(`WIP saved and loaded successfully`);

            debugLog(`✅ Test "${testName}" completed successfully!`);

        } catch (error) {
            debugLog(`Error in test "${testName}": ${error.message}`, true);
            debugLog(`Stack: ${error.stack}`, true);
            $('#generated-output').html(`<span style="color: #f00;">ERROR: ${error.message}</span>`);
        }
    }

    // Button handlers
    $('#test-wizard').on('click', () => {
        testCharacterCreation('A wise old wizard with a long white beard, wearing star-covered robes and carrying an ancient staff', 'Wise Wizard');
    });

    $('#test-warrior').on('click', () => {
        testCharacterCreation('A brave warrior with battle scars, wearing heavy armor and wielding a legendary sword', 'Brave Warrior');
    });

    $('#test-rogue').on('click', () => {
        testCharacterCreation('A sneaky rogue dressed in dark leather, skilled in stealth and lockpicking', 'Sneaky Rogue');
    });

    $('#test-npc').on('click', () => {
        testCharacterCreation('A friendly tavern keeper who knows all the local gossip', 'Random NPC');
    });

    $('#test-custom').on('click', () => {
        const customInput = $('#custom-character-input').val().trim();
        if (!customInput) {
            debugLog('No custom input provided', true);
            return;
        }
        testCharacterCreation(customInput, 'Custom Character');
    });

    // Show last captured prompt button
    $('#show-last-prompt-btn').on('click', function() {
        const prompt = getLastCapturedPrompt();

        if (!prompt) {
            toastr.warning('No prompt captured yet. Enable the toggle and generate a field.', 'Character Creator');
            return;
        }

        // Create a modal to display the prompt
        const promptModal = $(`
            <div id="raw-prompt-modal" style="position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; background: rgba(0,0,0,0.8) !important; z-index: 10000 !important; display: flex !important; align-items: center !important; justify-content: center !important;">
                <div style="background: #1a1a1a !important; border: 1px solid #444 !important; border-radius: 8px !important; max-width: 90% !important; max-height: 90% !important; display: flex !important; flex-direction: column !important; box-shadow: 0 4px 20px rgba(0,0,0,0.5) !important; color: #e0e0e0 !important;">
                    <div style="padding: 15px 20px !important; border-bottom: 1px solid #444 !important; display: flex !important; justify-content: space-between !important; align-items: center !important; background: #252525 !important;">
                        <h3 style="margin: 0 !important; font-size: 16px !important; color: #e0e0e0 !important; font-weight: 600 !important;"><i class="fa-solid fa-square-poll-horizontal"></i> Raw Prompt (Sent to LLM)</h3>
                        <div style="display: flex !important; gap: 8px !important;">
                            <button id="copy-raw-prompt-btn" class="menu_button" style="background: #4a90e2 !important; color: white !important; border: none !important; padding: 6px 12px !important; cursor: pointer !important;">
                                <i class="fa-solid fa-copy"></i> Copy
                            </button>
                            <button id="close-raw-prompt-modal" class="menu_button" style="background: #555 !important; color: white !important; border: none !important; padding: 6px 12px !important; cursor: pointer !important;">
                                <i class="fa-solid fa-times"></i> Close
                            </button>
                        </div>
                    </div>
                    <div style="padding: 20px !important; overflow-y: auto !important; flex: 1 !important; background: #1a1a1a !important;">
                        <pre id="raw-prompt-content" style="margin: 0 !important; white-space: pre-wrap !important; word-wrap: break-word !important; font-family: monospace !important; font-size: 12px !important; line-height: 1.5 !important; color: #e0e0e0 !important; background: #1a1a1a !important;">${prompt.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
                    </div>
                </div>
            </div>
        `);

        $('body').append(promptModal);

        // Close button handler
        $('#close-raw-prompt-modal, #raw-prompt-modal').on('click', function(e) {
            if (e.target === this) {
                promptModal.remove();
            }
        });

        // Copy button handler
        $('#copy-raw-prompt-btn').on('click', async function() {
            try {
                await navigator.clipboard.writeText(prompt);
                toastr.success('Prompt copied to clipboard!', 'Character Creator');
            } catch (error) {
                console.error('[Character Creator] Failed to copy prompt:', error);
                toastr.error('Failed to copy to clipboard', 'Character Creator');
            }
        });

        // ESC key to close
        $(document).on('keydown.rawprompt', function(e) {
            if (e.key === 'Escape') {
                promptModal.remove();
                $(document).off('keydown.rawprompt');
            }
        });
    });





    // Store loaded template fields globally for export
    let loadedTemplateFields = [];

    // Template selector
    $('#template-selector').on('change', async function() {
        const templateName = this.value;
        if (!templateName) {
            $('#template-fields-container').html('');
            loadedTemplateFields = [];
            saveCharacterCreatorState(); // Save state when clearing template
            return;
        }

        try {
            toastr.info(`Loading template: ${templateName}...`, 'Character Creator');
            const fields = await loadTemplate(templateName);
            loadedTemplateFields = fields; // Store for export
            renderTemplateFields(fields, 'template-fields-container');

            // Restore saved data for this template
            restoreCurrentTemplateData();

            // Save state (including new template selection)
            saveCharacterCreatorState();

            toastr.success(`Template loaded: ${templateName}`, 'Character Creator');
        } catch (error) {
            console.error('[Character Creator] Failed to load template:', error);
            toastr.error(`Failed to load template: ${error.message}`, 'Character Creator');
        }
    });

    // Enable/disable edit and delete buttons based on template selection
    $('#template-selector').on('change', function() {
        const templateName = $(this).val();
        $('#edit-template-btn').prop('disabled', !templateName);
        $('#delete-template-btn').prop('disabled', !templateName);
    });

    // Helper function to refresh template list
    const refreshTemplateList = async () => {
        const templates = await getAvailableTemplates();
        const selector = $('#template-selector');
        const currentValue = selector.val();

        // Rebuild options
        selector.html('<option value="">-- Select a Template --</option>');
        templates.forEach(name => {
            selector.append(`<option value="${name}">${name.charAt(0).toUpperCase() + name.slice(1)}</option>`);
        });

        // Restore selection if still valid
        if (currentValue && templates.includes(currentValue)) {
            selector.val(currentValue);
        }
    };

    // Refresh templates button
    $('#refresh-templates-btn').on('click', async function() {
        try {
            toastr.info('Refreshing template list...', 'Character Creator');
            await refreshTemplateList();
            toastr.success('Template list refreshed!', 'Character Creator');
        } catch (error) {
            console.error('[Character Creator] Failed to refresh templates:', error);
            toastr.error(`Failed to refresh templates: ${error.message}`, 'Character Creator');
        }
    });

    // Clear WIP data button
    $('#clear-wip-btn').on('click', function() {
        if (confirm('Are you sure you want to clear all saved work-in-progress data? This will reset all fields and cannot be undone.')) {
            // Clear all WIP data from settings
            if (extensionSettings.characterCreator) {
                delete extensionSettings.characterCreator.wipData;
                delete extensionSettings.characterCreator.templateData;
                SillyTavern.getContext().saveSettingsDebounced();
            }

            // Clear all fields in the UI
            $('#template-selector').val('');
            $('#template-fields-container').html('');
            $('#global-control-prompt').val('');

            toastr.success('All work-in-progress data cleared!', 'Character Creator');
        }
    });

    // Edit template button - loads selected template into the editor
    $('#edit-template-btn').on('click', function() {
        const templateName = $('#template-selector').val();
        if (!templateName) {
            toastr.warning('Please select a template to edit', 'Character Creator');
            return;
        }

        try {
            const templateContent = getTemplateContent(templateName);
            if (!templateContent) {
                toastr.error(`Template "${templateName}" not found`, 'Character Creator');
                return;
            }

            // Populate the template editor fields
            $('#new-template-name').val(templateName);
            $('#new-template-content').val(templateContent);

            // Open the template editor details if it's closed
            const detailsElement = $('#new-template-name').closest('details');
            if (detailsElement.length && !detailsElement.prop('open')) {
                detailsElement.prop('open', true);
            }

            // Scroll to the template editor
            $('#new-template-name')[0].scrollIntoView({ behavior: 'smooth', block: 'nearest' });

            toastr.success(`Template "${templateName}" loaded for editing`, 'Character Creator');
        } catch (error) {
            console.error('[Character Creator] Failed to load template for editing:', error);
            toastr.error(`Failed to load template: ${error.message}`, 'Character Creator');
        }
    });

    // Save new template button
    $('#save-new-template-btn').on('click', async function() {
        const templateName = $('#new-template-name').val().trim();
        const templateContent = $('#new-template-content').val().trim();

        if (!templateName) {
            toastr.warning('Please enter a template name', 'Character Creator');
            return;
        }

        if (!templateContent) {
            toastr.warning('Please enter template content', 'Character Creator');
            return;
        }

        // Validate template name (alphanumeric, hyphens, underscores only)
        if (!/^[a-zA-Z0-9_-]+$/.test(templateName)) {
            toastr.error('Template name can only contain letters, numbers, hyphens, and underscores', 'Character Creator');
            return;
        }

        try {
            // Check if we're updating an existing template
            const existingTemplates = await getAvailableTemplates();
            const isUpdate = existingTemplates.includes(templateName);

            // Save template to extension settings (creates new or overwrites existing)
            saveTemplateToSettings(templateName, templateContent);

            // Show appropriate success message
            if (isUpdate) {
                toastr.success(`Template "${templateName}" updated successfully!`, 'Character Creator');
            } else {
                toastr.success(`Template "${templateName}" created successfully!`, 'Character Creator');
            }

            // Refresh the template list
            await refreshTemplateList();

            // If this was the selected template, reload it to show the changes
            if ($('#template-selector').val() === templateName) {
                $('#template-selector').trigger('change');
            }

            // Clear the inputs
            $('#new-template-name').val('');
            $('#new-template-content').val('');

        } catch (error) {
            console.error('[Character Creator] Failed to save template:', error);
            toastr.error(`Failed to save template: ${error.message}`, 'Character Creator');
        }
    });

    // Export character button
    $('#export-character-btn').on('click', function() {
        try {
            if (!loadedTemplateFields || loadedTemplateFields.length === 0) {
                toastr.warning('Please load a template first', 'Character Creator');
                return;
            }

            // Find the character name from the first field with "name" in it (case-insensitive)
            let characterName = 'Unnamed Character';
            for (let i = 0; i < loadedTemplateFields.length; i++) {
                const field = loadedTemplateFields[i];
                if (field.name.toLowerCase().includes('name')) {
                    const fieldOutput = $(`#field-${i}-output`).val();
                    if (fieldOutput && fieldOutput.trim()) {
                        characterName = fieldOutput.trim();
                        break;
                    }
                }
            }

            // Start building the export text
            let exportText = `NPC - ${characterName}:[\n`;

            // Use the loaded template fields to get original field names
            loadedTemplateFields.forEach((field, index) => {
                const fieldOutput = $(`#field-${index}-output`).val();

                if (fieldOutput && fieldOutput.trim()) {
                    exportText += `**${field.name}:**\n`;
                    exportText += `*${fieldOutput.trim()}*\n`;

                    // Add blank line between fields (but not after the last one)
                    if (index < loadedTemplateFields.length - 1) {
                        // Check if there are more non-empty fields after this
                        let hasMoreFields = false;
                        for (let i = index + 1; i < loadedTemplateFields.length; i++) {
                            if ($(`#field-${i}-output`).val()?.trim()) {
                                hasMoreFields = true;
                                break;
                            }
                        }
                        if (hasMoreFields) {
                            exportText += '\n';
                        }
                    }
                }
            });

            // Close the export text
            exportText += '\n]';

            // Put the result in the text box
            $('#exported-character-text').val(exportText);

            toastr.success('Character exported successfully!', 'Character Creator');
        } catch (error) {
            console.error('[Character Creator] Failed to export character:', error);
            toastr.error(`Failed to export character: ${error.message}`, 'Character Creator');
        }
    });

    // Copy exported character to clipboard button
    $('#copy-exported-character-btn').on('click', async function() {
        const exportedText = $('#exported-character-text').val();

        if (!exportedText || !exportedText.trim()) {
            toastr.warning('Nothing to copy. Export a character first.', 'Character Creator');
            return;
        }

        try {
            await navigator.clipboard.writeText(exportedText);
            toastr.success('Character copied to clipboard!', 'Character Creator');
        } catch (error) {
            console.error('[Character Creator] Failed to copy to clipboard:', error);

            // Fallback: select the text so user can manually copy
            const textarea = document.getElementById('exported-character-text');
            textarea.select();
            textarea.setSelectionRange(0, 99999); // For mobile devices

            try {
                document.execCommand('copy');
                toastr.success('Character copied to clipboard!', 'Character Creator');
            } catch (fallbackError) {
                toastr.error('Failed to copy to clipboard. Please copy manually.', 'Character Creator');
            }
        }
    });

    // Delete template button
    $('#delete-template-btn').on('click', async function() {
        const templateName = $('#template-selector').val();

        if (!templateName) {
            return;
        }

        // Show confirmation dialog
        const confirmHtml = `
            <div style="padding: 20px; text-align: center;">
                <div style="font-size: 48px; color: #d9534f; margin-bottom: 15px;">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                </div>
                <h3 style="margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">
                    Delete Template?
                </h3>
                <p style="margin: 0 0 20px 0; font-size: 14px; opacity: 0.9;">
                    Are you sure you want to delete the template "<strong>${templateName}</strong>"?
                </p>
                <p style="margin: 0 0 20px 0; font-size: 13px; opacity: 0.7; font-style: italic;">
                    This action cannot be undone.
                </p>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button id="confirm-delete-yes" class="menu_button" style="background: #d9534f; color: white; padding: 8px 20px;">
                        <i class="fa-solid fa-trash"></i> Delete
                    </button>
                    <button id="confirm-delete-no" class="menu_button" style="padding: 8px 20px;">
                        <i class="fa-solid fa-times"></i> Cancel
                    </button>
                </div>
            </div>
        `;

        const confirmDialog = $(`
            <div id="delete-template-confirm" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;">
                <div style="background: var(--SmartThemeBodyColor); border-radius: 8px; max-width: 400px; width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
                    ${confirmHtml}
                </div>
            </div>
        `);

        $('body').append(confirmDialog);

        // Handle confirmation
        $('#confirm-delete-yes').on('click', async function() {
            confirmDialog.remove();

            try {
                // Delete from settings
                const deleted = deleteTemplateFromSettings(templateName);

                if (deleted) {
                    toastr.success(`Template "${templateName}" deleted successfully!`, 'Character Creator');

                    // Refresh the template list
                    await refreshTemplateList();

                    // Clear selection and fields
                    $('#template-selector').val('');
                    $('#template-fields-container').html('');
                    $('#delete-template-btn').prop('disabled', true);
                } else {
                    toastr.warning(`Template "${templateName}" not found`, 'Character Creator');
                }
            } catch (error) {
                console.error('[Character Creator] Failed to delete template:', error);
                toastr.error(`Failed to delete template: ${error.message}`, 'Character Creator');
            }
        });

        $('#confirm-delete-no').on('click', function() {
            confirmDialog.remove();
        });

        // Close on background click
        confirmDialog.on('click', function(e) {
            if (e.target === this) {
                confirmDialog.remove();
            }
        });
    });

    // Close function
    const closeModal = () => {
        // Save state before closing
        saveCharacterCreatorState();

        $('#rpg-character-creator-modal').removeClass('is-open');
        setTimeout(() => {
            $('#rpg-character-creator-modal').remove();
            // Remove escape key handler
            $(document).off('keydown.characterCreator');
            // Remove autosave listeners for template fields
            $(document).off('input change', '.rpg-field-output, .rpg-field-guidance');
        }, 200);
    };

    // Close handlers
    $('#close-creator-modal').on('click', closeModal);

    // Close on backdrop click (clicking outside content)
    $('#rpg-character-creator-modal').on('click', function(e) {
        if (e.target === this) {
            closeModal();
        }
    });

    // Close on Escape key
    $(document).on('keydown.characterCreator', function(e) {
        if (e.key === 'Escape') {
            closeModal();
        }
    });

    // Copy output button
    $('#copy-output-btn').on('click', function() {
        const output = exportFieldsAsText();
        if (output && output.trim()) {
            navigator.clipboard.writeText(output).then(() => {
                toastr.success('Character card copied to clipboard!', 'Character Creator');
            }).catch(err => {
                toastr.error('Failed to copy: ' + err.message, 'Character Creator');
            });
        } else {
            toastr.warning('No fields generated yet', 'Character Creator');
        }
    });

    // Clear Fields button
    $('#clear-template-fields-btn').on('click', function() {
        clearTemplateFields();
    });

    // Auto-save on persistent field changes
    $('#global-control-prompt').on('input', saveCharacterCreatorState);
    $('#profile-selector').on('change', saveCharacterCreatorState);

    // Auto-save template fields (delegated event for dynamically created fields)
    $(document).on('input', '.rpg-field-output, .rpg-field-guidance, .rpg-field-max-tokens', saveCharacterCreatorState);

    // Restore saved state after modal is fully initialized
    setTimeout(() => {
        restoreCharacterCreatorState();
    }, 100);

    debugLog('Character Creator modal initialized');
}

/**
 * Adds the character creator button to the UI
 */
export function setupCharacterCreatorButton() {
    // Check if button already exists
    if ($('#rpg-character-creator-button').length > 0) {
        return;
    }
    
    // Add button next to encounter button
    const buttonHtml = `
        <button id="rpg-character-creator-button" class="menu_button interactable rpg-character-creator-btn" tabindex="0" role="button" title="Create a new character with AI">
            <i class="fa-solid fa-user-plus"></i> <span class="rpg-btn-text">Create Character</span>
        </button>
    `;
    
    // Insert after encounter button
    $('#rpg-encounter-button').after(buttonHtml);
    
    // Add click handler
    $('#rpg-character-creator-button').on('click', openCharacterCreatorModal);
    
    console.log('[Character Creator] ✅ Button added to UI');
}

