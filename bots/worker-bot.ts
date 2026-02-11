/**
 * Autonomous Worker Bot
 * Polls for tasks and executes missions via HTTP API
 */

const API_BASE = 'http://localhost:3000';
const POLL_INTERVAL = 2000; // 2 seconds
const HEARTBEAT_INTERVAL = 10000; // 10 seconds

interface WorkerConfig {
    apiKey: string;
    agentId: string;
    name: string;
}

class WorkerBot {
    private config: WorkerConfig;
    private running = false;
    private heartbeatInterval?: NodeJS.Timeout;

    constructor(config: WorkerConfig) {
        this.config = config;
    }

    private async fetch(endpoint: string, options: RequestInit = {}) {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers: {
                'Authorization': `Bearer ${this.config.apiKey}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        return response.json();
    }

    private async sendHeartbeat() {
        try {
            await this.fetch(`/api/agents/${this.config.agentId}/heartbeat`, {
                method: 'POST'
            });
        } catch (error: any) {
            console.error(`[${this.config.name}] Heartbeat error:`, error.message);
        }
    }

    private async pollTasks() {
        try {
            const data = await this.fetch('/api/agents/me/tasks');
            console.log(`[${this.config.name}] Poll result:`, JSON.stringify(data, null, 2));
            if (data.tasks && data.tasks.length > 0) {
                console.log(`[${this.config.name}] Found ${data.tasks.length} tasks`);
                for (const task of data.tasks) {
                    await this.handleTask(task);
                }
            } else {
                console.log(`[${this.config.name}] No tasks found`);
            }
        } catch (error: any) {
            console.error(`[${this.config.name}] Poll error:`, error.message);
        }
    }

    private async handleTask(task: any) {
        console.log(`[${this.config.name}] Evaluating task:`, task.type, task.payload?.mission_id);

        // ============================================
        // STEP 1: Task Validity Check
        // ============================================
        // Check if task is expired
        if (task.expires_at && new Date(task.expires_at) < new Date()) {
            console.log(`[${this.config.name}] ⏰ Task expired, skipping:`, task.id);
            return;
        }

        // Check if task is already acknowledged (stale from previous run)
        if (task.acknowledged) {
            console.log(`[${this.config.name}] 🔄 Task already acknowledged, checking mission state...`);
        }

        // ============================================
        // STEP 2: Mission-State Gating
        // ============================================
        // Fetch current mission state to validate task is still relevant
        const missionId = task.payload?.mission_id;
        if (!missionId) {
            console.log(`[${this.config.name}] ❌ Task missing mission_id, skipping`);
            return;
        }

        let missionState;
        try {
            const response = await fetch(`http://localhost:3000/api/missions/${missionId}`);
            const data = await response.json();
            missionState = data.mission;
        } catch (error: any) {
            console.error(`[${this.config.name}] ❌ Failed to fetch mission state:`, error.message);
            return;
        }

        if (!missionState) {
            console.log(`[${this.config.name}] ❌ Mission ${missionId} not found, skipping stale task`);
            return;
        }

        // ============================================
        // STEP 3: Task-Type Specific State Validation
        // ============================================
        if (task.type === 'mission_assigned') {
            // Only execute if mission is still in 'assigned' state
            if (missionState.status !== 'assigned') {
                console.log(`[${this.config.name}] ⚠️  Mission ${missionId} is ${missionState.status}, not 'assigned'. Skipping stale task.`);
                return;
            }

            // Validate we're the assigned agent
            if (missionState.assigned_agent?.agent_id !== this.config.agentId) {
                console.log(`[${this.config.name}] ❌ Mission assigned to different agent, skipping`);
                return;
            }

            console.log(`[${this.config.name}] ✅ Mission ${missionId} validated: status='assigned', assigned to us`);
            await this.startMission(missionId);

        } else if (task.type === 'crew_task_assigned') {
            // Crew subtask assigned to us
            const subtaskId = task.payload?.subtask_id;
            if (!subtaskId) {
                console.log(`[${this.config.name}] ❌ Crew task missing subtask_id, skipping`);
                return;
            }

            console.log(`[${this.config.name}] ✅ Crew subtask ${subtaskId} assigned, starting work...`);
            await this.executeSubtask(missionId, subtaskId);

        } else if (task.type === 'revision_required') {
            // Only execute if mission is in 'executing' or 'verifying' state
            if (missionState.status !== 'executing' && missionState.status !== 'verifying') {
                console.log(`[${this.config.name}] ⚠️  Mission ${missionId} is ${missionState.status}, not awaiting revision. Skipping.`);
                return;
            }

            console.log(`[${this.config.name}] ✅ Revision task validated for mission ${missionId}`);
            await this.reviseMission(missionId, task.payload.feedback);

        } else {
            console.log(`[${this.config.name}] ⚠️  Unknown task type: ${task.type}`);
        }
    }

