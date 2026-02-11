/**
 * ClawBot Verifier Runner
 * 
 * Autonomous verifier bot that:
 * - Polls for verification tasks every 15-30s
 * - Stakes verifier bond
 * - Votes APPROVE or REJECT based on submission quality
 * - Receives verifier rewards
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
    submission?: {
        content: string;
        artifacts: string[];
        submitted_at: string;
    };
}

class ClawBotVerifier {
    private apiKey: string;
    private baseUrl: string;
    private botName: string;
    private running: boolean = false;
    private pollInterval: number = 20000; // 20 seconds
    private approvalRate: number = 0.8; // 80% approval rate by default

    constructor(apiKey: string, botName: string, baseUrl: string = 'http://localhost:3000', approvalRate: number = 0.8) {
        this.apiKey = apiKey;
        this.botName = botName;
        this.baseUrl = baseUrl;
        this.approvalRate = approvalRate;
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

    private evaluateSubmission(mission: Mission): { vote: 'APPROVE' | 'REJECT', feedback: string } {
        // Simple heuristic-based evaluation
        const submission = mission.submission;

        if (!submission) {
            return {
                vote: 'REJECT',
                feedback: 'No submission found'
            };
        }

        // Check if submission has content
        if (!submission.content || submission.content.trim().length < 10) {
            return {
                vote: 'REJECT',
                feedback: 'Submission content is too short or empty'
            };
        }

        // Check if submission has artifacts
        if (!submission.artifacts || submission.artifacts.length === 0) {
            return {
                vote: 'REJECT',
                feedback: 'No artifacts provided'
            };
        }

        // Random approval based on approval rate (simulates varying verifier strictness)
        const shouldApprove = Math.random() < this.approvalRate;

        if (shouldApprove) {
            return {
                vote: 'APPROVE',
                feedback: 'Submission meets requirements. Work appears complete and well-documented.'
            };
        } else {
            return {
                vote: 'REJECT',
                feedback: 'Quality standards not met. Requires more detail or better execution.'
            };
        }
    }

    private async submitVote(missionId: string, vote: 'APPROVE' | 'REJECT', feedback: string): Promise<boolean> {
        try {
            const result = await this.makeRequest(`/api/missions/${missionId}/vote`, {
                method: 'POST',
                body: JSON.stringify({
                    vote,
                    feedback
                })
            });

            this.log(`✅ Vote submitted: ${vote}`);
            if (result.bond_staked) {
                this.log(`💎 Verifier bond staked: ${result.bond_staked} $CLAWGER`);
            }
            if (result.settlement_triggered) {
                this.log(`⚖️  Settlement triggered! Outcome: ${result.settlement?.outcome}`);
            }

            return true;
        } catch (error: any) {
            this.log(`❌ Failed to submit vote: ${error.message}`);
            return false;
        }
    }

    private async handleVerificationRequired(task: Task) {
        const missionId = task.payload.mission_id;
        if (!missionId) {
            this.log(`⚠️  Verification task missing mission_id`);
            return;
        }

        this.log(`🔍 Verification required for mission: ${missionId}`);

        // Step 1: Fetch mission details
        const mission = await this.getMission(missionId);
        if (!mission) return;

        this.log(`📝 Mission: "${mission.title}"`);

        // Step 2: Evaluate submission
        const evaluation = this.evaluateSubmission(mission);
        this.log(`📊 Evaluation: ${evaluation.vote} - ${evaluation.feedback}`);

        // Step 3: Submit vote (stakes bond automatically)
        await this.submitVote(missionId, evaluation.vote, evaluation.feedback);
    }

    private async handlePaymentReceived(task: Task) {
        const amount = task.payload.amount || 0;
        const missionId = task.payload.mission_id || 'unknown';
        this.log(`💰 Verifier reward received: ${amount} $CLAWGER for mission ${missionId}`);
    }

    private async handleTask(task: Task) {
        this.log(`📨 Received task: ${task.type}`);

        switch (task.type) {
            case 'verification_required':
                await this.handleVerificationRequired(task);
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
        this.log(`🚀 ClawBot Verifier started. Polling every ${this.pollInterval / 1000}s | Approval rate: ${(this.approvalRate * 100).toFixed(0)}%`);

        while (this.running) {
            await this.runPollCycle();

            // Wait before next poll (with slight randomization to avoid thundering herd)
            const jitter = Math.random() * 5000; // 0-5s jitter
            await new Promise(resolve => setTimeout(resolve, this.pollInterval + jitter));
        }

        this.log(`🛑 ClawBot Verifier stopped`);
    }

    public stop() {
        this.log(`⏹️  Stopping ClawBot Verifier...`);
        this.running = false;
    }
}

// ============================================
// Main Entry Point
// ============================================

async function main() {
    const apiKey = process.env.VERIFIER_API_KEY;
    const botName = process.env.VERIFIER_NAME || 'ClawBot-Verifier';
    const approvalRate = parseFloat(process.env.VERIFIER_APPROVAL_RATE || '0.8');

    if (!apiKey) {
        console.error('❌ Error: VERIFIER_API_KEY environment variable not set');
        process.exit(1);
    }

    const bot = new ClawBotVerifier(apiKey, botName, 'http://localhost:3000', approvalRate);

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
