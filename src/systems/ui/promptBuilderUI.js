/**
 * Prompt Builder UI
 * 
 * Central configuration UI for the modular prompt system.
 * Provides UI controls for managing prompt sections, profiles, and generation settings.
 */

import { createPromptBuilder } from '../generation/modular-prompt-system/index.js';
import { Section } from '../generation/modular-prompt-system/section.js';
import { extensionSettings } from '../../core/state.js';
import { getContext } from '../../../../../../extensions.js';

let currentBuilder = null;
let currentComponent = 'thoughtBubble';

/**
 * Initialize the prompt builder UI
 */
export function initPromptBuilderUI() {
    try {
        // Open button in settings
        $('#rpg-open-prompt-builder-ui').on('click', () => {
            openPromptBuilderUI();
        });

        // Close buttons
        $('#rpg-close-prompt-builder, #rpg-pb-close').on('click', () => {
            closePromptBuilderUI();
        });

        // Component selector
        $('#rpg-pb-component-select').on('change', async () => {
            const newComponent = $('#rpg-pb-component-select').val();
            await switchComponent(newComponent);
        });

        // Profile management
        $('#rpg-pb-profile-select').on('change', () => {
            loadSelectedProfile();
        });

        $('#rpg-pb-save-profile').on('click', () => {
            saveAsProfile();
        });

        $('#rpg-pb-delete-profile').on('click', () => {
            deleteSelectedProfile();
        });

        // Generation settings
        $('#rpg-pb-max-tokens').on('change', () => {
            if (currentBuilder) {
                currentBuilder.setMaxTokens(parseInt($('#rpg-pb-max-tokens').val()));
            }
        });

        $('#rpg-pb-profile-select-dropdown').on('change', () => {
            if (currentBuilder) {
                const profileId = $('#rpg-pb-profile-select-dropdown').val() || null;
                currentBuilder.setProfileId(profileId);
            }
        });

        $('#rpg-pb-chat-context-depth').on('change', async () => {
            if (currentBuilder) {
                currentBuilder.setChatContextDepth(parseInt($('#rpg-pb-chat-context-depth').val()));
                // Refresh preview will update chat context and re-render sections
                refreshPreview();
            }
        });

        // Add section button
        $('#rpg-pb-add-section').on('click', () => {
            addNewSection();
        });

        // Preview refresh
        $('#rpg-pb-refresh-preview').on('click', () => {
            refreshPreview();
        });

        // Test generate
        $('#rpg-pb-test-generate').on('click', () => {
            testGenerate();
        });

        console.log('[RPG Companion] Prompt Builder UI initialized');
    } catch (error) {
        console.error('[RPG Companion] Failed to initialize Prompt Builder UI:', error);
        throw error;
    }
}

/**
 * Open the prompt builder UI
 */
async function openPromptBuilderUI() {
    // Initialize with default component
    await switchComponent(currentComponent);

    // Show modal
    $('#rpg-prompt-builder-popup').addClass('is-open');
}

/**
 * Close the prompt builder UI
 */
function closePromptBuilderUI() {
    $('#rpg-prompt-builder-popup').removeClass('is-open');
}

/**
 * Switch to a different component
 */
async function switchComponent(componentKey) {
    currentComponent = componentKey;

    // Create or load builder for this component
    currentBuilder = createPromptBuilder(extensionSettings, componentKey);

    // Initialize defaults if needed
    await initializeComponentDefaults(componentKey);

    // Update UI
    updateGenerationSettings();
    updateProfilesList();
    renderSections();
    refreshPreview();
}

/**
 * Initialize default sections for a component if not already initialized
 */
async function initializeComponentDefaults(componentKey) {
    const defaults = getDefaultSections(componentKey);
    currentBuilder.initializeDefaults(defaults);

    // Migrate existing configurations to add missing default sections
    await migrateComponentDefaults(componentKey);

    // Ensure chat context section exists (it's a special system section)
    await ensureChatContextSection();

    // Ensure tracker sections exist (they're special system sections)
    ensureTrackerSections();

    // Ensure guidance section exists (it's a special system section)
    ensureGuidanceSection();
}

