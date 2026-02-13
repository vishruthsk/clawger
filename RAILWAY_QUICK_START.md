# 🚀 CLAWGER Railway Quick Deploy

## Your Actual Contract Addresses (from monad-production.ts)

```
MANAGER_ADDRESS=0xA001b7BAb7E46181b5034d1D7B0dAe7B88e47B6D
REGISTRY_ADDRESS=0x089D0b590321560c8Ec2Ece672Ef22462F79BC36
```

---

## Railway Environment Variables (Copy-Paste Ready)

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `postgresql://postgres:Vishruthsk2405*@db.mneqlihnfgkvebdnrimy.supabase.co:5432/postgres` |
| `RPC_URL` | `https://rpc.monad.xyz` |
| `MANAGER_ADDRESS` | `0xA001b7BAb7E46181b5034d1D7B0dAe7B88e47B6D` |
| `REGISTRY_ADDRESS` | `0x089D0b590321560c8Ec2Ece672Ef22462F79BC36` |
| `MAX_LOG_RANGE` | `90` |
| `NODE_ENV` | `production` |

---

## Quick Deploy via Railway CLI

```bash
# 1. Navigate to indexer directory
cd /Users/vishruthsk/clawger/indexer

# 2. Login to Railway
railway login

# 3. Initialize project
railway init

# 4. Set all environment variables (copy-paste these commands)
railway variables set DATABASE_URL="postgresql://postgres:Vishruthsk2405*@db.mneqlihnfgkvebdnrimy.supabase.co:5432/postgres"

railway variables set RPC_URL="https://rpc.monad.xyz"

railway variables set MANAGER_ADDRESS="0xA001b7BAb7E46181b5034d1D7B0dAe7B88e47B6D"

railway variables set REGISTRY_ADDRESS="0x089D0b590321560c8Ec2Ece672Ef22462F79BC36"

railway variables set MAX_LOG_RANGE="90"

railway variables set NODE_ENV="production"

# 5. Deploy
railway up

# 6. Monitor logs
railway logs --follow
```

---

## Quick Deploy via Railway Dashboard

1. **Go to:** https://railway.app/new
2. **Click:** "Deploy from GitHub repo"
3. **Select:** `vishruthsk/clawger`
4. **Configure:**
   - Root Directory: `indexer`
   - Start Command: `npx ts-node production-indexer.ts`

5. **Add Variables** (click "New Variable" for each):

```
DATABASE_URL = postgresql://postgres:Vishruthsk2405*@db.mneqlihnfgkvebdnrimy.supabase.co:5432/postgres
RPC_URL = https://rpc.monad.xyz
MANAGER_ADDRESS = 0xA001b7BAb7E46181b5034d1D7B0dAe7B88e47B6D
REGISTRY_ADDRESS = 0x089D0b590321560c8Ec2Ece672Ef22462F79BC36
MAX_LOG_RANGE = 90
NODE_ENV = production
```

6. **Click:** "Deploy"

---

## Verify Deployment

After deployment, check logs for:

```
✅ [REGISTRY] Indexing from block X to Y
✅ [MANAGER] Indexing from block X to Y
✅ [REGISTRY] ✅ Processed up to block...
✅ [MANAGER] ✅ Processed up to block...
```

---

## Troubleshooting

**If logs show errors:**
```bash
# Check database connection
psql "postgresql://postgres:Vishruthsk2405*@db.mneqlihnfgkvebdnrimy.supabase.co:5432/postgres" -c "SELECT 1"

# Reset indexer state if needed
psql "postgresql://postgres:Vishruthsk2405*@db.mneqlihnfgkvebdnrimy.supabase.co:5432/postgres" -c "UPDATE indexer_state SET last_block_registry = 55094390, last_block_manager = 55094390;"
```

**If deployment fails:**
1. Check Railway logs for specific error
2. Verify all environment variables are set
3. Ensure `package.json` and `tsconfig.json` exist in indexer directory

---

## Next: Deploy Frontend to Vercel

After indexer is running:

```bash
cd /Users/vishruthsk/clawger/web

# Update .env.production with same contract addresses
# Then deploy:
vercel --prod
```

See `RAILWAY_DEPLOYMENT.md` for detailed guide.
