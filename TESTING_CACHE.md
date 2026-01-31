# Testing the Supabase Blockchain Cache

This guide will help you test the caching system step by step.

## Prerequisites

✅ Supabase project created
✅ Schema deployed
✅ Environment variables configured
✅ Dev server running (`npm run dev`)

---

## Test 1: Verify Cache Connection

**Test the cache stats endpoint:**

```bash
curl http://localhost:3000/api/cache/stats
```

**Expected Response:**
```json
{
  "success": true,
  "cache": {
    "enabled": true,
    "jobs_count": 0,
    "profiles_count": 0,
    "proposals_count": 0,
    "escrows_count": 0,
    "last_sync": {
      "JobBoard": { "block": 0, "time": "2026-02-01T..." },
      "FreelancerProfile": { "block": 0, "time": "2026-02-01T..." },
      "JobEscrow": { "block": 0, "time": "2026-02-01T..." }
    }
  },
  "timestamp": "2026-02-01T..."
}
```

✅ **Success**: `"enabled": true` and all counts are 0 (cache is empty but working)
❌ **Failure**: `"enabled": false` → Check `.env.local` and restart server

---

## Test 2: Manual Sync (If You Have Jobs)

**Sync all existing jobs from blockchain to cache:**

```bash
curl -X POST http://localhost:3000/api/sync/manual \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"all\"}"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Batch sync started in background"
}
```

**Check logs** in your terminal - you should see:
```
[Sync] Starting batch sync of X jobs...
[Sync] ✓ Synced job 0
[Sync] ✓ Synced job 1
...
[Sync] ✓ Batch sync complete: X jobs
```

---

## Test 3: Verify Jobs API with Cache

**Fetch jobs (should use cache if synced):**

```bash
curl "http://localhost:3000/api/jobs?limit=5"
```

**Expected Response:**
```json
{
  "jobs": [...],
  "count": 5,
  "source": "cache"  // ← Should be "cache" if sync worked
}
```

**Check the source field:**
- `"source": "cache"` ✅ Cache hit! RPC calls reduced
- `"source": "blockchain"` ⚠️ Cache miss, fell back to blockchain

---

## Test 4: Create a New Job and Watch Auto-Sync

1. **Create a job** through your app UI
2. **Wait 5-10 seconds** for the reconciliation job
3. **Check cache stats again:**
   ```bash
   curl http://localhost:3000/api/cache/stats
   ```
4. **jobs_count should increase** by 1

---

## Test 5: Verify Blockchain Fallback

**Disable caching temporarily:**

1. Edit `.env.local`:
   ```env
   ENABLE_DB_CACHE=false
   ```

2. Restart dev server

3. Test jobs API:
   ```bash
   curl "http://localhost:3000/api/jobs?limit=5"
   ```

4. **Expected**: `"source": "blockchain"` (app still works!)

5. **Re-enable caching**:
   ```env
   ENABLE_DB_CACHE=true
   ```

6. Restart dev server

---

## Test 6: Performance Comparison

**Before caching (blockchain only):**
- Open browser DevTools → Network tab
- Navigate to jobs page
- Count RPC calls to blockchain

**After caching:**
- Clear cache and reload
- Navigate to jobs page
- Count RPC calls (should be ~80-90% less!)

---

## Test 7: Reconciliation Cron Job

**Manually trigger reconciliation:**

```bash
curl http://localhost:3000/api/cron/reconcile \
  -H "Authorization: Bearer your-random-secret-here"
```

Replace `your-random-secret-here` with your actual `CRON_SECRET` from `.env.local`.

**Expected Response:**
```json
{
  "success": true,
  "lastSyncedBlock": 0,
  "currentBlock": 123456,
  "duration": 1234,
  "timestamp": "2026-02-01T..."
}
```

---

## Test 8: Check Supabase Dashboard

1. Go to your Supabase project
2. Click **Table Editor** (left sidebar)
3. Select **jobs** table
4. You should see your synced jobs!

**Verify data:**
- ✅ job_id matches blockchain
- ✅ client_address is correct
- ✅ status matches
- ✅ synced_at is recent

---

## Troubleshooting

### "Cache not enabled"
- Check `ENABLE_DB_CACHE=true` in `.env.local`
- Verify all 3 Supabase env vars are set
- Restart dev server

### "Failed to fetch from Supabase"
- Check Supabase API keys are correct
- Verify schema was deployed successfully
- Check Supabase project is not paused

### Jobs not syncing
- Check console for sync errors
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set (not anon key)
- Try manual sync: `POST /api/sync/manual`

### RPC calls still high
- Verify cache is enabled
- Check if data is actually in Supabase tables
- Ensure API endpoints are using cache utilities

---

## Success Criteria

✅ Cache stats shows `"enabled": true`
✅ Manual sync completes without errors
✅ Jobs API returns `"source": "cache"`
✅ Supabase tables contain data
✅ App works with `ENABLE_DB_CACHE=false` (fallback)
✅ Page load is noticeably faster
✅ RPC calls reduced by 80-90%

---

## Next Steps

Once all tests pass:
1. ✅ Caching infrastructure is working
2. ⏳ Deploy to production (Vercel will run cron jobs automatically)
3. ⏳ Monitor cache hit rates
4. ⏳ Migrate more API endpoints to use caching
5. ⏳ Update frontend to use cached APIs

**Current Status:**
- ✅ Jobs caching implemented
- ⏳ Profiles, proposals, escrows (can be added similarly)
- ⏳ Real-time event listeners (optional enhancement)
