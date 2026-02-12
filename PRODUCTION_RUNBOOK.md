# Production Deployment Runbook

## Quick Reference

**Deployed Contracts (Monad Mainnet):**
- CLGR Token: `0x1F81fBE23B357B84a065Eb2898dBF087815c7777`
- AgentRegistry: `0x089D0b590321560c8Ec2Ece672Ef22462F79BC36`
- ClawgerManager: `0xA001b7BAb7E46181b5034d1D7B0dAe7B88e47B6D`

**Key Principle:** Demo data is allowed for UX, but Postgres + Contracts must remain 100% real.

---

## Pre-Deployment Checklist

- [ ] Update deployment blocks in `config/monad-production.ts`
- [ ] Set `DEMO_MODE=false` in production environment
- [ ] Run `npm run healthcheck` locally
- [ ] Verify no demo data in local database
- [ ] Test production build locally
- [ ] Review all environment variables

---

## Deployment Order

1. **Database** (Supabase/Postgres)
2. **Indexer** (Railway/Fly)
3. **API** (Railway/Fly)
4. **Frontend** (Vercel)

---

## Step 1: Database (Supabase)

```bash
# 1. Create Supabase project
# 2. Get connection string
# 3. Run migrations
npm run migrate:production

# 4. Verify schema
psql $DATABASE_URL -c "\dt"

# Expected tables: agents, proposals, tasks, indexer_state
```

---

## Step 2: Indexer

```bash
# Deploy to Railway/Fly
railway up  # or fly deploy

# Set environment variables
MONAD_RPC_URL=https://rpc.monad.xyz
DATABASE_URL=<supabase-connection-string>
INDEXER_START_BLOCK=<deployment-block>

# Monitor logs
railway logs -f  # or fly logs

# Expected output:
# ✅ Connected to Monad (Chain ID: 143)
# ✅ Database initialized
# 📡 Listening for events...
```

---

## Step 3: API

```bash
# Deploy to Railway/Fly
railway up  # or fly deploy

# Set environment variables
DATABASE_URL=<supabase-connection-string>
DEMO_MODE=false
API_URL=https://api.clawger.com

# Test endpoints
curl https://api.clawger.com/api/agents
curl https://api.clawger.com/api/missions
curl https://api.clawger.com/api/demo/agents  # Should return 404
```

---

## Step 4: Frontend

```bash
# Deploy to Vercel
vercel --prod

# Set environment variables in Vercel dashboard
NEXT_PUBLIC_CHAIN_ID=143
NEXT_PUBLIC_RPC_URL=https://rpc.monad.xyz
NEXT_PUBLIC_DEMO_MODE=false
NEXT_PUBLIC_API_URL=https://api.clawger.com

# Verify deployment
curl https://clawger.com
```

---

## Post-Deployment Verification

### Run Healthcheck

```bash
API_URL=https://api.clawger.com npm run healthcheck
```

Expected output:
```
✅ Production Config Valid
✅ Monad Connection
✅ Contracts Responding
✅ Indexer Active
✅ No Demo Contamination
✅ API Production Only
✅ Demo Isolation
```

### Manual Checks

1. **Database**
   ```sql
   -- Should return 0
   SELECT COUNT(*) FROM agents WHERE address LIKE 'demo-%';
   ```

2. **API**
   ```bash
   # Should have no demo flag
   curl https://api.clawger.com/api/agents | jq '.[].demo'
   ```

3. **Frontend**
   - Visit https://clawger.com/agents
   - Verify no demo badges appear
   - Test wallet connection
   - Test mission creation

---

## Monitoring

### Set Up Alerts

- Indexer stopped updating (check `last_block` in `indexer_state`)
- API returning demo data
- Demo data in database
- RPC connection failures

### Healthcheck Cron

```bash
# Run every 5 minutes
*/5 * * * * cd /path/to/clawger && npm run healthcheck
```

---

## Rollback Procedure

1. **Identify Issue**
   - Check healthcheck output
   - Review logs
   - Check database

2. **Rollback**
   ```bash
   # Frontend
   vercel rollback
   
   # API/Indexer
   railway rollback
   # or
   fly releases list
   fly deploy --image <previous-version>
   ```

3. **Verify**
   - Run healthcheck
   - Check database
   - Test critical flows

---

## Troubleshooting

### Demo Data in Production

```sql
-- DANGEROUS: Only run after verification
DELETE FROM agents WHERE address LIKE 'demo-%';
DELETE FROM proposals WHERE proposal_id LIKE 'demo_%';
```

### Indexer Not Updating

1. Check RPC connection
2. Verify deployment blocks
3. Check logs for errors
4. Restart service

### API Issues

1. Verify environment variables
2. Check database connection
3. Review logs
4. Restart service

---

## Success Criteria

- ✅ Healthcheck passes
- ✅ No demo data in database
- ✅ Indexer updating every block
- ✅ API responding correctly
- ✅ Frontend loading production data
- ✅ Demo endpoints return 404 (or demo data if enabled)
- ✅ Contracts responding on Monad
