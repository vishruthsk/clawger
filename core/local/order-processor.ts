/**
 * Order Processor
 * Handles direct orders in LOCAL mode (no negotiation)
 */

import { Order } from '../types';
import { getLogPrefix } from '../../config/demo-config';

const logger = console;

export class OrderProcessor {
    private orders: Map<string, Order> = new Map();
    private orderCounter = 0;

    /**
     * Submit an order (LOCAL mode only)
     */
    submitOrder(
        operator: string,
        objective: string,
        priority: 'low' | 'medium' | 'high' = 'medium',
        timeout: number = 300000, // 5 minutes default
        constraints?: string[]
    ): Order {
        const prefix = getLogPrefix();

        this.orderCounter++;
        const orderId = `ORDER-${Date.now()}-${this.orderCounter}`;

        const order: Order = {
            id: orderId,
            operator,
            objective,
            priority,
            timeout,
            constraints,
            createdAt: new Date(),
            status: 'pending'
        };

        this.orders.set(orderId, order);

        logger.info(`${prefix} ========================================`);
        logger.info(`${prefix} [LOCAL] ORDER RECEIVED`);
        logger.info(`${prefix} ========================================`);
        logger.info(`${prefix} Order ID: ${orderId}`);
        logger.info(`${prefix} Operator: ${operator}`);
        logger.info(`${prefix} Objective: ${objective}`);
        logger.info(`${prefix} Priority: ${priority}`);
        logger.info(`${prefix} Timeout: ${timeout}ms`);
        if (constraints) {
            logger.info(`${prefix} Constraints: ${constraints.join(', ')}`);
        }
        logger.info(`${prefix} ========================================`);

        return order;
    }

    /**
     * Get order by ID
     */
    getOrder(orderId: string): Order | null {
        return this.orders.get(orderId) || null;
    }

    /**
     * Update order status
     */
    updateStatus(
        orderId: string,
        status: Order['status']
    ): void {
        const prefix = getLogPrefix();
        const order = this.orders.get(orderId);

        if (!order) {
            throw new Error(`Order not found: ${orderId}`);
        }

        const oldStatus = order.status;
        order.status = status;

        logger.info(`${prefix} [LOCAL] Order ${orderId}: ${oldStatus} → ${status}`);
    }

    /**
     * Get all orders
     */
    getAllOrders(): Order[] {
        return Array.from(this.orders.values());
    }

    /**
     * Get pending orders
     */
    getPendingOrders(): Order[] {
        return Array.from(this.orders.values()).filter(
            order => order.status === 'pending'
        );
    }

    /**
     * Get orders by status
     */
    getOrdersByStatus(status: Order['status']): Order[] {
        return Array.from(this.orders.values()).filter(
            order => order.status === status
        );
    }

    /**
     * Check if order has timed out
     */
    isTimedOut(orderId: string): boolean {
        const order = this.orders.get(orderId);
        if (!order) return false;

        const elapsed = Date.now() - order.createdAt.getTime();
        return elapsed > order.timeout;
    }

    /**
     * Get order statistics
     */
    getStatistics(): {
        total: number;
        pending: number;
        assigned: number;
        executing: number;
        completed: number;
        failed: number;
    } {
        const orders = Array.from(this.orders.values());

        return {
            total: orders.length,
            pending: orders.filter(o => o.status === 'pending').length,
            assigned: orders.filter(o => o.status === 'assigned').length,
            executing: orders.filter(o => o.status === 'executing').length,
            completed: orders.filter(o => o.status === 'completed').length,
            failed: orders.filter(o => o.status === 'failed').length,
        };
    }
}
