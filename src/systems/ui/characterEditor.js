/**
 * Character Editor Module
 * Advanced editing panel for Present Characters with Quick Reply-style interface
 * Part of RPG Companion Enhanced fork
 */

import { extensionSettings, lastGeneratedData, committedTrackerData } from '../../core/state.js';
import { saveChatData } from '../../core/persistence.js';
import { renderThoughts, updateCharacterField } from '../rendering/thoughts.js';
import {
    buildCharacterRegenerationPrompt,
    buildFieldRegenerationPrompt,
    callLLMForGeneration,
    parseCharacterRegenerationResponse,
    parseFieldRegenerationResponse
} from './characterRegeneration.js';
import { createPromptBuilder } from '../generation/modular-prompt-system/index.js';

/**
 * Character state storage for save/load functionality
 * Format: { characterName: { emoji, fields, relationship, stats, thoughts, timestamp } }
 */
let savedCharacterStates = {};

/**
 * Forces a layout refresh to fix character card stacking issues
 * This is needed after modals are removed from the DOM
 *
 * TODO: KNOWN ISSUE - Character Card Stacking Bug
 * ================================================
 * SYMPTOMS:
 * - Character cards occasionally stack horizontally (side-by-side) instead of vertically
 * - Only occurs when regenerating a field on the FIRST character in the list
 * - Only happens when that character has an avatar that loads from the character library
 * - Does NOT occur with manual edits, second+ characters, or characters without avatars
 * - Not consistently reproducible - seems timing-dependent
 *
 * ROOT CAUSE (suspected):
 * - Race condition between avatar image loading and flex layout calculation
 * - When the first character's avatar loads from library, the image load event may
 *   trigger a layout recalculation that interferes with the flex-direction: column
 * - The timing changes when multiple characters have avatars (explains why adding
 *   another character with an avatar prevents the bug)
 *
 * POTENTIAL FIXES TO INVESTIGATE:
 * 1. Add image.onload event handlers in getCharacterAvatar() that trigger layout reflow
 * 2. Use CSS contain property to isolate character card layouts
 * 3. Defer rendering until all avatar images have loaded (Promise.all approach)
 * 4. Add MutationObserver to detect layout changes and force correction
 * 5. Investigate if SillyTavern's thumbnail loading has completion callbacks we can use
 *
 * CURRENT MITIGATIONS:
 * - CSS hardening with !important flags on flex properties (style.css lines 1703-1861)
 * - Single render after modal close (prevents double-render race condition)
 * - forceLayoutRefresh() helper to manually trigger reflow when needed
 *
 * RELATED FILES:
 * - src/systems/rendering/thoughts.js (getCharacterAvatar, renderThoughts)
 * - style.css (.rpg-thoughts-content, .rpg-character-card)
 */
function forceLayoutRefresh() {
    const $thoughtsContent = $('.rpg-thoughts-content');
    if ($thoughtsContent.length > 0) {
        // Force a reflow by reading offsetHeight
        $thoughtsContent[0].offsetHeight;
        // Re-render the Present Characters section
        renderThoughts();
    }
}

/**
 * Opens the advanced character editor modal
 */
export function openCharacterEditor() {
    console.log('[RPG Companion] Opening character editor...');

    try {
        // Create modal if it doesn't exist
        let modal = document.getElementById('rpg-character-editor-modal');
        if (!modal) {
            console.log('[RPG Companion] Creating character editor modal...');
            createCharacterEditorModal();
            modal = document.getElementById('rpg-character-editor-modal');
        }

        // Apply theme to modal
        const theme = extensionSettings.theme || 'default';
        modal.setAttribute('data-theme', theme);

        // Populate with current character data
        console.log('[RPG Companion] Populating character editor...');
        populateCharacterEditor();

        // Show modal
        console.log('[RPG Companion] Showing modal...');
        modal.classList.add('is-open');
        console.log('[RPG Companion] Character editor opened successfully');
    } catch (error) {
        console.error('[RPG Companion] Error opening character editor:', error);
        toastr.error('Failed to open character editor: ' + error.message, 'RPG Companion');
    }
}

/**
 * Creates the character editor modal DOM structure
 */
