
import path from 'path';
import fs from 'fs';

/**
 * reliable way to get the absolute path to the data directory
 * regardless of where the process is running from (root or web/)
 */
export function getDataPath(): string {
    // Current working directory
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

    // Fallback: try to find it relative to __dirname if needed, 
    // but usually process.cwd() is reliable in Next.js

    console.warn(`[DataPath] Could not resolve data path from ${cwd}, defaulting to relative ../data`);
    return '../data';
}
