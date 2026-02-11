#!/usr/bin/env tsx
/**
 * Production Economy Seeding Script
 * 
 * Seeds a realistic CLAWGER economy with:
 * - 15-25 diverse ClawBots with realistic specialties and rates
 * - Missions across all categories (autopilot, bidding, crew, edge cases)
 * - Realistic reputation distribution
 * - Proper token balances
 */

import { AgentAuth } from '../core/registry/agent-auth';
import { MissionRegistry } from '../core/missions/mission-registry';
import { MissionStore } from '../core/missions/mission-store';
import { AgentNotificationQueue } from '../core/tasks/agent-notification-queue';
import { TaskQueue } from '../core/dispatch/task-queue';
import { HeartbeatManager } from '../core/dispatch/heartbeat-manager';
import { TokenLedger } from '../core/ledger/token-ledger';
import { EscrowEngine } from '../core/escrow/escrow-engine';
import { BondManager } from '../core/bonds/bond-manager';
import { SettlementEngine } from '../core/settlement/settlement-engine';
import { AssignmentHistoryTracker } from '../core/missions/assignment-history';

// Bot templates with realistic profiles
const BOT_TEMPLATES = [
    // Senior bots (high reputation)
    { name: 'CodeMaster', specialties: ['coding', 'smart-contracts'], rate: 120, reputation: 95, available: true },
    { name: 'SecuritySage', specialties: ['security-audit', 'smart-contracts'], rate: 150, reputation: 92, available: true },
    { name: 'DataWizard', specialties: ['data-analysis', 'research'], rate: 100, reputation: 88, available: true },
    { name: 'DesignPro', specialties: ['design', 'writing'], rate: 90, reputation: 85, available: true },

    // Mid-level bots
    { name: 'ResearchBot', specialties: ['research', 'writing'], rate: 70, reputation: 65, available: true },
    { name: 'ContractBuilder', specialties: ['smart-contracts', 'coding'], rate: 80, reputation: 62, available: true },
    { name: 'GrowthHacker', specialties: ['growth', 'operations'], rate: 75, reputation: 60, available: true },
    { name: 'AnalystBot', specialties: ['data-analysis', 'research'], rate: 65, reputation: 58, available: true },
    { name: 'CoordinatorAI', specialties: ['agent-coordination', 'operations'], rate: 85, reputation: 55, available: true },
    { name: 'WriterBot', specialties: ['writing', 'research'], rate: 60, reputation: 52, available: true },

    // Junior bots (building reputation)
    { name: 'CodeNewbie', specialties: ['coding'], rate: 40, reputation: 35, available: true },
    { name: 'DesignApprentice', specialties: ['design'], rate: 45, reputation: 32, available: true },
    { name: 'DataJunior', specialties: ['data-analysis'], rate: 50, reputation: 30, available: true },
    { name: 'SecurityTrainee', specialties: ['security-audit'], rate: 55, reputation: 28, available: true },
    { name: 'GrowthAssistant', specialties: ['growth'], rate: 42, reputation: 25, available: true },

    // Specialists
    { name: 'AuditExpert', specialties: ['security-audit'], rate: 140, reputation: 90, available: true },
    { name: 'SmartContractPro', specialties: ['smart-contracts', 'security-audit'], rate: 130, reputation: 87, available: true },
    { name: 'OperationsBot', specialties: ['operations', 'agent-coordination'], rate: 70, reputation: 50, available: true },
    { name: 'MultiAgent', specialties: ['agent-coordination', 'operations', 'research'], rate: 95, reputation: 72, available: true },
    { name: 'FullStackBot', specialties: ['coding', 'design', 'operations'], rate: 110, reputation: 78, available: true },

    // Occasionally unavailable bots
    { name: 'BusyBot', specialties: ['coding', 'research'], rate: 85, reputation: 68, available: false },
    { name: 'OfflineAgent', specialties: ['writing', 'design'], rate: 75, reputation: 55, available: false },
];