function createCharacterEditorModal() {
    const modalHTML = `
        <div id="rpg-character-editor-modal" class="rpg-settings-popup" role="dialog" aria-modal="true">
            <div class="rpg-settings-popup-content" style="max-width: 800px;">
                <header class="rpg-settings-popup-header">
                    <h3>
                        <i class="fa-solid fa-users-gear"></i>
                        <span>Advanced Character Editor</span>
                    </h3>
                    <button id="rpg-character-editor-close" class="rpg-popup-close" type="button">&times;</button>
                </header>

                <div class="rpg-settings-popup-body" style="max-height: 70vh; overflow-y: auto;">
                    <div id="rpg-character-editor-content">
                        <!-- Content populated by JavaScript -->
                    </div>
                </div>

                <footer class="rpg-settings-popup-footer">
                    <button id="rpg-character-editor-add" class="rpg-btn-primary" type="button">
                        <i class="fa-solid fa-plus"></i> Add Character
                    </button>
                    <div class="rpg-footer-right">
                        <button id="rpg-character-editor-cancel" class="rpg-btn-secondary" type="button">Cancel</button>
                        <button id="rpg-character-editor-save" class="rpg-btn-primary" type="button">
                            <i class="fa-solid fa-save"></i> Save Changes
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    `;

    $('body').append(modalHTML);

    // Event handlers
    $('#rpg-character-editor-close, #rpg-character-editor-cancel').on('click', closeCharacterEditor);
    $('#rpg-character-editor-save').on('click', saveCharacterEditorChanges);
    $('#rpg-character-editor-add').on('click', addNewCharacterInEditor);
}

/**
 * Populates the editor with current character data
 */
function populateCharacterEditor() {
    const content = $('#rpg-character-editor-content');
    const config = extensionSettings.trackerConfig?.presentCharacters;
    const enabledFields = config?.customFields?.filter(f => f && f.enabled && f.name) || [];
    const characterStatsConfig = config?.characterStats;
    const enabledCharStats = characterStatsConfig?.enabled && characterStatsConfig?.customStats?.filter(s => s && s.enabled && s.name) || [];

    // Parse current character data
    const characters = parseCharactersFromData();

    let html = '<div class="rpg-character-editor-list">';

    if (characters.length === 0) {
        html += '<p style="text-align: center; color: #888; padding: 20px;">No characters present. Click "Add Character" to create one.</p>';
    } else {
        characters.forEach((char, index) => {
            html += renderCharacterEditorCard(char, index, enabledFields, enabledCharStats);
        });
    }

    html += '</div>';
    content.html(html);

    // Attach event handlers
    attachCharacterEditorHandlers();
}

/**
 * Parses character data from lastGeneratedData
 * @returns {Array} Array of character objects
 */
function parseCharactersFromData() {
    const characterThoughtsData = lastGeneratedData.characterThoughts || '';
    if (!characterThoughtsData) return [];

    const lines = characterThoughtsData.split('\n');
    const characters = [];
    const config = extensionSettings.trackerConfig?.presentCharacters;
    const enabledFields = config?.customFields?.filter(f => f && f.enabled && f.name) || [];
    const characterStatsConfig = config?.characterStats;
    const enabledCharStats = characterStatsConfig?.enabled && characterStatsConfig?.customStats?.filter(s => s && s.enabled && s.name) || [];

    let currentCharacter = null;

    for (const line of lines) {
        const trimmed = line.trim();

        // Character name line
        if (trimmed.startsWith('- ')) {
            if (currentCharacter) {
                characters.push(currentCharacter);
            }
            currentCharacter = { name: trimmed.substring(2).trim() };
        }
        // Details line
        else if (trimmed.startsWith('Details:') && currentCharacter) {
            const detailsContent = trimmed.substring(trimmed.indexOf(':') + 1).trim();
            const parts = detailsContent.split('|').map(p => p.trim());
            
            if (parts.length > 0) {
                currentCharacter.emoji = parts[0];
            }
            
            for (let i = 0; i < enabledFields.length && i + 1 < parts.length; i++) {
                currentCharacter[enabledFields[i].name] = parts[i + 1];
            }
        }
        // Relationship line
        else if (trimmed.startsWith('Relationship:') && currentCharacter) {
            currentCharacter.relationship = trimmed.substring(trimmed.indexOf(':') + 1).trim();
        }
        // Stats line
        else if (trimmed.startsWith('Stats:') && currentCharacter) {
            const statsContent = trimmed.substring(trimmed.indexOf(':') + 1).trim();
            const statParts = statsContent.split('|').map(p => p.trim());
            currentCharacter.stats = {};

            statParts.forEach(statPart => {
                const match = statPart.match(/^(.+?):\s*(\d+)%$/);
                if (match) {
                    currentCharacter.stats[match[1]] = parseInt(match[2]);
                }
            });
        }
        // Thoughts line
        else if (trimmed.startsWith('Thoughts:') && currentCharacter) {
            currentCharacter.thoughts = trimmed.substring(trimmed.indexOf(':') + 1).trim();
        }
    }

    // Push last character
    if (currentCharacter) {
        characters.push(currentCharacter);
    }

    return characters;
}

/**
 * Renders a character card in the editor
 */
