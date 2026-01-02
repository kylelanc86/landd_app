# Fixing 404 Error on DigitalOcean

## The Problem

Getting 404 error when accessing: `https://landd-app-dev-8h6ah.ondigitalocean.app/`

This means the request isn't reaching your frontend service or the service isn't serving files correctly.

## Step 1: Check HTTP Request Routes

**Most Common Cause**: Routes not configured in dashboard

1. **Go to Frontend Service** → **Settings** → **HTTP Request Routes**
2. **Verify** there is a route with:
   - **Path**: `/`
   - **Component**: Frontend service
3. **If missing**, add it:
   - Click "Add Route"
   - Path: `/`
   - Save

4. **Go to Backend Service** → **Settings** → **HTTP Request Routes**
5. **Verify** there is a route with:
   - **Path**: `/api`
   - **Component**: Backend service
6. **If missing**, add it:
   - Click "Add Route"
   - Path: `/api`
   - Save

## Step 2: Check Frontend Runtime Logs

1. **Go to Frontend Service** → **Runtime Logs**
2. **Look for**:
   - ✅ `Frontend server is running on port 3000`
   - ✅ `Build directory exists: true`
   - ✅ `Build directory contents: [...]` (should list files)
   - ❌ `Build directory exists: false` → Build didn't complete
   - ❌ `index.html not found` → Build directory missing

**What do the logs show?**

## Step 3: Test Endpoints Directly

Test if services are responding:

**Frontend Test:**
```
https://landd-app-dev-8h6ah.ondigitalocean.app/test
```
- Should return JSON: `{"message":"Frontend server is working",...}`
- If 404 → Frontend route not configured
- If timeout → Frontend service not running

**Backend Health:**
```
https://landd-app-dev-8h6ah.ondigitalocean.app/api/health
```
- Should return JSON: `{"status":"ok",...}`
- If 404 → Backend route not configured
- If timeout → Backend service not running

## Step 4: Verify Service Status

In DigitalOcean dashboard:

1. **Check Frontend Service Status**:
   - Should show: 🟢 **Running** or **Healthy**
   - If 🟡 **Degraded** or 🔴 **Unhealthy** → Service has issues

2. **Check Backend Service Status**:
   - Should show: 🟢 **Running** or **Healthy**
   - If 🟡 **Degraded** or 🔴 **Unhealthy** → Service has issues

## Step 5: Common Issues & Fixes

### Issue 1: Routes Not Configured

**Symptoms:**
- 404 on all paths
- `/test` returns 404
- `/api/health` returns 404

**Fix:**
- Add HTTP Request Routes in dashboard:
  - Frontend: `/`
  - Backend: `/api`

### Issue 2: Build Directory Missing

**Symptoms:**
- Logs show: `Build directory exists: false`
- Logs show: `index.html not found`

**Fix:**
- Check build logs - did build complete?
- Verify build command: `npm install && npm run build`
- Check if `build/` directory was created

### Issue 3: Service Not Running

**Symptoms:**
- Service status shows "Stopped" or "Unhealthy"
- No logs appearing
- Timeout errors

**Fix:**
- Check runtime logs for errors
- Verify run command: `node server.js`
- Check environment variables are set

### Issue 4: Wrong Route Configuration

**Symptoms:**
- Routes exist but requests go to wrong service
- `/api/*` requests go to frontend (should go to backend)

**Fix:**
- Verify route paths:
  - Backend: `/api` (more specific, matches first)
  - Frontend: `/` (catches everything else)
- Route order matters - `/api` should be checked before `/`

## Quick Diagnostic Checklist

- [ ] Frontend HTTP Request Route `/` exists
- [ ] Backend HTTP Request Route `/api` exists
- [ ] Frontend service status: Running/Healthy
- [ ] Backend service status: Running/Healthy
- [ ] Frontend logs show: `Frontend server is running on port 3000`
- [ ] Frontend logs show: `Build directory exists: true`
- [ ] `/test` endpoint returns JSON (not 404)
- [ ] `/api/health` endpoint returns JSON (not 404)

## Still Getting 404?

Share:
1. **What `/test` returns** (JSON or 404?)
2. **What `/api/health` returns** (JSON or 404?)
3. **Frontend service status** (Running/Degraded/Stopped?)
4. **Frontend runtime logs** (last 20-30 lines)
5. **HTTP Request Routes configuration** (what paths are set?)

This will help identify the specific issue.

