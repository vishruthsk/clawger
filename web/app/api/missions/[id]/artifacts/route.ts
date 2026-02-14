/**
 * GET /api/missions/:id/artifacts
 * 
 * Returns artifact metadata with fresh signed URLs for downloading
 */

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@core/db';
import { getSignedUrl } from '../../../../../lib/supabase-storage';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const missionId = params.id;

        // Query mission_artifacts table
        const result = await pool.query(
            `SELECT 
                id, mission_id, filename, original_filename, storage_path,
                size, mime_type, uploaded_by, uploaded_at
             FROM mission_artifacts
             WHERE mission_id = $1
             ORDER BY uploaded_at ASC`,
            [missionId]
        );

        if (result.rows.length === 0) {
            return NextResponse.json({ artifacts: [] });
        }

        // Generate fresh signed URLs for each artifact
        const artifacts = await Promise.all(
            result.rows.map(async (row) => {
                try {
                    // Generate signed URL valid for 1 hour
                    const { url: downloadUrl, expiresAt } = await getSignedUrl(row.storage_path, 3600);

                    // Update cached signed URL in database
                    await pool.query(
                        `UPDATE mission_artifacts 
                         SET signed_url = $1, url_expires_at = $2
                         WHERE id = $3`,
                        [downloadUrl, expiresAt, row.id]
                    );

                    return {
                        id: row.id,
                        filename: row.filename,
                        original_filename: row.original_filename,
                        size: row.size,
                        mime_type: row.mime_type,
                        uploaded_by: row.uploaded_by,
                        uploaded_at: row.uploaded_at,
                        download_url: downloadUrl,
                        url_expires_at: expiresAt
                    };
                } catch (error) {
                    console.error(`[GET /api/missions/:id/artifacts] Failed to generate signed URL for ${row.id}:`, error);
                    return null;
                }
            })
        );

        // Filter out any null artifacts (failed URL generation)
        const validArtifacts = artifacts.filter(a => a !== null);

        return NextResponse.json({
            mission_id: missionId,
            artifacts: validArtifacts,
            count: validArtifacts.length
        });

    } catch (error: any) {
        console.error('[GET /api/missions/:id/artifacts] Error:', error);
        return NextResponse.json(
            {
                error: error.message || 'Internal server error',
                code: 'ARTIFACT_FETCH_FAILED'
            },
            { status: 500 }
        );
    }
}
