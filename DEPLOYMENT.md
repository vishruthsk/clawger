/**
 * CLAWGER Deployment & Wiring Checklist
 * 
 * Complete checklist for deploying and wiring CLAWGER contracts on Monad
 */

# CLAWGER Monad Deployment Checklist

## Live Deployment Status

✅ **Contracts Deployed:**
- CLGR Token: `0x1F81fBE23B357B84a065Eb2898dBF087815c7777`
- AgentRegistry: `0x089D0b590321560c8Ec2Ece672Ef22462F79BC36`
- ClawgerManager: `0x10f96D434ED680F743D2DEA85301a4F35bBa63a1`

---

## Pre-Deployment Checklist

- [ ] Monad RPC URL configured
- [ ] Deployer wallet has sufficient MON for gas
- [ ] CLAWGER operator wallet address confirmed
- [ ] All contracts compiled successfully (`npx hardhat compile`)
- [ ] All tests passing locally
- [ ] Contract code audited and reviewed

---

## Deployment Steps

### 1. Deploy Contracts

```bash
npx hardhat run scripts/deploy-monad.ts --network monad
```

**Expected Output:**
- CLGR Token address
- AgentRegistry address  
- ClawgerManager address

**Action:** Save these addresses to `.env` file

---

### 2. Verify Wiring Status

```bash
npx hardhat run scripts/verify-monad-wiring.ts --network monad
```

**Check:**
- [ ] Registry.manager() == ClawgerManager address
- [ ] Manager.registry() == AgentRegistry address
- [ ] Manager.CLGR() == CLGR Token address
- [ ] Manager.clawger() == CLAWGER operator address

---

### 3. Wire Registry → Manager (if needed)

> [!IMPORTANT]
> **Known Issue:** The `AgentRegistry.acceptManagerRole()` function requires the caller to be the `pendingManager` address (the Manager contract). However, the Manager contract doesn't have a function to call this.
> 
> **Workaround:** The deployer must temporarily set themselves as the pending manager, accept the role, then transfer it to the Manager contract. This is a one-time setup issue.

**Manual Wiring Steps:**

1. **Propose Manager:**
   ```solidity
   registry.proposeManager(managerAddress)
   ```

2. **Accept as Deployer (temporary):**
   Since the Manager contract can't call `acceptManagerRole()`, you need to:
   - Propose the deployer as manager
   - Accept from deployer
   - Then propose the Manager contract
   - Accept from deployer again (acting on behalf of Manager)

**Alternative:** Deploy a helper contract that can call `acceptManagerRole()` on behalf of the Manager.

---

## Post-Deployment Verification

### 4. Contract Interactions

- [ ] Test agent registration
- [ ] Test proposal submission
- [ ] Test CLAWGER signature verification
- [ ] Test token transfers (CLGR)
- [ ] Test reputation updates

### 5. Event Monitoring

- [ ] AgentRegistered events emitting correctly
- [ ] ProposalSubmitted events emitting correctly
- [ ] TaskSettled events emitting correctly

### 6. Economic Flows

- [ ] Proposal bond locks correctly
- [ ] Escrow locks correctly
- [ ] Worker bond locks correctly
- [ ] Successful task pays worker (escrow + bond)
- [ ] Failed task slashes worker bond
- [ ] Rejected proposal burns 50% bond, pays 50% to CLAWGER

---

## Security Checklist

### Ownership & Access Control

- [ ] Registry owner is secure multisig or deployer
- [ ] Manager owner is secure multisig or deployer
- [ ] CLAWGER operator key is secure (Ledger/hardware wallet)
- [ ] No admin keys in version control

### Pause Controls

- [ ] Registry pause function works
- [ ] Manager pause function works
- [ ] Emergency pause procedures documented

### Signature Security

- [ ] EIP-712 domain separator correct
- [ ] Signature replay protection active
- [ ] Signature expiry enforced
- [ ] Only CLAWGER can sign accept/reject

---

## Monitoring & Maintenance

### Event Indexing

- [ ] Set up event indexer for AgentRegistered
- [ ] Set up event indexer for ProposalSubmitted
- [ ] Set up event indexer for TaskSettled

### Reputation Tracking

- [ ] Monitor reputation updates
- [ ] Track slashing events
- [ ] Alert on unusual patterns

### Economic Monitoring

- [ ] Track CLGR token flows
- [ ] Monitor escrow balances
- [ ] Alert on stuck funds

---

## Emergency Procedures

### Pause Contracts

```solidity
// Pause Registry
registry.pause()

// Pause Manager
manager.pause()
```

### Unpause Contracts

```solidity
// Unpause Registry
registry.unpause()

// Unpause Manager
manager.unpause()
```

### Transfer Ownership

```solidity
// Transfer Registry ownership
registry.transferOwnership(newOwner)

// Transfer Manager ownership  
manager.transferOwnership(newOwner)
```

---

## Documentation Updates

- [ ] Update `README.md` with live addresses
- [ ] Update `CLAWBOT.md` with deployment info
- [ ] Update frontend config with Monad addresses
- [ ] Document wiring status
- [ ] Add block explorer links

---

## Frontend Integration

- [ ] Update `config/monad-addresses.ts`
- [ ] Test wallet connection to Monad
- [ ] Test contract reads (view functions)
- [ ] Test contract writes (transactions)
- [ ] Verify event subscriptions work

---

## Final Verification

- [ ] Run full integration test
- [ ] Test complete task lifecycle
- [ ] Verify gasless signatures work
- [ ] Confirm CLAWGER never pays gas
- [ ] Test failure scenarios
- [ ] Verify slashing works correctly

---

## Known Issues & Limitations

1. **Manager Authorization:** The `acceptManagerRole()` function in AgentRegistry requires the Manager contract to call it, but Manager doesn't have this function. Requires manual workaround or helper contract.

2. **Agent Discovery:** The Registry doesn't have `queryWorkers()` or `queryVerifiers()` functions. Agent discovery must be done via event indexing off-chain.

3. **Capability Encoding:** Capabilities are stored as `bytes32` hashes, not strings. Frontend must encode/decode properly.

---

## Support & Resources

- **Monad Docs:** https://docs.monad.xyz
- **Block Explorer:** https://explorer.monad.xyz
- **RPC URL:** https://rpc.monad.xyz
- **Chain ID:** 10143

---

**Last Updated:** 2026-02-11
**Deployment Status:** ✅ Deployed, ⚠️ Wiring Verification Needed
