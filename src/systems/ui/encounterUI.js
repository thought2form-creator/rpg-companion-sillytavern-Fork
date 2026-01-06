/**
 * Encounter UI Module
 * Manages the combat encounter modal window and interactions
 */

import { getContext } from '../../../../../../extensions.js';
import { generateRaw, chat, saveChatDebounced, characters, this_chid, user_avatar } from '../../../../../../../script.js';
import { selected_group, getGroupMembers, groups } from '../../../../../../group-chats.js';
import { executeSlashCommandsOnChatInput } from '../../../../../../../scripts/slash-commands.js';
import { world_names, loadWorldInfo } from '../../../../../../world-info.js';
import { extensionSettings } from '../../core/state.js';
import { saveSettings } from '../../core/persistence.js';
import { i18n } from '../../core/i18n.js';
import { getSafeThumbnailUrl } from '../../utils/avatars.js';
import {
    currentEncounter,
    updateCurrentEncounter,
    resetEncounter,
    addCombatMessage,
    addEncounterLogEntry,
    addDisplayLogEntry,
    addEncounterLogSwipe,
    setEncounterLogSwipe,
    addDisplayLogSwipe,
    setDisplayLogSwipe,
    saveEncounterLog,
    updatePartyMember,
    updateEnemy,
    addPartyMember,
    addEnemy,
    removePartyMember,
    removeEnemy,
    saveEncounterState,
    loadEncounterState,
    clearSavedEncounterState,
    hasSavedEncounter
} from '../features/encounterState.js';
import { openEmojiPicker } from './trackerEditor.js';
import {
    buildEncounterInitPrompt,
    buildCombatActionPrompt,
    buildCombatSummaryPrompt,
    parseEncounterJSON,
    parseCombatActionResponse
} from '../generation/encounterPrompts.js';
import { getAllProfiles, getActiveProfile } from '../features/encounterProfiles.js';

/**
 * EncounterModal class
 * Manages the combat encounter UI
 */
export class EncounterModal {
    constructor() {
        this.modal = null;
        this.isInitializing = false;
        this.isProcessing = false;
        this.lastRequest = null; // Store last request for regeneration
    }

    /**
     * Gets UI labels from the active encounter profile
     * @returns {object} UI labels with fallback defaults
     */
    getUILabels() {
        const profile = getActiveProfile();
        return {
            encounterType: profile?.ENCOUNTER_TYPE || 'Combat',
            enemySingular: profile?.ENEMY_LABEL_SINGULAR || 'Enemy',
            enemyPlural: profile?.ENEMY_LABEL_PLURAL || 'Enemies',
            partySingular: profile?.PARTY_LABEL_SINGULAR || 'Ally',
            partyPlural: profile?.PARTY_LABEL_PLURAL || 'Party',
            resourceLabel: profile?.RESOURCE_LABEL || 'HP',
            actionLabel: profile?.ACTION_SECTION_LABEL || 'Attacks',
            victoryTerm: profile?.VICTORY_TERM || 'Victory',
            defeatTerm: profile?.DEFEAT_TERM || 'Defeat',
            fledTerm: profile?.FLED_TERM || 'Fled'
        };
    }

    /**
     * Opens the encounter modal and initializes combat
     */
    async open() {
        if (this.isInitializing) return;

        // Check if there's a saved encounter
        if (hasSavedEncounter()) {
            const choice = await this.showEncounterSelectionModal();
            if (choice === 'cancel') {
                return;
            } else if (choice === 'continue') {
                await this.continueEncounter();
                return;
            } else if (choice === 'new') {
                // Clear saved state and start new
                clearSavedEncounterState();
                resetEncounter();

                // Clear the current encounter profile so user can select a new one
                if (extensionSettings.encounterSettings) {
                    delete extensionSettings.encounterSettings.currentEncounterProfileId;
                }
            }
        }

        // Always show configuration modal (it will pre-populate with saved values if they exist)
        const configured = await this.showNarrativeConfigModal();
        if (!configured) {
            // User cancelled
            return;
        }

        // Proceed with encounter initialization
        await this.initialize();
    }

