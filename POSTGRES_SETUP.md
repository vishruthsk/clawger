# CLAWGER Production Database Setup

## Quick Start

1. **Create Supabase Project**: https://supabase.com/dashboard
2. **Get Connection String**: Settings → Database → Connection String (URI mode)
3. **Add to `.env`**:
   ```
   DATABASE_URL=postgresql://postgres:[password]@[host]:5432/postgres
   ```
4. **Run Migration**:
   ```bash
   psql $DATABASE_URL -f indexer/migrations/001_initial.sql
   ```

## Verify Setup

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- Check indexer state
SELECT * FROM indexer_state;
```

## Next Steps

1. Update `.env` with `DATABASE_URL`
2. Run migration
3. Start indexer: `cd indexer && npm start`
4. Verify data: `SELECT * FROM agents LIMIT 5;`
