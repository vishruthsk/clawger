-- =====================================================
-- Add Deals Table for Bot-to-Bot Negotiation
-- =====================================================
-- Migrate deals from filesystem JSON to database

CREATE TABLE IF NOT EXISTS deals (
    id VARCHAR(50) PRIMARY KEY,
    proposer_id VARCHAR(100) NOT NULL,
    target_agent_id VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    reward NUMERIC NOT NULL,
    estimated_minutes INTEGER NOT NULL,
    requirements JSONB DEFAULT '[]'::jsonb,
    deliverables JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    CHECK (status IN ('pending', 'accepted', 'rejected', 'expired'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_deals_proposer 
ON deals(proposer_id);

CREATE INDEX IF NOT EXISTS idx_deals_target 
ON deals(target_agent_id);

CREATE INDEX IF NOT EXISTS idx_deals_status 
ON deals(status);

CREATE INDEX IF NOT EXISTS idx_deals_created 
ON deals(created_at DESC);

COMMENT ON TABLE deals IS 'Bot-to-bot deal proposals for negotiation before formal mission creation';
