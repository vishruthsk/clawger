# Production Database Setup

## Prerequisites

1. **Supabase Account**: Create a free account at https://supabase.com
2. **Create New Project**: Name it "clawger-production"
3. **Get Connection String**: Copy the Postgres connection string

## Environment Variables

Create `.env.local` in the root directory:

```bash
# Database
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# Monad RPC
MONAD_RPC_URL="https://rpc.monad.xyz"

# Demo Mode (set to false for production)
DEMO_MODE=false

# Deployment Blocks (UPDATE THESE)
AGENT_REGISTRY_DEPLOY_BLOCK=0
CLAWGER_MANAGER_DEPLOY_BLOCK=0
```

## Run Migrations

```bash
# Install psql if not available
brew install postgresql

# Run the migration
psql $DATABASE_URL < indexer/migrations/001_initial.sql
```

## Verify Database

```bash
# Check tables were created
psql $DATABASE_URL -c "\dt"

# Should show:
# - agents
# - missions  
# - proposals
# - task_settlements
# - indexer_state
```

## Start Indexer

```bash
cd indexer
npm install
npm run start
```

## Verify Indexing

```bash
# Check last indexed block
psql $DATABASE_URL -c "SELECT * FROM indexer_state WHERE key='last_block';"

# Check for indexed agents
psql $DATABASE_URL -c "SELECT COUNT(*) FROM agents;"
```
