# Database Migrations

## Bug Fix #42: Race Condition in Session Activation

### Problem
Multiple concurrent requests could activate different sessions simultaneously, violating the "one active session per user" business rule.

### Solution
Added a database-level unique partial index that ensures only one session per user can have `is_active = TRUE`.

---

## How to Apply This Migration

### Development Environment (SQLite)

```bash
# From project root directory
python backend/migrations/apply_migration.py
```

### Staging/Production Environment (PostgreSQL)

**Option 1: Using Python script (Recommended)**
```bash
# Ensure environment variables are loaded
export $(grep -v '^#' .env.staging | xargs)

# Run migration from project root
python backend/migrations/apply_migration.py
```

**Option 2: Using SQL directly**
```bash
# Connect to PostgreSQL
psql -U your_user -d idii-staging

# Run the migration SQL
\i backend/migrations/add_unique_active_session_constraint.sql
```

---

## Verification

After applying the migration, verify it worked:

```bash
# For SQLite (Development)
sqlite3 backend/db/app.db "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_one_active_session_per_user';"

# For PostgreSQL (Staging/Production)
psql -U your_user -d idii-staging -c "SELECT indexname FROM pg_indexes WHERE indexname='idx_one_active_session_per_user';"
```

Expected output: `idx_one_active_session_per_user`

---

## Testing the Fix

### Test 1: Concurrent Activation (Should work correctly)
```python
# In two separate terminals, run simultaneously:
curl -X PUT http://localhost:5000/api/v1/chat/sessions/1/activate \
  -H "Authorization: Bearer YOUR_TOKEN"

curl -X PUT http://localhost:5000/api/v1/chat/sessions/2/activate \
  -H "Authorization: Bearer YOUR_TOKEN"

# Result: Only ONE session will be active
```

### Test 2: Verify Constraint Enforcement
```sql
-- This should succeed (only one active session)
UPDATE chat_sessions SET is_active = TRUE WHERE id = 1 AND user_id = 123;

-- This should fail due to constraint violation
UPDATE chat_sessions SET is_active = TRUE WHERE id = 2 AND user_id = 123;
-- Error: UNIQUE constraint failed
```

---

## Rollback (If Needed)

If you need to rollback this migration:

```sql
-- SQLite or PostgreSQL
DROP INDEX IF EXISTS idx_one_active_session_per_user;
```

**Warning:** After rollback, the race condition bug will return!

---

## Technical Details

### Index Definition
```sql
CREATE UNIQUE INDEX idx_one_active_session_per_user
ON chat_sessions(user_id)
WHERE is_active = TRUE;
```

### How It Works
- **Partial Index**: Only indexes rows where `is_active = TRUE`
- **Unique Constraint**: Ensures `user_id` is unique within those indexed rows
- **Result**: At most one row per `user_id` can have `is_active = TRUE`
- **Multiple inactive sessions**: Allowed (not part of the index)

### Performance Impact
- **Positive**: Index improves query performance for finding active sessions
- **Negative**: None (minimal overhead)
- **Index Size**: Very small (only active sessions)

---

## Deployment Checklist

- [x] Migration script created
- [x] Migration applied to development database
- [ ] Migration applied to staging database
- [ ] Migration applied to production database
- [ ] Code changes deployed (sessions.py updated)
- [ ] Tested concurrent requests
- [ ] Verified only one active session per user

---

## Support

If you encounter any issues:
1. Check database logs for constraint violation errors
2. Verify the index exists using the verification commands above
3. Ensure all sessions are properly deactivated before activating a new one
