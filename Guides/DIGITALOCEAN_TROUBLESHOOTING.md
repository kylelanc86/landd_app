# DigitalOcean Deployment Troubleshooting Guide

## Webpage Not Working - Common Issues & Solutions

### 1. Check Frontend Service Logs

In DigitalOcean dashboard:
- Go to your **Frontend Service** → **Runtime Logs**
- Look for:
  - `Build directory exists: true/false`
  - `Build directory contents: [...]`
  - Any error messages

**Common Issues:**
- ❌ `Build directory exists: false` → Build didn't complete or build directory is missing
- ❌ `index.html not found` → Build artifacts not in expected location
- ❌ `Static file not found` → Build files missing

### 2. Verify Build Directory Location

The frontend server expects the build directory at: `frontend/build`

**Check in logs:**
```
Build directory path: /app/frontend/build
Build directory exists: true
```

If `exists: false`, the build might be in the wrong location.

### 3. Verify Build Command

**Current setup:**
- **Source Directory**: `/` (root)
- **Build Command**: `npm run build` (runs from root, builds to `frontend/build`)
- **Run Command**: `cd frontend && node server.js`

**The build should create:**
```
frontend/
  build/
    index.html
    static/
      js/
      css/
```

### 4. Check Browser Console

Open browser DevTools (F12) and check:
- **Console tab**: Look for JavaScript errors
- **Network tab**: Check if files are loading (404s, CORS errors)
- **Application tab**: Check if service worker is interfering

**Common errors:**
- `Failed to load resource` → Files not found
- `CORS error` → Backend CORS configuration issue
- `Cannot GET /` → Routing issue

### 5. Verify HTTP Request Routes

In DigitalOcean dashboard, check both services:

**Backend Service:**
- Route: `/api` ✅
- Should handle: `/api/*`

**Frontend Service:**
- Route: `/` ✅
- Should handle: Everything else

**Test:**
- Visit: `https://landd-app-dev-8h6ah.ondigitalocean.app/`
- Should serve frontend
- Visit: `https://landd-app-dev-8h6ah.ondigitalocean.app/api/health`
- Should return backend health check

### 6. Test Frontend Server Directly

The frontend server has a test endpoint:
- Visit: `https://landd-app-dev-8h6ah.ondigitalocean.app/test`
- Should return JSON with build status: `{"message":"Frontend server is working",...}`

**Note**: The endpoint is at `/test` (not `/api/test`) because `/api/*` routes go to the backend service.

If this works but the main page doesn't, it's likely a routing issue.

### 7. Check Environment Variables

Verify in DigitalOcean dashboard:

**Frontend Service:**
- ✅ `REACT_APP_API_URL` = `https://landd-app-dev-8h6ah.ondigitalocean.app/api`
- ✅ `PORT` = `3000`
- ✅ `REACT_APP_GOOGLE_MAPS_API_KEY` (set as secret)

**Backend Service:**
- ✅ `FRONTEND_URL` = `https://landd-app-dev-8h6ah.ondigitalocean.app`

### 8. Common Fixes

#### Fix 1: Build Directory Not Found

If build directory is missing, update the run command:

**Option A**: Ensure build happens in the right place
```yaml
build_command: npm run build
run_command: cd frontend && node server.js
```

**Option B**: If build is in root, update server.js path
```yaml
run_command: cd frontend && BUILD_DIR=../build node server.js
```
(Would require server.js modification)

#### Fix 2: Wrong Working Directory

If `source_dir` is `/` but build is in `frontend/build`, ensure:
- Build command runs from root: `npm run build`
- Run command changes to frontend: `cd frontend && node server.js`

#### Fix 3: Routes Not Configured

Ensure in DigitalOcean dashboard:
- Backend route: `/api`
- Frontend route: `/`

#### Fix 4: Port Mismatch

Check that:
- Frontend service HTTP port: `3000`
- Environment variable `PORT=3000`
- Backend service HTTP port: `5000`
- Environment variable `PORT=5000`

### 9. Debug Steps

1. **Check build logs** - Did the build complete successfully?
2. **Check runtime logs** - Is the server starting?
3. **Check build directory** - Does it exist and have files?
4. **Test endpoints** - Can you access `/api/test`?
5. **Check browser console** - What errors appear?
6. **Verify routes** - Are HTTP Request Routes configured correctly?

### 10. Quick Test Checklist

- [ ] Frontend service is running (check logs)
- [ ] Build directory exists (check logs: `Build directory exists: true`)
- [ ] index.html exists (check logs: `Build directory contents`)
- [ ] Routes configured: Frontend `/`, Backend `/api`
- [ ] Environment variables set correctly
- [ ] No errors in browser console
- [ ] Can access `/test` endpoint (frontend test)
- [ ] Backend health check works: `/api/health`

### 11. Lead monitoring: "Analysis report file not found" when viewing report

**Symptom:** View Report works locally but in DigitalOcean you get: "Analysis report file not found on the server..." or "No analysis report has been attached...".

**Cause:** On App Platform the container filesystem is ephemeral. Uploaded lead analysis PDFs are stored under `uploads/lead-analysis-reports/`. After a redeploy or restart, that directory is empty even though the database still has `analysisReportPath` set.

**What to do:**

1. **Confirm in backend logs**  
   In DigitalOcean → Backend Service → Runtime Logs, trigger View Report and look for:
   - `[analysis-report] File missing on disk. shiftId=..., resolvedPath=...`  
   That means the DB has the path but the file is not on disk.

2. **Short-term:** Ask the user to re-upload the PDF in the Attach Analysis Report modal for that shift. The app will work until the next redeploy.

3. **Long-term – persist uploads:**  
   - Add a **Volume** to the Backend Service in DigitalOcean and mount it (e.g. `/data`).  
   - Set backend env: `UPLOADS_DIR=/data/uploads`.  
   - Restart/redeploy. New uploads will be stored on the volume and survive redeploys.  
   See **DEPLOYMENT_CHECKLIST.md** → "Backend Service (Optional - Persistent uploads)".

## Still Not Working?

If none of these help, check:
1. **DigitalOcean App Logs** - Full deployment logs
2. **Browser Network Tab** - What requests are failing?
3. **Server Response** - What does the server return for `/`?

Share the specific error message or behavior you're seeing for more targeted help.

