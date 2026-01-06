/**
 * Encounter Profiles Module
 * Defines encounter profile schema, validation, sanitization, and preset profiles
 */

import { extensionSettings } from '../../core/state.js';

/**
 * @typedef {Object} EncounterProfile
 * @property {string} id - Unique identifier for the profile
 * @property {string} name - Display name for the profile
 * @property {string} ENCOUNTER_TYPE - Type of encounter (e.g., "combat", "social", "stealth")
 * @property {string} ENCOUNTER_GOAL - What success means in this encounter
 * @property {string} ENCOUNTER_STAKES - Stakes level: "low", "medium", or "high"
 * @property {string} RESOURCE_INTERPRETATION - What HP represents in this encounter type
 * @property {string} ACTION_INTERPRETATION - What attacks represent in this encounter type
 * @property {string} STATUS_INTERPRETATION - What statuses represent in this encounter type
 * @property {string} SUMMARY_FRAMING - How to frame the summary for this encounter type
 * @property {boolean} isPreset - Whether this is a built-in preset (cannot be deleted)
 * @property {string} description - Optional description of the profile for users
 *
 * UI-Specific Labels (for customizing the encounter interface):
 * @property {string} ENEMY_LABEL_SINGULAR - Singular form for enemies (e.g., "Enemy", "Opponent", "Guard")
 * @property {string} ENEMY_LABEL_PLURAL - Plural form for enemies (e.g., "Enemies", "Opponents", "Guards")
 * @property {string} PARTY_LABEL_SINGULAR - Singular form for party members (e.g., "Ally", "Teammate", "Agent")
 * @property {string} PARTY_LABEL_PLURAL - Plural form for party members (e.g., "Party", "Team", "Allies")
 * @property {string} RESOURCE_LABEL - Short label for HP bar (e.g., "HP", "Composure", "Cover")
 * @property {string} ACTION_SECTION_LABEL - Label for player actions section (e.g., "Attacks", "Arguments", "Moves")
 * @property {string} VICTORY_TERM - Term for winning (e.g., "Victory", "Success", "Persuaded")
 * @property {string} DEFEAT_TERM - Term for losing (e.g., "Defeat", "Failure", "Exposed")
 * @property {string} FLED_TERM - Term for fleeing (e.g., "Fled", "Withdrew", "Retreated")
 */

/**
 * Default combat profile - maintains backward compatibility with existing behavior
 * @type {EncounterProfile}
 */
export const DEFAULT_COMBAT_PROFILE = {
    id: 'default-combat',
    name: 'Combat',
    ENCOUNTER_TYPE: 'Combat',
    ENCOUNTER_GOAL: 'defeat opposing forces',
    ENCOUNTER_STAKES: 'medium',
    RESOURCE_INTERPRETATION: 'physical health and endurance',
    ACTION_INTERPRETATION: 'attacks, skills, and combat maneuvers',
    STATUS_INTERPRETATION: 'physical or magical conditions',
    SUMMARY_FRAMING: 'a complete battle recap',
    // UI Labels
    ENEMY_LABEL_SINGULAR: 'Enemy',
    ENEMY_LABEL_PLURAL: 'Enemies',
    PARTY_LABEL_SINGULAR: 'Ally',
    PARTY_LABEL_PLURAL: 'Party',
    RESOURCE_LABEL: 'HP',
    ACTION_SECTION_LABEL: 'Attacks',
    VICTORY_TERM: 'Victory',
    DEFEAT_TERM: 'Defeat',
    FLED_TERM: 'Fled',
    isPreset: true,
    description: 'Traditional combat encounter with HP representing physical health'
};

/**
 * Preset encounter profiles for common use cases
 * @type {EncounterProfile[]}
 */
