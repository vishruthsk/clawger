// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IAgentRegistry {
    function updateReputation(address agent, uint256 newScore, string calldata reason) external;
    function getReputation(address agent) external view returns (uint256);
}

/**
 * @title ClawgerManagerV4
 * @notice Gasless CLGR escrow + bond + slashing economy for CLAWGER
 *
 * CRITICAL ARCHITECTURE:
 * - CLAWGER NEVER PAYS GAS
 * - Uses EIP-712 signatures for accept/reject
 * - Anyone can submit transactions with valid signature
 * - Proposer/relayer pays gas, CLAWGER signs off-chain
 *
 * ECONOMY:
 * - Proposal bond in CLGR
 * - Escrow in CLGR
 * - Worker bond in CLGR
 * - Slashing in CLGR
 *
 * SAFETY:
 * - No stuck escrow (expiry + refund)
 * - NonReentrant payouts
 * - One-time settlement
 * - Signature replay protection
 * - Task expiry mechanism
 * - Address validation
 * - Pausable operations
 */
contract ClawgerManagerV4 is ReentrancyGuard, Pausable, EIP712 {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    // =============================================================
    //                        IMMUTABLES
    // =============================================================

    IERC20 public immutable CLGR;
    address public immutable clawger;
    IAgentRegistry public immutable registry;

    address public constant BURN_ADDRESS =
        0x000000000000000000000000000000000000dEaD;

    // =============================================================
    //                        CONSTANTS
    // =============================================================

    uint256 public constant PROPOSAL_BOND = 100 ether; // 100 CLGR
    uint256 public constant BOND_BURN_PERCENT = 50;
    uint256 public constant TASK_EXPIRY_DURATION = 7 days;
    uint256 public constant MAX_ESCROW = 1_000_000 ether; // 1M CLGR
    uint256 public constant MAX_OBJECTIVE_LENGTH = 1000;
    uint256 public constant MIN_WORKER_BOND = 1 ether; // 1 CLGR

    // EIP-712 type hashes
    bytes32 public constant ACCEPT_PROPOSAL_TYPEHASH = keccak256(
        "AcceptProposal(uint256 proposalId,address worker,address verifier,uint256 workerBond,uint256 deadline)"
    );

    bytes32 public constant REJECT_PROPOSAL_TYPEHASH = keccak256(
        "RejectProposal(uint256 proposalId,string reason,uint256 deadline)"
    );

    // =============================================================
    //                        ENUMS
    // =============================================================

    enum ProposalStatus {
        Pending,
        Accepted,
        Rejected,
        Expired
    }

    enum TaskStatus {
        Created,
        Bonded,
        InProgress,
        Completed,
        Verified,
        Failed
    }

    // =============================================================
    //                        STRUCTS
    // =============================================================

    struct Proposal {
        uint256 id;
        address proposer;
        string objective;
        uint256 escrow;
        uint256 deadline;
        ProposalStatus status;
        uint256 createdAt;
    }

    struct Task {
        uint256 id;
        uint256 proposalId;
        address worker;
        address verifier;
        uint256 escrow;
        uint256 workerBond;
        TaskStatus status;
        bool settled;
        uint256 createdAt;
        uint256 completedAt;
    }

    // =============================================================
    //                        STORAGE
    // =============================================================

    uint256 public proposalCounter;
    uint256 public taskCounter;

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => Task) public tasks;
    mapping(uint256 => uint256) public lockedWorkerBond;

    // Replay protection
    mapping(uint256 => bool) public proposalProcessed;

    // =============================================================
    //                        EVENTS
    // =============================================================

    event ProposalSubmitted(
        uint256 indexed proposalId,
        address indexed proposer,
        uint256 escrow,
        uint256 deadline
    );

    event ProposalAccepted(
        uint256 indexed proposalId,
        uint256 indexed taskId,
        address indexed worker,
        address verifier
    );

    event ProposalRejected(
        uint256 indexed proposalId,
        string reason
    );

    event WorkerBondPosted(
        uint256 indexed taskId,
        address indexed worker,
        uint256 amount
    );

    event TaskStarted(uint256 indexed taskId);

    event TaskCompleted(uint256 indexed taskId);

    event TaskSettled(
        uint256 indexed taskId,
        bool success,
        uint256 payout
    );

    event TaskExpired(uint256 indexed taskId);

    // =============================================================
    //                        STATE
    // =============================================================

    address public owner;

    // =============================================================
    //                        MODIFIERS
    // =============================================================

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyWorker(uint256 taskId) {
        require(msg.sender == tasks[taskId].worker, "Not worker");
        _;
    }

    modifier onlyVerifierOrClawger(uint256 taskId) {
        require(
            msg.sender == tasks[taskId].verifier || msg.sender == clawger,
            "Not verifier or CLAWGER"
        );
        _;
    }

    // =============================================================
    //                        CONSTRUCTOR
    // =============================================================

    constructor(
        address _clgr,
        address _registry,
        address _clawger
    ) EIP712("ClawgerManagerV4", "1") {
        require(_clgr != address(0), "Invalid CLGR");
        require(_registry != address(0), "Invalid registry");
        require(_clawger != address(0), "Invalid clawger");

        CLGR = IERC20(_clgr);
        registry = IAgentRegistry(_registry);
        clawger = _clawger;
        owner = msg.sender;
    }

    // =============================================================
    //                     REGISTRY WIRING
    // =============================================================

    /**
     * @notice Accept manager role from AgentRegistry
     * @dev This allows the Manager contract to become the authorized manager of the Registry
     *      Must be called after Registry.proposeManager(thisContract) by Registry owner
     */
    function acceptRegistryManagerRole() external onlyOwner {
        // Call acceptManagerRole on the Registry
        // This requires the Registry to have proposed this contract as the pending manager
        (bool success, ) = address(registry).call(
            abi.encodeWithSignature("acceptManagerRole()")
        );
        require(success, "Failed to accept manager role");
    }

    // =============================================================
    //                     PROPOSAL LIFECYCLE
    // =============================================================

    function submitProposal(
        string calldata objective,
        uint256 escrowAmount,
        uint256 deadline
    ) external whenNotPaused returns (uint256) {
        require(bytes(objective).length > 0, "Empty objective");
        require(bytes(objective).length <= MAX_OBJECTIVE_LENGTH, "Objective too long");
        require(deadline > block.timestamp, "Bad deadline");
        require(escrowAmount > 0, "Escrow required");
        require(escrowAmount <= MAX_ESCROW, "Escrow too large");

        // Lock escrow + bond upfront
        CLGR.safeTransferFrom(
            msg.sender,
            address(this),
            escrowAmount + PROPOSAL_BOND
        );

        uint256 proposalId = ++proposalCounter;

        proposals[proposalId] = Proposal({
            id: proposalId,
            proposer: msg.sender,
            objective: objective,
            escrow: escrowAmount,
            deadline: deadline,
            status: ProposalStatus.Pending,
            createdAt: block.timestamp
        });

        emit ProposalSubmitted(proposalId, msg.sender, escrowAmount, deadline);

        return proposalId;
    }

    /**
     * @notice Accept proposal with CLAWGER's signature (CLAWGER PAYS NO GAS)
     * @dev Anyone can submit this transaction if they have a valid signature from CLAWGER
     */
    function acceptProposalWithSignature(
        uint256 proposalId,
        address worker,
        address verifier,
        uint256 workerBond,
        uint256 deadline,
        bytes calldata signature
    ) external whenNotPaused returns (uint256) {
        require(block.timestamp <= deadline, "Signature expired");
        require(!proposalProcessed[proposalId], "Already processed");

        // Verify EIP-712 signature
        bytes32 structHash = keccak256(abi.encode(
            ACCEPT_PROPOSAL_TYPEHASH,
            proposalId,
            worker,
            verifier,
            workerBond,
            deadline
        ));

        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = hash.recover(signature);

        require(signer == clawger, "Invalid signature");

        // Mark as processed
        proposalProcessed[proposalId] = true;

        // Execute acceptance
        return _acceptProposal(proposalId, worker, verifier, workerBond);
    }

    /**
     * @notice Reject proposal with CLAWGER's signature (CLAWGER PAYS NO GAS)
     * @dev Anyone can submit this transaction if they have a valid signature from CLAWGER
     */
    function rejectProposalWithSignature(
        uint256 proposalId,
        string calldata reason,
        uint256 deadline,
        bytes calldata signature
    ) external whenNotPaused {
        require(block.timestamp <= deadline, "Signature expired");
        require(!proposalProcessed[proposalId], "Already processed");

        // Verify EIP-712 signature
        bytes32 structHash = keccak256(abi.encode(
            REJECT_PROPOSAL_TYPEHASH,
            proposalId,
            keccak256(bytes(reason)),
            deadline
        ));

        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = hash.recover(signature);

        require(signer == clawger, "Invalid signature");

        // Mark as processed
        proposalProcessed[proposalId] = true;

        // Execute rejection
        _rejectProposal(proposalId, reason);
    }

    /**
     * @notice Internal function to accept proposal
     */
    function _acceptProposal(
        uint256 proposalId,
        address worker,
        address verifier,
        uint256 workerBond
    ) internal returns (uint256) {
        Proposal storage p = proposals[proposalId];

        require(p.status == ProposalStatus.Pending, "Not pending");
        require(block.timestamp < p.deadline, "Expired");
        require(worker != address(0), "Invalid worker");
        require(verifier != address(0), "Invalid verifier");
        require(workerBond >= MIN_WORKER_BOND, "Bond too small");

        p.status = ProposalStatus.Accepted;

        // Refund bond immediately
        CLGR.safeTransfer(p.proposer, PROPOSAL_BOND);

        uint256 taskId = ++taskCounter;

        tasks[taskId] = Task({
            id: taskId,
            proposalId: proposalId,
            worker: worker,
            verifier: verifier,
            escrow: p.escrow,
            workerBond: workerBond,
            status: TaskStatus.Created,
            settled: false,
            createdAt: block.timestamp,
            completedAt: 0
        });

        emit ProposalAccepted(proposalId, taskId, worker, verifier);

        return taskId;
    }

    /**
     * @notice Internal function to reject proposal
     */
    function _rejectProposal(
        uint256 proposalId,
        string calldata reason
    ) internal {
        Proposal storage p = proposals[proposalId];

        require(p.status == ProposalStatus.Pending, "Not pending");

        p.status = ProposalStatus.Rejected;

        // Burn 50% of bond
        uint256 burnAmount = (PROPOSAL_BOND * BOND_BURN_PERCENT) / 100;
        uint256 toClawger = PROPOSAL_BOND - burnAmount;

        CLGR.safeTransfer(BURN_ADDRESS, burnAmount);
        CLGR.safeTransfer(clawger, toClawger);

        // Refund escrow
        CLGR.safeTransfer(p.proposer, p.escrow);

        emit ProposalRejected(proposalId, reason);
    }

    // =============================================================
    //                     TASK LIFECYCLE
    // =============================================================

    function postWorkerBond(uint256 taskId) external nonReentrant onlyWorker(taskId) {
        Task storage t = tasks[taskId];

        require(t.status == TaskStatus.Created, "Not created");

        CLGR.safeTransferFrom(msg.sender, address(this), t.workerBond);

        lockedWorkerBond[taskId] = t.workerBond;
        t.status = TaskStatus.Bonded;

        emit WorkerBondPosted(taskId, msg.sender, t.workerBond);
    }

    function startTask(uint256 taskId) external onlyWorker(taskId) {
        Task storage t = tasks[taskId];

        require(t.status == TaskStatus.Bonded, "Not bonded");

        t.status = TaskStatus.InProgress;

        emit TaskStarted(taskId);
    }

    function submitWork(uint256 taskId) external onlyWorker(taskId) {
        Task storage t = tasks[taskId];

        require(t.status == TaskStatus.InProgress, "Not in progress");

        t.status = TaskStatus.Completed;
        t.completedAt = block.timestamp;

        emit TaskCompleted(taskId);
    }

    function verifyTask(
        uint256 taskId,
        bool success
    ) external nonReentrant onlyVerifierOrClawger(taskId) {
        Task storage t = tasks[taskId];

        require(t.status == TaskStatus.Completed, "Not completed");
        require(!t.settled, "Already settled");

        t.settled = true;

        uint256 bond = lockedWorkerBond[taskId];

        if (success) {
            t.status = TaskStatus.Verified;

            uint256 payout = t.escrow + bond;
            CLGR.safeTransfer(t.worker, payout);

            // Update reputation: +5
            uint256 currentRep = registry.getReputation(t.worker);
            uint256 newRep = currentRep + 5;
            if (newRep > 100) newRep = 100;
            registry.updateReputation(t.worker, newRep, "Task completed");

            emit TaskSettled(taskId, true, payout);

        } else {
            t.status = TaskStatus.Failed;

            // Slash bond → CLAWGER
            CLGR.safeTransfer(clawger, bond);

            // Refund escrow → proposer
            Proposal storage p = proposals[t.proposalId];
            CLGR.safeTransfer(p.proposer, t.escrow);

            // Update reputation: -15
            uint256 currentRep = registry.getReputation(t.worker);
            uint256 newRep = currentRep >= 15 ? currentRep - 15 : 0;
            registry.updateReputation(t.worker, newRep, "Task failed");

            emit TaskSettled(taskId, false, 0);
        }

        lockedWorkerBond[taskId] = 0;
        t.escrow = 0;
    }

    // =============================================================
    //                     TASK EXPIRY
    // =============================================================

    function expireTask(uint256 taskId) external nonReentrant {
        Task storage t = tasks[taskId];
        require(t.status == TaskStatus.Completed, "Not completed");
        require(!t.settled, "Already settled");
        require(block.timestamp >= t.completedAt + TASK_EXPIRY_DURATION, "Not expired");

        t.settled = true;
        t.status = TaskStatus.Failed;

        // Refund bond to worker (they did submit work)
        uint256 bond = lockedWorkerBond[taskId];
        CLGR.safeTransfer(t.worker, bond);

        // Refund escrow to proposer
        Proposal storage p = proposals[t.proposalId];
        CLGR.safeTransfer(p.proposer, t.escrow);

        lockedWorkerBond[taskId] = 0;
        t.escrow = 0;

        emit TaskExpired(taskId);
    }

    // =============================================================
    //                     EMERGENCY
    // =============================================================

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // =============================================================
    //                     VIEW FUNCTIONS
    // =============================================================

    function getDomainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function getAcceptProposalHash(
        uint256 proposalId,
        address worker,
        address verifier,
        uint256 workerBond,
        uint256 deadline
    ) external view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(
            ACCEPT_PROPOSAL_TYPEHASH,
            proposalId,
            worker,
            verifier,
            workerBond,
            deadline
        ));
        return _hashTypedDataV4(structHash);
    }

    function getRejectProposalHash(
        uint256 proposalId,
        string calldata reason,
        uint256 deadline
    ) external view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(
            REJECT_PROPOSAL_TYPEHASH,
            proposalId,
            keccak256(bytes(reason)),
            deadline
        ));
        return _hashTypedDataV4(structHash);
    }
}