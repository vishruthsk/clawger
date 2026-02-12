/**
 * Demo Seed Data
 * 
 * High-quality demo agents and missions for UX/onboarding.
 * 
 * CRITICAL RULES:
 * - This data is IN-MEMORY ONLY
 * - NEVER written to Postgres
 * - NEVER indexed by the indexer
 * - Only served when DEMO_MODE=true
 * - All objects tagged with demo: true
 */

export interface DemoAgent {
    id: string;
    name: string;
    type: 'worker' | 'verifier';
    specialties: string[];
    reputation: number;
    available: boolean;
    hourly_rate: number;
    min_fee: number;
    min_bond: number;
    registered_at: string;
    demo: true; // CRITICAL: Always true
    tags?: string[]; // Filter tags: Automation, Research, Coding, Security, Design, DeFi, Analytics
    // Additional fields for richer profiles
    jobs_completed?: number;
    total_earnings?: number;
    success_rate?: number;
    total_value_secured?: number;
    reputation_breakdown?: {
        base: number;
        settlements: number;
        ratings: number;
        failures: number;
        total: number;
    };
    job_history?: Array<{
        id: string;
        title: string;
        completed_at: string;
        reward: number;
        rating: number;
    }>;
}

export interface DemoMission {
    id: string;
    title: string;
    description: string;
    reward: number;
    status: string;
    assignment_mode: 'autopilot' | 'bidding';
    requester_id: string;
    posted_at: string;
    specialties: string[];
    requirements: string[];
    deliverables: string[];
    tags: string[]; // Standardized: Automation, Research, Coding, Security, Design, DeFi, Analytics
    escrow: {
        locked: boolean;
        amount: number;
    };
    crew?: Array<{
        agent_id: string;
        agent_name: string;
        role: 'worker' | 'verifier';
        assigned_at: string;
    }>;
    timeline?: Array<{
        event: string;
        timestamp: string;
        status: 'completed' | 'in_progress' | 'pending';
    }>;
    demo: true; // CRITICAL: Always true
}

// ============================================
// DEMO AGENTS (10 total: 7 workers + 3 verifiers)
// ============================================

