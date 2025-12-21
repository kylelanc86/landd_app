# Fixing Frontend Running Development Server Instead of Production

## The Problem

Your frontend service is running `react-scripts start` (development server) instead of `node server.js` (production server). This causes:

- ❌ **High memory usage** (dev server uses 500+ MB)
- ❌ **JavaScript heap out of memory** errors
- ❌ **Service crashes**
- ❌ **Degraded status**

## The Root Cause

DigitalOcean is running `npm start` from `frontend/package.json`, which executes:
```json
"start": "react-scripts start"  // Development server - NOT for production!
```

Instead of the production server:
```bash
node server.js  // Production server - serves built static files
```

## The Fix

### Option 1: Update Run Command in DigitalOcean Dashboard (Recommended)

1. **Go to Frontend Service** → **Settings** → **Components**
2. **Find "Run Command"** field
3. **Change it to**: `cd frontend && npm run start:prod`
   - Or: `cd frontend && node server.js`
4. **Save** and **Redeploy**

### Option 2: Use app.yaml (If Deploying from YAML)

I've updated `app.yaml` to use:
```yaml
run_command: cd frontend && npm run start:prod
```

And added to `frontend/package.json`:
```json
"start:prod": "node server.js"
```

## Verification

After fixing, check the logs. You should see:
```
Frontend server is running on port 3000
Static files served from root path
Build directory exists: true
```

**NOT:**
```
Starting the development server...
```

## Why This Matters

### Development Server (`react-scripts start`):
- ❌ Uses 500+ MB RAM
- ❌ Runs webpack dev server
- ❌ Watches for file changes
- ❌ Not optimized for production
- ❌ Will crash on small instances

### Production Server (`node server.js`):
- ✅ Uses ~50-100 MB RAM
- ✅ Serves pre-built static files
- ✅ No file watching
- ✅ Optimized for production
- ✅ Works on small instances

## Current vs Correct Configuration

### ❌ Current (Wrong):
```yaml
run_command: npm start  # Runs react-scripts start (dev server)
```

### ✅ Correct:
```yaml
run_command: cd frontend && npm run start:prod  # Runs node server.js
```

Or:
```yaml
run_command: cd frontend && node server.js  # Direct command
```

## Steps to Fix

1. **Update Run Command in Dashboard:**
   - Frontend Service → Settings → Components
   - Run Command: `cd frontend && npm run start:prod`
   - Save

2. **Or Update package.json** (already done):
   - Added `"start:prod": "node server.js"` script

3. **Redeploy Frontend Service**

4. **Verify in Logs:**
   - Should see: `Frontend server is running on port 3000`
   - Should NOT see: `Starting the development server...`

5. **Check Memory Usage:**
   - Should drop from 500+ MB to ~50-100 MB
   - High usage alert should clear

## Expected Results

After fixing:
- ✅ Memory usage drops significantly
- ✅ Service stops crashing
- ✅ Degraded status clears
- ✅ Health checks pass
- ✅ App loads correctly

## Summary

**The Issue:** Frontend is running dev server instead of production server

**The Fix:** Change run command to `cd frontend && npm run start:prod` or `cd frontend && node server.js`

**The Result:** Lower memory usage, no crashes, healthy service

