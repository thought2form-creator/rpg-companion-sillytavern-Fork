/**
 * Encounter Profiles UI
 *
 * Provides UI for managing encounter profiles (combat, social, stealth, etc.)
 * Allows users to create, edit, delete, and import/export custom profiles.
 */

import { getContext } from '../../../../../../extensions.js';
import { extensionSettings } from '../../core/state.js';
import { saveSettings } from '../../core/persistence.js';
import {
    getActiveProfile,
    getAllProfiles,
    getProfileById,
    createProfile,
    updateProfile,
    deleteProfile,
    setActiveProfile,
    exportProfile,
    importProfile,
    PRESET_PROFILES,
    DEFAULT_COMBAT_PROFILE,
    validateProfile
} from '../features/encounterProfiles.js';
import { DEFAULT_PROMPTS } from './promptsEditor.js';

let currentEditingProfileId = null;
let currentPreviewProfileId = null;

/**
 * Injects encounter profile variables into a prompt template
 * @param {string} template - The prompt template with {VARIABLE} placeholders
 * @param {Object} profile - The encounter profile
 * @returns {string} The prompt with variables replaced
 */
function injectProfileVariables(template, profile) {
    if (!template || !profile) return template || '';

    return template
        .replace(/{ENCOUNTER_TYPE}/g, profile.ENCOUNTER_TYPE || '')
        .replace(/{ENCOUNTER_GOAL}/g, profile.ENCOUNTER_GOAL || '')
        .replace(/{ENCOUNTER_STAKES}/g, profile.ENCOUNTER_STAKES || '')
        .replace(/{RESOURCE_INTERPRETATION}/g, profile.RESOURCE_INTERPRETATION || '')
        .replace(/{ACTION_INTERPRETATION}/g, profile.ACTION_INTERPRETATION || '')
        .replace(/{STATUS_INTERPRETATION}/g, profile.STATUS_INTERPRETATION || '')
        .replace(/{SUMMARY_FRAMING}/g, profile.SUMMARY_FRAMING || '');
}

/**
 * Check if a prompt template contains profile variable placeholders
 * @param {string} template - The prompt template to check
 * @returns {boolean} True if the template contains profile variables
 */
function hasProfileVariables(template) {
    if (!template) return false;
    const profileVars = [
        '{ENCOUNTER_TYPE}',
        '{ENCOUNTER_GOAL}',
        '{ENCOUNTER_STAKES}',
        '{RESOURCE_INTERPRETATION}',
        '{ACTION_INTERPRETATION}',
        '{STATUS_INTERPRETATION}',
        '{SUMMARY_FRAMING}'
    ];
    return profileVars.some(v => template.includes(v));
}

/**
 * Initialize the encounter profiles UI
 */
export function initEncounterProfilesUI() {
    try {
        // Open button in settings
        $('#rpg-open-encounter-profiles').on('click', () => {
            openEncounterProfilesUI();
        });

        // Close buttons
        $('#rpg-close-encounter-profiles, #rpg-ep-close').on('click', () => {
            closeEncounterProfilesUI();
        });

        // Profile list actions
        $('#rpg-ep-profiles-list').on('click', '.rpg-ep-edit-btn', function() {
            const profileId = $(this).data('profile-id');
            editProfile(profileId);
        });

        $('#rpg-ep-profiles-list').on('click', '.rpg-ep-delete-btn', function() {
            const profileId = $(this).data('profile-id');
            deleteProfileWithConfirmation(profileId);
        });

        $('#rpg-ep-profiles-list').on('click', '.rpg-ep-duplicate-btn', function() {
            const profileId = $(this).data('profile-id');
            duplicateProfile(profileId);
        });

        $('#rpg-ep-profiles-list').on('click', '.rpg-ep-toggle-visibility-btn', function() {
            const profileId = $(this).data('profile-id');
            toggleProfileVisibility(profileId);
        });

        // Removed: Activate button - profile selection is done in encounter config modal

        // Preset selector
        $('#rpg-ep-preset-select').on('change', () => {
            loadPresetProfile();
        });

        // Form actions
        $('#rpg-ep-save-profile').on('click', () => {
            saveCurrentProfile();
        });

        $('#rpg-ep-cancel-edit').on('click', () => {
            cancelEdit();
        });

        $('#rpg-ep-new-profile').on('click', () => {
            createNewProfile();
        });

        // Import/Export
        $('#rpg-ep-export-btn').on('click', () => {
            exportCurrentProfile();
        });

        $('#rpg-ep-import-btn').on('click', () => {
            $('#rpg-ep-import-file').click();
        });

        $('#rpg-ep-import-file').on('change', (e) => {
            handleImportFile(e);
        });

        // Preview button
        $('#rpg-ep-preview-btn').on('click', () => {
            showPromptPreview();
        });

        console.log('[RPG Companion] Encounter Profiles UI initialized');
    } catch (error) {
        console.error('[RPG Companion] Failed to initialize Encounter Profiles UI:', error);
        throw error;
    }
}

