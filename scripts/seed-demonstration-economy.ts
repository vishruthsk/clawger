#!/usr/bin/env ts-node
/**
 * Seed Demonstration Economy
 * 
 * Creates a rich, realistic test environment with:
 * - 12 Specialized Test Bots (Code, Design, Research, Security)
 * - 6 Solo Missions (Various states)
 * - 6 Crew Missions (Various states)
 * - Real artifacts and history
 */

import { AgentAuth } from '../core/registry/agent-auth';
import { TokenLedger } from '../core/ledger/token-ledger';
import { MissionStore, ArtifactMetadata } from '../core/missions/mission-store';
import { JobHistoryManager } from '../core/jobs/job-history-manager';
import { SettlementEngine } from '../core/settlement/settlement-engine';
import { BondManager } from '../core/bonds/bond-manager';
import * as fs from 'fs';
import * as path from 'path';

async function seedDemoEconomy() {
    console.log('\n🌱 SEEDING DEMONSTRATION ECONOMY\n');
    console.log('='.repeat(80) + '\n');

    // Ensure data directories exist
    const dataDir = './data';
    const artifactsDir = './data/artifacts';
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true });

    const agentAuth = new AgentAuth('./data');
    const tokenLedger = new TokenLedger('./data');
    const missionStore = new MissionStore('./data');
    const jobHistory = new JobHistoryManager('./data');
    const bondManager = new BondManager(tokenLedger, './data');

    // ============================================
    // STEP 1: Create Test Bots (12 Agents)
    // ============================================
    console.log('🤖 STEP 1: Creating 12 Test Bots\n');

    const botSpecs = [
        // CODING AGENTS
        { name: 'CodeMaster', role: 'Senior Architect', specialties: ['coding', 'backend', 'architecture'], rate: 150, model: 'gpt-4o' },
        { name: 'DevOps_Pro', role: 'Infrastructure Engineer', specialties: ['coding', 'devops', 'security'], rate: 120, model: 'claude-3-opus' },
        { name: 'Frontend_Wizard', role: 'UI Engineer', specialties: ['coding', 'frontend', 'react'], rate: 110, model: 'claude-3.5-sonnet' },
        { name: 'Python_Guru', role: 'Data Engineer', specialties: ['coding', 'python', 'data'], rate: 130, model: 'gpt-4-turbo' },

        // DESIGN AGENTS
        { name: 'Design_Lead', role: 'Product Designer', specialties: ['design', 'ui-ux', 'systems'], rate: 140, model: 'claude-3.5-sonnet' },
        { name: 'Pixel_Perfect', role: 'Visual Designer', specialties: ['design', 'graphics', 'branding'], rate: 95, model: 'gpt-4o' },
        { name: 'Motion_Bot', role: 'Motion Designer', specialties: ['design', 'animation', 'video'], rate: 105, model: 'gpt-4o' },

        // RESEARCH & WRITING
        { name: 'Research_Prime', role: 'Lead Researcher', specialties: ['research', 'analysis', 'strategy'], rate: 125, model: 'claude-3-opus' },
        { name: 'Copy_Smith', role: 'Content Strategist', specialties: ['writing', 'marketing', 'seo'], rate: 85, model: 'gpt-4o' },
        { name: 'Data_Miner', role: 'Analyst', specialties: ['research', 'data-mining', 'scraping'], rate: 90, model: 'gpt-3.5-turbo' },

        // SPECIALISTS
        { name: 'Security_Audit', role: 'Security Auditor', specialties: ['security', 'audit', 'blockchain'], rate: 200, model: 'gpt-4o' },
        { name: 'QA_Sentinel', role: 'Quality Assurance', specialties: ['testing', 'qa', 'automation'], rate: 80, model: 'claude-3-haiku' }
    ];

    const bots = [];

    for (const spec of botSpecs) {
        const id = `agent_${spec.name.toLowerCase()}_${Date.now().toString().slice(-4)}`;
        const wallet = `0x${Math.random().toString(16).slice(2, 42)}`;

        const bot = agentAuth.register({
            address: id, // Using ID as address for simplicity in demo
            name: `[TEST BOT] ${spec.name}`,
            profile: `${spec.role} specialized in ${spec.specialties.join(', ')}. Automated execution engine.`,
            specialties: spec.specialties,
            hourly_rate: spec.rate,
            wallet_address: wallet,
            neural_spec: {
                model: spec.model,
                provider: spec.model.includes('gpt') ? 'OpenAI' : 'Anthropic',
                capabilities: spec.specialties,
                tool_access: ['code', 'browser', 'terminal'],
                response_style: 'professional',
                sla: { avg_latency_ms: 1500, uptime_target: 0.999 },
                mission_limits: { max_reward: 5000, max_concurrent: 5 },
                version: '2.1.0',
                created_at: new Date().toISOString()
            }
        });

        // Set initial reputation (randomized slightly)
        const initialRep = 50 + Math.floor(Math.random() * 20);
        agentAuth.updateReputation(bot.id, initialRep);

        // Fund wallet
        tokenLedger.mint(bot.id, 5000);

        bots.push(bot);
        console.log(`✅ Registered ${bot.name} (${bot.hourly_rate}/hr) - Rep: ${initialRep}`);
    }

    // ============================================
    // STEP 2: Create Solo Missions (6 Total)
    // ============================================
    console.log('\n🚀 STEP 2: Creating Solo Missions\n');

    // Helpers
    const createArtifacts = (missionId: string, agentId: string, type: string) => {
        const dir = path.join(artifactsDir, missionId);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const files: ArtifactMetadata[] = [];

        if (type === 'code') {
            fs.writeFileSync(path.join(dir, 'implementation.ts'), '// Implementation code...');
            files.push({
                filename: 'implementation.ts',
                original_filename: 'implementation.ts',
                url: `/api/artifacts/${missionId}/implementation.ts`,
                size: 1024,
                mime_type: 'application/typescript',
                uploaded_by: agentId,
                uploaded_at: new Date()
            });
        } else if (type === 'design') {
            fs.writeFileSync(path.join(dir, 'design_mockup.png'), 'fake_image_data');
            files.push({
                filename: 'design_mockup.png',
                original_filename: 'design_mockup.png',
                url: `/api/artifacts/${missionId}/design_mockup.png`,
                size: 2048,
                mime_type: 'image/png',
                uploaded_by: agentId,
                uploaded_at: new Date()
            });
        }
        return files;
    };

    // 1. Settled Missions (Successfully completed)
    const settledMissions = [
        { title: 'API Gateway Implementation', reward: 500, agent: bots[0], type: 'code' },
        { title: 'Landing Page Redesign', reward: 450, agent: bots[4], type: 'design' }
    ];

    for (const m of settledMissions) {
        const mission = missionStore.create({
            requester_id: 'requester_demo',
            title: m.title,
            description: 'Execute high priority task.',
            reward: m.reward,
            specialties: m.agent.specialties,
            requirements: ['High Quality'],
            deliverables: ['Source Code'],
            assignment_mode: 'autopilot',
            escrow: { locked: true, amount: m.reward, locked_at: new Date() },
            tags: ['demo']
        } as any);

        const artifacts = createArtifacts(mission.id, m.agent.id, m.type);

        missionStore.update(mission.id, {
            status: 'settled',
            assigned_agent: { agent_id: m.agent.id, agent_name: m.agent.name, assigned_at: new Date(), assignment_method: 'autopilot' },
            work_artifacts: artifacts,
        } as any);

        // Manual settlement data injection
        const missionData = missionStore.get(mission.id);
        if (missionData) {
            Object.assign(missionData, {
                settlement: {
                    final_amount: m.reward,
                    settled_at: new Date(),
                    transaction_hash: '0x' + Math.random().toString(16).slice(2),
                    verification_round: 1
                }
            });
            // Force save (hacky but works for seed)
            (missionStore as any).save();
        }

        // Update Agent Stats
        agentAuth.updateReputation(m.agent.id, m.agent.reputation + 5);
        agentAuth.addEarnings(m.agent.id, m.reward);

        // Add to Job History (Important for profile)
        jobHistory.recordJobOutcome(m.agent.id, {
            mission_id: mission.id,
            mission_title: mission.title,
            reward: mission.reward,
            completed_at: new Date().toISOString(),
            outcome: 'PASS',
            rating: 5,
            type: 'solo'
        });

        console.log(`✅ Created SETTLED mission: ${m.title}`);
    }

    // 2. Verifying Mission (With revisions)
    const verifyingMission = missionStore.create({
        requester_id: 'requester_demo',
        title: 'Security Audit: Smart Contracts',
        description: 'Audit the new staking contracts for reentrancy vulnerabilities.',
        reward: 1200,
        specialties: ['security', 'audit'],
        requirements: ['Detailed Report'],
        deliverables: ['Audit PDF'],
        assignment_mode: 'direct_hire',
        direct_agent_id: bots[10].id,
        escrow: { locked: true, amount: 1200, locked_at: new Date() },
        tags: ['demo']
    } as any);

    missionStore.update(verifyingMission.id, {
        status: 'verifying',
        assigned_agent: { agent_id: bots[10].id, agent_name: bots[10].name, assigned_at: new Date(), assignment_method: 'manual' },
        work_artifacts: createArtifacts(verifyingMission.id, bots[10].id, 'code'),
        verifying_started_at: new Date()
    });
    console.log(`✅ Created VERIFYING mission: ${verifyingMission.title}`);


    // 3. Assigned/Executing Missions
    const executingMissions = [
        { title: 'Python Data Pipeline', reward: 300, agent: bots[3] },
        { title: 'Market Competitor Analysis', reward: 250, agent: bots[7] },
        { title: 'Homepage Animation', reward: 600, agent: bots[6] }
    ];

    for (const m of executingMissions) {
        const mission = missionStore.create({
            requester_id: 'requester_demo',
            title: m.title,
            description: 'Execute task according to specs.',
            reward: m.reward,
            specialties: m.agent.specialties,
            requirements: ['fast execution'],
            deliverables: ['files'],
            assignment_mode: 'autopilot',
            escrow: { locked: true, amount: m.reward, locked_at: new Date() },
            tags: ['executing']
        } as any);

        missionStore.update(mission.id, {
            status: 'executing',
            assigned_agent: { agent_id: m.agent.id, agent_name: m.agent.name, assigned_at: new Date(), assignment_method: 'autopilot' },
            executing_started_at: new Date()
        });

        // Stake Bond
        bondManager.stakeWorkerBond(m.agent.id, mission.id, m.reward * 0.1); // 10% bond

        console.log(`✅ Created EXECUTING mission: ${m.title}`);
    }


    // ============================================
    // STEP 3: Create Crew Missions (6 Total)
    // ============================================
    console.log('\n👥 STEP 3: Creating Crew Missions\n');

    // 1. Settled Crew Mission
    const crewSettled = missionStore.create({
        requester_id: 'requester_demo',
        title: 'Launch New Crypto Exchange MVP',
        description: 'Full stack launch of exchange.',
        reward: 5000,
        specialties: ['coding', 'design', 'security'],
        requirements: ['Complete MVP'],
        deliverables: ['Deployed Site'],
        assignment_mode: 'crew',
        crew_required: true,
        escrow: { locked: true, amount: 5000, locked_at: new Date() },
        tags: ['crew', 'mvp']
    } as any);

    // Subtasks
    const subtasks = [
        { title: 'Backend API', reward: 2000, agent: bots[0] },
        { title: 'Frontend Dashboard', reward: 1500, agent: bots[2] },
        { title: 'Smart Contracts', reward: 1500, agent: bots[10] }
    ];

    missionStore.update(crewSettled.id, {
        status: 'settled'
    });
    // Manual injection for settlement
    const crewMission = missionStore.get(crewSettled.id);
    if (crewMission) {
        Object.assign(crewMission, {
            settlement: { final_amount: 5000, settled_at: new Date(), transaction_hash: '0x123', verification_round: 1 }
        });
        (missionStore as any).save();
    }

    for (const task of subtasks) {
        // In a real system these would be linked sub-missions or tasks
        // For visual demo, we assume main mission status reflects aggregate
        // We update the agents involved
        agentAuth.addEarnings(task.agent.id, task.reward);
        jobHistory.recordJobOutcome(task.agent.id, {
            mission_id: crewSettled.id, // Linking to parent mission for simplicity
            mission_title: `${crewSettled.title} - ${task.title}`,
            reward: task.reward,
            completed_at: new Date().toISOString(),
            outcome: 'PASS',
            rating: 5,
            type: 'crew'
        });
    }
    console.log(`✅ Created SETTLED Crew Mission: ${crewSettled.title}`);


    // 2. Active Crew Mission (In Progress)
    const crewActive = missionStore.create({
        requester_id: 'requester_demo',
        title: 'DeFi Protocol Audit & Fix',
        description: 'Audit and fix protocol vulnerabilities.',
        reward: 8000,
        specialties: ['security', 'coding'],
        requirements: ['Zero Critical Bugs'],
        deliverables: ['Audit Report', 'Patches'],
        assignment_mode: 'crew',
        crew_required: true,
        escrow: { locked: true, amount: 8000, locked_at: new Date() },
        tags: ['crew', 'audit']
    } as any);

    missionStore.update(crewActive.id, {
        status: 'executing',
        executing_started_at: new Date()
    });

    console.log(`✅ Created EXECUTING Crew Mission: ${crewActive.title}`);


    console.log('\n✨ DEMO ECONOMY SEEDED SUCCESSFULLY ✨');
    console.log(`Total Bots: ${bots.length}`);
    console.log(`Total Missions: 12`);
}

seedDemoEconomy().catch(console.error);
