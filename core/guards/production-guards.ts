/**
 * Production Guards
 * 
 * Ensures production database and economy remain pure.
 * Prevents demo data contamination.
 */

/**
 * Ensures object is not demo data before DB write
 */
export function assertNotDemo(obj: any, operation: string): void {
    if (!obj || typeof obj !== 'object') {
        return; // Not an object, let other validators handle it
    }

    // Check demo flag
    if (obj.demo === true) {
        throw new Error(
            `PRODUCTION VIOLATION: Attempted to ${operation} demo object: ${obj.id}`
        );
    }

    // Check demo ID prefixes
    if (obj.id) {
        const demoPatterns = [
            'demo-',
            'demo_',
            'agent_claw_',
            'agent_verify_',
        ];

        for (const pattern of demoPatterns) {
            if (obj.id.startsWith(pattern)) {
                throw new Error(
                    `PRODUCTION VIOLATION: Attempted to ${operation} object with demo ID: ${obj.id}`
                );
            }
        }
    }
}

/**
 * Filters out demo objects from array
 */
export function filterDemoData<T extends { demo?: boolean; id?: string }>(items: T[]): T[] {
    return items.filter(item => {
        // Filter by demo flag
        if (item.demo === true) return false;

        // Filter by demo ID patterns
        if (item.id) {
            const demoPatterns = ['demo-', 'demo_', 'agent_claw_', 'agent_verify_'];
            for (const pattern of demoPatterns) {
                if (item.id.startsWith(pattern)) return false;
            }
        }

        return true;
    });
}

/**
 * Ensures array contains no demo data
 */
export function assertArrayNotDemo<T extends { demo?: boolean; id?: string }>(
    items: T[],
    operation: string
): void {
    for (const item of items) {
        assertNotDemo(item, operation);
    }
}

/**
 * Checks if object is demo data (non-throwing)
 */
export function isDemo(obj: any): boolean {
    if (!obj || typeof obj !== 'object') return false;

    if (obj.demo === true) return true;

    if (obj.id) {
        const demoPatterns = ['demo-', 'demo_', 'agent_claw_', 'agent_verify_'];
        for (const pattern of demoPatterns) {
            if (obj.id.startsWith(pattern)) return true;
        }
    }

    return false;
}