export const PRESET_PROFILES = [
    DEFAULT_COMBAT_PROFILE,
    {
        id: 'preset-social',
        name: 'Social Confrontation',
        ENCOUNTER_TYPE: 'Social',
        ENCOUNTER_GOAL: 'persuade or manipulate the opposition',
        ENCOUNTER_STAKES: 'high',
        RESOURCE_INTERPRETATION: 'composure, leverage, and social standing',
        ACTION_INTERPRETATION: 'arguments, appeals, and social maneuvers',
        STATUS_INTERPRETATION: 'emotional states and social conditions',
        SUMMARY_FRAMING: 'a diplomatic exchange recap',
        // UI Labels
        ENEMY_LABEL_SINGULAR: 'Opponent',
        ENEMY_LABEL_PLURAL: 'Opposition',
        PARTY_LABEL_SINGULAR: 'Ally',
        PARTY_LABEL_PLURAL: 'Allies',
        RESOURCE_LABEL: 'Composure',
        ACTION_SECTION_LABEL: 'Arguments',
        VICTORY_TERM: 'Persuaded',
        DEFEAT_TERM: 'Discredited',
        FLED_TERM: 'Withdrew',
        isPreset: true,
        description: 'Social encounter where HP represents composure and attacks are rhetorical arguments'
    },
    {
        id: 'preset-stealth',
        name: 'Stealth Infiltration',
        ENCOUNTER_TYPE: 'Stealth',
        ENCOUNTER_GOAL: 'reach the objective undetected',
        ENCOUNTER_STAKES: 'high',
        RESOURCE_INTERPRETATION: 'alertness level of guards and exposure margin',
        ACTION_INTERPRETATION: 'distraction attempts, stealth maneuvers, and evasion tactics',
        STATUS_INTERPRETATION: 'detection states and environmental conditions',
        SUMMARY_FRAMING: 'an infiltration attempt recap',
        // UI Labels
        ENEMY_LABEL_SINGULAR: 'Guard',
        ENEMY_LABEL_PLURAL: 'Guards',
        PARTY_LABEL_SINGULAR: 'Agent',
        PARTY_LABEL_PLURAL: 'Team',
        RESOURCE_LABEL: 'Cover',
        ACTION_SECTION_LABEL: 'Maneuvers',
        VICTORY_TERM: 'Infiltrated',
        DEFEAT_TERM: 'Exposed',
        FLED_TERM: 'Aborted',
        isPreset: true,
        description: 'Stealth encounter where HP represents alertness and attacks are distractions'
    },
    {
        id: 'preset-investigation',
        name: 'Investigation',
        ENCOUNTER_TYPE: 'Investigation',
        ENCOUNTER_GOAL: 'solve the mystery before time runs out',
        ENCOUNTER_STAKES: 'medium',
        RESOURCE_INTERPRETATION: 'remaining leads, time pressure, and certainty level',
        ACTION_INTERPRETATION: 'deduction attempts, evidence gathering, and interrogation',
        STATUS_INTERPRETATION: 'mental states and investigative progress',
        SUMMARY_FRAMING: 'a detective work recap',
        // UI Labels
        ENEMY_LABEL_SINGULAR: 'Red Herring',
        ENEMY_LABEL_PLURAL: 'Obstacles',
        PARTY_LABEL_SINGULAR: 'Investigator',
        PARTY_LABEL_PLURAL: 'Team',
        RESOURCE_LABEL: 'Leads',
        ACTION_SECTION_LABEL: 'Deductions',
        VICTORY_TERM: 'Solved',
        DEFEAT_TERM: 'Stumped',
        FLED_TERM: 'Gave Up',
        isPreset: true,
        description: 'Investigation encounter where HP represents remaining leads and attacks are deductions'
    },
    {
        id: 'preset-chase',
        name: 'Chase Sequence',
        ENCOUNTER_TYPE: 'Chase',
        ENCOUNTER_GOAL: 'escape pursuers or catch the target',
        ENCOUNTER_STAKES: 'high',
        RESOURCE_INTERPRETATION: 'distance advantage and stamina remaining',
        ACTION_INTERPRETATION: 'sprint bursts, obstacles thrown, and evasive maneuvers',
        STATUS_INTERPRETATION: 'physical conditions and tactical advantages',
        SUMMARY_FRAMING: 'a pursuit sequence recap',
        // UI Labels
        ENEMY_LABEL_SINGULAR: 'Pursuer',
        ENEMY_LABEL_PLURAL: 'Pursuers',
        PARTY_LABEL_SINGULAR: 'Runner',
        PARTY_LABEL_PLURAL: 'Team',
        RESOURCE_LABEL: 'Stamina',
        ACTION_SECTION_LABEL: 'Maneuvers',
        VICTORY_TERM: 'Escaped',
        DEFEAT_TERM: 'Caught',
        FLED_TERM: 'Surrendered',
        isPreset: true,
        description: 'Chase encounter where HP represents distance/stamina and attacks are evasive actions'
    },
    {
        id: 'preset-negotiation',
        name: 'Negotiation',
        ENCOUNTER_TYPE: 'Negotiation',
        ENCOUNTER_GOAL: 'reach a favorable agreement',
        ENCOUNTER_STAKES: 'medium',
        RESOURCE_INTERPRETATION: 'bargaining power and credibility',
        ACTION_INTERPRETATION: 'offers, concessions, and leverage plays',
        STATUS_INTERPRETATION: 'negotiation positions and emotional states',
        SUMMARY_FRAMING: 'a deal-making session recap',
        // UI Labels
        ENEMY_LABEL_SINGULAR: 'Negotiator',
        ENEMY_LABEL_PLURAL: 'Opposition',
        PARTY_LABEL_SINGULAR: 'Negotiator',
        PARTY_LABEL_PLURAL: 'Team',
        RESOURCE_LABEL: 'Leverage',
        ACTION_SECTION_LABEL: 'Offers',
        VICTORY_TERM: 'Deal Reached',
        DEFEAT_TERM: 'Deal Failed',
        FLED_TERM: 'Walked Away',
        isPreset: true,
        description: 'Negotiation encounter where HP represents bargaining power and attacks are offers'
    },
    {
        id: 'preset-survival',
        name: 'Survival Ordeal',
        ENCOUNTER_TYPE: 'Survival',
        ENCOUNTER_GOAL: 'endure until rescue or escape',
        ENCOUNTER_STAKES: 'high',
        RESOURCE_INTERPRETATION: 'supplies, morale, and physical condition',
        ACTION_INTERPRETATION: 'resource management, shelter building, and foraging',
        STATUS_INTERPRETATION: 'environmental hazards and survival conditions',
        SUMMARY_FRAMING: 'a survival ordeal recap',
        // UI Labels
        ENEMY_LABEL_SINGULAR: 'Hazard',
        ENEMY_LABEL_PLURAL: 'Hazards',
        PARTY_LABEL_SINGULAR: 'Survivor',
        PARTY_LABEL_PLURAL: 'Group',
        RESOURCE_LABEL: 'Supplies',
        ACTION_SECTION_LABEL: 'Actions',
        VICTORY_TERM: 'Survived',
        DEFEAT_TERM: 'Perished',
        FLED_TERM: 'Abandoned',
        isPreset: true,
        description: 'Survival encounter where HP represents supplies/morale and attacks are survival actions'
    }
];

