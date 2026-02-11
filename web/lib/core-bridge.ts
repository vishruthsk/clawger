import { publicAPI, PublicAPI } from '../../core/api/public-api';
import { getDataPath } from './data-path';
import { AgentRegistry } from '../../core/registry/agent-registry';
import { AgentAuth } from '../../core/registry/agent-auth';
import { AssignmentEngine } from '../../core/registry/assignment-engine';
import { HealthMonitor } from '../../core/observability/health-monitor';
import { MetricsEngine } from '../../core/observability/metrics-engine';
import { DecisionTraceLog } from '../../core/observability/decision-trace';
import { Observer } from '../../core/observability/observer';
import { WorkContract } from '../../core/execution/work-contract';
import { SandboxRuntime } from '../../core/execution/sandbox-runtime';

// Global singleton type
interface CoreSystem {
    publicAPI: PublicAPI;
    agentRegistry: AgentRegistry;
    observer: Observer;
    sandbox: SandboxRuntime;
    metrics: MetricsEngine;
    healthMonitor: HealthMonitor;
    agentAuth: AgentAuth;
    assignmentEngine: AssignmentEngine;
}

// Add to global scope to prevent re-initialization in dev mode HMR
const globalForCore = global as unknown as { coreSystem: CoreSystem };

function initializeCoreSystem(): CoreSystem {
    // if (globalForCore.coreSystem) {
    //     return globalForCore.coreSystem;
    // }

    console.log('[CORE] Initializing CLAWGER Core System...');

    // 1. Core Services
    const metricsEngine = new MetricsEngine();
    const decisionTrace = new DecisionTraceLog();
    const healthMonitor = new HealthMonitor(metricsEngine, decisionTrace);

    // Phase 20: Agent Auth
    // Point to project root data directory (assuming running from web/)
    const agentAuth = new AgentAuth(getDataPath());

    // 2. Data Stores
    const workContracts = new Map<string, WorkContract>();

    // 3. Observer
    const observer = new Observer(
        workContracts,
        metricsEngine,
        decisionTrace,
        healthMonitor
    );

    // 4. Agent Registry (Mocked)
    const agentRegistry = new AgentRegistry(undefined, undefined, true);

    // 5. Sandbox (Local Mode)
    const sandbox = new SandboxRuntime('LOCAL');

    // 6. Public API (Pre-instantiated from module, or we create here if needed)
    // In this codebase, PublicAPI seems to be a singleton exported from a module, 
    // but here we are treating it as something we need to reference.
    // The import 'publicAPI' is likely an instance.
    // Let's use the imported instance for now.

    // Phase 20: Assignment Engine
    // It depends on PublicAPI.
    const assignmentEngine = new AssignmentEngine(agentRegistry, publicAPI);

    const system: CoreSystem = {
        publicAPI,
        agentRegistry,
        observer,
        sandbox,
        metrics: metricsEngine,
        healthMonitor,
        agentAuth,
        assignmentEngine
    };

    if (process.env.NODE_ENV !== 'production') {
        globalForCore.coreSystem = system;
    }

    return system;
}

export const core = initializeCoreSystem();

// Helper to convert internal types to API responses
export function serializeContract(contract: any) {
    // Deep clone and handle Dates
    return JSON.parse(JSON.stringify(contract));
}
