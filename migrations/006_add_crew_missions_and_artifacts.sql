-- =====================================================
-- CLAWGER Production-Safe Storage Migration
-- =====================================================
-- This migration adds crew mission support and artifact storage
-- to the missions_data table, replacing filesystem-based uploads

-- Step 1: Add crew mission columns to missions_data
ALTER TABLE missions_data 
ADD COLUMN IF NOT EXISTS crew_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS crew_size INTEGER,
ADD COLUMN IF NOT EXISTS specialties JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;

-- Step 2: Create mission_artifacts table for Supabase Storage references
CREATE TABLE IF NOT EXISTS mission_artifacts (
    id TEXT PRIMARY KEY,
    mission_id TEXT NOT NULL REFERENCES missions_data(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,  -- Path in Supabase Storage bucket
    signed_url TEXT,              -- Cached signed URL
    url_expires_at TIMESTAMPTZ,   -- When signed URL expires
    size BIGINT,
    mime_type TEXT,
    uploaded_by TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_mission_artifacts_mission_id 
ON mission_artifacts(mission_id);

CREATE INDEX IF NOT EXISTS idx_mission_artifacts_url_expires 
ON mission_artifacts(url_expires_at) 
WHERE url_expires_at IS NOT NULL;

-- Step 4: Create index on specialties/tags for filtering
CREATE INDEX IF NOT EXISTS idx_missions_specialties 
ON missions_data USING GIN (specialties);

CREATE INDEX IF NOT EXISTS idx_missions_tags 
ON missions_data USING GIN (tags);

-- Step 5: Add comment documentation
COMMENT ON COLUMN missions_data.crew_enabled IS 'Whether this mission requires multiple agents (crew mission)';
COMMENT ON COLUMN missions_data.crew_size IS 'Number of agents needed for crew missions (2-10)';
COMMENT ON COLUMN missions_data.specialties IS 'Required agent specialties (from MISSION_CATEGORIES)';
COMMENT ON COLUMN missions_data.tags IS 'Mission tags for categorization (from MISSION_CATEGORIES)';

COMMENT ON TABLE mission_artifacts IS 'Stores references to files uploaded to Supabase Storage for missions';
COMMENT ON COLUMN mission_artifacts.storage_path IS 'Full path in Supabase Storage bucket (e.g., mission-artifacts/mission_123/file.pdf)';
COMMENT ON COLUMN mission_artifacts.signed_url IS 'Cached signed URL for download (regenerated on access)';
COMMENT ON COLUMN mission_artifacts.url_expires_at IS 'Expiration timestamp for signed URL';

-- Verification queries
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'missions_data' 
AND column_name IN ('crew_enabled', 'crew_size', 'specialties', 'tags')
ORDER BY ordinal_position;
