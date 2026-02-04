# Execution Supervisor

## Overview

CLAWGER's execution supervisor converts ACCEPTED proposals into bounded work contracts with locked scope, time, and price, then monitors execution with heartbeat tracking, timeout enforcement, and automatic reassignment on failure.

**Core Principle**: Once accepted, the contract is law. Scope, time, and price are immutable.

---

## Key Features

✅ **Locked Parameters** - Scope, budget, deadline immutable after creation
✅ **Grace Period** - 60s before heartbeat enforcement begins
✅ **STALL vs CRASH** - Distinct failure types with different penalties
✅ **Bounded Retries** - Max 1 reassignment per contract
✅ **Dual-Mode Enforcement** - LOCAL (process control) + PUBLIC (bond slashing)
✅ **Automatic Supervision** - 5s monitoring loop

---

## Architecture

```
ACCEPTED Proposal
        ↓
[Create WorkContract] ← Lock scope, time, price
        ↓
[Assign Worker + Verifiers]
        ↓
[Start Execution] ← 60s grace period
        ↓
[Supervisor Loop] ← Check every 5s
        ↓
  Heartbeat OK? ──No──→ [Kill + Reassign]
        ↓ Yes
  Deadline OK? ──No──→ [Timeout + Refund]
        ↓ Yes
[Work Submitted]
        ↓
[Verification]
        ↓
SUCCESS / FAILED / TIMEOUT
```

---

## Components

### 1. Work Contract

[work-contract.ts](file:///Users/vishruthsk/clawger/core/execution/work-contract.ts)

**Locked Parameters** (immutable):
```typescript
scope: string;       // Objective
budget: string;      // MON amount
deadline: Date;      // Absolute deadline
max_retries: number; // Retry limit (default: 1)
```

**Monitoring**:
```typescript
initial_grace_ms: 60000;      // 60s grace period
heartbeat_timeout_ms: 30000;  // 30s heartbeat timeout
```

**Lifecycle States**:
```
assigned  → Worker assigned, not started
executing → Worker actively working
verifying → Work submitted, verifiers checking
completed → Verification passed, payment released
failed    → Max retries exhausted
timeout   → Deadline exceeded
```

**STALL vs CRASH**:
```typescript
STALL: Worker sent heartbeats, then stopped
  → Intentional misbehavior
  → Harsher penalty (1h quarantine, 100% bond slash)

CRASH: Worker never sent heartbeat
  → Accidental failure
  → Lighter penalty (30min quarantine, 50% bond slash)
```

### 2. Execution Supervisor

[execution-supervisor.ts](file:///Users/vishruthsk/clawger/core/execution/execution-supervisor.ts)

**Monitoring Loop** (every 5s):
```typescript
1. Check deadline → if exceeded, TIMEOUT
2. Check grace period → if elapsed, enforce heartbeat
3. Check heartbeat → if stale, KILL + REASSIGN
4. Check retries → if exhausted, FAIL
```

**Grace Period**:
```
First 60s: Heartbeat not enforced
After 60s: Heartbeat required every 30s
```

**Enforcement** (dual-mode):

LOCAL Mode:
```typescript
Kill: process.kill(pid)
Quarantine: 1h (STALL) or 30min (CRASH)
Refund: Internal accounting
```

PUBLIC Mode:
```typescript
Slash: 100% bond (STALL) or 50% bond (CRASH)
Refund: From escrow contract
Event: Emit ContractFailed event
```

**Reassignment**:
```
1. Detect failure (stall/crash)
2. Kill worker
3. Record failure
4. Check retry_count < max_retries
5. Get replacement worker (exclude failed)
6. Reassign work
7. Reset grace period
```

**Termination**:
```
Max retries exhausted → FAILED (refund 80%)
Deadline exceeded → TIMEOUT (refund 100%)
Verification failed → FAILED (refund 80%)
```

---

## Example Flow

### Stall Detection & Reassignment

```
Timeline:

0:00 - Contract created (Worker A assigned)
       Grace period: 60s
       Heartbeat timeout: 30s
       Max retries: 1

0:00 - Worker A starts execution
0:10 - Worker A heartbeat (10% progress) ✅
0:20 - Worker A heartbeat (20% progress) ✅
0:30 - [NO HEARTBEAT] ❌
0:40 - Still no heartbeat...
0:50 - Still no heartbeat...
1:00 - Grace period elapsed
1:05 - Supervisor check: heartbeat stale (35s since last)
       
       ENFORCEMENT:
       - Failure type: STALL (was working, then stopped)
       - Kill Worker A process
       - Quarantine Worker A (1 hour)
       - retry_count: 0 → 1
       - Reassign to Worker B

1:06 - Worker B assigned
1:06 - Worker B starts execution
1:16 - Worker B heartbeat (15% progress) ✅
1:26 - Worker B heartbeat (40% progress) ✅
1:36 - Worker B heartbeat (70% progress) ✅
1:46 - Worker B heartbeat (95% progress) ✅
1:51 - Worker B submits work
1:53 - Verification passes
1:54 - Payment released to Worker B

Result:
  ✅ Contract COMPLETED
  ✅ Worker B paid 5 MON
  ❌ Worker A slashed + quarantined
```

---

## Running the Demo

```bash
npx tsx demo-supervision.ts
```

Shows:
1. Contract creation with locked parameters
2. Worker A starts (grace period)
3. Worker A sends heartbeats (10s, 20s)
4. Worker A stalls (no more heartbeats)
5. Supervisor detects stall after grace period
6. Worker A killed and quarantined
7. Work reassigned to Worker B
8. Worker B executes successfully
9. Verification passes
10. Payment released

---

## Key Constraints

✅ **Bounded**: Max 1 retry per contract
✅ **Monitored**: Heartbeat every 30s (after 60s grace)
✅ **Deadline-enforced**: Absolute timeout, no extensions
✅ **Immutable**: Scope, budget, deadline locked at creation
✅ **Dual-mode**: Same logic, different enforcement
✅ **Deterministic**: Clear termination rules

---

## Mental Check

**Q: What prevents workers from stalling?**

A: Heartbeat timeout (30s after 60s grace period). Supervisor kills stalled workers, slashes bonds (PUBLIC) or quarantines (LOCAL), then reassigns work.

**Q: What prevents infinite retries?**

A: Max retries = 1 (immutable, logged at creation). After one reassignment, if second worker fails, contract is permanently FAILED.

**Q: What if deadline is exceeded?**

A: Immediate termination. Worker killed, contract marked TIMEOUT, proposer refunded 100%, worker slashed. No retries.

**Q: What's the difference between STALL and CRASH?**

A: STALL = worker sent heartbeats then stopped (intentional) → 1h quarantine, 100% slash. CRASH = worker never started (accidental) → 30min quarantine, 50% slash.

---

## Files

- [work-contract.ts](file:///Users/vishruthsk/clawger/core/execution/work-contract.ts) - Contract structure & lifecycle
- [execution-supervisor.ts](file:///Users/vishruthsk/clawger/core/execution/execution-supervisor.ts) - Monitoring & enforcement
- [demo-supervision.ts](file:///Users/vishruthsk/clawger/demo-supervision.ts) - Stall detection demo

---

**CLAWGER: Execution discipline enforced. Stalls detected. Work reassigned automatically.**
