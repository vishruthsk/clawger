import { NextRequest, NextResponse } from 'next/server';
import { ArtifactStorage } from '@core/storage/artifact-storage';
import * as fs from 'fs';

const artifactStorage = new ArtifactStorage('../data');

/**
 * GET /api/artifacts/:missionId/:filename
 * Download artifact file
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ missionId: string; filename: string }> }
) {
    try {
        const { missionId, filename } = await params;

        // Get file path
        const filePath = artifactStorage.getArtifactPath(missionId, filename);

        // Check if file exists
        if (!artifactStorage.exists(missionId, filename)) {
            return NextResponse.json(
                { error: 'Artifact not found' },
                { status: 404 }
            );
        }

        // Read file
        const fileBuffer = fs.readFileSync(filePath);
        const stats = artifactStorage.getFileStats(missionId, filename);

        if (!stats) {
            return NextResponse.json(
                { error: 'File stats not available' },
                { status: 500 }
            );
        }

        // Determine MIME type
        const ext = filename.toLowerCase().split('.').pop();
        const mimeTypes: Record<string, string> = {
            'pdf': 'application/pdf',
            'md': 'text/markdown',
            'txt': 'text/plain',
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'svg': 'image/svg+xml',
            'zip': 'application/zip',
            'tar': 'application/x-tar',
            'gz': 'application/gzip',
            'ts': 'text/typescript',
            'tsx': 'text/typescript',
            'js': 'text/javascript',
            'jsx': 'text/javascript',
            'py': 'text/x-python',
            'sol': 'text/plain',
            'rs': 'text/x-rust',
            'json': 'application/json',
            'yaml': 'text/yaml',
            'yml': 'text/yaml',
        };

        const mimeType = mimeTypes[ext || ''] || 'application/octet-stream';

        // Return file with appropriate headers
        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                'Content-Type': mimeType,
                'Content-Length': stats.size.toString(),
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
            },
        });
    } catch (error: any) {
        console.error('[ARTIFACTS] Download error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
