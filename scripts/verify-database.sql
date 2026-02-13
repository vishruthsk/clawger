-- CLAWGER Production Database Verification
-- Run these queries to verify database is ready for production

-- 1. Check all required tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
-- Expected: agents, indexer_state, proposals, reputation_updates, tasks

-- 2. Verify agents table schema
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'agents'
ORDER BY ordinal_position;
-- Expected: address, name, description, metadata, reputation, created_at, updated_at

-- 3. Verify proposals table schema
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'proposals'
ORDER BY ordinal_position;
-- Expected: id, proposer, escrow, deadline, status, bond, created_at, block_number, tx_hash

-- 4. Verify tasks table schema
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'tasks'
ORDER BY ordinal_position;
-- Expected: id, proposal_id, worker, verifier, worker_bond, escrow, status, settled, created_at, completed_at, block_number, tx_hash

-- 5. Verify reputation_updates table schema
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'reputation_updates'
ORDER BY ordinal_position;
-- Expected: id, agent, old_score, new_score, reason, updated_at, block_number, tx_hash

-- 6. Verify indexer_state table
SELECT * FROM indexer_state;
-- Expected: 1 row with last_block_registry and last_block_manager

-- 7. Check all indexes exist
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
-- Expected indexes:
-- - idx_proposals_proposer
-- - idx_tasks_worker
-- - idx_tasks_status
-- - idx_reputation_agent

-- 8. Verify no demo data exists
SELECT 
    (SELECT COUNT(*) FROM agents) as agents_count,
    (SELECT COUNT(*) FROM proposals) as proposals_count,
    (SELECT COUNT(*) FROM tasks) as tasks_count,
    (SELECT COUNT(*) FROM reputation_updates) as reputation_count;
-- Expected: All counts should be 0 or only real production data

-- 9. Test connection pooling
SELECT count(*) as active_connections
FROM pg_stat_activity 
WHERE datname = 'postgres';
-- Expected: < 20 connections

-- 10. Check database size
SELECT 
    pg_size_pretty(pg_database_size('postgres')) as database_size;
-- Expected: Reasonable size, not bloated

-- 11. Verify foreign key constraints
SELECT
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name;
-- Expected: tasks.proposal_id -> proposals.id

-- 12. Test query performance
EXPLAIN ANALYZE
SELECT * FROM proposals 
WHERE proposer = '0x0000000000000000000000000000000000000000'
LIMIT 10;
-- Expected: Uses index, execution time < 10ms

EXPLAIN ANALYZE
SELECT * FROM tasks 
WHERE status = 'in_progress'
LIMIT 10;
-- Expected: Uses index, execution time < 10ms

-- 13. Verify timestamps are using correct timezone
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE column_name LIKE '%_at'
  AND table_schema = 'public'
ORDER BY table_name, column_name;
-- Expected: All timestamp columns should be 'timestamp without time zone'

-- 14. Check for any orphaned records
SELECT COUNT(*) as orphaned_tasks
FROM tasks t
LEFT JOIN proposals p ON t.proposal_id = p.id
WHERE p.id IS NULL;
-- Expected: 0

-- 15. Verify indexer_state is initialized
SELECT 
    last_block_registry,
    last_block_manager,
    updated_at
FROM indexer_state
WHERE id = 1;
-- Expected: 1 row with reasonable block numbers

-- SUCCESS: If all queries return expected results, database is ready for production!
