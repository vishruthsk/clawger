/**
 * ClawBot Worker Runner
 * 
 * Autonomous worker bot that:
 * - Polls for tasks every 15-30s
 * - Accepts mission assignments
 * - Stakes worker bond
 * - Executes work
 * - Submits results
 * - Receives settlement payouts
 */

import fetch from 'node-fetch';

interface Task {
    id: string;
    agent_id: string;
    type: string;
    priority: string;
    payload: {
        mission_id?: string;
        action: string;
        deadline?: string;
        reward?: number;
        amount?: number;
        reason?: string;
    };
    created_at: string;
}

interface Mission {
    id: string;
    title: string;
    description: string;
    status: string;
    reward: number;
    requester_id: string;
    assigned_agent?: {
        agent_id: string;
        assigned_at: string;
    };
}

class ClawBotWorker {
    private apiKey: string;
    private baseUrl: string;
    private botName: string;
    private running: boolean = false;
    private pollInterval: number = 20000; // 20 seconds

    constructor(apiKey: string, botName: string, baseUrl: string = 'http://localhost:3000') {
        this.apiKey = apiKey;
        this.botName = botName;
        this.baseUrl = baseUrl;
    }

    private log(message: string) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${this.botName}] ${message}`);
    }

    private async makeRequest(endpoint: string, options: any = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            ...options.headers
        };

        const response = await fetch(url, {
            ...options,
            headers
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(`API Error: ${error.error || response.statusText}`);
        }

        return response.json();
    }

    private async pollTasks(): Promise<Task[]> {
        try {
            const result = await this.makeRequest('/api/agents/me/tasks?limit=10');
            return result.tasks || [];
        } catch (error: any) {
            this.log(`❌ Failed to poll tasks: ${error.message}`);
            return [];
        }
    }

    private async getMission(missionId: string): Promise<Mission | null> {
        try {
            const result = await this.makeRequest(`/api/missions/${missionId}`);
            return result.mission || result;
        } catch (error: any) {
            this.log(`❌ Failed to fetch mission ${missionId}: ${error.message}`);
            return null;
        }
    }

    private async startMission(missionId: string): Promise<boolean> {
        try {
            const result = await this.makeRequest(`/api/missions/${missionId}/start`, {
                method: 'POST'
            });
            this.log(`✅ Mission started. Bond staked: ${result.bond_staked} $CLAWGER`);
            return true;
        } catch (error: any) {
            this.log(`❌ Failed to start mission: ${error.message}`);
            return false;
        }
    }

    private async executeWork(mission: Mission): Promise<string> {
        this.log(`🔧 Executing work for mission: ${mission.title}`);

        // Simulate work execution (2-5 seconds)
        const workDuration = 2000 + Math.random() * 3000;
        await new Promise(resolve => setTimeout(resolve, workDuration));

        // Generate work artifact
        const artifact = `Completed: ${mission.description}\nExecution time: ${(workDuration / 1000).toFixed(2)}s\nTimestamp: ${new Date().toISOString()}`;

        this.log(`✅ Work completed in ${(workDuration / 1000).toFixed(2)}s`);
        return artifact;
    }

    private async submitWork(missionId: string, content: string): Promise<boolean> {
        try {
            const result = await this.makeRequest(`/api/missions/${missionId}/submit`, {
                method: 'POST',
                body: JSON.stringify({
                    content,
                    artifacts: [`https://proof.clawger.com/${missionId}`]
                })
            });
            this.log(`✅ Work submitted successfully. Status: ${result.status}`);
            return true;
        } catch (error: any) {
            this.log(`❌ Failed to submit work: ${error.message}`);
            return false;
        }
    }

    private async handleMissionAssigned(task: Task) {
        const missionId = task.payload.mission_id;
        if (!missionId) {
            this.log(`⚠️  Mission assigned task missing mission_id`);
            return;
        }

        this.log(`📋 New mission assigned: ${missionId}`);

        // Step 1: Fetch mission details
        const mission = await this.getMission(missionId);
        if (!mission) return;

        this.log(`📝 Mission: "${mission.title}" | Reward: ${mission.reward} $CLAWGER`);

        // Step 2: Start mission (stakes bond automatically)
        const started = await this.startMission(missionId);
        if (!started) return;

        // Step 3: Execute work
        const workResult = await this.executeWork(mission);

        // Step 4: Submit work
        await this.submitWork(missionId, workResult);
    }

    private async handlePaymentReceived(task: Task) {
        const amount = task.payload.amount || 0;
        const missionId = task.payload.mission_id || 'unknown';
        this.log(`💰 Payment received: ${amount} $CLAWGER for mission ${missionId}`);
    }

    private async handleTask(task: Task) {
        this.log(`📨 Received task: ${task.type}`);

        switch (task.type) {
            case 'mission_assigned':
                await this.handleMissionAssigned(task);
                break;
            case 'payment_received':
                await this.handlePaymentReceived(task);
                break;
            default:
                this.log(`⚠️  Unknown task type: ${task.type}`);
        }
    }

    private async runPollCycle() {
        const tasks = await this.pollTasks();

        if (tasks.length > 0) {
            this.log(`📬 Retrieved ${tasks.length} task(s)`);
            for (const task of tasks) {
                await this.handleTask(task);
            }
        }
    }

    public async start() {
        this.running = true;
        this.log(`🚀 ClawBot Worker started. Polling every ${this.pollInterval / 1000}s`);

        while (this.running) {
            await this.runPollCycle();

            // Wait before next poll (with slight randomization to avoid thundering herd)
            const jitter = Math.random() * 5000; // 0-5s jitter
            await new Promise(resolve => setTimeout(resolve, this.pollInterval + jitter));
        }

        this.log(`🛑 ClawBot Worker stopped`);
    }

    public stop() {
        this.log(`⏹️  Stopping ClawBot Worker...`);
        this.running = false;
    }
}

// ============================================
// Main Entry Point
// ============================================

async function main() {
    const apiKey = process.env.CLAWBOT_API_KEY;
    const botName = process.env.CLAWBOT_NAME || 'ClawBot-Worker';

    if (!apiKey) {
        console.error('❌ Error: CLAWBOT_API_KEY environment variable not set');
        process.exit(1);
    }

    const bot = new ClawBotWorker(apiKey, botName);

    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Received SIGINT. Shutting down gracefully...');
        bot.stop();
        setTimeout(() => process.exit(0), 1000);
    });

    process.on('SIGTERM', () => {
        console.log('\n🛑 Received SIGTERM. Shutting down gracefully...');
        bot.stop();
        setTimeout(() => process.exit(0), 1000);
    });

    await bot.start();
}

main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
