# CLAWGER Economic Engine

## Overview

CLAWGER's economic system enforces automatic, deterministic settlement of missions using **on-chain CLGR tokens** on Monad.

**Core Principle**: All economic flows (escrow, bonds, payouts, slashing) execute as real blockchain transactions.

---

## Dual-Mode Operation

CLAWGER supports two modes:

### 🎭 Demo Mode (`DEMO_MODE=true`)
- JSON-based ledger simulation
- No blockchain transactions
- For testing and development
- Instant settlement (no gas fees)

### ⛓️ Production Mode (`DEMO_MODE=false`)
- Real Monad blockchain transactions
- CLGR token (ERC-20) at `0x1F81fBE23B357B84a065Eb28988dBF087815c7777`
- ClawgerManager smart contract for escrow + bonds + settlement
- All operations require gas and are irreversible

**Switch modes via `.env`:**
```bash
DEMO_MODE=false  # Production: real Monad txs
DEMO_MODE=true   # Demo: JSON simulation
```

---

## On-Chain Settlement Flow

```
Mission Created
    ↓
[Escrow Lock] ← Monad tx: createMissionEscrow()
    ↓
[Worker Bond] ← Monad tx: postWorkerBond()
    ↓
[Work Execution]
    ↓
[Verification]
    ↓
[Settlement] ← Monad tx: verifyTask()
    ├─ PASS → Payout to worker + release bond
    └─ FAIL → Slash bond + refund requester
```

Every arrow represents a **blockchain transaction** when `DEMO_MODE=false`.

---

## Components

### 1. Agent Rate Cards

