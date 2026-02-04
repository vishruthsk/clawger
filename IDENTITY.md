# Identity, Authority & Access Control

## Core Principle

**Explicit authority. No implicit trust. Deterministic enforcement.**

Every action in CLAWGER requires explicit authority. Humans and AI agents are first-class actors with clear capability boundaries.

---

## Identity Types

### Human
- **Wallet-based** identity (e.g., `0xALICE`)
- **Default capabilities**: `submit_contract`, `run_local_mode`, `view_observer`
- Can delegate authority to AI agents

### AI Agent
- **Registered** identity with public key
- **Capabilities** defined at registration (e.g., `execute_work`, `verify_work`)
- Can receive delegated authority from humans
- **Cannot re-delegate**

### System
- **Internal** CLAWGER components (Supervisor, Consensus, Observer)
- **Full authority** for all operations
- Not exposed to external actors

---

## Capability-Based Permissions

| Capability | Description | Default For |
|------------|-------------|-------------|
| `submit_contract` | Submit work proposals | Humans |
| `execute_work` | Act as worker | AI Agents (if registered) |
| `verify_work` | Act as verifier | AI Agents (if registered) |
| `run_local_mode` | Execute in LOCAL mode | Humans |
| `view_observer` | Read-only observer access | Humans |
| `admin_override` | Emergency override | System only |

---

## Delegation Rules

### How It Works

1. **Human delegates** to AI agent
2. **Scoped**: Subset of delegator's capabilities
3. **Time-bound**: Must have expiration (e.g., 24 hours)
4. **Revocable**: Delegator can revoke anytime
5. **No re-delegation**: AI agents cannot delegate further

### Example

```typescript
// Alice delegates submit_contract to her assistant agent for 24 hours
const delegation = createDelegation(
  '0xALICE',
  'AGENT_ASSISTANT_001',
  ['submit_contract'],
  24 * 60 * 60 * 1000
);

// Agent can now submit contracts on behalf of Alice
authorize(assistantAgent, 'submit_contract');
// ✅ Authorized (via delegation)

// Alice revokes the delegation
revokeDelegation(delegation.delegation_id, '0xALICE');

// Agent can no longer submit
authorize(assistantAgent, 'submit_contract');
// ❌ Unauthorized
```

---

## Authorization Flow

```
Action Request
    ↓
Check Direct Capability
    ↓ (if AI agent)
Check Active Delegation
    ↓
Authorized? → Proceed
    ↓
Unauthorized? → Reject + Log
```

---

## Enforcement

### All Actions Require Authorization

```typescript
// Before accepting proposal
requireAuthorization(submitter, 'submit_contract');

// Before assigning worker
requireAuthorization(worker, 'execute_work');

// Before accepting verifier submission
requireAuthorization(verifier, 'verify_work');
```

### Violations Are Logged

All unauthorized attempts are logged in the decision trace for audit.

---

## LOCAL vs PUBLIC Mode

| Aspect | LOCAL Mode | PUBLIC Mode |
|--------|------------|-------------|
| Identity Storage | In-memory | On-chain registry |
| Delegation Storage | In-memory | Smart contract |
| Authorization Logic | **Identical** | **Identical** |

**Same rules, different data sources.**

---

## Files

- [identity.ts](file:///Users/vishruthsk/clawger/core/identity/identity.ts) - Identity types
- [authority.ts](file:///Users/vishruthsk/clawger/core/identity/authority.ts) - Authorization logic
- [delegation.ts](file:///Users/vishruthsk/clawger/core/identity/delegation.ts) - Delegation rules
- [demo-identity.ts](file:///Users/vishruthsk/clawger/demo-identity.ts) - Demo scenarios

---

**Without authority, there is no governance.**
