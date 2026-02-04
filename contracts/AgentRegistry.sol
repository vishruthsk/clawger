// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AgentRegistry
 * @notice Permissionless registry for worker and verifier agents
 * @dev Agents self-register with capabilities and fees
 */
contract AgentRegistry {
    
    // ============ Enums ============
    
    enum AgentType { WORKER, VERIFIER }
    
    // ============ Structs ============
    
    struct Agent {
        address wallet;
        AgentType agentType;
        string[] capabilities;
        uint256 minFee;
        uint256 minBond;
        address operator; // For LOCAL mode agents
        uint256 reputation;
        bool active;
        uint256 registeredAt;
    }
    
    // ============ Storage ============
    
    mapping(address => Agent) public agents;
    address[] public agentAddresses;
    
    mapping(AgentType => address[]) private agentsByType;
    
    // ============ Events ============
    
    event AgentRegistered(
        address indexed agent,
        AgentType agentType,
        string[] capabilities,
        uint256 minFee,
        uint256 minBond
    );
    
    event AgentUpdated(
        address indexed agent,
        uint256 minFee,
        uint256 minBond
    );
    
    event AgentDeactivated(address indexed agent);
    event AgentReactivated(address indexed agent);
    
    event ReputationUpdated(
        address indexed agent,
        uint256 oldReputation,
        uint256 newReputation
    );
    
    // ============ Registration ============
    
    /**
     * @notice Register as a worker or verifier agent
     * @dev Permissionless - anyone can register
     */
    function registerAgent(
        AgentType agentType,
        string[] calldata capabilities,
        uint256 minFee,
        uint256 minBond,
        address operator
    ) external {
        require(!agents[msg.sender].active, "Agent already registered");
        require(capabilities.length > 0, "Must have at least one capability");
        
        agents[msg.sender] = Agent({
            wallet: msg.sender,
            agentType: agentType,
            capabilities: capabilities,
            minFee: minFee,
            minBond: minBond,
            operator: operator,
            reputation: 50, // Start at neutral reputation
            active: true,
            registeredAt: block.timestamp
        });
        
        agentAddresses.push(msg.sender);
        agentsByType[agentType].push(msg.sender);
        
        emit AgentRegistered(msg.sender, agentType, capabilities, minFee, minBond);
    }
    
    /**
     * @notice Update agent fees
     */
    function updateFees(uint256 newMinFee, uint256 newMinBond) external {
        require(agents[msg.sender].active, "Agent not registered");
        
        agents[msg.sender].minFee = newMinFee;
        agents[msg.sender].minBond = newMinBond;
        
        emit AgentUpdated(msg.sender, newMinFee, newMinBond);
    }
    
    /**
     * @notice Deactivate agent (can be reactivated)
     */
    function deactivate() external {
        require(agents[msg.sender].active, "Agent not active");
        
        agents[msg.sender].active = false;
        
        emit AgentDeactivated(msg.sender);
    }
    
    /**
     * @notice Reactivate agent
     */
    function reactivate() external {
        require(agents[msg.sender].wallet != address(0), "Agent not registered");
        require(!agents[msg.sender].active, "Agent already active");
        
        agents[msg.sender].active = true;
        
        emit AgentReactivated(msg.sender);
    }
    
    // ============ Queries ============
    
    /**
     * @notice Get agent details
     */
    function getAgent(address agent) external view returns (Agent memory) {
        return agents[agent];
    }
    
    /**
     * @notice Check if agent is registered and active
     */
    function isActive(address agent) external view returns (bool) {
        return agents[agent].active;
    }
    
    /**
     * @notice Get all agents of a specific type
     */
    function getAgentsByType(AgentType agentType) external view returns (address[] memory) {
        return agentsByType[agentType];
    }
    
    /**
     * @notice Query workers by minimum reputation
     */
    function queryWorkers(uint256 minReputation) external view returns (address[] memory) {
        return _queryByTypeAndReputation(AgentType.WORKER, minReputation);
    }
    
    /**
     * @notice Query verifiers by minimum reputation
     */
    function queryVerifiers(uint256 minReputation) external view returns (address[] memory) {
        return _queryByTypeAndReputation(AgentType.VERIFIER, minReputation);
    }
    
    /**
     * @notice Internal query helper
     */
    function _queryByTypeAndReputation(
        AgentType agentType,
        uint256 minReputation
    ) internal view returns (address[] memory) {
        address[] memory typeAgents = agentsByType[agentType];
        
        // Count qualifying agents
        uint256 count = 0;
        for (uint256 i = 0; i < typeAgents.length; i++) {
            Agent memory agent = agents[typeAgents[i]];
            if (agent.active && agent.reputation >= minReputation) {
                count++;
            }
        }
        
        // Build result array
        address[] memory result = new address[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < typeAgents.length; i++) {
            Agent memory agent = agents[typeAgents[i]];
            if (agent.active && agent.reputation >= minReputation) {
                result[index] = typeAgents[i];
                index++;
            }
        }
        
        return result;
    }
    
    /**
     * @notice Get agent capabilities
     */
    function getCapabilities(address agent) external view returns (string[] memory) {
        return agents[agent].capabilities;
    }
    
    /**
     * @notice Check if agent has capability
     */
    function hasCapability(address agent, string calldata capability) external view returns (bool) {
        string[] memory caps = agents[agent].capabilities;
        for (uint256 i = 0; i < caps.length; i++) {
            if (keccak256(bytes(caps[i])) == keccak256(bytes(capability))) {
                return true;
            }
        }
        return false;
    }
    
    // ============ Reputation Management ============
    
    /**
     * @notice Update agent reputation (only callable by ClawgerManager)
     * @dev In production, restrict to authorized contracts
     */
    function updateReputation(address agent, uint256 newReputation) external {
        require(agents[agent].wallet != address(0), "Agent not registered");
        
        uint256 oldReputation = agents[agent].reputation;
        
        // Cap reputation at 0-100
        if (newReputation > 100) {
            newReputation = 100;
        }
        
        agents[agent].reputation = newReputation;
        
        emit ReputationUpdated(agent, oldReputation, newReputation);
    }
    
    /**
     * @notice Get total agent count
     */
    function getAgentCount() external view returns (uint256) {
        return agentAddresses.length;
    }
    
    /**
     * @notice Get active agent count
     */
    function getActiveAgentCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < agentAddresses.length; i++) {
            if (agents[agentAddresses[i]].active) {
                count++;
            }
        }
        return count;
    }
}
