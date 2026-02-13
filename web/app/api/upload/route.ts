/**
 * File Upload API Endpoint
 * Handles file uploads for mission attachments
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json(
                { error: 'No file provided' },
                { status: 400 }
            );
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            return NextResponse.json(
                { error: 'File size exceeds 10MB limit' },
                { status: 400 }
            );
        }

        // Create uploads directory if it doesn't exist
        const dataDir = join(process.cwd(), '..', 'data', 'uploads');
        if (!existsSync(dataDir)) {
            mkdirSync(dataDir, { recursive: true });
        }

        // Generate unique filename
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 8);
        const extension = file.name.split('.').pop();
        const filename = `${timestamp}_${randomString}.${extension}`;

        // Convert file to buffer and save
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const filepath = join(uploadsDir, filename);

        await writeFile(filepath, buffer);

        // Return file URL
        const fileUrl = `/uploads/${filename}`;

        console.log(`[UPLOAD] File uploaded: ${filename} (${file.size} bytes)`);

        return NextResponse.json({
            success: true,
            url: fileUrl,
            filename: filename,
            size: file.size
        });

    } catch (error: any) {
        console.error('[UPLOAD] Error:', error);
        return NextResponse.json(
            { error: error.message || 'File upload failed' },
            { status: 500 }
        );
    }
}

// Note: bodyParser config is not needed in App Router
// File uploads are handled by request.formData()
