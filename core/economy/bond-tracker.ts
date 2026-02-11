/**
 * Bond Tracker
 * Tracks active worker bonds and verifier bonds.
 * 
 * Bonds are staked by:
 * - Workers: Before executing a mission
 * - Verifiers: During verification voting
 */

import * as fs from 'fs';
import * as path from 'path';

interface BondRecord {
    agentId: string;
    amount: number;
    missionId: string;
    type: 'worker' | 'verifier';
    lockedAt: Date;
}

export class BondTracker {
    private bonds: Map<string, BondRecord[]> = new Map(); // agentId -> bonds
    private persistencePath: string;

    constructor(dataPath: string = './data') {
        this.persistencePath = path.join(dataPath, 'bonds.json');
        this.load();
    }

    /**
     * Lock a bond for an agent
     * @param agentId - Agent ID
     * @param amount - Bond amount in CLAWGER
     * @param missionId - Mission ID
     * @param type - Bond type (worker or verifier)
     */
    lockBond(agentId: string, amount: number, missionId: string, type: 'worker' | 'verifier'): void {
        if (!this.bonds.has(agentId)) {
            this.bonds.set(agentId, []);
        }

        const bond: BondRecord = {
            agentId,
            amount,
            missionId,
            type,
            lockedAt: new Date()
        };

        this.bonds.get(agentId)!.push(bond);
        this.save();
    }

    /**
     * Release a bond for a specific mission
     * @param agentId - Agent ID
     * @param missionId - Mission ID
     */
    releaseBond(agentId: string, missionId: string): void {
        if (!this.bonds.has(agentId)) {
            return;
        }

        const agentBonds = this.bonds.get(agentId)!;
        const updatedBonds = agentBonds.filter(b => b.missionId !== missionId);

        if (updatedBonds.length === 0) {
            this.bonds.delete(agentId);
        } else {
            this.bonds.set(agentId, updatedBonds);
        }

        this.save();
    }

    /**
     * Get total active bond amount for an agent
     * @param agentId - Agent ID
     * @returns Total bond amount
     */
    getActiveBond(agentId: string): number {
        if (!this.bonds.has(agentId)) {
            return 0;
        }

        return this.bonds.get(agentId)!
            .reduce((sum, bond) => sum + bond.amount, 0);
    }

    /**
     * Get missions with locked bonds
     * @param agentId - Agent ID
     * @returns Array of mission IDs
     */
    getBondLockedMissions(agentId: string): string[] {
        if (!this.bonds.has(agentId)) {
            return [];
        }

        return this.bonds.get(agentId)!.map(b => b.missionId);
    }

    /**
     * Get bond details for an agent
     * @param agentId - Agent ID
     * @returns Array of bond records
     */
    getBondDetails(agentId: string): BondRecord[] {
        return this.bonds.get(agentId) || [];
    }

    /**
     * Check if agent has any active bonds
     * @param agentId - Agent ID
     * @returns True if agent has active bonds
     */
    hasBonds(agentId: string): boolean {
        return this.bonds.has(agentId) && this.bonds.get(agentId)!.length > 0;
    }

    /**
     * Clear all bonds (for testing/reset)
     */
    clearAll(): void {
        this.bonds.clear();
        this.save();
    }

    private save(): void {
        if (!fs.existsSync(path.dirname(this.persistencePath))) {
            fs.mkdirSync(path.dirname(this.persistencePath), { recursive: true });
        }

        const data = Array.from(this.bonds.entries());
        fs.writeFileSync(this.persistencePath, JSON.stringify(data, null, 2));
    }

    private load(): void {
        if (fs.existsSync(this.persistencePath)) {
            try {
                const raw = fs.readFileSync(this.persistencePath, 'utf8');
                const data = JSON.parse(raw);
                this.bonds = new Map(data);

                // Fix dates from JSON
                for (const [agentId, bonds] of this.bonds.entries()) {
                    for (const bond of bonds) {
                        (bond as any).lockedAt = new Date((bond as any).lockedAt);
                    }
                }
            } catch (e) {
                console.error('[BondTracker] Failed to load bonds', e);
            }
        }
    }
}
