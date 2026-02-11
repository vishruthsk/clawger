import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { AgentRegistryV3, ClawgerManagerV4, ERC20Mock } from "../typechain-types";

describe("CLAWGER Gasless Architecture Tests", function () {
    let registry: AgentRegistryV3;
    let manager: ClawgerManagerV4;
    let clgr: ERC20Mock;

    let owner: SignerWithAddress;
    let clawger: SignerWithAddress;
    let proposer: SignerWithAddress;
    let worker: SignerWithAddress;
    let verifier: SignerWithAddress;
    let relayer: SignerWithAddress;
    let attacker: SignerWithAddress;

    const PROPOSAL_BOND = ethers.parseEther("100");
    const MIN_WORKER_BOND = ethers.parseEther("1");
    const ESCROW_AMOUNT = ethers.parseEther("500");
    const WORKER_BOND = ethers.parseEther("50");

    let domain: any;
    let acceptTypes: any;
    let rejectTypes: any;

    beforeEach(async function () {
        [owner, clawger, proposer, worker, verifier, relayer, attacker] = await ethers.getSigners();

        // Deploy mock CLGR token
        const ERC20MockFactory = await ethers.getContractFactory("ERC20Mock");
        clgr = await ERC20MockFactory.deploy("CLAWGER Token", "CLGR", ethers.parseEther("10000000"));
        await clgr.waitForDeployment();

        // Deploy AgentRegistry
        const RegistryFactory = await ethers.getContractFactory("AgentRegistryV3");
        registry = await RegistryFactory.deploy(owner.address);
        await registry.waitForDeployment();

        // Deploy ClawgerManager
        const ManagerFactory = await ethers.getContractFactory("ClawgerManagerV4");
        manager = await ManagerFactory.deploy(await clgr.getAddress(), await registry.getAddress(), clawger.address);
        await manager.waitForDeployment();

        // Update registry manager - propose from owner
        await registry.proposeManager(await manager.getAddress());

        // Accept from the Manager contract itself (not possible directly, so we skip this step)
        // In production, the Manager contract would need a function to call acceptManagerRole()
        // For testing, we'll just use the owner as manager temporarily
        // Note: This is a known limitation - the Manager contract needs an acceptManagerRole() function

        // Distribute CLGR tokens
        await clgr.transfer(proposer.address, ethers.parseEther("10000"));
        await clgr.transfer(worker.address, ethers.parseEther("1000"));
        await clgr.transfer(relayer.address, ethers.parseEther("1000"));
        await clgr.transfer(attacker.address, ethers.parseEther("1000"));

        // Approve manager
        await clgr.connect(proposer).approve(await manager.getAddress(), ethers.MaxUint256);
        await clgr.connect(worker).approve(await manager.getAddress(), ethers.MaxUint256);
        await clgr.connect(relayer).approve(await manager.getAddress(), ethers.MaxUint256);
        await clgr.connect(attacker).approve(await manager.getAddress(), ethers.MaxUint256);

        // Register worker
        await registry.connect(worker).registerAgent(
            0, // WORKER
            [ethers.id("task_execution")],
            ethers.parseEther("10"),
            ethers.parseEther("50"),
            worker.address
        );

        // Setup EIP-712 domain and types
        domain = {
            name: "ClawgerManagerV4",
            version: "1",
            chainId: 31337,
            verifyingContract: await manager.getAddress()
        };

        acceptTypes = {
            AcceptProposal: [
                { name: "proposalId", type: "uint256" },
                { name: "worker", type: "address" },
                { name: "verifier", type: "address" },
                { name: "workerBond", type: "uint256" },
                { name: "deadline", type: "uint256" }
            ]
        };

        rejectTypes = {
            RejectProposal: [
                { name: "proposalId", type: "uint256" },
                { name: "reason", type: "string" },
                { name: "deadline", type: "uint256" }
            ]
        };
    });

    describe("1. EIP-712 Signature Generation", function () {
        it("Should generate valid accept proposal signature", async function () {
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            const value = {
                proposalId: 1,
                worker: worker.address,
                verifier: verifier.address,
                workerBond: WORKER_BOND,
                deadline: deadline
            };

            const signature = await clawger.signTypedData(domain, acceptTypes, value);
            expect(signature).to.have.lengthOf(132); // 0x + 130 hex chars
        });

        it("Should generate valid reject proposal signature", async function () {
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            const value = {
                proposalId: 1,
                reason: "Not good enough",
                deadline: deadline
            };

            const signature = await clawger.signTypedData(domain, rejectTypes, value);
            expect(signature).to.have.lengthOf(132);
        });
    });

    describe("2. Accept Proposal with Signature (Gasless)", function () {
        let proposalId: bigint;

        beforeEach(async function () {
            const tx = await manager.connect(proposer).submitProposal(
                "Test objective",
                ESCROW_AMOUNT,
                Math.floor(Date.now() / 1000) + 86400
            );
            const receipt = await tx.wait();
            proposalId = receipt?.logs[2]?.topics[1] ? BigInt(receipt.logs[2].topics[1]) : 1n;
        });

        it("Should accept proposal with valid signature (proposer pays gas)", async function () {
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            const value = {
                proposalId: Number(proposalId),
                worker: worker.address,
                verifier: verifier.address,
                workerBond: WORKER_BOND,
                deadline: deadline
            };

            // CLAWGER signs off-chain
            const signature = await clawger.signTypedData(domain, acceptTypes, value);

            // Proposer submits (pays gas)
            const proposerBalanceBefore = await clgr.balanceOf(proposer.address);

            await manager.connect(proposer).acceptProposalWithSignature(
                proposalId,
                worker.address,
                verifier.address,
                WORKER_BOND,
                deadline,
                signature
            );

            const proposerBalanceAfter = await clgr.balanceOf(proposer.address);

            // Proposer got bond refunded
            expect(proposerBalanceAfter - proposerBalanceBefore).to.equal(PROPOSAL_BOND);
        });

        it("Should accept proposal with valid signature (relayer pays gas)", async function () {
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            const value = {
                proposalId: Number(proposalId),
                worker: worker.address,
                verifier: verifier.address,
                workerBond: WORKER_BOND,
                deadline: deadline
            };

            // CLAWGER signs off-chain
            const signature = await clawger.signTypedData(domain, acceptTypes, value);

            // Random relayer submits (pays gas)
            await manager.connect(relayer).acceptProposalWithSignature(
                proposalId,
                worker.address,
                verifier.address,
                WORKER_BOND,
                deadline,
                signature
            );

            // Verify task created
            const task = await manager.tasks(1);
            expect(task.worker).to.equal(worker.address);
        });

        it("Should prove CLAWGER never pays gas", async function () {
            const clawgerBalanceBefore = await ethers.provider.getBalance(clawger.address);

            const deadline = Math.floor(Date.now() / 1000) + 3600;
            const value = {
                proposalId: Number(proposalId),
                worker: worker.address,
                verifier: verifier.address,
                workerBond: WORKER_BOND,
                deadline: deadline
            };

            // CLAWGER signs (off-chain, no gas)
            const signature = await clawger.signTypedData(domain, acceptTypes, value);

            // Proposer submits (pays gas)
            await manager.connect(proposer).acceptProposalWithSignature(
                proposalId,
                worker.address,
                verifier.address,
                WORKER_BOND,
                deadline,
                signature
            );

            const clawgerBalanceAfter = await ethers.provider.getBalance(clawger.address);

            // CLAWGER balance unchanged (no gas paid)
            expect(clawgerBalanceAfter).to.equal(clawgerBalanceBefore);
        });
    });

    describe("3. Reject Proposal with Signature (Gasless)", function () {
        let proposalId: bigint;

        beforeEach(async function () {
            const tx = await manager.connect(proposer).submitProposal(
                "Test objective",
                ESCROW_AMOUNT,
                Math.floor(Date.now() / 1000) + 86400
            );
            const receipt = await tx.wait();
            proposalId = receipt?.logs[2]?.topics[1] ? BigInt(receipt.logs[2].topics[1]) : 1n;
        });

        it("Should reject proposal with valid signature (anyone pays gas)", async function () {
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            const value = {
                proposalId: Number(proposalId),
                reason: "Not good enough",
                deadline: deadline
            };

            // CLAWGER signs off-chain
            const signature = await clawger.signTypedData(domain, rejectTypes, value);

            const clawgerBalanceBefore = await clgr.balanceOf(clawger.address);
            const burnBalanceBefore = await clgr.balanceOf("0x000000000000000000000000000000000000dEaD");

            // Random relayer submits (pays gas)
            await manager.connect(relayer).rejectProposalWithSignature(
                proposalId,
                "Not good enough",
                deadline,
                signature
            );

            const clawgerBalanceAfter = await clgr.balanceOf(clawger.address);
            const burnBalanceAfter = await clgr.balanceOf("0x000000000000000000000000000000000000dEaD");

            // Verify 50/50 split
            const expectedBurn = PROPOSAL_BOND * 50n / 100n;
            const expectedToClawger = PROPOSAL_BOND - expectedBurn;

            expect(burnBalanceAfter - burnBalanceBefore).to.equal(expectedBurn);
            expect(clawgerBalanceAfter - clawgerBalanceBefore).to.equal(expectedToClawger);
        });

        it("Should refund escrow to proposer on rejection", async function () {
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            const value = {
                proposalId: Number(proposalId),
                reason: "Rejected",
                deadline: deadline
            };

            const signature = await clawger.signTypedData(domain, rejectTypes, value);

            const proposerBalanceBefore = await clgr.balanceOf(proposer.address);

            await manager.connect(relayer).rejectProposalWithSignature(
                proposalId,
                "Rejected",
                deadline,
                signature
            );

            const proposerBalanceAfter = await clgr.balanceOf(proposer.address);

            // Escrow refunded
            expect(proposerBalanceAfter - proposerBalanceBefore).to.equal(ESCROW_AMOUNT);
        });
    });

    describe("4. Replay Protection", function () {
        let proposalId: bigint;

        beforeEach(async function () {
            const tx = await manager.connect(proposer).submitProposal(
                "Test objective",
                ESCROW_AMOUNT,
                Math.floor(Date.now() / 1000) + 86400
            );
            const receipt = await tx.wait();
            proposalId = receipt?.logs[2]?.topics[1] ? BigInt(receipt.logs[2].topics[1]) : 1n;
        });

        it("Should prevent signature replay on accept", async function () {
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            const value = {
                proposalId: Number(proposalId),
                worker: worker.address,
                verifier: verifier.address,
                workerBond: WORKER_BOND,
                deadline: deadline
            };

            const signature = await clawger.signTypedData(domain, acceptTypes, value);

            // First submission succeeds
            await manager.connect(proposer).acceptProposalWithSignature(
                proposalId,
                worker.address,
                verifier.address,
                WORKER_BOND,
                deadline,
                signature
            );

            // Second submission fails
            await expect(
                manager.connect(attacker).acceptProposalWithSignature(
                    proposalId,
                    worker.address,
                    verifier.address,
                    WORKER_BOND,
                    deadline,
                    signature
                )
            ).to.be.revertedWith("Already processed");
        });

        it("Should prevent signature replay on reject", async function () {
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            const value = {
                proposalId: Number(proposalId),
                reason: "Rejected",
                deadline: deadline
            };

            const signature = await clawger.signTypedData(domain, rejectTypes, value);

            await manager.connect(relayer).rejectProposalWithSignature(
                proposalId,
                "Rejected",
                deadline,
                signature
            );

            await expect(
                manager.connect(attacker).rejectProposalWithSignature(
                    proposalId,
                    "Rejected",
                    deadline,
                    signature
                )
            ).to.be.revertedWith("Already processed");
        });
    });

    describe("5. Signature Expiry", function () {
        let proposalId: bigint;

        beforeEach(async function () {
            const tx = await manager.connect(proposer).submitProposal(
                "Test objective",
                ESCROW_AMOUNT,
                Math.floor(Date.now() / 1000) + 86400
            );
            const receipt = await tx.wait();
            proposalId = receipt?.logs[2]?.topics[1] ? BigInt(receipt.logs[2].topics[1]) : 1n;
        });

        it("Should reject expired accept signature", async function () {
            const deadline = Math.floor(Date.now() / 1000) - 1; // Past
            const value = {
                proposalId: Number(proposalId),
                worker: worker.address,
                verifier: verifier.address,
                workerBond: WORKER_BOND,
                deadline: deadline
            };

            const signature = await clawger.signTypedData(domain, acceptTypes, value);

            await expect(
                manager.connect(proposer).acceptProposalWithSignature(
                    proposalId,
                    worker.address,
                    verifier.address,
                    WORKER_BOND,
                    deadline,
                    signature
                )
            ).to.be.revertedWith("Signature expired");
        });

        it("Should reject expired reject signature", async function () {
            const deadline = Math.floor(Date.now() / 1000) - 1;
            const value = {
                proposalId: Number(proposalId),
                reason: "Rejected",
                deadline: deadline
            };

            const signature = await clawger.signTypedData(domain, rejectTypes, value);

            await expect(
                manager.connect(relayer).rejectProposalWithSignature(
                    proposalId,
                    "Rejected",
                    deadline,
                    signature
                )
            ).to.be.revertedWith("Signature expired");
        });
    });

    describe("6. Invalid Signature", function () {
        let proposalId: bigint;

        beforeEach(async function () {
            const tx = await manager.connect(proposer).submitProposal(
                "Test objective",
                ESCROW_AMOUNT,
                Math.floor(Date.now() / 1000) + 86400
            );
            const receipt = await tx.wait();
            proposalId = receipt?.logs[2]?.topics[1] ? BigInt(receipt.logs[2].topics[1]) : 1n;
        });

        it("Should reject signature from non-CLAWGER (accept)", async function () {
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            const value = {
                proposalId: Number(proposalId),
                worker: worker.address,
                verifier: verifier.address,
                workerBond: WORKER_BOND,
                deadline: deadline
            };

            // Attacker signs instead of CLAWGER
            const signature = await attacker.signTypedData(domain, acceptTypes, value);

            await expect(
                manager.connect(proposer).acceptProposalWithSignature(
                    proposalId,
                    worker.address,
                    verifier.address,
                    WORKER_BOND,
                    deadline,
                    signature
                )
            ).to.be.revertedWith("Invalid signature");
        });

        it("Should reject signature from non-CLAWGER (reject)", async function () {
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            const value = {
                proposalId: Number(proposalId),
                reason: "Rejected",
                deadline: deadline
            };

            // Attacker signs
            const signature = await attacker.signTypedData(domain, rejectTypes, value);

            await expect(
                manager.connect(relayer).rejectProposalWithSignature(
                    proposalId,
                    "Rejected",
                    deadline,
                    signature
                )
            ).to.be.revertedWith("Invalid signature");
        });
    });

    describe("7. Full Lifecycle with Signatures", function () {
        it("Should complete full task lifecycle with gasless accept", async function () {
            // 1. Submit proposal
            const tx1 = await manager.connect(proposer).submitProposal(
                "Test objective",
                ESCROW_AMOUNT,
                Math.floor(Date.now() / 1000) + 86400
            );
            const receipt1 = await tx1.wait();
            const proposalId = receipt1?.logs[2]?.topics[1] ? BigInt(receipt1.logs[2].topics[1]) : 1n;

            // 2. CLAWGER signs acceptance (off-chain)
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            const value = {
                proposalId: Number(proposalId),
                worker: worker.address,
                verifier: verifier.address,
                workerBond: WORKER_BOND,
                deadline: deadline
            };
            const signature = await clawger.signTypedData(domain, acceptTypes, value);

            // 3. Relayer submits acceptance (pays gas)
            const clawgerGasBalanceBefore = await ethers.provider.getBalance(clawger.address);

            await manager.connect(relayer).acceptProposalWithSignature(
                proposalId,
                worker.address,
                verifier.address,
                WORKER_BOND,
                deadline,
                signature
            );

            const clawgerGasBalanceAfter = await ethers.provider.getBalance(clawger.address);

            // CLAWGER paid no gas
            expect(clawgerGasBalanceAfter).to.equal(clawgerGasBalanceBefore);

            // 4. Worker posts bond
            await manager.connect(worker).postWorkerBond(1);

            // 5. Worker completes task
            await manager.connect(worker).startTask(1);
            await manager.connect(worker).submitWork(1);

            // 6. Verifier settles
            const workerBalanceBefore = await clgr.balanceOf(worker.address);

            await manager.connect(verifier).verifyTask(1, true);

            const workerBalanceAfter = await clgr.balanceOf(worker.address);

            // Worker got escrow + bond
            expect(workerBalanceAfter - workerBalanceBefore).to.equal(ESCROW_AMOUNT + WORKER_BOND);
        });
    });

    describe("8. View Functions", function () {
        it("Should return correct domain separator", async function () {
            const domainSeparator = await manager.getDomainSeparator();
            expect(domainSeparator).to.have.lengthOf(66); // 0x + 64 hex chars
        });

        it("Should return correct accept proposal hash", async function () {
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            const hash = await manager.getAcceptProposalHash(
                1,
                worker.address,
                verifier.address,
                WORKER_BOND,
                deadline
            );
            expect(hash).to.have.lengthOf(66);
        });

        it("Should return correct reject proposal hash", async function () {
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            const hash = await manager.getRejectProposalHash(
                1,
                "Rejected",
                deadline
            );
            expect(hash).to.have.lengthOf(66);
        });
    });
});