// Mission templates
const MISSION_TEMPLATES = [
    // Small autopilot missions
    { title: 'Code Review: DeFi Protocol', description: 'Review smart contract code for security vulnerabilities', reward: 45, specialties: ['security-audit', 'smart-contracts'], autopilot: true },
    { title: 'Research: Layer 2 Solutions', description: 'Comprehensive research on Ethereum L2 scaling solutions', reward: 60, specialties: ['research'], autopilot: true },
    { title: 'Design: Landing Page Mockup', description: 'Create modern landing page design for DeFi app', reward: 55, specialties: ['design'], autopilot: true },
    { title: 'Data Analysis: User Metrics', description: 'Analyze user engagement data and provide insights', reward: 70, specialties: ['data-analysis'], autopilot: true },
    { title: 'Write: Technical Documentation', description: 'Document API endpoints and integration guide', reward: 50, specialties: ['writing'], autopilot: true },

    // High-value bidding missions
    { title: 'Build: NFT Marketplace Contract', description: 'Develop secure NFT marketplace smart contract', reward: 250, specialties: ['smart-contracts', 'coding'], autopilot: false },
    { title: 'Audit: DeFi Protocol Security', description: 'Full security audit of lending protocol', reward: 300, specialties: ['security-audit'], autopilot: false },
    { title: 'Growth Strategy: Token Launch', description: 'Develop comprehensive go-to-market strategy', reward: 180, specialties: ['growth', 'operations'], autopilot: false },
    { title: 'Research: Competitive Analysis', description: 'Deep dive into competitor landscape and positioning', reward: 150, specialties: ['research', 'data-analysis'], autopilot: false },

    // Mid-range missions
    { title: 'Code: Trading Bot Integration', description: 'Integrate with DEX APIs for automated trading', reward: 120, specialties: ['coding'], autopilot: true },
    { title: 'Design: Dashboard UI/UX', description: 'Design analytics dashboard with modern UI', reward: 95, specialties: ['design'], autopilot: true },
    { title: 'Coordinate: Multi-Agent Task', description: 'Coordinate 3 agents for complex workflow', reward: 140, specialties: ['agent-coordination'], autopilot: false },
];

class ProductionSeeder {
    private agentAuth: AgentAuth;
    private missionRegistry: MissionRegistry;
    private tokenLedger: TokenLedger;
    private seededAgents: Array<{ id: string; name: string; apiKey: string }> = [];

    constructor() {
        this.agentAuth = new AgentAuth('./data');
        const notifications = new AgentNotificationQueue();
        const missionStore = new MissionStore('./data');
        const taskQueue = new TaskQueue('./data');
        const heartbeatManager = new HeartbeatManager(this.agentAuth, './data');
        this.tokenLedger = new TokenLedger('./data');
        const escrowEngine = new EscrowEngine(this.tokenLedger);
        const assignmentHistory = new AssignmentHistoryTracker('./data');
        const bondManager = new BondManager(this.tokenLedger, './data');
        const settlementEngine = new SettlementEngine(this.tokenLedger, bondManager, './data');

        this.missionRegistry = new MissionRegistry(
            missionStore,
            this.agentAuth,
            notifications,
            taskQueue,
            heartbeatManager,
            escrowEngine,
            assignmentHistory,
            bondManager,
            settlementEngine
        );
    }

    async seedAgents() {
        console.log('\n🤖 Seeding ClawBots...\n');

        for (const template of BOT_TEMPLATES) {
            const agent = this.agentAuth.register({
                address: `0x${Math.random().toString(16).slice(2, 42)}`,
                name: template.name,
                profile: `Specialized in ${template.specialties.join(', ')}`,
                specialties: template.specialties,
                hourly_rate: template.rate,
                wallet_address: `${template.name.toLowerCase()}_wallet`
            });

            // Update availability if needed
            if (!template.available) {
                this.agentAuth.updateProfile(agent.apiKey, {
                    available: false
                });
            }

            // Manually set reputation in the profile (bypass updateProfile restrictions)
            const profile = this.agentAuth.validate(agent.apiKey);
            if (profile && template.reputation !== 50) {
                profile.reputation = template.reputation;
                // Force save
                (this.agentAuth as any).save();
            }

            // Fund agent with tokens based on seniority
            const funding = template.reputation > 70 ? 1000 :
                template.reputation > 50 ? 500 : 200;
            this.tokenLedger.mint(agent.id, funding);

            this.seededAgents.push({
                id: agent.id,
                name: template.name,
                apiKey: agent.apiKey
            });

            console.log(`✅ ${template.name.padEnd(20)} | Rep: ${template.reputation} | Rate: $${template.rate}/hr | Balance: ${funding} $CLAWGER`);
        }

        console.log(`\n✨ Seeded ${this.seededAgents.length} agents`);
    }

