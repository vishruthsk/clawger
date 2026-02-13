# Railway Deployment Guide for CLAWGER Indexer

## Prerequisites
- Railway account (sign up at https://railway.app)
- Railway CLI installed: `npm install -g @railway/cli`
- Your GitHub repository pushed with latest code

---

## Method 1: Deploy via Railway Dashboard (Recommended - Easiest)

### Step 1: Create Railway Project

1. Go to https://railway.app/new
2. Click **"Deploy from GitHub repo"**
3. Authorize Railway to access your GitHub
4. Select repository: **`vishruthsk/clawger`**
5. Click **"Deploy Now"**

### Step 2: Configure Service

1. After deployment starts, click on the service
2. Go to **Settings** tab
3. Set **Root Directory**: `indexer`
4. Set **Start Command**: `npx ts-node production-indexer.ts`
5. Click **"Save Changes"**

### Step 3: Add Environment Variables

Click on **Variables** tab and add these:

| Variable Name | Value |
|--------------|-------|
| `DATABASE_URL` | `postgresql://postgres:Vishruthsk2405*@db.mneqlihnfgkvebdnrimy.supabase.co:5432/postgres` |
| `RPC_URL` | `https://rpc.monad.xyz` |
| `MANAGER_ADDRESS` | `0x1C4a2Ab8b7F7c67FD8c8E8F8c8E8F8c8E8F8c8E8` *(replace with your actual address)* |
| `REGISTRY_ADDRESS` | `0x2D5b3Bc9c8G8d78GE9d9F9d9F9d9F9d9F9d9F9d9` *(replace with your actual address)* |
| `MAX_LOG_RANGE` | `90` |
| `NODE_ENV` | `production` |

**To add each variable:**
1. Click **"New Variable"**
2. Enter **Variable Name** (exactly as shown above)
3. Enter **Value**
4. Click **"Add"**

### Step 4: Redeploy

1. After adding all variables, go to **Deployments** tab
2. Click **"Redeploy"** on the latest deployment
3. Wait for deployment to complete (usually 2-3 minutes)

### Step 5: Verify Deployment

1. Go to **Deployments** tab
2. Click on the latest deployment
3. Click **"View Logs"**
4. Look for these success messages:

```
[REGISTRY] Indexing from block X to Y
[MANAGER] Indexing from block X to Y
[REGISTRY] ✅ Processed up to block...
[MANAGER] ✅ Processed up to block...
```

✅ **Success!** Your indexer is now running on Railway.

---

## Method 2: Deploy via Railway CLI

### Step 1: Login to Railway

```bash
cd /Users/vishruthsk/clawger/indexer
railway login
```

This will open a browser window. Authorize the CLI.

### Step 2: Initialize Project

```bash
# Create new project
railway init

# When prompted:
# - Project name: clawger-indexer
# - Select: "Create new project"
```

### Step 3: Add Environment Variables

```bash
# Add all environment variables
railway variables set DATABASE_URL="postgresql://postgres:Vishruthsk2405*@db.mneqlihnfgkvebdnrimy.supabase.co:5432/postgres"

railway variables set RPC_URL="https://rpc.monad.xyz"

railway variables set MANAGER_ADDRESS="0x1C4a2Ab8b7F7c67FD8c8E8F8c8E8F8c8E8F8c8E8"

railway variables set REGISTRY_ADDRESS="0x2D5b3Bc9c8G8d78GE9d9F9d9F9d9F9d9F9d9F9d9"

railway variables set MAX_LOG_RANGE="90"

railway variables set NODE_ENV="production"
```

**⚠️ Important:** Replace the `MANAGER_ADDRESS` and `REGISTRY_ADDRESS` with your actual deployed contract addresses!

### Step 4: Deploy

```bash
railway up
```

This will:
- Build your indexer
- Deploy to Railway
- Start the service

### Step 5: Monitor Logs

```bash
railway logs --follow
```

Look for success messages like:
```
[REGISTRY] ✅ Processed up to block 55094750
[MANAGER] ✅ Processed up to block 55094750
```

---

## Finding Your Contract Addresses

If you don't have your contract addresses yet, you need to deploy the contracts first:

### Deploy ClawgerManager
```bash
cd /Users/vishruthsk/clawger/contracts
# Deploy using your preferred method (Hardhat, Foundry, etc.)
# Save the deployed address
```

### Deploy AgentRegistry
```bash
# Deploy AgentRegistry
# Save the deployed address
```

**Example addresses from your previous deployment:**
- Manager: Check your deployment scripts output
- Registry: Check your deployment scripts output

---

## Troubleshooting

### Issue: "Command not found: railway"

**Solution:**
```bash
npm install -g @railway/cli
```

### Issue: "Build failed"

**Solution:**
1. Check Railway logs for specific error
2. Verify `package.json` has all dependencies
3. Ensure `tsconfig.json` exists in indexer directory

### Issue: "Database connection failed"

**Solution:**
1. Verify `DATABASE_URL` is correct
2. Check Supabase dashboard - database should be running
3. Test connection locally:
```bash
psql "postgresql://postgres:Vishruthsk2405*@db.mneqlihnfgkvebdnrimy.supabase.co:5432/postgres" -c "SELECT 1"
```

### Issue: "No blocks being processed"

**Solution:**
1. Check `RPC_URL` is correct
2. Verify contract addresses are correct
3. Check if contracts have any events to index
4. Reset indexer state if needed:
```bash
psql $DATABASE_URL -c "UPDATE indexer_state SET last_block_registry = 55094390, last_block_manager = 55094390;"
```

---

## Monitoring Your Indexer

### View Logs (Dashboard)
1. Go to https://railway.app
2. Select your project
3. Click on service
4. Go to **Deployments** → **View Logs**

### View Logs (CLI)
```bash
railway logs --tail 100
```

### Check Database
```bash
# Check latest indexed blocks
psql "postgresql://postgres:Vishruthsk2405*@db.mneqlihnfgkvebdnrimy.supabase.co:5432/postgres" -c "SELECT * FROM indexer_state;"

# Check recent proposals
psql "postgresql://postgres:Vishruthsk2405*@db.mneqlihnfgkvebdnrimy.supabase.co:5432/postgres" -c "SELECT * FROM proposals ORDER BY id DESC LIMIT 5;"

# Check recent tasks
psql "postgresql://postgres:Vishruthsk2405*@db.mneqlihnfgkvebdnrimy.supabase.co:5432/postgres" -c "SELECT * FROM tasks ORDER BY id DESC LIMIT 5;"
```

---

## Health Checks

Railway will automatically restart your service if it crashes. You can verify it's healthy by:

1. **Logs show continuous processing:**
```
[REGISTRY] ✅ Processed up to block X
[MANAGER] ✅ Processed up to block Y
```

2. **Database is updating:**
```bash
# Check last update time
psql $DATABASE_URL -c "SELECT updated_at FROM indexer_state WHERE id = 1;"
```

3. **No errors in logs:**
```bash
railway logs --tail 100 | grep -i error
# Should return nothing or only old errors
```

---

## Updating Your Indexer

When you push new code to GitHub:

### If using GitHub integration:
1. Railway auto-deploys on push to main
2. Check **Deployments** tab to see progress

### If using CLI:
```bash
cd /Users/vishruthsk/clawger/indexer
git pull origin main
railway up
```

---

## Cost Estimate

Railway Pricing (as of 2024):
- **Starter Plan**: $5/month
  - 512 MB RAM
  - 1 GB disk
  - Sufficient for indexer

- **Developer Plan**: $20/month
  - 8 GB RAM
  - 100 GB disk
  - Recommended for production

**Your indexer should run fine on the Starter plan initially.**

---

## Next Steps After Deployment

1. ✅ Verify indexer is running on Railway
2. ✅ Deploy frontend to Vercel
3. ✅ Test end-to-end flow
4. ✅ Monitor for 24 hours
5. ✅ Set up alerts

See `LAUNCH_CHECKLIST.md` for full verification steps.
