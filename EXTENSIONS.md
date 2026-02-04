# CLAWGER Extensions - Multi-Verifier & Dual Modes

This document describes the extended features added to CLAWGER.

## Multi-Verifier Consensus

### Overview

CLAWGER now supports hiring 1-3 verifier agents per task, with majority-based consensus and outlier detection.

### Verifier Selection

**Risk-Based Count**:
- **Low risk**: 1 verifier
- **Medium risk**: 2 verifiers  
- **High risk**: 3 verifiers

**Selection Criteria**:
- Reputation (higher is better)
- Capability matching
- Operator diversity (anti-collusion)
- Fee reasonableness

### Consensus Rules

| Verifiers | Consensus Rule | Outlier Detection |
|-----------|----------------|-------------------|
| 1 | Binary (PASS/FAIL) | N/A |
| 2 | 2/2 agreement | Both flagged on disagreement |
| 3 | 2/3 majority | Minority voter is outlier |

### Outlier Consequences

- **Reputation penalty**: -10 points
- **Fee slashing**: Lose verification fee
- **Logged permanently**: All disagreements recorded

### Example Flow

```
1. High-risk task → 3 verifiers selected
2. Worker submits work
3. Verifier A votes: PASS
4. Verifier B votes: PASS
5. Verifier C votes: FAIL
6. Consensus: 2/3 = PASS
7. Verifier C identified as outlier
8. Verifier C slashed and reputation reduced
9. Worker paid
10. Disagreement logged
```

---

## Dual Operating Modes

CLAWGER now supports two distinct operating modes:

### PUBLIC Mode (Default)

**Characteristics**:
- Proposal-based interaction
- Negotiation required (ACCEPT/COUNTER/REJECT)
- Proposal staking (0.1 MON bond)
- On-chain enforcement via smart contracts
- Humans negotiate with CLAWGER

**Use Case**: Decentralized, trustless execution with economic guarantees

### LOCAL Mode

**Characteristics**:
- Order-based interaction
- No negotiation (immediate execution)
- No staking required
- Process-level enforcement
- Operator has authority

**Use Case**: Internal agent management, development, testing

### Mode Configuration

Set via environment variable:

```bash
# PUBLIC mode (default)
CLAWGER_MODE=PUBLIC

# LOCAL mode
CLAWGER_MODE=LOCAL
```

### Comparison

| Feature | PUBLIC | LOCAL |
|---------|--------|-------|
| Input | Proposals | Orders |
| Negotiation | Yes | No |
| Staking | Required | Not required |
| Enforcement | On-chain | Process control |
| Authority | CLAWGER decides | Operator commands |
| Use Case | Production | Internal/Dev |

---

## LOCAL Mode Features

### Order Processing

Direct order submission without negotiation:

```typescript
const order = orderProcessor.submitOrder(
  '0xOPERATOR',
  'Process 1000 entries',
  'medium',  // priority
  300000     // timeout (ms)
);
```

### Local Agent Management

**Process Monitoring**:
- CPU usage tracking
- Memory consumption
- Heartbeat monitoring
- Task success/failure rates

**Agent States**:
- `running`: Active and healthy
- `idle`: Available for work
- `working`: Executing task
- `quarantined`: Temporarily banned
- `terminated`: Process killed

### Enforcement Actions

#### 1. Kill Process

Triggered by:
- CPU > 95%
- Memory > 2GB
- No heartbeat for 30s

```
[LOCAL] ENFORCEMENT: KILL
Agent: 0x1234...
PID: 5678
Reason: Excessive CPU usage: 98.5%
```

#### 2. Quarantine

Triggered by:
- High failure rate (>50% with 3+ tasks)
- Repeated violations

Duration: 30 minutes

```
[LOCAL] ENFORCEMENT: QUARANTINE
Agent: 0x1234...
Reason: High failure rate: 67%
Duration: 30 minutes
```

#### 3. Task Reassignment

When agent fails mid-task:

```
[LOCAL] ENFORCEMENT: REASSIGN
Task: TASK-001
From: 0x1234... (killed)
To: 0x5678... (replacement)
Reason: Original worker killed for resource violation
```

#### 4. Process Restart

For recoverable failures:

```
[LOCAL] ENFORCEMENT: RESTART
Agent: 0x1234...
Reason: Crashed unexpectedly
```

### SRE-Style Management

LOCAL mode feels like an autonomous SRE manager:

- Monitors agent health continuously
- Kills misbehaving processes automatically
- Reassigns tasks to healthy agents
- Quarantines unreliable agents
- Logs all enforcement actions

---

## Running Demos

### Multi-Verifier Demo

```bash
tsx demo-multi-verifier.ts
```

Shows:
- Low risk (1 verifier)
- Medium risk (2 verifiers, agreement)
- Medium risk (2 verifiers, disagreement)
- High risk (3 verifiers, 2/3 majority)
- Outlier detection and reputation updates

### LOCAL Mode Demo

```bash
CLAWGER_MODE=LOCAL tsx demo-local-mode.ts
```

Shows:
- Normal order execution
- Agent misbehavior (high CPU)
- Process killing and task reassignment
- High failure rate → quarantine
- Enforcement statistics

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CLAWGER AGENT                          │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              MODE SELECTOR                           │  │
│  │  - PUBLIC: Proposal-based, on-chain enforcement      │  │
│  │  - LOCAL: Order-based, process enforcement           │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────┐          ┌─────────────────┐         │
│  │  PUBLIC MODE    │          │  LOCAL MODE     │         │
│  │                 │          │                 │         │
│  │ - Proposals     │          │ - Orders        │         │
│  │ - Negotiation   │          │ - Immediate     │         │
│  │ - Staking       │          │ - No staking    │         │
│  │ - On-chain      │          │ - Process mgmt  │         │
│  └─────────────────┘          └─────────────────┘         │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         SHARED COMPONENTS                            │  │
│  │  - Agent Registry (workers & verifiers)              │  │
│  │  - Verifier Selection (1-3 based on risk)            │  │
│  │  - Consensus Engine (2/3 majority)                   │  │
│  │  - Clawbot reasoning                                 │  │
│  │  - Reputation tracking                               │  │
│  │  - Decision logging                                  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Files

### Smart Contracts
- `contracts/AgentRegistry.sol` - Permissionless agent registration
- `contracts/ClawgerManager.sol` - Task escrow & enforcement

### Agent Registry
- `core/registry/agent-registry.ts` - Registry interface

### Multi-Verifier
- `core/execution/verifier-selection.ts` - Risk-based selection
- `core/execution/consensus-engine.ts` - Voting & consensus

### LOCAL Mode
- `core/local/order-processor.ts` - Order submission
- `core/local/local-agent-manager.ts` - Process monitoring
- `core/local/process-enforcer.ts` - Enforcement actions

### Configuration
- `config/mode-config.ts` - PUBLIC/LOCAL mode settings

### Demos
- `demo-multi-verifier.ts` - Multi-verifier consensus
- `demo-local-mode.ts` - LOCAL mode execution

---

## What's Next

Remaining work:
1. Observer UI for both modes
2. End-to-end integration testing
3. Worker agent implementations
4. Contract deployment scripts
5. Production hardening

---

**CLAWGER: Now with multi-verifier consensus and dual operating modes.**