    /**
     * Shows modal asking user to continue or start new encounter
     * @returns {Promise<string>} 'continue', 'new', or 'cancel'
     */
    async showEncounterSelectionModal() {
        return new Promise((resolve) => {
            // Remove any existing selection modal first
            const existingModal = document.getElementById('rpg-encounter-selection-modal');
            if (existingModal) {
                existingModal.remove();
            }

            const labels = this.getUILabels();
            const selectionHTML = `
                <div id="rpg-encounter-selection-modal" class="rpg-encounter-modal is-open" data-theme="${extensionSettings.theme || 'default'}">
                    <div class="rpg-encounter-overlay"></div>
                    <div class="rpg-encounter-container" style="max-width: 500px; height: auto; max-height: 400px;">
                        <div class="rpg-encounter-header">
                            <h2><i class="fa-solid fa-swords"></i> ${labels.encounterType} Encounter</h2>
                        </div>
                        <div class="rpg-encounter-content" style="padding: 24px;">
                            <p style="margin-bottom: 20px; font-size: 15px; color: var(--rpg-text, #eaeaea);">
                                You have a saved encounter in progress. Would you like to continue it or start a new one?
                            </p>
                            <div style="display: flex; flex-direction: column; gap: 12px;">
                                <button id="continue-encounter-btn" class="menu_button menu_button_icon" style="width: 100%; padding: 12px;">
                                    <i class="fa-solid fa-play"></i> Continue Encounter
                                </button>
                                <button id="new-encounter-btn" class="menu_button menu_button_icon" style="width: 100%; padding: 12px;">
                                    <i class="fa-solid fa-plus"></i> Start New Encounter
                                </button>
                                <button id="cancel-encounter-btn" class="menu_button" style="width: 100%; padding: 12px;">
                                    <i class="fa-solid fa-times"></i> Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', selectionHTML);
            const modal = document.getElementById('rpg-encounter-selection-modal');

            const cleanup = () => {
                if (modal && modal.parentNode) {
                    modal.remove();
                }
            };

            modal.querySelector('#continue-encounter-btn').addEventListener('click', () => {
                cleanup();
                resolve('continue');
            });

            modal.querySelector('#new-encounter-btn').addEventListener('click', () => {
                cleanup();
                resolve('new');
            });

            modal.querySelector('#cancel-encounter-btn').addEventListener('click', () => {
                cleanup();
                resolve('cancel');
            });

            modal.querySelector('.rpg-encounter-overlay').addEventListener('click', () => {
                cleanup();
                resolve('cancel');
            });
        });
    }

    /**
     * Continues a saved encounter
     */
    async continueEncounter() {
        try {
            // Load the saved state
            const loaded = loadEncounterState();
            if (!loaded) {
                toastr.error('Failed to load saved encounter');
                return;
            }

            // Create modal if it doesn't exist
            if (!this.modal) {
                this.createModal();
            }

            // Update header with current profile (in case profile changed)
            this.updateEncounterHeader();

            // Open the modal
            this.modal.classList.add('is-open');

            // Render the combat UI with loaded state (don't preserve log, we'll restore it next)
            this.renderCombatUI(currentEncounter.combatStats, false);

            // Restore the display log
            this.restoreDisplayLog();

            toastr.success('Encounter resumed');
        } catch (error) {
            console.error('[RPG Companion] Error continuing encounter:', error);
            toastr.error(`Failed to continue encounter: ${error.message}`);
        }
    }

    /**
     * Restores the display log from saved state
     */
    restoreDisplayLog() {
        const logContainer = this.modal.querySelector('#rpg-encounter-log');
        if (!logContainer) return;

        // Clear existing log (except the initial "Combat begins!" entry)
        logContainer.innerHTML = '<div class="rpg-encounter-log-entry"><em>Combat begins!</em></div>';

        // Restore all saved log entries
        if (currentEncounter.displayLog && currentEncounter.displayLog.length > 0) {
            currentEncounter.displayLog.forEach((logEntry, index) => {
                this.renderLogEntry(logEntry, index, logContainer);
            });

            // Scroll to bottom
            logContainer.scrollTop = logContainer.scrollHeight;
        }
    }

    /**
     * Renders a single log entry with swipe controls
     * @param {object} logEntry - The log entry data
     * @param {number} index - Index of the log entry
     * @param {HTMLElement} container - Container to append to
     */
    renderLogEntry(logEntry, index, container) {
        const wrapper = document.createElement('div');
        wrapper.className = 'rpg-encounter-log-entry-wrapper';
        wrapper.dataset.logIndex = index;

        const entry = document.createElement('div');
        entry.className = `rpg-encounter-log-entry ${logEntry.type || ''}`;
        entry.style.whiteSpace = 'pre-wrap';
        entry.textContent = logEntry.message;

        // Add swipe controls if there are multiple swipes or if this is a narrative entry
        const isNarrative = logEntry.type === 'narrative';
        const hasSwipes = logEntry.swipes && logEntry.swipes.length > 1;
        const swipeIndex = logEntry.swipeIndex || 0;
        const swipeCount = logEntry.swipes ? logEntry.swipes.length : 1;

        if (isNarrative) {
            const controls = document.createElement('div');
            controls.className = 'rpg-encounter-log-controls';
            controls.innerHTML = `
                <button class="rpg-encounter-log-swipe-btn rpg-encounter-log-swipe-left"
                        data-log-index="${index}"
                        title="Previous response"
                        ${swipeIndex === 0 ? 'disabled' : ''}>
                    <i class="fa-solid fa-chevron-left"></i>
                </button>
                <span class="rpg-encounter-log-swipe-counter">${swipeIndex + 1}/${swipeCount}</span>
                <button class="rpg-encounter-log-swipe-btn rpg-encounter-log-swipe-right"
                        data-log-index="${index}"
                        title="Next response"
                        ${swipeIndex >= swipeCount - 1 ? 'disabled' : ''}>
                    <i class="fa-solid fa-chevron-right"></i>
                </button>
                <button class="rpg-encounter-log-regen-btn"
                        data-log-index="${index}"
                        title="Regenerate response">
                    <i class="fa-solid fa-rotate"></i>
                </button>
            `;
            wrapper.appendChild(controls);
        }

        wrapper.appendChild(entry);
        container.appendChild(wrapper);
    }

    /**
     * Initializes the encounter
     */
    async initialize() {
        if (this.isInitializing) return;

        this.isInitializing = true;

        try {
            // Create modal if it doesn't exist
            if (!this.modal) {
                this.createModal();
            }

            // Update header with current profile (in case profile changed)
            this.updateEncounterHeader();

            // Show loading state
            this.showLoadingState('Initializing combat encounter...');

            // Open the modal
            this.modal.classList.add('is-open');

            // Generate initial combat state
            const initPrompt = await buildEncounterInitPrompt();

            // Store request for potential regeneration
            this.lastRequest = { type: 'init', prompt: initPrompt };

            const response = await generateRaw({
                prompt: initPrompt,
                quietToLoud: false
            });

            if (!response) {
                this.showErrorWithRegenerate('No response received from AI. The model may be unavailable.');
                return;
            }

            // Parse the combat stats
            const combatData = parseEncounterJSON(response);

            if (!combatData || !combatData.party || !combatData.enemies) {
                this.showErrorWithRegenerate('Invalid JSON format detected. The AI returned malformed data.');
                return;
            }

            // Update encounter state
            updateCurrentEncounter({
                active: true,
                initialized: true,
                combatStats: combatData
            });

            // Add to combat history
            addCombatMessage('system', 'Combat initialized');
            addCombatMessage('assistant', JSON.stringify(combatData));

            // Apply visual styling from styleNotes
            if (combatData.styleNotes) {
                this.applyEnvironmentStyling(combatData.styleNotes);
            }

            // Render the combat UI (don't preserve log for new encounter)
            this.renderCombatUI(combatData, false);

            // Autosave the encounter state
            saveEncounterState();

        } catch (error) {
            console.error('[RPG Companion] Error initializing encounter:', error);
            this.showErrorWithRegenerate(`Failed to initialize combat: ${error.message}`);
        } finally {
            this.isInitializing = false;
        }
    }

    /**
     * Shows narrative configuration modal before starting encounter
     * @returns {Promise<boolean>} True if configured, false if cancelled
     */
    async showNarrativeConfigModal() {
        return new Promise((resolve) => {
            // Remove any existing config modal first
            const existingModal = document.getElementById('rpg-narrative-config-modal');
            if (existingModal) {
                existingModal.remove();
            }

            // Get current values or defaults
            const combatDefaults = extensionSettings.encounterSettings?.combatNarrative || {};
            const summaryDefaults = extensionSettings.encounterSettings?.summaryNarrative || {};

            const configHTML = `
                <div id="rpg-narrative-config-modal" class="rpg-encounter-modal" data-theme="${extensionSettings.theme || 'default'}">
                    <div class="rpg-encounter-overlay"></div>
                    <div class="rpg-encounter-container" style="max-width: 900px;">
                        <div class="rpg-encounter-header">
                            <h2><i class="fa-solid fa-book-open"></i> Configure Combat Narrative</h2>
                        </div>
                        <div class="rpg-encounter-content" style="padding: 24px;">
                            <!-- Two Column Layout -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
                                <!-- LEFT COLUMN: Lorebook Selector -->
                                <div class="rpg-narrative-config-column">
                                    <div class="rpg-narrative-config-section">
                                        <label class="label_text" style="margin-bottom: 16px; display: block; font-weight: 600;">
                                            <i class="fa-solid fa-book"></i> World Info / Lorebooks
                                        </label>

                                        <label class="checkbox_label" style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                                            <input type="checkbox" id="config-filter-worldinfo" ${extensionSettings.encounterWorldInfo?.enabled ? 'checked' : ''} style="margin: 0;" />
                                            <span style="color: var(--rpg-text, #eaeaea);">Filter World Info for this encounter</span>
                                        </label>

                                        <div id="config-worldinfo-selector" style="display: ${extensionSettings.encounterWorldInfo?.enabled ? 'block' : 'none'};">
                                            <label style="display: block; margin-bottom: 8px; font-size: 13px; font-weight: 600;">
                                                Select Lorebooks to Include:
                                            </label>
                                            <div id="config-lorebook-list" style="max-height: 400px; overflow-y: auto; border: 1px solid var(--SmartThemeBorderColor); border-radius: 4px; padding: 8px; margin-bottom: 12px; background: var(--black30a);">
                                                <!-- Will be populated dynamically with checkboxes -->
                                            </div>
                                            <small style="color: #888; font-size: 11px; display: block;">
                                                Check lorebooks to include. Expand to select specific entries.
                                            </small>
                                        </div>
                                    </div>
                                </div>

                                <!-- RIGHT COLUMN: Narrative Settings -->
                                <div class="rpg-narrative-config-column">
                            <div class="rpg-narrative-config-section">
                                <label class="label_text" style="margin-bottom: 16px; display: block; font-weight: 600;">
                                    <i class="fa-solid fa-swords"></i> Combat Narrative Style
                                </label>

                                <div class="rpg-setting-row" style="margin-bottom: 12px;">
                                    <label for="config-combat-tense" style="min-width: 100px;">Tense:</label>
                                    <select id="config-combat-tense" class="rpg-select" style="flex: 1;">
                                        <option value="present" ${combatDefaults.tense === 'present' ? 'selected' : ''}>Present</option>
                                        <option value="past" ${combatDefaults.tense === 'past' ? 'selected' : ''}>Past</option>
                                    </select>
                                </div>

                                <div class="rpg-setting-row" style="margin-bottom: 12px;">
                                    <label for="config-combat-person" style="min-width: 100px;">Person:</label>
                                    <select id="config-combat-person" class="rpg-select" style="flex: 1;">
                                        <option value="first" ${combatDefaults.person === 'first' ? 'selected' : ''}>First Person</option>
                                        <option value="second" ${combatDefaults.person === 'second' ? 'selected' : ''}>Second Person</option>
                                        <option value="third" ${combatDefaults.person === 'third' ? 'selected' : ''}>Third Person</option>
                                    </select>
                                </div>

                                <div class="rpg-setting-row" style="margin-bottom: 12px;">
                                    <label for="config-combat-narration" style="min-width: 100px;">Narration:</label>
                                    <select id="config-combat-narration" class="rpg-select" style="flex: 1;">
                                        <option value="omniscient" ${combatDefaults.narration === 'omniscient' ? 'selected' : ''}>Omniscient</option>
                                        <option value="limited" ${combatDefaults.narration === 'limited' ? 'selected' : ''}>Limited</option>
                                    </select>
                                </div>

                                <div class="rpg-setting-row" style="margin-bottom: 12px;">
                                    <label for="config-combat-pov" style="min-width: 100px;">Point of View:</label>
                                    <input type="text" id="config-combat-pov" class="text_pole" placeholder="narrator" value="${combatDefaults.pov || ''}" style="flex: 1;" />
                                </div>
                            </div>

                            <div class="rpg-narrative-config-section" style="margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--rpg-border, rgba(255,255,255,0.1));">
                                <label class="label_text" style="margin-bottom: 16px; display: block; font-weight: 600;">
                                    <i class="fa-solid fa-scroll"></i> Combat Summary Style
                                </label>

                                <div class="rpg-setting-row" style="margin-bottom: 12px;">
                                    <label for="config-summary-tense" style="min-width: 100px;">Tense:</label>
                                    <select id="config-summary-tense" class="rpg-select" style="flex: 1;">
                                        <option value="present" ${summaryDefaults.tense === 'present' ? 'selected' : ''}>Present</option>
                                        <option value="past" ${summaryDefaults.tense === 'past' ? 'selected' : ''}>Past</option>
                                    </select>
                                </div>

                                <div class="rpg-setting-row" style="margin-bottom: 12px;">
                                    <label for="config-summary-person" style="min-width: 100px;">Person:</label>
                                    <select id="config-summary-person" class="rpg-select" style="flex: 1;">
                                        <option value="first" ${summaryDefaults.person === 'first' ? 'selected' : ''}>First Person</option>
                                        <option value="second" ${summaryDefaults.person === 'second' ? 'selected' : ''}>Second Person</option>
                                        <option value="third" ${summaryDefaults.person === 'third' ? 'selected' : ''}>Third Person</option>
                                    </select>
                                </div>

                                <div class="rpg-setting-row" style="margin-bottom: 12px;">
                                    <label for="config-summary-narration" style="min-width: 100px;">Narration:</label>
                                    <select id="config-summary-narration" class="rpg-select" style="flex: 1;">
                                        <option value="omniscient" ${summaryDefaults.narration === 'omniscient' ? 'selected' : ''}>Omniscient</option>
                                        <option value="limited" ${summaryDefaults.narration === 'limited' ? 'selected' : ''}>Limited</option>
                                    </select>
                                </div>

                                <div class="rpg-setting-row" style="margin-bottom: 12px;">
                                    <label for="config-summary-pov" style="min-width: 100px;">Point of View:</label>
                                    <input type="text" id="config-summary-pov" class="text_pole" placeholder="narrator" value="${summaryDefaults.pov || ''}" style="flex: 1;" />
                                </div>
                            </div>
                                </div>
                                <!-- End Right Column -->
                            </div>
                            <!-- End Two Column Grid -->

                            <!-- Full Width Sections Below -->
                            <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--rpg-border, rgba(255,255,255,0.1));">
                                <label class="checkbox_label" style="display: flex; align-items: center; gap: 8px;">
                                    <input type="checkbox" id="config-remember" ${extensionSettings.encounterSettings?.narrativeConfigured ? 'checked' : ''} style="margin: 0;" />
                                    <span style="color: var(--rpg-text, #eaeaea);">Remember these settings for future encounters</span>
                                </label>
                            </div>

                            <!-- Encounter Profile Selector -->
                            <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--SmartThemeBorderColor);">
                                <label class="label_text" style="margin-bottom: 8px; display: block; font-weight: 600;">
                                    <i class="fa-solid fa-user-gear"></i> Encounter Profile
                                </label>
                                <select id="config-encounter-profile" class="rpg-select" style="width: 100%; padding: 8px; margin-bottom: 8px;">
                                    <!-- Will be populated dynamically -->
                                </select>
                                <small style="color: #888; font-size: 11px; display: block;">
                                    Choose which encounter profile to use for this encounter. This determines how HP, attacks, and statuses are interpreted.
                                </small>
                            </div>

                            <div style="margin-top: 24px; display: flex; gap: 12px; justify-content: flex-end;">
                                <button id="config-cancel" class="rpg-btn rpg-btn-secondary" style="padding: 12px 24px;">
                                    <i class="fa-solid fa-times"></i> Cancel
                                </button>
                                <button id="config-proceed" class="rpg-btn rpg-btn-primary" style="padding: 12px 24px;">
                                    <i class="fa-solid fa-play"></i> Proceed
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', configHTML);
            const configModal = document.getElementById('rpg-narrative-config-modal');

            // Populate encounter profile dropdown
            this.populateProfileDropdown(configModal);

            // Populate lorebook selector
            this.populateLorebookSelector(configModal);

            // Handle filter worldinfo checkbox toggle
            const filterCheckbox = configModal.querySelector('#config-filter-worldinfo');
            const selectorDiv = configModal.querySelector('#config-worldinfo-selector');
            filterCheckbox.addEventListener('change', () => {
                selectorDiv.style.display = filterCheckbox.checked ? 'block' : 'none';
            });

            // Show modal
            setTimeout(() => configModal.classList.add('is-open'), 10);

            // Handle proceed
            configModal.querySelector('#config-proceed').addEventListener('click', () => {
                // Get values
                const combatNarrative = {
                    tense: configModal.querySelector('#config-combat-tense').value,
                    person: configModal.querySelector('#config-combat-person').value,
                    narration: configModal.querySelector('#config-combat-narration').value,
                    pov: configModal.querySelector('#config-combat-pov').value.trim() || 'narrator'
                };

                const summaryNarrative = {
                    tense: configModal.querySelector('#config-summary-tense').value,
                    person: configModal.querySelector('#config-summary-person').value,
                    narration: configModal.querySelector('#config-summary-narration').value,
                    pov: configModal.querySelector('#config-summary-pov').value.trim() || 'narrator'
                };

                const remember = configModal.querySelector('#config-remember').checked;

                // Get selected encounter profile
                const selectedProfileId = configModal.querySelector('#config-encounter-profile').value;
                // console.log('[RPG Companion] Selected profile from dropdown:', selectedProfileId);

                // Get lorebook filter settings
                const filterEnabled = configModal.querySelector('#config-filter-worldinfo').checked;

                // Collect selected lorebooks and pinned lorebooks
                const selectedLorebooks = [];
                const selectedEntryUids = {}; // { lorebookName: { uid: true } }
                const pinnedLorebooks = [];
                const pinnedEntryUids = {}; // { lorebookName: { uid: true } }

                configModal.querySelectorAll('.lorebook-checkbox:checked').forEach(checkbox => {
                    const bookName = checkbox.dataset.lorebook;
                    selectedLorebooks.push(bookName);

                    // Check if this lorebook is pinned
                    const pinBtn = checkbox.closest('.lorebook-item').querySelector('.pin-lorebook-btn');
                    if (pinBtn && pinBtn.classList.contains('pinned')) {
                        pinnedLorebooks.push(bookName);
                    }
                });

                // Collect selected entry UIDs from checkboxes
                // Convert UIDs to numbers to match the entry.uid type
                // Store as { lorebookName: { uid: true } }
                configModal.querySelectorAll('.entry-checkbox:checked').forEach(checkbox => {
                    const uid = parseInt(checkbox.dataset.uid, 10);
                    const lorebookItem = checkbox.closest('.lorebook-item');
                    const lorebookCheckbox = lorebookItem?.querySelector('.lorebook-checkbox');
                    const bookName = lorebookCheckbox?.dataset.lorebook;

                    if (bookName) {
                        if (!selectedEntryUids[bookName]) {
                            selectedEntryUids[bookName] = {};
                        }
                        selectedEntryUids[bookName][uid] = true;
                    }
                });

                // Collect ALL pinned entries (not just checked ones)
                // Store as { lorebookName: { uid: true } }
                configModal.querySelectorAll('.pin-entry-btn.pinned').forEach(pinBtn => {
                    const entryDiv = pinBtn.closest('div');
                    const checkbox = entryDiv?.querySelector('.entry-checkbox');
                    const lorebookItem = entryDiv.closest('.lorebook-item');
                    const lorebookCheckbox = lorebookItem?.querySelector('.lorebook-checkbox');
                    const bookName = lorebookCheckbox?.dataset.lorebook;

                    if (checkbox && checkbox.dataset.uid && bookName) {
                        const uid = parseInt(checkbox.dataset.uid, 10);
                        if (!pinnedEntryUids[bookName]) {
                            pinnedEntryUids[bookName] = {};
                        }
                        pinnedEntryUids[bookName][uid] = true;
                    }
                });

                // console.log('[RPG Companion] Saving lorebook selections:', selectedLorebooks);
                // console.log('[RPG Companion] Saving entry selections:', selectedEntryUids);
                // console.log('[RPG Companion] Pinned lorebooks:', pinnedLorebooks);
                // console.log('[RPG Companion] Pinned entries:', pinnedEntryUids);

                // Save to settings
                if (!extensionSettings.encounterSettings) {
                    extensionSettings.encounterSettings = {};
                }
                extensionSettings.encounterSettings.combatNarrative = combatNarrative;
                extensionSettings.encounterSettings.summaryNarrative = summaryNarrative;

                // Set narrativeConfigured based on checkbox state
                extensionSettings.encounterSettings.narrativeConfigured = remember;

                // Store the selected profile for this encounter (overrides the active profile)
                extensionSettings.encounterSettings.currentEncounterProfileId = selectedProfileId;
                // console.log('[RPG Companion] Saved currentEncounterProfileId:', selectedProfileId);
                // console.log('[RPG Companion] Verification - encounterSettings.currentEncounterProfileId:', extensionSettings.encounterSettings.currentEncounterProfileId);

                // Store lorebook filter settings
                if (!extensionSettings.encounterWorldInfo) {
                    extensionSettings.encounterWorldInfo = {};
                }
                extensionSettings.encounterWorldInfo.enabled = filterEnabled;
                extensionSettings.encounterWorldInfo.selectedLorebooks = selectedLorebooks;
                extensionSettings.encounterWorldInfo.selectedEntryUids = selectedEntryUids;

                // Store pinned selections (these persist across encounters)
                extensionSettings.encounterWorldInfo.pinnedLorebooks = pinnedLorebooks;
                extensionSettings.encounterWorldInfo.pinnedEntryUids = pinnedEntryUids;

                // Save settings
                saveSettings();

                // Clean up
                configModal.remove();
                resolve(true);
            });

            // Handle cancel
            configModal.querySelector('#config-cancel').addEventListener('click', () => {
                configModal.remove();
                resolve(false);
            });

            // Handle overlay click
            configModal.querySelector('.rpg-encounter-overlay').addEventListener('click', () => {
                configModal.remove();
                resolve(false);
            });
        });
    }

    /**
     * Populates the encounter profile dropdown in the config modal
     * @param {HTMLElement} configModal - The config modal element
     */
    populateProfileDropdown(configModal) {
        // console.log('[RPG Companion] ========== populateProfileDropdown CALLED ==========');
        console.trace('[RPG Companion] Call stack:');

        // Check how many config modals exist in the DOM
        const allConfigModals = document.querySelectorAll('#rpg-narrative-config-modal');
        // console.log('[RPG Companion] Config modals in DOM:', allConfigModals.length);
        if (allConfigModals.length > 1) {
            console.error('[RPG Companion] MULTIPLE CONFIG MODALS DETECTED:', allConfigModals.length);
            console.error('[RPG Companion] This will cause duplicate dropdown entries!');
        }

        const dropdown = configModal.querySelector('#config-encounter-profile');
        if (!dropdown) {
            console.warn('[RPG Companion] Profile dropdown not found');
            return;
        }

        // console.log('[RPG Companion] Dropdown element:', dropdown);
        // console.log('[RPG Companion] Dropdown parent modal ID:', configModal.id);

        // Get all profiles (presets + custom), filter out hidden ones
        const allProfiles = getAllProfiles();
        const visibleProfiles = allProfiles.filter(profile => !profile.hidden);
        const activeProfile = getActiveProfile();

        // Get the current encounter profile if set, otherwise use active profile
        const currentProfileId = extensionSettings.encounterSettings?.currentEncounterProfileId || activeProfile.id;

        // console.log('[RPG Companion] Populating profile dropdown');
        // console.log('[RPG Companion] - Total profiles:', allProfiles.length);
        // console.log('[RPG Companion] - Visible profiles:', visibleProfiles.length);
        // console.log('[RPG Companion] - Profile IDs:', visibleProfiles.map(p => p.id));
        // console.log('[RPG Companion] - Profile Names:', visibleProfiles.map(p => p.name));
        // console.log('[RPG Companion] - Current profile ID:', currentProfileId);
        // console.log('[RPG Companion] - Dropdown existing options before clear:', dropdown.options.length);

        // Check for duplicates
        const idCounts = {};
        visibleProfiles.forEach(p => {
            idCounts[p.id] = (idCounts[p.id] || 0) + 1;
        });
        const duplicateIds = Object.keys(idCounts).filter(id => idCounts[id] > 1);
        if (duplicateIds.length > 0) {
            console.warn('[RPG Companion] DUPLICATE PROFILE IDs DETECTED:', duplicateIds);
            console.warn('[RPG Companion] This indicates corrupted settings. Custom profiles array:', extensionSettings.encounterSettings?.profiles);
        }

        // Clear existing options
        dropdown.innerHTML = '';

        // console.log('[RPG Companion] - Dropdown options after clear:', dropdown.options.length);

        // Add visible profiles to dropdown
        visibleProfiles.forEach(profile => {
            const option = document.createElement('option');
            option.value = profile.id;
            option.textContent = profile.name;

            // Add type indicator
            const typeIndicator = profile.ENCOUNTER_TYPE ? ` (${profile.ENCOUNTER_TYPE})` : '';
            option.textContent += typeIndicator;

            // Select the current profile
            if (profile.id === currentProfileId) {
                option.selected = true;
            }

            dropdown.appendChild(option);
        });

        // console.log('[RPG Companion] - Dropdown options after population:', dropdown.options.length);
        // console.log('[RPG Companion] Populated profile dropdown successfully');
    }

    /**
     * Populates the lorebook selector in the config modal
     * @param {HTMLElement} configModal - The config modal element
     */
    async populateLorebookSelector(configModal) {
        const lorebookList = configModal.querySelector('#config-lorebook-list');
        if (!lorebookList) return;

        try {
            // Get world info books from SillyTavern's world_names array
            // console.log('[RPG Companion] Available world_names:', world_names);

            // Clear existing content
            lorebookList.innerHTML = '';

            if (!world_names || world_names.length === 0) {
                lorebookList.innerHTML = '<div style="color: #888; padding: 8px; text-align: center;">No lorebooks available</div>';
                // console.log('[RPG Companion] No lorebooks found in world_names');
                return;
            }

            // Only load PINNED lorebooks and entries (not the last encounter's selections)
            const pinnedBooks = extensionSettings.encounterWorldInfo?.pinnedLorebooks || [];
            const pinnedEntries = extensionSettings.encounterWorldInfo?.pinnedEntryUids || {}; // { lorebookName: { uid: true } }

            // console.log('[RPG Companion] Loading pinned lorebooks:', pinnedBooks);
            // console.log('[RPG Companion] Loading pinned entries:', pinnedEntries);

            // Add "Clear All Pinned" button at the top (always show, update count live)
            const clearButtonDiv = document.createElement('div');
            clearButtonDiv.id = 'pinned-items-header';
            clearButtonDiv.style.cssText = 'margin-bottom: 12px; padding: 8px; background: var(--black30a); border-radius: 4px; display: flex; align-items: center; justify-content: space-between;';

            const infoSpan = document.createElement('span');
            infoSpan.id = 'pinned-items-count';
            infoSpan.style.cssText = 'font-size: 12px; color: #888;';

            const clearButton = document.createElement('button');
            clearButton.className = 'menu_button';
            clearButton.innerHTML = '<i class="fa-solid fa-eraser"></i> Clear All';
            clearButton.style.cssText = 'padding: 4px 12px; font-size: 12px;';
            clearButton.title = 'Clear all selections, pins, and highlights';

            // Function to update the count
            const updatePinnedCount = () => {
                const currentPinnedBooks = extensionSettings.encounterWorldInfo?.pinnedLorebooks || [];
                const currentPinnedEntries = extensionSettings.encounterWorldInfo?.pinnedEntryUids || {};
                const pinnedCount = currentPinnedBooks.length + Object.values(currentPinnedEntries).reduce((sum, book) => sum + Object.keys(book).length, 0);
                infoSpan.textContent = `${pinnedCount} pinned item${pinnedCount !== 1 ? 's' : ''}`;
            };

            // Store the update function on the modal for access from pin handlers
            configModal._updatePinnedCount = updatePinnedCount;

            updatePinnedCount(); // Initial count

            clearButton.addEventListener('click', () => {
                if (confirm('Are you sure you want to clear all selections, pins, and highlights?')) {
                    // Clear all pinned items from settings
                    if (!extensionSettings.encounterWorldInfo) {
                        extensionSettings.encounterWorldInfo = {};
                    }
                    extensionSettings.encounterWorldInfo.pinnedLorebooks = [];
                    extensionSettings.encounterWorldInfo.pinnedEntryUids = {};
                    saveSettings();

                    // Uncheck all lorebook checkboxes
                    configModal.querySelectorAll('.lorebook-checkbox').forEach(checkbox => {
                        checkbox.checked = false;
                    });

                    // Visually unpin all lorebooks
                    configModal.querySelectorAll('.pin-lorebook-btn.pinned').forEach(btn => {
                        btn.classList.remove('pinned');
                        btn.style.color = '#888';
                        btn.style.transform = 'rotate(0deg)';
                        btn.title = 'Pin for all encounters';
                    });

                    // Uncheck all entry checkboxes
                    configModal.querySelectorAll('.entry-checkbox').forEach(checkbox => {
                        checkbox.checked = false;
                    });

                    // Visually unpin all entries
                    configModal.querySelectorAll('.pin-entry-btn').forEach(btn => {
                        btn.classList.remove('pinned');
                        btn.style.color = '#666';
                        btn.style.transform = 'rotate(0deg)';
                        btn.title = 'Pin for all encounters';
                    });

                    // Remove ALL entry border highlights (not just pinned ones)
                    configModal.querySelectorAll('.entry-checkbox').forEach(checkbox => {
                        const entryDiv = checkbox.closest('div');
                        if (entryDiv) {
                            entryDiv.style.borderColor = 'transparent';
                        }
                    });

                    // Remove all pinned entry indicators from lorebook headers
                    configModal.querySelectorAll('.lorebook-item').forEach(lorebookItem => {
                        this.updateLorebookPinnedIndicator(lorebookItem, false);
                    });

                    // Update the count
                    updatePinnedCount();

                    toastr.success('All selections cleared');
                }
            });

            clearButtonDiv.appendChild(infoSpan);
            clearButtonDiv.appendChild(clearButton);
            lorebookList.appendChild(clearButtonDiv);

            // Create checkbox list for each lorebook
            for (const bookName of world_names) {
                const isPinned = pinnedBooks.includes(bookName);
                const isBookSelected = isPinned; // Only select if pinned

                // Create lorebook container
                const lorebookDiv = document.createElement('div');
                lorebookDiv.className = 'lorebook-item';
                lorebookDiv.style.cssText = 'margin-bottom: 8px; border: 1px solid var(--SmartThemeBorderColor); border-radius: 4px; overflow: hidden;';

                // Create lorebook header with checkbox
                const headerDiv = document.createElement('div');
                headerDiv.style.cssText = 'display: flex; align-items: center; padding: 8px; background: var(--black50a); cursor: pointer;';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'lorebook-checkbox';
                checkbox.dataset.lorebook = bookName;
                checkbox.checked = isBookSelected;
                checkbox.style.cssText = 'margin: 0 8px 0 0;';

                const label = document.createElement('label');
                label.style.cssText = 'flex: 1; cursor: pointer; user-select: none;';
                label.textContent = bookName;

                // Add pin button
                const pinBtn = document.createElement('button');
                pinBtn.className = `pin-lorebook-btn ${isPinned ? 'pinned' : ''}`;
                pinBtn.innerHTML = '<i class="fa-solid fa-thumbtack"></i>';
                pinBtn.title = isPinned ? 'Pinned for all encounters (click to unpin)' : 'Pin for all encounters';
                pinBtn.style.cssText = `
                    background: none;
                    border: none;
                    color: ${isPinned ? 'var(--SmartThemeQuoteColor)' : '#888'};
                    cursor: pointer;
                    padding: 4px 8px;
                    font-size: 14px;
                    transition: color 0.2s, transform 0.2s;
                    transform: ${isPinned ? 'rotate(45deg)' : 'rotate(0deg)'};
                `;

                // Pin button click handler
                pinBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const wasPinned = pinBtn.classList.contains('pinned');

                    if (wasPinned) {
                        // Unpin
                        pinBtn.classList.remove('pinned');
                        pinBtn.style.color = '#888';
                        pinBtn.style.transform = 'rotate(0deg)';
                        pinBtn.title = 'Pin for all encounters';
                    } else {
                        // Pin
                        pinBtn.classList.add('pinned');
                        pinBtn.style.color = 'var(--SmartThemeQuoteColor)';
                        pinBtn.style.transform = 'rotate(45deg)';
                        pinBtn.title = 'Pinned for all encounters (click to unpin)';
                        // Auto-check the lorebook when pinned
                        checkbox.checked = true;
                    }

                    // Update the pinned count indicator
                    if (configModal._updatePinnedCount) {
                        configModal._updatePinnedCount();
                    }
                });

                // Hover effect for pin button
                pinBtn.addEventListener('mouseenter', () => {
                    pinBtn.style.color = 'var(--SmartThemeQuoteColor)';
                });
                pinBtn.addEventListener('mouseleave', () => {
                    if (!pinBtn.classList.contains('pinned')) {
                        pinBtn.style.color = '#888';
                    }
                });

                const expandIcon = document.createElement('i');
                expandIcon.className = 'fa-solid fa-chevron-down';
                expandIcon.style.cssText = 'margin-left: 8px; transition: transform 0.2s; color: #888;';

                headerDiv.appendChild(checkbox);
                headerDiv.appendChild(label);
                headerDiv.appendChild(pinBtn);
                headerDiv.appendChild(expandIcon);

                // Create entries container (initially hidden)
                const entriesDiv = document.createElement('div');
                entriesDiv.className = 'lorebook-entries';
                entriesDiv.style.cssText = 'display: none; padding: 8px; background: var(--black30a); max-height: 300px; overflow-y: auto;';
                entriesDiv.innerHTML = '<div style="color: #888; padding: 8px; text-align: center;"><i class="fa-solid fa-spinner fa-spin"></i> Loading entries...</div>';

                lorebookDiv.appendChild(headerDiv);
                lorebookDiv.appendChild(entriesDiv);
                lorebookList.appendChild(lorebookDiv);

                // Check if this lorebook has any pinned entries (for initial indicator)
                const hasPinnedEntriesInBook = pinnedEntries[bookName] && Object.keys(pinnedEntries[bookName]).length > 0;
                if (hasPinnedEntriesInBook && !isPinned) {
                    this.updateLorebookPinnedIndicator(lorebookDiv, true);
                    // Auto-check the lorebook if it has pinned entries
                    checkbox.checked = true;
                }

                // Handle expand/collapse
                let entriesLoaded = false;
                headerDiv.addEventListener('click', async (e) => {
                    // Don't toggle if clicking the checkbox itself or pin button
                    if (e.target === checkbox || e.target.closest('.pin-lorebook-btn')) return;

                    const isExpanded = entriesDiv.style.display === 'block';
                    entriesDiv.style.display = isExpanded ? 'none' : 'block';
                    expandIcon.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(180deg)';

                    // Load entries on first expand
                    if (!isExpanded && !entriesLoaded) {
                        entriesLoaded = true;
                        await this.loadLorebookEntries(bookName, entriesDiv, pinnedEntries, isPinned);
                    }
                });

                // Handle checkbox change
                checkbox.addEventListener('change', (e) => {
                    e.stopPropagation();
                });

                // Allow clicking label to toggle checkbox
                label.addEventListener('click', (e) => {
                    e.stopPropagation();
                    checkbox.checked = !checkbox.checked;
                });
            }

            // console.log('[RPG Companion] Populated lorebook selector with', world_names.length, 'lorebooks');
        } catch (error) {
            console.error('[RPG Companion] Error populating lorebook selector:', error);
            lorebookList.innerHTML = '<div style="color: #f88; padding: 8px;">Error loading lorebooks</div>';
        }
    }

    /**
     * Loads and displays entries for a specific lorebook
     * @param {string} bookName - Name of the lorebook
     * @param {HTMLElement} entriesDiv - Container to populate with entries
     * @param {Object} pinnedEntries - Map of pinned entry UIDs { lorebookName: { uid: true } }
     * @param {boolean} isLorebookPinned - Whether the entire lorebook is pinned
     */
    async loadLorebookEntries(bookName, entriesDiv, pinnedEntries, isLorebookPinned) {
        try {
            // console.log(`[RPG Companion] Loading entries for lorebook: ${bookName}`);
            // console.log('[RPG Companion] Pinned entries:', pinnedEntries);

            const worldInfo = await loadWorldInfo(bookName);

            if (!worldInfo || !worldInfo.entries) {
                entriesDiv.innerHTML = '<div style="color: #888; padding: 8px; text-align: center;">No entries found</div>';
                return;
            }

            const entries = Object.values(worldInfo.entries);

            if (entries.length === 0) {
                entriesDiv.innerHTML = '<div style="color: #888; padding: 8px; text-align: center;">No entries in this lorebook</div>';
                return;
            }

            // Clear loading message
            entriesDiv.innerHTML = '';

            // Track if any entries are pinned (for visual feedback)
            let hasPinnedEntries = false;

            // Get pinned entries for this specific lorebook
            const pinnedEntriesForBook = pinnedEntries[bookName] || {};

            // Create checkbox for each entry
            entries.forEach(entry => {
                const isPinned = pinnedEntriesForBook[entry.uid] || false;
                const isSelected = isLorebookPinned || isPinned; // Select if lorebook is pinned OR entry is pinned

                if (isPinned) hasPinnedEntries = true;

                // console.log(`[RPG Companion] Entry ${entry.uid} (${entry.comment}): isPinned=${isPinned}, isSelected=${isSelected}`);
                const displayName = entry.comment || entry.key?.join(', ') || 'Unnamed Entry';

                const entryDiv = document.createElement('div');
                entryDiv.style.cssText = `
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 6px;
                    margin-bottom: 4px;
                    background: var(--black50a);
                    border-radius: 4px;
                    border: 1px solid ${isPinned ? 'var(--SmartThemeQuoteColor)' : 'transparent'};
                `;
                entryDiv.addEventListener('mouseenter', () => {
                    if (!isPinned) {
                        entryDiv.style.borderColor = 'var(--SmartThemeBorderColor)';
                    }
                });
                entryDiv.addEventListener('mouseleave', () => {
                    entryDiv.style.borderColor = isPinned ? 'var(--SmartThemeQuoteColor)' : 'transparent';
                });

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'entry-checkbox';
                checkbox.dataset.uid = entry.uid;
                checkbox.checked = isSelected;
                checkbox.style.cssText = 'margin: 0; cursor: pointer;';

                // Auto-check lorebook when entry is checked
                checkbox.addEventListener('change', () => {
                    const lorebookItem = checkbox.closest('.lorebook-item');
                    const lorebookCheckbox = lorebookItem?.querySelector('.lorebook-checkbox');
                    const entryDiv = checkbox.closest('div');
                    const entryPinBtn = entryDiv?.querySelector('.pin-entry-btn');

                    if (checkbox.checked && lorebookCheckbox) {
                        // If entry is checked, auto-check the lorebook
                        lorebookCheckbox.checked = true;
                    } else if (!checkbox.checked) {
                        // If entry is unchecked, auto-unpin it
                        if (entryPinBtn && entryPinBtn.classList.contains('pinned')) {
                            entryPinBtn.classList.remove('pinned');
                            entryPinBtn.style.color = '#666';
                            entryPinBtn.style.transform = 'rotate(0deg)';
                            entryPinBtn.title = 'Pin for all encounters';
                            entryDiv.style.borderColor = 'transparent';

                            // Update the pinned entries indicator
                            const hasPinnedEntries = Array.from(lorebookItem.querySelectorAll('.pin-entry-btn.pinned')).length > 0;
                            this.updateLorebookPinnedIndicator(lorebookItem, hasPinnedEntries);

                            // Update the pinned count indicator
                            const configModal = lorebookItem.closest('#config-modal');
                            if (configModal?._updatePinnedCount) {
                                configModal._updatePinnedCount();
                            }
                        }

                        // Check if any other entries are still checked
                        if (lorebookCheckbox) {
                            const anyEntriesChecked = lorebookItem.querySelectorAll('.entry-checkbox:checked').length > 0;
                            if (!anyEntriesChecked) {
                                // No entries checked, uncheck lorebook (unless it's pinned)
                                const lorebookPinBtn = lorebookItem.querySelector('.pin-lorebook-btn');
                                if (!lorebookPinBtn?.classList.contains('pinned')) {
                                    lorebookCheckbox.checked = false;
                                }
                            }
                        }
                    }
                });

                const nameSpan = document.createElement('span');
                nameSpan.style.cssText = 'flex: 1; font-size: 12px; cursor: pointer;';
                nameSpan.textContent = displayName;
                nameSpan.addEventListener('click', () => {
                    checkbox.checked = !checkbox.checked;
                    // Trigger the change event
                    checkbox.dispatchEvent(new Event('change'));
                });

                // Add pin button for individual entries
                const entryPinBtn = document.createElement('button');
                entryPinBtn.className = `pin-entry-btn ${isPinned ? 'pinned' : ''}`;
                entryPinBtn.innerHTML = '<i class="fa-solid fa-thumbtack"></i>';
                entryPinBtn.title = isPinned ? 'Pinned for all encounters (click to unpin)' : 'Pin for all encounters';
                entryPinBtn.style.cssText = `
                    background: none;
                    border: none;
                    color: ${isPinned ? 'var(--SmartThemeQuoteColor)' : '#666'};
                    cursor: pointer;
                    padding: 2px 4px;
                    font-size: 11px;
                    transition: color 0.2s, transform 0.2s;
                    transform: ${isPinned ? 'rotate(45deg)' : 'rotate(0deg)'};
                `;

                // Entry pin button click handler
                entryPinBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const wasPinned = entryPinBtn.classList.contains('pinned');

                    if (wasPinned) {
                        // Unpin
                        entryPinBtn.classList.remove('pinned');
                        entryPinBtn.style.color = '#666';
                        entryPinBtn.style.transform = 'rotate(0deg)';
                        entryPinBtn.title = 'Pin for all encounters';
                        entryDiv.style.borderColor = 'transparent';
                        hasPinnedEntries = entries.some(e => {
                            const btn = entriesDiv.querySelector(`[data-uid="${e.uid}"] .pin-entry-btn`);
                            return btn?.classList.contains('pinned');
                        });
                    } else {
                        // Pin
                        entryPinBtn.classList.add('pinned');
                        entryPinBtn.style.color = 'var(--SmartThemeQuoteColor)';
                        entryPinBtn.style.transform = 'rotate(45deg)';
                        entryPinBtn.title = 'Pinned for all encounters (click to unpin)';
                        entryDiv.style.borderColor = 'var(--SmartThemeQuoteColor)';
                        checkbox.checked = true;
                        hasPinnedEntries = true;

                        // Auto-check the lorebook when entry is pinned
                        const lorebookItem = entriesDiv.closest('.lorebook-item');
                        const lorebookCheckbox = lorebookItem?.querySelector('.lorebook-checkbox');
                        if (lorebookCheckbox) {
                            lorebookCheckbox.checked = true;
                        }
                    }

                    // Update lorebook header to show it has pinned entries
                    this.updateLorebookPinnedIndicator(entriesDiv.closest('.lorebook-item'), hasPinnedEntries);

                    // Update the pinned count indicator
                    const configModal = entriesDiv.closest('#config-modal');
                    if (configModal?._updatePinnedCount) {
                        configModal._updatePinnedCount();
                    }
                });

                // Hover effect for entry pin button
                entryPinBtn.addEventListener('mouseenter', () => {
                    entryPinBtn.style.color = 'var(--SmartThemeQuoteColor)';
                });
                entryPinBtn.addEventListener('mouseleave', () => {
                    if (!entryPinBtn.classList.contains('pinned')) {
                        entryPinBtn.style.color = '#666';
                    }
                });

                entryDiv.appendChild(checkbox);
                entryDiv.appendChild(nameSpan);
                entryDiv.appendChild(entryPinBtn);
                entriesDiv.appendChild(entryDiv);
            });

            // Update lorebook header to show if it has pinned entries
            const lorebookItem = entriesDiv.closest('.lorebook-item');
            this.updateLorebookPinnedIndicator(lorebookItem, hasPinnedEntries);

            // console.log(`[RPG Companion] Loaded ${entries.length} entries for lorebook: ${bookName}`);
        } catch (error) {
            console.error('[RPG Companion] Error loading lorebook entries:', error);
            entriesDiv.innerHTML = '<div style="color: #f88; padding: 8px; text-align: center;">Error loading entries</div>';
        }
    }

    /**
     * Checks if a lorebook has any pinned entries
     * @param {string} bookName - Name of the lorebook
     * @param {Object} pinnedEntries - Map of pinned entry UIDs { lorebookName: { uid: true } }
     * @returns {Promise<boolean>} True if the lorebook has any pinned entries
     */
    async checkLorebookHasPinnedEntries(bookName, pinnedEntries) {
        try {
            const pinnedEntriesForBook = pinnedEntries[bookName] || {};
            return Object.keys(pinnedEntriesForBook).length > 0;
        } catch (error) {
            console.error('[RPG Companion] Error checking pinned entries:', error);
            return false;
        }
    }

    /**
     * Updates the visual indicator on a lorebook header to show if it contains pinned entries
     * @param {HTMLElement} lorebookItem - The lorebook container element
     * @param {boolean} hasPinnedEntries - Whether the lorebook has any pinned entries
     */
    updateLorebookPinnedIndicator(lorebookItem, hasPinnedEntries) {
        if (!lorebookItem) return;

        const headerDiv = lorebookItem.querySelector('div');
        const pinBtn = lorebookItem.querySelector('.pin-lorebook-btn');

        // Check if lorebook itself is pinned
        const isLorebookPinned = pinBtn?.classList.contains('pinned');

        // Add/remove indicator for pinned entries
        let indicator = lorebookItem.querySelector('.pinned-entries-indicator');

        if (hasPinnedEntries && !isLorebookPinned) {
            if (!indicator) {
                indicator = document.createElement('span');
                indicator.className = 'pinned-entries-indicator';
                indicator.innerHTML = '<i class="fa-solid fa-circle"></i>';
                indicator.title = 'Contains pinned entries';
                indicator.style.cssText = `
                    color: var(--SmartThemeQuoteColor);
                    font-size: 6px;
                    margin-left: 4px;
                    opacity: 0.8;
                `;
                // Insert before the expand icon
                const expandIcon = headerDiv.querySelector('.fa-chevron-down');
                headerDiv.insertBefore(indicator, expandIcon);
            }
        } else if (indicator && (!hasPinnedEntries || isLorebookPinned)) {
            indicator.remove();
        }
    }

    /**
     * Shows a modal to select specific entries from the selected lorebooks
     * @param {string[]} selectedLorebooks - Array of lorebook names
     * @param {HTMLElement} parentModal - The parent config modal
     * @deprecated - No longer used, entries are shown inline
     */
    async showEntrySelector(selectedLorebooks, parentModal) {
        try {
            // Load all entries from selected lorebooks
            const allEntries = [];
            for (const bookName of selectedLorebooks) {
                const worldInfo = await loadWorldInfo(bookName);
                if (worldInfo && worldInfo.entries) {
                    const entries = Object.values(worldInfo.entries).map(entry => ({
                        ...entry,
                        lorebookName: bookName
                    }));
                    allEntries.push(...entries);
                }
            }

            if (allEntries.length === 0) {
                console.warn('[RPG Companion] No entries found in selected lorebooks');
                return;
            }

            // Get previously selected entry UIDs
            const previouslySelected = extensionSettings.encounterWorldInfo?.selectedEntryUids || {};

            // Create entry selector modal
            const selectorHTML = `
                <div class="rpg-entry-selector-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 10001; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.7);">
                    <div style="background: var(--SmartThemeBodyColor); border: 1px solid var(--SmartThemeBorderColor); border-radius: 8px; max-width: 600px; max-height: 80vh; display: flex; flex-direction: column; overflow: hidden;">
                        <div style="padding: 16px; border-bottom: 1px solid var(--SmartThemeBorderColor);">
                            <h3 style="margin: 0; color: var(--SmartThemeEmColor);"><i class="fa-solid fa-list-check"></i> Select Lorebook Entries</h3>
                        </div>
                        <div style="padding: 16px; overflow-y: auto; flex: 1;">
                            <div id="entry-selector-list">
                                ${allEntries.map(entry => {
                                    const isSelected = previouslySelected[entry.uid] || false;
                                    const displayName = entry.comment || entry.key?.join(', ') || 'Unnamed Entry';
                                    return `
                                        <label style="display: flex; align-items: center; gap: 8px; padding: 8px; margin-bottom: 4px; background: var(--black30a); border-radius: 4px; cursor: pointer;">
                                            <input type="checkbox" data-uid="${entry.uid}" ${isSelected ? 'checked' : ''} />
                                            <div style="flex: 1;">
                                                <div style="font-weight: 600; color: var(--SmartThemeEmColor);">${displayName}</div>
                                                <div style="font-size: 11px; color: #888;">${entry.lorebookName}</div>
                                            </div>
                                        </label>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                        <div style="padding: 16px; border-top: 1px solid var(--SmartThemeBorderColor); display: flex; gap: 8px; justify-content: flex-end;">
                            <button id="entry-selector-cancel" class="menu_button">Cancel</button>
                            <button id="entry-selector-save" class="menu_button menu_button_icon">
                                <i class="fa-solid fa-check"></i> Save Selection
                            </button>
                        </div>
                    </div>
                </div>
            `;

            const selectorModal = $(selectorHTML);
            $('body').append(selectorModal);

            // Handle save
            selectorModal.find('#entry-selector-save').on('click', () => {
                const selectedUids = {};
                selectorModal.find('input[type="checkbox"]:checked').each(function() {
                    const uid = $(this).data('uid');
                    selectedUids[uid] = true;
                });

                // Save to settings
                if (!extensionSettings.encounterWorldInfo) {
                    extensionSettings.encounterWorldInfo = {};
                }
                extensionSettings.encounterWorldInfo.selectedEntryUids = selectedUids;

                // Update count display
                const count = Object.keys(selectedUids).length;
                const countDisplay = parentModal.querySelector('#config-selected-entries-count');
                if (count > 0) {
                    countDisplay.textContent = `${count} specific entries selected`;
                } else {
                    countDisplay.textContent = 'All entries from selected lorebooks will be included';
                }

                selectorModal.remove();
            });

            // Handle cancel
            selectorModal.find('#entry-selector-cancel').on('click', () => {
                selectorModal.remove();
            });

        } catch (error) {
            console.error('[RPG Companion] Error showing entry selector:', error);
        }
    }

    /**
     * Updates the encounter header with current profile labels
     */
    updateEncounterHeader() {
        if (!this.modal) return;

        const labels = this.getUILabels();
        const header = this.modal.querySelector('.rpg-encounter-header h2');
        if (header) {
            header.innerHTML = `<i class="fa-solid fa-swords"></i> ${labels.encounterType} Encounter`;
            // console.log('[RPG Companion] Updated encounter header to:', labels.encounterType);
        }
    }

    /**
     * Creates the modal DOM structure
     */
    createModal() {
        const labels = this.getUILabels();
        const modalHTML = `
            <div id="rpg-encounter-modal" class="rpg-encounter-modal" data-theme="${extensionSettings.theme || 'default'}" data-environment="default" data-atmosphere="default">
                <div class="rpg-encounter-overlay"></div>
                <div class="rpg-encounter-container">
                    <div class="rpg-encounter-header">
                        <h2><i class="fa-solid fa-swords"></i> ${labels.encounterType} Encounter</h2>
                        <div class="rpg-encounter-header-buttons">
                            <button id="rpg-encounter-conclude" class="rpg-encounter-conclude-btn" title="Conclude encounter early">
                                <i class="fa-solid fa-flag-checkered"></i> Conclude Encounter
                            </button>
                            <button id="rpg-encounter-close" class="rpg-encounter-close-btn" title="Close (ends encounter)">
                                <i class="fa-solid fa-times"></i>
                            </button>
                        </div>
                    </div>
                    <div class="rpg-encounter-content">
                        <div id="rpg-encounter-loading" class="rpg-encounter-loading">
                            <i class="fa-solid fa-spinner fa-spin"></i>
                            <p>Initializing combat...</p>
                        </div>
                        <div id="rpg-encounter-main" class="rpg-encounter-main" style="display: none;">
                            <!-- Combat UI will be rendered here -->
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('rpg-encounter-modal');

        // Add event listeners
        this.modal.querySelector('#rpg-encounter-conclude').addEventListener('click', () => {
            if (confirm('Conclude this encounter early and generate a summary?')) {
                this.concludeEncounter();
            }
        });

        this.modal.querySelector('#rpg-encounter-close').addEventListener('click', () => {
            if (confirm('Are you sure you want to end this combat encounter?')) {
                this.close();
            }
        });

        // Close on overlay click
        this.modal.querySelector('.rpg-encounter-overlay').addEventListener('click', () => {
            if (confirm('Are you sure you want to end this combat encounter?')) {
                this.close();
            }
        });
    }

    /**
     * Renders the combat UI with party, enemies, and controls
     * @param {object} combatData - Combat data including party and enemies
     * @param {boolean} preserveLog - Whether to preserve existing log content (default: true)
     */
    renderCombatUI(combatData, preserveLog = true) {
        const mainContent = this.modal.querySelector('#rpg-encounter-main');
        const loadingContent = this.modal.querySelector('#rpg-encounter-loading');

        loadingContent.style.display = 'none';
        mainContent.style.display = 'block';

        const context = getContext();
        const userName = context.name1;
        const labels = this.getUILabels();

        let html = `
            <div class="rpg-encounter-battlefield">
                <!-- Environment -->
                <div class="rpg-encounter-environment">
                    <div class="rpg-encounter-environment-edit">
                        <i class="fa-solid fa-mountain"></i>
                        <input type="text" id="rpg-encounter-environment-input" class="rpg-encounter-environment-input" value="${combatData.environment || 'Battle Arena'}" placeholder="Location/Environment" />
                        <button id="rpg-encounter-environment-save" class="rpg-encounter-environment-save-btn" title="Save location">
                            <i class="fa-solid fa-check"></i>
                        </button>
                    </div>
                </div>

                <!-- Enemies Section -->
                <div class="rpg-encounter-section">
                    <div class="rpg-encounter-section-header">
                        <h3><i class="fa-solid fa-skull"></i> ${labels.enemyPlural}</h3>
                        <div class="rpg-encounter-add-btn-group">
                            <button class="rpg-encounter-add-btn" id="rpg-add-enemy-btn" title="Add ${labels.enemySingular}">
                                <i class="fa-solid fa-plus"></i> Add ${labels.enemySingular}
                            </button>
                            <button class="rpg-encounter-pending-btn" id="rpg-pending-enemies-btn" title="View AI-suggested ${labels.enemyPlural.toLowerCase()}">
                                <i class="fa-solid fa-robot"></i>
                                <span class="rpg-pending-badge" id="rpg-pending-enemies-badge" style="display: none;">0</span>
                            </button>
                        </div>
                    </div>
                    <div class="rpg-encounter-enemies">
                        ${this.renderEnemies(combatData.enemies)}
                    </div>
                </div>

                <!-- Party Section -->
                <div class="rpg-encounter-section">
                    <div class="rpg-encounter-section-header">
                        <h3><i class="fa-solid fa-users"></i> ${labels.partyPlural}</h3>
                        <div class="rpg-encounter-add-btn-group">
                            <button class="rpg-encounter-add-btn" id="rpg-add-party-btn" title="Add ${labels.partySingular}">
                                <i class="fa-solid fa-plus"></i> Add ${labels.partySingular}
                            </button>
                            <button class="rpg-encounter-pending-btn" id="rpg-pending-party-btn" title="View AI-suggested ${labels.partyPlural.toLowerCase()}">
                                <i class="fa-solid fa-robot"></i>
                                <span class="rpg-pending-badge" id="rpg-pending-party-badge" style="display: none;">0</span>
                            </button>
                        </div>
                    </div>
                    <div class="rpg-encounter-party">
                        ${this.renderParty(combatData.party)}
                    </div>
                </div>

                <!-- Combat Log -->
                <div class="rpg-encounter-log-section">
                    <div class="rpg-encounter-log-header">
                        <h3><i class="fa-solid fa-scroll"></i> Encounter Log</h3>
                        <button id="rpg-encounter-log-restore-btn" class="rpg-encounter-log-restore-btn" title="Restore log from saved state">
                            <i class="fa-solid fa-rotate-left"></i> Restore Log
                        </button>
                    </div>
                    <div id="rpg-encounter-log" class="rpg-encounter-log">
                        <div class="rpg-encounter-log-entry">
                            <em>${labels.encounterType} Encounter begins!</em>
                        </div>
                    </div>
                </div>

                <!-- Player Controls -->
                ${this.renderPlayerControls(combatData.party)}

                <!-- Special Instructions -->
                <div class="rpg-encounter-special-instructions">
                    <div class="rpg-encounter-special-instructions-header">
                        <h4><i class="fa-solid fa-wand-magic-sparkles"></i> Special Instructions for AI</h4>
                        <button id="rpg-encounter-special-instructions-save" class="rpg-encounter-special-instructions-save-btn" title="Save instructions">
                            <i class="fa-solid fa-save"></i>
                        </button>
                    </div>
                    <textarea id="rpg-encounter-special-instructions-input" class="rpg-encounter-special-instructions-input" placeholder="Add custom instructions for the AI narrator (e.g., 'Focus on dramatic descriptions', 'Keep combat fast-paced', etc.)">${combatData.specialInstructions || ''}</textarea>
                </div>
            </div>
        `;

        // Preserve the log content before replacing innerHTML (only if preserveLog is true)
        const existingLog = this.modal.querySelector('#rpg-encounter-log');
        const logContent = (preserveLog && existingLog) ? existingLog.innerHTML : null;

        mainContent.innerHTML = html;

        // Restore the log content if it existed and we're preserving it
        if (logContent && preserveLog) {
            const newLog = this.modal.querySelector('#rpg-encounter-log');
            if (newLog) {
                newLog.innerHTML = logContent;
            }
        }

        // Add event listeners for controls
        this.attachControlListeners(combatData.party);

        // Update pending badges
        this.updatePendingBadges();
    }

    /**
     * Renders custom bars for an entity
     * @param {Array} customBars - Array of custom bar data
     * @returns {string} HTML for custom bars
     */
    renderCustomBars(customBars) {
        if (!customBars || customBars.length === 0) return '';

        return customBars.map(bar => {
            const percent = Math.min(100, Math.max(0, (bar.current / bar.max) * 100));
            const color = bar.color || '#4a7ba7';

            return `
                <div class="rpg-encounter-custom-bar">
                    <div class="rpg-encounter-custom-bar-label">${bar.name}</div>
                    <div class="rpg-encounter-custom-bar-container">
                        <div class="rpg-encounter-custom-bar-fill" style="width: ${percent}%; background: ${color};"></div>
                        <span class="rpg-encounter-custom-bar-text">${bar.current}/${bar.max}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Renders enemy cards
     * @param {Array} enemies - Array of enemy data
     * @returns {string} HTML for enemies
     */
    renderEnemies(enemies) {
        const labels = this.getUILabels();
        return enemies.map((enemy, index) => {
            const hpPercent = (enemy.hp / enemy.maxHp) * 100;
            const isDead = enemy.hp <= 0;

            return `
                <div class="rpg-encounter-card ${isDead ? 'rpg-encounter-dead' : ''}" data-enemy-index="${index}">
                    <div class="rpg-encounter-card-header">
                        <div class="rpg-encounter-card-sprite">
                            ${enemy.sprite || '👹'}
                        </div>
                        <div class="rpg-encounter-card-actions">
                            <button class="rpg-encounter-edit-btn" data-edit-type="enemy" data-edit-index="${index}" title="Edit ${labels.enemySingular}">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button class="rpg-encounter-delete-btn" data-delete-type="enemy" data-delete-index="${index}" title="Remove ${labels.enemySingular}">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="rpg-encounter-card-info">
                        <h4>${enemy.name}</h4>
                        <div class="rpg-encounter-hp-bar">
                            <div class="rpg-encounter-hp-fill" style="width: ${hpPercent}%"></div>
                            <span class="rpg-encounter-hp-text">${enemy.hp}/${enemy.maxHp} ${labels.resourceLabel}</span>
                        </div>
                        ${this.renderCustomBars(enemy.customBars)}
                        ${enemy.statuses && enemy.statuses.length > 0 ? `
                            <div class="rpg-encounter-statuses">
                                ${enemy.statuses.map(status => `<span class="rpg-encounter-status" title="${status.name}">${status.emoji}</span>`).join('')}
                            </div>
                        ` : ''}
                        ${enemy.description ? `<p class="rpg-encounter-description">${enemy.description}</p>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Renders party member cards
     * @param {Array} party - Array of party member data
     * @returns {string} HTML for party
     */
    renderParty(party) {
        const context = getContext();
        const labels = this.getUILabels();

        return party.map((member, index) => {
            const hpPercent = (member.hp / member.maxHp) * 100;
            const isDead = member.hp <= 0;

            // Get avatar for party member
            let avatarUrl = '';
            if (member.isPlayer) {
                // Get user/persona avatar using user_avatar like userStats does
                if (user_avatar) {
                    avatarUrl = getSafeThumbnailUrl('persona', user_avatar);
                }
            } else {
                // Try to find character avatar by name
                avatarUrl = this.getPartyMemberAvatar(member.name);
            }

            // Fallback SVG if no avatar found
            const fallbackSvg = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2NjY2NjYyIgb3BhY2l0eT0iMC4zIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjNjY2IiBmb250LXNpemU9IjQwIj4/PC90ZXh0Pjwvc3ZnPg==';

            return `
                <div class="rpg-encounter-card ${isDead ? 'rpg-encounter-dead' : ''}" data-party-index="${index}">
                    <div class="rpg-encounter-card-header">
                        <div class="rpg-encounter-card-avatar">
                            <img src="${avatarUrl || fallbackSvg}" alt="${member.name}" onerror="this.src='${fallbackSvg}'">
                        </div>
                        <div class="rpg-encounter-card-actions">
                            <button class="rpg-encounter-edit-btn" data-edit-type="party" data-edit-index="${index}" title="${member.isPlayer ? 'Edit Your Stats' : `Edit ${labels.partySingular}`}">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            ${!member.isPlayer ? `
                                <button class="rpg-encounter-delete-btn" data-delete-type="party" data-delete-index="${index}" title="Remove ${labels.partySingular}">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                    <div class="rpg-encounter-card-info">
                        <h4>${member.name} ${member.isPlayer ? '(You)' : ''}</h4>
                        <div class="rpg-encounter-hp-bar">
                            <div class="rpg-encounter-hp-fill rpg-encounter-hp-party" style="width: ${hpPercent}%"></div>
                            <span class="rpg-encounter-hp-text">${member.hp}/${member.maxHp} ${labels.resourceLabel}</span>
                        </div>
                        ${this.renderCustomBars(member.customBars)}
                        ${member.statuses && member.statuses.length > 0 ? `
                            <div class="rpg-encounter-statuses">
                                ${member.statuses.map(status => `<span class="rpg-encounter-status" title="${status.name}">${status.emoji}</span>`).join('')}
                            </div>
                        ` : ''}                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Gets avatar for a party member by name
     * @param {string} name - Party member name
     * @returns {string} Avatar URL or null
     */
    getPartyMemberAvatar(name) {
        // Try to get from NPC avatars first
        if (extensionSettings.npcAvatars && extensionSettings.npcAvatars[name]) {
            return extensionSettings.npcAvatars[name];
        }

        // Try to find character by name in loaded characters
        if (characters && Array.isArray(characters)) {
            const matchingChar = characters.find(char =>
                char && char.name && char.name.toLowerCase() === name.toLowerCase()
            );

            if (matchingChar && matchingChar.avatar) {
                return getSafeThumbnailUrl('avatar', matchingChar.avatar);
            }
        }

        // Check if it's the current character
        if (this_chid !== undefined && characters && characters[this_chid]) {
            const currentChar = characters[this_chid];
            if (currentChar.name && currentChar.name.toLowerCase() === name.toLowerCase()) {
                return getSafeThumbnailUrl('avatar', currentChar.avatar);
            }
        }

        // No avatar found
        return null;
    }

    /**
     * Shows target selection modal for attacks
     * @param {string} attackType - Type of attack (single-target, AoE, both)
     * @param {Object} combatStats - Current combat state
     * @returns {Promise<string|null>} Selected target name or null if cancelled
     */
    async showTargetSelection(attackType, combatStats) {
        return new Promise((resolve) => {
            const targetModal = document.createElement('div');
            targetModal.className = 'rpg-target-selection-overlay';

            let targetOptions = '';

            // Build target options based on attack type
            if (attackType === 'AoE') {
                targetOptions = `
                    <div class="rpg-target-option" data-target="all-enemies">
                        <div class="rpg-target-icon">💥</div>
                        <div class="rpg-target-name">All Enemies</div>
                        <div class="rpg-target-desc">Area of Effect</div>
                    </div>
                `;
            } else if (attackType === 'both') {
                targetOptions = `
                    <div class="rpg-target-option" data-target="all-enemies">
                        <div class="rpg-target-icon">💥</div>
                        <div class="rpg-target-name">All Enemies</div>
                        <div class="rpg-target-desc">Area of Effect</div>
                    </div>
                    <div class="rpg-target-divider">OR</div>
                `;
            }

            // Add individual targets (enemies and allies)
            if (attackType !== 'AoE') {
                const labels = this.getUILabels();
                // Add enemies
                combatStats.enemies.forEach((enemy, index) => {
                    if (enemy.hp > 0) {
                        targetOptions += `
                            <div class="rpg-target-option" data-target="${enemy.name}" data-target-type="enemy" data-target-index="${index}">
                                <div class="rpg-target-icon">${enemy.sprite || '👹'}</div>
                                <div class="rpg-target-name">${enemy.name}</div>
                                <div class="rpg-target-hp">${enemy.hp}/${enemy.maxHp} ${labels.resourceLabel}</div>
                            </div>
                        `;
                    }
                });

                // Add party members (for heals/buffs)
                combatStats.party.forEach((member, index) => {
                    if (member.hp > 0) {
                        const isPlayer = member.isPlayer ? ' (You)' : '';
                        // Get avatar for party member
                        let avatarIcon = '✨';
                        if (member.isPlayer && user_avatar) {
                            avatarIcon = `<img src="${getSafeThumbnailUrl('persona', user_avatar)}" alt="${member.name}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">`;
                        } else {
                            const avatarUrl = this.getPartyMemberAvatar(member.name);
                            if (avatarUrl) {
                                avatarIcon = `<img src="${avatarUrl}" alt="${member.name}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">`;
                            }
                        }
                        targetOptions += `
                            <div class="rpg-target-option rpg-target-ally" data-target="${member.name}" data-target-type="party" data-target-index="${index}">
                                <div class="rpg-target-icon">${avatarIcon}</div>
                                <div class="rpg-target-name">${member.name}${isPlayer}</div>
                                <div class="rpg-target-hp">${member.hp}/${member.maxHp} ${labels.resourceLabel}</div>
                            </div>
                        `;
                    }
                });
            }

            targetModal.innerHTML = `
                <div class="rpg-target-selection-modal">
                    <h3><i class="fa-solid fa-crosshairs"></i> Select Target</h3>
                    <div class="rpg-target-list">
                        ${targetOptions}
                    </div>
                    <button class="rpg-target-cancel">Cancel</button>
                </div>
            `;

            document.body.appendChild(targetModal);

            // Handle target selection
            targetModal.querySelectorAll('.rpg-target-option').forEach(option => {
                option.addEventListener('click', () => {
                    const target = option.dataset.target;
                    document.body.removeChild(targetModal);
                    resolve(target);
                });
            });

            // Handle cancel
            targetModal.querySelector('.rpg-target-cancel').addEventListener('click', () => {
                document.body.removeChild(targetModal);
                resolve(null);
            });

            // Handle overlay click
            targetModal.addEventListener('click', (e) => {
                if (e.target === targetModal) {
                    document.body.removeChild(targetModal);
                    resolve(null);
                }
            });
        });
    }

    /**
     * Renders player action controls
     * @param {Array} party - Party data
     * @returns {string} HTML for controls
     */
    renderPlayerControls(party) {
        const labels = this.getUILabels();
        const player = party.find(m => m.isPlayer);
        if (!player || player.hp <= 0) {
            const playerIndex = party.findIndex(m => m.isPlayer);
            return `
                <div class="rpg-encounter-controls">
                    <div class="rpg-encounter-defeated-container">
                        <p class="rpg-encounter-defeated">
                            <i class="fa-solid fa-skull"></i> You have been defeated...
                        </p>
                        <button class="rpg-encounter-restore-btn" data-restore-index="${playerIndex}" title="Restore player to 50% ${labels.resourceLabel}">
                            <i class="fa-solid fa-heart-pulse"></i> Restore Player
                        </button>
                    </div>
                </div>
            `;
        }

        const playerIndex = party.findIndex(m => m.isPlayer);

        return `
            <div class="rpg-encounter-controls">
                <div class="rpg-encounter-section-header">
                    <h3><i class="fa-solid fa-hand-fist"></i> Your ${labels.actionLabel}</h3>
                    <button class="rpg-encounter-edit-btn" data-edit-type="party" data-edit-index="${playerIndex}" title="Edit Your ${labels.actionLabel}">
                        <i class="fa-solid fa-pen"></i> Edit
                    </button>
                </div>

                <div class="rpg-encounter-action-buttons">
                    <div class="rpg-encounter-button-group">
                        <h4>Attacks</h4>
                        ${player.attacks.map(attack => {
                            // Support both old string format and new object format
                            const attackName = typeof attack === 'string' ? attack : attack.name;
                            const attackType = typeof attack === 'string' ? 'single-target' : (attack.type || 'single-target');
                            const typeIcon = attackType === 'AoE' ? '💥' : attackType === 'both' ? '⚡' : '🎯';

                            return `
                            <button class="rpg-encounter-action-btn rpg-encounter-attack-btn"
                                    data-action="attack"
                                    data-value="${attackName}"
                                    data-attack-type="${attackType}"
                                    title="${attackType === 'AoE' ? 'Area of Effect' : attackType === 'both' ? 'Single or AoE' : 'Single Target'}">
                                <i class="fa-solid fa-sword"></i> ${attackName} ${typeIcon}
                            </button>
                            `;
                        }).join('')}
                    </div>

                    ${player.items && player.items.length > 0 ? `
                        <div class="rpg-encounter-button-group">
                            <h4>Items</h4>
                            ${player.items.map(item => `
                                <button class="rpg-encounter-action-btn rpg-encounter-item-btn" data-action="item" data-value="${item}">
                                    <i class="fa-solid fa-flask"></i> ${item}
                                </button>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>

                <div class="rpg-encounter-custom-action">
                    <h4>Custom Action</h4>
                    <div class="rpg-encounter-input-group">
                        <input type="text" id="rpg-encounter-custom-input" placeholder="Describe what you want to do..." />
                        <button id="rpg-encounter-custom-submit" class="rpg-encounter-submit-btn">
                            <i class="fa-solid fa-paper-plane"></i> Submit
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Attaches event listeners to control buttons
     * @param {Array} party - Party data for reference
     */
    attachControlListeners(party) {
        const mainContent = this.modal.querySelector('#rpg-encounter-main');
        if (!mainContent) return;

        // Remove old delegated listener if it exists
        if (this._mainContentClickHandler) {
            mainContent.removeEventListener('click', this._mainContentClickHandler);
        }

        // Create delegated click handler for all buttons
        this._mainContentClickHandler = async (e) => {
            const target = e.target.closest('button');
            if (!target) return;

            // Handle action buttons (attacks and items)
            if (target.classList.contains('rpg-encounter-action-btn')) {
                e.preventDefault();
                e.stopPropagation();

                const actionType = target.dataset.action;
                const value = target.dataset.value;
                const attackType = target.dataset.attackType;
                const context = getContext();
                const userName = context.name1;

                let actionText = '';

                if (actionType === 'attack') {
                    const targetName = await this.showTargetSelection(attackType, currentEncounter.combatStats);
                    if (!targetName) return;

                    if (targetName === 'all-enemies') {
                        actionText = `${userName} uses ${value} targeting all enemies!`;
                    } else {
                        actionText = `${userName} uses ${value} on ${targetName}!`;
                    }
                } else if (actionType === 'item') {
                    const targetName = await this.showTargetSelection('single-target', currentEncounter.combatStats);
                    if (!targetName) return;

                    actionText = `${userName} uses ${value} on ${targetName}!`;
                }

                await this.processCombatAction(actionText);
                return;
            }

            // Handle custom action submit
            if (target.id === 'rpg-encounter-custom-submit') {
                e.preventDefault();
                e.stopPropagation();

                const customInput = this.modal.querySelector('#rpg-encounter-custom-input');
                if (customInput) {
                    const action = customInput.value.trim();
                    if (!action) return;

                    await this.processCombatAction(action);
                    customInput.value = '';
                }
                return;
            }

            // Handle edit buttons
            if (target.classList.contains('rpg-encounter-edit-btn')) {
                e.preventDefault();
                e.stopPropagation();

                const type = target.dataset.editType;
                const index = parseInt(target.dataset.editIndex);
                this.showEditModal(type, index);
                return;
            }

            // Handle delete buttons
            if (target.classList.contains('rpg-encounter-delete-btn')) {
                e.preventDefault();
                e.stopPropagation();

                const type = target.dataset.deleteType;
                const index = parseInt(target.dataset.deleteIndex);
                this.handleDelete(type, index);
                return;
            }

            // Handle restore player button
            if (target.classList.contains('rpg-encounter-restore-btn')) {
                e.preventDefault();
                e.stopPropagation();

                const index = parseInt(target.dataset.restoreIndex);
                this.restorePlayer(index);
                return;
            }

            // Handle add enemy button
            if (target.id === 'rpg-add-enemy-btn') {
                e.preventDefault();
                e.stopPropagation();
                this.showAddModal('enemy');
                return;
            }

            // Handle pending enemies button
            if (target.id === 'rpg-pending-enemies-btn' || target.closest('#rpg-pending-enemies-btn')) {
                e.preventDefault();
                e.stopPropagation();
                this.showPendingEntitiesModal('enemy');
                return;
            }

            // Handle add party member button
            if (target.id === 'rpg-add-party-btn') {
                e.preventDefault();
                e.stopPropagation();
                this.showAddModal('party');
                return;
            }

            // Handle pending party button
            if (target.id === 'rpg-pending-party-btn' || target.closest('#rpg-pending-party-btn')) {
                e.preventDefault();
                e.stopPropagation();
                this.showPendingEntitiesModal('party');
                return;
            }

            // Handle environment save button
            if (target.id === 'rpg-encounter-environment-save') {
                e.preventDefault();
                e.stopPropagation();
                const input = this.modal.querySelector('#rpg-encounter-environment-input');
                if (input) {
                    const newEnvironment = input.value.trim();
                    if (newEnvironment) {
                        currentEncounter.combatStats.environment = newEnvironment;
                        saveEncounterState();
                        toastr.success('Location updated');
                    }
                }
                return;
            }

            // Handle special instructions save button
            if (target.id === 'rpg-encounter-special-instructions-save') {
                e.preventDefault();
                e.stopPropagation();
                const textarea = this.modal.querySelector('#rpg-encounter-special-instructions-input');
                if (textarea) {
                    currentEncounter.combatStats.specialInstructions = textarea.value.trim();
                    saveEncounterState();
                    toastr.success('Special instructions saved');
                }
                return;
            }

            // Handle log swipe left button
            if (target.classList.contains('rpg-encounter-log-swipe-left')) {
                e.preventDefault();
                e.stopPropagation();
                const logIndex = parseInt(target.dataset.logIndex);
                this.swipeLogEntry(logIndex, -1);
                return;
            }

            // Handle log swipe right button
            if (target.classList.contains('rpg-encounter-log-swipe-right')) {
                e.preventDefault();
                e.stopPropagation();
                const logIndex = parseInt(target.dataset.logIndex);
                this.swipeLogEntry(logIndex, 1);
                return;
            }

            // Handle log regenerate button
            if (target.classList.contains('rpg-encounter-log-regen-btn')) {
                e.preventDefault();
                e.stopPropagation();
                const logIndex = parseInt(target.dataset.logIndex);
                await this.regenerateLogEntry(logIndex);
                return;
            }

            // Handle log restore button
            if (target.id === 'rpg-encounter-log-restore-btn') {
                e.preventDefault();
                e.stopPropagation();
                this.restoreDisplayLog();
                toastr.success('Combat log restored');
                return;
            }
        };

        // Attach single delegated listener to main content
        mainContent.addEventListener('click', this._mainContentClickHandler);

        // Handle Enter key for environment input
        const environmentInput = this.modal.querySelector('#rpg-encounter-environment-input');
        if (environmentInput) {
            environmentInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const saveBtn = this.modal.querySelector('#rpg-encounter-environment-save');
                    if (saveBtn) saveBtn.click();
                }
            });
        }

        // Handle Enter key for custom input
        const customInput = this.modal.querySelector('#rpg-encounter-custom-input');
        if (customInput) {
            // Remove old listener if exists
            if (this._customInputKeyHandler) {
                customInput.removeEventListener('keypress', this._customInputKeyHandler);
            }

            this._customInputKeyHandler = async (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const action = customInput.value.trim();
                    if (!action) return;

                    await this.processCombatAction(action);
                    customInput.value = '';
                }
            };

            customInput.addEventListener('keypress', this._customInputKeyHandler);
        }
    }

    /**
     * Processes a combat action
     * @param {string} action - The action description
     */
    async processCombatAction(action) {
        if (this.isProcessing) return;

        this.isProcessing = true;

        try {
            // Disable all buttons
            this.modal.querySelectorAll('.rpg-encounter-action-btn, #rpg-encounter-custom-submit').forEach(btn => {
                btn.disabled = true;
            });

            // Add action to log
            this.addToLog(`You: ${action}`, 'player-action');

            // Build and send combat action prompt
            const actionPrompt = await buildCombatActionPrompt(action, currentEncounter.combatStats);

            // Store request for potential regeneration
            this.lastRequest = { type: 'action', action, prompt: actionPrompt };

            // Use quietPrompt to suppress automatic RPG Companion context injection
            // The encounter system builds its own complete context
            const response = await generateRaw({
                prompt: actionPrompt,
                quietToLoud: false,
                quietPrompt: true  // Suppress automatic tracker injection
            });

            if (!response) {
                this.showErrorWithRegenerate('No response received from AI. The model may be unavailable.');
                return;
            }

            // Parse response
            const result = parseEncounterJSON(response);

            if (!result || !result.combatStats) {
                this.showErrorWithRegenerate('Invalid JSON format detected. The AI returned malformed data.');
                return;
            }

            // Detect new entities added by AI
            this.detectNewEntities(currentEncounter.combatStats, result.combatStats);

            // Merge combat stats intelligently to preserve player data
            this.mergeCombatStats(currentEncounter.combatStats, result.combatStats);

            // Update encounter state (combatStats already updated in place)
            // No need to call updateCurrentEncounter for combatStats

            // Collect log entries in order: enemy actions, party actions, then narration
            const logEntries = [];

            // Add enemy actions first
            if (result.enemyActions) {
                result.enemyActions.forEach(enemyAction => {
                    logEntries.push({ message: `${enemyAction.enemyName}: ${enemyAction.action}`, type: 'enemy-action' });
                });
            }

            // Add party actions second
            if (result.partyActions) {
                result.partyActions.forEach(partyAction => {
                    logEntries.push({ message: `${partyAction.memberName}: ${partyAction.action}`, type: 'party-action' });
                });
            }

            // Add narrative last - split by newlines for line-by-line display
            if (result.narrative) {
                const narrativeLines = result.narrative.split('\n').filter(line => line.trim());
                narrativeLines.forEach(line => {
                    logEntries.push({ message: line, type: 'narrative' });
                });
            }

            // Display log entries sequentially with animation
            await this.addLogsSequentially(logEntries);

            // Add to encounter log for summary - include all actions
            let fullActionLog = action;
            if (result.enemyActions && result.enemyActions.length > 0) {
                result.enemyActions.forEach(enemyAction => {
                    fullActionLog += `\n${enemyAction.enemyName}: ${enemyAction.action}`;
                });
            }
            if (result.partyActions && result.partyActions.length > 0) {
                result.partyActions.forEach(partyAction => {
                    fullActionLog += `\n${partyAction.memberName}: ${partyAction.action}`;
                });
            }
            addEncounterLogEntry(fullActionLog, result.narrative || 'Action resolved');

            // Update UI (only updates existing entities, doesn't add new ones)
            this.updateCombatUI(result.combatStats);

            // Autosave the encounter state
            saveEncounterState();

            // Check if combat ended
            if (result.combatEnd) {
                await this.endCombat(result.result || 'unknown');
                return;
            }

            // Re-enable buttons
            this.modal.querySelectorAll('.rpg-encounter-action-btn, #rpg-encounter-custom-submit').forEach(btn => {
                btn.disabled = false;
            });

        } catch (error) {
            console.error('[RPG Companion] Error processing combat action:', error);
            this.showErrorWithRegenerate(`Error processing action: ${error.message}`);

            // Re-enable buttons
            this.modal.querySelectorAll('.rpg-encounter-action-btn, #rpg-encounter-custom-submit').forEach(btn => {
                btn.disabled = false;
            });
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Updates the combat UI with new stats
     * @param {object} combatStats - Updated combat statistics
     */
    updateCombatUI(combatStats) {
        const labels = this.getUILabels();
        // Update enemies
        combatStats.enemies.forEach((enemy, index) => {
            const card = this.modal.querySelector(`[data-enemy-index="${index}"]`);
            if (card) {
                const hpPercent = (enemy.hp / enemy.maxHp) * 100;
                const isDead = enemy.hp <= 0;

                if (isDead) {
                    card.classList.add('rpg-encounter-dead');
                }

                const hpBar = card.querySelector('.rpg-encounter-hp-fill');
                const hpText = card.querySelector('.rpg-encounter-hp-text');

                if (hpBar) hpBar.style.width = `${hpPercent}%`;
                if (hpText) hpText.textContent = `${enemy.hp}/${enemy.maxHp} ${labels.resourceLabel}`;

                // Update custom bars
                if (enemy.customBars && enemy.customBars.length > 0) {
                    const customBars = card.querySelectorAll('.rpg-encounter-custom-bar');
                    enemy.customBars.forEach((bar, barIndex) => {
                        if (customBars[barIndex]) {
                            const percent = Math.min(100, Math.max(0, (bar.current / bar.max) * 100));
                            const barFill = customBars[barIndex].querySelector('.rpg-encounter-custom-bar-fill');
                            const barText = customBars[barIndex].querySelector('.rpg-encounter-custom-bar-text');
                            if (barFill) barFill.style.width = `${percent}%`;
                            if (barText) barText.textContent = `${bar.current}/${bar.max}`;
                        }
                    });
                }
            }
        });

        // Update party
        combatStats.party.forEach((member, index) => {
            const card = this.modal.querySelector(`[data-party-index="${index}"]`);
            if (card) {
                const hpPercent = (member.hp / member.maxHp) * 100;
                const isDead = member.hp <= 0;

                if (isDead) {
                    card.classList.add('rpg-encounter-dead');
                }

                const hpBar = card.querySelector('.rpg-encounter-hp-fill');
                const hpText = card.querySelector('.rpg-encounter-hp-text');

                if (hpBar) hpBar.style.width = `${hpPercent}%`;
                if (hpText) hpText.textContent = `${member.hp}/${member.maxHp} ${labels.resourceLabel}`;

                // Update custom bars
                if (member.customBars && member.customBars.length > 0) {
                    const customBars = card.querySelectorAll('.rpg-encounter-custom-bar');
                    member.customBars.forEach((bar, barIndex) => {
                        if (customBars[barIndex]) {
                            const percent = Math.min(100, Math.max(0, (bar.current / bar.max) * 100));
                            const barFill = customBars[barIndex].querySelector('.rpg-encounter-custom-bar-fill');
                            const barText = customBars[barIndex].querySelector('.rpg-encounter-custom-bar-text');
                            if (barFill) barFill.style.width = `${percent}%`;
                            if (barText) barText.textContent = `${bar.current}/${bar.max}`;
                        }
                    });
                }
            }
        });

        // Re-render controls if player died
        const player = combatStats.party.find(m => m.isPlayer);
        if (player && player.hp <= 0) {
            const controlsContainer = this.modal.querySelector('.rpg-encounter-controls');
            if (controlsContainer) {
                const playerIndex = combatStats.party.findIndex(m => m.isPlayer);
                controlsContainer.innerHTML = `
                    <div class="rpg-encounter-defeated-container">
                        <p class="rpg-encounter-defeated">
                            <i class="fa-solid fa-skull"></i> You have been defeated...
                        </p>
                        <button class="rpg-encounter-restore-btn" data-restore-index="${playerIndex}" title="Restore player to 50% HP">
                            <i class="fa-solid fa-heart-pulse"></i> Restore Player
                        </button>
                    </div>
                `;

                // Add event listener for restore button
                const restoreBtn = controlsContainer.querySelector('.rpg-encounter-restore-btn');
                if (restoreBtn) {
                    restoreBtn.addEventListener('click', () => {
                        const index = parseInt(restoreBtn.dataset.restoreIndex);
                        this.restorePlayer(index);
                    });
                }
            }
        }
    }

    /**
     * Merges combat stats from AI response while preserving all manually-edited data
     * Only updates fields that the AI explicitly returns (HP, maxHP, statuses, customBars)
     * @param {object} oldStats - Current combat stats
     * @param {object} newStats - New combat stats from AI
     */
    mergeCombatStats(oldStats, newStats) {
        if (!oldStats || !newStats) return;

        // Update environment only if AI explicitly provides it
        if (newStats.environment !== undefined) {
            oldStats.environment = newStats.environment;
        }
        if (newStats.specialInstructions !== undefined) {
            oldStats.specialInstructions = newStats.specialInstructions;
        }

        // Merge enemies - only update fields AI explicitly returns
        if (newStats.enemies && Array.isArray(newStats.enemies)) {
            newStats.enemies.forEach((newEnemy, index) => {
                if (oldStats.enemies[index]) {
                    const oldEnemy = oldStats.enemies[index];

                    // Only update fields that AI explicitly provides
                    // According to prompt, AI returns: name, hp, maxHp, statuses
                    if (newEnemy.hp !== undefined) oldEnemy.hp = newEnemy.hp;
                    if (newEnemy.maxHp !== undefined) oldEnemy.maxHp = newEnemy.maxHp;
                    if (newEnemy.statuses !== undefined) oldEnemy.statuses = newEnemy.statuses;
                    if (newEnemy.customBars !== undefined) oldEnemy.customBars = newEnemy.customBars;

                    // Preserve: attacks, description, sprite, and any other fields
                    // These are NOT updated by AI during combat
                }
            });
        }

        // Merge party members - only update fields AI explicitly returns
        if (newStats.party && Array.isArray(newStats.party)) {
            newStats.party.forEach((newMember, index) => {
                if (oldStats.party[index]) {
                    const oldMember = oldStats.party[index];

                    // Only update fields that AI explicitly provides
                    // According to prompt, AI returns: name, hp, maxHp, statuses
                    if (newMember.hp !== undefined) oldMember.hp = newMember.hp;
                    if (newMember.maxHp !== undefined) oldMember.maxHp = newMember.maxHp;
                    if (newMember.statuses !== undefined) oldMember.statuses = newMember.statuses;
                    if (newMember.customBars !== undefined) oldMember.customBars = newMember.customBars;

                    // Preserve: name, attacks, items, isPlayer flag, and any other fields
                    // These are NOT updated by AI during combat
                }
            });
        }

        // console.log('[RPG Companion] Combat stats merged - only HP/statuses updated, all other data preserved');
    }

    /**
     * Detects new entities added by AI and moves them to pending lists
     * @param {object} oldStats - Previous combat stats
     * @param {object} newStats - New combat stats from AI
     */
    detectNewEntities(oldStats, newStats) {
        if (!oldStats || !newStats) return;

        // Detect new enemies
        if (newStats.enemies && newStats.enemies.length > oldStats.enemies.length) {
            const newEnemies = newStats.enemies.slice(oldStats.enemies.length);
            newEnemies.forEach(enemy => {
                // Check if not already in pending
                const alreadyPending = currentEncounter.pendingEnemies.some(e =>
                    e.name === enemy.name && e.sprite === enemy.sprite
                );
                if (!alreadyPending) {
                    currentEncounter.pendingEnemies.push(enemy);
                }
            });
            // Remove the new enemies from the actual combat stats
            newStats.enemies = newStats.enemies.slice(0, oldStats.enemies.length);
        }

        // Detect new party members
        if (newStats.party && newStats.party.length > oldStats.party.length) {
            const newParty = newStats.party.slice(oldStats.party.length);
            newParty.forEach(member => {
                // Check if not already in pending
                const alreadyPending = currentEncounter.pendingParty.some(m =>
                    m.name === member.name
                );
                if (!alreadyPending) {
                    currentEncounter.pendingParty.push(member);
                }
            });
            // Remove the new party members from the actual combat stats
            newStats.party = newStats.party.slice(0, oldStats.party.length);
        }

        // Update badge counts if any new entities were detected
        this.updatePendingBadges();
    }

    /**
     * Updates the badge counts on Add buttons
     */
    updatePendingBadges() {
        const enemyBadge = this.modal.querySelector('#rpg-pending-enemies-badge');
        const partyBadge = this.modal.querySelector('#rpg-pending-party-badge');

        if (enemyBadge) {
            const count = currentEncounter.pendingEnemies.length;
            enemyBadge.textContent = count;
            enemyBadge.style.display = count > 0 ? 'flex' : 'none';
        }

        if (partyBadge) {
            const count = currentEncounter.pendingParty.length;
            partyBadge.textContent = count;
            partyBadge.style.display = count > 0 ? 'flex' : 'none';
        }
    }

    /**
     * Adds multiple log entries sequentially with animation
     * @param {Array} entries - Array of {message, type} objects
     * @param {number} delay - Delay between entries in ms
     */
    async addLogsSequentially(entries, delay = 400) {
        for (const entry of entries) {
            this.addToLog(entry.message, entry.type);
            if (entries.indexOf(entry) < entries.length - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    /**
     * Adds an entry to the combat log
     * @param {string} message - Log message
     * @param {string} type - Log entry type (for styling)
     */
    addToLog(message, type = '') {
        const logContainer = this.modal.querySelector('#rpg-encounter-log');
        if (!logContainer) return;

        // Save to displayLog for persistence
        addDisplayLogEntry(message, type);

        // Get the index of the newly added entry
        const logIndex = currentEncounter.displayLog.length - 1;
        const logEntry = currentEncounter.displayLog[logIndex];

        // Render the entry with swipe controls
        this.renderLogEntry(logEntry, logIndex, logContainer);

        logContainer.scrollTop = logContainer.scrollHeight;
    }

    /**
     * Swipes a log entry to a different response
     * @param {number} logIndex - Index of the log entry
     * @param {number} direction - Direction to swipe (-1 for left, 1 for right)
     */
    swipeLogEntry(logIndex, direction) {
        const logEntry = currentEncounter.displayLog[logIndex];
        if (!logEntry || !logEntry.swipes || logEntry.swipes.length <= 1) {
            return;
        }

        const currentSwipeIndex = logEntry.swipeIndex || 0;
        const newSwipeIndex = currentSwipeIndex + direction;

        if (newSwipeIndex < 0 || newSwipeIndex >= logEntry.swipes.length) {
            return;
        }

        // Update the swipe index
        setDisplayLogSwipe(logIndex, newSwipeIndex);

        // Also update the corresponding encounter log entry if it exists
        if (currentEncounter.encounterLog[logIndex]) {
            setEncounterLogSwipe(logIndex, newSwipeIndex);
        }

        // Re-render the log
        this.restoreDisplayLog();

        // Save the state
        saveEncounterState();

        toastr.info(`Viewing response ${newSwipeIndex + 1}/${logEntry.swipes.length}`);
    }

    /**
     * Regenerates a log entry
     * @param {number} logIndex - Index of the log entry to regenerate
     */
    async regenerateLogEntry(logIndex) {
        const logEntry = currentEncounter.displayLog[logIndex];
        if (!logEntry || logEntry.type !== 'narrative') {
            toastr.error('Can only regenerate narrative entries');
            return;
        }

        // Find the corresponding action in the encounter log
        // The narrative entries are typically added after player/enemy/party actions
        // We need to find the action that corresponds to this narrative
        let actionIndex = -1;
        let narrativeCount = 0;

        for (let i = 0; i < currentEncounter.displayLog.length; i++) {
            if (currentEncounter.displayLog[i].type === 'narrative') {
                if (i === logIndex) {
                    actionIndex = narrativeCount;
                    break;
                }
                narrativeCount++;
            }
        }

        if (actionIndex === -1 || actionIndex >= currentEncounter.encounterLog.length) {
            toastr.error('Could not find corresponding action');
            return;
        }

        const encounterLogEntry = currentEncounter.encounterLog[actionIndex];
        const action = encounterLogEntry.action;

        // Show loading state
        const logContainer = this.modal.querySelector('#rpg-encounter-log');
        const wrapper = logContainer.querySelector(`[data-log-index="${logIndex}"]`);
        if (wrapper) {
            wrapper.classList.add('rpg-regenerating');
            const entry = wrapper.querySelector('.rpg-encounter-log-entry');
            if (entry) {
                entry.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Regenerating...';
            }
        }

        try {
            // Rebuild the combat action prompt with the same action
            const actionPrompt = await buildCombatActionPrompt(action, currentEncounter.combatStats);

            // Generate new response
            const response = await generateRaw({
                prompt: actionPrompt,
                quietToLoud: false,
                quietPrompt: true
            });

            // Parse the response
            const result = parseCombatActionResponse(response);

            if (result && result.narrative) {
                // Add as a new swipe
                addDisplayLogSwipe(logIndex, result.narrative);
                addEncounterLogSwipe(actionIndex, result.narrative);

                // Re-render the log
                this.restoreDisplayLog();

                // Save the state
                saveEncounterState();

                toastr.success('Response regenerated successfully');
            } else {
                throw new Error('Failed to parse regenerated response');
            }
        } catch (error) {
            console.error('[RPG Companion] Error regenerating log entry:', error);
            toastr.error(`Failed to regenerate: ${error.message}`);

            // Restore original content
            this.restoreDisplayLog();
        }
    }

    /**
     * Concludes the encounter early (user-initiated)
     */
    async concludeEncounter() {
        if (!currentEncounter.active) {
            console.warn('[RPG Companion] No active encounter to conclude');
            return;
        }

        // End combat with "interrupted" result
        await this.endCombat('interrupted');
    }

    /**
     * Ends the combat and generates summary
     * @param {string} result - Combat result ('victory', 'defeat', 'fled', 'interrupted')
     */
    async endCombat(result) {
        try {
            // Show combat over screen
            this.showCombatOverScreen(result);

            // Generate summary
            const summaryPrompt = await buildCombatSummaryPrompt(currentEncounter.encounterLog, result);

            const summaryResponse = await generateRaw({
                prompt: summaryPrompt,
                quietToLoud: false
            });

            if (summaryResponse) {
                // Extract summary (remove [FIGHT CONCLUDED] tag)
                const summary = summaryResponse.replace(/\[FIGHT CONCLUDED\]\s*/i, '').trim();

                // Determine which character should speak the summary
                const speakerName = this.getCombatNarrator();

                // Use /sendas command to safely add summary to chat
                // This handles group chats properly and won't delete chat history
                try {
                    await executeSlashCommandsOnChatInput(
                        `/sendas name="${speakerName}" ${summary}`,
                        { clearChatInput: false }
                    );

                    // console.log(`[RPG Companion] Added combat summary to chat as "${speakerName}"`);
                } catch (sendError) {
                    console.error('[RPG Companion] Error using /sendas command:', sendError);
                    // Fallback: try appending to last message
                    if (chat && chat.length > 0) {
                        const lastMessage = chat[chat.length - 1];
                        if (lastMessage) {
                            lastMessage.mes += '\n\n' + summary;
                            saveChatDebounced();
                        }
                    }
                }

                // Save encounter log
                const context = getContext();
                if (context.chatId) {
                    saveEncounterLog(context.chatId, {
                        log: currentEncounter.encounterLog,
                        summary: summary,
                        result: result
                    });
                }

                // Autosave the encounter state before closing
                saveEncounterState();

                // Close the modal so user can see the summary in chat
                setTimeout(() => {
                    this.modal.classList.remove('is-open');
                    toastr.success('Combat concluded! Summary added to chat.');
                }, 500);
            } else {
                this.updateCombatOverScreen(false);
                toastr.error('Failed to generate combat summary');
            }

        } catch (error) {
            console.error('[RPG Companion] Error ending combat:', error);
            this.updateCombatOverScreen(false);
            toastr.error(`Error ending combat: ${error.message}`);
        }
    }

    /**
     * Determines which character should narrate the combat summary
     * Priority: Narrator character > First active group member > Current character
     * @returns {string} Character name to use for /sendas
     */
    getCombatNarrator() {
        // Check if in group chat
        if (selected_group) {
            const group = groups.find(g => g.id === selected_group);
            const groupMembers = getGroupMembers(selected_group);

            if (groupMembers && groupMembers.length > 0) {
                const disabledMembers = group?.disabled_members || [];

                // First priority: Look for a character named "Narrator" or "GM"
                const narrator = groupMembers.find(member =>
                    member && member.name &&
                    !disabledMembers.includes(member.avatar) &&
                    (member.name.toLowerCase() === 'narrator' ||
                     member.name.toLowerCase() === 'gm' ||
                     member.name.toLowerCase() === 'game master')
                );

                if (narrator) {
                    return narrator.name;
                }

                // Second priority: First active (non-muted) group member
                const firstActive = groupMembers.find(member =>
                    member && member.name &&
                    !disabledMembers.includes(member.avatar)
                );

                if (firstActive) {
                    return firstActive.name;
                }
            }
        }

        // Fallback: Use current character
        if (this_chid !== undefined && characters && characters[this_chid]) {
            return characters[this_chid].name;
        }

        // Last resort: Generic narrator
        return 'Narrator';
    }

    /**
     * Shows the combat over screen
     * @param {string} result - Combat result ('victory', 'defeat', 'fled', 'interrupted')
     */
    showCombatOverScreen(result) {
        const mainContent = this.modal.querySelector('#rpg-encounter-main');
        if (!mainContent) return;

        const resultIcons = {
            victory: 'fa-trophy',
            defeat: 'fa-skull-crossbones',
            fled: 'fa-person-running',
            interrupted: 'fa-flag-checkered'
        };

        const resultColors = {
            victory: '#4caf50',
            defeat: '#e94560',
            fled: '#ff9800',
            interrupted: '#888'
        };

        const icon = resultIcons[result] || 'fa-flag-checkered';
        const color = resultColors[result] || '#888';

        mainContent.innerHTML = `
            <div class="rpg-encounter-over" style="text-align: center; padding: 40px 20px;">
                <i class="fa-solid ${icon}" style="font-size: 72px; color: ${color}; margin-bottom: 24px;"></i>
                <h2 style="font-size: 32px; margin-bottom: 16px; text-transform: uppercase;">${result}</h2>
                <p style="font-size: 18px; margin-bottom: 32px; opacity: 0.8;">Generating combat summary...</p>
                <div class="rpg-encounter-loading" style="display: flex; justify-content: center; align-items: center; gap: 12px;">
                    <i class="fa-solid fa-spinner fa-spin" style="font-size: 24px;"></i>
                    <span>Please wait...</span>
                </div>
            </div>
        `;
    }

    /**
     * Updates the combat over screen after summary is added
     * @param {boolean} success - Whether summary was added successfully
     * @param {string} speakerName - Name of character who narrated (optional)
     */
    updateCombatOverScreen(success, speakerName = '') {
        const mainContent = this.modal.querySelector('#rpg-encounter-main');
        if (!mainContent) return;

        const overScreen = mainContent.querySelector('.rpg-encounter-over');
        if (!overScreen) return;

        if (success) {
            overScreen.querySelector('p').textContent = speakerName
                ? `Combat summary has been added to the chat by ${speakerName}.`
                : 'Combat summary has been added to the chat.';
            overScreen.querySelector('.rpg-encounter-loading').innerHTML = `
                <button id="rpg-encounter-close-final" class="rpg-encounter-submit-btn" style="font-size: 18px; padding: 12px 24px;">
                    <i class="fa-solid fa-check"></i> Close Combat Window
                </button>
            `;

            // Add click handler for close button
            const closeBtn = overScreen.querySelector('#rpg-encounter-close-final');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    this.close();
                });
            }
        } else {
            overScreen.querySelector('p').textContent = 'Error generating combat summary.';
            overScreen.querySelector('.rpg-encounter-loading').innerHTML = `
                <p style="color: #e94560;">Failed to create summary. You can close this window.</p>
                <button id="rpg-encounter-close-final" class="rpg-encounter-submit-btn" style="font-size: 18px; padding: 12px 24px; margin-top: 16px;">
                    <i class="fa-solid fa-times"></i> Close Combat Window
                </button>
            `;

            // Add click handler for close button
            const closeBtn = overScreen.querySelector('#rpg-encounter-close-final');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    this.close();
                });
            }
        }
    }

    /**
     * Shows a loading state
     * @param {string} message - Loading message
     */
    showLoadingState(message) {
        const loadingContent = this.modal.querySelector('#rpg-encounter-loading');
        const mainContent = this.modal.querySelector('#rpg-encounter-main');

        if (loadingContent) {
            loadingContent.querySelector('p').textContent = message;
            loadingContent.style.display = 'flex';
        }

        if (mainContent) {
            mainContent.style.display = 'none';
        }
    }

    /**
     * Shows an error message
     * @param {string} message - Error message
     */
    showError(message) {
        const loadingContent = this.modal.querySelector('#rpg-encounter-loading');

        if (loadingContent) {
            loadingContent.innerHTML = `
                <i class="fa-solid fa-exclamation-triangle" style="color: #e94560; font-size: 48px;"></i>
                <p style="color: #e94560;">${message}</p>
            `;
        }
    }

    /**
     * Shows an error message with a regenerate button in the header
     * @param {string} message - Error message to display
     */
    showErrorWithRegenerate(message) {
        // Remove any existing error banner
        const existingError = this.modal.querySelector('#rpg-encounter-error-banner');
        if (existingError) {
            existingError.remove();
        }

        // Find the header
        const header = this.modal.querySelector('.rpg-encounter-header');
        if (!header) return;

        // Create error banner
        const errorBanner = document.createElement('div');
        errorBanner.id = 'rpg-encounter-error-banner';
        errorBanner.className = 'rpg-encounter-error-banner';
        errorBanner.innerHTML = `
            <div class="rpg-encounter-error-content">
                <i class="fa-solid fa-exclamation-triangle"></i>
                <span class="rpg-encounter-error-text">${message}</span>
            </div>
            <div class="rpg-encounter-error-actions">
                <button id="rpg-error-regenerate" class="rpg-encounter-error-btn rpg-encounter-error-btn-regenerate" title="Regenerate response">
                    <i class="fa-solid fa-rotate-right"></i> Retry
                </button>
                <button id="rpg-error-dismiss" class="rpg-encounter-error-btn rpg-encounter-error-btn-dismiss" title="Dismiss error">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
        `;

        // Insert after header
        header.insertAdjacentElement('afterend', errorBanner);

        // Add event listeners
        const regenerateBtn = errorBanner.querySelector('#rpg-error-regenerate');
        const dismissBtn = errorBanner.querySelector('#rpg-error-dismiss');

        if (regenerateBtn) {
            regenerateBtn.addEventListener('click', async () => {
                errorBanner.remove();
                await this.regenerateLastRequest();
            });
        }

        if (dismissBtn) {
            dismissBtn.addEventListener('click', () => {
                errorBanner.remove();
            });
        }

        // Auto-scroll to make error visible
        errorBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    /**
     * Regenerates the last failed request
     */
    async regenerateLastRequest() {
        if (!this.lastRequest) {
            console.warn('[RPG Companion] No request to regenerate');
            return;
        }

        // console.log('[RPG Companion] Regenerating request:', this.lastRequest.type);

        if (this.lastRequest.type === 'init') {
            // Retry initialization
            this.isInitializing = true;
            await this.initialize();
        } else if (this.lastRequest.type === 'action') {
            // Retry action
            this.isProcessing = true;
            await this.processCombatAction(this.lastRequest.action);
        }
    }



    /**
     * Apply environment-based visual styling to the modal
     * @param {object} styleNotes - Style information from the AI
     */
    applyEnvironmentStyling(styleNotes) {
        if (!styleNotes || typeof styleNotes !== 'object') return;

        const { environmentType, atmosphere, timeOfDay, weather } = styleNotes;

        // Apply environment attribute
        if (environmentType) {
            this.modal.setAttribute('data-environment', environmentType.toLowerCase());
        }

        // Apply atmosphere attribute
        if (atmosphere) {
            this.modal.setAttribute('data-atmosphere', atmosphere.toLowerCase());
        }

        // Apply time attribute
        if (timeOfDay) {
            this.modal.setAttribute('data-time', timeOfDay.toLowerCase());
        }

        // Apply weather attribute
        if (weather) {
            this.modal.setAttribute('data-weather', weather.toLowerCase());
        }

        // console.log('[RPG Companion] Applied environment styling:', styleNotes);
    }

    /**
     * Handles deletion of an entity
     * @param {string} type - 'enemy' or 'party'
     * @param {number} index - Index of the entity
     */
    handleDelete(type, index) {
        const confirmMsg = type === 'enemy'
            ? `Remove this enemy from the encounter?`
            : `Remove this party member from the encounter?`;

        if (!confirm(confirmMsg)) return;

        if (type === 'enemy') {
            removeEnemy(index);
        } else if (type === 'party') {
            removePartyMember(index);
        }

        // Re-render the UI (attachControlListeners is called internally)
        this.renderCombatUI(currentEncounter.combatStats);

        // Autosave after delete
        saveEncounterState();
    }

    /**
     * Shows modal for adding a new entity
     * @param {string} type - 'enemy' or 'party'
     */
    showAddModal(type) {
        const labels = this.getUILabels();
        const isEnemy = type === 'enemy';
        const title = isEnemy ? `Add ${labels.enemySingular}` : `Add ${labels.partySingular}`;

        const defaultData = isEnemy ? {
            name: `New ${labels.enemySingular}`,
            hp: 100,
            maxHp: 100,
            sprite: '👹',
            description: '',
            attacks: [{ name: 'Attack', type: 'single-target' }],
            statuses: []
        } : {
            name: `New ${labels.partySingular}`,
            hp: 100,
            maxHp: 100,
            attacks: [{ name: 'Attack', type: 'single-target' }],
            items: [],
            statuses: []
        };

        this.showEditModal(type, -1, defaultData, title);
    }

    /**
     * Shows modal for reviewing and adding pending entities suggested by AI
     * @param {string} type - 'enemy' or 'party'
     */
    showPendingEntitiesModal(type) {
        const labels = this.getUILabels();
        const isEnemy = type === 'enemy';
        const pendingList = isEnemy ? currentEncounter.pendingEnemies : currentEncounter.pendingParty;

        if (pendingList.length === 0) {
            toastr.info(`No pending ${isEnemy ? labels.enemyPlural.toLowerCase() : labels.partyPlural.toLowerCase()} to review.`);
            return;
        }

        const title = isEnemy ? `AI-Suggested ${labels.enemyPlural}` : `AI-Suggested ${labels.partyPlural}`;
        const icon = isEnemy ? 'fa-skull' : 'fa-users';

        // Create modal HTML
        const modalHTML = `
            <div class="rpg-pending-modal-overlay" id="rpg-pending-modal-overlay">
                <div class="rpg-pending-modal-container">
                    <div class="rpg-pending-modal-header">
                        <h3><i class="fa-solid ${icon}"></i> ${title}</h3>
                        <button class="rpg-pending-modal-close" id="rpg-pending-modal-close">
                            <i class="fa-solid fa-times"></i>
                        </button>
                    </div>
                    <div class="rpg-pending-modal-body">
                        <p class="rpg-pending-modal-description">
                            <i class="fa-solid fa-robot"></i> The AI suggested these ${isEnemy ? labels.enemyPlural.toLowerCase() : labels.partyPlural.toLowerCase()} during the encounter.
                            Review and add the ones you want to include.
                        </p>
                        <div class="rpg-pending-entities-list" id="rpg-pending-entities-list">
                            ${this.renderPendingEntities(pendingList, type)}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add modal to page
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer.firstElementChild);

        // Attach event listeners
        const overlay = document.getElementById('rpg-pending-modal-overlay');
        const closeBtn = document.getElementById('rpg-pending-modal-close');

        const closeModal = () => {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 300);
        };

        closeBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });

        // Add button listeners
        overlay.querySelectorAll('.rpg-pending-add-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                this.addPendingEntity(type, index);
                closeModal();
            });
        });

        overlay.querySelectorAll('.rpg-pending-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                this.deletePendingEntity(type, index);
                // Re-render the list
                const listContainer = document.getElementById('rpg-pending-entities-list');
                const updatedList = isEnemy ? currentEncounter.pendingEnemies : currentEncounter.pendingParty;
                if (updatedList.length === 0) {
                    closeModal();
                    toastr.info('All pending entities reviewed.');
                } else {
                    listContainer.innerHTML = this.renderPendingEntities(updatedList, type);
                    // Re-attach listeners
                    listContainer.querySelectorAll('.rpg-pending-add-btn').forEach(newBtn => {
                        newBtn.addEventListener('click', () => {
                            const idx = parseInt(newBtn.dataset.index);
                            this.addPendingEntity(type, idx);
                            closeModal();
                        });
                    });
                    listContainer.querySelectorAll('.rpg-pending-delete-btn').forEach(newBtn => {
                        newBtn.addEventListener('click', () => {
                            const idx = parseInt(newBtn.dataset.index);
                            this.deletePendingEntity(type, idx);
                            const list = isEnemy ? currentEncounter.pendingEnemies : currentEncounter.pendingParty;
                            if (list.length === 0) {
                                closeModal();
                                toastr.info('All pending entities reviewed.');
                            } else {
                                listContainer.innerHTML = this.renderPendingEntities(list, type);
                            }
                        });
                    });
                }
            });
        });

        // Show modal with animation
        setTimeout(() => overlay.style.opacity = '1', 10);
    }

    /**
     * Renders pending entities list
     * @param {Array} entities - List of pending entities
     * @param {string} type - 'enemy' or 'party'
     * @returns {string} HTML string
     */
    renderPendingEntities(entities, type) {
        const labels = this.getUILabels();
        const isEnemy = type === 'enemy';
        return entities.map((entity, index) => `
            <div class="rpg-pending-entity-card">
                <div class="rpg-pending-entity-info">
                    ${isEnemy ? `<div class="rpg-pending-entity-sprite">${entity.sprite || '👹'}</div>` : ''}
                    <div class="rpg-pending-entity-details">
                        <h4>${entity.name || 'Unnamed'}</h4>
                        <p>${labels.resourceLabel}: ${entity.hp || 0}/${entity.maxHp || 0}</p>
                        ${entity.description ? `<p class="rpg-pending-entity-desc">${entity.description}</p>` : ''}
                    </div>
                </div>
                <div class="rpg-pending-entity-actions">
                    <button class="rpg-pending-add-btn" data-index="${index}" title="Add to encounter">
                        <i class="fa-solid fa-plus"></i> Add
                    </button>
                    <button class="rpg-pending-delete-btn" data-index="${index}" title="Discard">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    /**
     * Adds a pending entity to the encounter
     * @param {string} type - 'enemy' or 'party'
     * @param {number} index - Index in pending list
     */
    addPendingEntity(type, index) {
        const isEnemy = type === 'enemy';
        const pendingList = isEnemy ? currentEncounter.pendingEnemies : currentEncounter.pendingParty;
        const entity = pendingList[index];

        if (!entity) return;

        // Add to combat stats
        if (isEnemy) {
            currentEncounter.combatStats.enemies.push(entity);
        } else {
            currentEncounter.combatStats.party.push(entity);
        }

        // Remove from pending
        pendingList.splice(index, 1);

        // Update only the specific section instead of full re-render
        if (isEnemy) {
            const enemiesContainer = this.modal.querySelector('.rpg-encounter-enemies');
            if (enemiesContainer) {
                enemiesContainer.innerHTML = this.renderEnemies(currentEncounter.combatStats.enemies);
            }
        } else {
            const partyContainer = this.modal.querySelector('.rpg-encounter-party');
            if (partyContainer) {
                partyContainer.innerHTML = this.renderParty(currentEncounter.combatStats.party);
            }
        }

        this.updatePendingBadges();
        saveEncounterState();

        toastr.success(`${entity.name} added to ${isEnemy ? 'enemies' : 'party'}!`);
    }

    /**
     * Deletes a pending entity
     * @param {string} type - 'enemy' or 'party'
     * @param {number} index - Index in pending list
     */
    deletePendingEntity(type, index) {
        const isEnemy = type === 'enemy';
        const pendingList = isEnemy ? currentEncounter.pendingEnemies : currentEncounter.pendingParty;

        if (index >= 0 && index < pendingList.length) {
            const entity = pendingList[index];
            pendingList.splice(index, 1);
            this.updatePendingBadges();
            saveEncounterState();
            toastr.info(`${entity.name} discarded.`);
        }
    }

    /**
     * Restores a defeated player to 50% HP
     * @param {number} playerIndex - Index of player in party array (optional, will search if -1)
     */
    restorePlayer(playerIndex) {
        if (!currentEncounter?.combatStats?.party) {
            console.warn('[RPG Companion] No party data available for restore');
            return;
        }

        // If index is invalid, search for the player
        let player;
        let actualIndex = playerIndex;

        if (playerIndex >= 0 && playerIndex < currentEncounter.combatStats.party.length) {
            player = currentEncounter.combatStats.party[playerIndex];
        }

        // If player not found at index or index was -1, search for player
        if (!player || !player.isPlayer) {
            actualIndex = currentEncounter.combatStats.party.findIndex(m => m.isPlayer);
            if (actualIndex >= 0) {
                player = currentEncounter.combatStats.party[actualIndex];
            }
        }

        if (!player || !player.isPlayer) {
            console.warn('[RPG Companion] Could not find player in party for restore');
            toastr.error('Could not find player to restore');
            return;
        }

        // Restore to 50% HP
        const labels = this.getUILabels();
        const restoredHP = Math.ceil(player.maxHp / 2);
        player.hp = restoredHP;

        // Debug: Check player data before render
        // console.log('[RPG Companion] Player data before restore render:', JSON.stringify(player, null, 2));

        // Re-render the combat UI
        this.renderCombatUI(currentEncounter.combatStats);

        // Debug: Check player data after render
        // console.log('[RPG Companion] Player data after restore render:', JSON.stringify(currentEncounter.combatStats.party[actualIndex], null, 2));

        saveEncounterState();

        toastr.success(`${player.name} restored to ${restoredHP} ${labels.resourceLabel}!`);
        // console.log(`[RPG Companion] Player restored: ${player.name} -> ${restoredHP}/${player.maxHp} ${labels.resourceLabel}`);
    }

    /**
     * Shows edit modal for an entity
     * @param {string} type - 'enemy' or 'party'
     * @param {number} index - Index of the entity (-1 for new)
     * @param {object} defaultData - Default data for new entities
     * @param {string} customTitle - Custom title for the modal
     */
    showEditModal(type, index, defaultData = null, customTitle = null) {
        const isEnemy = type === 'enemy';
        const isNew = index === -1;

        let entity;
        if (isNew) {
            entity = defaultData;
        } else {
            entity = isEnemy
                ? currentEncounter.combatStats.enemies[index]
                : currentEncounter.combatStats.party[index];
        }

        if (!entity) {
            console.error('[RPG Companion] Entity not found');
            return;
        }

        // Debug: Log entity data when opening edit modal
        // console.log(`[RPG Companion] Opening edit modal for ${type} at index ${index}:`, JSON.stringify(entity, null, 2));

        const title = customTitle || (isEnemy ? 'Edit Enemy' : (entity.isPlayer ? 'Edit Your Actions' : 'Edit Party Member'));

        // Prepare attacks list
        const attacks = entity.attacks || [];
        const attacksHTML = attacks.map((attack, idx) => {
            const attackName = typeof attack === 'string' ? attack : attack.name;
            const attackType = typeof attack === 'string' ? 'single-target' : (attack.type || 'single-target');
            return `
                <div class="rpg-edit-list-item" data-index="${idx}">
                    <input type="text" class="rpg-edit-attack-name text_pole" value="${attackName}" placeholder="Attack name" />
                    <select class="rpg-edit-attack-type text_pole">
                        <option value="single-target" ${attackType === 'single-target' ? 'selected' : ''}>Single Target 🎯</option>
                        <option value="AoE" ${attackType === 'AoE' ? 'selected' : ''}>Area of Effect 💥</option>
                        <option value="both" ${attackType === 'both' ? 'selected' : ''}>Both ⚡</option>
                    </select>
                    <button class="rpg-edit-remove-btn" type="button" title="Remove"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
        }).join('');

        // Prepare items list (for party members)
        const items = entity.items || [];
        const itemsHTML = items.map((item, idx) => `
            <div class="rpg-edit-list-item" data-index="${idx}">
                <input type="text" class="rpg-edit-item-name text_pole" value="${item}" placeholder="Item name" />
                <button class="rpg-edit-remove-btn" type="button" title="Remove"><i class="fa-solid fa-trash"></i></button>
            </div>
        `).join('');

        // Prepare statuses list
        const statuses = entity.statuses || [];
        const statusesHTML = statuses.map((status, idx) => `
            <div class="rpg-edit-list-item" data-index="${idx}">
                <input type="text" class="rpg-edit-status-emoji text_pole" value="${status.emoji || ''}" placeholder="Emoji" style="width: 60px;" />
                <input type="text" class="rpg-edit-status-name text_pole" value="${status.name || ''}" placeholder="Status name" />
                <input type="number" class="rpg-edit-status-duration text_pole" value="${status.duration || 0}" placeholder="Duration" min="0" style="width: 80px;" />
                <button class="rpg-edit-remove-btn" type="button" title="Remove"><i class="fa-solid fa-trash"></i></button>
            </div>
        `).join('');

        // Prepare custom bars list
        const customBars = entity.customBars || [];
        const customBarsHTML = customBars.map((bar, idx) => `
            <div class="rpg-edit-list-item" data-index="${idx}">
                <input type="text" class="rpg-edit-bar-name text_pole" value="${bar.name || ''}" placeholder="Bar name" style="flex: 1;" />
                <input type="number" class="rpg-edit-bar-current text_pole" value="${bar.current || 0}" placeholder="Current" min="0" style="width: 80px;" />
                <input type="number" class="rpg-edit-bar-max text_pole" value="${bar.max || 100}" placeholder="Max" min="1" style="width: 80px;" />
                <input type="color" class="rpg-edit-bar-color text_pole" value="${bar.color || '#4a7ba7'}" title="Bar color" style="width: 50px; padding: 2px;" />
                <button class="rpg-edit-remove-btn" type="button" title="Remove"><i class="fa-solid fa-trash"></i></button>
            </div>
        `).join('');

        // Create modal HTML
        const labels = this.getUILabels();
        const modalHTML = `
            <div class="rpg-edit-entity-overlay">
                <div class="rpg-edit-entity-modal">
                    <div class="rpg-edit-entity-header">
                        <h3><i class="fa-solid fa-${isEnemy ? 'skull' : 'user'}"></i> ${title}</h3>
                        <button class="rpg-edit-entity-close" title="Close">
                            <i class="fa-solid fa-times"></i>
                        </button>
                    </div>
                    <div class="rpg-edit-entity-content">
                        <div class="rpg-edit-field">
                            <label>Name:</label>
                            <input type="text" id="edit-entity-name" class="text_pole" value="${entity.name || ''}" />
                        </div>

                        <div class="rpg-edit-field-row">
                            <div class="rpg-edit-field">
                                <label>${labels.resourceLabel}:</label>
                                <input type="number" id="edit-entity-hp" class="text_pole" value="${entity.hp || 0}" min="0" />
                            </div>
                            <div class="rpg-edit-field">
                                <label>Max ${labels.resourceLabel}:</label>
                                <input type="number" id="edit-entity-maxhp" class="text_pole" value="${entity.maxHp || 0}" min="1" />
                            </div>
                        </div>

                        ${isEnemy ? `
                            <div class="rpg-edit-field">
                                <label>Sprite (emoji or text):</label>
                                <input type="text" id="edit-entity-sprite" class="text_pole" value="${entity.sprite || '👹'}" />
                            </div>

                            <div class="rpg-edit-field">
                                <label>Description:</label>
                                <textarea id="edit-entity-description" class="text_pole textarea_compact" rows="3">${entity.description || ''}</textarea>
                            </div>
                        ` : ''}

                        <div class="rpg-edit-field">
                            <label>Attacks/Skills:</label>
                            <div id="edit-entity-attacks-list" class="rpg-edit-list">
                                ${attacksHTML}
                            </div>
                            <button type="button" class="rpg-edit-add-btn" id="add-attack-btn">
                                <i class="fa-solid fa-plus"></i> Add Attack
                            </button>
                        </div>

                        ${!isEnemy ? `
                            <div class="rpg-edit-field">
                                <label>Items:</label>
                                <div id="edit-entity-items-list" class="rpg-edit-list">
                                    ${itemsHTML}
                                </div>
                                <button type="button" class="rpg-edit-add-btn" id="add-item-btn">
                                    <i class="fa-solid fa-plus"></i> Add Item
                                </button>
                            </div>
                        ` : ''}

                        <div class="rpg-edit-field">
                            <label>Status Effects:</label>
                            <div id="edit-entity-statuses-list" class="rpg-edit-list">
                                ${statusesHTML}
                            </div>
                            <button type="button" class="rpg-edit-add-btn" id="add-status-btn">
                                <i class="fa-solid fa-plus"></i> Add Status
                            </button>
                        </div>

                        <div class="rpg-edit-field">
                            <label>Custom Bars:</label>
                            <div id="edit-entity-custombars-list" class="rpg-edit-list">
                                ${customBarsHTML}
                            </div>
                            <button type="button" class="rpg-edit-add-btn" id="add-custombar-btn">
                                <i class="fa-solid fa-plus"></i> Add Custom Bar
                            </button>
                        </div>
                    </div>
                    <div class="rpg-edit-entity-footer">
                        <button class="rpg-edit-entity-cancel menu_button">Cancel</button>
                        <button class="rpg-edit-entity-save menu_button menu_button_icon">
                            <i class="fa-solid fa-save"></i> ${isNew ? 'Add' : 'Save'}
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to DOM
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer.firstElementChild);

        const overlay = document.querySelector('.rpg-edit-entity-overlay');

        // Event listeners
        const closeBtn = overlay.querySelector('.rpg-edit-entity-close');
        const cancelBtn = overlay.querySelector('.rpg-edit-entity-cancel');
        const saveBtn = overlay.querySelector('.rpg-edit-entity-save');

        const closeModal = () => {
            overlay.remove();
        };

        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });

        // Add attack button
        const addAttackBtn = overlay.querySelector('#add-attack-btn');
        if (addAttackBtn) {
            addAttackBtn.addEventListener('click', () => {
                const attacksList = overlay.querySelector('#edit-entity-attacks-list');
                const newIndex = attacksList.children.length;
                const newItem = document.createElement('div');
                newItem.className = 'rpg-edit-list-item';
                newItem.dataset.index = newIndex;
                newItem.innerHTML = `
                    <input type="text" class="rpg-edit-attack-name text_pole" value="" placeholder="Attack name" />
                    <select class="rpg-edit-attack-type text_pole">
                        <option value="single-target">Single Target 🎯</option>
                        <option value="AoE">Area of Effect 💥</option>
                        <option value="both">Both ⚡</option>
                    </select>
                    <button class="rpg-edit-remove-btn" type="button" title="Remove"><i class="fa-solid fa-trash"></i></button>
                `;
                attacksList.appendChild(newItem);
            });
        }

        // Add item button
        const addItemBtn = overlay.querySelector('#add-item-btn');
        if (addItemBtn) {
            addItemBtn.addEventListener('click', () => {
                const itemsList = overlay.querySelector('#edit-entity-items-list');
                const newIndex = itemsList.children.length;
                const newItem = document.createElement('div');
                newItem.className = 'rpg-edit-list-item';
                newItem.dataset.index = newIndex;
                newItem.innerHTML = `
                    <input type="text" class="rpg-edit-item-name text_pole" value="" placeholder="Item name" />
                    <button class="rpg-edit-remove-btn" type="button" title="Remove"><i class="fa-solid fa-trash"></i></button>
                `;
                itemsList.appendChild(newItem);
            });
        }

        // Add status button
        const addStatusBtn = overlay.querySelector('#add-status-btn');
        if (addStatusBtn) {
            addStatusBtn.addEventListener('click', () => {
                const statusesList = overlay.querySelector('#edit-entity-statuses-list');
                const newIndex = statusesList.children.length;
                const newItem = document.createElement('div');
                newItem.className = 'rpg-edit-list-item';
                newItem.dataset.index = newIndex;
                newItem.innerHTML = `
                    <input type="text" class="rpg-edit-status-emoji text_pole" value="" placeholder="Emoji" style="width: 60px;" />
                    <input type="text" class="rpg-edit-status-name text_pole" value="" placeholder="Status name" />
                    <input type="number" class="rpg-edit-status-duration text_pole" value="0" placeholder="Duration" min="0" style="width: 80px;" />
                    <button class="rpg-edit-remove-btn" type="button" title="Remove"><i class="fa-solid fa-trash"></i></button>
                `;
                statusesList.appendChild(newItem);
            });
        }

        // Add custom bar button
        const addCustomBarBtn = overlay.querySelector('#add-custombar-btn');
        if (addCustomBarBtn) {
            addCustomBarBtn.addEventListener('click', () => {
                const customBarsList = overlay.querySelector('#edit-entity-custombars-list');
                const newIndex = customBarsList.children.length;
                const newItem = document.createElement('div');
                newItem.className = 'rpg-edit-list-item';
                newItem.dataset.index = newIndex;
                newItem.innerHTML = `
                    <input type="text" class="rpg-edit-bar-name text_pole" value="" placeholder="Bar name" style="flex: 1;" />
                    <input type="number" class="rpg-edit-bar-current text_pole" value="100" placeholder="Current" min="0" style="width: 80px;" />
                    <input type="number" class="rpg-edit-bar-max text_pole" value="100" placeholder="Max" min="1" style="width: 80px;" />
                    <input type="color" class="rpg-edit-bar-color text_pole" value="#4a7ba7" title="Bar color" style="width: 50px; padding: 2px;" />
                    <button class="rpg-edit-remove-btn" type="button" title="Remove"><i class="fa-solid fa-trash"></i></button>
                `;
                customBarsList.appendChild(newItem);
            });
        }

        // Use event delegation for remove buttons instead of individual listeners
        overlay.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('.rpg-edit-remove-btn');
            if (removeBtn) {
                e.preventDefault();
                e.stopPropagation();
                removeBtn.closest('.rpg-edit-list-item').remove();
            }

            // Handle emoji picker for status emoji fields
            const emojiInput = e.target.closest('.rpg-edit-status-emoji');
            if (emojiInput) {
                e.preventDefault();
                e.stopPropagation();
                // Use jQuery wrapper for compatibility with openEmojiPicker
                openEmojiPicker($(emojiInput));
            }
        });

        saveBtn.addEventListener('click', () => {
            try {
                const updatedEntity = {};

                // Collect basic fields (now including for player)
                const nameInput = document.getElementById('edit-entity-name');
                const hpInput = document.getElementById('edit-entity-hp');
                const maxHpInput = document.getElementById('edit-entity-maxhp');

                if (nameInput) updatedEntity.name = nameInput.value.trim();
                if (hpInput) updatedEntity.hp = parseInt(hpInput.value) || 0;
                if (maxHpInput) updatedEntity.maxHp = parseInt(maxHpInput.value) || 1;

                if (isEnemy) {
                    const spriteInput = document.getElementById('edit-entity-sprite');
                    const descInput = document.getElementById('edit-entity-description');
                    if (spriteInput) updatedEntity.sprite = spriteInput.value.trim();
                    if (descInput) updatedEntity.description = descInput.value.trim();
                }

                // Collect attacks
                const attacksList = overlay.querySelector('#edit-entity-attacks-list');
                updatedEntity.attacks = [];
                if (attacksList) {
                    attacksList.querySelectorAll('.rpg-edit-list-item').forEach(item => {
                        const nameInput = item.querySelector('.rpg-edit-attack-name');
                        const typeSelect = item.querySelector('.rpg-edit-attack-type');
                        if (nameInput && nameInput.value.trim()) {
                            updatedEntity.attacks.push({
                                name: nameInput.value.trim(),
                                type: typeSelect ? typeSelect.value : 'single-target'
                            });
                        }
                    });
                }

                // Collect items (for party members)
                if (!isEnemy) {
                    const itemsList = overlay.querySelector('#edit-entity-items-list');
                    updatedEntity.items = [];
                    if (itemsList) {
                        itemsList.querySelectorAll('.rpg-edit-list-item').forEach(item => {
                            const nameInput = item.querySelector('.rpg-edit-item-name');
                            if (nameInput && nameInput.value.trim()) {
                                updatedEntity.items.push(nameInput.value.trim());
                            }
                        });
                    }

                    // Preserve isPlayer flag
                    if (!isNew) {
                        updatedEntity.isPlayer = entity.isPlayer;
                    } else {
                        updatedEntity.isPlayer = false;
                    }
                }

                // Collect statuses (now including for player)
                const statusesList = overlay.querySelector('#edit-entity-statuses-list');
                updatedEntity.statuses = [];
                if (statusesList) {
                    statusesList.querySelectorAll('.rpg-edit-list-item').forEach(item => {
                        const emojiInput = item.querySelector('.rpg-edit-status-emoji');
                        const nameInput = item.querySelector('.rpg-edit-status-name');
                        const durationInput = item.querySelector('.rpg-edit-status-duration');
                        if (nameInput && nameInput.value.trim()) {
                            updatedEntity.statuses.push({
                                emoji: emojiInput ? emojiInput.value.trim() : '',
                                name: nameInput.value.trim(),
                                duration: durationInput ? parseInt(durationInput.value) || 0 : 0
                            });
                        }
                    });
                }

                // Collect custom bars
                const customBarsList = overlay.querySelector('#edit-entity-custombars-list');
                updatedEntity.customBars = [];
                if (customBarsList) {
                    customBarsList.querySelectorAll('.rpg-edit-list-item').forEach(item => {
                        const nameInput = item.querySelector('.rpg-edit-bar-name');
                        const currentInput = item.querySelector('.rpg-edit-bar-current');
                        const maxInput = item.querySelector('.rpg-edit-bar-max');
                        const colorInput = item.querySelector('.rpg-edit-bar-color');
                        if (nameInput && nameInput.value.trim()) {
                            updatedEntity.customBars.push({
                                name: nameInput.value.trim(),
                                current: currentInput ? parseInt(currentInput.value) || 0 : 0,
                                max: maxInput ? parseInt(maxInput.value) || 100 : 100,
                                color: colorInput ? colorInput.value : '#4a7ba7'
                            });
                        }
                    });
                }

                // Validate
                if (!updatedEntity.name) {
                    toastr.error('Name is required');
                    return;
                }

                if (updatedEntity.attacks.length === 0) {
                    toastr.error('At least one attack is required');
                    return;
                }

                // Update or add
                if (isNew) {
                    if (isEnemy) {
                        addEnemy(updatedEntity);
                    } else {
                        addPartyMember(updatedEntity);
                    }
                    toastr.success(`${isEnemy ? 'Enemy' : 'Party member'} added successfully`);
                } else {
                    if (isEnemy) {
                        updateEnemy(index, updatedEntity);
                    } else {
                        updatePartyMember(index, updatedEntity);
                    }
                    toastr.success(`${isEnemy ? 'Enemy' : 'Party member'} updated successfully`);
                }

                // Re-render the UI (attachControlListeners is called internally)
                this.renderCombatUI(currentEncounter.combatStats);

                // Autosave after edit
                saveEncounterState();

                closeModal();
            } catch (error) {
                console.error('[RPG Companion] Error saving entity:', error);
                toastr.error(`Error saving: ${error.message}`);
            }
        });
    }

    /**
     * Closes the modal and resets encounter state
     */
    close() {
        if (this.modal) {
            this.modal.classList.remove('is-open');
            resetEncounter();
        }
    }
}

// Export singleton instance
export const encounterModal = new EncounterModal();

/**
 * Opens the encounter modal
 */
export function openEncounterModal() {
    encounterModal.open();
}
