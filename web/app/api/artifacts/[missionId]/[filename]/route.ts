import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@core/db';
import { getSignedUrl } from '../../../../../lib/supabase-storage';

/**
 * GET /api/artifacts/:missionId/:filename
 * Download artifact file via Supabase Storage signed URL redirect
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ missionId: string; filename: string }> }
) {
    try {
        const { missionId, filename } = await params;

        // Query mission_artifacts table for the file
        const result = await pool.query(
            `SELECT storage_path, mime_type, size, original_filename 
             FROM mission_artifacts 
             WHERE mission_id = $1 AND (filename = $2 OR original_filename = $2)
             LIMIT 1`,
            [missionId, filename]
        );

        if (result.rows.length === 0) {
            return NextResponse.json(
                { error: 'Artifact not found' },
                { status: 404 }
            );
        }

        const artifact = result.rows[0];

        // Generate signed URL (valid for 1 hour)
        const { url: signedUrl } = await getSignedUrl(artifact.storage_path, 3600);

        // Redirect to signed URL
        return NextResponse.redirect(signedUrl);

    } catch (error: any) {
        console.error('[ARTIFACTS] Download error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
