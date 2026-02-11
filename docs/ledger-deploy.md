# Ledger Deployment Guide

> **Deploying CLAWGER contracts to Monad using a Ledger hardware wallet**

This guide walks through deploying ClawgerManager and other contracts using your Ledger device for maximum security.

---

## Prerequisites

### 1. Hardware
- ✅ Ledger Nano S / Nano S Plus / Nano X
- ✅ USB cable connected
- ✅ Ledger unlocked

### 2. Ledger Apps
- ✅ **Ethereum app** installed and opened on Ledger
- ✅ **"Contract data" setting enabled** in Ethereum app settings
  - Open Ethereum app on Ledger
  - Navigate to Settings > Contract data > Yes

### 3. Software Setup
```bash
# Install dependencies
npm install --save-dev @nomicfoundation/hardhat-ledger
npm install --save-dev @ledgerhq/hw-transport-node-hid

# Verify Hardhat installation
npx hardhat --version
```

### 4. Environment Variables

Ensure `.env` contains:
```bash
MONAD_RPC_URL=https://rpc.monad.xyz
CLGR_TOKEN_ADDRESS=0x1F81fBE23B357B84a065Eb28988dBF087815c7777
```

---

## Deployment Steps

### Step 1: Connect Ledger

1. Connect your Ledger device via USB
2. Unlock with PIN
3. Open the **Ethereum** app
4. Verify screen shows "Ethereum is ready"

### Step 2: Verify Derivation Path

Default derivation path: `m/44'/60'/0'/0/0`

To use a different account index, modify the path in the deployment script:
- Account 1: `m/44'/60'/0'/0/0`
- Account 2: `m/44'/60'/0'/0/1`
- Account 3: `m/44'/60'/0'/0/2`

### Step 3: Run Deployment

```bash
# Deploy to Monad mainnet
npx hardhat run scripts/deploy-with-ledger.ts --network monad

# Or deploy to testnet
npx hardhat run scripts/deploy-with-ledger.ts --network monadTestnet
```

### Step 4: Confirm on Ledger

When prompted on Ledger screen:
1. **Review contract deployment details**
2. **Scroll through all parameters**
3. **Press both buttons to APPROVE**

Expected Ledger screens:
```
Review transaction
Contract deployment

To: New Contract
Value: 0 ETH
Gas: 3,500,000

Approve ✓
```

### Step 5: Wait for Confirmation

The script will:
- ✅ Send transaction
- ✅ Wait for block confirmation
- ✅ Save contract addresses to `.env`
- ✅ Save deployment info to `deployments/monad.json`

Expected output:
```
🚀 CLAWGER Contract Deployment (Ledger Mode)

Ledger address: 0x...
Balance: 1.234 ETH

📝 Deploying ClawgerManager...
✅ ClawgerManager deployed: 0xABC...
   Transaction: 0x123...

📄 Deployment info saved: deployments/monad.json
✅ .env updated with contract addresses

📋 DEPLOYMENT SUMMARY
═══════════════════════════════════════
CLGR Token:       0x1F81fBE...
ClawgerManager:   0xABC...
AgentRegistry:    0xDEF...
═══════════════════════════════════════

🎉 Deployment complete!
```

---

## Troubleshooting

### Error: "Ledger device not found"

**Solution:**
```bash
# Check USB connection
ls /dev/ttyACM* || ls /dev/cu.usbmodem*

# Try different USB cable/port
# Restart Ledger device
```

### Error: "Contract data not enabled"

**Solution:**
1. Open Ethereum app on Ledger
2. Navigate: Settings > Contract data > **Yes**
3. Retry deployment

### Error: "Transaction rejected"

**Cause:** User pressed reject on Ledger

**Solution:** Run deployment again and approve the transaction

### Error: "Insufficient balance"

**Solution:**
```bash
# Check Ledger address balance
npx hardhat run scripts/check-ledger-balance.ts --network monad

# Transfer ETH to Ledger address for gas fees
```

### Error: "Timeout waiting for confirmation"

**Solution:**
- Check Monad network status
- Increase gas price in deployment script
- Retry deployment

---

## Security Best Practices

✅ **Never export private keys** from Ledger  
✅ **Always verify contract addresses** on Ledger screen  
✅ **Keep Ledger firmware updated**  
✅ **Store recovery phrase offline** in secure location  
✅ **Use multisig for mainnet deployments** (optional)

---

## Post-Deployment Verification

### 1. Verify Contract Addresses

Check `.env` file contains:
```bash
CLAWGER_MANAGER_ADDRESS=0x...
AGENT_REGISTRY_ADDRESS=0x...
```

### 2. Verify On-Chain

```bash
# Check ClawgerManager on block explorer
open https://explorer.monad.xyz/address/${CLAWGER_MANAGER_ADDRESS}
```

### 3. Test Contract

```bash
# Run on-chain E2E test
npm run test:onchain
```

---

## Alternative: Non-Ledger Deployment

If you need to deploy without Ledger (e.g., for testing):

```bash
# Set private key in .env
CLAWGER_PRIVATE_KEY=0x...

# Deploy with private key
npx hardhat run scripts/deploy-to-monad.ts --network monad
```

⚠️ **WARNING:** This is less secure. Use Ledger for production deployments.

---

## Next Steps

After successful deployment:

1. Set production mode:
   ```bash
   # Update .env
   DEMO_MODE=false
   ```

2. Test on-chain mission:
   ```bash
   npm run test:onchain
   ```

3. Verify contracts on explorer:
   - ClawgerManager: Escrow + Bonds + Settlement
   - AgentRegistry: Agent profiles

4. Update documentation with contract addresses

---

**Questions?** Check the [on-chain integration guide](../onchain_audit.md) or open an issue on GitHub.
