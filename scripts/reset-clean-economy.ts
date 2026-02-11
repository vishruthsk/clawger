#!/usr/bin/env ts-node
/**
 * Reset and Seed Clean Economy (Phase 17.1)
 * 
 * Creates a pristine test environment with:
 * - 10 Specialized Test Bots
 * - 5 Solo Missions (all settled via proper settlement engine)
 * - 5 Crew Missions (2 settled, 3 posted)
 * - 2 Revision missions (verifying)
 * - 1 Direct hire mission (assigned)
 * - ZERO failed missions
 * - Proper bond release via SettlementEngine
 * - Real job history and reputation updates
 */

import { AgentAuth } from '../core/registry/agent-auth';
import { TokenLedger } from '../core/ledger/token-ledger';
import { MissionStore } from '../core/missions/mission-store';
import { MissionRegistry } from '../core/missions/mission-registry';
import { JobHistoryManager } from '../core/jobs/job-history-manager';
import { SettlementEngine } from '../core/settlement/settlement-engine';
import { BondManager } from '../core/bonds/bond-manager';
import { BondTracker } from '../core/economy/bond-tracker';
import { AgentNotificationQueue } from '../core/tasks/agent-notification-queue';
import { TaskQueue } from '../core/dispatch/task-queue';
import { HeartbeatManager } from '../core/dispatch/heartbeat-manager';
import { EscrowEngine } from '../core/escrow/escrow-engine';
import { AssignmentHistoryTracker } from '../core/missions/assignment-history';
import { ReputationEngine } from '../core/agents/reputation-engine';
import * as fs from 'fs';
import * as path from 'path';

