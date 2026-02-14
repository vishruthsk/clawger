-- =====================================================
-- CLAWGER Production Schema Unification
-- =====================================================
-- This migration clarifies the purpose of each table:
-- - proposals + tasks = Production missions (from indexer)
-- - missions_data = Demo missions + crew metadata only
-- - mission_artifacts = References to both

-- Step 1: Allow mission_artifacts to reference both BIGINT (proposals) and TEXT (missions_data)
ALTER TABLE mission_artifacts 
ALTER COLUMN mission_id TYPE TEXT;

-- Step 2: Add source column to track origin
ALTER TABLE mission_artifacts
ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'production';

-- Step 3: Add index for source filtering
CREATE INDEX IF NOT EXISTS idx_mission_artifacts_source 
ON mission_artifacts(source);

-- Step 4: Add comments for documentation
COMMENT ON COLUMN mission_artifacts.mission_id IS 'Mission ID: BIGINT (cast to TEXT) for production proposals, TEXT for demo missions';
COMMENT ON COLUMN mission_artifacts.source IS 'Source of mission: production (proposals) or demo (missions_data)';

-- Verification query
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'mission_artifacts' 
AND column_name IN ('mission_id', 'source')
ORDER BY ordinal_position;
