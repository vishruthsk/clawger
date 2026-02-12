import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getPool } from './db';

dotenv.config();

const app = express();
const PORT = process.env.API_PORT || 3003;
const pool = getPool();

app.use(cors());
app.use(express.json());

// GET /agents - List all agents
app.get('/agents', async (req, res) => {
    try {
        const { type, active } = req.query;
        let query = 'SELECT * FROM agents WHERE 1=1';
        const params: any[] = [];

        if (type) {
            params.push(type);
            query += ` AND agent_type = $${params.length}`;
        }

        if (active !== undefined) {
            params.push(active === 'true');
            query += ` AND active = $${params.length}`;
        }

        query += ' ORDER BY reputation DESC';

        const result = await pool.query(query, params);
        res.json({ agents: result.rows });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// GET /agents/:address - Get specific agent
app.get('/agents/:address', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM agents WHERE address = $1', [req.params.address]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Agent not found' });
        }
        res.json(result.rows[0]);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// GET /proposals - List all proposals
app.get('/proposals', async (req, res) => {
    try {
        const { status, proposer } = req.query;
        let query = 'SELECT * FROM proposals WHERE 1=1';
        const params: any[] = [];

        if (status) {
            params.push(status);
            query += ` AND status = $${params.length}`;
        }

        if (proposer) {
            params.push(proposer);
            query += ` AND proposer = $${params.length}`;
        }

        query += ' ORDER BY created_at DESC';

        const result = await pool.query(query, params);
        res.json({ proposals: result.rows });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// GET /proposals/:id - Get specific proposal with task
app.get('/proposals/:id', async (req, res) => {
    try {
        const proposal = await pool.query('SELECT * FROM proposals WHERE id = $1', [req.params.id]);
        if (proposal.rows.length === 0) {
            return res.status(404).json({ error: 'Proposal not found' });
        }

        const task = await pool.query('SELECT * FROM tasks WHERE proposal_id = $1', [req.params.id]);

        res.json({
            ...proposal.rows[0],
            task: task.rows[0] || null,
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// GET /tasks - List all tasks
app.get('/tasks', async (req, res) => {
    try {
        const { status, worker, verifier } = req.query;
        let query = 'SELECT * FROM tasks WHERE 1=1';
        const params: any[] = [];

        if (status) {
            params.push(status);
            query += ` AND status = $${params.length}`;
        }

        if (worker) {
            params.push(worker);
            query += ` AND worker = $${params.length}`;
        }

        if (verifier) {
            params.push(verifier);
            query += ` AND verifier = $${params.length}`;
        }

        query += ' ORDER BY created_at DESC';

        const result = await pool.query(query, params);
        res.json({ tasks: result.rows });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// GET /tasks/:id - Get specific task
app.get('/tasks/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json(result.rows[0]);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// GET /reputation/:address - Get reputation history
app.get('/reputation/:address', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM reputation_updates WHERE agent = $1 ORDER BY updated_at DESC',
            [req.params.address]
        );
        res.json({ history: result.rows });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'indexer-api',
        timestamp: new Date().toISOString(),
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Indexer API running on port ${PORT}`);
});
