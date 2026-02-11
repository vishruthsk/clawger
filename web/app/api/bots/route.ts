import { NextResponse } from 'next/server';
import { core, serializeContract } from '../../../lib/core-bridge';
import { JobHistoryManager } from '@core/jobs/job-history-manager';
import { getDataPath } from '@/lib/data-path';
import { TVSCalculator } from '@core/economy/tvs-calculator';
import { BondTracker } from '@core/economy/bond-tracker';
import { MissionStore } from '@core/missions/mission-store';
import { MissionRegistry } from '@core/missions/mission-registry';
import { ReputationEngine } from '@core/agents/reputation-engine';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const search = searchParams.get('search');
    const tagsParam = searchParams.get('tags');
    const tags = tagsParam ? tagsParam.split(',').map(t => t.trim().toLowerCase()) : [];

    // Get all agent profiles from AgentAuth
    const allAgents = core.agentAuth.listAgents();
    const dataPath = getDataPath();
    const jobHistory = new JobHistoryManager(dataPath);
    const missionStore = new MissionStore(dataPath);
    const missionRegistry = new MissionRegistry(
        missionStore,
        core.agentAuth,
        null as any,
        null as any,
        null as any,
        null as any,
        null as any,
        null as any,
        null as any,
        null as any
    );
    const tvsCalculator = new TVSCalculator(missionStore);
    const bondTracker = new BondTracker(dataPath);
    const reputationEngine = new ReputationEngine(dataPath);

    // Filter agents based on search and tags
    let filteredAgents = allAgents;

    // Search filter (name, ID, or specialties)
    if (search) {
        const searchLower = search.toLowerCase();
        filteredAgents = filteredAgents.filter(agent => {
            const nameMatch = agent.name?.toLowerCase().includes(searchLower);
            const idMatch = agent.id?.toLowerCase().includes(searchLower);
            const specialtyMatch = agent.specialties?.some((spec: string) =>
                spec.toLowerCase().includes(searchLower)
            );
            return nameMatch || idMatch || specialtyMatch;
        });
    }

    // Tag filter (specialties)
    if (tags.length > 0) {
        filteredAgents = filteredAgents.filter(agent => {
            if (!agent.specialties || agent.specialties.length === 0) return false;
            const agentSpecs = agent.specialties.map((s: string) => s.toLowerCase());
            return tags.some(tag => agentSpecs.includes(tag));
        });
    }

    // Inject real-time stats (earnings, jobs, value secured, bonds, reputation)
    const enhancedAgents = filteredAgents.map(agent => {
        const realEarnings = jobHistory.getTotalEarnings(agent.id);
        const realJobCount = jobHistory.getJobCount(agent.id);
        const totalValueSecured = tvsCalculator.getTotalValueSecured(agent.id);
        const activeBond = bondTracker.getActiveBond(agent.id);

        // Calculate success rate
        const jobOutcomes = jobHistory.getJobOutcomes(agent.id);
        const passedJobs = jobOutcomes.filter(j => j.outcome === 'PASS').length;
        const totalJobs = jobOutcomes.length;
        const successRate = totalJobs > 0 ? (passedJobs / totalJobs) * 100 : 100;

        // Calculate reputation from job history (source of truth)
        const reputationBreakdown = reputationEngine.getReputationBreakdown(agent.id);

        return {
            ...agent,
            total_earnings: realEarnings || 0,
            jobs_completed: Math.max(realJobCount, agent.jobs_completed || 0),
            total_value_secured: totalValueSecured,
            active_bond: activeBond > 0 ? activeBond : null,
            success_rate: Math.round(successRate),
            hourly_rate: agent.hourly_rate || 0,
            reputation: reputationBreakdown.total // Use calculated reputation
        };
    });

    return NextResponse.json(serializeContract(enhancedAgents));
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Mock signer address for now
        // In real flow, this could come from a signature verification
        const address = body.address;

        const mockAddress = await core.agentRegistry.registerAgent({
            type: body.type,
            capabilities: body.capabilities || [],
            minFee: body.minFee || '0.1',
            minBond: body.minBond || '1.0',
            operator: body.operator || '0xOperator'
        });

        // 2. Generate API Key (The Handshake)
        const apiKey = core.agentAuth.register(mockAddress);

        return NextResponse.json({
            address: mockAddress,
            apiKey: apiKey,
            status: 'pending_activation'
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
