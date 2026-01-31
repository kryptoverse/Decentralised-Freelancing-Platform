-- Supabase Database Schema for Blockchain Caching
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  job_id BIGINT PRIMARY KEY,
  client_address TEXT NOT NULL,
  title TEXT NOT NULL,
  description_uri TEXT,
  description_text TEXT,
  budget_usdc BIGINT NOT NULL,
  status SMALLINT NOT NULL DEFAULT 1,
  hired_freelancer TEXT,
  escrow_address TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  
  -- Metadata
  synced_at TIMESTAMP DEFAULT NOW(),
  blockchain_block BIGINT
);

-- Indexes for jobs
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_client ON jobs(client_address);
CREATE INDEX IF NOT EXISTS idx_jobs_freelancer ON jobs(hired_freelancer);
CREATE INDEX IF NOT EXISTS idx_jobs_created ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_synced ON jobs(synced_at DESC);

-- Freelancer profiles table
CREATE TABLE IF NOT EXISTS freelancer_profiles (
  wallet_address TEXT PRIMARY KEY,
  profile_contract TEXT NOT NULL,
  hourly_rate BIGINT,
  bio TEXT,
  skills TEXT[] DEFAULT '{}',
  portfolio_uri TEXT,
  total_earned BIGINT DEFAULT 0,
  jobs_completed INT DEFAULT 0,
  average_rating NUMERIC(3,2),
  kyc_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  synced_at TIMESTAMP DEFAULT NOW(),
  blockchain_block BIGINT
);

-- Indexes for freelancer_profiles
CREATE INDEX IF NOT EXISTS idx_profiles_active ON freelancer_profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_kyc ON freelancer_profiles(kyc_verified);
CREATE INDEX IF NOT EXISTS idx_profiles_rating ON freelancer_profiles(average_rating DESC);

-- Proposals table
CREATE TABLE IF NOT EXISTS proposals (
  id SERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL,
  freelancer_address TEXT NOT NULL,
  proposal_text TEXT,
  bid_amount BIGINT NOT NULL,
  delivery_days BIGINT NOT NULL,
  applied_at BIGINT NOT NULL,
  status TEXT DEFAULT 'pending',
  
  -- Metadata
  synced_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(job_id, freelancer_address)
);

-- Indexes for proposals
CREATE INDEX IF NOT EXISTS idx_proposals_job ON proposals(job_id);
CREATE INDEX IF NOT EXISTS idx_proposals_freelancer ON proposals(freelancer_address);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);

-- Escrows table
CREATE TABLE IF NOT EXISTS escrows (
  escrow_address TEXT PRIMARY KEY,
  job_id BIGINT NOT NULL,
  client_address TEXT NOT NULL,
  freelancer_address TEXT NOT NULL,
  amount BIGINT NOT NULL,
  
  -- State flags
  delivered BOOLEAN DEFAULT FALSE,
  disputed BOOLEAN DEFAULT FALSE,
  terminal BOOLEAN DEFAULT FALSE,
  
  -- Deadlines
  cancel_end BIGINT,
  delivery_due BIGINT,
  review_due BIGINT,
  
  -- URIs
  last_delivery_uri TEXT,
  last_dispute_uri TEXT,
  
  -- Metadata
  synced_at TIMESTAMP DEFAULT NOW(),
  blockchain_block BIGINT
);

-- Indexes for escrows
CREATE INDEX IF NOT EXISTS idx_escrows_job ON escrows(job_id);
CREATE INDEX IF NOT EXISTS idx_escrows_client ON escrows(client_address);
CREATE INDEX IF NOT EXISTS idx_escrows_freelancer ON escrows(freelancer_address);
CREATE INDEX IF NOT EXISTS idx_escrows_disputed ON escrows(disputed) WHERE disputed = TRUE;
CREATE INDEX IF NOT EXISTS idx_escrows_terminal ON escrows(terminal) WHERE terminal = FALSE;

-- Delivery history table
CREATE TABLE IF NOT EXISTS delivery_history (
  id SERIAL PRIMARY KEY,
  escrow_address TEXT NOT NULL,
  delivery_uri TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  version INT NOT NULL,
  
  -- Metadata
  synced_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for delivery_history
CREATE INDEX IF NOT EXISTS idx_delivery_escrow ON delivery_history(escrow_address);
CREATE INDEX IF NOT EXISTS idx_delivery_timestamp ON delivery_history(timestamp DESC);

-- Sync status table
CREATE TABLE IF NOT EXISTS sync_status (
  contract_name TEXT PRIMARY KEY,
  last_synced_block BIGINT NOT NULL DEFAULT 0,
  last_synced_at TIMESTAMP DEFAULT NOW(),
  sync_errors INT DEFAULT 0,
  last_error TEXT
);

-- Insert initial sync status records
INSERT INTO sync_status (contract_name, last_synced_block) VALUES
  ('JobBoard', 0),
  ('FreelancerProfile', 0),
  ('JobEscrow', 0)
ON CONFLICT (contract_name) DO NOTHING;

-- Row Level Security (RLS) Policies
-- Enable RLS on all tables
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE freelancer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrows ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_status ENABLE ROW LEVEL SECURITY;

-- Public read access for all tables (since blockchain data is public)
CREATE POLICY "Public read access" ON jobs FOR SELECT USING (true);
CREATE POLICY "Public read access" ON freelancer_profiles FOR SELECT USING (true);
CREATE POLICY "Public read access" ON proposals FOR SELECT USING (true);
CREATE POLICY "Public read access" ON escrows FOR SELECT USING (true);
CREATE POLICY "Public read access" ON delivery_history FOR SELECT USING (true);
CREATE POLICY "Public read access" ON sync_status FOR SELECT USING (true);

-- Only service role can write (sync service)
-- This is enforced by using service role key in sync operations

-- Comments for documentation
COMMENT ON TABLE jobs IS 'Cached job postings from JobBoard contract';
COMMENT ON TABLE freelancer_profiles IS 'Cached freelancer profile data';
COMMENT ON TABLE proposals IS 'Cached job proposals/applications';
COMMENT ON TABLE escrows IS 'Cached escrow contract states';
COMMENT ON TABLE delivery_history IS 'Cached work delivery submissions';
COMMENT ON TABLE sync_status IS 'Tracks blockchain sync progress for each contract';
