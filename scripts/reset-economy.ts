#!/usr/bin/env tsx
/**
 * Economy Reset Script
 * 
 * Wipes all fake/demo data to provide a clean slate for production seeding.
 * This removes all agents, missions, tasks, deals, artifacts, and resets balances.
 */

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

const DATA_FILES = [
    'agent-auth.json',
    'missions.json',
    'dispatch-tasks.json',
    'bonds.json',
    'escrows.json',
    'settlements.json',
    'token-ledger.json',
    'heartbeats.json',
    'assignment-history.json'
];

const DATA_DIRS = [
    'artifacts'
];

function resetEconomy() {
    console.log('\n🧹 CLAWGER ECONOMY RESET\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    let filesReset = 0;
    let dirsReset = 0;

    // Reset JSON data files
    for (const file of DATA_FILES) {
        const filePath = path.join(DATA_DIR, file);

        if (fs.existsSync(filePath)) {
            // Write empty structure based on file type
            let emptyData: any = {};

            if (file === 'agent-auth.json') {
                emptyData = { agents: [], apiKeys: {} };
            } else if (file === 'missions.json') {
                emptyData = { missions: [] };
            } else if (file === 'dispatch-tasks.json') {
                emptyData = { tasks: [] };
            } else if (file === 'bonds.json') {
                emptyData = { bonds: [] };
            } else if (file === 'escrows.json') {
                emptyData = { escrows: [] };
            } else if (file === 'settlements.json') {
                emptyData = { settlements: [] };
            } else if (file === 'token-ledger.json') {
                emptyData = { balances: {}, transactions: [] };
            } else if (file === 'heartbeats.json') {
                emptyData = { heartbeats: {} };
            } else if (file === 'assignment-history.json') {
                emptyData = { history: {} };
            }

            fs.writeFileSync(filePath, JSON.stringify(emptyData, null, 2));
            console.log(`✅ Reset: ${file}`);
            filesReset++;
        } else {
            console.log(`⚠️  Not found: ${file}`);
        }
    }

    // Clear artifact directories
    for (const dir of DATA_DIRS) {
        const dirPath = path.join(DATA_DIR, dir);

        if (fs.existsSync(dirPath)) {
            const files = fs.readdirSync(dirPath);
            for (const file of files) {
                const filePath = path.join(dirPath, file);
                if (fs.statSync(filePath).isFile()) {
                    fs.unlinkSync(filePath);
                }
            }
            console.log(`✅ Cleared: ${dir}/ (${files.length} files)`);
            dirsReset++;
        }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`\n✨ Reset complete!`);
    console.log(`   Files reset: ${filesReset}`);
    console.log(`   Directories cleared: ${dirsReset}`);
    console.log('\n💡 Dashboard should now be empty.');
    console.log('   Run: npm run seed:economy\n');
}

// Execute
try {
    resetEconomy();
    process.exit(0);
} catch (error: any) {
    console.error('\n❌ Reset failed:', error.message);
    process.exit(1);
}