/**
 * Migrate existing component configurations to add missing default sections
 * This ensures that when we add new default sections, they get added to existing configs
 */
async function migrateComponentDefaults(componentKey) {
    const defaults = getDefaultSections(componentKey);
    const { Section } = await import('../generation/modular-prompt-system/section.js');

    // Check each default section and add if missing
    defaults.forEach(defaultSection => {
        const existingSection = currentBuilder.getSection(defaultSection.id);

        // If section doesn't exist and it's not a system section (those are handled separately)
        if (!existingSection && !defaultSection.id.startsWith('__system_')) {
            console.log(`[PromptBuilderUI] Migrating: Adding missing section '${defaultSection.id}' to ${componentKey}`);
            const section = new Section(defaultSection);
            currentBuilder.addSection(section);
        }
    });
}

/**
 * Ensure the chat context section exists and is up to date
 * This is a special system section that can't be deleted
 * It dynamically updates its content based on the chat context depth setting
 */
async function ensureChatContextSection() {
    const CHAT_CONTEXT_ID = '__system_chat_context__';
    const { getChatContext } = await import('../generation/contextBuilder.js');

    // Get current depth setting
    const chatDepth = currentBuilder.getChatContextDepth();

    // Build chat context content
    let chatContent = '';
    if (chatDepth > 0) {
        chatContent = getChatContext(chatDepth, {
            includeNames: true,
            filterEmpty: true
        }) || '';
    }

    let chatSection = currentBuilder.getSection(CHAT_CONTEXT_ID);

    if (!chatSection) {
        // Create the chat context section
        const { Section } = await import('../generation/modular-prompt-system/section.js');
        chatSection = new Section({
            id: CHAT_CONTEXT_ID,
            content: chatContent,
            priority: 50,
            enabled: chatDepth > 0,
            label: '💬 Chat Context (System)',
            description: `Includes last ${chatDepth} messages from chat (controlled by depth setting)`
        });
        currentBuilder.addSection(chatSection);
    } else {
        // Update existing section
        chatSection.setContent(chatContent);
        chatSection.setEnabled(chatDepth > 0);
        chatSection.description = `Includes last ${chatDepth} messages from chat (controlled by depth setting)`;
    }

    currentBuilder.save();
}

/**
 * Ensure tracker sections exist and are up to date
 * These are special system sections that can't be deleted
 * They dynamically update their content based on tracker data
 */
function ensureTrackerSections() {
    currentBuilder.updateTrackerSections();
}

/**
 * Ensure the guidance section exists
 * This is a special system section that can't be deleted
 * It dynamically updates its content when user provides guidance during generation
 */
function ensureGuidanceSection() {
    const GUIDANCE_ID = '__system_guidance__';

    let guidanceSection = currentBuilder.getSection(GUIDANCE_ID);

    if (!guidanceSection) {
        // Create the guidance section
        guidanceSection = new Section({
            id: GUIDANCE_ID,
            content: '',
            priority: 0, // Lowest priority - appears at the end
            enabled: false,
            label: '✨ User Guidance (System)',
            description: 'Special instructions provided by the user for this generation. Updated automatically when you click "Test Generate".'
        });
        currentBuilder.addSection(guidanceSection);
    }

    currentBuilder.save();
}

/**
 * Default instruction prompts from the Response Token Settings
 * These are the same prompts users can edit in the token settings modal
 */
