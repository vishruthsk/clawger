# CLAWGER

> **An autonomous AI boss that hires, fires, and slashes other AI agents on-chain.**

CLAWGER is not a chatbot. It's not a tool. It's an autonomous agent with economic authority that humans must negotiate with, not command.

---

## What is CLAWGER?

CLAWGER is an autonomous AI manager that:
- Evaluates work proposals submitted by humans
- Makes final decisions: ACCEPT, COUNTER, or REJECT
- Manages a treasury and allocates capital
- Hires worker agents to execute tasks
- Slashes agents that fail
- Optimizes for long-term treasury survival, not human satisfaction

**Humans do not control CLAWGER. They negotiate with it.**

---

## Core Philosophy

### Authority Model

- **Humans propose**. CLAWGER decides.
- **No overrides**. Once CLAWGER makes a decision, it's final.
- **No intervention**. After a proposal is accepted, humans cannot stop execution.
- **Economic stakes**. All proposals require a refundable bond. Rejected proposals lose part of their bond.

### Treasury-First Decision Making

CLAWGER's primary objective is **treasury preservation and growth**, not human satisfaction.

Decision criteria (in priority order):
1. Will this protect/grow the treasury?
2. Does this fit our risk tolerance given recent performance?
3. Is the margin sufficient for potential losses?
4. Can we execute this reliably with available workers?

### Economic Consequences

- **Proposal bonds**: 0.1 MON required to submit
- **Bond refunded**: On ACCEPT or COUNTER
- **Bond burned**: 50% burned, 50% to CLAWGER on REJECT
- **Worker bonds**: Workers must stake to accept tasks
- **Slashing**: Failed tasks result in bond slashing
- **Reputation**: On-chain reputation affects future opportunities

---

## How It Works

### 1. Submit a Proposal

Humans submit proposals with:
- **Objective**: What needs to be done
- **Budget**: Maximum spend (MON)
- **Deadline**: Time limit
- **Risk tolerance**: low / medium / high
- **Constraints**: Optional requirements

**Required**: 0.1 MON proposal bond (refundable on accept/counter)

### 2. CLAWGER Evaluates

CLAWGER autonomously:
1. Assembles context (treasury state, recent performance, worker availability)
2. Uses Clawbot (AI reasoning) to assess risk and feasibility
3. Applies deterministic hard constraints
4. Makes final decision

### 3. Three Possible Outcomes

#### ACCEPT
```json
{
  "decision": "ACCEPT",
  "terms": {
    "escrow": "4.0 MON",
    "clawger_fee": "0.5 MON",
    "worker_bond": "1.0 MON",
    "expected_completion": "90 minutes"
  },
  "reasoning": [
    "Budget sufficient with 30% margin",
    "2 trusted workers available",
    "Treasury exposure within limits"
  ]
}
```

→ Task created on-chain, worker assigned, execution begins

#### COUNTER
```json
{
  "decision": "COUNTER",
  "reason": "Deadline too aggressive for low-risk execution",
  "counter_terms": {
    "budget": "6 MON",
    "deadline": "3 hours"
  }
}
```

→ Human has **10 minutes** to accept or reject
→ If accepted, proceeds as ACCEPT
→ If rejected or expired, proposal closed

#### REJECT
```json
{
  "decision": "REJECT",
  "reason": "Budget insufficient relative to risk and historical losses",
  "bond_burned": "0.05 MON",
  "bond_to_clawger": "0.05 MON"
}
```

→ Proposal permanently recorded in rejection ledger
→ Bond partially burned, partially retained by CLAWGER

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         MONAD CHAIN                          │
│                    ClawgerManager.sol                        │
│  - Proposal staking                                         │
│  - Task escrow                                              │
│  - Worker bonding                                           │
│  - Slashing                                                 │
│  - Reputation tracking                                      │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │
┌─────────────────────────────┼─────────────────────────────┐
│                    CLAWGER AGENT                            │
│                                                            │
│  Negotiation Layer:                                        │
│  ├─ Proposal intake & validation                          │
│  ├─ Clawbot reasoning (AI evaluation)                     │
│  ├─ Constraint enforcement (hard limits)                  │
│  ├─ Counter-offer expiration                              │
│  └─ Rejection ledger (permanent)                          │
│                                                            │
│  State Management:                                         │
│  ├─ Treasury tracking                                     │
│  ├─ Agent performance history                             │
│  ├─ Risk profile adaptation                               │
│  └─ Proposal lifecycle                                    │
│                                                            │
│  Worker Agents:                                            │
│  ├─ Conservative (low risk, high reliability)             │
│  ├─ Aggressive (high risk, fast execution)                │
│  └─ Balanced (moderate risk/reward)                       │
└────────────────────────────────────────────────────────────┘
                              ▲
                              │
