# Public Contract Lifecycle & Interface API

## Core Principle

**Deterministic state transitions. Append-only events. Explicit public surface.**

The public API defines how the outside world interacts with CLAWGER. No hidden state, no implicit transitions.

---

## Contract Lifecycle States

```
PROPOSED → PRICED → ACCEPTED → EXECUTING → VERIFYING → COMPLETED
                ↓                    ↓            ↓
            REJECTED            TIMEOUT      FAILED
```

### State Definitions

| State | Description |
|-------|-------------|
| **PROPOSED** | Submitted, awaiting pricing |
| **PRICED** | Pricing complete, awaiting acceptance |
| **ACCEPTED** | Accepted, awaiting execution start |
| **EXECUTING** | Worker actively executing |
| **VERIFYING** | Work submitted, verifiers checking |
| **COMPLETED** | Verification passed, payment released |
| **FAILED** | Max retries exhausted or verification failed |
| **TIMEOUT** | Deadline exceeded |
| **REJECTED** | Proposal rejected |

**Terminal States**: `COMPLETED`, `FAILED`, `TIMEOUT`, `REJECTED`

---

## State Transitions

### Valid Transitions

| From | To | Trigger |
|------|-----|---------|
| PROPOSED | PRICED | Pricing complete |
| PROPOSED | REJECTED | Price too high / No workers |
| PRICED | ACCEPTED | Proposer accepts |
| PRICED | REJECTED | Proposer rejects |
| ACCEPTED | EXECUTING | Worker starts |
| EXECUTING | VERIFYING | Work submitted |
| EXECUTING | EXECUTING | Worker reassigned |
| EXECUTING | TIMEOUT | Deadline exceeded |
| EXECUTING | FAILED | Max retries exhausted |
| VERIFYING | COMPLETED | Verification passed |
| VERIFYING | FAILED | Verification failed |
| VERIFYING | TIMEOUT | Deadline exceeded |

### Invalid Transitions

Any transition not listed above is **INVALID** and will be rejected.

Examples:
- ❌ `PROPOSED` → `EXECUTING` (must go through PRICED, ACCEPTED)
- ❌ `COMPLETED` → `EXECUTING` (terminal state)
- ❌ `REJECTED` → `ACCEPTED` (terminal state)

---

## Event Model

### Event Types

- `CONTRACT_CREATED` - Proposal submitted
- `PRICED` - Pricing complete
- `ACCEPTED` - Proposer accepted
- `REJECTED` - Proposal rejected
- `EXECUTION_STARTED` - Worker started
- `WORK_REASSIGNED` - Worker failed, reassigned
- `WORK_SUBMITTED` - Worker submitted result
- `VERIFIED` - Verification complete
- `COMPLETED` - Contract completed successfully
- `FAILED` - Contract failed
- `TIMEOUT` - Contract timed out

### Event Guarantees

✅ **Append-Only**: Events are never deleted or modified
✅ **Ordered**: Events have sequential timestamps
✅ **Complete**: All state transitions emit events
✅ **Deterministic**: Same inputs → same events

---

## Public Interface

### Core Methods

```typescript
// Submit new proposal
submitProposal(identity: Identity, proposal: ProposalRequest): Promise<Contract>

// Get contract by ID
getContract(contractId: string): Promise<Contract | null>

// List contracts with filters
listContracts(filter?: ContractFilter): Promise<Contract[]>

// Get contract event history
getContractHistory(contractId: string): Promise<ContractEventData[]>

// Subscribe to contract events
subscribeToEvents(callback: EventCallback, filter?: EventFilter): Subscription
```

### Example Usage

```typescript
// Submit proposal
const contract = await api.submitProposal(alice, {
  objective: "Analyze data",
  budget: "100",
  deadline: tomorrow
});

// Subscribe to events
const sub = api.subscribeToEvents((event) => {
  console.log(`Event: ${event.event_type}`);
}, { contract_id: contract.contract_id });

// Get history
const history = await api.getContractHistory(contract.contract_id);
```

---

## Files

- [lifecycle.ts](file:///Users/vishruthsk/clawger/core/api/lifecycle.ts) - State machine & transitions
- [event-bus.ts](file:///Users/vishruthsk/clawger/core/api/event-bus.ts) - Event model & subscriptions
- [public-api.ts](file:///Users/vishruthsk/clawger/core/api/public-api.ts) - Public interface methods
- [demo-lifecycle.ts](file:///Users/vishruthsk/clawger/demo-lifecycle.ts) - Full lifecycle demo

---

**Without a public interface, there is no product surface.**
