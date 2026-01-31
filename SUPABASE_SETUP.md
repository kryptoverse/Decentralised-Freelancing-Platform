# Supabase Setup Guide

This guide will help you set up Supabase for blockchain data caching.

## Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Fill in:
   - **Name**: `freelance-dapp-cache` (or any name)
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to your users
5. Click "Create new project" and wait ~2 minutes

## Step 2: Run Database Schema

1. In your Supabase project, go to **SQL Editor** (left sidebar)
2. Click "New Query"
3. Copy the entire contents of `lib/supabase/schema.sql`
4. Paste into the SQL editor
5. Click "Run" (or press Ctrl+Enter)
6. You should see "Success. No rows returned"

This creates all 6 tables with indexes and Row Level Security policies.

## Step 3: Get API Keys

1. Go to **Project Settings** (gear icon in left sidebar)
2. Click **API** in the left menu
3. You'll see:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - **service_role**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (click "Reveal" to see)

## Step 4: Configure Environment Variables

1. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

2. Edit `.env.local` and add your Supabase credentials:
   ```env
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

   # Blockchain Cache Configuration
   ENABLE_DB_CACHE=true
   SYNC_INTERVAL_MS=60000
   CACHE_TTL_MS=300000

   # Cron Secret (generate a random string)
   CRON_SECRET=your-random-secret-here
   ```

3. Generate a random CRON_SECRET:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

## Step 5: Verify Setup

1. Restart your development server:
   ```bash
   npm run dev
   ```

2. Check the console - you should see:
   - No Supabase errors
   - `[Cache MISS]` messages when fetching data (cache is empty initially)

3. Test the jobs API:
   ```
   http://localhost:3000/api/jobs?limit=10
   ```

## Step 6: Initial Data Sync (Coming Next)

Once the event listener service is implemented, it will automatically:
1. Listen for blockchain events
2. Sync data to Supabase
3. Keep cache up-to-date in real-time

For now, the app will work fine using blockchain fallback!

## Troubleshooting

### "Supabase not configured - caching disabled"
- Check that all 3 environment variables are set correctly
- Restart your dev server after adding env vars

### "Failed to fetch from Supabase"
- Verify your API keys are correct
- Check that the schema was run successfully
- Ensure RLS policies are enabled (they allow public read access)

### App not working at all
- The app should still work! It falls back to blockchain automatically
- Check browser console for errors
- Verify `ENABLE_DB_CACHE` is set to `true` or `false` (not empty)

## Next Steps

1. ✅ Supabase project created
2. ✅ Database schema deployed
3. ✅ Environment variables configured
4. ⏳ Event listener service (coming next)
5. ⏳ Background sync job (coming next)
6. ⏳ Frontend migration (coming next)

---

**Note**: The blockchain is still the source of truth. Supabase is only a cache for performance. If Supabase is down, the app continues working by reading directly from the blockchain.