/**
 * Open the encounter profiles UI
 */
function openEncounterProfilesUI() {
    renderProfilesList();
    renderPresetSelector();
    clearForm();
    $('#rpg-encounter-profiles-popup').addClass('is-open');
}

/**
 * Close the encounter profiles UI
 */
function closeEncounterProfilesUI() {
    $('#rpg-encounter-profiles-popup').removeClass('is-open');
    currentEditingProfileId = null;
}

/**
 * Render the list of all profiles
 */
function renderProfilesList() {
    const profiles = getAllProfiles();
    const activeProfile = getActiveProfile();
    const container = $('#rpg-ep-profiles-list');
    
    if (profiles.length === 0) {
        container.html('<p style="text-align: center; color: #888;">No custom profiles yet. Create one or load a preset!</p>');
        return;
    }

    let html = '';
    profiles.forEach(profile => {
        const isActive = profile.id === activeProfile.id;
        const isPreset = PRESET_PROFILES.some(p => p.id === profile.id);
        const isHidden = profile.hidden === true;

        html += `
            <div class="rpg-ep-profile-item ${isActive ? 'active' : ''} ${isHidden ? 'hidden-profile' : ''}" data-profile-id="${profile.id}">
                <div class="rpg-ep-profile-info">
                    <div class="rpg-ep-profile-name">
                        ${profile.name}
                        ${isActive ? ' <span class="rpg-ep-active-badge">Active</span>' : ''}
                        ${isPreset ? ' <span class="rpg-ep-preset-badge">Preset</span>' : ''}
                        ${isHidden ? ' <span class="rpg-ep-hidden-badge">Hidden</span>' : ''}
                    </div>
                    <div class="rpg-ep-profile-type">${profile.ENCOUNTER_TYPE}</div>
                </div>
                <div class="rpg-ep-profile-actions">
                    <button class="rpg-ep-toggle-visibility-btn" data-profile-id="${profile.id}" title="${isHidden ? 'Show in dropdown' : 'Hide from dropdown'}">
                        <i class="fa-solid fa-eye${isHidden ? '-slash' : ''}"></i>
                    </button>
                    <button class="rpg-ep-edit-btn" data-profile-id="${profile.id}" title="Edit profile">
                        <i class="fa-solid fa-edit"></i>
                    </button>
                    <button class="rpg-ep-duplicate-btn" data-profile-id="${profile.id}" title="Duplicate profile">
                        <i class="fa-solid fa-copy"></i>
                    </button>
                    ${!isPreset ? `<button class="rpg-ep-delete-btn" data-profile-id="${profile.id}" title="Delete profile">
                        <i class="fa-solid fa-trash"></i>
                    </button>` : ''}
                </div>
            </div>
        `;
    });

    container.html(html);
}

/**
 * Render the preset selector dropdown
 */
function renderPresetSelector() {
    const select = $('#rpg-ep-preset-select');
    let html = '<option value="">-- Create New From Preset --</option>';

    PRESET_PROFILES.forEach(preset => {
        html += `<option value="${preset.id}">${preset.name} - ${preset.ENCOUNTER_TYPE}</option>`;
    });

    select.html(html);
}

/**
 * Edit a profile
 */
function editProfile(profileId) {
    const profile = getProfileById(profileId);
    if (!profile) {
        toastr.error('Profile not found');
        return;
    }

    currentEditingProfileId = profileId;
    populateForm(profile);
    $('#rpg-ep-form-title').text(`Edit Profile: ${profile.name}`);
}

/**
 * Delete a profile with confirmation
 */
