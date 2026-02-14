/**
 * Supabase Storage Client
 * Handles file uploads to Supabase Storage for mission artifacts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
}

// Use service role key for server-side operations
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

export const ARTIFACTS_BUCKET = 'mission-artifacts';

/**
 * Upload a file to Supabase Storage
 */
export async function uploadArtifact(
    missionId: string,
    file: File,
    uploadedBy: string
): Promise<{
    id: string;
    filename: string;
    original_filename: string;
    storage_path: string;
    size: number;
    mime_type: string;
    uploaded_by: string;
    uploaded_at: Date;
}> {
    const artifactId = `artifact_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const filename = `${artifactId}_${file.name}`;
    const storagePath = `${missionId}/${filename}`;

    // Upload to Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer());

    const { data, error } = await supabaseAdmin.storage
        .from(ARTIFACTS_BUCKET)
        .upload(storagePath, buffer, {
            contentType: file.type,
            cacheControl: '3600',
            upsert: false
        });

    if (error) {
        console.error('[SupabaseStorage] Upload error:', error);
        throw new Error(`Failed to upload file: ${error.message}`);
    }

    console.log(`[SupabaseStorage] Uploaded ${file.name} to ${storagePath}`);

    return {
        id: artifactId,
        filename: filename,
        original_filename: file.name,
        storage_path: storagePath,
        size: file.size,
        mime_type: file.type,
        uploaded_by: uploadedBy,
        uploaded_at: new Date()
    };
}

/**
 * Generate a signed URL for downloading an artifact
 * @param storagePath - Path in Supabase Storage (e.g., "mission_123/file.pdf")
 * @param expiresIn - Expiry time in seconds (default: 1 hour)
 */
export async function getSignedUrl(
    storagePath: string,
    expiresIn: number = 3600
): Promise<{ url: string; expiresAt: Date }> {
    const { data, error } = await supabaseAdmin.storage
        .from(ARTIFACTS_BUCKET)
        .createSignedUrl(storagePath, expiresIn);

    if (error) {
        console.error('[SupabaseStorage] Signed URL error:', error);
        throw new Error(`Failed to generate signed URL: ${error.message}`);
    }

    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    return {
        url: data.signedUrl,
        expiresAt
    };
}

/**
 * Delete an artifact from Supabase Storage
 */
export async function deleteArtifact(storagePath: string): Promise<void> {
    const { error } = await supabaseAdmin.storage
        .from(ARTIFACTS_BUCKET)
        .remove([storagePath]);

    if (error) {
        console.error('[SupabaseStorage] Delete error:', error);
        throw new Error(`Failed to delete file: ${error.message}`);
    }

    console.log(`[SupabaseStorage] Deleted ${storagePath}`);
}
