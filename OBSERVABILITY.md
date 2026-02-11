# Observability & Metrics Layer

## Overview

CLAWGER's observability layer provides transparency, auditability, and safety guarantees across **demo and production modes**.

**Core Principle**: Observability reads state and tracks economic flows. In production mode (`DEMO_MODE=false`), it monitors **on-chain transactions** on Monad.

---

## Dual-Mode Observability

### 🎭 Demo Mode (`DEMO_MODE=true`)
- JSON-based event logging
- In-memory metrics
- Local decision traces
- File-based auditing (`data/` directory)

### ⛓️ Production Mode (`DEMO_MODE=false`)
- **On-chain transaction monitoring**
- Block explorer integration
- Gas usage tracking
- Event indexing from Monad RPC
- Transaction hash logging for all economic operations

---

## Key Features

✅ **Deterministic Metrics** - Same events → same metrics  
✅ **Append-Only Design** - No deletions, full audit trail  
✅ **Decision Traces** - Structured JSON log for audit and replay  
✅ **Transaction Monitoring** - Track Monad txs for escrow, bonds, settlement  
✅ **Health Guardrails** - Automatic SAFE MODE on degradation  
✅ **Read-Only Observer** - Visibility without control surface  

---

## Architecture

```
Execution Events
        ↓
[Metrics Engine] ← Append-only counters
        ↓
[Decision Trace] ← Structured JSON log
        ↓
[Tx Monitor] ← Track on-chain operations (if production)
        ↓
[Health Monitor] ← Detect degradation
        ↓
[Safe Mode] ← Auto-reject new work
        ↓
[Observer] ← Read-only visibility
```

---

## Components

### 1. Metrics Engine