async function deleteProfileWithConfirmation(profileId) {
    const profile = getProfileById(profileId);
    if (!profile) {
        toastr.error('Profile not found');
        return;
    }

    const { Popup } = getContext();
    const confirmed = await Popup.show.confirm(
        'Delete Profile',
        `Are you sure you want to delete "${profile.name}"? This cannot be undone.`
    );

    if (confirmed) {
        try {
            deleteProfile(profileId);
            saveSettings();
            toastr.success(`Profile "${profile.name}" deleted`);
            renderProfilesList();
            clearForm();
        } catch (error) {
            console.error('[RPG Companion] Error deleting profile:', error);
            toastr.error('Failed to delete profile');
        }
    }
}

/**
 * Duplicate a profile
 */
function duplicateProfile(profileId) {
    const profile = getProfileById(profileId);
    if (!profile) {
        toastr.error('Profile not found');
        return;
    }

    try {
        const newProfile = {
            ...profile,
            name: `${profile.name} (Copy)`,
            id: undefined, // Will be auto-generated
            hidden: false // Don't copy hidden status
        };

        const createdProfile = createProfile(newProfile);
        saveSettings();
        toastr.success(`Profile duplicated as "${createdProfile.name}"`);
        renderProfilesList();
        editProfile(createdProfile.id);
    } catch (error) {
        console.error('[RPG Companion] Error duplicating profile:', error);
        toastr.error('Failed to duplicate profile');
    }
}

/**
 * Toggle profile visibility in dropdown
 */
function toggleProfileVisibility(profileId) {
    const profile = getProfileById(profileId);
    if (!profile) {
        toastr.error('Profile not found');
        return;
    }

    // Check if it's a preset profile
    const isPreset = PRESET_PROFILES.some(p => p.id === profileId);
    if (isPreset) {
        toastr.warning('Cannot hide preset profiles. Duplicate it first to create a custom version.');
        return;
    }

    try {
        // Get the profile from custom profiles array
        const customProfiles = extensionSettings.encounterSettings?.profiles || [];
        const profileIndex = customProfiles.findIndex(p => p.id === profileId);

        if (profileIndex === -1) {
            toastr.error('Profile not found in custom profiles');
            return;
        }

        // Toggle hidden status
        const newHiddenStatus = !customProfiles[profileIndex].hidden;

        // Update directly in the array
        customProfiles[profileIndex].hidden = newHiddenStatus;

        saveSettings();

        const statusText = newHiddenStatus ? 'hidden from' : 'visible in';
        toastr.success(`Profile "${profile.name}" is now ${statusText} dropdown`);

        renderProfilesList();
    } catch (error) {
        console.error('[RPG Companion] Error toggling profile visibility:', error);
        toastr.error('Failed to update profile visibility');
    }
}

/**
 * Activate a profile
 */
function activateProfile(profileId) {
    try {
        setActiveProfile(profileId);
        saveSettings();
        toastr.success('Active profile updated');
        renderProfilesList();
    } catch (error) {
        console.error('[RPG Companion] Error activating profile:', error);
        toastr.error('Failed to activate profile');
    }
}

/**
 * Load a preset profile into the form
 */
function loadPresetProfile() {
    const presetId = $('#rpg-ep-preset-select').val();
    if (!presetId) return;

    const preset = PRESET_PROFILES.find(p => p.id === presetId);
    if (!preset) return;

    currentEditingProfileId = null;
    populateForm(preset);

    // Clear the name field to force user to enter a unique name
    $('#rpg-ep-name').val('');
    $('#rpg-ep-name').attr('placeholder', `Enter a unique name (based on ${preset.name})`);

    $('#rpg-ep-form-title').text('Create New Profile From Preset');
    $('#rpg-ep-preset-select').val('');

    // Focus on the name field
    $('#rpg-ep-name').focus();
}

/**
 * Populate the form with profile data
 */