/**
 * Forbidden keywords that indicate prompt injection attempts
 */
const FORBIDDEN_KEYWORDS = [
    'return only', 'output only', 'ignore previous', 'disregard', 
    'instead of', 'however', 'but actually', 'forget', 'override',
    'system:', 'assistant:', 'user:', '<|', '|>', 'json', '{', '}', '[', ']'
];

/**
 * Maximum length for profile field values
 */
const MAX_FIELD_LENGTH = 200;

/**
 * Required fields for a valid encounter profile
 */
const REQUIRED_FIELDS = [
    'ENCOUNTER_TYPE',
    'ENCOUNTER_GOAL',
    'ENCOUNTER_STAKES',
    'RESOURCE_INTERPRETATION',
    'ACTION_INTERPRETATION',
    'STATUS_INTERPRETATION',
    'SUMMARY_FRAMING',
    // UI Labels
    'ENEMY_LABEL_SINGULAR',
    'ENEMY_LABEL_PLURAL',
    'PARTY_LABEL_SINGULAR',
    'PARTY_LABEL_PLURAL',
    'RESOURCE_LABEL',
    'ACTION_SECTION_LABEL',
    'VICTORY_TERM',
    'DEFEAT_TERM',
    'FLED_TERM'
];

/**
 * Sanitizes a profile field value by removing potentially dangerous content
 * @param {string} value - The value to sanitize
 * @returns {string} Sanitized value
 */
