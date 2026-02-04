/**
 * Clawbot integration for AI-powered proposal reasoning
 * Uses Anthropic's Claude via Clawbot API
 */

import Anthropic from '@anthropic-ai/sdk';
import { ClawbotDecision, EvaluationContext } from '../types';
import { CLAWGER_SYSTEM_PROMPT, buildEvaluationPrompt } from '../../config/prompts';
import { CONSTRAINTS } from '../../config/constraints';
import { getLogPrefix } from '../../config/demo-config';

const logger = console;

export class ClawbotIntegration {
    private client: Anthropic;

    constructor(apiKey?: string) {
        this.client = new Anthropic({
            apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
        });
    }

    /**
     * Call Clawbot to evaluate a proposal
     */
    async evaluateProposal(context: EvaluationContext): Promise<ClawbotDecision> {
        const prefix = getLogPrefix();

        logger.info(`${prefix} Calling Clawbot for proposal evaluation...`);

        // Build evaluation prompt
        const userPrompt = buildEvaluationPrompt({
            treasury_total: context.treasury.total,
            treasury_available: context.treasury.available,
            treasury_allocated: context.treasury.allocated,
            current_exposure_percent: context.current_exposure_percent,
            recent_task_count: context.recent_performance.total_tasks,
            success_rate: context.recent_performance.success_rate * 100,
            total_profit: context.recent_performance.total_profit,
            total_losses: context.recent_performance.total_loss,
            net_pnl: context.recent_performance.net_pnl,
            trusted_workers: context.worker_availability.trusted,
            probation_workers: context.worker_availability.probation,
            avg_worker_success_rate: context.worker_availability.avg_success_rate * 100,
            objective: context.proposal.objective,
            budget: context.proposal.budget,
            deadline: context.proposal.deadline,
            risk_tolerance: context.proposal.risk_tolerance,
            constraints: context.proposal.constraints || [],
            max_exposure: CONSTRAINTS.MAX_TREASURY_EXPOSURE * 100,
            min_margin: CONSTRAINTS.MIN_MARGIN_PERCENT * 100,
            max_failure_rate: CONSTRAINTS.MAX_FAILURE_RATE * 100,
            min_workers: CONSTRAINTS.MIN_AVAILABLE_WORKERS,
        });

        try {
            const response = await this.client.messages.create({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 2000,
                system: CLAWGER_SYSTEM_PROMPT,
                messages: [
                    {
                        role: 'user',
                        content: userPrompt
                    }
                ],
            });

            // Extract JSON from response
            const content = response.content[0];
            if (content.type !== 'text') {
                throw new Error('Unexpected response type from Clawbot');
            }

            const decision = this.parseClawbotResponse(content.text);

            logger.info(`${prefix} Clawbot decision: ${decision.decision}`);
            logger.info(`${prefix} Risk assessment: ${decision.risk_assessment}`);
            logger.info(`${prefix} Feasibility: ${decision.feasibility}`);
            logger.info(`${prefix} Reasoning:`, decision.reasoning);

            return decision;

        } catch (error) {
            logger.error(`${prefix} Clawbot API error:`, error);

            // Fallback to conservative decision
            return this.conservativeFallback(context);
        }
    }

    /**
     * Parse Clawbot's JSON response
     */
    private parseClawbotResponse(text: string): ClawbotDecision {
        // Extract JSON from markdown code blocks if present
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
        const jsonText = jsonMatch ? jsonMatch[1] : text;

        try {
            const parsed = JSON.parse(jsonText);

            // Validate structure
            if (!parsed.decision || !parsed.reasoning || !parsed.risk_assessment) {
                throw new Error('Invalid Clawbot response structure');
            }

            return {
                risk_assessment: parsed.risk_assessment,
                feasibility: parsed.feasibility,
                estimated_cost: parsed.estimated_cost,
                expected_margin: parsed.expected_margin,
                decision: parsed.decision,
                reasoning: parsed.reasoning,
                counter_terms: parsed.counter_terms,
            };

        } catch (error) {
            logger.error('Failed to parse Clawbot response:', error);
            logger.error('Raw response:', text);
            throw new Error('Failed to parse Clawbot decision');
        }
    }

    /**
     * Conservative fallback if Clawbot fails
     */
    private conservativeFallback(context: EvaluationContext): ClawbotDecision {
        const prefix = getLogPrefix();
        logger.warn(`${prefix} Using conservative fallback decision`);

        // Default to REJECT with conservative reasoning
        return {
            risk_assessment: 'high',
            feasibility: 'impossible',
            estimated_cost: context.proposal.budget,
            expected_margin: '0',
            decision: 'REJECT',
            reasoning: [
                'Clawbot reasoning unavailable',
                'Defaulting to conservative rejection',
                'System protection mode activated'
            ]
        };
    }
}
