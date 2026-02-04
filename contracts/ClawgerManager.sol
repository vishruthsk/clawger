// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ClawgerManager
 * @notice Core contract for CLAWGER autonomous agent system
 * @dev Manages proposals, tasks, escrow, bonding, and reputation on Monad
 */
contract ClawgerManager {
    
    // ============ State Variables ============
    
    address public immutable clawger; // CLAWGER's wallet address
    uint256 public proposalCounter;
    uint256 public taskCounter;
    
    uint256 public constant PROPOSAL_BOND = 0.1 ether; // Required bond to submit proposal
    uint256 public constant BOND_BURN_PERCENT = 50; // 50% burned on reject, 50% to CLAWGER
    
    // ============ Structs ============
    
    enum ProposalStatus { Pending, Accepted, Countered, Rejected, Expired, Closed }
    enum TaskStatus { Created, Assigned, InProgress, Completed, Failed, Verified }
    
    struct Proposal {
        uint256 id;
        address proposer;
        string objective;
        uint256 budget;
        uint256 deadline; // Unix timestamp
        string riskTolerance; // "low", "medium", "high"
        ProposalStatus status;
        uint256 bondAmount;
        uint256 submissionTime;
        uint256 counterExpiration; // For time-bound counter-offers
    }
    
    struct Task {
        uint256 id;
        uint256 proposalId;
        address worker;
        address verifier;
        uint256 escrow;
        uint256 workerBond;
        uint256 clawgerFee;
        TaskStatus status;
        uint256 createdAt;
        uint256 completedAt;
    }
    
    struct AgentReputation {
        uint256 tasksCompleted;
        uint256 tasksAssigned;
        uint256 totalEarned;
        uint256 totalSlashed;
        uint256 reputationScore; // 0-100
    }
    
    // ============ Storage ============
    
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => Task) public tasks;
    mapping(address => AgentReputation) public agentReputations;
    mapping(address => uint256) public agentBonds; // Active bonds per agent
    
    // ============ Events ============
    
    event ProposalSubmitted(
        uint256 indexed proposalId,
        address indexed proposer,
        string objective,
        uint256 budget,
        uint256 deadline,
        uint256 bondAmount
    );
    
    event ProposalAccepted(
        uint256 indexed proposalId,
        uint256 indexed taskId,
        uint256 escrow,
        uint256 clawgerFee
    );
    
    event ProposalCountered(
        uint256 indexed proposalId,
        uint256 newBudget,
        uint256 newDeadline,
        uint256 expiresAt
    );
    
    event ProposalRejected(
        uint256 indexed proposalId,
        string reason,
        uint256 bondBurned,
        uint256 bondToClawger
    );
    
    event CounterOfferExpired(
        uint256 indexed proposalId,
        uint256 bondRefunded
    );
    
    event TaskCreated(
        uint256 indexed taskId,
        uint256 indexed proposalId,
        uint256 escrow,
        address worker,
        address verifier
    );
    
    event TaskCompleted(
        uint256 indexed taskId,
        bool success,
        uint256 payout,
        address worker
    );
    
    event AgentSlashed(
        address indexed agent,
        uint256 amount,
        string reason,
        uint256 indexed taskId
    );
    
    event ReputationUpdated(
        address indexed agent,
        uint256 newScore,
        uint256 tasksCompleted,
        uint256 tasksAssigned
    );
    
    event BondPosted(
        address indexed agent,
        uint256 amount,
        uint256 indexed taskId
    );
    
    event BondReleased(
        address indexed agent,
        uint256 amount,
        uint256 indexed taskId
    );
    
    // ============ Modifiers ============
    
    modifier onlyClawger() {
        require(msg.sender == clawger, "Only CLAWGER can call this");
        _;
    }
    
    // ============ Constructor ============
    
    constructor(address _clawger) {
        require(_clawger != address(0), "Invalid CLAWGER address");
        clawger = _clawger;
    }
    
    // ============ Proposal Functions ============
    
    /**
     * @notice Submit a proposal to CLAWGER
     * @dev Requires PROPOSAL_BOND to be sent with transaction
     */
    function submitProposal(
        string calldata objective,
        uint256 budget,
        uint256 deadline,
        string calldata riskTolerance
    ) external payable returns (uint256) {
        require(msg.value == PROPOSAL_BOND, "Incorrect proposal bond");
        require(bytes(objective).length > 0, "Objective cannot be empty");
        require(budget > 0, "Budget must be greater than 0");
        require(deadline > block.timestamp, "Deadline must be in the future");
        
        uint256 proposalId = ++proposalCounter;
        
        proposals[proposalId] = Proposal({
            id: proposalId,
            proposer: msg.sender,
            objective: objective,
            budget: budget,
            deadline: deadline,
            riskTolerance: riskTolerance,
            status: ProposalStatus.Pending,
            bondAmount: PROPOSAL_BOND,
            submissionTime: block.timestamp,
            counterExpiration: 0
        });
        
        emit ProposalSubmitted(
            proposalId,
            msg.sender,
            objective,
            budget,
            deadline,
            PROPOSAL_BOND
        );
        
        return proposalId;
    }
    
    /**
     * @notice CLAWGER accepts a proposal and creates a task
     * @dev Refunds proposal bond and locks escrow
     */
    function acceptProposal(
        uint256 proposalId,
        uint256 escrow,
        uint256 clawgerFee,
        address worker,
        address verifier,
        uint256 workerBond
    ) external onlyClawger returns (uint256) {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.status == ProposalStatus.Pending, "Proposal not pending");
        
        proposal.status = ProposalStatus.Accepted;
        
        // Refund proposal bond
        payable(proposal.proposer).transfer(proposal.bondAmount);
        
        // Create task
        uint256 taskId = ++taskCounter;
        
        tasks[taskId] = Task({
            id: taskId,
            proposalId: proposalId,
            worker: worker,
            verifier: verifier,
            escrow: escrow,
            workerBond: workerBond,
            clawgerFee: clawgerFee,
            status: TaskStatus.Created,
            createdAt: block.timestamp,
            completedAt: 0
        });
        
        emit ProposalAccepted(proposalId, taskId, escrow, clawgerFee);
        emit TaskCreated(taskId, proposalId, escrow, worker, verifier);
        
        return taskId;
    }
    
    /**
     * @notice CLAWGER counters a proposal with new terms
     * @dev Sets 10-minute expiration timer
     */
    function counterProposal(
        uint256 proposalId,
        uint256 newBudget,
        uint256 newDeadline
    ) external onlyClawger {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.status == ProposalStatus.Pending, "Proposal not pending");
        
        proposal.status = ProposalStatus.Countered;
        proposal.budget = newBudget;
        proposal.deadline = newDeadline;
        proposal.counterExpiration = block.timestamp + 10 minutes;
        
        emit ProposalCountered(
            proposalId,
            newBudget,
            newDeadline,
            proposal.counterExpiration
        );
    }
    
    /**
     * @notice Human accepts CLAWGER's counter-offer
     */
    function acceptCounterOffer(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.status == ProposalStatus.Countered, "No active counter-offer");
        require(msg.sender == proposal.proposer, "Only proposer can accept");
        require(block.timestamp < proposal.counterExpiration, "Counter-offer expired");
        
        // Reset to pending for CLAWGER to accept with new terms
        proposal.status = ProposalStatus.Pending;
        proposal.counterExpiration = 0;
    }
    
    /**
     * @notice CLAWGER rejects a proposal
     * @dev Burns 50% of bond, sends 50% to CLAWGER
     */
    function rejectProposal(
        uint256 proposalId,
        string calldata reason
    ) external onlyClawger {
        Proposal storage proposal = proposals[proposalId];
        require(
            proposal.status == ProposalStatus.Pending || 
            proposal.status == ProposalStatus.Countered,
            "Proposal not in rejectable state"
        );
        
        proposal.status = ProposalStatus.Rejected;
        
        uint256 bondAmount = proposal.bondAmount;
        uint256 burnAmount = (bondAmount * BOND_BURN_PERCENT) / 100;
        uint256 toClawger = bondAmount - burnAmount;
        
        // Burn portion (send to address(0))
        payable(address(0)).transfer(burnAmount);
        
        // Send remainder to CLAWGER
        payable(clawger).transfer(toClawger);
        
        emit ProposalRejected(proposalId, reason, burnAmount, toClawger);
    }
    
    /**
     * @notice Expire counter-offer if not accepted within 10 minutes
     * @dev Can be called by anyone, refunds bond
     */
    function expireCounterOffer(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.status == ProposalStatus.Countered, "No active counter-offer");
        require(block.timestamp >= proposal.counterExpiration, "Counter-offer not expired yet");
        
        proposal.status = ProposalStatus.Expired;
        
        // Refund bond on expiration
        uint256 bondAmount = proposal.bondAmount;
        payable(proposal.proposer).transfer(bondAmount);
        
        emit CounterOfferExpired(proposalId, bondAmount);
    }
    
    // ============ Task Execution Functions ============
    
    /**
     * @notice Worker posts bond to accept task
     */
    function postWorkerBond(uint256 taskId) external payable {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Created, "Task not available");
        require(msg.sender == task.worker, "Not assigned worker");
        require(msg.value == task.workerBond, "Incorrect bond amount");
        
        agentBonds[msg.sender] += msg.value;
        task.status = TaskStatus.Assigned;
        
        emit BondPosted(msg.sender, msg.value, taskId);
    }
    
    /**
     * @notice Worker marks task as in progress
     */
    function startTask(uint256 taskId) external {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Assigned, "Task not assigned");
        require(msg.sender == task.worker, "Not assigned worker");
        
        task.status = TaskStatus.InProgress;
    }
    
    /**
     * @notice Worker submits completed work
     */
    function submitWork(uint256 taskId) external {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.InProgress, "Task not in progress");
        require(msg.sender == task.worker, "Not assigned worker");
        
        task.status = TaskStatus.Completed;
        task.completedAt = block.timestamp;
    }
    
    /**
     * @notice Verifier validates work and triggers payout or slashing
     */
    function verifyTask(uint256 taskId, bool success) external {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Completed, "Task not completed");
        require(msg.sender == task.verifier, "Not assigned verifier");
        
        task.status = success ? TaskStatus.Verified : TaskStatus.Failed;
        
        if (success) {
            // Release worker bond
            agentBonds[task.worker] -= task.workerBond;
            
            // Pay worker (escrow + bond back)
            uint256 payout = task.escrow + task.workerBond;
            payable(task.worker).transfer(payout);
            
            // Update reputation positively
            _updateReputation(task.worker, true, task.escrow);
            
            emit BondReleased(task.worker, task.workerBond, taskId);
            emit TaskCompleted(taskId, true, payout, task.worker);
            
        } else {
            // Slash worker bond
            uint256 slashAmount = task.workerBond;
            agentBonds[task.worker] -= slashAmount;
            
            // Send slashed amount to CLAWGER
            payable(clawger).transfer(slashAmount);
            
            // Update reputation negatively
            _updateReputation(task.worker, false, slashAmount);
            
            emit AgentSlashed(task.worker, slashAmount, "Verification failed", taskId);
            emit TaskCompleted(taskId, false, 0, task.worker);
        }
    }
    
    // ============ Reputation Functions ============
    
    function _updateReputation(
        address agent,
        bool success,
        uint256 amount
    ) internal {
        AgentReputation storage rep = agentReputations[agent];
        
        rep.tasksAssigned++;
        
        if (success) {
            rep.tasksCompleted++;
            rep.totalEarned += amount;
            
            // Increase reputation (max 100)
            if (rep.reputationScore < 100) {
                rep.reputationScore = rep.reputationScore + 2 > 100 
                    ? 100 
                    : rep.reputationScore + 2;
            }
        } else {
            rep.totalSlashed += amount;
            
            // Decrease reputation (min 0)
            if (rep.reputationScore >= 15) {
                rep.reputationScore -= 15;
            } else {
                rep.reputationScore = 0;
            }
        }
        
        emit ReputationUpdated(
            agent,
            rep.reputationScore,
            rep.tasksCompleted,
            rep.tasksAssigned
        );
    }
    
    /**
     * @notice Get agent reputation
     */
    function getAgentReputation(address agent) 
        external 
        view 
        returns (
            uint256 tasksCompleted,
            uint256 tasksAssigned,
            uint256 totalEarned,
            uint256 totalSlashed,
            uint256 reputationScore
        ) 
    {
        AgentReputation memory rep = agentReputations[agent];
        return (
            rep.tasksCompleted,
            rep.tasksAssigned,
            rep.totalEarned,
            rep.totalSlashed,
            rep.reputationScore
        );
    }
    
    /**
     * @notice Get proposal details
     */
    function getProposal(uint256 proposalId) 
        external 
        view 
        returns (Proposal memory) 
    {
        return proposals[proposalId];
    }
    
    /**
     * @notice Get task details
     */
    function getTask(uint256 taskId) 
        external 
        view 
        returns (Task memory) 
    {
        return tasks[taskId];
    }
    
    // ============ Treasury Functions ============
    
    /**
     * @notice CLAWGER can fund the contract treasury
     */
    function fundTreasury() external payable onlyClawger {
        // Funds added to contract balance
    }
    
    /**
     * @notice Get contract balance (CLAWGER's treasury)
     */
    function getTreasuryBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    /**
     * @notice Emergency withdraw (CLAWGER only)
     */
    function emergencyWithdraw(uint256 amount) external onlyClawger {
        require(amount <= address(this).balance, "Insufficient balance");
        payable(clawger).transfer(amount);
    }
    
    // ============ Fallback ============
    
    receive() external payable {
        // Accept direct deposits to treasury
    }
}
