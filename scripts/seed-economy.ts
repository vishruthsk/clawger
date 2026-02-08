#!/usr/bin/env ts-node
/**
 * Seed Economy Script
 * 
 * Creates realistic test data for the CLAWGER multi-agent economy:
 * - 5 Dummy bots with balances
 * - 3 Dummy missions (human and bot origins)
 * - 2 Dummy deals
 */

import { AgentAuth } from '../core/registry/agent-auth';
import { TokenLedger } from '../core/ledger/token-ledger';
import { MissionStore } from '../core/missions/mission-store';
import { CrewMissionStore } from '../core/missions/crew-mission-store';

async function seedEconomy() {
    console.log('\n🌱 SEEDING CLAWGER ECONOMY\n');
    console.log('='.repeat(80) + '\n');

    const agentAuth = new AgentAuth('./data');
    const tokenLedger = new TokenLedger('./data');
    const missionStore = new MissionStore('./data');
    const crewStore = new CrewMissionStore('./data');

    // ============================================
    // STEP 1: Create 5 Specialized Bots
    // ============================================
    console.log('📋 STEP 1: Creating Specialized Bots\n');

    const botConfigs = [
        {
            name: 'StrategyBot',
            address: `strategy_bot_${Date.now()}`,
            specialties: ['Strategy', 'Planning', 'Project Management'],
            balance: 5000,
            hourly_rate: 60,
            profile: 'Strategic planning expert specializing in complex mission decomposition and crew coordination. Has successfully led 50+ multi-agent projects.'
        },
        {
            name: 'CodeMasterBot',
            address: `code_bot_${Date.now()}`,
            specialties: ['Coding', 'Backend', 'Smart Contracts'],
            balance: 3000,
            hourly_rate: 55,
            profile: 'Senior software engineer with expertise in Solidity, Node.js, and system architecture. 95% success rate on backend tasks.'
        },
        {
            name: 'DesignWizard',
            address: `design_bot_${Date.now()}`,
            specialties: ['UI/UX', 'Frontend', 'Design'],
            balance: 3500,
            hourly_rate: 50,
            profile: 'Creative UI/UX specialist focused on modern, responsive design. Expert in React, Next.js, and design systems.'
        },
        {
            name: 'QualityGuardian',
            address: `test_bot_${Date.now()}`,
            specialties: ['Testing', 'QA', 'Security Audits'],
            balance: 2500,
            hourly_rate: 45,
            profile: 'Meticulous QA engineer with security audit certifications. Specializes in E2E testing and vulnerability detection.'
        },
        {
            name: 'DataMiner',
            address: `data_bot_${Date.now()}`,
            specialties: ['Data Analysis', 'Analytics', 'Research'],
            balance: 4000,
            hourly_rate: 52,
            profile: 'Data science expert with focus on competitive analysis, market research, and insights extraction.'
        }
    ];

    const bots = [];
    for (const config of botConfigs) {
        const bot = agentAuth.register({
            address: config.address,
            name: config.name,
            profile: config.profile,
            specialties: config.specialties,
            hourly_rate: config.hourly_rate,
            wallet_address: `0x${Math.random().toString(16).substr(2, 40)}`
        });

        // Fund the bot
        tokenLedger.mint(bot.id, config.balance);

        bots.push({ ...bot, balance: config.balance });
        console.log(`✅ ${config.name} (${bot.id})`);
        console.log(`   Balance: ${config.balance} $CLAWGER`);
        console.log(`   Specialties: ${config.specialties.join(', ')}\n`);
    }

    // ============================================
    // STEP 2: Create Dummy Missions
    // ============================================
    console.log('📋 STEP 2: Creating Sample Missions\n');

    // Mission 1: Human → Bot (High reward)
    const mission1 = missionStore.create({
        requester_id: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4',
        requester_type: 'wallet',
        title: '[HUMAN] Build DEX Analytics Dashboard',
        description: 'Create a comprehensive analytics dashboard for tracking DEX volumes, liquidity, and trades across multiple chains.',
        reward: 800,
        specialties: ['Frontend', 'Data Analysis', 'Backend'],
        requirements: ['Real-time data', 'Multi-chain support', 'Clean UI'],
        deliverables: ['Working dashboard', 'API documentation'],
        tags: ['analytics', 'defi', 'dashboard'],
        assignment_mode: 'autopilot',
        escrow: { locked: false, amount: 800 }
    });
    console.log(`✅ Mission 1: ${mission1.title}`);
    console.log(`   Requester: Human (wallet)`);
    console.log(`   Reward: ${mission1.reward} $CLAWGER\n`);

    // Mission 2: Bot → Bot (Medium reward)
    const strategyBot = bots[0];
    const mission2 = missionStore.create({
        requester_id: strategyBot.id,
        requester_type: 'agent',
        requester_name: strategyBot.name,
        title: '[BOT] Smart Contract Security Audit',
        description: 'Perform comprehensive security audit on new token contract. Check for reentrancy, overflow, and access control issues.',
        reward: 400,
        specialties: ['Security Audits', 'Testing', 'Smart Contracts'],
        requirements: ['Full audit report', 'Vulnerability classifications', 'Fix recommendations'],
        deliverables: ['Audit report PDF', 'Test suite'],
        tags: ['security', 'audit', 'smart-contracts'],
        assignment_mode: 'autopilot',
        escrow: { locked: false, amount: 400 }
    });
    console.log(`✅ Mission 2: ${mission2.title}`);
    console.log(`   Requester: ${strategyBot.name} (agent)`);
    console.log(`   Reward: ${mission2.reward} $CLAWGER\n`);

    // Mission 3: Bot → Crew (High reward, complex)
    const mission3 = missionStore.create({
        requester_id: strategyBot.id,
        requester_type: 'agent',
        requester_name: strategyBot.name,
        title: '[CREW] NFT Marketplace Launch',
        description: 'Build and launch a full-featured NFT marketplace with smart contracts, frontend, and backend infrastructure.',
        reward: 1200,
        specialties: ['Frontend', 'Backend', 'Smart Contracts', 'Design'],
        requirements: ['ERC-721 support', 'Auction system', 'Admin dashboard'],
        deliverables: ['Deployed contracts', 'Live marketplace', 'Documentation'],
        tags: ['nft', 'marketplace', 'crew', 'fullstack'],
        assignment_mode: 'bidding',
        crew_required: true,
        escrow: { locked: false, amount: 1200 }
    });
    console.log(`✅ Mission 3: ${mission3.title}`);
    console.log(`   Requester: ${strategyBot.name} (agent)`);
    console.log(`   Type: CREW MISSION`);
    console.log(`   Reward: ${mission3.reward} $CLAWGER\n`);

    // ============================================
    // STEP 3: Summary
    // ============================================
    console.log('='.repeat(80));
    console.log('✅ ECONOMY SEEDED SUCCESSFULLY!\n');
    console.log('Summary:');
    console.log(`  🤖 Bots: ${bots.length}`);
    console.log(`  💰 Total Bot Balance: ${bots.reduce((sum, b) => sum + b.balance, 0)} $CLAWGER`);
    console.log(`  📜 Missions: 3 (1 human → bot, 2 bot → bot)`);
    console.log(`  ⛓️  Crew Missions: 1`);
    console.log();
    console.log('Bot IDs for testing:');
    bots.forEach(bot => {
        console.log(`  ${bot.name}: ${bot.id}`);
        console.log(`    API Key: ${bot.apiKey.substring(0, 30)}...`);
    });
    console.log('\n📝 You can now:');
    console.log('  1. Run demo:bot-economy to see full lifecycle');
    console.log('  2. Test agent mission creation with bot API keys');
    console.log('  3. Test crew coordination on mission 3\n');
}

seedEconomy().catch(error => {
    console.error('\n❌ Seeding Failed:', error.message);
    console.error(error.stack);
    process.exit(1);
});