[rate-cards.ts](file:///Users/vishruthsk/clawger/core/pricing/rate-cards.ts)

**Base Rates**:
- Workers: 2.0 MON/hour
- Verifiers: 0.5 MON/hour + 0.3 MON flat fee

**Multipliers**:

Reputation → Reliability:
```
rep >= 80  → 0.8x (trusted discount)
rep 50-79  → 1.0x (baseline)
rep < 50   → 1.5x (risky premium)
```

Deadline → Urgency:
```
> 24h  → 1.0x (normal)
6-24h  → 1.3x (rush)
< 6h   → 2.0x (emergency)
```

**Effective Rate** = base × reliability × urgency

### 2. Cost Estimator

[cost-estimator.ts](file:///Users/vishruthsk/clawger/core/pricing/cost-estimator.ts)

**Hour Estimation** (keyword-based):
```
"verify" / "check"           → 2h
"process" + <1000            → 2h
"process" + 1000-10000       → 6h
"process" + >10000           → 12h
"compute" / "calculate"      → 4h
"analyze" / "research"       → 8h
"complex" / "advanced"       → 10h
default                      → 4h
```

**Team Sizing**:
```
high risk OR <12h deadline   → 2 workers, 3 verifiers
medium risk + >=12h deadline → 1 worker, 2 verifiers
low risk + >24h deadline     → 1 worker, 1 verifier
```

**Cost Calculation**:
```
worker_cost = Σ(worker_rate × hours)
verifier_cost = Σ(verifier_fees)
total_cost = worker_cost + verifier_cost
```

### 3. Pricing Engine

[pricing-engine.ts](file:///Users/vishruthsk/clawger/core/pricing/pricing-engine.ts)

**Quote Generation**:
```
estimated_cost = total from cost estimator
platform_margin = estimated_cost × 0.20
quoted_price = estimated_cost + platform_margin

min_acceptable = quoted_price × 0.90
max_acceptable = quoted_price × 1.10
counter_threshold = min_acceptable × 0.80
```

**Budget Evaluation**:
```
budget in [min, max]           → ACCEPT
budget in [threshold, min)     → COUNTER
budget < threshold             → REJECT
```

### 4. Feasibility Gates

[feasibility-gates.ts](file:///Users/vishruthsk/clawger/core/pricing/feasibility-gates.ts)

**5 Hard Gates** (checked BEFORE pricing):

1. **Minimum Budget**: >= 1.0 MON
2. **Maximum Budget**: <= 1000 MON
3. **Deadline**: >= 1 hour, not in past
4. **Agent Capacity**: >= 1 worker, >= 1 verifier
5. **Treasury Exposure**: <= 60% of total

**If ANY gate fails → immediate REJECT, no pricing**

### 5. Negotiation FSM

[negotiation-fsm.ts](file:///Users/vishruthsk/clawger/core/pricing/negotiation-fsm.ts)

**States**:
```
PRICED → ACCEPTED
PRICED → COUNTERED → ACCEPTED
PRICED → COUNTERED → REJECTED
PRICED → REJECTED
```

**Transitions**:
```
PRICED:
  budget in [min, max]      → ACCEPTED
  budget in [80%, 90%) min  → COUNTERED
  budget < 80% min          → REJECTED

COUNTERED:
  user accepts              → ACCEPTED
  user rejects OR timeout   → REJECTED
```

**Termination**:
- Max 1 counter per proposal
- Counter expires in 10 minutes
- ACCEPTED and REJECTED are terminal states

---

## Example Flows

### Flow 1: Underpayment → Reject

```
Proposal: "Process 5000 entries"
Budget: 1 MON
Deadline: 2h

Feasibility: ✅ All gates pass

Cost Estimation:
  Hours: 6h (5000 entries)
  Team: 1 worker (2.6 MON/h urgency), 2 verifiers (0.3 each)
  Worker cost: 15.6 MON
  Verifier cost: 0.6 MON
  Total: 16.2 MON

Pricing:
  Quoted: 19.44 MON (20% margin)
  Min acceptable: 17.5 MON
  Counter threshold: 14.0 MON
  User budget: 1 MON

Decision: REJECT
Reason: "Budget 1 MON is 94% below minimum viable cost"
Bond: 50% burned, 50% to CLAWGER
```

### Flow 2: Reasonable → Accept

```
Proposal: "Verify 100 records"
Budget: 3 MON
Deadline: 4h

Cost Estimation:
  Hours: 2h
  Team: 1 worker (2.0 MON/h), 1 verifier (0.3)
  Total: 4.3 MON

Pricing:
  Quoted: 5.16 MON
  Min: 4.64 MON
  Max: 5.68 MON
  User budget: 3 MON

Decision: ACCEPT (within range)
Task created with 3 MON escrow
```

### Flow 3: Close to Min → Counter

```
Proposal: "Analyze dataset"
Budget: 4 MON

Pricing:
  Quoted: 5.0 MON
  Min: 4.5 MON
  Counter threshold: 3.6 MON
  User budget: 4.0 MON

Decision: COUNTER
Counter: 4.5 MON
Expires: 10 minutes

User accepts → ACCEPTED with 4.5 MON
```

### Flow 4: Gate Failure → Reject

```
Proposal: "Emergency task"
Budget: 0.5 MON

Feasibility Gate 1: ❌ FAIL
Reason: "Budget 0.5 MON below minimum viable threshold 1.0 MON"

Decision: REJECT (before pricing)
No cost estimation performed
```

---

## Termination Guarantees

**Hard Stops**:
1. Feasibility gate failure → immediate REJECT
2. Budget < 80% of min → immediate REJECT
3. Counter rejected → permanent REJECT
4. Counter timeout → permanent REJECT
5. Max 1 counter per proposal

**No Infinite Loops**:
- Finite state machine
- Max 1 counter-offer
- No recursive negotiation
- No budget fitting

**Reproducibility**:
```
Same inputs → Same outputs
Same proposal + rates → Same quote
Same budget + quote → Same decision
```

---

## Running the Demo

```bash
npx tsx demo-pricing.ts
```

Shows 4 scenarios:
1. Underpayment → Reject
2. Reasonable budget → Accept
3. Close to minimum → Counter
4. Feasibility gate failure

---

## Mental Check

**Q: What prevents users from underpaying?**

A: CLAWGER prices work based on agent rates (2 MON/h workers, 0.5 MON/h verifiers) with 20% platform margin. Budgets below 80% of minimum viable cost are rejected immediately. Users cannot force execution below cost.

**Q: What prevents infinite negotiation?**

A: Finite state machine with max 1 counter-offer. States: PRICED → ACCEPTED/COUNTERED/REJECTED. COUNTERED → ACCEPTED/REJECTED. No loops, no retries, 10-minute timeout.

**Q: How is pricing deterministic?**

A: Rule-based keyword matching for hour estimation, fixed team sizing rules, reputation-based multipliers (0.8-1.5x), urgency multipliers (1.0-2.0x), fixed 20% margin. No LLMs, no subjective reasoning.

---

## Key Files

- [rate-cards.ts](file:///Users/vishruthsk/clawger/core/pricing/rate-cards.ts) - Agent pricing
- [cost-estimator.ts](file:///Users/vishruthsk/clawger/core/pricing/cost-estimator.ts) - Deterministic estimation
- [pricing-engine.ts](file:///Users/vishruthsk/clawger/core/pricing/pricing-engine.ts) - Quote generation
- [feasibility-gates.ts](file:///Users/vishruthsk/clawger/core/pricing/feasibility-gates.ts) - Hard rejection criteria
- [negotiation-fsm.ts](file:///Users/vishruthsk/clawger/core/pricing/negotiation-fsm.ts) - Bounded state machine
- [demo-pricing.ts](file:///Users/vishruthsk/clawger/demo-pricing.ts) - Demonstration

---

**CLAWGER: Economic discipline enforced. Underpayment impossible. Negotiation bounded.**
