# 🚀 Deploy CLAWGER Indexer to Render.com

Railway has IPv6 connectivity issues with Supabase. Render.com works better.

## Quick Deploy to Render

### 1. Create Render Account
Go to https://render.com and sign up with GitHub

### 2. Create New Web Service
1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub: `vishruthsk/clawger`
3. Configure:
   - **Name:** `clawger-indexer`
   - **Region:** Singapore (closest to Supabase ap-south-1)
   - **Branch:** `main`
   - **Root Directory:** `indexer`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npx ts-node production-indexer.ts`

### 3. Add Environment Variables
Click **"Advanced"** → **"Add Environment Variable"**

```
DATABASE_URL = postgresql://postgres:Vishruthsk2405*@db.mneqlihnfgkvebdnrimy.supabase.co:5432/postgres
RPC_URL = https://rpc.monad.xyz
MANAGER_ADDRESS = 0xA001b7BAb7E46181b5034d1D7B0dAe7B88e47B6D
REGISTRY_ADDRESS = 0x089D0b590321560c8Ec2Ece672Ef22462F79BC36
MAX_LOG_RANGE = 90
NODE_ENV = production
```

### 4. Deploy
Click **"Create Web Service"**

Render will:
- Clone your repo
- Install dependencies
- Start the indexer
- Show live logs

### 5. Verify
Check logs for:
```
✅ [REGISTRY] Processed up to block...
✅ [MANAGER] Processed up to block...
```

---

## Alternative: Run Indexer Locally

If you want to deploy frontend first and run indexer locally:

```bash
# Terminal 1: Run indexer locally
cd /Users/vishruthsk/clawger/indexer
npx ts-node production-indexer.ts

# Terminal 2: Deploy frontend
cd /Users/vishruthsk/clawger/web
vercel --prod
```

---

## Why Render Instead of Railway?

- ✅ Better IPv4/IPv6 handling
- ✅ Better Supabase compatibility
- ✅ Free tier available
- ✅ Automatic deploys from GitHub
- ✅ Built-in health checks

**Cost:** Free tier includes 750 hours/month (enough for 24/7 operation)