function populateForm(profile) {
    $('#rpg-ep-name').val(profile.name || '');
    $('#rpg-ep-encounter-type').val(profile.ENCOUNTER_TYPE || '');
    $('#rpg-ep-encounter-goal').val(profile.ENCOUNTER_GOAL || '');
    $('#rpg-ep-encounter-stakes').val(profile.ENCOUNTER_STAKES || 'medium');
    $('#rpg-ep-resource-interpretation').val(profile.RESOURCE_INTERPRETATION || '');
    $('#rpg-ep-action-interpretation').val(profile.ACTION_INTERPRETATION || '');
    $('#rpg-ep-status-interpretation').val(profile.STATUS_INTERPRETATION || '');
    $('#rpg-ep-summary-framing').val(profile.SUMMARY_FRAMING || '');

    // UI Labels
    $('#rpg-ep-enemy-singular').val(profile.ENEMY_LABEL_SINGULAR || '');
    $('#rpg-ep-enemy-plural').val(profile.ENEMY_LABEL_PLURAL || '');
    $('#rpg-ep-party-singular').val(profile.PARTY_LABEL_SINGULAR || '');
    $('#rpg-ep-party-plural').val(profile.PARTY_LABEL_PLURAL || '');
    $('#rpg-ep-resource-label').val(profile.RESOURCE_LABEL || '');
    $('#rpg-ep-action-label').val(profile.ACTION_SECTION_LABEL || '');
    $('#rpg-ep-victory-term').val(profile.VICTORY_TERM || '');
    $('#rpg-ep-defeat-term').val(profile.DEFEAT_TERM || '');
    $('#rpg-ep-fled-term').val(profile.FLED_TERM || '');
}

/**
 * Clear the form
 */
function clearForm() {
    currentEditingProfileId = null;
    $('#rpg-ep-name').val('');
    $('#rpg-ep-encounter-type').val('');
    $('#rpg-ep-encounter-goal').val('');
    $('#rpg-ep-encounter-stakes').val('medium');
    $('#rpg-ep-resource-interpretation').val('');
    $('#rpg-ep-action-interpretation').val('');
    $('#rpg-ep-status-interpretation').val('');
    $('#rpg-ep-summary-framing').val('');

    // UI Labels
    $('#rpg-ep-enemy-singular').val('');
    $('#rpg-ep-enemy-plural').val('');
    $('#rpg-ep-party-singular').val('');
    $('#rpg-ep-party-plural').val('');
    $('#rpg-ep-resource-label').val('');
    $('#rpg-ep-action-label').val('');
    $('#rpg-ep-victory-term').val('');
    $('#rpg-ep-defeat-term').val('');
    $('#rpg-ep-fled-term').val('');

    $('#rpg-ep-form-title').text('New Profile');
}

/**
 * Save the current profile (create or update)
 */
function saveCurrentProfile() {
    const profileData = {
        name: $('#rpg-ep-name').val().trim(),
        ENCOUNTER_TYPE: $('#rpg-ep-encounter-type').val().trim(),
        ENCOUNTER_GOAL: $('#rpg-ep-encounter-goal').val().trim(),
        ENCOUNTER_STAKES: $('#rpg-ep-encounter-stakes').val(),
        RESOURCE_INTERPRETATION: $('#rpg-ep-resource-interpretation').val().trim(),
        ACTION_INTERPRETATION: $('#rpg-ep-action-interpretation').val().trim(),
        STATUS_INTERPRETATION: $('#rpg-ep-status-interpretation').val().trim(),
        SUMMARY_FRAMING: $('#rpg-ep-summary-framing').val().trim(),

        // UI Labels
        ENEMY_LABEL_SINGULAR: $('#rpg-ep-enemy-singular').val().trim(),
        ENEMY_LABEL_PLURAL: $('#rpg-ep-enemy-plural').val().trim(),
        PARTY_LABEL_SINGULAR: $('#rpg-ep-party-singular').val().trim(),
        PARTY_LABEL_PLURAL: $('#rpg-ep-party-plural').val().trim(),
        RESOURCE_LABEL: $('#rpg-ep-resource-label').val().trim(),
        ACTION_SECTION_LABEL: $('#rpg-ep-action-label').val().trim(),
        VICTORY_TERM: $('#rpg-ep-victory-term').val().trim(),
        DEFEAT_TERM: $('#rpg-ep-defeat-term').val().trim(),
        FLED_TERM: $('#rpg-ep-fled-term').val().trim()
    };

    // Check for duplicate names (case-insensitive)
    const allProfiles = getAllProfiles();
    const duplicateName = allProfiles.find(p =>
        p.name.toLowerCase() === profileData.name.toLowerCase() &&
        p.id !== currentEditingProfileId
    );

    if (duplicateName) {
        toastr.error(`A profile named "${profileData.name}" already exists. Please choose a different name.`);
        $('#rpg-ep-name').focus();
        return;
    }

    // Validate
    const validation = validateProfile(profileData);
    if (!validation.valid) {
        toastr.error(`Validation failed: ${validation.errors.join(', ')}`);
        return;
    }

    try {
        if (currentEditingProfileId) {
            // Update existing profile
            updateProfile(currentEditingProfileId, profileData);
            toastr.success(`Profile "${profileData.name}" updated`);
        } else {
            // Create new profile
            const newProfile = createProfile(profileData);
            toastr.success(`Profile "${newProfile.name}" created`);
            currentEditingProfileId = newProfile.id;
        }

        saveSettings();
        renderProfilesList();
    } catch (error) {
        console.error('[RPG Companion] Error saving profile:', error);
        toastr.error('Failed to save profile');
    }
}

