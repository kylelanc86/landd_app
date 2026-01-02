# Understanding "Degraded" Status in DigitalOcean

## What Does "Degraded" Mean?

A **"Degraded"** status at the app level means:
- One or more services in your app are **not healthy**
- Health checks are **failing** for at least one service
- Services may be **crashing**, **not starting**, or **not responding** to health checks

## How to Find the Specific Cause

### Step 1: Check Individual Service Status

The app-level "Degraded" alert means at least one service is unhealthy. Check each service:

1. **Go to your App** in DigitalOcean dashboard
2. **Look at the Services list** (Backend and Frontend)
3. **Check the status indicator** next to each service:
   - 🟢 **Green/Healthy** = Service is working
   - 🟡 **Yellow/Degraded** = Service has issues
   - 🔴 **Red/Unhealthy** = Service is failing

**Which service shows yellow or red?**

### Step 2: Check Service Health Check Status

For each service showing issues:

1. **Click on the service** (Backend or Frontend)
2. **Go to the "Overview" or "Metrics" tab**
3. **Look for "Health Check" status**:
   - Should show: "Healthy" or "Unhealthy"
   - May show: Last health check time and result

**What does the health check status show?**

### Step 3: Check Runtime Logs

The logs will show why the service is failing:

1. **Go to the problematic service** (Backend or Frontend)
2. **Click "Runtime Logs"** tab
3. **Look for**:
   - ❌ Error messages
   - ❌ Crash logs
   - ❌ Health check failures
   - ❌ Connection errors

**Common issues to look for:**

**Backend Service:**
- `MongoDB connection error` → Database connection failing
- `Missing required environment variables` → Env vars not set
- `Error: Cannot find module` → Dependencies missing
- `Port 5000 already in use` → Port conflict
- Health check endpoint not responding

**Frontend Service:**
- `Build directory exists: false` → Build didn't complete
- `index.html not found` → Build artifacts missing
- `Port 3000 already in use` → Port conflict
- `Error: Cannot find module` → Dependencies missing
- Health check endpoint not responding

### Step 4: Check Health Check Configuration

Verify health checks are configured correctly:

1. **Go to Service** → **Settings** → **Health Checks**
2. **Check**:
   - **HTTP Path**: Is it correct?
     - Backend: `/api/health` or `/health`
     - Frontend: `/` or `/test`
   - **HTTP Port**: Matches `http_port`?
     - Backend: `5000`
     - Frontend: `3000`
   - **Initial Delay**: Long enough?
     - Backend: At least `30` seconds
     - Frontend: At least `10` seconds

### Step 5: Test Health Endpoints Manually

Test if the health endpoints are actually working:

**Backend:**
```
https://landd-app-dev-8h6ah.ondigitalocean.app/api/health
```
- Should return: `{"status":"ok",...}`
- If it times out or errors → Backend isn't responding

**Frontend:**
```
https://landd-app-dev-8h6ah.ondigitalocean.app/test
```
- Should return: `{"message":"Frontend server is working",...}`
- If it times out or errors → Frontend isn't responding

### Step 6: Check Service Metrics

1. **Go to Service** → **Metrics** tab
2. **Look for**:
   - **CPU Usage**: Is it spiking?
   - **Memory Usage**: Is it maxed out?
   - **Request Rate**: Are requests being handled?
   - **Error Rate**: Are there errors?

## Common Causes of Degraded Status

### 1. Health Check Failing ⚠️ MOST COMMON

**Symptoms:**
- Service shows "Degraded" but logs show it's running
- Health check endpoint returns error or times out

**Fix:**
- Verify health check path is correct
- Verify health check port matches `http_port`
- Increase initial delay if service needs more startup time
- Check if health endpoint actually exists and works

### 2. Service Not Starting

**Symptoms:**
- Logs show startup errors
- Service keeps restarting
- No "Server running" message in logs

**Fix:**
- Check for missing environment variables
- Check for database connection errors
- Check for missing dependencies
- Review startup errors in logs

### 3. Service Crashing

**Symptoms:**
- Service starts then crashes
- Logs show error stack traces
- Service status shows "Restarting"

**Fix:**
- Review error messages in logs
- Check for unhandled exceptions
- Check for memory issues
- Check for dependency conflicts

### 4. Port/Connection Issues

**Symptoms:**
- "Port already in use" errors
- Connection refused errors
- Timeout errors

**Fix:**
- Verify `http_port` matches `PORT` env var
- Check for port conflicts
- Verify service is listening on correct port

## Step-by-Step Diagnosis

1. **Identify which service is degraded:**
   - [ ] Backend service status?
   - [ ] Frontend service status?

2. **Check health check status:**
   - [ ] Backend health check: Healthy/Unhealthy?
   - [ ] Frontend health check: Healthy/Unhealthy?

3. **Review runtime logs:**
   - [ ] Any error messages?
   - [ ] Service starting successfully?
   - [ ] Health endpoints accessible?

4. **Test health endpoints:**
   - [ ] `/api/health` returns JSON?
   - [ ] `/test` returns JSON?

5. **Check health check config:**
   - [ ] Path is correct?
   - [ ] Port matches `http_port`?
   - [ ] Initial delay sufficient?

## Quick Fix Checklist

- [ ] Identify which service is degraded (Backend/Frontend)
- [ ] Check that service's health check status
- [ ] Review that service's runtime logs for errors
- [ ] Test health endpoint manually
- [ ] Verify health check configuration
- [ ] Fix the specific issue found
- [ ] Wait 2-3 minutes for health checks to re-run
- [ ] Verify status changes to "Healthy"

## Still Can't Find the Cause?

If you've checked everything above and still can't find the issue:

1. **Take a screenshot** of:
   - App-level status
   - Each service's status
   - Health check configuration
   - Recent runtime logs (last 50-100 lines)

2. **Share the information:**
   - Which service is degraded?
   - What does the health check status show?
   - What errors appear in the logs?
   - Do the health endpoints work when tested manually?

This will help identify the specific issue.

