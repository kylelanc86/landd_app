# Database Migration Scripts

This directory contains database migration scripts to improve performance and add necessary indexes.

## Available Migrations

### 1. Users Index Migration (`addUsersIndex.js`)

**Purpose**: Adds a database index on the `users` field in the Project collection to dramatically improve query performance for user-assigned projects.

**Performance Impact**: 
- **Before**: ~1374ms for AllocatedJobsTable queries
- **After**: Expected ~50-100ms (10-20x improvement)

**What it does**:
- Creates an index on `{ "users": 1 }` in the projects collection
- Checks if index already exists before creating
- Provides detailed timing and verification logs

## Running Migrations

### Option 1: Using npm script (Recommended)
```bash
cd backend
npm run migrate
```

### Option 2: Direct execution
```bash
cd backend
node scripts/addUsersIndex.js
```

### Option 3: Manual MongoDB command
```javascript
// In MongoDB shell or MongoDB Compass
db.projects.createIndex({ "users": 1 })
```

## Verification

After running the migration, you can verify the index was created:

```javascript
// Check all indexes on projects collection
db.projects.getIndexes()

// Look for an index with key: { "users": 1 }
```

## Expected Results

After running this migration, you should see:
- **AllocatedJobsTable load time**: Reduced from ~1374ms to ~50-100ms
- **Dashboard load time**: Significantly faster overall
- **Backend logs**: Much lower database query times

## Troubleshooting

If the migration fails:
1. Check MongoDB connection string in `.env`
2. Ensure you have write permissions on the database
3. Check if the index already exists (migration will skip if it does)
4. Review the error logs for specific issues