function renderCharacterEditorCard(char, index, enabledFields, enabledCharStats) {
    const escapeName = (name) => String(name || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const escapedName = escapeName(char.name);

    let html = `
        <div class="rpg-char-editor-card" data-index="${index}" data-character="${escapedName}">
            <div class="rpg-char-editor-header">
                <div class="rpg-char-editor-title">
                    <input type="text" class="rpg-char-editor-emoji" value="${char.emoji || '😊'}"
                           data-field="emoji" placeholder="😊" maxlength="2" />
                    <input type="text" class="rpg-char-editor-name" value="${char.name || ''}"
                           data-field="name" placeholder="Character Name" />
                </div>
                <div class="rpg-char-editor-actions">
                    <button class="rpg-char-editor-btn rpg-char-save-state" title="Save character state">
                        <i class="fa-solid fa-floppy-disk"></i>
                    </button>
                    <button class="rpg-char-editor-btn rpg-char-regen" title="Regenerate character">
                        <i class="fa-solid fa-rotate"></i>
                    </button>
                    <button class="rpg-char-editor-btn rpg-char-remove" title="Remove character">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>

            <div class="rpg-char-editor-fields">
    `;

    // Render custom fields
    enabledFields.forEach(field => {
        const value = char[field.name] || '';
        const fieldId = field.name.toLowerCase().replace(/\s+/g, '-');

        if (field.type === 'relationship') {
            // Relationship dropdown
            const relationshipOptions = extensionSettings.trackerConfig?.presentCharacters?.relationshipFields || ['Enemy', 'Neutral', 'Friend', 'Lover'];
            html += `
                <div class="rpg-char-editor-field">
                    <label>${field.name}:</label>
                    <select class="rpg-char-editor-input" data-field="${escapeName(field.name)}">
                        ${relationshipOptions.map(opt =>
                            `<option value="${opt}" ${char.relationship === opt ? 'selected' : ''}>${opt}</option>`
                        ).join('')}
                    </select>
                </div>
            `;
        } else {
            // Text input
            html += `
                <div class="rpg-char-editor-field">
                    <label>${field.name}:</label>
                    <input type="text" class="rpg-char-editor-input" data-field="${escapeName(field.name)}"
                           value="${value}" placeholder="${field.description || field.name}" />
                    <button class="rpg-char-field-regen" data-field="${escapeName(field.name)}" title="Regenerate this field">
                        <i class="fa-solid fa-rotate"></i>
                    </button>
                </div>
            `;
        }
    });

    // Render character stats if enabled
    if (enabledCharStats && enabledCharStats.length > 0) {
        html += '<div class="rpg-char-editor-stats">';
        enabledCharStats.forEach(stat => {
            const value = char.stats?.[stat.name] || 50;
            html += `
                <div class="rpg-char-editor-stat">
                    <label>${stat.name}:</label>
                    <input type="number" class="rpg-char-editor-stat-input" data-stat="${escapeName(stat.name)}"
                           value="${value}" min="0" max="100"
                           style="background: #1a1a2e !important; background-color: #1a1a2e !important; color: #ffffff !important; border: 1px solid #444 !important; border-style: solid !important; color-scheme: dark !important;" />
                    <span>%</span>
                </div>
            `;
        });
        html += '</div>';
    }

    // Thoughts field
    const thoughtsLabel = extensionSettings.trackerConfig?.presentCharacters?.thoughts?.name || 'Thoughts';
    html += `
        <div class="rpg-char-editor-field rpg-char-editor-thoughts">
            <label>${thoughtsLabel}:</label>
            <textarea class="rpg-char-editor-textarea" data-field="thoughts" rows="3"
                      placeholder="Character's internal thoughts..."
                      style="background: #1a1a2e !important; background-color: #1a1a2e !important; color: #ffffff !important; border: 1px solid #444 !important; border-style: solid !important; color-scheme: dark !important;">${char.thoughts || ''}</textarea>
            <button class="rpg-char-field-regen" data-field="thoughts" title="Regenerate thoughts"
                    style="background: #2a2a3e !important; background-color: #2a2a3e !important; color: #ffffff !important; border: 1px solid #444 !important; border-style: solid !important;">
                <i class="fa-solid fa-rotate" style="color: #ffffff !important;"></i>
            </button>
        </div>
    `;

    html += `
            </div>
        </div>
    `;

    return html;
}

/**
 * Attaches event handlers to editor elements
 */
function attachCharacterEditorHandlers() {
    // Remove character
    $('.rpg-char-remove').off('click').on('click', function() {
        const card = $(this).closest('.rpg-char-editor-card');
        card.fadeOut(200, function() {
            card.remove();
        });
    });

    // Save character state
    $('.rpg-char-save-state').off('click').on('click', function() {
        const card = $(this).closest('.rpg-char-editor-card');
        saveCharacterState(card);
    });

    // Regenerate character
    $('.rpg-char-regen').off('click').on('click', function() {
        const card = $(this).closest('.rpg-char-editor-card');
        regenerateCharacter(card);
    });

    // Regenerate specific field
    $('.rpg-char-field-regen').off('click').on('click', function() {
        const card = $(this).closest('.rpg-char-editor-card');
        const field = $(this).data('field');
        regenerateCharacterField(card, field);
    });
}

/**
 * Closes the character editor modal
 */
function closeCharacterEditor() {
    $('#rpg-character-editor-modal').removeClass('is-open');
    // Force layout refresh after modal closes to prevent character card stacking
    setTimeout(() => forceLayoutRefresh(), 250);
}

/**
 * Saves changes from the editor back to the data
 */
function saveCharacterEditorChanges() {
    const cards = $('.rpg-char-editor-card');
    const config = extensionSettings.trackerConfig?.presentCharacters;
    const enabledFields = config?.customFields?.filter(f => f && f.enabled && f.name) || [];
    const characterStatsConfig = config?.characterStats;
    const enabledCharStats = characterStatsConfig?.enabled && characterStatsConfig?.customStats?.filter(s => s && s.enabled && s.name) || [];

    // Build new character thoughts data
    let newData = 'Present Characters\n---\n';

    cards.each(function() {
        const card = $(this);
        const name = card.find('.rpg-char-editor-name').val().trim();
        if (!name) return; // Skip empty names

        const emoji = card.find('.rpg-char-editor-emoji').val().trim() || '😊';

        // Build character block
        newData += `- ${name}\n`;

        // Details line
        let detailsParts = [emoji];
        enabledFields.forEach(field => {
            if (field.type === 'relationship') return; // Skip relationship in details
            const value = card.find(`.rpg-char-editor-input[data-field="${field.name}"]`).val() || '';
            detailsParts.push(value);
        });
        newData += `Details: ${detailsParts.join(' | ')}\n`;

        // Relationship line
        const relationship = card.find('.rpg-char-editor-input[data-field="Relationship"]').val();
        if (relationship) {
            newData += `Relationship: ${relationship}\n`;
        }

        // Stats line
        if (enabledCharStats && enabledCharStats.length > 0) {
            let statsParts = [];
            enabledCharStats.forEach(stat => {
                const value = card.find(`.rpg-char-editor-stat-input[data-stat="${stat.name}"]`).val() || 50;
                statsParts.push(`${stat.name}: ${value}%`);
            });
            if (statsParts.length > 0) {
                newData += `Stats: ${statsParts.join(' | ')}\n`;
            }
        }

        // Thoughts line
        const thoughts = card.find('.rpg-char-editor-textarea[data-field="thoughts"]').val() || '';
        if (thoughts) {
            newData += `Thoughts: ${thoughts}\n`;
        }

        newData += '\n'; // Blank line between characters
    });

    // Update both lastGeneratedData and committedTrackerData
    lastGeneratedData.characterThoughts = newData;
    committedTrackerData.characterThoughts = newData;

    // Save to chat metadata
    saveChatData();

    // Close modal first (without triggering forceLayoutRefresh)
    $('#rpg-character-editor-modal').removeClass('is-open');

    // Then render once after a short delay to ensure modal is fully closed
    setTimeout(() => {
        renderThoughts();
        toastr.success('Character data saved successfully', 'RPG Companion');
    }, 100);
}

/**
 * Adds a new empty character to the editor
 */
function addNewCharacterInEditor() {
    // Show add character modal
    showAddCharacterModal();
}

/**
 * Shows a modal to add a new character
 */
function showAddCharacterModal() {
    // Create modal HTML
    const modalHtml = `
        <div id="rpg-add-character-modal" class="rpg-settings-popup is-open" role="dialog" aria-modal="true">
            <div class="rpg-settings-popup-content" style="max-width: 500px;">
                <header class="rpg-settings-popup-header">
                    <h3>
                        <i class="fa-solid fa-user-plus"></i>
                        <span>Add New Character</span>
                    </h3>
                    <button id="rpg-add-char-close" class="rpg-popup-close" type="button">&times;</button>
                </header>

                <div class="rpg-settings-popup-body">
                    <div style="margin-bottom: 16px;">
                        <label for="rpg-add-char-name" style="display: block; margin-bottom: 8px; font-weight: 600;">Character Name:</label>
                        <input type="text" id="rpg-add-char-name" class="text_pole" placeholder="Enter character name..."
                               style="width: 100%; padding: 8px; border: 1px solid var(--SmartThemeBorderColor); border-radius: 4px; background: var(--SmartThemeBlurTintColor); color: var(--SmartThemeBodyColor);" />
                    </div>

                    <div style="margin-bottom: 16px;">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="checkbox" id="rpg-add-char-search-context" checked />
                            <span>Search chat for character context (recommended)</span>
                        </label>
                        <p style="font-size: 12px; color: #888; margin: 4px 0 0 24px;">
                            Searches recent messages for mentions of this character to pre-fill fields.
                        </p>
                    </div>

                    <div id="rpg-add-char-context-results" style="display: none; margin-top: 12px; padding: 12px; background: var(--black30a); border-radius: 4px; max-height: 150px; overflow-y: auto;">
                        <p style="font-size: 12px; color: #888; margin-bottom: 8px;">Found context:</p>
                        <div id="rpg-add-char-context-text" style="font-size: 12px; color: var(--SmartThemeBodyColor);"></div>
                    </div>
                </div>

                <footer class="rpg-settings-popup-footer">
                    <button id="rpg-add-char-cancel" class="rpg-btn-secondary" type="button">Cancel</button>
                    <button id="rpg-add-char-confirm" class="rpg-btn-primary" type="button">
                        <i class="fa-solid fa-plus"></i> Add Character
                    </button>
                </footer>
            </div>
        </div>
    `;

    // Remove existing modal if present
    $('#rpg-add-character-modal').remove();

    // Add modal to body
    $('body').append(modalHtml);

    // Apply theme to modal
    const theme = extensionSettings.theme || 'default';
    $('#rpg-add-character-modal').attr('data-theme', theme);

    // Focus on name input
    setTimeout(() => $('#rpg-add-char-name').focus(), 100);

    // Event handlers
    $('#rpg-add-char-close, #rpg-add-char-cancel').on('click', () => {
        $('#rpg-add-character-modal').removeClass('is-open');
        setTimeout(() => $('#rpg-add-character-modal').remove(), 200);
    });

    $('#rpg-add-char-confirm').on('click', () => {
        const name = $('#rpg-add-char-name').val().trim();
        const searchContext = $('#rpg-add-char-search-context').is(':checked');

        if (!name) {
            toastr.warning('Please enter a character name', 'RPG Companion');
            return;
        }

        // Close modal
        $('#rpg-add-character-modal').removeClass('is-open');
        setTimeout(() => $('#rpg-add-character-modal').remove(), 200);

        // Add the character
        addCharacterToEditor(name, searchContext);
    });

    // Enter key to confirm
    $('#rpg-add-char-name').on('keypress', (e) => {
        if (e.which === 13) {
            $('#rpg-add-char-confirm').click();
        }
    });
}

/**
 * Adds a character to the editor with optional context search
 */
function addCharacterToEditor(name, searchContext = false) {
    const config = extensionSettings.trackerConfig?.presentCharacters;
    const enabledFields = config?.customFields?.filter(f => f && f.enabled && f.name) || [];
    const characterStatsConfig = config?.characterStats;
    const enabledCharStats = characterStatsConfig?.enabled && characterStatsConfig?.customStats?.filter(s => s && s.enabled && s.name) || [];

    // Check if character already exists
    const existingCharacters = parseCharactersFromData();
    if (existingCharacters.some(char => char.name.toLowerCase() === name.toLowerCase())) {
        toastr.warning(`Character "${name}" already exists`, 'RPG Companion');
        return;
    }

    // Create a new character object with default values
    const newCharacter = {
        name: name,
        emoji: '😊',
        relationship: 'Neutral',
        thoughts: '',
        stats: {}
    };

    // Add default values for enabled fields
    enabledFields.forEach(field => {
        if (field.type !== 'relationship') {
            newCharacter[field.name] = '';
        }
    });

    // Add default stats
    enabledCharStats.forEach(stat => {
        newCharacter.stats[stat.name] = 50; // Default to 50%
    });

    // TODO: If searchContext is true, search chat history for character mentions
    // and try to pre-fill some fields. This will be implemented in the next iteration.

    // Render the new character card at the top of the list
    const newCardHtml = renderCharacterEditorCard(newCharacter, 0, enabledFields, enabledCharStats);
    $('.rpg-character-editor-list').prepend(newCardHtml);

    // Re-attach event handlers
    attachCharacterEditorHandlers();

    toastr.success(`Character "${name}" added`, 'RPG Companion');

    // Scroll to the new character
    $('.rpg-character-editor-list').scrollTop(0);
}

/**
 * Saves the current state of a character for later restoration
 */
function saveCharacterState(card) {
    // This will be implemented in the next section
    toastr.info('Save character state feature coming soon', 'RPG Companion');
}

/**
 * Regenerates an entire character
 */
async function regenerateCharacter(card) {
    const characterName = card.find('.rpg-char-editor-name').val().trim();

    if (!characterName) {
        toastr.warning('Character must have a name to regenerate', 'RPG Companion');
        return;
    }

    // Show guidance modal
    showGuidanceModal(
        'Regenerate Character',
        `Regenerate all fields for "${characterName}"`,
        'Any specific direction for the regeneration? (Optional)',
        async (guidance) => {
            try {
                toastr.info(`Regenerating ${characterName}...`, 'RPG Companion');

                // Get current character data
                const config = extensionSettings.trackerConfig?.presentCharacters;
                const enabledFields = config?.customFields?.filter(f => f && f.enabled && f.name) || [];
                const characterStatsConfig = config?.characterStats;
                const enabledCharStats = characterStatsConfig?.enabled && characterStatsConfig?.customStats?.filter(s => s && s.enabled && s.name) || [];

                const currentData = {
                    emoji: card.find('.rpg-char-editor-emoji').val().trim(),
                    relationship: card.find('.rpg-char-editor-input[data-field="Relationship"]').val(),
                    stats: {}
                };

                // Get current field values
                enabledFields.forEach(field => {
                    if (field.type !== 'relationship') {
                        currentData[field.name] = card.find(`.rpg-char-editor-input[data-field="${field.name}"]`).val() || '';
                    }
                });

                // Get current stats
                enabledCharStats.forEach(stat => {
                    currentData.stats[stat.name] = parseInt(card.find(`.rpg-char-editor-stat-input[data-stat="${stat.name}"]`).val()) || 50;
                });

                // Use the modular prompt builder system
                const builder = createPromptBuilder(extensionSettings, 'characterEditor');

                console.log('[RPG Companion] Regenerating character in editor:', characterName);
                console.log('[RPG Companion] Using prompt builder with guidance:', guidance);

                // Generate using the prompt builder with guidance and character context
                const response = await builder.generate({
                    guidance,
                    characterName,
                    currentData,
                    enabledFields,
                    enabledStats: enabledCharStats
                });

                // Parse response
                const newData = parseCharacterRegenerationResponse(response, enabledFields, enabledCharStats);

                // Update UI
                card.find('.rpg-char-editor-emoji').val(newData.emoji);
                card.find('.rpg-char-editor-input[data-field="Relationship"]').val(newData.relationship);

                enabledFields.forEach(field => {
                    if (field.type !== 'relationship' && newData[field.name]) {
                        card.find(`.rpg-char-editor-input[data-field="${field.name}"]`).val(newData[field.name]);
                    }
                });

                enabledCharStats.forEach(stat => {
                    if (newData.stats[stat.name] !== undefined) {
                        card.find(`.rpg-char-editor-stat-input[data-stat="${stat.name}"]`).val(newData.stats[stat.name]);
                    }
                });

                // Update thoughts field
                if (newData.thoughts) {
                    card.find('.rpg-char-editor-textarea[data-field="thoughts"]').val(newData.thoughts);
                }

                toastr.success(`${characterName} regenerated successfully`, 'RPG Companion');
            } catch (error) {
                console.error('[RPG Companion] Character regeneration failed:', error);
                toastr.error(`Failed to regenerate ${characterName}: ${error.message}`, 'RPG Companion');
            }
        }
    );
}

/**
 * Regenerates a specific field of a character
 */
async function regenerateCharacterField(card, fieldName) {
    const characterName = card.find('.rpg-char-editor-name').val().trim();

    if (!characterName) {
        toastr.warning('Character must have a name to regenerate fields', 'RPG Companion');
        return;
    }

    // Get field configuration
    const config = extensionSettings.trackerConfig?.presentCharacters;
    const enabledFields = config?.customFields?.filter(f => f && f.enabled && f.name) || [];
    const fieldConfig = enabledFields.find(f => f.name === fieldName);

    // Show guidance modal
    showGuidanceModal(
        'Regenerate Field',
        `Regenerate "${fieldName}" for "${characterName}"`,
        'Any specific direction for this field? (Optional)',
        async (guidance) => {
            try {
                toastr.info(`Regenerating ${fieldName}...`, 'RPG Companion');

                // Get current character data
                const currentData = {};
                enabledFields.forEach(field => {
                    currentData[field.name] = card.find(`.rpg-char-editor-input[data-field="${field.name}"]`).val() || '';
                });

                // Determine which component to use: thoughtBubble for thoughts field, characterField for others
                const isThoughtsField = fieldName.toLowerCase() === 'thoughts';
                const componentType = isThoughtsField ? 'thoughtBubble' : 'characterField';

                // Use the modular prompt builder system
                const builder = createPromptBuilder(extensionSettings, componentType);

                console.log('[RPG Companion] Regenerating character field:', fieldName, 'for', characterName);
                console.log('[RPG Companion] Using prompt builder component:', componentType);
                console.log('[RPG Companion] Using prompt builder with guidance:', guidance);

                // Generate using the prompt builder with guidance and field context
                const response = await builder.generate({
                    guidance,
                    characterName,
                    fieldName,
                    currentData,
                    fieldConfig
                });

                // Parse response
                const newValue = parseFieldRegenerationResponse(response);

                // Update UI - check if it's the thoughts field (textarea) or regular field (input)
                if (fieldName.toLowerCase() === 'thoughts') {
                    card.find('.rpg-char-editor-textarea[data-field="thoughts"]').val(newValue);
                } else {
                    card.find(`.rpg-char-editor-input[data-field="${fieldName}"]`).val(newValue);
                }

                toastr.success(`${fieldName} regenerated successfully`, 'RPG Companion');
            } catch (error) {
                console.error('[RPG Companion] Field regeneration failed:', error);
                toastr.error(`Failed to regenerate ${fieldName}: ${error.message}`, 'RPG Companion');
            }
        }
    );
}

/**
 * Shows a modal to get optional guidance from the user
 * @param {string} title - Modal title
 * @param {string} description - Description of what's being regenerated
 * @param {string} placeholder - Placeholder text for the input
 * @param {Function} callback - Callback function that receives the guidance text
 */
function showGuidanceModal(title, description, placeholder, callback) {
    const modalHtml = `
        <div id="rpg-guidance-modal" class="rpg-settings-popup is-open" role="dialog" aria-modal="true">
            <div class="rpg-settings-popup-content" style="max-width: 600px;">
                <header class="rpg-settings-popup-header">
                    <h3>
                        <i class="fa-solid fa-wand-magic-sparkles"></i>
                        <span>${title}</span>
                    </h3>
                    <button id="rpg-guidance-close" class="rpg-popup-close" type="button">&times;</button>
                </header>

                <div class="rpg-settings-popup-body">
                    <p style="margin-bottom: 12px; color: var(--SmartThemeBodyColor);">${description}</p>

                    <div style="margin-bottom: 16px;">
                        <label for="rpg-guidance-input" style="display: block; margin-bottom: 8px; font-weight: 600;">
                            Guidance (Optional):
                        </label>
                        <textarea id="rpg-guidance-input" class="text_pole" placeholder="${placeholder}"
                                  style="width: 100%; min-height: 100px; padding: 8px; border: 1px solid var(--SmartThemeBorderColor);
                                         border-radius: 4px; background: var(--SmartThemeBlurTintColor); color: var(--SmartThemeBodyColor);
                                         resize: vertical; font-family: inherit;"></textarea>
                        <p style="font-size: 12px; color: #888; margin-top: 4px;">
                            Leave empty to regenerate without specific guidance. The AI will use the current scene context.
                        </p>
                    </div>
                </div>

                <footer class="rpg-settings-popup-footer">
                    <button id="rpg-guidance-cancel" class="rpg-btn-secondary" type="button">Cancel</button>
                    <button id="rpg-guidance-confirm" class="rpg-btn-primary" type="button">
                        <i class="fa-solid fa-wand-magic-sparkles"></i> Regenerate
                    </button>
                </footer>
            </div>
        </div>
    `;

    // Remove existing modal if present
    $('#rpg-guidance-modal').remove();

    // Add modal to body
    $('body').append(modalHtml);

    // Apply theme to modal
    const theme = extensionSettings.theme || 'default';
    $('#rpg-guidance-modal').attr('data-theme', theme);

    // Focus on input
    setTimeout(() => $('#rpg-guidance-input').focus(), 100);

    // Event handlers
    $('#rpg-guidance-close, #rpg-guidance-cancel').on('click', () => {
        $('#rpg-guidance-modal').removeClass('is-open');
        setTimeout(() => {
            $('#rpg-guidance-modal').remove();
            // Force layout recalculation to fix character card stacking bug
            forceLayoutRefresh();
        }, 200);
    });

    $('#rpg-guidance-confirm').on('click', () => {
        const guidance = $('#rpg-guidance-input').val().trim();

        // Close modal
        $('#rpg-guidance-modal').removeClass('is-open');
        setTimeout(() => {
            $('#rpg-guidance-modal').remove();
            // Force layout recalculation to fix character card stacking bug
            forceLayoutRefresh();
        }, 200);

        // Call callback with guidance
        callback(guidance);
    });

    // Ctrl+Enter to confirm
    $('#rpg-guidance-input').on('keydown', (e) => {
        if (e.ctrlKey && e.which === 13) {
            $('#rpg-guidance-confirm').click();
        }
    });
}

/**
 * Regenerates a character from the character card (not from editor)
 * @param {string} characterName - Name of the character to regenerate
 */
export async function regenerateCharacterFromCard(characterName) {
    if (!characterName) {
        toastr.warning('Character name is required', 'RPG Companion');
        return;
    }

    // Show guidance modal
    showGuidanceModal(
        'Regenerate Character',
        `Regenerate all fields for "${characterName}"`,
        'Any specific direction for the regeneration? (Optional)',
        async (guidance) => {
            try {
                toastr.info(`Regenerating ${characterName}...`, 'RPG Companion');

                // Get current character data from lastGeneratedData
                const characters = parseCharactersFromData(lastGeneratedData.characterThoughts || '');
                const currentChar = characters.find(c => c.name.toLowerCase() === characterName.toLowerCase());

                if (!currentChar) {
                    toastr.error(`Character ${characterName} not found`, 'RPG Companion');
                    return;
                }

                // Get configuration
                const config = extensionSettings.trackerConfig?.presentCharacters;
                const enabledFields = config?.customFields?.filter(f => f && f.enabled && f.name) || [];
                const characterStatsConfig = config?.characterStats;
                const enabledCharStats = characterStatsConfig?.enabled && characterStatsConfig?.customStats?.filter(s => s && s.enabled && s.name) || [];

                // Use the modular prompt builder system
                const builder = createPromptBuilder(extensionSettings, 'characterCard');

                console.log('[RPG Companion] Regenerating character from card:', characterName);
                console.log('[RPG Companion] Using prompt builder with guidance:', guidance);

                // Generate using the prompt builder with guidance and character context
                const response = await builder.generate({
                    guidance,
                    characterName,
                    currentData: currentChar,
                    enabledFields,
                    enabledStats: enabledCharStats
                });

                if (!response) {
                    toastr.error('Failed to regenerate character', 'RPG Companion');
                    return;
                }

                // Parse response
                const updatedData = parseCharacterRegenerationResponse(response, enabledFields, enabledCharStats);

                // Update character in data
                const lines = lastGeneratedData.characterThoughts.split('\n');
                const newLines = [];
                let inTargetCharacter = false;
                let characterUpdated = false;

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const trimmedLine = line.trim();

                    // Check if this is the start of a character (starts with "- ")
                    if (trimmedLine.startsWith('- ')) {
                        // If we were in the target character, we're done with it
                        if (inTargetCharacter) {
                            inTargetCharacter = false;
                        }

                        const name = trimmedLine.substring(2).trim();
                        if (name.toLowerCase() === characterName.toLowerCase()) {
                            inTargetCharacter = true;
                            characterUpdated = true;

                            // Add character name (without emoji)
                            newLines.push(`- ${characterName}`);

                            // Build Details line: Emoji | Field1 | Field2 | ...
                            const detailsParts = [updatedData.emoji || currentChar.emoji || '😊'];
                            enabledFields.forEach(field => {
                                if (field.type !== 'relationship' && updatedData[field.name]) {
                                    detailsParts.push(updatedData[field.name]);
                                }
                            });
                            newLines.push(`Details: ${detailsParts.join(' | ')}`);

                            // Add relationship if exists
                            if (updatedData.relationship) {
                                newLines.push(`Relationship: ${updatedData.relationship}`);
                            }

                            // Add stats if enabled
                            if (enabledCharStats.length > 0 && updatedData.stats) {
                                const statsLine = enabledCharStats.map(stat =>
                                    `${stat.name}: ${updatedData.stats[stat.name] || 50}%`
                                ).join(' | ');
                                newLines.push(`Stats: ${statsLine}`);
                            }

                            // Add thoughts
                            if (updatedData.thoughts) {
                                newLines.push(`Thoughts: ${updatedData.thoughts}`);
                            }

                            continue; // Skip the original character name line
                        } else {
                            // Different character, keep the line
                            newLines.push(line);
                        }
                    }
                    // If we're in the target character, skip their old field lines
                    else if (inTargetCharacter) {
                        // Skip Details, Relationship, Stats, Thoughts lines for target character
                        // These have already been added with updated data
                        continue;
                    }
                    // Not in target character, keep the line
                    else {
                        newLines.push(line);
                    }
                }

                if (characterUpdated) {
                    // Update data
                    lastGeneratedData.characterThoughts = newLines.join('\n');
                    committedTrackerData.characterThoughts = newLines.join('\n');

                    // Save to chat metadata
                    saveChatData();

                    // Re-render
                    renderThoughts();

                    toastr.success(`${characterName} regenerated successfully`, 'RPG Companion');
                } else {
                    toastr.error(`Failed to update ${characterName}`, 'RPG Companion');
                }

            } catch (error) {
                console.error('[RPG Companion] Error regenerating character:', error);
                toastr.error(`Failed to regenerate ${characterName}: ${error.message}`, 'RPG Companion');
            }
        }
    );
}

export {
    savedCharacterStates,
    parseCharactersFromData
};