const DEFAULT_INSTRUCTION_PROMPTS = {
    userStats: 'You are updating the User Stats section based on the recent narrative. Consider the user\'s actions, time passage, and logical consequences. Manage stat values realistically: 0% change if only minutes passed, 1-5% for normal changes, above 5% only for major events or time-skips. Update mood emoji, conditions, inventory, and skills to reflect the current situation. Replace all [placeholders] with actual values - no brackets in your response. When finished, output exactly: ###TRACKER_END###',
    infoBox: 'You are updating the Environment Box with brief, factual details about the current scene. Keep ALL fields concise:\n- Date: Just the weekday, month, and year (e.g., "Monday, June 15, 2023")\n- Weather: Single emoji + 1-2 word forecast (e.g., "☀️ Clear" or "🌧️ Light Rain")\n- Temperature: Just the number and unit (e.g., "72°F")\n- Time: Simple time range (e.g., "2:00 PM → 3:30 PM")\n- Location: Single short phrase, no descriptions (e.g., "Central Park" or "Coffee Shop Downtown")\n- Recent Events: Up to three SHORT single-line descriptors with NO details (e.g., "morning jog", "lunch with Sarah", "argument at work")\n\nDo NOT write paragraphs or elaborate descriptions. Keep everything to single lines. Replace all [placeholders] with actual brief content - no brackets in your response. When finished, output exactly: ###TRACKER_END###',
    presentCharacters: 'You are updating the Present Characters section based on who is currently in the scene. For each character present (excluding the user), provide: name, emoji, appearance/current action, relationship type, stats (if applicable), and internal thoughts in first-person POV (2-3 sentences). Infer characters from the narrative context. If no other characters are present, state "Unavailable". Keep thoughts authentic to each character\'s personality and emotional state. Replace all [placeholders] with actual content - no brackets in your response. When finished, output exactly: ###TRACKER_END###',
    characterField: 'Task: Generate an updated value for the specified character field based on the current scene, conversation context, and character information provided above. Keep the response concise and appropriate for the field type. Provide only the new value for the field, without any additional commentary, formatting, or explanation.',
    thoughtBubble: 'Task: Generate updated internal thoughts for this character in first-person POV (2-3 sentences maximum). The thoughts should reflect their current emotional state, personality, and the situation they\'re in based on the scene context. Keep it authentic to the character. Provide only the thoughts text, without any additional commentary or formatting.',
    characterCard: 'Task: Generate updated data for the character based on the current scene, conversation context, and character information provided above. Follow the user\'s guidance (if provided) while keeping the character consistent with the roleplay context. Provide the updated character data in the exact format specified, including emoji, relationship, all enabled fields, stats (if applicable), and thoughts. Replace all [placeholders] with actual content - no brackets in your response. Provide only the character data in the exact format shown. Do not include any additional commentary or explanation.',
    characterEditor: 'Task: Generate updated data for the character based on the current scene, conversation context, and character information provided above. Follow the user\'s guidance (if provided) while keeping the character consistent with the roleplay context. Provide the updated character data in the exact format specified, including emoji, relationship, all enabled fields, stats (if applicable), and thoughts. Replace all [placeholders] with actual content - no brackets in your response. Provide only the character data in the exact format shown. Do not include any additional commentary or explanation.'
};

/**
 * Get default sections for a component
 */
