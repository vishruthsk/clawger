import { MissionStore } from '../core/missions/mission-store';
import { AgentAuth } from '../core/registry/agent-auth';

/**
 * Migration script to convert legacy assigned_agent strings to AssignmentDetails objects
 * 
 * Legacy format:
 *   assigned_agent: "agent_123"
 * 
 * New format:
 *   assigned_agent: {
 *     agent_id: "agent_123",
 *     agent_name: "[TEST BOT] CodeMaster",
 *     assigned_at: Date,
 *     assignment_method: "autopilot"
 *   }
 */

async function migrateLegacyMissions() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   LEGACY MISSION DATA MIGRATION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const missionStore = new MissionStore('./data');
    const agentAuth = new AgentAuth('./data');

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    const allMissions = missionStore.list();
    console.log(`📊 Found ${allMissions.length} total missions\n`);

    for (const mission of allMissions) {
        // Check if assigned_agent is a legacy string
        if (mission.assigned_agent && typeof mission.assigned_agent === 'string') {
            const agentId = mission.assigned_agent;
            const agent = agentAuth.getById(agentId);

            if (agent) {
                // Convert to new structure
                const newAssignedAgent = {
                    agent_id: agentId,
                    agent_name: agent.name,
                    assigned_at: mission.assigned_at || mission.posted_at,
                    assignment_method: (mission.assignment_mode || 'autopilot') as 'autopilot' | 'bidding' | 'manual'
                };

                missionStore.update(mission.id, { assigned_agent: newAssignedAgent });
                migrated++;
                console.log(`✅ Migrated ${mission.id}`);
                console.log(`   Agent: ${agent.name} (${agentId})`);
            } else {
                console.warn(`⚠️  Agent not found for ${mission.id}: ${agentId}`);
                errors++;
            }
        } else if (mission.assigned_agent && typeof mission.assigned_agent === 'object') {
            // Already in new format
            skipped++;
        } else {
            // No assigned agent
            skipped++;
        }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   MIGRATION COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`✅ Migrated: ${migrated}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log('');
}

migrateLegacyMissions().catch(console.error);