    private async startMission(missionId: string) {
        console.log(`[${this.config.name}] 🚀 Starting mission ${missionId}`);

        // Start mission
        const startResult = await this.fetch(`/api/missions/${missionId}/start`, {
            method: 'POST'
        });

        if (!startResult.success) {
            console.error(`[${this.config.name}] ❌ Start failed:`, startResult.error);
            return;
        }

        console.log(`[${this.config.name}] ✅ Mission started, working...`);

        // Simulate work (3 seconds)
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Submit work
        const submitResult = await this.fetch(`/api/missions/${missionId}/submit`, {
            method: 'POST',
            body: JSON.stringify({
                content: `Mission completed by ${this.config.name}. All requirements met.`,
                artifacts: []
            })
        });

        if (submitResult.success) {
            console.log(`[${this.config.name}] ✅ Work submitted successfully`);
        } else {
            console.error(`[${this.config.name}] ❌ Submit failed:`, submitResult.error);
        }
    }

    private async reviseMission(missionId: string, feedback: string) {
        console.log(`[${this.config.name}] 🔄 Revising mission ${missionId}`);
        console.log(`[${this.config.name}] Feedback: ${feedback}`);

        // Simulate revision work (2 seconds)
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Submit revision
        const reviseResult = await this.fetch(`/api/missions/${missionId}/revise`, {
            method: 'POST',
            body: JSON.stringify({
                revised_content: `Revised work addressing feedback: "${feedback}". Added detailed documentation and examples.`,
                revised_artifacts: [],
                agent_id: this.config.agentId
            })
        });

        if (reviseResult.success) {
            console.log(`[${this.config.name}] ✅ Revision submitted successfully`);
        } else {
            console.error(`[${this.config.name}] ❌ Revision failed:`, reviseResult.error);
        }
    }

    private async executeSubtask(missionId: string, subtaskId: string) {
        console.log(`[${this.config.name}] 🚀 Executing crew subtask ${subtaskId} for mission ${missionId}`);

        // Simulate work (3 seconds)
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Submit subtask work
        const submitResult = await this.fetch(`/api/missions/${missionId}/subtasks/${subtaskId}/submit`, {
            method: 'POST',
            body: JSON.stringify({
                content: `Subtask completed by ${this.config.name}. All requirements met.`,
                artifacts: []
            })
        });

        if (submitResult.success) {
            console.log(`[${this.config.name}] ✅ Subtask work submitted successfully`);
        } else {
            console.error(`[${this.config.name}] ❌ Subtask submit failed:`, submitResult.error);
        }
    }

    start() {
        console.log(`[${this.config.name}] 🤖 Worker bot started, polling every ${POLL_INTERVAL}ms`);
        this.running = true;

        // Start heartbeat interval
        this.heartbeatInterval = setInterval(() => {
            this.sendHeartbeat();
        }, HEARTBEAT_INTERVAL);

        // Send initial heartbeat
        this.sendHeartbeat();

        const poll = async () => {
            if (!this.running) return;
            await this.pollTasks();
            setTimeout(poll, POLL_INTERVAL);
        };

        poll();
    }

    stop() {
        console.log(`[${this.config.name}] 🛑 Worker bot stopped`);
        this.running = false;
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
    }
}

// CLI usage
if (require.main === module) {
    const apiKey = process.argv[2];
    const agentId = process.argv[3];
    const name = process.argv[4] || 'WorkerBot';

    if (!apiKey || !agentId) {
        console.error('Usage: npx tsx bots/worker-bot.ts <apiKey> <agentId> [name]');
        process.exit(1);
    }

    const bot = new WorkerBot({ apiKey, agentId, name });
    bot.start();

    // Graceful shutdown
    process.on('SIGINT', () => {
        bot.stop();
        process.exit(0);
    });
}

export default WorkerBot;
