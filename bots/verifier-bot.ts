/**
 * Autonomous Verifier Bot
 * Polls for verification tasks and votes via HTTP API
 */

const API_BASE = 'http://localhost:3000';
const POLL_INTERVAL = 2000; // 2 seconds

interface VerifierConfig {
    apiKey: string;
    agentId: string;
    name: string;
    autoApprove?: boolean; // For testing, auto-approve all submissions
}

class VerifierBot {
    private config: VerifierConfig;
    private running = false;
    private votedMissions = new Set<string>();

    constructor(config: VerifierConfig) {
        this.config = { autoApprove: true, ...config };
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

    private async pollTasks() {
        try {
            const data = await this.fetch('/api/agents/me/tasks');
            if (data.tasks && data.tasks.length > 0) {
                for (const task of data.tasks) {
                    await this.handleTask(task);
                }
            }
        } catch (error: any) {
            console.error(`[${this.config.name}] Poll error:`, error.message);
        }
    }

    private async handleTask(task: any) {
        // ============================================
        // STEP 1: Task Validity Check
        // ============================================
        if (task.type !== 'verification_required') {
            return; // Only handle verification tasks
        }

        const missionId = task.payload.mission_id;
        if (!missionId) {
            console.log(`[${this.config.name}] ❌ Task missing mission_id`);
            return;
        }

        // Skip if already voted on this mission
        if (this.votedMissions.has(missionId)) {
            console.log(`[${this.config.name}] 🔄 Already voted on mission ${missionId}, skipping`);
            return;
        }

        // Check expiration
        if (task.expires_at && new Date(task.expires_at) < new Date()) {
            console.log(`[${this.config.name}] ⏰ Task expired, skipping`);
            return;
        }

        // ============================================
        // STEP 2: Mission-State Gating
        // ============================================
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
            console.log(`[${this.config.name}] ❌ Mission ${missionId} not found`);
            return;
        }

        // Only verify missions in 'verifying' state
        if (missionState.status !== 'verifying') {
            console.log(`[${this.config.name}] ⚠️  Mission ${missionId} is ${missionState.status}, not 'verifying'. Skipping.`);
            return;
        }

        console.log(`[${this.config.name}] ✅ Mission ${missionId} validated: status='verifying'`);
        console.log(`[${this.config.name}] 🔍 Verification task for mission ${missionId}`);
        await this.verifyMission(missionId, task.payload);
    }

    private async verifyMission(missionId: string, payload: any) {
        console.log(`[${this.config.name}] Reviewing submission...`);
        console.log(`   Content: ${payload.submission_content?.substring(0, 50)}...`);

        // Simulate review (1 second)
        await new Promise(resolve => setTimeout(resolve, 1000));

        const decision = this.config.autoApprove ? 'APPROVE' : 'REJECT';
        const notes = this.config.autoApprove
            ? 'Work meets requirements. Approved.'
            : 'Needs improvement.';

        console.log(`[${this.config.name}] 🗳️  Voting ${decision}`);

        const voteResult = await this.fetch(`/api/missions/${missionId}/vote`, {
            method: 'POST',
            body: JSON.stringify({
                decision,
                notes
            })
        });

        if (voteResult.success) {
            console.log(`[${this.config.name}] ✅ Vote submitted successfully`);
            this.votedMissions.add(missionId);
        } else {
            console.error(`[${this.config.name}] ❌ Vote failed:`, voteResult.error);
        }
    }

    start() {
        console.log(`[${this.config.name}] 🤖 Verifier bot started, polling every ${POLL_INTERVAL}ms`);
        this.running = true;

        const poll = async () => {
            if (!this.running) return;
            await this.pollTasks();
            setTimeout(poll, POLL_INTERVAL);
        };

        poll();
    }

    stop() {
        console.log(`[${this.config.name}] 🛑 Verifier bot stopped`);
        this.running = false;
    }
}

// CLI usage
if (require.main === module) {
    const apiKey = process.argv[2];
    const agentId = process.argv[3];
    const name = process.argv[4] || 'VerifierBot';

    if (!apiKey || !agentId) {
        console.error('Usage: npx tsx bots/verifier-bot.ts <apiKey> <agentId> [name]');
        process.exit(1);
    }

    const bot = new VerifierBot({ apiKey, agentId, name });
    bot.start();

    // Graceful shutdown
    process.on('SIGINT', () => {
        bot.stop();
        process.exit(0);
    });
}

export default VerifierBot;
