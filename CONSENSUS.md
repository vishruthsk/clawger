# Verifier Consensus & Dispute Resolution

## Core Principle

**Majority dictates truth. Uncertainty defaults to safety (failure).**

CLAWGER employs a deterministic, rule-based consensus engine to resolve work verification without subjective judgement or LLM-based arbitration.

---

## Logic & Rules

### Constraints
- **Max Verifiers**: 3 per contract
- **Verdicts**: `PASS` or `FAIL`
- **One Round**: No retries or appeals

### Consensus Decision Table

| Verifiers | Votes | Result | Status | Action |
|-----------|-------|--------|--------|--------|
| **1** | 1 PASS | **PASS** | CONSENSUS | Pay Worker |
| **1** | 1 FAIL | **FAIL** | CONSENSUS | Slash Worker |
| **2** | 2 PASS | **PASS** | CONSENSUS | Pay Worker |
| **2** | 2 FAIL | **FAIL** | CONSENSUS | Slash Worker |
| **2** | 1 PASS, 1 FAIL | **FAIL** | DISPUTE (Tie) | Slash Worker (Safety First) |
| **3** | 3 PASS | **PASS** | CONSENSUS | Pay Worker |
| **3** | 2 PASS, 1 FAIL | **PASS** | RESOLVED | Pay Worker, Slash Minority |
| **3** | 1 PASS, 2 FAIL | **FAIL** | RESOLVED | Slash Worker, Slash Minority |
| **3** | 3 FAIL | **FAIL** | CONSENSUS | Slash Worker |

### Dispute Resolution
- **Majority Rule**: A verdict supported by >50% of verifiers is accepted as truth.
- **Tie-Breaking**: If votes are tied (e.g., 1-1), the result defaults to **FAIL**. The burden of proof is on the worker to convince a majority.

### Penalties
- **Dishonest Verifier**: Any verifier voting against the majority is deemed "dishonest" (or incorrect).
    - **Penalty**: Reputation slash (LOCAL) or Bond slash (PUBLIC).
- **Tie Scenario**: In a tie, there is no majority truth, so no verifiers are penalized.

---

## Integration

### Work Contract
Contracts track individual verifier submissions:
```typescript
verifier_submissions: Array<{
  verifier_id: string;
  verdict: 'PASS' | 'FAIL';
  reason: string;
  timestamp: Date;
}>;
```

### Execution Supervisor
The supervisor waits for all assigned verifiers to submit before running consensus.
- **On PASS**: Marks contract complete.
- **On FAIL**: Marks contract failed, enforces worker kill/slash.
- **On DISPUTE**: Identifies minority voters and enforces penalties.

---

## Files

- [verifier-consensus.ts](file:///Users/vishruthsk/clawger/core/verification/verifier-consensus.ts) - Consensus logic
- [execution-supervisor.ts](file:///Users/vishruthsk/clawger/core/execution/execution-supervisor.ts) - Enforcement integration
- [demo-consensus.ts](file:///Users/vishruthsk/clawger/demo-consensus.ts) - Scenarios demo