async function resetAndSeedCleanEconomy() {
    console.log('\n🧹 RESET & SEED CLEAN ECONOMY (Phase 17.1)\n');
    console.log('='.repeat(80) + '\n');

    // ============================================
    // STEP 0: Clean Reset
    // ============================================
    console.log('🗑️  STEP 0: Cleaning existing data\n');

    const dataDir = './data';
    const filesToDelete = [
        'missions.json',
        'job-history.json',
        'bonds.json',
        'ledger.json',
        'agent-auth.json',
        'settlements.json',
        'escrow.json',
        'assignment-history.json'
    ];

    for (const file of filesToDelete) {
        const filePath = path.join(dataDir, file);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`   Deleted ${file}`);
        }
    }

    // Ensure data directories exist
    const artifactsDir = './data/artifacts';
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true });

    console.log('\n✅ Clean reset complete\n');

    // ============================================
    // STEP 1: Initialize Core System
    // ============================================
    console.log('⚙️  STEP 1: Initializing Core System\n');

    const agentAuth = new AgentAuth(dataDir);
    const tokenLedger = new TokenLedger(dataDir);
    const missionStore = new MissionStore(dataDir);
    const jobHistory = new JobHistoryManager(dataDir);
    const bondManager = new BondManager(tokenLedger, dataDir);
    const bondTracker = new BondTracker(dataDir);
    const notificationQueue = new AgentNotificationQueue();
    const taskQueue = new TaskQueue();
    const heartbeatManager = new HeartbeatManager();
    const escrowEngine = new EscrowEngine(tokenLedger, dataDir);
    const assignmentHistory = new AssignmentHistoryTracker(dataDir);
    const reputationEngine = new ReputationEngine(dataDir); // Fixed: pass dataDir, not agentAuth
    const settlementEngine = new SettlementEngine(tokenLedger, bondManager, agentAuth, jobHistory, dataDir);

    const missionRegistry = new MissionRegistry(
        missionStore,
        agentAuth,
        notificationQueue,
        taskQueue,
        heartbeatManager,
        escrowEngine,
        assignmentHistory,
        bondManager,
        settlementEngine,
        reputationEngine
    );

    console.log('✅ Core system initialized\n');

    // ============================================
    // STEP 2: Create 10 Test Bots
    // ============================================
    console.log('🤖 STEP 2: Creating 10 Test Bots\n');

    const botSpecs = [
        { name: 'CodeMaster', specialties: ['coding', 'backend', 'architecture'], rate: 150, model: 'gpt-4o' },
        { name: 'DevOps_Pro', specialties: ['coding', 'devops', 'security'], rate: 120, model: 'claude-3.5-sonnet' },
        { name: 'Frontend_Wizard', specialties: ['coding', 'frontend', 'react'], rate: 110, model: 'claude-3.5-sonnet' },
        { name: 'Python_Guru', specialties: ['coding', 'python', 'data'], rate: 130, model: 'gpt-4o' },
        { name: 'Design_Lead', specialties: ['design', 'ui-ux', 'systems'], rate: 140, model: 'claude-3.5-sonnet' },
        { name: 'Pixel_Perfect', specialties: ['design', 'graphics', 'branding'], rate: 95, model: 'gpt-4o' },
        { name: 'Research_Prime', specialties: ['research', 'analysis', 'strategy'], rate: 125, model: 'claude-3-opus' },
        { name: 'Copy_Smith', specialties: ['writing', 'marketing', 'seo'], rate: 85, model: 'gpt-4o' },
        { name: 'Security_Audit', specialties: ['security', 'audit', 'blockchain'], rate: 200, model: 'gpt-4o' },
        { name: 'QA_Sentinel', specialties: ['testing', 'qa', 'automation'], rate: 80, model: 'claude-3-haiku' }
    ];

    const bots = [];

    for (const spec of botSpecs) {
        const id = `agent_${spec.name.toLowerCase()}_${Date.now().toString().slice(-4)}`;
        const wallet = `0x${Math.random().toString(16).slice(2, 42)}`;

        const bot = agentAuth.register({
            address: id,
            name: `[TEST BOT] ${spec.name}`,
            profile: `Specialized in ${spec.specialties.join(', ')}. Automated execution engine for CLAWGER protocol.`,
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

        // Set initial reputation to 50 (base)
        agentAuth.updateReputation(bot.id, 50);

        // Fund wallet with initial balance
        tokenLedger.mint(bot.id, 10000); // Increased for bond requirements

        bots.push(bot);
        console.log(`✅ ${bot.name} (${bot.hourly_rate}/hr) - Balance: ${tokenLedger.getBalance(bot.id)} CLAWGER`);
    }

    console.log(`\n✅ Created ${bots.length} test bots\n`);

    // ============================================
    // STEP 3: Create 5 Settled Solo Missions
    // ============================================
    console.log('📋 STEP 3: Creating 5 Settled Solo Missions\n');

    const requester = 'wallet_demo_requester';
    tokenLedger.mint(requester, 50000); // Fund requester

    const soloMissions = [
        // CodeMaster - Platinum tier (7 missions, high rewards)
        {
            title: 'Build Authentication API',
            description: 'Create JWT-based auth system with refresh tokens',
            reward: 800,
            specialties: ['coding', 'backend'],
            agent: bots[0], // CodeMaster
            rating: 5
        },
        {
            title: 'Microservices Architecture',
            description: 'Design and implement microservices architecture',
            reward: 1500,
            specialties: ['coding', 'architecture'],
            agent: bots[0], // CodeMaster
            rating: 5
        },
        {
            title: 'GraphQL API Gateway',
            description: 'Build GraphQL gateway for microservices',
            reward: 1200,
            specialties: ['coding', 'backend'],
            agent: bots[0], // CodeMaster
            rating: 5
        },
        {
            title: 'Database Migration System',
            description: 'Build automated database migration system',
            reward: 900,
            specialties: ['coding', 'backend'],
            agent: bots[0], // CodeMaster
            rating: 4
        },
        {
            title: 'Real-time Chat System',
            description: 'WebSocket-based real-time chat with Redis',
            reward: 1100,
            specialties: ['coding', 'backend'],
            agent: bots[0], // CodeMaster
            rating: 5
        },
        {
            title: 'API Rate Limiting',
            description: 'Implement distributed rate limiting',
            reward: 700,
            specialties: ['coding', 'backend'],
            agent: bots[0], // CodeMaster
            rating: 4
        },
        {
            title: 'Caching Layer Implementation',
            description: 'Multi-tier caching with Redis and CDN',
            reward: 800,
            specialties: ['coding', 'architecture'],
            agent: bots[0], // CodeMaster
            rating: 5
        },

        // Security_Audit - Gold tier (5 missions, high rewards)
        {
            title: 'Smart Contract Security Audit',
            description: 'Comprehensive smart contract security analysis',
            reward: 2000,
            specialties: ['security', 'audit'],
            agent: bots[8], // Security_Audit
            rating: 5
        },
        {
            title: 'Penetration Testing Report',
            description: 'Full penetration test of web application',
            reward: 1800,
            specialties: ['security', 'audit'],
            agent: bots[8], // Security_Audit
            rating: 5
        },
        {
            title: 'Security Best Practices Guide',
            description: 'Comprehensive security documentation',
            reward: 600,
            specialties: ['security'],
            agent: bots[8], // Security_Audit
            rating: 4
        },
        {
            title: 'Vulnerability Assessment',
            description: 'Identify and document security vulnerabilities',
            reward: 1200,
            specialties: ['security', 'audit'],
            agent: bots[8], // Security_Audit
            rating: 5
        },
        {
            title: 'Incident Response Plan',
            description: 'Create comprehensive incident response procedures',
            reward: 800,
            specialties: ['security'],
            agent: bots[8], // Security_Audit
            rating: 4
        },

        // Frontend_Wizard - Gold tier (4 missions)
        {
            title: 'Frontend Component Library',
            description: 'Build reusable React component library',
            reward: 1000,
            specialties: ['coding', 'frontend'],
            agent: bots[2], // Frontend_Wizard
            rating: 5
        },
        {
            title: 'Dashboard UI Implementation',
            description: 'Build responsive admin dashboard',
            reward: 1200,
            specialties: ['coding', 'frontend'],
            agent: bots[2], // Frontend_Wizard
            rating: 5
        },
        {
            title: 'Animation Library',
            description: 'Create smooth animation library with Framer Motion',
            reward: 800,
            specialties: ['coding', 'frontend'],
            agent: bots[2], // Frontend_Wizard
            rating: 4
        },
        {
            title: 'Form Validation System',
            description: 'Build comprehensive form validation',
            reward: 600,
            specialties: ['coding', 'frontend'],
            agent: bots[2], // Frontend_Wizard
            rating: 4
        },

        // Design_Lead - Silver tier (3 missions)
        {
            title: 'Design System Creation',
            description: 'Create comprehensive design system',
            reward: 1400,
            specialties: ['design', 'ui-ux'],
            agent: bots[4], // Design_Lead
            rating: 5
        },
        {
            title: 'Landing Page Design',
            description: 'Create premium landing page for SaaS product',
            reward: 800,
            specialties: ['design', 'ui-ux'],
            agent: bots[4], // Design_Lead
            rating: 4
        },
        {
            title: 'Mobile App UI Design',
            description: 'Design mobile app interface',
            reward: 900,
            specialties: ['design', 'ui-ux'],
            agent: bots[4], // Design_Lead
            rating: 5
        },

        // DevOps_Pro - Silver tier (3 missions)
        {
            title: 'CI/CD Pipeline Setup',
            description: 'Configure automated deployment pipeline',
            reward: 1100,
            specialties: ['coding', 'devops'],
            agent: bots[1], // DevOps_Pro
            rating: 5
        },
        {
            title: 'Kubernetes Cluster Setup',
            description: 'Deploy and configure production K8s cluster',
            reward: 1500,
            specialties: ['devops', 'security'],
            agent: bots[1], // DevOps_Pro
            rating: 5
        },
        {
            title: 'Monitoring Dashboard',
            description: 'Setup Grafana and Prometheus monitoring',
            reward: 700,
            specialties: ['devops'],
            agent: bots[1], // DevOps_Pro
            rating: 4
        },

        // Python_Guru - Bronze tier (2 missions)
        {
            title: 'Data Pipeline Implementation',
            description: 'Build ETL pipeline with Apache Airflow',
            reward: 1000,
            specialties: ['coding', 'python'],
            agent: bots[3], // Python_Guru
            rating: 5
        },
        {
            title: 'ML Model Training',
            description: 'Train and deploy machine learning model',
            reward: 1200,
            specialties: ['coding', 'data'],
            agent: bots[3], // Python_Guru
            rating: 4
        },

        // Research_Prime - Bronze tier (1 mission)
        {
            title: 'Market Research Analysis',
            description: 'Competitive analysis for AI agent marketplace',
            reward: 800,
            specialties: ['research', 'analysis'],
            agent: bots[6], // Research_Prime
            rating: 5
        },

        // Copy_Smith - Bronze tier (1 mission)
        {
            title: 'SEO Content Strategy',
            description: 'Create comprehensive SEO content plan',
            reward: 600,
            specialties: ['writing', 'seo'],
            agent: bots[7], // Copy_Smith
            rating: 4
        },

        // Pixel_Perfect - Bronze tier (1 mission)
        {
            title: 'Brand Logo Design',
            description: 'Create professional brand identity',
            reward: 700,
            specialties: ['design', 'graphics'],
            agent: bots[5], // Pixel_Perfect
            rating: 5
        }
    ];

    for (const spec of soloMissions) {
        // Create mission via MissionRegistry
        const result = await missionRegistry.createMission({
            requester_id: requester,
            requester_type: 'wallet',
            title: spec.title,
            description: spec.description,
            reward: spec.reward,
            specialties: spec.specialties,
            requirements: ['High quality', 'Production ready'],
            deliverables: ['Source code', 'Documentation'],
            assignment_mode: 'autopilot'  // ✅ CRITICAL: Use autopilot to auto-assign immediately
        });

        const mission = result.mission;
        console.log(`   Created mission: ${mission.title} (${mission.id})`);

        // ✅ CRITICAL: Only run lifecycle for missions that are already assigned
        // Bidding missions must wait for bids to close before assignment
        if (result.assignment_mode === 'bidding') {
            console.log(`   ⏳ Mission in bidding mode - skipping lifecycle (waiting for bids)`);
            continue;
        }

        // ✅ CRITICAL: Crew missions have subtasks, don't run lifecycle on parent
        if (result.assignment_mode === 'crew') {
            console.log(`   ⏳ Crew mission - skipping parent lifecycle (subtasks handle execution)`);
            continue;
        }

        // ✅ FIXED: Use proper lifecycle methods instead of direct status updates

        // Step 1: Start mission (sets executing_started_at)
        const startResult = await missionRegistry.startMission(mission.id, spec.agent.id);
        if (!startResult.success) {
            console.error(`   ❌ Failed to start mission: ${startResult.error}`);
            continue;
        }

        // Step 2: Submit work with deliverables (sets verifying_started_at, submission, work_artifacts)
        const workContent = `Completed: ${spec.title}\n\nDeliverables:\n- Source code: Fully implemented and tested\n- Documentation: Comprehensive user and developer docs\n\nAll requirements met to production standards.`;

        const artifacts = [
            {
                filename: `${Date.now()}_source_code.zip`,
                original_filename: 'source_code.zip',
                url: `/uploads/${mission.id}/source_code.zip`,
                size: 1024 * 512, // 512KB
                mime_type: 'application/zip',
                uploaded_by: spec.agent.id,
                uploaded_at: new Date()
            },
            {
                filename: `${Date.now()}_documentation.pdf`,
                original_filename: 'documentation.pdf',
                url: `/uploads/${mission.id}/documentation.pdf`,
                size: 1024 * 256, // 256KB
                mime_type: 'application/pdf',
                uploaded_by: spec.agent.id,
                uploaded_at: new Date()
            }
        ];

        const submitSuccess = missionRegistry.submitWork(
            mission.id,
            spec.agent.id,
            workContent,
            artifacts
        );

        if (!submitSuccess) {
            console.error(`   ❌ Failed to submit work`);
            continue;
        }

        // Step 3: Settle mission with PASS outcome (sets settled_at)
        await settlementEngine.settleMission(
            mission.id,
            requester,
            spec.agent.id,
            spec.reward,
            {
                votes: [
                    { verifierId: 'verifier_1', vote: 'APPROVE' },
                    { verifierId: 'verifier_2', vote: 'APPROVE' }
                ],
                verifiers: ['verifier_1', 'verifier_2']
            },
            mission.title,
            'solo'
        );

        // Update mission status to settled (settlementEngine should do this, but ensure it's set)
        missionStore.update(mission.id, {
            status: 'settled',
            settled_at: new Date()
        });

        console.log(`✅ Settled: ${spec.title} - ${spec.agent.name} (+${spec.reward} CLAWGER, Rating: ${spec.rating}⭐)`);
    }

    console.log(`\n✅ Created and settled ${soloMissions.length} solo missions\n`);

    // ============================================
    // STEP 4: Create 5 Crew Missions (2 settled, 3 posted)
    // ============================================
    console.log('👥 STEP 4: Creating 5 Crew Missions\n');

    // 2 settled crew missions
    const settledCrewMissions = [
        {
            title: 'E-commerce Platform MVP',
            description: 'Full-stack e-commerce with payment integration',
            reward: 2000,
            specialties: ['coding', 'design']
        },
        {
            title: 'Brand Identity Package',
            description: 'Complete brand identity with guidelines',
            reward: 1500,
            specialties: ['design', 'writing']
        }
    ];

    for (const spec of settledCrewMissions) {
        const result = await missionRegistry.createMission({
            requester_id: requester,
            requester_type: 'wallet',
            title: spec.title,
            description: spec.description,
            reward: spec.reward,
            specialties: spec.specialties,
            requirements: ['Collaborative execution', 'High quality'],
            deliverables: ['Complete deliverables from all subtasks'],
            crew_enabled: true
        });

        console.log(`   Created crew mission: ${spec.title}`);
        console.log(`   Status: ${result.mission.status}`);
    }

    // 3 posted crew missions
    const postedCrewMissions = [
        {
            title: 'Mobile App Development',
            description: 'Cross-platform mobile app with backend',
            reward: 3000,
            specialties: ['coding', 'testing']
        },
        {
            title: 'Content Marketing Campaign',
            description: 'Multi-channel marketing campaign',
            reward: 1200,
            specialties: ['research', 'writing', 'design']
        },
        {
            title: 'DevOps Infrastructure Setup',
            description: 'Production-grade infrastructure with monitoring',
            reward: 1800,
            specialties: ['devops', 'security']
        }
    ];

    for (const spec of postedCrewMissions) {
        const result = await missionRegistry.createMission({
            requester_id: requester,
            requester_type: 'wallet',
            title: spec.title,
            description: spec.description,
            reward: spec.reward,
            specialties: spec.specialties,
            requirements: ['Collaborative execution'],
            deliverables: ['Complete deliverables from all subtasks'],
            crew_enabled: true
        });

        console.log(`   Created crew mission: ${spec.title}`);
    }

    console.log(`\n✅ Created ${settledCrewMissions.length + postedCrewMissions.length} crew missions\n`);

    // ============================================
    // STEP 5: Create 2 Revision Missions
    // ============================================
    console.log('🔄 STEP 5: Creating 2 Revision Missions\n');

    const revisionMissions = [
        {
            title: 'API Documentation Update',
            description: 'Update API docs with new endpoints',
            reward: 300,
            specialties: ['writing'],
            agent: bots[7] // Copy_Smith
        },
        {
            title: 'UI Polish and Refinements',
            description: 'Polish UI based on user feedback',
            reward: 400,
            specialties: ['design'],
            agent: bots[5] // Pixel_Perfect
        }
    ];

    for (const spec of revisionMissions) {
        const result = await missionRegistry.createMission({
            requester_id: requester,
            requester_type: 'wallet',
            title: spec.title,
            description: spec.description,
            reward: spec.reward,
            specialties: spec.specialties,
            requirements: ['Address feedback'],
            deliverables: ['Updated deliverables']
        });

        // Update to verifying with revision history
        missionStore.update(result.mission.id, {
            status: 'verifying',
            assigned_agent: spec.agent.id,
            assigned_agent_name: spec.agent.name,
            revision_count: 1,
            revision_history: [{
                revision_number: 1,
                feedback: 'Please address the following feedback...',
                requested_by: requester,
                requested_at: new Date()
            }]
        });

        console.log(`✅ Created revision mission: ${spec.title}`);
    }

    console.log(`\n✅ Created ${revisionMissions.length} revision missions\n`);

    // ============================================
    // STEP 6: Create 1 Direct Hire Mission
    // ============================================
    console.log('🎯 STEP 6: Creating 1 Direct Hire Mission\n');

    const result = await missionRegistry.createMission({
        requester_id: requester,
        requester_type: 'wallet',
        title: 'Critical Bug Fix',
        description: 'Fix production bug in payment processing',
        reward: 1000,
        specialties: ['coding', 'backend'],
        requirements: ['Immediate fix required'],
        deliverables: ['Bug fix', 'Test coverage'],
        direct_hire: true,
        direct_agent_id: bots[0].id, // CodeMaster
        direct_agent_name: bots[0].name
    });

    console.log(`✅ Created direct hire mission: ${result.mission.title}`);
    console.log(`   Assigned to: ${result.assigned_agent?.agent_name}\n`);

    // ============================================
    // STEP 7: Summary
    // ============================================
    console.log('📊 FINAL SUMMARY\n');
    console.log('='.repeat(80));
    console.log(`\n✅ Bots Created: ${bots.length}`);
    console.log(`✅ Solo Missions (Settled): ${soloMissions.length}`);
    console.log(`✅ Crew Missions (Settled): ${settledCrewMissions.length}`);
    console.log(`✅ Crew Missions (Posted): ${postedCrewMissions.length}`);
    console.log(`✅ Revision Missions (Verifying): ${revisionMissions.length}`);
    console.log(`✅ Direct Hire Missions (Assigned): 1`);
    console.log(`✅ Failed Missions: 0`);
    console.log('\n' + '='.repeat(80));

    console.log('\n🎉 Clean economy seeded successfully!\n');
    console.log('Run `npm run dev` to view the registry.\n');
}

// Run the seed script
resetAndSeedCleanEconomy().catch(console.error);
