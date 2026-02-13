#!/bin/bash

# Reset database and prove real ingestion from contracts
# This script clears the database and runs the indexer from block 54725000

echo "🧹 Resetting database for clean indexer test..."

# Clear agents table
echo "Clearing agents table..."
psql $DATABASE_URL -c "DELETE FROM agents;" 2>&1

# Clear indexer_state
echo "Resetting indexer state to block 54725000..."
psql $DATABASE_URL -c "UPDATE indexer_state SET last_block_registry = 54725000, last_block_manager = 54725000, updated_at = NOW() WHERE id = 1;" 2>&1

# Verify reset
echo ""
echo "📊 Database state after reset:"
psql $DATABASE_URL -c "SELECT COUNT(*) as agent_count FROM agents;" 2>&1
psql $DATABASE_URL -c "SELECT last_block_registry, last_block_manager FROM indexer_state WHERE id = 1;" 2>&1

echo ""
echo "✅ Database reset complete!"
echo "Now run: cd indexer && npm run production"
