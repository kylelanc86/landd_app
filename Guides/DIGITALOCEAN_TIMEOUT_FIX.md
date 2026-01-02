# Fixing 30-Second Timeout Error

## The Problem
- Pages load for 30 seconds then fail
- "Cannot GET /health" error
- Services appear to be timing out

## Root Causes & Solutions

### 1. HTTP Request Routes Not Configured in Dashboard ⚠️ MOST LIKELY

**The `app.yaml` file is just a reference** - you MUST configure routes in the DigitalOcean dashboard!

**Fix:**
1. Go to DigitalOcean → Your App → **Backend Service**
2. Click **Settings** → **HTTP Request Routes**
3. Click **Edit** or **Add Route**
4. Set **Path**: `/api`
5. **Save**

6. Go to **Frontend Service**
7. Click **Settings** → **HTTP Request Routes**  
8. Click **Edit** or **Add Route**
9. Set **Path**: `/`
10. **Save**

11. **Redeploy** both services

### 2. Services Not Starting

Check the **Runtime Logs** for each service:

**Backend Service:**
- Go to Backend Service → **Runtime Logs**
- Look for: `✅ MongoDB connected` or `Server running on port 5000`
- If you see errors, the service isn't starting

**Frontend Service:**
- Go to Frontend Service → **Runtime Logs**
- Look for: `Frontend server is running on port 3000`
- Look for: `Build directory exists: true`
- If `Build directory exists: false`, the build failed

### 3. Build Directory Missing (Frontend)

If frontend logs show `Build directory exists: false`:

**Check:**
- Build logs should show: `Build completed successfully`
- Build should create: `frontend/build/` directory

**Fix:**
- Verify **Build Command**: `npm run build`
- Verify **Source Directory**: `/` (root)
- Check build logs for errors

### 4. Port Mismatch

Verify ports match:

**Backend:**
- HTTP Port: `5000`
- Environment Variable: `PORT=5000`

**Frontend:**
- HTTP Port: `3000`
- Environment Variable: `PORT=3000`

### 5. Test Endpoints

After fixing routes, test:

**Backend Health:**
- `https://landd-app-dev-8h6ah.ondigitalocean.app/api/health`
- Should return: `{"status":"ok",...}`

**Backend Root (if routes strip prefix):**
- `https://landd-app-dev-8h6ah.ondigitalocean.app/api/`
- Should return: `{"message":"LandD App Backend API",...}`

**Frontend Test:**
- `https://landd-app-dev-8h6ah.ondigitalocean.app/test`
- Should return: `{"message":"Frontend server is working",...}`

## Step-by-Step Debugging

### Step 1: Verify Routes in Dashboard
- [ ] Backend route `/api` exists
- [ ] Frontend route `/` exists
- [ ] Both routes are saved

### Step 2: Check Service Status
- [ ] Backend service shows "Running" (green)
- [ ] Frontend service shows "Running" (green)
- [ ] No error indicators

### Step 3: Check Runtime Logs
- [ ] Backend logs show server started
- [ ] Frontend logs show server started
- [ ] Frontend logs show `Build directory exists: true`
- [ ] No error messages

### Step 4: Test Endpoints
- [ ] `/api/health` returns JSON
- [ ] `/test` returns JSON
- [ ] `/` loads the React app

## Common Issues

### Issue: Routes configured but still timing out
**Solution:** DigitalOcean might need a few minutes to propagate route changes. Wait 2-3 minutes and try again.

### Issue: Backend health check fails
**Solution:** Try both `/api/health` and `/api/api/health` (in case prefix is added instead of stripped)

### Issue: Frontend shows blank/error
**Solution:** Check browser console (F12) for JavaScript errors. Check Network tab for failed file loads.

### Issue: Build directory not found
**Solution:** 
1. Check build logs - did build complete?
2. Verify build command: `npm run build`
3. Check if `frontend/build/` exists in build artifacts

## Still Not Working?

If routes are configured correctly and services are running, check:

1. **Service Health in Dashboard**
   - Are services showing as "Healthy"?
   - Any health check failures?

2. **Environment Variables**
   - Are all required env vars set?
   - Are secrets marked as "Encrypted"?

3. **Build Logs**
   - Did the build complete successfully?
   - Any build errors or warnings?

4. **Network/Firewall**
   - Are there any firewall rules blocking traffic?
   - Is the app accessible from outside?

Share the specific error messages from:
- Runtime logs (both services)
- Build logs (frontend)
- Browser console (F12)

