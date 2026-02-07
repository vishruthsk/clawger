/**
 * Public Contract API
 * External interface for interacting with CLAWGER
 */

import { Identity } from '../identity/identity';
import { authorize, requireAuthorization } from '../identity/authority';
import { ContractLifecycleState, validateTransition, isTerminalState } from './lifecycle';
import { eventBus, ContractEventData, ContractEventType, EventFilter, Subscription } from './event-bus';
import { getLogPrefix } from '../../config/demo-config';

const logger = console;

export interface ProposalRequest {
    objective: string;
    budget: string;
    deadline: Date;
    risk_tolerance?: 'low' | 'medium' | 'high';
    constraints?: string[];
    max_retries?: number;
}

export interface Contract {
    contract_id: string;
    proposal_id: string;
    state: ContractLifecycleState;

    // Proposal details
    objective: string;
    budget: string;
    deadline: Date;
    risk_tolerance: 'low' | 'medium' | 'high';
    constraints: string[];
    max_retries: number;

    // Participants
    proposer: string;
    worker?: string;
    verifiers?: string[];

    // Timestamps
    created_at: Date;
    updated_at: Date;
    completed_at?: Date;

    // Results
    work_result?: string;
    verification_result?: boolean;
    failure_reason?: string;
}

export interface ContractFilter {
    state?: ContractLifecycleState[];
    proposer?: string;
    worker?: string;
    created_after?: Date;
    created_before?: Date;
}

/**
 * Public API for CLAWGER contracts
 */
export class PublicAPI {
    private contracts: Map<string, Contract> = new Map();

    /**
     * Submit a new proposal
     */
    async submitProposal(
        identity: Identity,
        request: ProposalRequest
    ): Promise<Contract> {
        const prefix = getLogPrefix();

        // Authorization check
        requireAuthorization(identity, 'submit_contract');

        // Create contract
        const contractId = `CONTRACT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const proposalId = `PROPOSAL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const contract: Contract = {
            contract_id: contractId,
            proposal_id: proposalId,
            state: 'PROPOSED',
            objective: request.objective,
            budget: request.budget,
            deadline: request.deadline,
            risk_tolerance: request.risk_tolerance || 'low',
            constraints: request.constraints || [],
            max_retries: request.max_retries || 1,
            proposer: identity.type === 'HUMAN' ? identity.wallet_address :
                identity.type === 'AI_AGENT' ? identity.agent_id :
                    identity.component,
            created_at: new Date(),
            updated_at: new Date()
        };

        this.contracts.set(contractId, contract);

        // Emit event
        eventBus.emit(
            contractId,
            'CONTRACT_CREATED',
            'PROPOSED',  // Initial state
            'PROPOSED',
            {
                proposer: contract.proposer,
                objective: contract.objective,
                budget: contract.budget
            }
        );

        logger.info(`${prefix} ========================================`);
        logger.info(`${prefix} CONTRACT CREATED`);
        logger.info(`${prefix} ========================================`);
        logger.info(`${prefix} Contract ID: ${contractId}`);
        logger.info(`${prefix} Proposer: ${contract.proposer}`);
        logger.info(`${prefix} Objective: ${contract.objective}`);
        logger.info(`${prefix} Budget: ${contract.budget}`);
        logger.info(`${prefix} State: ${contract.state}`);
        logger.info(`${prefix} ========================================\n`);

        return contract;
    }

    /**
     * Get contract by ID
     */
    async getContract(contractId: string): Promise<Contract | null> {
        return this.contracts.get(contractId) || null;
    }

    /**
     * List contracts with filters
     */
    async listContracts(filter?: ContractFilter): Promise<Contract[]> {
        let contracts = Array.from(this.contracts.values());

        if (filter) {
            if (filter.state && filter.state.length > 0) {
                contracts = contracts.filter(c => filter.state!.includes(c.state));
            }

            if (filter.proposer) {
                contracts = contracts.filter(c => c.proposer === filter.proposer);
            }

            if (filter.worker) {
                contracts = contracts.filter(c => c.worker === filter.worker);
            }

            if (filter.created_after) {
                contracts = contracts.filter(c => c.created_at >= filter.created_after!);
            }

            if (filter.created_before) {
                contracts = contracts.filter(c => c.created_at <= filter.created_before!);
            }
        }

        return contracts;
    }

    /**
     * Get contract event history
     */
    async getContractHistory(contractId: string): Promise<ContractEventData[]> {
        return eventBus.getContractEvents(contractId);
    }

    /**
     * Subscribe to contract events
     */
    subscribeToEvents(
        callback: (event: ContractEventData) => void,
        filter?: EventFilter
    ): Subscription {
        return eventBus.subscribe(callback, filter);
    }

    /**
     * Transition contract state (internal use)
     */
    async transitionState(
        contractId: string,
        toState: ContractLifecycleState,
        eventType: ContractEventType,
        metadata: Record<string, any> = {}
    ): Promise<void> {
        const contract = this.contracts.get(contractId);

        if (!contract) {
            throw new Error(`Contract not found: ${contractId}`);
        }

        const fromState = contract.state;

        // Validate transition
        validateTransition(contractId, fromState, toState);

        // Update state
        contract.state = toState;
        contract.updated_at = new Date();

        if (isTerminalState(toState)) {
            contract.completed_at = new Date();
        }

        // Emit event
        eventBus.emit(contractId, eventType, fromState, toState, metadata);
    }

    /**
     * Get API statistics
     */
    getStats(): {
        total_contracts: number;
        by_state: Record<ContractLifecycleState, number>;
        total_events: number;
    } {
        const by_state: Record<string, number> = {};

        for (const contract of this.contracts.values()) {
            by_state[contract.state] = (by_state[contract.state] || 0) + 1;
        }

        return {
            total_contracts: this.contracts.size,
            by_state: by_state as Record<ContractLifecycleState, number>,
            total_events: eventBus.getStats().total
        };
    }
}

// Singleton instance
export const publicAPI = new PublicAPI();
