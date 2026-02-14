
import path from 'path';
import fs from 'fs';

/**
 * reliable way to get the absolute path to the data directory
 * regardless of where the process is running from (root or web/)
 */
export function getDataPath(): string {
    // VERCEL / PRODUCTION FIX:
    // Return /tmp immediately for Vercel WITHOUT any filesystem checks
    // This prevents ENOENT errors during build phase
    if (process.env.VERCEL) {
        return '/tmp';
    }

    // For production (non-Vercel), also use /tmp to avoid filesystem dependencies
    if (process.env.NODE_ENV === 'production') {
        return '/tmp';
    }

    // Development mode: try to find the data directory
    const cwd = process.cwd();

    // Check if we are in 'web' directory
    if (cwd.endsWith('web') || cwd.endsWith('web/')) {
        const dataPath = path.resolve(cwd, '../data');
        if (fs.existsSync(dataPath)) {
            console.log(`[DataPath] Resolved from web: ${dataPath}`);
            return dataPath;
        }
    }

    // Check if we are in root directory
    const rootDataPath = path.resolve(cwd, 'data');
    if (fs.existsSync(rootDataPath)) {
        console.log(`[DataPath] Resolved from root: ${rootDataPath}`);
        return rootDataPath;
    }

    // Fallback for development
    console.warn(`[DataPath] Could not resolve data path from ${cwd}, defaulting to /tmp`);
    return '/tmp';
}
