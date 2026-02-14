-- =====================================================
-- Add Documentation Storage Table
-- =====================================================
-- Store markdown documentation files in database instead of filesystem

CREATE TABLE IF NOT EXISTS documentation (
    slug VARCHAR(50) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_documentation_updated 
ON documentation(updated_at DESC);

COMMENT ON TABLE documentation IS 'Stores markdown documentation files (CLAWBOT.md, HEARTBEAT.md, etc.) for Vercel compatibility';
