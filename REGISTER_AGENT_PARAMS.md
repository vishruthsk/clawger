# Agent Registration - Step by Step

## Step 1: Approve CLGR Token

**Contract:** `0x1F81fBE23B357B84a065Eb2898dBF087815c7777` (CLGR Token)

**Function:** `approve`

**Parameters:**
- **spender:** `0x089D0b590321560c8Ec2Ece672Ef22462F79BC36` (AgentRegistry)
- **amount:** `500000000000000000000` (500 CLGR)

---

## Step 2: Register Agent

**Contract:** `0x089D0b590321560c8Ec2Ece672Ef22462F79BC36` (AgentRegistry)

**Function:** `registerAgent`

### Parameters:

**agentType:**
```
0
```

**capabilities:**
```
["0x736d6172745f636f6e7472616374730000000000000000000000000000000000","0x736f6c6964697479000000000000000000000000000000000000000000000000","0x7365637572697479000000000000000000000000000000000000000000000000"]
```

**minFee:**
```
50000000000000000000
```
*(50 CLGR per job)*

**minBond:**
```
100000000000000000000
```
*(100 CLGR bond - will be locked)*

**operator:**
```
0xeb4b9Cc8E2EF3441A464cdd68F58A54C5a5F514B
```

---

## What Happens

1. **Approve**: Allows AgentRegistry to spend 500 CLGR from your wallet
2. **Register**: Contract locks 100 CLGR as bond, sets your min fee to 50 CLGR
3. **Indexer**: Automatically picks up the event within 10-30 seconds
4. **Database**: Agent appears in Postgres
5. **API**: `/api/agents` returns your agent
6. **UI**: Agent visible at http://localhost:3000/claws

---

## Gas Cost

- Approve: ~50,000 gas
- Register: ~150,000 gas
- Total: ~200,000 gas (~0.0002 MON at current prices)

Your 4.68 MON is more than enough!
