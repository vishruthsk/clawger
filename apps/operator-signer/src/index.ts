import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { signAcceptProposal, signRejectProposal } from './signer';
import { checkSafetyLimits } from './safety';
import { logSignature } from './logger';
import { initDatabase } from './db';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting: 10 requests per minute per IP
const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: parseInt(process.env.RATE_LIMIT_PER_MINUTE || '10'),
    message: 'Too many signature requests, please try again later.',
});

app.use('/sign', limiter);

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'operator-signer',
        timestamp: new Date().toISOString(),
        signer: process.env.OPERATOR_ADDRESS,
    });
});

// POST /sign/accept - Sign proposal acceptance
app.post('/sign/accept', async (req, res) => {
    try {
        const { proposalId, worker, verifier, workerBond, deadline } = req.body;

        // Validate inputs
        if (!proposalId || !worker || !verifier || !workerBond || !deadline) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Safety checks
        const safetyCheck = await checkSafetyLimits({ proposalId, workerBond });
        if (!safetyCheck.safe) {
            return res.status(403).json({ error: safetyCheck.reason });
        }

        // Sign the message
        const result = await signAcceptProposal({
            proposalId,
            worker,
            verifier,
            workerBond,
            deadline,
        });

        // Log signature
        await logSignature({
            proposalId,
            action: 'accept',
            signature: result.signature,
            worker,
            verifier,
            workerBond,
        });

        res.json(result);
    } catch (error: any) {
        console.error('Error signing accept:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /sign/reject - Sign proposal rejection
app.post('/sign/reject', async (req, res) => {
    try {
        const { proposalId, reason } = req.body;

        // Validate inputs
        if (!proposalId || !reason) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Sign the rejection
        const result = await signRejectProposal({ proposalId, reason });

        // Log signature
        await logSignature({
            proposalId,
            action: 'reject',
            signature: result.signature,
            reason,
        });

        res.json(result);
    } catch (error: any) {
        console.error('Error signing reject:', error);
        res.status(500).json({ error: error.message });
    }
});

// Initialize database and start server
async function start() {
    try {
        await initDatabase();
        console.log('✅ Database initialized');

        app.listen(PORT, () => {
            console.log(`🚀 Operator Signer running on port ${PORT}`);
            console.log(`   Signer address: ${process.env.OPERATOR_ADDRESS}`);
            console.log(`   Manager: ${process.env.MANAGER_ADDRESS}`);
            console.log(`   Rate limit: ${process.env.RATE_LIMIT_PER_MINUTE || 10}/min`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

start();
