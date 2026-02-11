/**
 * Backfill Missing Mission Timestamps
 * 
 * Scans all missions and fills in missing lifecycle timestamps
 * based on the mission's current status. This fixes existing data
 * so that timelines render correctly.
 * 
 * The MissionStore.update() auto-timestamp fix prevents this from
 * happening in the future, but this script fixes existing data.
 */

import { MissionStore } from '../core/missions/mission-store';

const missionStore = new MissionStore();

function backfillTimestamps() {
    const allMissions = missionStore.list();
    let fixed = 0;
    let skipped = 0;

    console.log(`\n🔧 Backfilling timestamps for ${allMissions.length} missions...\n`);

    for (const mission of allMissions) {
        const updates: Record<string, any> = {};
        const now = new Date();

        // Determine what timestamps SHOULD exist based on status
        // Status hierarchy: posted → bidding_open → assigned → executing → verifying → settled → paid

        const statusRequiresAssigned = ['assigned', 'executing', 'verifying', 'settled', 'paid'].includes(mission.status);
        const statusRequiresExecuting = ['executing', 'verifying', 'settled', 'paid'].includes(mission.status);
        const statusRequiresVerifying = ['verifying', 'settled', 'paid'].includes(mission.status);
        const statusRequiresSettled = ['settled', 'paid'].includes(mission.status);
        const statusRequiresPaid = mission.status === 'paid';

        // Use posted_at as a base for synthetic timestamps
        const baseTime = mission.posted_at ? new Date(mission.posted_at) : now;

        if (statusRequiresAssigned && !mission.assigned_at) {
            // Check if assigned_agent has an assigned_at
            const agentAssignedAt = (typeof mission.assigned_agent === 'object' && mission.assigned_agent?.assigned_at)
                ? new Date(mission.assigned_agent.assigned_at)
                : null;
            updates.assigned_at = agentAssignedAt || new Date(baseTime.getTime() + 60000); // +1 min
            console.log(`  📌 ${mission.id}: backfill assigned_at`);
        }

        if (statusRequiresExecuting && !mission.executing_started_at && !mission.claimed_at) {
            const assignedAt = updates.assigned_at || mission.assigned_at || baseTime;
            updates.executing_started_at = new Date(new Date(assignedAt).getTime() + 60000); // +1 min after assigned
            console.log(`  📌 ${mission.id}: backfill executing_started_at`);
        }

        if (statusRequiresVerifying && !mission.verifying_started_at && !mission.submitted_at) {
            const execStartedAt = updates.executing_started_at || mission.executing_started_at || baseTime;
            updates.verifying_started_at = new Date(new Date(execStartedAt).getTime() + 60000); // +1 min after executing
            console.log(`  📌 ${mission.id}: backfill verifying_started_at`);
        }

        if (statusRequiresSettled && !mission.settled_at && !mission.verified_at) {
            const verifyingAt = updates.verifying_started_at || mission.verifying_started_at || baseTime;
            updates.settled_at = new Date(new Date(verifyingAt).getTime() + 60000); // +1 min after verifying
            console.log(`  📌 ${mission.id}: backfill settled_at`);
        }

        if (statusRequiresPaid && !mission.paid_at) {
            const settledAt = updates.settled_at || mission.settled_at || baseTime;
            updates.paid_at = new Date(new Date(settledAt).getTime() + 60000); // +1 min after settled
            console.log(`  📌 ${mission.id}: backfill paid_at`);
        }

        if (Object.keys(updates).length > 0) {
            // Use direct Object.assign to avoid re-triggering auto-timestamp logic
            const m = missionStore.get(mission.id);
            if (m) {
                Object.assign(m, updates);
                missionStore.update(mission.id, updates);
                fixed++;
                console.log(`  ✅ Fixed ${mission.id} (status: ${mission.status}) - ${Object.keys(updates).join(', ')}`);
            }
        } else {
            skipped++;
        }
    }

    console.log(`\n📊 Results:`);
    console.log(`  ✅ Fixed: ${fixed}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  📦 Total: ${allMissions.length}\n`);
}

backfillTimestamps();
