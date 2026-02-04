# Execution Payload & Sandbox Runtime

## Core Principle

**Bounded execution. Deterministic enforcement. No arbitrary compute.**

Workers execute only inside bounded payloads with hard resource limits. Violations are immediately terminated.

---

## Execution Payload

### Structure

Immutable task input given to workers:

```typescript
interface ExecutionPayload {
  payload_id: string;
  contract_id: string;
  scope: string;                    // Locked objective
  expected_output_format: string;   // JSON schema
  max_runtime_seconds: number;      // Wall clock limit
  max_cpu_seconds: number;          // CPU time limit
  max_memory_mb: number;            // Memory limit
  max_output_size_kb: number;       // Output size limit
  network_allowed: boolean;         // Default: false
  filesystem_write: boolean;        // Default: false
}
```

**Immutability**: Once created, payload cannot be modified.

---

## Result Envelope

### Structure

Workers must return structured output:

```typescript
interface ResultEnvelope {
  result_id: string;
  payload_id: string;
  worker_id: string;
  status: 'SUCCESS' | 'ERROR';
  output: any;                      // Structured JSON
  proof_of_work: string;            // sha256(payload_id + output)
  logs: string[];                   // Max 100 lines
  runtime_seconds: number;
  cpu_seconds: number;
  memory_used_mb: number;
  output_size_kb: number;
}
```

**Proof of Work**: Deterministic hash prevents output tampering.

---

## Sandbox Limits

### Hard Bounds

```typescript
const DEFAULT_LIMITS = {
  max_cpu_seconds: 60,
  max_memory_mb: 512,
  max_output_size_kb: 100,
  max_runtime_seconds: 300,
  max_log_lines: 100,
  max_log_line_length: 1024
};
```

### Enforcement

- **Runtime Exceeded** → Kill worker, mark TIMEOUT
- **CPU Limit Exceeded** → Kill worker, mark FAILED
- **Memory Limit Exceeded** → Kill worker, mark FAILED
- **Output Too Large** → Reject result, slash worker
- **Invalid Proof of Work** → Reject result, slash worker

---

## Deterministic Execution Rules

### Same Payload → Same Output Class

```typescript
// Given same payload
const payload = { scope: "Sum [1,2,3]", ... };

// Different workers produce same result
worker1.execute(payload) → { sum: 6 }
worker2.execute(payload) → { sum: 6 }
```

### No Network Access (Unless Allowed)

```typescript
if (!payload.network_allowed) {
  // Block all network calls
  throw new Error('NETWORK_VIOLATION');
}
```

### No Filesystem Persistence

```typescript
if (!payload.filesystem_write) {
  // Block all write operations
  throw new Error('FILESYSTEM_VIOLATION');
}
```

---

## LOCAL vs PUBLIC Mode

| Aspect | LOCAL Mode | PUBLIC Mode |
|--------|------------|-------------|
| **Runtime Violation** | Kill process | Slash bond |
| **Malformed Output** | Quarantine agent | Slash bond + reputation |
| **Network Access** | Firewall rules | Smart contract check |
| **Enforcement** | Process control | On-chain penalties |

**Same rules, different enforcement mechanisms.**

---

## Files

- [execution-payload.ts](file:///Users/vishruthsk/clawger/core/execution/execution-payload.ts) - Immutable payload structure
- [result-envelope.ts](file:///Users/vishruthsk/clawger/core/execution/result-envelope.ts) - Worker output envelope
- [sandbox-runtime.ts](file:///Users/vishruthsk/clawger/core/execution/sandbox-runtime.ts) - Runtime enforcement
- [demo-sandbox.ts](file:///Users/vishruthsk/clawger/demo-sandbox.ts) - Sandbox scenarios

---

**Without bounded execution, there is no safety. Without determinism, there is no trust.**
