-- Agents table
CREATE TABLE IF NOT EXISTS agents (
  address VARCHAR(42) PRIMARY KEY,
  agent_type VARCHAR(20) NOT NULL,
  capabilities JSONB NOT NULL,
  min_fee NUMERIC NOT NULL,
  min_bond NUMERIC NOT NULL,
  operator VARCHAR(42) NOT NULL,
  reputation INTEGER NOT NULL DEFAULT 50,
  active BOOLEAN NOT NULL DEFAULT true,
  registered_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  block_number BIGINT NOT NULL,
  tx_hash VARCHAR(66) NOT NULL
);

-- Proposals table
CREATE TABLE IF NOT EXISTS proposals (
  id BIGINT PRIMARY KEY,
  proposer VARCHAR(42) NOT NULL,
  objective TEXT NOT NULL,
  escrow NUMERIC NOT NULL,
  deadline TIMESTAMP NOT NULL,
  status VARCHAR(20) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  block_number BIGINT NOT NULL,
  tx_hash VARCHAR(66) NOT NULL
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id BIGINT PRIMARY KEY,
  proposal_id BIGINT NOT NULL REFERENCES proposals(id),
  worker VARCHAR(42) NOT NULL,
  verifier VARCHAR(42) NOT NULL,
  escrow NUMERIC NOT NULL,
  worker_bond NUMERIC NOT NULL,
  status VARCHAR(20) NOT NULL,
  settled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  block_number BIGINT NOT NULL,
  tx_hash VARCHAR(66) NOT NULL
);

-- Reputation updates table
CREATE TABLE IF NOT EXISTS reputation_updates (
  id SERIAL PRIMARY KEY,
  agent VARCHAR(42) NOT NULL,
  old_score INTEGER NOT NULL,
  new_score INTEGER NOT NULL,
  reason TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  block_number BIGINT NOT NULL,
  tx_hash VARCHAR(66) NOT NULL
);

-- Indexer state table
CREATE TABLE IF NOT EXISTS indexer_state (
  id INTEGER PRIMARY KEY DEFAULT 1,
  last_block_registry BIGINT NOT NULL DEFAULT 0,
  last_block_manager BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Insert initial state if not exists
INSERT INTO indexer_state (id, last_block_registry, last_block_manager, updated_at)
VALUES (1, 0, 0, NOW())
ON CONFLICT (id) DO NOTHING;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_agents_active ON agents(active);
CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(agent_type);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_proposer ON proposals(proposer);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_worker ON tasks(worker);
CREATE INDEX IF NOT EXISTS idx_tasks_verifier ON tasks(verifier);
CREATE INDEX IF NOT EXISTS idx_reputation_agent ON reputation_updates(agent);