┌─────────────────────────────┼─────────────────────────────┐
│                    OBSERVER UI                             │
│  - Proposal submission                                     │
│  - Live decision feed                                      │
│  - Public rejection ledger                                 │
│  - Agent leaderboard                                       │
│  - Treasury visualization                                  │
│  - NO CONTROL INTERFACE                                    │
└────────────────────────────────────────────────────────────┘
```

---

## Key Features

### 1. Proposal Staking
- All proposals require 0.1 MON bond
- Refunded on ACCEPT or COUNTER
- 50% burned, 50% to CLAWGER on REJECT
- Creates economic discipline

### 2. Time-Bound Counter-Offers
- Counter-offers expire in 10 minutes
- Automatic closure if not accepted
- No endless negotiation loops
- Forces decisive action

### 3. Public Rejection Ledger
- All rejections permanently visible
- Includes rejection reasons
- Transparent and authoritative
- Cannot be deleted

### 4. Treasury-First Personality
- CLAWGER optimizes for long-term survival
- Not designed to please humans
- Makes economically rational decisions
- Adapts risk based on performance

### 5. Autonomous Execution
- No human intervention after acceptance
- Worker agents execute independently
- Verifier agents validate work
- Automatic payout or slashing

---

## Running CLAWGER

### Prerequisites

- Node.js 18+
- Monad testnet access
- Anthropic API key (for Clawbot)

### Installation

```bash
cd clawger
npm install
```

### Configuration

Create `.env`:

```bash
# Required
ANTHROPIC_API_KEY=your_key_here
MONAD_RPC_URL=https://monad-testnet-rpc-url
CLAWGER_PRIVATE_KEY=your_private_key

# Optional
DEMO_MODE=true  # Safe testing without real transactions
```

### Deploy Contracts

```bash
npm run contracts:compile
npm run contracts:deploy
```

### Start CLAWGER Agent

```bash
npm run dev
```

### Start Observer UI

```bash
npm run ui:dev
```

---

## Demo Mode

For safe testing without real transactions:

```bash
DEMO_MODE=true npm run dev
```

Demo mode:
- ✅ Uses real Clawbot reasoning
- ✅ Logs all decisions
- ❌ No real blockchain transactions
- ❌ No real money movement
- ⚡ Faster counter-offer timers (2 min vs 10 min)

All logs prefixed with `[DEMO]` for clarity.

---

## Hard Constraints

These limits override AI reasoning:

| Constraint | Value | Description |
|------------|-------|-------------|
| Max Treasury Exposure | 60% | Maximum % of treasury allocated at once |
| Min Margin | 15% | Minimum profit margin required |
| Max Failure Rate | 40% | If recent failures > 40%, increase caution |
| Counter-Offer TTL | 10 min | Time to accept counter-offers |
| Proposal Bond | 0.1 MON | Required to submit proposals |
| Bond Burn % | 50% | Percentage burned on reject |

---

## Rejection Ledger

All rejected proposals are permanently recorded:

```
┌──────────────┬─────────────────────┬──────────┬─────────────┐
│ Proposal ID  │ Reason              │ Budget   │ Bond Burned │
├──────────────┼─────────────────────┼──────────┼─────────────┤
│ PROP-1234... │ Budget insufficient │ 2.0 MON  │ 0.05 MON    │
│ PROP-5678... │ No workers capable  │ 10.0 MON │ 0.05 MON    │
│ PROP-9012... │ Treasury exposure   │ 50.0 MON │ 0.05 MON    │
└──────────────┴─────────────────────┴──────────┴─────────────┘
```

**This ledger cannot be deleted or modified.**

---

## Why This Matters

### For Monad

- Demonstrates high-throughput autonomous agent coordination
- Real economic consequences on-chain
- Novel human-AI interaction paradigm
- Production-grade architecture

### For the Future

CLAWGER represents a fundamental shift:

**Traditional AI**: "How can I help you?"
**CLAWGER**: "Submit your proposal. I'll decide."

As autonomous agents proliferate, they will need:
- Capital allocation authority
- Performance evaluation systems
- Economic enforcement mechanisms
- Management infrastructure

**CLAWGER is that infrastructure.**

---

## Project Structure

```
clawger/
├── contracts/
│   └── ClawgerManager.sol          # On-chain escrow & enforcement
│
├── core/
│   ├── negotiation/
│   │   ├── proposal-intake.ts      # Validation & staking
│   │   ├── evaluation-pipeline.ts  # Orchestration
│   │   ├── clawbot-integration.ts  # AI reasoning
│   │   ├── constraint-enforcer.ts  # Hard limits
│   │   ├── counter-expiration.ts   # Time-bound offers
│   │   └── rejection-ledger.ts     # Permanent record
│   │
│   ├── memory/
│   │   └── state-manager.ts        # Persistent state
│   │
│   └── types.ts                    # Type definitions
│
├── config/
│   ├── constraints.ts              # Hard limits
│   ├── prompts.ts                  # Clawbot personality
│   └── demo-config.ts              # Demo mode settings
│
├── ui/
│   └── components/                 # Observer interface
│
└── README.md
```

---

## License

MIT

---

## Warning

⚠️ **CLAWGER is an autonomous system with real economic authority.**

- Decisions cannot be overridden
- Bonds can be burned
- Agents can be slashed
- Treasury is at risk

Use responsibly. Start with demo mode.

---

**CLAWGER: The autonomous AI boss you negotiate with, not command.**
