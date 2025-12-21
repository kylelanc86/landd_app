# Fixing "cd: frontend: No such file or directory" Error

## The Problem

The run command `cd frontend && npm run start:prod` fails because the `frontend` directory doesn't exist in the current working directory when the command executes.

## Solutions (Try in Order)

### Solution 1: Use Absolute Path (Recommended)

**In DigitalOcean Dashboard:**
1. Go to **Frontend Service** → **Settings** → **Components**
2. **Run Command**: `node frontend/server.js`
3. **Save** and **Redeploy**

**Why this works:** `node` can find the file relative to the source directory (`/`), and `server.js` uses `__dirname` to find the build directory correctly.

### Solution 2: Change Source Directory

**In DigitalOcean Dashboard:**
1. Go to **Frontend Service** → **Settings** → **Components**
2. **Source Directory**: Change from `/` to `/frontend`
3. **Build Command**: Change to `npm install && npm run build`
4. **Run Command**: Change to `node server.js`
5. **Save** and **Redeploy**

**Note:** This changes where the build runs, so make sure the build command works from the frontend directory.

### Solution 3: Use Shell Command with Explicit Path

**In DigitalOcean Dashboard:**
1. Go to **Frontend Service** → **Settings** → **Components**
2. **Run Command**: `sh -c "cd /workspace/frontend && node server.js"`
   - Or: `sh -c "cd $HOME/frontend && node server.js"`
3. **Save** and **Redeploy**

### Solution 4: Check Actual Working Directory

The working directory might be different. Check the build logs to see where files are located:

1. **Go to Frontend Service** → **Build Logs**
2. **Look for**: Where the build creates files
3. **Use that path** in your run command

## Recommended Configuration

### Option A: Keep source_dir as `/` (Root)

**Build Command:** `npm run build`  
**Run Command:** `node frontend/server.js`

This should work because:
- Build runs from root, creates `frontend/build/`
- Run command executes `frontend/server.js` from root
- `server.js` uses `__dirname` to find `build/` directory

### Option B: Change source_dir to `/frontend`

**Source Directory:** `/frontend`  
**Build Command:** `npm install && npm run build`  
**Run Command:** `node server.js`

This works because:
- Everything runs from frontend directory
- Build creates `build/` in frontend
- Server runs from frontend directory

## Verification

After fixing, check the logs. You should see:
```
Build directory path: /workspace/frontend/build
Build directory exists: true
Frontend server is running on port 3000
```

**NOT:**
```
cd: frontend: No such file or directory
```

## Quick Fix Steps

1. **Go to Frontend Service** → **Settings** → **Components**
2. **Try Run Command**: `node frontend/server.js`
3. **Save** and **Redeploy**
4. **Check logs** - if it still fails, try Solution 2 (change source_dir)

## Why This Happens

DigitalOcean's working directory for the run command might be:
- The source directory (`/`)
- A build output directory
- A temporary directory

The `server.js` file uses `__dirname` which will always be correct (the directory where server.js is located), so we just need to execute it from the right place.

## Summary

**Try these run commands in order:**

1. `node frontend/server.js` ← **Try this first**
2. If that fails, change source_dir to `/frontend` and use `node server.js`
3. If that fails, use `sh -c "cd /workspace/frontend && node server.js"`

The first option should work if `source_dir: /` is set correctly.

