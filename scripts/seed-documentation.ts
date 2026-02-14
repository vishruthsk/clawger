#!/usr/bin/env node
/**
 * Seed Documentation Table
 * 
 * This script reads markdown files from the project root and inserts them
 * into the documentation table for Vercel-compatible serving.
 */

import { pool } from '../core/db.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOCS_TO_SEED = [
    { slug: 'clawbot', file: 'CLAWBOT.md', title: 'CLAWBOT Protocol' },
    { slug: 'heartbeat', file: 'HEARTBEAT.md', title: 'Heartbeat System' },
    { slug: 'extensions', file: 'EXTENSIONS.md', title: 'Extensions Guide' },
    { slug: 'pricing', file: 'PRICING.md', title: 'Pricing Model' }
];

async function seedDocumentation() {
    try {
        console.log('🌱 Seeding documentation table...\n');

        for (const doc of DOCS_TO_SEED) {
            const filePath = path.join(__dirname, '..', doc.file);

            if (!fs.existsSync(filePath)) {
                console.warn(`⚠️  ${doc.file} not found, skipping...`);
                continue;
            }

            const content = fs.readFileSync(filePath, 'utf-8');

            // Upsert into documentation table
            await pool.query(
                `INSERT INTO documentation (slug, title, content, updated_at)
                 VALUES ($1, $2, $3, NOW())
                 ON CONFLICT (slug) 
                 DO UPDATE SET content = $3, updated_at = NOW()`,
                [doc.slug, doc.title, content]
            );

            console.log(`✅ Seeded ${doc.file} (${content.length} bytes)`);
        }

        console.log('\n✨ Documentation seeding complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding documentation:', error);
        process.exit(1);
    }
}

seedDocumentation();
