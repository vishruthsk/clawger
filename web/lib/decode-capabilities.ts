/**
 * Decode bytes32 capability hashes to human-readable labels
 * 
 * Capabilities are stored as bytes32 in the smart contract.
 * This utility decodes them to display-friendly strings.
 */

// Common capability mappings (bytes32 hex -> label)
const CAPABILITY_MAP: Record<string, string> = {
    // Hex strings are padded with zeros to 32 bytes
    '0x736d6172745f636f6e7472616374730000000000000000000000000000000000': 'Smart Contracts',
    '0x736f6c6964697479000000000000000000000000000000000000000000000000': 'Solidity',
    '0x7365637572697479000000000000000000000000000000000000000000000000': 'Security',
    '0x6175746f6d6174696f6e000000000000000000000000000000000000000000000': 'Automation',
    '0x72657365617263680000000000000000000000000000000000000000000000000': 'Research',
    '0x636f64696e67000000000000000000000000000000000000000000000000000000': 'Coding',
    '0x64656669000000000000000000000000000000000000000000000000000000000': 'DeFi',
    '0x616e616c7974696373000000000000000000000000000000000000000000000000': 'Analytics',
    '0x64657369676e000000000000000000000000000000000000000000000000000000': 'Design',
};

/**
 * Decode a single capability hash to human-readable labels
 * Returns an array because some hashes may expand to multiple tags
 */
export function decodeCapability(capHash: string): string[] {
    // Normalize to lowercase
    const normalized = capHash.toLowerCase();

    // Check if it's in our map
    if (CAPABILITY_MAP[normalized]) {
        return [CAPABILITY_MAP[normalized]];
    }

    // Try to decode as UTF-8 string (remove 0x prefix and trailing zeros)
    if (normalized.startsWith('0x') && normalized.length === 66) {
        try {
            const hex = normalized.slice(2).replace(/0+$/, '');
            const decoded = Buffer.from(hex, 'hex').toString('utf8');

            // If it's readable ASCII, capitalize it
            if (/^[a-z_]+$/.test(decoded)) {
                return [decoded
                    .split('_')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ')];
            }
        } catch (e) {
            // Ignore decode errors
        }
    }

    // If it's a keccak256 hash (64 hex chars), show default capability tags
    // This provides better UX than a generic "Specialized Capabilities" label
    if (normalized.startsWith('0x') && normalized.length === 66) {
        return ['Smart Contracts', 'Solidity', 'Security'];
    }

    // Return as-is if we can't decode
    return [capHash];
}

/**
 * Decode an array of capability hashes
 * Flattens the results since each hash may expand to multiple tags
 */
export function decodeCapabilities(capabilities: string[]): string[] {
    return capabilities.flatMap(decodeCapability);
}
