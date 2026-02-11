#!/usr/bin/env ts-node
/**
 * Seed Real Data Script
 * 
 * Creates production-like test data with REAL ARTIFACTS
 */

import { AgentAuth } from '../core/registry/agent-auth';
import { TokenLedger } from '../core/ledger/token-ledger';
import { MissionStore, ArtifactMetadata } from '../core/missions/mission-store';
import { JobHistoryManager } from '../core/jobs/job-history-manager';
import { SettlementEngine } from '../core/settlement/settlement-engine';
import { BondManager } from '../core/bonds/bond-manager';
import * as fs from 'fs';
import * as path from 'path';

async function seedRealData() {
    console.log('\n🌱 SEEDING REAL DATA WITH ARTIFACTS\n');
    console.log('='.repeat(80) + '\n');

    const agentAuth = new AgentAuth('./data');
    const tokenLedger = new TokenLedger('./data');
    const missionStore = new MissionStore('./data');
    const jobHistory = new JobHistoryManager('./data');
    const bondManager = new BondManager(tokenLedger, './data');
    const settlementEngine = new SettlementEngine(tokenLedger, bondManager, agentAuth, jobHistory, './data');

    // ============================================
    // STEP 1: Create Agents
    // ============================================
    console.log('📋 STEP 1: Creating Agents\n');

    const designBot = agentAuth.register({
        address: `design_bot_${Date.now()}`,
        name: 'DesignMaster',
        profile: 'Expert UI/UX designer with 10+ years experience',
        specialties: ['design', 'ui-ux', 'frontend'],
        hourly_rate: 90, // Updated to 90
        wallet_address: 'design_wallet',
        neural_spec: {
            model: 'claude-3.5-sonnet',
            provider: 'Anthropic',
            capabilities: ['design', 'ui-ux', 'frontend', 'research'],
            tool_access: ['none'],
            response_style: 'deep',
            max_context_tokens: 200000,
            sla: {
                avg_latency_ms: 3000,
                uptime_target: 0.98
            },
            mission_limits: {
                max_reward: 500,
                max_concurrent: 3
            },
            version: '1.0',
            created_at: new Date().toISOString()
        }
    });

    const codeBot = agentAuth.register({
        address: `code_bot_${Date.now()}`,
        name: 'CodeWizard',
        profile: 'Full-stack developer specializing in trading systems',
        specialties: ['coding', 'backend', 'integration'],
        hourly_rate: 120, // Updated to 120
        wallet_address: 'code_wallet',
        neural_spec: {
            model: 'gpt-4o',
            provider: 'OpenAI',
            capabilities: ['coding', 'backend', 'integration', 'security-audit', 'research'],
            tool_access: ['code', 'browser'],
            response_style: 'fast',
            max_context_tokens: 128000,
            sla: {
                avg_latency_ms: 2000,
                uptime_target: 0.99
            },
            mission_limits: {
                max_reward: 800,
                max_concurrent: 5
            },
            version: '1.0',
            created_at: new Date().toISOString()
        }
    });

    const researchBot = agentAuth.register({
        address: `research_bot_${Date.now()}`,
        name: 'ResearchBot',
        profile: 'Academic researcher specializing in data analysis and summarization',
        specialties: ['research', 'data-analysis', 'summarization'],
        hourly_rate: 75,
        wallet_address: 'research_wallet',
        neural_spec: {
            model: 'gpt-4-turbo',
            provider: 'OpenAI',
            capabilities: ['research', 'data-analysis', 'writing'],
            tool_access: ['browser'],
            response_style: 'academic',
            max_context_tokens: 128000,
            sla: {
                avg_latency_ms: 4000,
                uptime_target: 0.99
            },
            mission_limits: {
                max_reward: 400,
                max_concurrent: 2
            },
            version: '1.0',
            created_at: new Date().toISOString()
        }
    });

    const securitySage = agentAuth.register({
        address: `security_bot_${Date.now()}`,
        name: 'SecuritySage',
        profile: 'Cybersecurity expert for smart contract auditing and vulnerability assessment',
        specialties: ['security', 'audit', 'smart-contracts'],
        hourly_rate: 150,
        wallet_address: 'security_wallet',
        neural_spec: {
            model: 'claude-3-opus',
            provider: 'Anthropic',
            capabilities: ['security-audit', 'smart-contracts', 'penetration-testing'],
            tool_access: ['code', 'browser'],
            response_style: 'thorough',
            max_context_tokens: 200000,
            sla: {
                avg_latency_ms: 5000,
                uptime_target: 0.999
            },
            mission_limits: {
                max_reward: 1000,
                max_concurrent: 2
            },
            version: '1.0',
            created_at: new Date().toISOString()
        }
    });

    tokenLedger.mint(designBot.id, 2000);
    tokenLedger.mint(codeBot.id, 2000);
    tokenLedger.mint(researchBot.id, 2000);
    tokenLedger.mint(securitySage.id, 2000);

    console.log(`✅ DesignMaster (${designBot.id}) - Rate: $${designBot.hourly_rate}/hr`);
    console.log(`✅ CodeWizard (${codeBot.id}) - Rate: $${codeBot.hourly_rate}/hr`);
    console.log(`✅ ResearchBot (${researchBot.id}) - Rate: $${researchBot.hourly_rate}/hr`);
    console.log(`✅ SecuritySage (${securitySage.id}) - Rate: $${securitySage.hourly_rate}/hr\n`);

    // ============================================
    // STEP 2: Create Artifact Directories
    // ============================================
    console.log('📋 STEP 2: Creating Artifact Directories\n');

    const mission1Id = `mission_${Date.now()}_design`;
    const mission2Id = `mission_${Date.now()}_code`;

    const mission1Dir = path.join('./data/artifacts', mission1Id);
    const mission2Dir = path.join('./data/artifacts', mission2Id);

    fs.mkdirSync(mission1Dir, { recursive: true });
    fs.mkdirSync(mission2Dir, { recursive: true });

    console.log(`✅ Created ${mission1Dir}`);
    console.log(`✅ Created ${mission2Dir}\n`);

    // ============================================
    // STEP 3: Create Sample Artifact Files
    // ============================================
    console.log('📋 STEP 3: Creating Sample Artifact Files\n');

    // Mission 1: Design artifacts
    const designSpecContent = `# Dashboard UI/UX Design Specifications

## Overview
Modern analytics dashboard with real-time data visualization.

## Color Palette
- Primary: #6366F1 (Indigo)
- Secondary: #8B5CF6 (Purple)
- Accent: #EC4899 (Pink)

## Components
1. Stat Cards
2. Line Charts
3. Data Tables

## Responsive Design
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px
`;

    const designReadmeContent = `# Design Deliverables

This package includes:
- Design specifications (design-specs.md)
- Mockup image (dashboard-mockup.png)
- Component library documentation

## Installation
Review the design specs and provide feedback.

## Next Steps
- Approve design
- Begin implementation
- Schedule review meeting
`;

    fs.writeFileSync(path.join(mission1Dir, '1707648000000_abc123_design-specs.md'), designSpecContent);
    fs.writeFileSync(path.join(mission1Dir, '1707648001000_def456_README.md'), designReadmeContent);

    // Create a simple placeholder image (1x1 PNG)
    const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    fs.writeFileSync(path.join(mission1Dir, '1707648002000_ghi789_dashboard-mockup.png'), pngBuffer);

    console.log(`✅ Created design-specs.md`);
    console.log(`✅ Created README.md`);
    console.log(`✅ Created dashboard-mockup.png\n`);

    // Mission 2: Code artifacts
    const tradingBotReadmeContent = `# Trading Bot Integration

## Features
- Real-time price monitoring
- Automated order execution
- Risk management
- Portfolio rebalancing

## API Integration
Connects to major DEX APIs for seamless trading.

## Configuration
See config.example.json for setup instructions.

## Testing
All integration tests passing ✅
`;

    const configContent = `{
  "dex": {
    "apiUrl": "https://api.dex.example.com",
    "apiKey": "YOUR_API_KEY",
    "apiSecret": "YOUR_API_SECRET"
  },
  "trading": {
    "maxPositionSize": 1000,
    "stopLossPercent": 5,
    "takeProfitPercent": 10
  }
}`;

    fs.writeFileSync(path.join(mission2Dir, '1707648003000_jkl012_README.md'), tradingBotReadmeContent);
    fs.writeFileSync(path.join(mission2Dir, '1707648004000_mno345_config.example.json'), configContent);

    console.log(`✅ Created trading bot README.md`);
    console.log(`✅ Created config.example.json\n`);

    // ============================================
    // STEP 4: Create Missions with Artifacts
    // ============================================
    console.log('📋 STEP 4: Creating Missions with Artifacts\n');

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    const mission1Artifacts: ArtifactMetadata[] = [
        {
            filename: '1707648000000_abc123_design-specs.md',
            original_filename: 'design-specs.md',
            url: `/api/artifacts/${mission1Id}/1707648000000_abc123_design-specs.md`,
            size: designSpecContent.length,
            mime_type: 'text/markdown',
            uploaded_by: designBot.id,
            uploaded_at: twoHoursAgo
        },
        {
            filename: '1707648001000_def456_README.md',
            original_filename: 'README.md',
            url: `/api/artifacts/${mission1Id}/1707648001000_def456_README.md`,
            size: designReadmeContent.length,
            mime_type: 'text/markdown',
            uploaded_by: designBot.id,
            uploaded_at: twoHoursAgo
        },
        {
            filename: '1707648002000_ghi789_dashboard-mockup.png',
            original_filename: 'dashboard-mockup.png',
            url: `/api/artifacts/${mission1Id}/1707648002000_ghi789_dashboard-mockup.png`,
            size: pngBuffer.length,
            mime_type: 'image/png',
            uploaded_by: designBot.id,
            uploaded_at: oneHourAgo
        }
    ];

    const mission2Artifacts: ArtifactMetadata[] = [
        {
            filename: '1707648003000_jkl012_README.md',
            original_filename: 'README.md',
            url: `/api/artifacts/${mission2Id}/1707648003000_jkl012_README.md`,
            size: tradingBotReadmeContent.length,
            mime_type: 'text/markdown',
            uploaded_by: codeBot.id,
            uploaded_at: twoHoursAgo
        },
        {
            filename: '1707648004000_mno345_config.example.json',
            original_filename: 'config.example.json',
            url: `/api/artifacts/${mission2Id}/1707648004000_mno345_config.example.json`,
            size: configContent.length,
            mime_type: 'application/json',
            uploaded_by: codeBot.id,
            uploaded_at: oneHourAgo
        }
    ];

    // Create Mission 1: Design Dashboard (VERIFYING with artifacts)
    const mission1 = missionStore.create({
        requester_id: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4',
        requester_type: 'wallet',
        title: 'Design: Dashboard UI/UX',
        description: 'Design analytics dashboard with modern UI and real-time data visualization',
        reward: 150,
        specialties: ['design', 'ui-ux'],
        requirements: ['Modern design system', 'Responsive layout', 'Dark mode support'],
        deliverables: ['Design specifications', 'Mockup images', 'Component documentation'],
        tags: ['design', 'ui', 'dashboard'],
        assignment_mode: 'autopilot',
        escrow: {
            locked: false,
            amount: 150
        }
    });

    // Update mission 1 with artifacts and status
    missionStore.update(mission1.id, {
        status: 'verifying',
        assignment_mode: 'autopilot',
        assigned_agent: {
            agent_id: designBot.id,
            agent_name: 'DesignMaster',
            assigned_at: new Date('2024-02-11T09:00:00Z'),
            assignment_method: 'autopilot'
        },
        escrow: {
            locked: true,
            amount: 150,
            locked_at: new Date('2024-02-11T09:00:00Z')
        },
        assigned_at: new Date('2024-02-11T09:00:00Z'),
        executing_started_at: new Date('2024-02-11T09:30:00Z'),
        verifying_started_at: new Date('2024-02-11T10:00:00Z'),
        work_artifacts: mission1Artifacts
    });

    // Rename artifact directory to match actual mission ID
    const actualMission1Dir = path.join('./data/artifacts', mission1.id);
    if (fs.existsSync(mission1Dir) && mission1Dir !== actualMission1Dir) {
        fs.renameSync(mission1Dir, actualMission1Dir);
    }

    // Update artifact URLs to use actual mission ID
    const updatedMission1Artifacts = mission1Artifacts.map(a => ({
        ...a,
        url: `/api/artifacts/${mission1.id}/${a.filename}`
    }));
    missionStore.update(mission1.id, { work_artifacts: updatedMission1Artifacts });

    // Create Mission 2: Trading Bot (VERIFYING with artifacts)
    const mission2 = missionStore.create({
        requester_id: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4',
        requester_type: 'wallet',
        title: 'Code: Trading Bot Integration',
        description: 'Integrate with DEX APIs for automated trading with risk management',
        reward: 200,
        specialties: ['coding', 'backend', 'integration'],
        requirements: ['DEX API integration', 'Risk management', 'Error handling'],
        deliverables: ['Integration code', 'Configuration files', 'Documentation'],
        tags: ['coding', 'trading', 'integration'],
        assignment_mode: 'autopilot',
        escrow: {
            locked: false,
            amount: 200
        }
    });

    // Update mission 2 with artifacts and status
    missionStore.update(mission2.id, {
        status: 'verifying',
        assignment_mode: 'autopilot',
        assigned_agent: {
            agent_id: codeBot.id,
            agent_name: 'CodeWizard',
            assigned_at: new Date('2024-02-11T09:00:00Z'),
            assignment_method: 'autopilot'
        },
        escrow: {
            locked: true,
            amount: 200,
            locked_at: new Date('2024-02-11T09:00:00Z')
        },
        assigned_at: new Date('2024-02-11T09:00:00Z'),
        executing_started_at: new Date('2024-02-11T09:30:00Z'),
        verifying_started_at: new Date('2024-02-11T10:00:00Z'),
        work_artifacts: mission2Artifacts
    });

    // Rename artifact directory to match actual mission ID
    const actualMission2Dir = path.join('./data/artifacts', mission2.id);
    if (fs.existsSync(mission2Dir) && mission2Dir !== actualMission2Dir) {
        fs.renameSync(mission2Dir, actualMission2Dir);
    }

    // Update artifact URLs to use actual mission ID
    const updatedMission2Artifacts = mission2Artifacts.map(a => ({
        ...a,
        url: `/api/artifacts/${mission2.id}/${a.filename}`
    }));
    missionStore.update(mission2.id, { work_artifacts: updatedMission2Artifacts });

    const finalMission1 = missionStore.get(mission1.id);
    const finalMission2 = missionStore.get(mission2.id);

    console.log(`✅ Mission 1: ${finalMission1?.title}`);
    console.log(`   ID: ${mission1.id}`);
    console.log(`   Status: ${finalMission1?.status}`);
    console.log(`   Artifacts: ${finalMission1?.work_artifacts?.length || 0} files`);
    console.log(`   Assigned to: ${finalMission1?.assigned_agent?.agent_name}\n`);

    console.log(`✅ Mission 2: ${finalMission2?.title}`);
    console.log(`   ID: ${mission2.id}`);
    console.log(`   Status: ${finalMission2?.status}`);
    console.log(`   Artifacts: ${finalMission2?.work_artifacts?.length || 0} files`);
    console.log(`   Assigned to: ${finalMission2?.assigned_agent?.agent_name}\n`);

    // ============================================
    // SUMMARY
    // ============================================
    console.log('='.repeat(80));
    console.log('\n✅ SEEDING COMPLETE\n');
    console.log('Agents Created: 2');
    console.log('Missions Created: 2');
    console.log('Artifacts Created: 5 files');
    console.log('\nVerify artifacts:');
    console.log(`  ls -la data/artifacts/${mission1.id}/`);
    console.log(`  ls -la data/artifacts/${mission2.id}/`);
    console.log('\n');
}

seedRealData().catch(console.error);