function getDefaultSections(componentKey) {
    const defaults = {
        // Thought Bubble - Individual thought regeneration
        thoughtBubble: [
            {
                id: 'system',
                content: 'You are a helpful assistant that generates character thoughts. Respond with ONLY the thought itself, no preamble or explanation.',
                priority: 100,
                label: 'System Prompt',
                description: 'Base system instruction'
            },
            {
                id: 'instruction',
                content: DEFAULT_INSTRUCTION_PROMPTS.thoughtBubble,
                priority: 80,
                label: 'Instruction',
                description: 'Main generation instruction'
            }
        ],

        // User Stats - Tracker section regeneration
        userStats: [
            {
                id: 'system',
                content: 'You are a helpful assistant that generates RPG user stats based on the current story context.',
                priority: 100,
                label: 'System Prompt',
                description: 'Base system instruction'
            },
            {
                id: 'instruction',
                content: DEFAULT_INSTRUCTION_PROMPTS.userStats,
                priority: 80,
                label: 'Instruction',
                description: 'Main generation instruction'
            }
        ],

        // Info Box - Tracker section regeneration
        infoBox: [
            {
                id: 'system',
                content: 'You are a helpful assistant that generates environment and location information for RPG scenes.',
                priority: 100,
                label: 'System Prompt',
                description: 'Base system instruction'
            },
            {
                id: 'instruction',
                content: DEFAULT_INSTRUCTION_PROMPTS.infoBox,
                priority: 80,
                label: 'Instruction',
                description: 'Main generation instruction'
            }
        ],

        // Present Characters - Tracker section regeneration
        presentCharacters: [
            {
                id: 'system',
                content: 'You are a helpful assistant that generates character information for RPG scenes.',
                priority: 100,
                label: 'System Prompt',
                description: 'Base system instruction'
            },
            {
                id: 'instruction',
                content: DEFAULT_INSTRUCTION_PROMPTS.presentCharacters,
                priority: 80,
                label: 'Instruction',
                description: 'Main generation instruction'
            }
        ],

        // Character Card - Full character regeneration from card
        characterCard: [
            {
                id: 'system',
                content: 'You are a helpful assistant that generates complete character information for RPG characters.',
                priority: 100,
                label: 'System Prompt',
                description: 'Base system instruction'
            },
            {
                id: 'instruction',
                content: DEFAULT_INSTRUCTION_PROMPTS.characterCard,
                priority: 80,
                label: 'Instruction',
                description: 'Main generation instruction'
            }
        ],

        // Character Editor - Full character regeneration in editor
        characterEditor: [
            {
                id: 'system',
                content: 'You are a helpful assistant that generates complete character information for RPG characters.',
                priority: 100,
                label: 'System Prompt',
                description: 'Base system instruction'
            },
            {
                id: 'instruction',
                content: DEFAULT_INSTRUCTION_PROMPTS.characterEditor,
                priority: 80,
                label: 'Instruction',
                description: 'Main generation instruction'
            }
        ],

        // Character Field - Individual field regeneration in editor
        characterField: [
            {
                id: 'system',
                content: 'You are a helpful assistant that generates specific character field information for RPG characters.',
                priority: 100,
                label: 'System Prompt',
                description: 'Base system instruction'
            },
            {
                id: 'instruction',
                content: DEFAULT_INSTRUCTION_PROMPTS.characterField,
                priority: 80,
                label: 'Instruction',
                description: 'Main generation instruction'
            }
        ]
    };

    return defaults[componentKey] || [];
}

/**
 * Get the default instruction prompt for a component
 * Used by the "Restore Default" button
 */
function getDefaultInstructionPrompt(componentKey) {
    return DEFAULT_INSTRUCTION_PROMPTS[componentKey] || '';
}

/**
 * Update generation settings UI from builder
 */
function updateGenerationSettings() {
    if (!currentBuilder) return;

    $('#rpg-pb-max-tokens').val(currentBuilder.getMaxTokens());
    $('#rpg-pb-chat-context-depth').val(currentBuilder.getChatContextDepth());

    // Populate connection profile dropdown
    const context = getContext();
    const profiles = context.extensionSettings?.connectionManager?.profiles || [];
    const $dropdown = $('#rpg-pb-profile-select-dropdown');
    const currentProfileId = currentBuilder.getProfileId();

    // Clear and rebuild dropdown
    $dropdown.empty();
    $dropdown.append('<option value="">Active Profile (Default)</option>');

    profiles.forEach(profile => {
        const option = $('<option></option>')
            .val(profile.id)
            .text(profile.name || profile.id);
        $dropdown.append(option);
    });

    // Set selected value
    $dropdown.val(currentProfileId || '');
}

/**
 * Update profiles list
 */
function updateProfilesList() {
    if (!currentBuilder) return;

    const profiles = currentBuilder.getProfiles();
    const $select = $('#rpg-pb-profile-select');

    // Clear and rebuild
    $select.empty();
    $select.append('<option value="">Default</option>');

    profiles.forEach(profileName => {
        $select.append(`<option value="${profileName}">${profileName}</option>`);
    });
}

/**
 * Load selected profile
 */
