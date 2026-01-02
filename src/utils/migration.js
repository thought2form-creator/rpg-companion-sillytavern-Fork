/**
 * Inventory Migration Module
 * Handles conversion from v1 (string) to v2 (structured) inventory format
 */

// Type imports
/** @typedef {import('../types/inventory.js').InventoryV1} InventoryV1 */
/** @typedef {import('../types/inventory.js').InventoryV2} InventoryV2 */
/** @typedef {import('../types/inventory.js').MigrationResult} MigrationResult */

/**
 * Default v3 inventory structure for new/empty inventories
 * @type {InventoryV3}
 */
const DEFAULT_INVENTORY_V3 = {
    version: 3,
    onPerson: {},
    stored: {},
    assets: "None"
};

/**
 * Default v2 inventory structure for new/empty inventories
 * @type {InventoryV2}
 * @deprecated Use DEFAULT_INVENTORY_V3 instead
 */
const DEFAULT_INVENTORY_V2 = {
    version: 2,
    onPerson: "None",
    stored: {},
    assets: "None"
};

/**
 * Migrates inventory data from v1/v2 to v3 format.
 * v3 changes: onPerson is now an object with locations (like stored) instead of a string
 * Handles all edge cases: null, undefined, "None", already-migrated data.
 *
 * @param {InventoryV1 | InventoryV2 | InventoryV3 | null | undefined} inventory - Inventory data to migrate
 * @returns {MigrationResult} Migration result with v3 inventory and metadata
 */
export function migrateInventory(inventory) {
    // Case 1: Already v3 format
    if (inventory && typeof inventory === 'object' && inventory.version === 3) {
        return {
            inventory: inventory,
            migrated: false,
            source: 'v3'
        };
    }

    // Case 2: v2 format → migrate to v3
    if (inventory && typeof inventory === 'object' && inventory.version === 2) {
        console.log('[RPG Companion Migration] Migrating v2 to v3: converting onPerson string to object');
        const v3Inventory = {
            version: 3,
            onPerson: {},
            stored: inventory.stored || {},
            assets: inventory.assets || "None"
        };

        // Migrate onPerson from string to object
        if (inventory.onPerson && typeof inventory.onPerson === 'string') {
            const trimmed = inventory.onPerson.trim();
            if (trimmed && trimmed.toLowerCase() !== 'none') {
                // Put existing items in a default "On Person" location
                v3Inventory.onPerson["On Person"] = inventory.onPerson;
            }
        }

        return {
            inventory: v3Inventory,
            migrated: true,
            source: 'v2'
        };
    }

    // Case 3: null or undefined → use defaults
    if (inventory === null || inventory === undefined) {
        return {
            inventory: { ...DEFAULT_INVENTORY_V3 },
            migrated: true,
            source: 'null'
        };
    }

    // Case 4: v1 string format → migrate to v3
    if (typeof inventory === 'string') {
        const trimmed = inventory.trim();
        if (trimmed === '' || trimmed.toLowerCase() === 'none') {
            return {
                inventory: { ...DEFAULT_INVENTORY_V3 },
                migrated: true,
                source: 'v1'
            };
        }

        // Non-empty v1 string → migrate to v3.onPerson with default location
        console.log('[RPG Companion Migration] Migrating v1 string to v3.onPerson:', inventory);
        return {
            inventory: {
                version: 3,
                onPerson: { "On Person": inventory },
                stored: {},
                assets: "None"
            },
            migrated: true,
            source: 'v1'
        };
    }

    // Case 5: Unknown format (malformed object, number, etc.) → use defaults
    console.warn('[RPG Companion Migration] Unknown inventory format, using defaults:', inventory);
    return {
        inventory: { ...DEFAULT_INVENTORY_V3 },
        migrated: true,
        source: 'default'
    };
}