/**
 * Cancel editing
 */
function cancelEdit() {
    clearForm();
}

/**
 * Create a new profile
 */
function createNewProfile() {
    clearForm();
}

/**
 * Export the current profile
 */
function exportCurrentProfile() {
    if (!currentEditingProfileId) {
        toastr.warning('Please select or create a profile first');
        return;
    }

    const profile = getProfileById(currentEditingProfileId);
    if (!profile) {
        toastr.error('Profile not found');
        return;
    }

    try {
        const json = exportProfile(profile);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `encounter-profile-${profile.name.toLowerCase().replace(/\s+/g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toastr.success('Profile exported');
    } catch (error) {
        console.error('[RPG Companion] Error exporting profile:', error);
        toastr.error('Failed to export profile');
    }
}

/**
 * Handle import file selection
 */
async function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const profile = importProfile(text);

        // Create the imported profile
        const newProfile = createProfile(profile);
        saveSettings();

        toastr.success(`Profile "${newProfile.name}" imported`);
        renderProfilesList();
        editProfile(newProfile.id);

        // Clear the file input
        $('#rpg-ep-import-file').val('');
    } catch (error) {
        console.error('[RPG Companion] Error importing profile:', error);
        toastr.error(`Failed to import profile: ${error.message}`);
        $('#rpg-ep-import-file').val('');
    }
}

/**
 * Show prompt preview with current profile's word replacements
 */
function showPromptPreview() {
    // Get the profile being edited or create from form
    let profile;

    if (currentEditingProfileId) {
        profile = getProfileById(currentEditingProfileId);
    }

    // If no profile selected, try to build from form
    if (!profile) {
        profile = {
            name: $('#rpg-ep-name').val() || 'Preview',
            ENCOUNTER_TYPE: $('#rpg-ep-encounter-type').val() || 'encounter',
            ENCOUNTER_GOAL: $('#rpg-ep-encounter-goal').val() || 'achieve the objective',
            ENCOUNTER_STAKES: $('#rpg-ep-stakes').val() || 'medium',
            RESOURCE_INTERPRETATION: $('#rpg-ep-hp-represents').val() || 'resources',
            ACTION_INTERPRETATION: $('#rpg-ep-attacks-represent').val() || 'actions',
            STATUS_INTERPRETATION: $('#rpg-ep-statuses-represent').val() || 'conditions',
            SUMMARY_FRAMING: $('#rpg-ep-summary-framing').val() || 'a summary'
        };
    }

    // Get prompts (use custom if available, otherwise use defaults)
    const initSystemPrompt = extensionSettings.customEncounterInitSystemPrompt || DEFAULT_PROMPTS.encounterInitSystem;
    const initInstructionsPrompt = extensionSettings.customEncounterInitInstructionsPrompt || DEFAULT_PROMPTS.encounterInitInstructions;
    const actionSystemPrompt = extensionSettings.customCombatActionSystemPrompt || DEFAULT_PROMPTS.combatActionSystem;
    const actionInstructionsPrompt = extensionSettings.customCombatActionInstructionsPrompt || DEFAULT_PROMPTS.combatActionInstructions;

    // Debug logging
    console.log('[RPG Companion] Preview using prompts:', {
        initSystem: extensionSettings.customEncounterInitSystemPrompt ? 'custom' : 'default',
        initInstructions: extensionSettings.customEncounterInitInstructionsPrompt ? 'custom' : 'default',
        actionSystem: extensionSettings.customCombatActionSystemPrompt ? 'custom' : 'default',
        actionInstructions: extensionSettings.customCombatActionInstructionsPrompt ? 'custom' : 'default'
    });

    // Apply profile variable replacements
    const processedInitSystem = injectProfileVariables(initSystemPrompt, profile);
    const processedInitInstructions = injectProfileVariables(initInstructionsPrompt, profile);
    const processedActionSystem = injectProfileVariables(actionSystemPrompt, profile);
    const processedActionInstructions = injectProfileVariables(actionInstructionsPrompt, profile);

    // Build preview HTML with indicators for custom vs default prompts
    const promptSourceBadge = (isCustom) => isCustom
        ? '<span style="color: #e94560; font-size: 10px; margin-left: 8px;">[CUSTOM]</span>'
        : '<span style="color: #888; font-size: 10px; margin-left: 8px;">[DEFAULT]</span>';

    const previewHtml = `
        <div class="rpg-ep-preview-container">
            <div style="background: rgba(233, 69, 96, 0.1); border: 1px solid rgba(233, 69, 96, 0.3); border-radius: 4px; padding: 12px; margin-bottom: 16px;">
                <strong>ℹ️ Preview Note:</strong> This shows how the encounter prompts will look with the profile's word replacements applied.
                ${extensionSettings.customEncounterInitSystemPrompt || extensionSettings.customEncounterInitInstructionsPrompt || extensionSettings.customCombatActionSystemPrompt || extensionSettings.customCombatActionInstructionsPrompt
                    ? '<br><small style="color: #e94560;">⚠️ You have custom prompts. Make sure they include profile variable placeholders like {ENCOUNTER_TYPE}, {RESOURCE_INTERPRETATION}, etc.</small>'
                    : '<br><small style="color: #888;">Using default prompts with profile variables.</small>'}
            </div>

            <h4>Encounter Init System Prompt${promptSourceBadge(!!extensionSettings.customEncounterInitSystemPrompt)}</h4>
            <pre class="rpg-ep-preview-text">${escapeHtml(processedInitSystem)}</pre>

            <h4>Encounter Init Instructions${promptSourceBadge(!!extensionSettings.customEncounterInitInstructionsPrompt)}</h4>
            <pre class="rpg-ep-preview-text">${escapeHtml(processedInitInstructions)}</pre>

            <h4>Combat Action System Prompt${promptSourceBadge(!!extensionSettings.customCombatActionSystemPrompt)}</h4>
            <pre class="rpg-ep-preview-text">${escapeHtml(processedActionSystem)}</pre>

            <h4>Combat Action Instructions${promptSourceBadge(!!extensionSettings.customCombatActionInstructionsPrompt)}</h4>
            <pre class="rpg-ep-preview-text">${escapeHtml(processedActionInstructions)}</pre>
        </div>
    `;

    // Show in a modal or popup
    const $modal = $('<div class="rpg-settings-popup" id="rpg-ep-preview-popup" style="display: block;"></div>');
    const $content = $(`
        <div class="rpg-settings-popup-content" style="max-width: 800px; max-height: 80vh; overflow-y: auto;">
            <header class="rpg-settings-popup-header">
                <h3><i class="fa-solid fa-eye"></i> Prompt Preview: ${escapeHtml(profile.name)}</h3>
                <button id="rpg-ep-preview-close" class="rpg-settings-popup-close" aria-label="Close">
                    <i class="fa-solid fa-times"></i>
                </button>
            </header>
            <div class="rpg-settings-popup-body">
                ${previewHtml}
            </div>
            <footer class="rpg-settings-popup-footer">
                <button id="rpg-ep-preview-close-btn" class="menu_button">Close</button>
            </footer>
        </div>
    `);

    $modal.append($content);
    $('body').append($modal);

    // Close handlers
    $('#rpg-ep-preview-close, #rpg-ep-preview-close-btn').on('click', () => {
        $modal.remove();
    });

    // Click outside to close
    $modal.on('click', (e) => {
        if (e.target === $modal[0]) {
            $modal.remove();
        }
    });
}

/**
 * Escape HTML for safe display
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