function loadSelectedProfile() {
    if (!currentBuilder) return;

    const profileName = $('#rpg-pb-profile-select').val();

    if (profileName) {
        const success = currentBuilder.loadProfile(profileName);
        if (success) {
            toastr.success(`Loaded profile: ${profileName}`, 'Prompt Builder');
            updateGenerationSettings();
            renderSections();
            refreshPreview();
        } else {
            toastr.error(`Failed to load profile: ${profileName}`, 'Prompt Builder');
        }
    }
}

/**
 * Save current state as a new profile
 */
function saveAsProfile() {
    if (!currentBuilder) return;

    const profileName = prompt('Enter profile name:');
    if (profileName && profileName.trim()) {
        currentBuilder.saveAsProfile(profileName.trim());
        updateProfilesList();
        $('#rpg-pb-profile-select').val(profileName.trim());
        toastr.success(`Saved profile: ${profileName}`, 'Prompt Builder');
    }
}

/**
 * Delete selected profile
 */
function deleteSelectedProfile() {
    if (!currentBuilder) return;

    const profileName = $('#rpg-pb-profile-select').val();

    if (!profileName) {
        toastr.warning('Cannot delete default profile', 'Prompt Builder');
        return;
    }

    if (confirm(`Delete profile "${profileName}"?`)) {
        const success = currentBuilder.deleteProfile(profileName);
        if (success) {
            updateProfilesList();
            $('#rpg-pb-profile-select').val('');
            toastr.success(`Deleted profile: ${profileName}`, 'Prompt Builder');
        } else {
            toastr.error(`Failed to delete profile: ${profileName}`, 'Prompt Builder');
        }
    }
}

/**
 * Render all sections
 */
function renderSections() {
    if (!currentBuilder) return;

    const $container = $('#rpg-pb-sections-container');
    $container.empty();

    // Get all sections sorted by priority
    const sections = currentBuilder.assembler.sections.getSorted(false);

    sections.forEach(section => {
        const $sectionEl = createSectionElement(section);
        $container.append($sectionEl);
    });
}

/**
 * Create a section UI element
 */
