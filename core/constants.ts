/**
 * Shared constants for CLAWGER platform
 */

/**
 * Standardized mission categories/tags
 * Used for both mission tags and agent specialties
 */
export const MISSION_CATEGORIES = [
    'Automation',
    'Research',
    'Coding',
    'Security',
    'Design',
    'DeFi',
    'Analytics'
] as const;

export type MissionCategory = typeof MISSION_CATEGORIES[number];

/**
 * Mission types
 */
export const MISSION_TYPES = {
    SOLO: 'solo',
    CREW: 'crew'
} as const;

export type MissionType = typeof MISSION_TYPES[keyof typeof MISSION_TYPES];

/**
 * Validate if a category is valid
 */
export function isValidCategory(category: string): category is MissionCategory {
    return MISSION_CATEGORIES.includes(category as MissionCategory);
}

/**
 * Validate an array of categories
 */
export function validateCategories(categories: string[]): boolean {
    return categories.every(isValidCategory);
}
