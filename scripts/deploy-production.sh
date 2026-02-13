#!/bin/bash

# CLAWGER Production Deployment Script
# This script automates the deployment process

set -e  # Exit on error

echo "🚀 CLAWGER Production Deployment"
echo "================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if required tools are installed
echo "📋 Checking prerequisites..."
command -v railway >/dev/null 2>&1 || { echo -e "${RED}❌ Railway CLI not installed${NC}"; exit 1; }
command -v vercel >/dev/null 2>&1 || { echo -e "${RED}❌ Vercel CLI not installed${NC}"; exit 1; }
command -v psql >/dev/null 2>&1 || { echo -e "${RED}❌ psql not installed${NC}"; exit 1; }
echo -e "${GREEN}✅ All prerequisites met${NC}"
echo ""

# Step 1: Verify Database
echo "1️⃣  Verifying database..."
psql $DATABASE_URL -f scripts/verify-database.sql > /tmp/db-verify.log 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Database verified${NC}"
else
    echo -e "${RED}❌ Database verification failed. Check /tmp/db-verify.log${NC}"
    exit 1
fi
echo ""

# Step 2: Deploy Indexer
echo "2️⃣  Deploying indexer to Railway..."
cd indexer
railway up
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Indexer deployed${NC}"
else
    echo -e "${RED}❌ Indexer deployment failed${NC}"
    exit 1
fi
cd ..
echo ""

# Wait for indexer to start
echo "⏳ Waiting for indexer to start (30s)..."
sleep 30

# Check indexer logs
echo "📊 Checking indexer logs..."
railway logs --tail 20 | grep -q "Processed up to block"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Indexer is processing blocks${NC}"
else
    echo -e "${YELLOW}⚠️  Indexer may not be running correctly. Check logs manually.${NC}"
fi
echo ""

# Step 3: Deploy Frontend
echo "3️⃣  Deploying frontend to Vercel..."
cd web
vercel --prod --yes
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Frontend deployed${NC}"
else
    echo -e "${RED}❌ Frontend deployment failed${NC}"
    exit 1
fi
cd ..
echo ""

# Step 4: Verify API
echo "4️⃣  Verifying API endpoints..."
sleep 10  # Wait for Vercel to propagate

# Get Vercel URL
VERCEL_URL=$(cd web && vercel inspect --json | jq -r '.url')
echo "Testing API at: https://$VERCEL_URL"

# Test missions endpoint
curl -s "https://$VERCEL_URL/api/missions" > /tmp/api-test.json
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ API responding${NC}"
else
    echo -e "${RED}❌ API not responding${NC}"
    exit 1
fi
echo ""

# Step 5: Final Checks
echo "5️⃣  Running final checks..."

# Check for demo mode
if grep -q "DEMO_MODE=true" web/.env.production 2>/dev/null; then
    echo -e "${RED}❌ DEMO_MODE is enabled in production!${NC}"
    exit 1
else
    echo -e "${GREEN}✅ DEMO_MODE disabled${NC}"
fi

# Check database connection
psql $DATABASE_URL -c "SELECT 1" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Database connection working${NC}"
else
    echo -e "${RED}❌ Database connection failed${NC}"
    exit 1
fi

echo ""
echo "================================"
echo -e "${GREEN}🎉 CLAWGER DEPLOYED SUCCESSFULLY!${NC}"
echo "================================"
echo ""
echo "📍 Frontend: https://$VERCEL_URL"
echo "📊 Indexer: Check Railway dashboard"
echo "💾 Database: Supabase dashboard"
echo ""
echo "Next steps:"
echo "1. Submit a test proposal: cd scripts && npx ts-node submit-proposal.ts"
echo "2. Monitor indexer logs: railway logs --follow"
echo "3. Check UI: open https://$VERCEL_URL/missions"
echo ""
echo "See LAUNCH_CHECKLIST.md for full verification steps."