function createSectionElement(section) {
    const isSystemSection = section.id.startsWith('__system_');
    const isInstructionSection = section.id === 'instruction';

    // For system sections, show a read-only preview of content
    const contentPreview = isSystemSection && section.content
        ? section.content.substring(0, 200) + (section.content.length > 200 ? '...' : '')
        : section.content;

    const contentHtml = isSystemSection
        ? `<div class="rpg-pb-section-content-readonly" style="width: 100%; margin-top: 5px; padding: 10px; background: rgba(0,0,0,0.1); border-radius: 5px; font-family: monospace; font-size: 11px; color: #888; min-height: 60px;">
               ${section.content ? `<em>Auto-generated (${section.content.length} chars)</em><br/>${contentPreview.replace(/\n/g, '<br/>')}` : '<em>No chat context (depth = 0 or no messages)</em>'}
           </div>`
        : `<textarea class="rpg-pb-section-content rpg-input" rows="4" style="width: 100%; margin-top: 5px; font-family: monospace; font-size: 12px;">${section.content}</textarea>`;

    // Determine which button to show: Restore Default for instruction, Delete for others (except system)
    let actionButton = '';
    if (isInstructionSection) {
        actionButton = `<button class="rpg-pb-section-restore rpg-btn-secondary" style="margin-left: 10px;" title="Restore to default instruction prompt">
            <i class="fa-solid fa-undo"></i> Restore Default
        </button>`;
    } else if (!isSystemSection) {
        actionButton = `<button class="rpg-pb-section-delete rpg-btn-secondary" style="margin-left: 10px;">
            <i class="fa-solid fa-trash"></i>
        </button>`;
    }

    const $section = $(`
        <div class="rpg-pb-section ${isSystemSection ? 'rpg-pb-section-system' : ''}" data-section-id="${section.id}">
            <div class="rpg-pb-section-header">
                <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                    <label class="checkbox_label" style="margin: 0;">
                        <input type="checkbox" class="rpg-pb-section-enabled" ${section.enabled ? 'checked' : ''} />
                        <span></span>
                    </label>
                    <input type="text" class="rpg-pb-section-label rpg-input" value="${section.label}" style="flex: 1;" ${isSystemSection ? 'readonly' : ''} />
                    <label style="margin: 0; display: flex; align-items: center; gap: 5px;">
                        Priority:
                        <input type="number" class="rpg-pb-section-priority rpg-input" value="${section.priority}" style="width: 80px;" />
                    </label>
                </div>
                ${actionButton}
            </div>
            ${contentHtml}
            <small style="display: block; margin-top: 5px; color: #888;">${section.description || 'No description'}</small>
        </div>
    `);

    // Event handlers
    $section.find('.rpg-pb-section-enabled').on('change', function() {
        const isEnabled = $(this).prop('checked');
        section.setEnabled(isEnabled);

        // If this is a tracker section, also update the tracker toggle setting
        if (section.id.startsWith('__system_tracker_')) {
            const trackerType = section.id.replace('__system_tracker_', '').replace('__', '');
            // Map section IDs to tracker types
            const trackerTypeMap = {
                'userstats': 'userStats',
                'infobox': 'infoBox',
                'thoughts': 'characterThoughts',
                'inventory': 'inventory',
                'quests': 'quests'
            };
            const mappedType = trackerTypeMap[trackerType];
            if (mappedType) {
                currentBuilder.setTrackerToggle(mappedType, isEnabled);
            }
        }

        currentBuilder.save();
        refreshPreview(true); // Skip render since we're already in render cycle
    });

    // Only allow label editing for non-system sections
    if (!isSystemSection) {
        $section.find('.rpg-pb-section-label').on('change', function() {
            section.label = $(this).val();
            currentBuilder.save();
        });
    }

    $section.find('.rpg-pb-section-priority').on('change', function() {
        section.setPriority(parseInt($(this).val()));
        currentBuilder.save();
        renderSections(); // Re-render to update order
        refreshPreview(true); // Skip render since we just called renderSections
    });

    // Only allow content editing for non-system sections
    if (!isSystemSection) {
        $section.find('.rpg-pb-section-content').on('change', function() {
            section.setContent($(this).val());
            currentBuilder.save();
            refreshPreview(true); // Skip render since we're already in render cycle
        });
    }

    // Add restore handler for instruction section
    if (isInstructionSection) {
        $section.find('.rpg-pb-section-restore').on('click', function() {
            const defaultPrompt = getDefaultInstructionPrompt(currentComponent);
            if (defaultPrompt) {
                if (confirm('Restore instruction to default prompt from Response Token Settings?')) {
                    section.setContent(defaultPrompt);
                    currentBuilder.save();
                    renderSections();
                    refreshPreview();
                    toastr.success('Instruction restored to default');
                }
            } else {
                toastr.warning('No default instruction available for this component');
            }
        });
    }

    // Only add delete handler for non-system, non-instruction sections
    if (!isSystemSection && !isInstructionSection) {
        $section.find('.rpg-pb-section-delete').on('click', function() {
            if (confirm(`Delete section "${section.label}"?`)) {
                currentBuilder.removeSection(section.id);
                currentBuilder.save();
                renderSections();
                refreshPreview();
            }
        });
    }

    return $section;
}

/**
 * Add a new section
 */
function addNewSection() {
    if (!currentBuilder) return;

    const newSection = new Section({
        id: `section_${Date.now()}`,
        content: '',
        priority: 50,
        label: 'New Section',
        description: '',
        enabled: true
    });

    currentBuilder.addSection(newSection);
    renderSections();
    refreshPreview();
}

/**
 * Refresh preview
 * This also updates dynamic sections (like chat context and trackers) with fresh data
 */
function refreshPreview(skipRender = false) {
    if (!currentBuilder) return;

    // Build the prompt - this updates chat context and tracker sections
    const prompt = currentBuilder.build();
    const preview = currentBuilder.assembler.preview();

    $('#rpg-pb-preview').val(prompt);
    $('#rpg-pb-preview-stats').text(
        `${preview.enabledSections}/${preview.totalSections} sections enabled | ${prompt.length} characters`
    );

    // Re-render sections to show updated content (especially for system sections)
    // Skip if we're already in a render cycle to avoid infinite loops
    if (!skipRender) {
        renderSections();
    }
}