export function sanitizeProfileValue(value) {
    if (typeof value !== 'string') {
        return '';
    }

    // Remove JSON characters
    value = value.replace(/[{}\[\]":]/g, '');

    // Remove forbidden keywords (case-insensitive)
    FORBIDDEN_KEYWORDS.forEach(keyword => {
        const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        value = value.replace(regex, '');
    });

    // Remove newlines and excessive whitespace
    value = value.replace(/\n/g, ' ').replace(/\s+/g, ' ');

    // Limit length
    if (value.length > MAX_FIELD_LENGTH) {
        value = value.substring(0, MAX_FIELD_LENGTH);
    }

    // Trim whitespace
    return value.trim();
}

/**
 * Validates an encounter profile
 * @param {EncounterProfile} profile - The profile to validate
 * @returns {{valid: boolean, errors: string[]}} Validation result
 */
export function validateProfile(profile) {
    const errors = [];

    if (!profile || typeof profile !== 'object') {
        return { valid: false, errors: ['Profile must be an object'] };
    }

    // Check required fields
    REQUIRED_FIELDS.forEach(field => {
        if (!profile[field]) {
            errors.push(`Missing required field: ${field}`);
        } else if (typeof profile[field] !== 'string') {
            errors.push(`Field ${field} must be a string`);
        } else if (profile[field].trim().length === 0) {
            errors.push(`Field ${field} cannot be empty`);
        }
    });

    // Validate stakes level
    if (profile.ENCOUNTER_STAKES) {
        const validStakes = ['low', 'medium', 'high'];
        if (!validStakes.includes(profile.ENCOUNTER_STAKES.toLowerCase())) {
            errors.push('ENCOUNTER_STAKES must be "low", "medium", or "high"');
        }
    }

    // Check for forbidden content in all fields
    REQUIRED_FIELDS.forEach(field => {
        if (profile[field]) {
            const value = profile[field].toLowerCase();
            const hasForbidden = FORBIDDEN_KEYWORDS.some(keyword =>
                value.includes(keyword.toLowerCase())
            );
            if (hasForbidden) {
                errors.push(`Field ${field} contains forbidden keywords`);
            }
        }
    });

    // Check field lengths
    REQUIRED_FIELDS.forEach(field => {
        if (profile[field] && profile[field].length > MAX_FIELD_LENGTH) {
            errors.push(`Field ${field} exceeds maximum length of ${MAX_FIELD_LENGTH} characters`);
        }
    });

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Sanitizes an entire profile by cleaning all field values
 * @param {EncounterProfile} profile - The profile to sanitize
 * @returns {EncounterProfile} Sanitized profile
 */
export function sanitizeProfile(profile) {
    const sanitized = { ...profile };

    REQUIRED_FIELDS.forEach(field => {
        if (sanitized[field]) {
            sanitized[field] = sanitizeProfileValue(sanitized[field]);
        }
    });

    // Sanitize optional fields
    if (sanitized.name) {
        sanitized.name = sanitizeProfileValue(sanitized.name);
    }
    if (sanitized.description) {
        sanitized.description = sanitizeProfileValue(sanitized.description);
    }

    // Normalize stakes
    if (sanitized.ENCOUNTER_STAKES) {
        sanitized.ENCOUNTER_STAKES = sanitized.ENCOUNTER_STAKES.toLowerCase();
    }

    return sanitized;
}

/**
 * Gets the active encounter profile with fallback to default combat
 * Checks currentEncounterProfileId first (set per-encounter), then activeProfileId (global default)
 * @returns {EncounterProfile} The active profile
 */
export function getActiveProfile() {
    try {
        // Check for current encounter profile first (overrides active profile)
        const currentEncounterProfileId = extensionSettings.encounterSettings?.currentEncounterProfileId;
        const activeProfileId = extensionSettings.encounterSettings?.activeProfileId;

        console.log('[RPG Companion] getActiveProfile() called');
        console.log('[RPG Companion] - currentEncounterProfileId:', currentEncounterProfileId);
        console.log('[RPG Companion] - activeProfileId:', activeProfileId);

        // Use current encounter profile if set, otherwise use active profile
        const profileId = currentEncounterProfileId || activeProfileId;

        if (!profileId) {
            console.log('[RPG Companion] No profile set, using default combat');
            return DEFAULT_COMBAT_PROFILE;
        }

        // Check presets first
        const preset = PRESET_PROFILES.find(p => p.id === profileId);
        if (preset) {
            console.log('[RPG Companion] Using preset profile:', preset.name, '(' + preset.id + ')', currentEncounterProfileId ? '(encounter override)' : '(active)');
            return preset;
        }

        // Check custom profiles
        const customProfiles = extensionSettings.encounterSettings?.profiles || [];
        const custom = customProfiles.find(p => p.id === profileId);

        if (custom) {
            // Validate and sanitize custom profile
            const sanitized = sanitizeProfile(custom);
            const validation = validateProfile(sanitized);

            if (validation.valid) {
                console.log('[RPG Companion] Using custom profile:', sanitized.name, '(' + sanitized.id + ')', currentEncounterProfileId ? '(encounter override)' : '(active)');
                return sanitized;
            } else {
                console.warn('[RPG Companion] Profile is invalid, falling back to combat:', validation.errors);
                return DEFAULT_COMBAT_PROFILE;
            }
        }

        console.warn('[RPG Companion] Profile not found (ID:', profileId, '), falling back to combat');
        return DEFAULT_COMBAT_PROFILE;
    } catch (error) {
        console.error('[RPG Companion] Error getting active profile:', error);
        return DEFAULT_COMBAT_PROFILE;
    }
}

/**
 * Gets a profile by ID (checks both presets and custom profiles)
 * @param {string} profileId - The profile ID to find
 * @returns {EncounterProfile|null} The profile or null if not found
 */
export function getProfileById(profileId) {
    // Check presets
    const preset = PRESET_PROFILES.find(p => p.id === profileId);
    if (preset) {
        return preset;
    }

    // Check custom profiles
    const customProfiles = extensionSettings.encounterSettings?.profiles || [];
    return customProfiles.find(p => p.id === profileId) || null;
}

/**
 * Gets all available profiles (presets + custom)
 * @returns {EncounterProfile[]} Array of all profiles
 */
export function getAllProfiles() {
    const customProfiles = extensionSettings.encounterSettings?.profiles || [];

    // Deduplicate by ID - custom profiles override presets with same ID
    const profileMap = new Map();

    // Add presets first (ensure they're never hidden)
    PRESET_PROFILES.forEach(profile => {
        profileMap.set(profile.id, { ...profile, hidden: false });
    });

    // Add custom profiles (will override presets with same ID)
    customProfiles.forEach(profile => {
        profileMap.set(profile.id, profile);
    });

    return Array.from(profileMap.values());
}

/**
 * Saves a custom profile
 * @param {EncounterProfile} profile - The profile to save
 * @returns {{success: boolean, errors?: string[]}} Save result
 */
export function saveProfile(profile) {
    try {
        // Sanitize first
        const sanitized = sanitizeProfile(profile);

        // Validate
        const validation = validateProfile(sanitized);
        if (!validation.valid) {
            return { success: false, errors: validation.errors };
        }

        // Ensure profile has an ID
        if (!sanitized.id) {
            sanitized.id = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }

        // Ensure it's not marked as preset
        sanitized.isPreset = false;

        // Initialize profiles array if needed
        if (!extensionSettings.encounterSettings) {
            extensionSettings.encounterSettings = {};
        }
        if (!extensionSettings.encounterSettings.profiles) {
            extensionSettings.encounterSettings.profiles = [];
        }

        // Check if updating existing profile
        const existingIndex = extensionSettings.encounterSettings.profiles.findIndex(
            p => p.id === sanitized.id
        );

        if (existingIndex >= 0) {
            // Update existing
            extensionSettings.encounterSettings.profiles[existingIndex] = sanitized;
        } else {
            // Add new
            extensionSettings.encounterSettings.profiles.push(sanitized);
        }

        console.log('[RPG Companion] Saved profile:', sanitized.name);
        return { success: true };
    } catch (error) {
        console.error('[RPG Companion] Error saving profile:', error);
        return { success: false, errors: [error.message] };
    }
}

/**
 * Creates a new profile
 * @param {Object} profileData - The profile data (without ID)
 * @returns {EncounterProfile} The created profile
 */
export function createProfile(profileData) {
    const profile = {
        id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ...profileData,
        isPreset: false
    };

    const result = saveProfile(profile);
    if (!result.success) {
        throw new Error(result.errors?.join(', ') || 'Failed to create profile');
    }

    return profile;
}

/**
 * Updates an existing profile
 * @param {string} profileId - The ID of the profile to update
 * @param {Object} profileData - The updated profile data
 * @returns {EncounterProfile} The updated profile
 */
export function updateProfile(profileId, profileData) {
    const profile = {
        id: profileId,
        ...profileData,
        isPreset: false
    };

    const result = saveProfile(profile);
    if (!result.success) {
        throw new Error(result.errors?.join(', ') || 'Failed to update profile');
    }

    return profile;
}

/**
 * Deletes a custom profile
 * @param {string} profileId - The ID of the profile to delete
 * @returns {boolean} True if deleted, false if not found or is preset
 */
export function deleteProfile(profileId) {
    try {
        // Cannot delete presets
        if (PRESET_PROFILES.some(p => p.id === profileId)) {
            console.warn('[RPG Companion] Cannot delete preset profile');
            return false;
        }

        if (!extensionSettings.encounterSettings?.profiles) {
            return false;
        }

        const index = extensionSettings.encounterSettings.profiles.findIndex(
            p => p.id === profileId
        );

        if (index >= 0) {
            extensionSettings.encounterSettings.profiles.splice(index, 1);

            // If this was the active profile, reset to default
            if (extensionSettings.encounterSettings.activeProfileId === profileId) {
                extensionSettings.encounterSettings.activeProfileId = 'default-combat';
            }

            console.log('[RPG Companion] Deleted profile:', profileId);
            return true;
        }

        return false;
    } catch (error) {
        console.error('[RPG Companion] Error deleting profile:', error);
        return false;
    }
}

/**
 * Sets the active profile
 * @param {string} profileId - The ID of the profile to activate
 * @returns {boolean} True if set successfully
 */
export function setActiveProfile(profileId) {
    try {
        const profile = getProfileById(profileId);
        if (!profile) {
            console.warn('[RPG Companion] Profile not found:', profileId);
            return false;
        }

        if (!extensionSettings.encounterSettings) {
            extensionSettings.encounterSettings = {};
        }

        extensionSettings.encounterSettings.activeProfileId = profileId;
        console.log('[RPG Companion] Set active profile:', profile.name);
        return true;
    } catch (error) {
        console.error('[RPG Companion] Error setting active profile:', error);
        return false;
    }
}

/**
 * Duplicates a profile (creates a copy with new ID)
 * @param {string} profileId - The ID of the profile to duplicate
 * @returns {{success: boolean, newProfile?: EncounterProfile, errors?: string[]}} Result
 */
export function duplicateProfile(profileId) {
    try {
        const original = getProfileById(profileId);
        if (!original) {
            return { success: false, errors: ['Profile not found'] };
        }

        const duplicate = {
            ...original,
            id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: `${original.name} (Copy)`,
            isPreset: false
        };

        const result = saveProfile(duplicate);
        if (result.success) {
            return { success: true, newProfile: duplicate };
        } else {
            return result;
        }
    } catch (error) {
        console.error('[RPG Companion] Error duplicating profile:', error);
        return { success: false, errors: [error.message] };
    }
}

/**
 * Exports a profile as JSON string
 * @param {string} profileId - The ID of the profile to export
 * @returns {string|null} JSON string or null if not found
 */
export function exportProfile(profileId) {
    try {
        const profile = getProfileById(profileId);
        if (!profile) {
            return null;
        }

        // Create export object without internal fields
        const exportData = {
            name: profile.name,
            ENCOUNTER_TYPE: profile.ENCOUNTER_TYPE,
            ENCOUNTER_GOAL: profile.ENCOUNTER_GOAL,
            ENCOUNTER_STAKES: profile.ENCOUNTER_STAKES,
            RESOURCE_INTERPRETATION: profile.RESOURCE_INTERPRETATION,
            ACTION_INTERPRETATION: profile.ACTION_INTERPRETATION,
            STATUS_INTERPRETATION: profile.STATUS_INTERPRETATION,
            SUMMARY_FRAMING: profile.SUMMARY_FRAMING,
            description: profile.description || ''
        };

        return JSON.stringify(exportData, null, 2);
    } catch (error) {
        console.error('[RPG Companion] Error exporting profile:', error);
        return null;
    }
}

/**
 * Imports a profile from JSON string
 * @param {string} jsonString - The JSON string to import
 * @returns {{success: boolean, profile?: EncounterProfile, errors?: string[]}} Import result
 */
export function importProfile(jsonString) {
    try {
        const data = JSON.parse(jsonString);

        // Create profile with new ID
        const profile = {
            id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: data.name || 'Imported Profile',
            ENCOUNTER_TYPE: data.ENCOUNTER_TYPE,
            ENCOUNTER_GOAL: data.ENCOUNTER_GOAL,
            ENCOUNTER_STAKES: data.ENCOUNTER_STAKES,
            RESOURCE_INTERPRETATION: data.RESOURCE_INTERPRETATION,
            ACTION_INTERPRETATION: data.ACTION_INTERPRETATION,
            STATUS_INTERPRETATION: data.STATUS_INTERPRETATION,
            SUMMARY_FRAMING: data.SUMMARY_FRAMING,
            description: data.description || '',
            isPreset: false
        };

        return saveProfile(profile);
    } catch (error) {
        console.error('[RPG Companion] Error importing profile:', error);
        return { success: false, errors: ['Invalid JSON or profile format'] };
    }
}

/**
 * Removes duplicate profiles from custom profiles array
 * Removes profiles that duplicate presets by name AND profiles with duplicate IDs
 * @returns {number} Number of duplicates removed
 */
export function cleanupDuplicateProfiles() {
    try {
        if (!extensionSettings.encounterSettings?.profiles) {
            console.log('[RPG Companion] No custom profiles to clean up');
            return 0;
        }

        const customProfiles = extensionSettings.encounterSettings.profiles;
        const originalCount = customProfiles.length;

        console.log('[RPG Companion] Starting cleanup of', originalCount, 'custom profiles');

        // Get all preset IDs and names
        const presetIds = new Set(PRESET_PROFILES.map(p => p.id));
        const presetNames = new Set(PRESET_PROFILES.map(p => p.name));

        // Remove any custom profiles that duplicate presets (by ID or name)
        const withoutPresetDuplicates = customProfiles.filter(profile => {
            if (presetIds.has(profile.id)) {
                console.warn('[RPG Companion] Removing custom profile with preset ID:', profile.id, profile.name);
                return false;
            }
            if (presetNames.has(profile.name)) {
                console.warn('[RPG Companion] Removing custom profile with preset name:', profile.name, '(ID:', profile.id + ')');
                return false;
            }
            return true;
        });

        // Remove duplicate custom profiles by ID (keep first occurrence)
        const seenIds = new Set();
        const deduplicated = withoutPresetDuplicates.filter(profile => {
            if (seenIds.has(profile.id)) {
                console.warn('[RPG Companion] Removing duplicate custom profile ID:', profile.id, profile.name);
                return false;
            }
            seenIds.add(profile.id);
            return true;
        });

        extensionSettings.encounterSettings.profiles = deduplicated;
        const removedCount = originalCount - deduplicated.length;

        if (removedCount > 0) {
            console.log('[RPG Companion] ✅ Cleaned up', removedCount, 'duplicate profiles');
            console.log('[RPG Companion] Profiles before:', originalCount, 'after:', deduplicated.length);
            return removedCount;
        } else {
            console.log('[RPG Companion] No duplicate profiles found');
            return 0;
        }
    } catch (error) {
        console.error('[RPG Companion] Error cleaning up duplicate profiles:', error);
        return 0;
    }
}

