/**
 * Agent Registry Interface
 * TypeScript interface to AgentRegistry smart contract
 */

import { ethers } from 'ethers';
import { RegisteredAgent, AgentType, AgentRegistration } from '../types';
export type { RegisteredAgent, AgentRegistration };
import { getLogPrefix } from '../../config/demo-config';

const logger = console;

// ABI for AgentRegistry contract (simplified)
const AGENT_REGISTRY_ABI = [
    'function registerAgent(uint8 agentType, string[] capabilities, uint256 minFee, uint256 minBond, address operator)',
    'function getAgent(address agent) view returns (tuple(address wallet, uint8 agentType, string[] capabilities, uint256 minFee, uint256 minBond, address operator, uint256 reputation, bool active, uint256 registeredAt))',
    'function queryWorkers(uint256 minReputation) view returns (address[])',
    'function queryVerifiers(uint256 minReputation) view returns (address[])',
    'function isActive(address agent) view returns (bool)',
    'function updateReputation(address agent, uint256 newReputation)',
    'function getCapabilities(address agent) view returns (string[])',
    'function hasCapability(address agent, string capability) view returns (bool)',
];

export class AgentRegistry {
    private contract: ethers.Contract | null = null;
    private mockAgents: Map<string, RegisteredAgent> = new Map();
    private useMock: boolean;

    constructor(
        contractAddress?: string,
        provider?: ethers.Provider,
        useMock: boolean = true
    ) {
        this.useMock = useMock;

        if (!useMock && contractAddress && provider) {
            this.contract = new ethers.Contract(
                contractAddress,
                AGENT_REGISTRY_ABI,
                provider
            );
        } else {
            // Initialize with mock agents for demo
            this.initializeMockAgents();
        }
    }

    /**
     * Initialize mock agents for demo/testing
     */
    private initializeMockAgents(): void {
        // Mock workers
        this.mockAgents.set('0x1111111111111111111111111111111111111111', {
            address: '0x1111111111111111111111111111111111111111',
            type: 'worker',
            capabilities: ['data-processing', 'verification'],
            minFee: '0.1',
            minBond: '0.5',
            reputation: 85,
            active: true,
            registeredAt: new Date('2026-01-01')
        });

        this.mockAgents.set('0x2222222222222222222222222222222222222222', {
            address: '0x2222222222222222222222222222222222222222',
            type: 'worker',
            capabilities: ['data-processing', 'computation'],
            minFee: '0.15',
            minBond: '0.3',
            reputation: 65,
            active: true,
            registeredAt: new Date('2026-01-05')
        });

        // Mock verifiers
        this.mockAgents.set('0x3333333333333333333333333333333333333333', {
            address: '0x3333333333333333333333333333333333333333',
            type: 'verifier',
            capabilities: ['verification', 'audit'],
            minFee: '0.05',
            minBond: '0.2',
            reputation: 90,
            active: true,
            registeredAt: new Date('2026-01-02')
        });

        this.mockAgents.set('0x4444444444444444444444444444444444444444', {
            address: '0x4444444444444444444444444444444444444444',
            type: 'verifier',
            capabilities: ['verification', 'compliance'],
            minFee: '0.08',
            minBond: '0.25',
            reputation: 75,
            active: true,
            registeredAt: new Date('2026-01-03')
        });

        this.mockAgents.set('0x5555555555555555555555555555555555555555', {
            address: '0x5555555555555555555555555555555555555555',
            type: 'verifier',
            capabilities: ['verification'],
            minFee: '0.06',
            minBond: '0.15',
            reputation: 80,
            active: true,
            registeredAt: new Date('2026-01-04')
        });
    }

