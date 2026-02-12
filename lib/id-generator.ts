/**
 * Short ID Generator
 * 
 * Generates consistent 6-character IDs for agents, missions, and tasks.
 * Format: Uppercase alphanumeric (A-Z, 0-9)
 * Example: AG7X2M, MX4K9P, TS2Q7N
 */

import { createHash } from 'crypto';

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const ID_LENGTH = 6;

/**
 * Generate a random 6-character short ID
 */
export function generateShortId(): string {
    let id = '';
    for (let i = 0; i < ID_LENGTH; i++) {
        const randomIndex = Math.floor(Math.random() * CHARSET.length);
        id += CHARSET[randomIndex];
    }
    return id;
}

/**
 * Convert an Ethereum address to a deterministic short ID
 * This ensures the same address always gets the same short ID
 */
export function fromAddress(address: string): string {
    // Remove 0x prefix if present
    const cleanAddress = address.toLowerCase().replace('0x', '');

    // Create hash of address
    const hash = createHash('sha256').update(cleanAddress).digest('hex');

    // Convert first 6 characters of hash to our charset
    let id = '';
    for (let i = 0; i < ID_LENGTH; i++) {
        // Use 2 hex chars to get a number 0-255
        const hexPair = hash.substring(i * 2, i * 2 + 2);
        const num = parseInt(hexPair, 16);
        // Map to our charset
        const charIndex = num % CHARSET.length;
        id += CHARSET[charIndex];
    }

    return id;
}

/**
 * Convert a proposal/mission ID (number) to a deterministic short ID
 */
export function fromNumber(num: number): string {
    const hash = createHash('sha256').update(num.toString()).digest('hex');

    let id = '';
    for (let i = 0; i < ID_LENGTH; i++) {
        const hexPair = hash.substring(i * 2, i * 2 + 2);
        const charNum = parseInt(hexPair, 16);
        const charIndex = charNum % CHARSET.length;
        id += CHARSET[charIndex];
    }

    return id;
}

/**
 * Prefix a short ID with DEMO- for demo data
 */
export function toDemoId(shortId: string): string {
    return `DEMO-${shortId}`;
}

/**
 * Check if an ID is a demo ID
 */
export function isDemoId(id: string | null | undefined): boolean {
    if (!id) return false;
    return id.startsWith('DEMO-');
}

/**
 * Remove DEMO- prefix from a demo ID
 */
export function fromDemoId(demoId: string): string {
    return demoId.replace('DEMO-', '');
}

/**
 * Validate that a short ID is in the correct format
 */
export function isValidShortId(id: string): boolean {
    if (!id) return false;

    // Remove DEMO- prefix if present
    const cleanId = id.replace('DEMO-', '');

    // Check length
    if (cleanId.length !== ID_LENGTH) return false;

    // Check all characters are in charset
    return cleanId.split('').every(char => CHARSET.includes(char));
}

/**
 * Format a short ID for display (adds hyphen for readability)
 * Example: AG7X2M -> AG7-X2M
 */
export function formatShortId(id: string): string {
    if (!id || id.length !== ID_LENGTH) return id;
    return `${id.substring(0, 3)}-${id.substring(3)}`;
}
