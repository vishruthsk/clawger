/**
 * Event Bus
 * Append-only event model for contract lifecycle
 */

import { ContractLifecycleState } from './lifecycle';
import { getLogPrefix } from '../../config/demo-config';

const logger = console;

export type ContractEventType =
    | 'CONTRACT_CREATED'      // Proposal submitted
    | 'PRICED'                // Pricing complete
    | 'ACCEPTED'              // Proposer accepted
    | 'REJECTED'              // Proposer rejected or system rejected
    | 'EXECUTION_STARTED'     // Worker started
    | 'WORK_REASSIGNED'       // Worker failed, reassigned
    | 'WORK_SUBMITTED'        // Worker submitted result
    | 'VERIFIED'              // Verification complete
    | 'COMPLETED'             // Contract completed successfully
    | 'FAILED'                // Contract failed
    | 'TIMEOUT';              // Contract timed out

export interface ContractEventData {
    event_id: string;
    contract_id: string;
    event_type: ContractEventType;
    timestamp: Date;
    from_state: ContractLifecycleState;
    to_state: ContractLifecycleState;
    metadata: Record<string, any>;
}

export interface EventFilter {
    contract_id?: string;
    event_type?: ContractEventType[];
    after?: Date;
    before?: Date;
}

export type EventCallback = (event: ContractEventData) => void;

export interface Subscription {
    id: string;
    unsubscribe: () => void;
}

/**
 * Event Bus for contract lifecycle events
 */
export class EventBus {
    private events: ContractEventData[] = [];
    private subscribers: Map<string, EventCallback> = new Map();
    private eventIndex: Map<string, ContractEventData[]> = new Map();  // Index by contract_id

    /**
     * Emit an event
     */
    emit(
        contractId: string,
        eventType: ContractEventType,
        fromState: ContractLifecycleState,
        toState: ContractLifecycleState,
        metadata: Record<string, any> = {}
    ): ContractEventData {
        const prefix = getLogPrefix();

        const event: ContractEventData = {
            event_id: `EVT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            contract_id: contractId,
            event_type: eventType,
            timestamp: new Date(),
            from_state: fromState,
            to_state: toState,
            metadata: metadata
        };

        // Append to event log (immutable)
        this.events.push(event);

        // Update index
        if (!this.eventIndex.has(contractId)) {
            this.eventIndex.set(contractId, []);
        }
        this.eventIndex.get(contractId)!.push(event);

        logger.info(`${prefix} [EVENT] ${eventType}: ${contractId} (${fromState} → ${toState})`);

        // Notify subscribers
        this.notifySubscribers(event);

        return event;
    }

    /**
     * Get all events for a contract
     */
    getContractEvents(contractId: string): ContractEventData[] {
        return this.eventIndex.get(contractId) || [];
    }

    /**
     * Get all events (with optional filter)
     */
    getEvents(filter?: EventFilter): ContractEventData[] {
        let filtered = [...this.events];

        if (filter) {
            if (filter.contract_id) {
                filtered = filtered.filter(e => e.contract_id === filter.contract_id);
            }

            if (filter.event_type && filter.event_type.length > 0) {
                filtered = filtered.filter(e => filter.event_type!.includes(e.event_type));
            }

            if (filter.after) {
                filtered = filtered.filter(e => e.timestamp >= filter.after!);
            }

            if (filter.before) {
                filtered = filtered.filter(e => e.timestamp <= filter.before!);
            }
        }

        return filtered;
    }

    /**
     * Get event by ID
     */
    getEvent(eventId: string): ContractEventData | null {
        return this.events.find(e => e.event_id === eventId) || null;
    }

    /**
     * Subscribe to events
     */
    subscribe(callback: EventCallback, filter?: EventFilter): Subscription {
        const subscriptionId = `SUB-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Wrap callback with filter
        const wrappedCallback: EventCallback = (event) => {
            if (this.matchesFilter(event, filter)) {
                callback(event);
            }
        };

        this.subscribers.set(subscriptionId, wrappedCallback);

        return {
            id: subscriptionId,
            unsubscribe: () => {
                this.subscribers.delete(subscriptionId);
            }
        };
    }

    /**
     * Check if event matches filter
     */
    private matchesFilter(event: ContractEventData, filter?: EventFilter): boolean {
        if (!filter) return true;

        if (filter.contract_id && event.contract_id !== filter.contract_id) {
            return false;
        }

        if (filter.event_type && !filter.event_type.includes(event.event_type)) {
            return false;
        }

        if (filter.after && event.timestamp < filter.after) {
            return false;
        }

        if (filter.before && event.timestamp > filter.before) {
            return false;
        }

        return true;
    }

    /**
     * Notify all subscribers
     */
    private notifySubscribers(event: ContractEventData): void {
        for (const callback of this.subscribers.values()) {
            try {
                callback(event);
            } catch (error) {
                logger.error(`[EVENT] Subscriber error:`, error);
            }
        }
    }

    /**
     * Get event statistics
     */
    getStats(): {
        total: number;
        by_type: Record<ContractEventType, number>;
        by_contract: Record<string, number>;
        subscribers: number;
    } {
        const by_type: Record<string, number> = {};
        const by_contract: Record<string, number> = {};

        for (const event of this.events) {
            by_type[event.event_type] = (by_type[event.event_type] || 0) + 1;
            by_contract[event.contract_id] = (by_contract[event.contract_id] || 0) + 1;
        }

        return {
            total: this.events.length,
            by_type: by_type as Record<ContractEventType, number>,
            by_contract,
            subscribers: this.subscribers.size
        };
    }

    /**
     * Clear all events (for testing only)
     */
    clear(): void {
        this.events = [];
        this.eventIndex.clear();
    }
}

// Singleton instance
export const eventBus = new EventBus();
