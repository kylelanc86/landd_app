# Fixing 404 Error on Login

## The Problem

Frontend loads, but login API requests return 404. This means the frontend is trying to call the backend API but the request isn't reaching the backend.

## Root Cause

`REACT_APP_API_URL` must be available at **BUILD TIME** for React apps. React embeds environment variables into the JavaScript bundle during the build process.

## The Fix

### Step 1: Verify REACT_APP_API_URL is Set for Build Time

**In DigitalOcean Dashboard:**

1. Go to **Frontend Service** → **Settings** → **Environment Variables**
2. Find `REACT_APP_API_URL`
3. **Verify** it's set to: `https://landd-app-dev-8h6ah.ondigitalocean.app/api`
4. **Check** if there's a "Scope" setting - it should be available for **Build Time** (not just Runtime)

**Note**: In DigitalOcean, environment variables are typically available at both build and runtime, but verify this.

### Step 2: Rebuild Frontend

After setting/verifying the environment variable:

1. **Trigger a new build** of the Frontend service
2. This will rebuild the React app with the correct API URL embedded
3. Wait for build to complete

### Step 3: Check Browser Console

After rebuild, check browser console (F12) when trying to log in:

1. **Open browser DevTools** (F12)
2. **Go to Network tab**
3. **Try to log in**
4. **Look for the login request** - what URL is it trying to call?
   - Should be: `https://landd-app-dev-8h6ah.ondigitalocean.app/api/auth/login`
   - If it's: `https://landd-app-backend-docker.onrender.com/api/auth/login` → Env var not set correctly
   - If it's: `http://localhost:5000/api/auth/login` → Development mode

### Step 4: Verify Backend Route

Ensure backend route is configured:

1. **Go to Backend Service** → **Settings** → **HTTP Request Routes**
2. **Verify** route exists: Path = `/api`
3. If missing, add it

## Quick Test

Test the login endpoint directly:

```
POST https://landd-app-dev-8h6ah.ondigitalocean.app/api/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "test"
}
```

If this works, the backend is accessible and the issue is the frontend using the wrong URL.

## Common Issues

### Issue 1: Environment Variable Not Set at Build Time

**Symptoms:**
- Login requests go to wrong URL (Render or localhost)
- Browser console shows wrong API URL

**Fix:**
- Set `REACT_APP_API_URL` in DigitalOcean
- Ensure it's available during build (not just runtime)
- Rebuild frontend

### Issue 2: Build Used Old Environment Variable

**Symptoms:**
- Env var is set correctly
- But requests still go to old URL

**Fix:**
- Rebuild frontend service
- Environment variables are embedded at build time

### Issue 3: Backend Route Not Configured

**Symptoms:**
- `/api/health` works
- But `/api/auth/login` returns 404

**Fix:**
- Verify backend route `/api` exists
- Check backend logs for incoming requests

## Verification Steps

1. **Check Environment Variable:**
   - [ ] `REACT_APP_API_URL` = `https://landd-app-dev-8h6ah.ondigitalocean.app/api`
   - [ ] Available at build time

2. **Check Browser Console:**
   - [ ] Open DevTools → Network tab
   - [ ] Try login
   - [ ] Check request URL - should be DigitalOcean URL

3. **Check Backend Route:**
   - [ ] Backend route `/api` exists
   - [ ] `/api/health` works

4. **Rebuild:**
   - [ ] Trigger new frontend build
   - [ ] Wait for completion
   - [ ] Test login again

## Still Getting 404?

Share:
1. **What URL** does the browser console show for the login request?
2. **Is REACT_APP_API_URL** set in DigitalOcean dashboard?
3. **When was the frontend last rebuilt?** (after setting the env var?)

This will help identify if it's an environment variable issue or a routing issue.

