# Fixing 404 on API Routes (Route Prefix Stripping)

## The Problem

- `/api/health` works ✅
- `/api/auth/login` returns 404 ❌
- Request URL is correct: `https://landd-app-dev-8h6ah.ondigitalocean.app/api/auth/login`

## Root Cause

When DigitalOcean routes requests to a service with a path prefix (like `/api`), it may **strip the prefix** before forwarding the request to the backend.

**What happens:**
1. Request: `https://landd-app-dev-8h6ah.ondigitalocean.app/api/auth/login`
2. DigitalOcean routes to backend service (configured with `/api` path)
3. **DigitalOcean strips `/api` prefix** → Backend receives: `/auth/login`
4. Backend expects: `/api/auth/login`
5. Result: 404 Not Found

**Why `/api/health` might work:**
- It's defined directly in server.js as `app.get('/api/health', ...)`
- But if DigitalOcean strips the prefix, it would receive `/health`
- There's also a `/health` endpoint defined, so that might be why it works

## The Fix

### Option 1: Check Backend Runtime Logs (Recommended First Step)

**Check what path the backend is actually receiving:**

1. Go to **Backend Service** → **Runtime Logs**
2. Try to log in
3. Look for any request logs showing the incoming path
4. If you see `/auth/login` (without `/api`), DigitalOcean is stripping the prefix

### Option 2: Add Route Logging

Add temporary logging to see what paths are being received:

```javascript
// In backend/server.js, before routes
app.use((req, res, next) => {
  console.log('Incoming request:', req.method, req.path, req.url);
  next();
});
```

Then check backend logs when trying to log in.

### Option 3: Handle Both Prefixed and Non-Prefixed Paths

If DigitalOcean is stripping the prefix, mount routes to handle both:

```javascript
// Mount auth routes at both paths
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);  // Also handle if prefix is stripped
```

**But wait** - this might cause issues if the prefix is NOT stripped. Better to verify first.

### Option 4: Check DigitalOcean Route Configuration

**In DigitalOcean Dashboard:**

1. Go to **Backend Service** → **Settings** → **HTTP Request Routes**
2. Check the route configuration:
   - **Path**: `/api`
   - **Preserve Path Prefix**: This setting might exist - if so, enable it
   - If no such setting, DigitalOcean likely strips the prefix

### Option 5: Use Root Path for Backend Route

If DigitalOcean strips prefixes, configure backend to receive all requests:

1. **Backend Service** → **Settings** → **HTTP Request Routes**
2. Change route from `/api` to `/` (root)
3. **Update backend routes** to NOT include `/api` prefix:
   - Change `app.use('/api/auth', ...)` to `app.use('/auth', ...)`
   - Change all `/api/*` routes to just `/*`
4. **Update frontend** `REACT_APP_API_URL` to remove `/api`:
   - From: `https://landd-app-dev-8h6ah.ondigitalocean.app/api`
   - To: `https://landd-app-dev-8h6ah.ondigitalocean.app`

**⚠️ This is a bigger change and might affect other routes.**

## Recommended Diagnostic Steps

1. **Check Backend Logs** - See what path backend receives
2. **Test `/api/health` vs `/health`**:
   - `https://landd-app-dev-8h6ah.ondigitalocean.app/api/health` (works)
   - `https://landd-app-dev-8h6ah.ondigitalocean.app/health` (test this)
3. **Check DigitalOcean Route Settings** - Look for "Preserve Path" option
4. **Add Request Logging** - Temporarily log all incoming requests

## Quick Test

Test if prefix is being stripped:

**Try accessing:**
```
https://landd-app-dev-8h6ah.ondigitalocean.app/auth/login
```

(Without `/api` prefix)

If this works, DigitalOcean is stripping the `/api` prefix, and you need to either:
- Configure DigitalOcean to preserve the prefix, OR
- Update backend routes to not expect the prefix

## Next Steps

1. **Check backend runtime logs** when trying to log in
2. **Share what path the backend receives** (with or without `/api`)
3. Based on that, we can determine the correct fix