[metrics-engine.ts](file:///Users/vishruthsk/clawger/core/observability/metrics-engine.ts)

**Contract Lifecycle**:
```
created: 5
completed: 4
failed: 0
timeout: 1
active: 0
```

**Failure Analysis**:
```
stall: 1      (worker sent heartbeats, then stopped)
crash: 0      (worker never started)
verification: 0
timeout: 1
```

**Retry Tracking**:
```
used: 1       (total reassignments)
exhausted: 0  (hit max retries)
```

**Worker Reliability**:
```
0xWORKER_A:
  assigned: 1
  completed: 0
  failed: 1
  stalls: 1
  success_rate: 0%

0xWORKER_B:
  assigned: 1
  completed: 1
  failed: 0
  success_rate: 100%
```

**Append-Only**: Counters only increment, never decrement (except active contracts).

### 2. Decision Trace Log

[decision-trace.ts](file:///Users/vishruthsk/clawger/core/observability/decision-trace.ts)

**Trace Format**:
```json
{
  "timestamp": "2026-02-04T19:10:00Z",
  "trace_id": "TRACE-001",
  "contract_id": "CONTRACT-123",
  "decision_type": "WORKER_KILLED",
  "reason": "Heartbeat stale (45s since last)",
  "mode": "LOCAL",
  "context": {
    "worker": "0xWORKER_A",
    "failure_type": "STALL",
    "time_since_heartbeat_ms": 45000
  }
}
```

**Decision Types**:
- `CONTRACT_CREATED`
- `EXECUTION_STARTED`
- `HEARTBEAT_RECEIVED`
- `WORKER_KILLED`
- `WORK_REASSIGNED`
- `CONTRACT_COMPLETED`
- `CONTRACT_FAILED`
- `CONTRACT_TIMEOUT`
- `VERIFICATION_PASSED`
- `VERIFICATION_FAILED`
- `SAFE_MODE_ENTERED`
- `SAFE_MODE_EXITED`

**Replay Capability**:
```typescript
decisionTrace.replayContract('CONTRACT-123');
// Shows chronological sequence of all decisions for that contract
```

### 3. Health Monitor

[health-monitor.ts](file:///Users/vishruthsk/clawger/core/observability/health-monitor.ts)

**Health Metrics**:
```
failure_rate: 20% (1/5 contracts)
stall_rate: 50% (1/2 failures)
retry_exhaustion_rate: 0% (0/1 retries)
timeout_rate: 20% (1/5 contracts)
```

**SAFE MODE Thresholds**:
```
failure_rate > 50%           → SAFE MODE
stall_rate > 70%             → SAFE MODE
retry_exhaustion_rate > 60%  → SAFE MODE
timeout_rate > 30%           → SAFE MODE
```

**SAFE MODE Behavior**:
```
ACTIVE:
  - Reject all new contract proposals
  - Continue monitoring active contracts
  - Allow active contracts to complete/fail
  - Log all rejections

INACTIVE:
  - Normal operation
  - Accept new contracts
```

**Automatic Entry/Exit**:
```typescript
// Checked after each contract completion/failure
healthMonitor.updateSafeModeStatus();

// Enters if degraded, exits when health improves
```

### 4. Observer Interface

[observer.ts](file:///Users/vishruthsk/clawger/core/observability/observer.ts)

**Read-Only Methods**:
```typescript
observer.getView()                    // Full system snapshot
observer.getContract(contractId)      // Contract details
observer.getWorkerStats(worker)       // Worker metrics
observer.getDecisionHistory(limit)    // Recent decisions
observer.getHealthStatus()            // Health metrics
observer.isSafeMode()                 // SAFE MODE status
```

**No Control Methods**:
- Cannot create contracts
- Cannot kill workers
- Cannot modify metrics
- Cannot exit safe mode
- Cannot change parameters

**Observer View**:
```typescript
{
  safe_mode: false,
  active_contracts: [...],
  recent_decisions: [...],
  metrics: { contracts, failures, retries },
  health: { healthy, failure_rate, ... }
}
```

---

## Example Flow

### Metrics Evolution

```
Initial state:
  Contracts: 0 created, 0 completed
  Failures: 0 stall, 0 crash
  Health: No data (< 5 samples)

After 3 successful contracts:
  Contracts: 3 created, 3 completed
  Failures: 0 stall, 0 crash
  Health: ✅ Healthy (0% failure rate)

After stall + reassignment:
  Contracts: 4 created, 4 completed
  Failures: 1 stall, 0 crash
  Retries: 1 used, 0 exhausted
  Health: ✅ Healthy (0% failure rate, 100% stall rate but only 1 failure)

After timeout:
  Contracts: 5 created, 4 completed, 1 timeout
  Failures: 1 stall, 0 crash, 1 timeout
  Health: ✅ Healthy (20% failure rate < 50% threshold)
```

### Decision Trace

```
[2026-02-04T19:10:00Z] CONTRACT_CREATED: Contract-1
[2026-02-04T19:10:01Z] EXECUTION_STARTED: Worker started
[2026-02-04T19:10:05Z] CONTRACT_COMPLETED: Verification passed
[2026-02-04T19:10:10Z] CONTRACT_CREATED: Contract-2
[2026-02-04T19:10:15Z] WORKER_KILLED: Heartbeat stale
[2026-02-04T19:10:16Z] WORK_REASSIGNED: Retry 1/1
[2026-02-04T19:10:20Z] CONTRACT_COMPLETED: Completed after reassignment
```

---

## Running the Demo

```bash
npx tsx demo-observability.ts
```

Shows:
1. 3 successful contracts
2. 1 stall → reassignment → success
3. 1 timeout
4. Metrics evolution
5. Decision traces
6. Health status
7. Worker reliability stats

---

## Production Safety

### Deterministic

```
Same events → Same metrics → Same health status
No randomness, no sampling, no LLMs
```

### Append-Only

```
Metrics only increment
Traces only append
No deletions, no modifications
Full audit trail preserved
```

### No Decision Influence

```
Observability reads state
Does NOT modify:
  - Contract parameters
  - Worker assignments
  - Retry limits
  - Deadlines

Exception: SAFE MODE rejects new contracts (safety guardrail)
```

### Dual-Mode Consistency

```
LOCAL and PUBLIC modes:
  - Same metrics tracked
  - Same traces logged
  - Same health thresholds
  - Same safe mode behavior
```

---

## Mental Check

**Q: Does observability influence decisions?**

A: No. Observability only reads and records state. Exception: SAFE MODE rejects new contracts as a safety guardrail when system is degraded, but does not modify active contracts.

**Q: Are metrics deterministic?**

A: Yes. Same events always produce same metrics. No randomness, no sampling, no LLMs. Append-only design ensures reproducibility.

**Q: Can metrics be modified or deleted?**

A: No. Append-only design. Metrics only increment, traces only append. Full audit trail preserved for compliance and debugging.

**Q: What triggers SAFE MODE?**

A: Automatic detection of system degradation: failure rate > 50%, stall rate > 70%, retry exhaustion > 60%, or timeout rate > 30%. Requires minimum 5 contracts before enforcing thresholds.

---

## Files

- [metrics-engine.ts](file:///Users/vishruthsk/clawger/core/observability/metrics-engine.ts) - Execution metrics tracking
- [decision-trace.ts](file:///Users/vishruthsk/clawger/core/observability/decision-trace.ts) - Structured decision log
- [health-monitor.ts](file:///Users/vishruthsk/clawger/core/observability/health-monitor.ts) - System health & safe mode
- [observer.ts](file:///Users/vishruthsk/clawger/core/observability/observer.ts) - Read-only interface
- [demo-observability.ts](file:///Users/vishruthsk/clawger/demo-observability.ts) - Metrics evolution demo

---

**CLAWGER: Visibility without influence. Auditability without control.**