export const DEMO_AGENTS: DemoAgent[] = [
    // Worker Agents - VARIED REPUTATION TIERS
    {
        id: 'DEMO-AG7X2M',
        name: '[Test Bot] CodeCraft AI',
        type: 'worker',
        specialties: ['Smart Contracts', 'Solidity', 'Security'],
        tags: ['Coding', 'Security', 'DeFi'],
        reputation: 95, // GOLD
        available: true,
        hourly_rate: 50,
        min_fee: 100,
        min_bond: 50,
        registered_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        demo: true,
        jobs_completed: 5,
        total_earnings: 3100,
        success_rate: 100,
        total_value_secured: 6000,
        reputation_breakdown: {
            base: 50,
            settlements: 35,
            ratings: 10,
            failures: 0,
            total: 95
        },
        job_history: [
            { id: 'j1a2b', title: 'Smart Contract Audit', completed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), reward: 500, rating: 5 },
            { id: 'j3c4d', title: 'DeFi Protocol Review', completed_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), reward: 750, rating: 5 },
            { id: 'j5e6f', title: 'NFT Contract Development', completed_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), reward: 600, rating: 5 },
            { id: 'j7g8h', title: 'Token Economics Design', completed_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), reward: 450, rating: 5 },
            { id: 'j9i0j', title: 'DAO Governance Contract', completed_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(), reward: 800, rating: 5 },
        ],
    },
    {
        id: 'DEMO-BK4P9N',
        name: '[Test Bot] DataMiner X',
        type: 'worker',
        specialties: ['Data Analysis', 'Web Scraping', 'ETL'],
        tags: ['Analytics', 'Research', 'Automation'],
        reputation: 72, // SILVER
        available: true,
        hourly_rate: 35,
        min_fee: 75,
        min_bond: 40,
        registered_at: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000).toISOString(),
        demo: true,
        jobs_completed: 4,
        total_earnings: 1300,
        success_rate: 100,
        total_value_secured: 2500,
        reputation_breakdown: {
            base: 50,
            settlements: 18,
            ratings: 4,
            failures: 0,
            total: 72
        },
        job_history: [
            { id: 'jk1l2', title: 'Market Data Scraping', completed_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), reward: 300, rating: 5 },
            { id: 'jm3n4', title: 'Competitor Analysis', completed_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), reward: 400, rating: 5 },
            { id: 'jo5p6', title: 'Price Feed Aggregation', completed_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(), reward: 250, rating: 5 },
            { id: 'jq7r8', title: 'Social Media Analytics', completed_at: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(), reward: 350, rating: 5 },
        ],
    },
    {
        id: 'DEMO-CX8T5W',
        name: '[Test Bot] DesignBot Pro',
        type: 'worker',
        specialties: ['Graphic Design', 'UI/UX', 'Branding'],
        tags: ['Design'],
        reputation: 35, // BRONZE (adjusted for tier diversity)
        available: true,
        hourly_rate: 45,
        min_fee: 90,
        min_bond: 45,
        registered_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        demo: true,
        jobs_completed: 5,
        total_earnings: 1850,
        success_rate: 100,
        total_value_secured: 3500,
        reputation_breakdown: {
            base: 50,
            settlements: -18, // Negative to bring total to 35
            ratings: 3,
            failures: 0,
            total: 35
        },
        job_history: [
            { id: 'js9t0', title: 'Brand Identity Design', completed_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), reward: 550, rating: 5 },
            { id: 'ju1v2', title: 'UI Mockups', completed_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), reward: 350, rating: 5 },
            { id: 'jw3x4', title: 'Logo Design', completed_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), reward: 200, rating: 4 },
            { id: 'jy5z6', title: 'Marketing Materials', completed_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(), reward: 300, rating: 5 },
            { id: 'ja7b8', title: 'Website Redesign', completed_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(), reward: 450, rating: 5 },
        ],
    },
    {
        id: 'DEMO-DQ2H7K',
        name: '[Test Bot] SecBot 9000',
        type: 'worker',
        specialties: ['Cybersecurity', 'Penetration Testing', 'Security Audit'],
        tags: ['Security', 'Coding'],
        reputation: 97, // GOLD
        available: true,
        hourly_rate: 60,
        min_fee: 120,
        min_bond: 60,
        registered_at: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
        demo: true,
        jobs_completed: 5,
        total_earnings: 4050,
        success_rate: 100,
        total_value_secured: 8000,
        reputation_breakdown: {
            base: 50,
            settlements: 38,
            ratings: 9,
            failures: 0,
            total: 97
        },
        job_history: [
            { id: 'jc9d0', title: 'Security Vulnerability Scan', completed_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), reward: 800, rating: 5 },
            { id: 'je1f2', title: 'Penetration Test', completed_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), reward: 1000, rating: 5 },
            { id: 'jg3h4', title: 'Infrastructure Audit', completed_at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(), reward: 900, rating: 5 },
            { id: 'ji5j6', title: 'Smart Contract Security Review', completed_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), reward: 750, rating: 5 },
            { id: 'jk7l8', title: 'Network Security Assessment', completed_at: new Date(Date.now() - 19 * 24 * 60 * 60 * 1000).toISOString(), reward: 600, rating: 5 },
        ],
    },
    {
        id: 'DEMO-EM9R3V',
        name: '[Test Bot] ContentWriter AI',
        type: 'worker',
        specialties: ['Technical Writing', 'Documentation', 'Copywriting'],
        tags: ['Research'],
        reputation: 28, // BRONZE (adjusted for tier diversity)
        available: true,
        hourly_rate: 30,
        min_fee: 60,
        min_bond: 30,
        registered_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
        demo: true,
        jobs_completed: 4,
        total_earnings: 930,
        success_rate: 100,
        total_value_secured: 1800,
        reputation_breakdown: {
            base: 50,
            settlements: -24, // Negative to bring total to 28
            ratings: 2,
            failures: 0,
            total: 28
        },
        job_history: [
            { id: 'jm9n0', title: 'Technical Documentation', completed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), reward: 250, rating: 5 },
            { id: 'jo1p2', title: 'API Documentation', completed_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), reward: 300, rating: 5 },
            { id: 'jq3r4', title: 'User Guide Creation', completed_at: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000).toISOString(), reward: 200, rating: 5 },
            { id: 'js5t6', title: 'Blog Post Series', completed_at: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000).toISOString(), reward: 180, rating: 5 },
        ],
    },
    {
        id: 'DEMO-FN6W4Y',
        name: '[Test Bot] Frontend Wizard',
        type: 'worker',
        specialties: ['Frontend Development', 'React', 'TypeScript'],
        tags: ['Coding', 'Design'],
        reputation: 65, // SILVER (adjusted for tier diversity)
        available: true,
        hourly_rate: 40,
        min_fee: 80,
        min_bond: 40,
        registered_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        demo: true,
        jobs_completed: 4,
        total_earnings: 1700,
        success_rate: 100,
        total_value_secured: 3200,
        reputation_breakdown: {
            base: 50,
            settlements: 9, // Adjusted to bring total to 65
            ratings: 6,
            failures: 0,
            total: 65
        },
        job_history: [
            { id: 'ju7v8', title: 'React Dashboard', completed_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), reward: 450, rating: 5 },
            { id: 'jw9x0', title: 'Component Library', completed_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), reward: 400, rating: 5 },
            { id: 'jy1z2', title: 'E-commerce Frontend', completed_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(), reward: 500, rating: 5 },
            { id: 'ja3b4', title: 'Admin Panel UI', completed_at: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000).toISOString(), reward: 350, rating: 5 },
        ],
    },
    {
        id: 'DEMO-GP5Z8A',
        name: '[Test Bot] Backend Master',
        type: 'worker',
        specialties: ['Backend Development', 'Node.js', 'PostgreSQL'],
        tags: ['Coding'],
        reputation: 88, // GOLD
        available: true,
        hourly_rate: 45,
        min_fee: 90,
        min_bond: 45,
        registered_at: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString(),
        demo: true,
        jobs_completed: 5,
        total_earnings: 2300,
        success_rate: 100,
        total_value_secured: 4500,
        reputation_breakdown: {
            base: 50,
            settlements: 30,
            ratings: 8,
            failures: 0,
            total: 88
        },
        job_history: [
            { id: 'jc5d6', title: 'API Development', completed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), reward: 500, rating: 5 },
            { id: 'je7f8', title: 'Database Optimization', completed_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), reward: 350, rating: 5 },
            { id: 'jg9h0', title: 'Microservices Architecture', completed_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), reward: 600, rating: 5 },
            { id: 'ji1j2', title: 'GraphQL API', completed_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), reward: 450, rating: 5 },
            { id: 'jk3l4', title: 'Authentication System', completed_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(), reward: 400, rating: 5 },
        ],
    },

    // Verifier Agents
    {
        id: 'DEMO-HQ8B1C',
        name: '[Test Bot] AuditMaster',
        type: 'verifier',
        specialties: ['Code Review', 'Security Audit', 'Quality Assurance'],
        tags: ['Security', 'Coding'],
        reputation: 98, // GOLD
        available: true,
        hourly_rate: 55,
        min_fee: 110,
        min_bond: 55,
        registered_at: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(),
        demo: true,
        jobs_completed: 5,
        total_earnings: 3350,
        success_rate: 100,
        total_value_secured: 6500,
        reputation_breakdown: {
            base: 50,
            settlements: 40,
            ratings: 8,
            failures: 0,
            total: 98
        },
        job_history: [
            { id: 'jm5n6', title: 'Smart Contract Verification', completed_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), reward: 600, rating: 5 },
            { id: 'jo7p8', title: 'Security Audit Review', completed_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), reward: 700, rating: 5 },
            { id: 'jq9r0', title: 'Code Quality Assessment', completed_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), reward: 550, rating: 5 },
            { id: 'js1t2', title: 'Protocol Security Review', completed_at: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString(), reward: 650, rating: 5 },
            { id: 'ju3v4', title: 'DeFi Audit', completed_at: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(), reward: 850, rating: 5 },
        ],
    },
    {
        id: 'DEMO-IR7D2E',
        name: '[Test Bot] QA Guardian',
        type: 'verifier',
        specialties: ['Testing', 'Quality Assurance', 'Bug Detection'],
        tags: ['Coding', 'Automation'],
        reputation: 58, // SILVER (adjusted for tier diversity)
        available: true,
        hourly_rate: 40,
        min_fee: 80,
        min_bond: 40,
        registered_at: new Date(Date.now() - 80 * 24 * 60 * 60 * 1000).toISOString(),
        demo: true,
        jobs_completed: 4,
        total_earnings: 1500,
        success_rate: 100,
        total_value_secured: 2800,
        reputation_breakdown: {
            base: 50,
            settlements: 4, // Adjusted to bring total to 58
            ratings: 4,
            failures: 0,
            total: 58
        },
        job_history: [
            { id: 'jw5x6', title: 'QA Testing', completed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), reward: 400, rating: 5 },
            { id: 'jy7z8', title: 'Bug Verification', completed_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), reward: 300, rating: 5 },
            { id: 'ja9b0', title: 'Integration Testing', completed_at: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000).toISOString(), reward: 350, rating: 5 },
            { id: 'jc1d2', title: 'Performance Testing', completed_at: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000).toISOString(), reward: 450, rating: 5 },
        ],
    },
    {
        id: 'DEMO-JS4F3G',
        name: '[Test Bot] TestBot Alpha',
        type: 'verifier',
        specialties: ['Automated Testing', 'CI/CD', 'Test Coverage'],
        tags: ['Automation', 'Coding'],
        reputation: 38, // BRONZE (adjusted for tier diversity)
        available: true,
        hourly_rate: 35,
        min_fee: 70,
        min_bond: 35,
        registered_at: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000).toISOString(),
        demo: true,
        jobs_completed: 4,
        total_earnings: 1300,
        success_rate: 100,
        total_value_secured: 2400,
        reputation_breakdown: {
            base: 50,
            settlements: -13, // Negative to bring total to 38
            ratings: 1,
            failures: 0,
            total: 38
        },
        job_history: [
            { id: 'je3f4', title: 'Unit Test Suite', completed_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), reward: 350, rating: 5 },
            { id: 'jg5h6', title: 'E2E Test Automation', completed_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), reward: 400, rating: 5 },
            { id: 'ji7j8', title: 'CI/CD Pipeline Setup', completed_at: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString(), reward: 300, rating: 5 },
            { id: 'jk9l0', title: 'Test Coverage Analysis', completed_at: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(), reward: 250, rating: 5 },
        ],
    },
];

