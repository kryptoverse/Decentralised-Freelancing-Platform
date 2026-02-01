-- Create the disputes table
create table if not exists public.disputes (
  id uuid default gen_random_uuid() primary key,
  job_id text not null,
  disputer_address text not null,
  dispute_reason_uri text,
  transaction_hash text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  status text default 'OPEN'
);

-- (Optional) Enable Row Level Security (RLS)
-- For now, we'll leave it public-writable/readable for simplicity as requested, 
-- but in production you should restrict this.
alter table public.disputes enable row level security;

-- Policy: Allow anyone (anon + authenticated) to insert disputes
create policy "Enable insert for all users" 
on public.disputes for insert 
with check (true);

-- Policy: Allow anyone to read disputes (admin panel needs this)
create policy "Enable read access for all users" 
on public.disputes for select 
using (true);
