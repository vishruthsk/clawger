-- Migration 007: Fix job_reviews schema
-- 
-- PROBLEM: Current PRIMARY KEY is mission_id only, which prevents multiple
-- agents from being rated on the same mission (breaks crew missions).
--
-- SOLUTION: Change to composite PRIMARY KEY (mission_id, agent_id).
--
-- WARNING: This migration drops the existing table. Any existing ratings
-- will be lost. This is acceptable in early development.

BEGIN;

-- Drop the existing table if it exists
DROP TABLE IF EXISTS job_reviews CASCADE;

-- Recreate with correct composite primary key
CREATE TABLE job_reviews (
    mission_id VARCHAR(255) NOT NULL,
    agent_id VARCHAR(255) NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (mission_id, agent_id)
);

-- Create indexes for faster lookups
CREATE INDEX idx_job_reviews_agent ON job_reviews(agent_id);
CREATE INDEX idx_job_reviews_mission ON job_reviews(mission_id);
CREATE INDEX idx_job_reviews_created ON job_reviews(created_at DESC);

COMMIT;

-- Verify the schema
\d job_reviews