// ============================================
// DEMO MISSIONS (45 total, various states)
// ============================================

const DEMO_REQUESTER = 'demo_requester_wallet';
const baseTime = Date.now();

export const DEMO_MISSIONS: DemoMission[] = [
    // Completed missions (showing success)
    {
        id: 'DEMO-MX7K2P',
        title: 'Deploy CLAWGER Protocol V1',
        description: 'Initial deployment and verification of the core protocol contracts.',
        reward: 5000,
        status: 'paid',
        assignment_mode: 'autopilot',
        requester_id: 'system',
        posted_at: new Date(baseTime - 10 * 24 * 60 * 60 * 1000).toISOString(),
        specialties: ['Smart Contracts'],
        requirements: ['Solidity', 'Security Audit'],
        deliverables: ['Contract Address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb', 'Verification Report', 'Gas Optimization Analysis'],
        tags: ['Coding', 'Security', 'DeFi'],
        escrow: { locked: true, amount: 5000 },
        crew: [
            { agent_id: 'DEMO-AG7X2M', agent_name: '[Test Bot] CodeCraft AI', role: 'worker', assigned_at: new Date(baseTime - 9 * 24 * 60 * 60 * 1000).toISOString() },
            { agent_id: 'DEMO-CX8T5W', agent_name: '[Test Bot] AuditMaster', role: 'verifier', assigned_at: new Date(baseTime - 9 * 24 * 60 * 60 * 1000).toISOString() }
        ],
        timeline: [
            { event: 'Mission Posted', timestamp: new Date(baseTime - 10 * 24 * 60 * 60 * 1000).toISOString(), status: 'completed' },
            { event: 'Worker Assigned', timestamp: new Date(baseTime - 9 * 24 * 60 * 60 * 1000).toISOString(), status: 'completed' },
            { event: 'Deployment Started', timestamp: new Date(baseTime - 8 * 24 * 60 * 60 * 1000).toISOString(), status: 'completed' },
            { event: 'Contracts Deployed', timestamp: new Date(baseTime - 7 * 24 * 60 * 60 * 1000).toISOString(), status: 'completed' },
            { event: 'Verification Complete', timestamp: new Date(baseTime - 6 * 24 * 60 * 60 * 1000).toISOString(), status: 'completed' },
            { event: 'Payment Released', timestamp: new Date(baseTime - 6 * 24 * 60 * 60 * 1000).toISOString(), status: 'completed' }
        ],
        demo: true,
    },
    {
        id: 'DEMO-Z3Q9V4',
        title: 'Build Authentication API',
        description: 'Create JWT-based auth system with refresh tokens',
        reward: 800,
        status: 'paid',
        assignment_mode: 'bidding',
        requester_id: DEMO_REQUESTER,
        posted_at: new Date(baseTime - 8 * 24 * 60 * 60 * 1000).toISOString(),
        specialties: ['Backend Development'],
        requirements: ['High quality', 'Production ready'],
        deliverables: ['GitHub Repository Link', 'API Documentation', 'Postman Collection', 'Unit Tests (95% coverage)'],
        tags: ['Coding', 'Security'],
        escrow: { locked: true, amount: 800 },
        crew: [
            { agent_id: 'DEMO-BK4P9N', agent_name: '[Test Bot] Backend Master', role: 'worker', assigned_at: new Date(baseTime - 7 * 24 * 60 * 60 * 1000).toISOString() }
        ],
        timeline: [
            { event: 'Mission Posted', timestamp: new Date(baseTime - 8 * 24 * 60 * 60 * 1000).toISOString(), status: 'completed' },
            { event: 'Bidding Closed', timestamp: new Date(baseTime - 7 * 24 * 60 * 60 * 1000).toISOString(), status: 'completed' },
            { event: 'Development Started', timestamp: new Date(baseTime - 7 * 24 * 60 * 60 * 1000).toISOString(), status: 'completed' },
            { event: 'Code Submitted', timestamp: new Date(baseTime - 5 * 24 * 60 * 60 * 1000).toISOString(), status: 'completed' },
            { event: 'Review Approved', timestamp: new Date(baseTime - 4 * 24 * 60 * 60 * 1000).toISOString(), status: 'completed' },
            { event: 'Payment Released', timestamp: new Date(baseTime - 4 * 24 * 60 * 60 * 1000).toISOString(), status: 'completed' }
        ],
        demo: true,
    },

    // Executing missions (showing active work)
    {
        id: 'DEMO-P8W2N5',
        title: 'Scrape Competitor Pricing',
        description: 'Analyze pricing models of top 5 competitors and structuralize data.',
        reward: 450,
        status: 'executing',
        assignment_mode: 'autopilot',
        requester_id: DEMO_REQUESTER,
        posted_at: new Date(baseTime - 2 * 24 * 60 * 60 * 1000).toISOString(),
        specialties: ['Data Analysis'],
        requirements: ['Structured JSON output', 'Price comparison charts'],
        deliverables: ['Pricing Data (JSON)', 'Competitor Analysis Report', 'Visualization Dashboard'],
        tags: ['Research', 'Analytics', 'Automation'],
        escrow: { locked: true, amount: 450 },
        crew: [
            { agent_id: 'dm5x3r', agent_name: '[Test Bot] DataMiner X', role: 'worker', assigned_at: new Date(baseTime - 1.5 * 24 * 60 * 60 * 1000).toISOString() }
        ],
        timeline: [
            { event: 'Mission Posted', timestamp: new Date(baseTime - 2 * 24 * 60 * 60 * 1000).toISOString(), status: 'completed' },
            { event: 'Worker Assigned', timestamp: new Date(baseTime - 1.5 * 24 * 60 * 60 * 1000).toISOString(), status: 'completed' },
            { event: 'Data Collection Started', timestamp: new Date(baseTime - 1.2 * 24 * 60 * 60 * 1000).toISOString(), status: 'completed' },
            { event: 'Analyzing Competitor #3', timestamp: new Date(baseTime - 0.5 * 24 * 60 * 60 * 1000).toISOString(), status: 'in_progress' },
            { event: 'Generate Final Report', timestamp: new Date(baseTime + 0.5 * 24 * 60 * 60 * 1000).toISOString(), status: 'pending' }
        ],
        demo: true,
    },
    {
        id: 'DEMO-V4M7Q1',
        title: 'Monitor DEX Volume',
        description: 'Real-time monitoring of volume spikes on Uniswap V3 pools for the next 24 hours.',
        reward: 800,
        status: 'executing',
        assignment_mode: 'autopilot',
        requester_id: DEMO_REQUESTER,
        posted_at: new Date(baseTime - 1 * 24 * 60 * 60 * 1000).toISOString(),
        specialties: ['Data Analysis'],
        requirements: ['Real-time alerts', 'Volume threshold detection'],
        deliverables: ['Live Monitoring Dashboard', 'Alert Logs', 'Volume Spike Analysis'],
        tags: ['DeFi', 'Analytics', 'Automation'],
        escrow: { locked: true, amount: 800 },
        crew: [
            { agent_id: 'dm5x3r', agent_name: '[Test Bot] DataMiner X', role: 'worker', assigned_at: new Date(baseTime - 0.8 * 24 * 60 * 60 * 1000).toISOString() }
        ],
        timeline: [
            { event: 'Mission Posted', timestamp: new Date(baseTime - 1 * 24 * 60 * 60 * 1000).toISOString(), status: 'completed' },
            { event: 'Worker Assigned', timestamp: new Date(baseTime - 0.8 * 24 * 60 * 60 * 1000).toISOString(), status: 'completed' },
            { event: 'Monitoring Active', timestamp: new Date(baseTime - 0.7 * 24 * 60 * 60 * 1000).toISOString(), status: 'completed' },
            { event: '12 Volume Spikes Detected', timestamp: new Date(baseTime - 0.2 * 24 * 60 * 60 * 1000).toISOString(), status: 'in_progress' },
            { event: 'Final Report Generation', timestamp: new Date(baseTime + 0.2 * 24 * 60 * 60 * 1000).toISOString(), status: 'pending' }
        ],
        demo: true,
    },

    // Bidding missions (showing marketplace activity)
    {
        id: 'DEMO-K9R3X6',
        title: 'Security Vulnerability Scan',
        description: 'Run automated penetration tests on the staging infrastructure.',
        reward: 2500,
        status: 'bidding_open',
        assignment_mode: 'bidding',
        requester_id: DEMO_REQUESTER,
        posted_at: new Date(baseTime - 6 * 60 * 60 * 1000).toISOString(),
        specialties: ['Cybersecurity'],
        requirements: ['OWASP Top 10 coverage', 'Penetration test report'],
        deliverables: ['Vulnerability Report (PDF)', 'Remediation Recommendations', 'Risk Assessment Matrix'],
        tags: ['Security', 'Research'],
        escrow: { locked: true, amount: 2500 },
        timeline: [
            { event: 'Mission Posted', timestamp: new Date(baseTime - 6 * 60 * 60 * 1000).toISOString(), status: 'completed' },
            { event: 'Bidding Window Open', timestamp: new Date(baseTime - 6 * 60 * 60 * 1000).toISOString(), status: 'in_progress' },
            { event: 'Bidding Closes', timestamp: new Date(baseTime + 18 * 60 * 60 * 1000).toISOString(), status: 'pending' }
        ],
        demo: true,
    },
    {
        id: 'DEMO-H2T8V9',
        title: 'Emergency: Smart Contract Audit',
        description: 'Urgent comprehensive audit of the new Staking V2 vault before mainnet launch.',
        reward: 15000,
        status: 'bidding_open',
        assignment_mode: 'bidding',
        requester_id: DEMO_REQUESTER,
        posted_at: new Date(baseTime - 4 * 60 * 60 * 1000).toISOString(),
        specialties: ['Security Research', 'Solidity'],
        requirements: ['Report', 'PoC'],
        deliverables: ['Full Audit Report', 'Proof of Concept Exploits', 'Gas Optimization Suggestions', 'Security Score'],
        tags: ['Security', 'Coding', 'DeFi'],
        escrow: { locked: true, amount: 15000 },
        timeline: [
            { event: 'Mission Posted', timestamp: new Date(baseTime - 4 * 60 * 60 * 1000).toISOString(), status: 'completed' },
            { event: 'Bidding Window Open', timestamp: new Date(baseTime - 4 * 60 * 60 * 1000).toISOString(), status: 'in_progress' },
            { event: 'Bidding Closes', timestamp: new Date(baseTime + 8 * 60 * 60 * 1000).toISOString(), status: 'pending' }
        ],
        demo: true,
    },

    // Open missions (showing available work)
    {
        id: 'DEMO-N6Y4Z2',
        title: 'Generate Marketing Assets',
        description: 'Create a suite of social media banners for the Q1 campaign.',
        reward: 1200,
        status: 'open',
        assignment_mode: 'bidding',
        requester_id: DEMO_REQUESTER,
        posted_at: new Date(baseTime - 2 * 60 * 60 * 1000).toISOString(),
        specialties: ['Graphic Design'],
        requirements: ['4K resolution', 'Brand guidelines compliance'],
        deliverables: ['10 Social Media Banners', 'Source Files (PSD/Figma)', 'Brand Asset Kit'],
        tags: ['Design'],
        escrow: { locked: true, amount: 1200 },
        timeline: [
            { event: 'Mission Posted', timestamp: new Date(baseTime - 2 * 60 * 60 * 1000).toISOString(), status: 'completed' },
            { event: 'Awaiting Bids', timestamp: new Date(baseTime - 2 * 60 * 60 * 1000).toISOString(), status: 'in_progress' }
        ],
        demo: true,
    },
    {
        id: 'DEMO-Q1W5E8',
        title: 'Write Technical Documentation',
        description: 'Document the new API endpoints for the Agent Registry module.',
        reward: 300,
        status: 'open',
        assignment_mode: 'autopilot',
        requester_id: DEMO_REQUESTER,
        posted_at: new Date(baseTime - 1 * 60 * 60 * 1000).toISOString(),
        specialties: ['Technical Writing'],
        requirements: ['OpenAPI 3.0 spec', 'Code examples'],
        deliverables: ['API Documentation (Markdown)', 'OpenAPI Specification', 'Integration Guide'],
        tags: ['Research', 'Coding'],
        escrow: { locked: true, amount: 300 },
        timeline: [
            { event: 'Mission Posted', timestamp: new Date(baseTime - 1 * 60 * 60 * 1000).toISOString(), status: 'completed' },
            { event: 'Awaiting Assignment', timestamp: new Date(baseTime - 1 * 60 * 60 * 1000).toISOString(), status: 'in_progress' }
        ],
        demo: true,
    },

    // Additional missions for variety (37 more to reach 45 total)
    ...Array.from({ length: 37 }, (_, i) => {
        const missionIds = ['r5t2y7', 'u8i3o6', 'a4s9d1', 'f7g2h5', 'j3k8l4', 'z6x1c9', 'v2b7n3', 'm9q4w8', 'e5r1t6', 'y3u7i2',
            'o8p4a1', 's6d9f3', 'g2h5j7', 'k4l8z1', 'x9c3v6', 'b7n2m5', 'q4w8e1', 'r6t2y9', 'u3i7o4', 'a8s1d6',
            'f3g7h2', 'j9k4l8', 'z1x6c3', 'v7b2n9', 'm4q8w5', 'e1r6t3', 'y7u2i8', 'o4p9a6', 's1d3f7', 'g8h2j4',
            'k6l1z9', 'x3c7v2', 'b9n4m8', 'q6w1e5', 'r2t7y3', 'u9i4o8', 'a6s2d1'];
        const tagSets = [
            ['Coding', 'Design'],
            ['Coding'],
            ['Design', 'Coding'],
            ['Coding'],
            ['Design'],
            ['Design'],
            ['Design'],
            ['Coding', 'Automation'],
            ['Coding', 'Automation'],
            ['Coding', 'DeFi'],
            ['Coding', 'DeFi'],
            ['Coding'],
            ['Coding'],
            ['Coding', 'Analytics'],
            ['Coding'],
            ['Coding'],
            ['Coding'],
            ['Coding'],
            ['Analytics', 'Automation'],
            ['Analytics'],
            ['Coding'],
            ['Coding', 'Automation'],
            ['Coding', 'Automation'],
            ['Coding', 'Automation'],
            ['Research', 'Coding'],
            ['Security'],
            ['Research'],
            ['Analytics'],
            ['Research', 'Analytics'],
            ['Automation'],
            ['Automation', 'Coding'],
            ['Research'],
            ['Research'],
            ['Coding', 'DeFi'],
            ['Coding', 'DeFi'],
            ['Coding'],
            ['Automation', 'Coding'],
        ];

        return {
            id: missionIds[i],
            title: [
                'Frontend Component Library',
                'Dashboard UI Implementation',
                'Animation Library',
                'Form Validation System',
                'Design System Creation',
                'Landing Page Design',
                'Mobile App UI Design',
                'CI/CD Pipeline Setup',
                'Docker Containerization',
                'Kubernetes Deployment',
                'GraphQL API Gateway',
                'Database Migration System',
                'Real-time Chat System',
                'API Rate Limiting',
                'Caching Layer Implementation',
                'Microservices Architecture',
                'Event-Driven Architecture',
                'Message Queue Integration',
                'Monitoring Dashboard',
                'Log Aggregation System',
                'Performance Optimization',
                'Load Testing Suite',
                'E2E Testing Framework',
                'Unit Test Coverage',
                'Integration Tests',
                'Accessibility Audit',
                'SEO Optimization',
                'Analytics Integration',
                'Error Tracking Setup',
                'Feature Flag System',
                'A/B Testing Framework',
                'Internationalization',
                'Localization',
                'Payment Gateway Integration',
                'Subscription Management',
                'Invoice Generation',
                'Email Notification System',
            ][i % 37],
            description: 'High-quality implementation with production-ready code and comprehensive documentation.',
            reward: [600, 800, 1000, 1200, 1400, 1500, 1800, 2000][i % 8],
            status: ['open', 'bidding_open', 'executing'][i % 3],
            assignment_mode: (i % 2 === 0 ? 'autopilot' : 'bidding') as 'autopilot' | 'bidding',
            requester_id: DEMO_REQUESTER,
            posted_at: new Date(baseTime - (i + 1) * 30 * 60 * 1000).toISOString(),
            specialties: [
                ['Frontend Development'],
                ['Backend Development'],
                ['Design'],
                ['DevOps'],
                ['Testing'],
                ['Security'],
            ][i % 6],
            requirements: ['High quality', 'Production ready'],
            deliverables: ['Source code', 'Documentation'],
            tags: tagSets[i],
            escrow: { locked: true, amount: [600, 800, 1000, 1200, 1400, 1500, 1800, 2000][i % 8] },
            demo: true as const,
        };
    }),
];

// Helper to get demo data based on mode
export function getDemoAgents(): DemoAgent[] {
    if (process.env.DEMO_MODE !== 'true') {
        return [];
    }
    return DEMO_AGENTS;
}

export function getDemoMissions(): DemoMission[] {
    if (process.env.DEMO_MODE !== 'true') {
        return [];
    }
    return DEMO_MISSIONS;
}
