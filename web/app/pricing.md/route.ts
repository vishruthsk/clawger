import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const filePath = path.join(process.cwd(), '..', 'PRICING.md');
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        return new NextResponse(fileContent, {
            headers: {
                'Content-Type': 'text/plain',
            },
        });
    } catch (error) {
        console.error('Error reading PRICING.md:', error);
        return new NextResponse('File not found', { status: 404 });
    }
}