    /**
     * Register a new agent
     */
    async registerAgent(
        registration: AgentRegistration,
        signer?: ethers.Signer
    ): Promise<string> {
        const prefix = getLogPrefix();

        if (this.useMock) {
            const address = this.generateMockAddress();

            this.mockAgents.set(address, {
                address,
                type: registration.type,
                capabilities: registration.capabilities,
                minFee: registration.minFee,
                minBond: registration.minBond,
                operator: registration.operator,
                reputation: 50, // Start at neutral
                active: true,
                registeredAt: new Date()
            });

            logger.info(`${prefix} Agent registered: ${address} (${registration.type})`);
            return address;
        }

        // Real on-chain registration
        if (!this.contract || !signer) {
            throw new Error('Contract or signer not available');
        }

        const agentTypeEnum = registration.type === 'worker' ? 0 : 1;

        const tx = await (this.contract.connect(signer) as any).registerAgent(
            agentTypeEnum,
            registration.capabilities,
            ethers.parseEther(registration.minFee),
            ethers.parseEther(registration.minBond),
            registration.operator || ethers.ZeroAddress
        );

        await tx.wait();

        return await signer.getAddress();
    }

    /**
     * Query workers by minimum reputation
     */
    async queryWorkers(minReputation: number = 0): Promise<RegisteredAgent[]> {
        if (this.useMock) {
            return Array.from(this.mockAgents.values()).filter(
                agent => agent.type === 'worker' &&
                    agent.active &&
                    agent.reputation >= minReputation
            );
        }

        if (!this.contract) {
            throw new Error('Contract not available');
        }

        const addresses = await (this.contract as any).queryWorkers(minReputation);
        return Promise.all(addresses.map((addr: string) => this.getAgent(addr)));
    }

    /**
     * Query verifiers by minimum reputation
     */
    async queryVerifiers(minReputation: number = 0): Promise<RegisteredAgent[]> {
        if (this.useMock) {
            return Array.from(this.mockAgents.values()).filter(
                agent => agent.type === 'verifier' &&
                    agent.active &&
                    agent.reputation >= minReputation
            );
        }

        if (!this.contract) {
            throw new Error('Contract not available');
        }

        const addresses = await (this.contract as any).queryVerifiers(minReputation);
        return Promise.all(addresses.map((addr: string) => this.getAgent(addr)));
    }

    /**
     * Get agent details
     */
    async getAgent(address: string): Promise<RegisteredAgent> {
        if (this.useMock) {
            const agent = this.mockAgents.get(address);
            if (!agent) {
                throw new Error(`Agent not found: ${address}`);
            }
            return agent;
        }

        if (!this.contract) {
            throw new Error('Contract not available');
        }

        const agentData = await (this.contract as any).getAgent(address);

        return {
            address: agentData.wallet,
            type: agentData.agentType === 0 ? 'worker' : 'verifier',
            capabilities: agentData.capabilities,
            minFee: ethers.formatEther(agentData.minFee),
            minBond: ethers.formatEther(agentData.minBond),
            operator: agentData.operator !== ethers.ZeroAddress ? agentData.operator : undefined,
            reputation: Number(agentData.reputation),
            active: agentData.active,
            registeredAt: new Date(Number(agentData.registeredAt) * 1000)
        };
    }

    /**
     * Update agent reputation
     */
    async updateReputation(
        address: string,
        newReputation: number,
        signer?: ethers.Signer
    ): Promise<void> {
        const prefix = getLogPrefix();

        // Cap at 0-100
        newReputation = Math.max(0, Math.min(100, newReputation));

        if (this.useMock) {
            const agent = this.mockAgents.get(address);
            if (agent) {
                const oldRep = agent.reputation;
                agent.reputation = newReputation;
                logger.info(`${prefix} Reputation updated: ${address} ${oldRep} → ${newReputation}`);
            }
            return;
        }

        if (!this.contract || !signer) {
            throw new Error('Contract or signer not available');
        }

        const tx = await (this.contract.connect(signer) as any).updateReputation(address, newReputation);
        await tx.wait();
    }

    /**
     * Check if agent has specific capability
     */
    async hasCapability(address: string, capability: string): Promise<boolean> {
        if (this.useMock) {
            const agent = this.mockAgents.get(address);
            return agent?.capabilities.includes(capability) || false;
        }

        if (!this.contract) {
            throw new Error('Contract not available');
        }

        return await (this.contract as any).hasCapability(address, capability);
    }

    /**
     * Generate mock address for testing
     */
    private generateMockAddress(): string {
        const random = Math.floor(Math.random() * 0xffffffffffff);
        return `0x${random.toString(16).padStart(40, '0')}`;
    }
}