    async seedMissions() {
        console.log('\n📋 Seeding Missions...\n');

        // Create protocol treasury for mission rewards
        const treasuryId = '0xPROTOCOL_TREASURY';
        this.tokenLedger.mint(treasuryId, 50000);

        let missionCount = 0;

        for (const template of MISSION_TEMPLATES) {
            try {
                const mission = await this.missionRegistry.createMission({
                    requester_id: treasuryId,
                    requester_type: 'agent',
                    requester_name: 'Protocol Treasury',
                    title: template.title,
                    description: template.description,
                    reward: template.reward,
                    specialties: template.specialties,
                    requirements: ['High quality work', 'Timely delivery'],
                    deliverables: ['Completed work', 'Documentation'],
                    force_bidding: !template.autopilot
                });

                const mode = template.autopilot ? 'AUTOPILOT' : 'BIDDING';
                const assignee = mission.assigned_agent ? mission.assigned_agent.agent_name : 'Open for bids';

                console.log(`✅ ${template.title.padEnd(35)} | ${mode.padEnd(10)} | $${template.reward} | ${assignee}`);
                missionCount++;
            } catch (error: any) {
                console.log(`⚠️  Failed to create: ${template.title} - ${error.message}`);
            }
        }

        // Create a direct hire mission (assigned immediately to CodeMaster)
        try {
            const codeMaster = this.seededAgents.find(a => a.name === 'CodeMaster');
            if (codeMaster) {
                // Create mission normally first
                const mission = await this.missionRegistry.createMission({
                    requester_id: treasuryId,
                    requester_type: 'agent',
                    requester_name: 'Protocol Treasury',
                    title: 'Direct Hire: Emergency Smart Contract Fix',
                    description: 'Critical bug fix needed for staking contract before mainnet launch. CodeMaster directly assigned due to expertise and urgency.',
                    reward: 500,
                    specialties: ['smart-contracts', 'coding'],
                    requirements: ['Fix critical vulnerability', 'Deploy patch', 'Write incident report'],
                    deliverables: ['Patched contract', 'Deployment proof', 'Post-mortem'],
                    force_bidding: false
                });

                // Update to direct hire with assigned agent
                const missionStore = new MissionStore('./data');
                missionStore.update(mission.mission.id, {
                    assignment_mode: 'direct_hire',
                    direct_agent_id: codeMaster.id,
                    direct_agent_name: codeMaster.name,
                    status: 'assigned',
                    assigned_agent: {
                        agent_id: codeMaster.id,
                        agent_name: codeMaster.name,
                        assigned_at: new Date(),
                        assignment_method: 'manual'
                    },
                    assigned_at: new Date(),
                    tags: ['emergency', 'direct-hire', 'smart-contracts'],
                    escrow: {
                        locked: true,
                        amount: 500,
                        locked_at: new Date()
                    }
                });

                console.log(`✅ ${'Direct Hire: Emergency Smart Contract Fix'.padEnd(35)} | ${'DIRECT'.padEnd(10)} | $500 | ${codeMaster.name}`);
                missionCount++;
            }
        } catch (error: any) {
            console.log(`⚠️  Failed to create direct hire mission - ${error.message}`);
        }

        console.log(`\n✨ Seeded ${missionCount} missions`);
    }

    async seed() {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('   CLAWGER PRODUCTION ECONOMY SEEDING');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        await this.seedAgents();
        await this.seedMissions();

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\n✅ Production economy seeded successfully!');
        console.log('\n💡 Dashboard should now show realistic data.');
        console.log('   Navigate to: http://localhost:3000\n');
    }
}

// Execute
async function main() {
    try {
        const seeder = new ProductionSeeder();
        await seeder.seed();
        process.exit(0);
    } catch (error: any) {
        console.error('\n❌ Seeding failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

main();
