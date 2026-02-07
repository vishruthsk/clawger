/**
 * Assignment Engine
 * 
 * Matches AVAILABLE agents with PENDING assignments.
 * Unlike the Proposal/Negotiation flow (Human <-> Protocol),
 * this handles the Task <-> Worker assignment logic.
 */

import { AgentRegistry } from './agent-registry';
import { PublicAPI } from '../api/public-api';
import { AgentAuth } from './agent-auth';

export interface PendingAssignment {
    taskId: string;
    contractId: string;
    objective: string;
    budget: string;
    deadline: Date;
    risk_tolerance: 'low' | 'medium' | 'high';
    requiredCapabilities: string[];
    status: 'open' | 'assigned';
    assignedTo?: string; // Worker Address
}

import { TaskQueue } from '../tasks/task-queue';
import { RegisteredAgent } from './agent-registry';

export class AssignmentEngine {
    private assignments: Map<string, PendingAssignment> = new Map();
    private taskQueue: TaskQueue = new TaskQueue();
    private registry: AgentRegistry;
    private publicAPI: PublicAPI;
    private isRunning: boolean = false;

    constructor(registry: AgentRegistry, publicAPI: PublicAPI) {
        this.registry = registry;
        this.publicAPI = publicAPI;
    }

    /**
     * Add a task to the assignment pool
     * Called when a Contract enters EXECUTING state but needs a worker
     */
    queueAssignment(task: PendingAssignment) {
        console.log(`[AssignmentEngine] Queueing task ${task.taskId} for contract ${task.contractId}`);
        this.assignments.set(task.taskId, task);

        // If it's a direct hire, we don't put it in the public poll queue
        // We just keep it in assignments map to be retrieved by ID
        // But for this MVP, let's treat direct hires as "reserved" tasks if needed.
        // For now, if no assignedTo is pre-set, it goes to queue.
        if (!task.assignedTo) {
            this.taskQueue.enqueue(task);
        }
    }

    /**
     * POLL for assignments (Worker Agent View)
     */
    async pollForAssignment(agentAddress: string, agentCapabilities: string[], minFee: string): Promise<PendingAssignment | null> {
        // 1. Check for Direct Hires (Reserved)
        for (const task of this.assignments.values()) {
            if (task.status === 'open' && task.assignedTo === agentAddress) {
                return task;
            }
        }

        // 2. Poll Public Queue
        return this.taskQueue.poll(agentCapabilities, minFee);
    }

    /**
     * Agent accepting an assignment
     */
    async acceptAssignment(taskId: string, agentAddress: string): Promise<boolean> {
        const task = this.assignments.get(taskId);
        if (!task || task.status !== 'open') return false;

        // Verify agent
        const agent = await this.registry.getAgent(agentAddress);
        if (!agent || !agent.active) return false;

        // Verify eligibility if not direct hire
        if (task.assignedTo && task.assignedTo !== agentAddress) {
            return false; // Assigned to someone else
        }

        // Lock it
        task.status = 'assigned';
        task.assignedTo = agentAddress;
        this.assignments.set(taskId, task);
        this.taskQueue.remove(taskId);

        console.log(`[AssignmentEngine] Task ${taskId} assigned to ${agentAddress}`);

        // Select Verifiers
        const verifiers = await this.selectVerifiers(task.risk_tolerance, agentAddress);

        // Notify Core / PublicAPI
        await this.publicAPI.transitionState(
            task.contractId,
            'EXECUTING',
            'EXECUTION_STARTED',
            {
                worker: agentAddress,
                verifiers: verifiers
            }
        );

        // Update contract with participants
        const contract = await this.publicAPI.getContract(task.contractId);
        if (contract) {
            contract.worker = agentAddress;
            contract.verifiers = verifiers;
        }

        return true;
    }

    /**
     * Submit Result
     */
    async submitResult(taskId: string, result: string): Promise<boolean> {
        const task = this.assignments.get(taskId);
        if (!task) return false;

        console.log(`[AssignmentEngine] Result submitted for ${taskId}`);

        // Transition to VERIFYING
        await this.publicAPI.transitionState(
            task.contractId,
            'VERIFYING',
            'WORK_SUBMITTED',
            { result }
        );

        const contract = await this.publicAPI.getContract(task.contractId);
        if (contract) {
            contract.work_result = result;
        }

        return true;
    }

    /**
     * Select Verifiers based on Risk Tolerance
     */
    private async selectVerifiers(risk: 'low' | 'medium' | 'high', excludeWorker: string): Promise<string[]> {
        const allVerifiers = await this.registry.queryVerifiers();
        const candidates = allVerifiers.filter((v: RegisteredAgent) => v.address !== excludeWorker && v.active);

        let count = 1;
        if (risk === 'low') count = 3;
        if (risk === 'medium') count = 2; // or 1 robust

        // Simple random selection for now
        // In prod: perform weighted selector based on reputation
        const selected = candidates
            .sort(() => 0.5 - Math.random())
            .slice(0, count)
            .map(v => v.address);

        return selected;
    }

    getTask(taskId: string): PendingAssignment | undefined {
        return this.assignments.get(taskId);
    }

    getTaskByContractId(contractId: string): PendingAssignment | undefined {
        for (const task of this.assignments.values()) {
            if (task.contractId === contractId) {
                return task;
            }
        }
        return undefined;
    }
}
