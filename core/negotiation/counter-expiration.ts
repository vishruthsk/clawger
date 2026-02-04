/**
 * Counter-offer expiration manager
 * Handles time-bound counter-offers with automatic expiration
 */

import { Proposal } from '../types';
import { CONSTRAINTS } from '../../config/constraints';
import { DEMO_CONFIG, getLogPrefix } from '../../config/demo-config';

const logger = console;

export type ExpirationCallback = (proposalId: string) => void;

export class CounterExpiration {
    private timers: Map<string, NodeJS.Timeout> = new Map();
    private expirationCallbacks: ExpirationCallback[] = [];

    /**
     * Register callback for when counter-offers expire
     */
    onExpiration(callback: ExpirationCallback): void {
        this.expirationCallbacks.push(callback);
    }

    /**
     * Start expiration timer for a counter-offer
     */
    startTimer(proposalId: string, expirationDate: Date): void {
        const prefix = getLogPrefix();

        // Clear existing timer if any
        this.clearTimer(proposalId);

        const now = new Date();
        const timeUntilExpiration = expirationDate.getTime() - now.getTime();

        if (timeUntilExpiration <= 0) {
            // Already expired
            logger.warn(`${prefix} Counter-offer ${proposalId} already expired`);
            this.handleExpiration(proposalId);
            return;
        }

        const minutes = Math.round(timeUntilExpiration / 1000 / 60);
        logger.info(`${prefix} Counter-offer ${proposalId} will expire in ${minutes} minutes`);

        const timer = setTimeout(() => {
            this.handleExpiration(proposalId);
        }, timeUntilExpiration);

        this.timers.set(proposalId, timer);
    }

    /**
     * Clear timer for a proposal (e.g., when accepted or rejected)
     */
    clearTimer(proposalId: string): void {
        const timer = this.timers.get(proposalId);
        if (timer) {
            clearTimeout(timer);
            this.timers.delete(proposalId);
        }
    }

    /**
     * Handle counter-offer expiration
     */
    private handleExpiration(proposalId: string): void {
        const prefix = getLogPrefix();

        logger.info(`${prefix} COUNTER-OFFER EXPIRED: ${proposalId}`);

        // Remove timer
        this.timers.delete(proposalId);

        // Notify all callbacks
        for (const callback of this.expirationCallbacks) {
            try {
                callback(proposalId);
            } catch (error) {
                logger.error(`${prefix} Error in expiration callback:`, error);
            }
        }
    }

    /**
     * Check if a counter-offer has expired
     */
    isExpired(expirationDate: Date): boolean {
        return new Date() >= expirationDate;
    }

    /**
     * Get time remaining until expiration
     */
    getTimeRemaining(expirationDate: Date): {
        expired: boolean;
        milliseconds: number;
        minutes: number;
        seconds: number;
    } {
        const now = new Date();
        const remaining = expirationDate.getTime() - now.getTime();

        if (remaining <= 0) {
            return {
                expired: true,
                milliseconds: 0,
                minutes: 0,
                seconds: 0
            };
        }

        return {
            expired: false,
            milliseconds: remaining,
            minutes: Math.floor(remaining / 1000 / 60),
            seconds: Math.floor((remaining / 1000) % 60)
        };
    }

    /**
     * Calculate expiration date for a new counter-offer
     */
    static calculateExpiration(): Date {
        const ttl = DEMO_CONFIG.counterOfferTTL || CONSTRAINTS.COUNTER_OFFER_TTL_MS;
        return new Date(Date.now() + ttl);
    }

    /**
     * Get active timers count
     */
    getActiveTimersCount(): number {
        return this.timers.size;
    }

    /**
     * Clear all timers (for shutdown)
     */
    clearAll(): void {
        for (const timer of this.timers.values()) {
            clearTimeout(timer);
        }
        this.timers.clear();
    }
}
