# Fixing "Degraded" Alert in DigitalOcean

## Understanding the Degraded Status

A "degraded" alert means one or both services are failing health checks. DigitalOcean performs health checks to ensure services are responding.

## Step 1: Identify Which Service is Degraded

In DigitalOcean dashboard:
1. Look at your **Backend Service** status
2. Look at your **Frontend Service** status
3. Which one shows "Degraded" or has a warning icon?

## Step 2: Check Health Check Configuration

DigitalOcean needs to know how to check if your services are healthy.

### Backend Service Health Check

**In DigitalOcean Dashboard:**
1. Go to **Backend Service** → **Settings** → **Health Checks**
2. Check the configuration:
   - **HTTP Path**: Should be `/api/health` or `/health`
   - **HTTP Port**: Should be `5000`
   - **Initial Delay**: At least `30` seconds (backend needs time to connect to MongoDB)

**Important**: When DigitalOcean routes `/api` to your backend, the health check path might need to be:
- `/api/health` (if prefix is preserved)
- `/health` (if prefix is stripped)

Try both if one doesn't work.

### Frontend Service Health Check

**In DigitalOcean Dashboard:**
1. Go to **Frontend Service** → **Settings** → **Health Checks**
2. Check the configuration:
   - **HTTP Path**: Should be `/` or `/test`
   - **HTTP Port**: Should be `3000`
   - **Initial Delay**: At least `10` seconds

## Step 3: Check Runtime Logs

### Backend Logs
Look for:
- ✅ `✅ MongoDB connected` - Database connected successfully
- ✅ `Server running on port 5000` - Server started
- ❌ Any error messages (especially MongoDB connection errors)
- ❌ `Missing required environment variables` - Env vars not set

**Common Backend Issues:**
- MongoDB connection failing → Check `MONGODB_URI` env var
- Server not starting → Check for startup errors
- Health check failing → Health endpoint not accessible

### Frontend Logs
Look for:
- ✅ `Frontend server is running on port 3000` - Server started
- ✅ `Build directory exists: true` - Build files found
- ❌ `Build directory exists: false` - Build directory missing
- ❌ `index.html not found` - Build didn't complete

**Common Frontend Issues:**
- Build directory missing → Build didn't complete
- Server not starting → Check for errors
- Port conflicts → Check PORT env var

## Step 4: Common Fixes

### Fix 1: Health Check Path Wrong

**Backend:**
- Try health check path: `/api/health`
- If that fails, try: `/health` (we added this endpoint)
- Or try: `/api/` (root endpoint)

**Frontend:**
- Try health check path: `/`
- Or try: `/test` (test endpoint)

### Fix 2: Health Check Initial Delay Too Short

**Backend:**
- Set **Initial Delay** to at least `30` seconds
- Backend needs time to:
  - Start Node.js
  - Connect to MongoDB
  - Initialize routes

**Frontend:**
- Set **Initial Delay** to at least `10` seconds
- Frontend needs time to:
  - Start Node.js
  - Load build files

### Fix 3: Service Not Starting

**Check logs for:**
- Environment variable errors
- Port binding errors
- Database connection errors
- Missing dependencies

### Fix 4: MongoDB Connection Failing

If backend logs show MongoDB connection errors:
- Verify `MONGODB_URI` is set correctly
- Check if MongoDB allows connections from DigitalOcean IPs
- Verify MongoDB credentials are correct

## Step 5: Manual Health Check Test

Test the health endpoints directly:

**Backend:**
```
https://landd-app-dev-8h6ah.ondigitalocean.app/api/health
```
Should return: `{"status":"ok",...}`

**Frontend:**
```
https://landd-app-dev-8h6ah.ondigitalocean.app/test
```
Should return: `{"message":"Frontend server is working",...}`

If these work but health checks fail, the health check configuration in DigitalOcean is wrong.

## Step 6: Update Health Check Settings

### Backend Service
1. Go to **Backend Service** → **Settings** → **Health Checks**
2. Set:
   - **Type**: HTTP
   - **HTTP Path**: `/api/health` (or `/health` if prefix is stripped)
   - **HTTP Port**: `5000`
   - **Initial Delay**: `30` seconds
   - **Timeout**: `10` seconds
   - **Success Threshold**: `1`
   - **Failure Threshold**: `3`
3. **Save**

### Frontend Service
1. Go to **Frontend Service** → **Settings** → **Health Checks**
2. Set:
   - **Type**: HTTP
   - **HTTP Path**: `/` (or `/test`)
   - **HTTP Port**: `3000`
   - **Initial Delay**: `10` seconds
   - **Timeout**: `10` seconds
   - **Success Threshold**: `1`
   - **Failure Threshold**: `3`
3. **Save**

## Step 7: Verify Service Status

After updating health checks:
1. Wait 2-3 minutes for health checks to run
2. Check service status - should change from "Degraded" to "Healthy"
3. If still degraded, check logs for new errors

## Still Degraded?

Share:
1. **Which service** is degraded (Backend, Frontend, or both)
2. **Health check configuration** (paths, ports, delays)
3. **Recent log entries** (especially errors)
4. **Service status** (Running, Stopped, Restarting)

This will help identify the specific issue.