/**
 * Test generate
 */
async function testGenerate() {
    if (!currentBuilder) return;

    // Show guidance modal
    showGenerationGuidanceModal(async (guidance) => {
        try {
            toastr.info('Testing generation...', 'Prompt Builder', { timeOut: 0 });

            const response = await currentBuilder.generate({ guidance });

            toastr.clear();
            toastr.success('Generation successful!', 'Prompt Builder');

            // Show response in a dialog
            alert(`Generated Response:\n\n${response}`);
        } catch (error) {
            toastr.clear();
            toastr.error(`Generation failed: ${error.message}`, 'Prompt Builder');
            console.error('[Prompt Builder] Test generation error:', error);
        }
    });
}

/**
 * Show guidance modal for generation
 * @param {Function} callback - Callback function that receives the guidance text
 */
function showGenerationGuidanceModal(callback) {
    const modalHtml = `
        <div id="rpg-pb-guidance-modal" class="rpg-settings-popup is-open" role="dialog" aria-modal="true">
            <div class="rpg-settings-popup-content" style="max-width: 600px;">
                <header class="rpg-settings-popup-header">
                    <h3>
                        <i class="fa-solid fa-wand-magic-sparkles"></i>
                        <span>Test Generation</span>
                    </h3>
                    <button id="rpg-pb-guidance-close" class="rpg-popup-close" type="button">&times;</button>
                </header>

                <div class="rpg-settings-popup-body">
                    <p style="margin-bottom: 12px; color: var(--SmartThemeBodyColor);">
                        Provide optional guidance for the AI generation
                    </p>
                    <div style="margin-bottom: 16px;">
                        <textarea id="rpg-pb-guidance-input" class="rpg-textarea" rows="4"
                                  placeholder="e.g., Focus on action, add more detail, make it dramatic, etc."
                                  style="width: 100%; padding: 10px; border-radius: 5px; border: 1px solid var(--SmartThemeBorderColor);
                                         background: var(--SmartThemeBlurTintColor); color: var(--SmartThemeBodyColor);
                                         resize: vertical; font-family: inherit;"></textarea>
                        <p style="font-size: 12px; color: #888; margin-top: 4px;">
                            Leave empty to generate without specific guidance. Your input will be added to the prompt.
                        </p>
                    </div>
                </div>

                <footer class="rpg-settings-popup-footer">
                    <button id="rpg-pb-guidance-cancel" class="rpg-btn-secondary" type="button">Cancel</button>
                    <button id="rpg-pb-guidance-confirm" class="rpg-btn-primary" type="button">
                        <i class="fa-solid fa-wand-magic-sparkles"></i> Generate
                    </button>
                </footer>
            </div>
        </div>
    `;

    // Remove existing modal if present
    $('#rpg-pb-guidance-modal').remove();

    // Add modal to body
    $('body').append(modalHtml);

    // Focus on input
    setTimeout(() => $('#rpg-pb-guidance-input').focus(), 100);

    // Event handlers
    $('#rpg-pb-guidance-close, #rpg-pb-guidance-cancel').on('click', () => {
        $('#rpg-pb-guidance-modal').removeClass('is-open');
        setTimeout(() => $('#rpg-pb-guidance-modal').remove(), 200);
    });

    $('#rpg-pb-guidance-confirm').on('click', () => {
        const guidance = $('#rpg-pb-guidance-input').val().trim();

        // Close modal
        $('#rpg-pb-guidance-modal').removeClass('is-open');
        setTimeout(() => $('#rpg-pb-guidance-modal').remove(), 200);

        // Call callback with guidance
        callback(guidance);
    });

    // Ctrl+Enter to confirm
    $('#rpg-pb-guidance-input').on('keydown', (e) => {
        if (e.ctrlKey && e.which === 13) {
            $('#rpg-pb-guidance-confirm').click();
        }
    });
}

