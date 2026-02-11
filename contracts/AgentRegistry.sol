// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AgentRegistryV3
 * @notice Production registry for worker + verifier agents in CLAWGER
 *
 * - Permissionless registration
 * - Manager-only reputation updates
 * - Capability hashes stored as bytes32
 * - Emergency pause
 * - Safe manager rotation
 *
 * Discovery should happen off-chain via events.
 */
contract AgentRegistryV3 is Ownable, Pausable {
    uint256 public constant MAX_CAPABILITIES = 16;
    uint256 public constant BASE_REPUTATION = 50;

    enum AgentType {
        WORKER,
        VERIFIER
    }

    struct Agent {
        address wallet;
        AgentType agentType;

        bytes32[] capabilities;

        uint256 minFee;
        uint256 minBond;

        address operator;

        uint256 reputation;
        bool active;
        bool exists;

        uint256 registeredAt;
        uint256 updatedAt;
    }

    mapping(address => Agent) private agents;

    address public manager;
    address public pendingManager;

    event AgentRegistered(
        address indexed agent,
        AgentType indexed agentType,
        uint256 minFee,
        uint256 minBond,
        bytes32[] capabilities
    );

    event AgentUpdated(
        address indexed agent,
        uint256 minFee,
        uint256 minBond,
        bytes32[] capabilities,
        address operator
    );

    event AgentDeactivated(address indexed agent);
    event AgentReactivated(address indexed agent);

    event ReputationUpdated(
        address indexed agent,
        uint256 oldScore,
        uint256 newScore,
        string reason
    );

    event ManagerUpdateProposed(address indexed newManager);
    event ManagerUpdated(address indexed oldManager, address indexed newManager);

    modifier onlyManager() {
        require(msg.sender == manager, "Not authorized");
        _;
    }

    modifier onlyActiveAgent() {
        require(agents[msg.sender].active, "Agent not active");
        _;
    }

    constructor(address _manager) Ownable(msg.sender) {
        require(_manager != address(0), "Invalid manager");
        manager = _manager;
    }

    // =============================================================
    //                  MANAGER ROTATION
    // =============================================================

    function proposeManager(address newManager) external onlyOwner {
        require(newManager != address(0), "Invalid manager");
        pendingManager = newManager;
        emit ManagerUpdateProposed(newManager);
    }

    function acceptManagerRole() external {
        require(msg.sender == pendingManager, "Not pending manager");

        address old = manager;
        manager = pendingManager;
        pendingManager = address(0);

        emit ManagerUpdated(old, manager);
    }

    // =============================================================
    //                     REGISTRATION
    // =============================================================

    function registerAgent(
        AgentType agentType,
        bytes32[] calldata capabilities,
        uint256 minFee,
        uint256 minBond,
        address operator
    ) external whenNotPaused {
        require(capabilities.length > 0, "No capabilities");
        require(capabilities.length <= MAX_CAPABILITIES, "Too many capabilities");

        require(!agents[msg.sender].active, "Already active agent");

        bytes32[] memory cleanCaps = _dedupeCapabilities(capabilities);

        agents[msg.sender] = Agent({
            wallet: msg.sender,
            agentType: agentType,
            capabilities: cleanCaps,
            minFee: minFee,
            minBond: minBond,
            operator: operator,
            reputation: BASE_REPUTATION,
            active: true,
            exists: true,
            registeredAt: block.timestamp,
            updatedAt: block.timestamp
        });

        emit AgentRegistered(msg.sender, agentType, minFee, minBond, cleanCaps);
    }

    function updateAgent(
        uint256 newMinFee,
        uint256 newMinBond,
        bytes32[] calldata newCapabilities,
        address newOperator
    ) external onlyActiveAgent whenNotPaused {
        require(newCapabilities.length > 0, "No capabilities");
        require(newCapabilities.length <= MAX_CAPABILITIES, "Too many capabilities");

        bytes32[] memory cleanCaps = _dedupeCapabilities(newCapabilities);

        Agent storage agent = agents[msg.sender];

        agent.minFee = newMinFee;
        agent.minBond = newMinBond;
        agent.capabilities = cleanCaps;
        agent.operator = newOperator;
        agent.updatedAt = block.timestamp;

        emit AgentUpdated(msg.sender, newMinFee, newMinBond, cleanCaps, newOperator);
    }

    function deactivate() external onlyActiveAgent {
        agents[msg.sender].active = false;
        emit AgentDeactivated(msg.sender);
    }

    function reactivate() external whenNotPaused {
        require(agents[msg.sender].exists, "Not registered");
        require(!agents[msg.sender].active, "Already active");

        agents[msg.sender].active = true;
        agents[msg.sender].updatedAt = block.timestamp;

        emit AgentReactivated(msg.sender);
    }

    // =============================================================
    //                    REPUTATION CONTROL
    // =============================================================

    function updateReputation(
        address agentAddr,
        uint256 newScore,
        string calldata reason
    ) external onlyManager whenNotPaused {
        require(agents[agentAddr].exists, "Not registered");

        if (newScore > 100) newScore = 100;

        uint256 oldScore = agents[agentAddr].reputation;
        agents[agentAddr].reputation = newScore;

        emit ReputationUpdated(agentAddr, oldScore, newScore, reason);
    }

    // =============================================================
    //                        READ METHODS
    // =============================================================

    function getAgent(address agentAddr)
        external
        view
        returns (Agent memory)
    {
        require(agents[agentAddr].exists, "Agent not found");
        return agents[agentAddr];
    }

    function getCapabilities(address agentAddr)
        external
        view
        returns (bytes32[] memory)
    {
        require(agents[agentAddr].exists, "Not found");
        return agents[agentAddr].capabilities;
    }

    function isActive(address agentAddr) external view returns (bool) {
        return agents[agentAddr].active;
    }

    function hasCapability(
        address agentAddr,
        bytes32 capability
    ) external view returns (bool) {
        bytes32[] memory caps = agents[agentAddr].capabilities;
        for (uint256 i = 0; i < caps.length; i++) {
            if (caps[i] == capability) return true;
        }
        return false;
    }

    function getReputation(address agentAddr) external view returns (uint256) {
        require(agents[agentAddr].exists, "Not registered");
        return agents[agentAddr].reputation;
    }

    // =============================================================
    //                      EMERGENCY
    // =============================================================

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // =============================================================
    //                    INTERNAL HELPERS
    // =============================================================

    function _dedupeCapabilities(
        bytes32[] calldata caps
    ) internal pure returns (bytes32[] memory result) {
        bytes32[] memory temp = new bytes32[](caps.length);
        uint256 count = 0;

        for (uint256 i = 0; i < caps.length; i++) {
            bool duplicate = false;
            for (uint256 j = 0; j < count; j++) {
                if (temp[j] == caps[i]) {
                    duplicate = true;
                    break;
                }
            }
            if (!duplicate) {
                temp[count] = caps[i];
                count++;
            }
        }

        result = new bytes32[](count);
        for (uint256 k = 0; k < count; k++) {
            result[k] = temp[k];
        }
    }
}