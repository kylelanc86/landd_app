# DigitalOcean Deployment Checklist

This document verifies that everything needed for development and production deployments is properly configured, including health checks and environment variables.

## Health Check Configuration ✅

### Backend Service Health Checks

**Status:** ✅ Configured

- **Health Endpoint:** `/api/health` and `/health` (both configured for routing flexibility)
- **HTTP Port:** `5000`
- **Initial Delay:** `30` seconds (allows MongoDB connection time)
- **Period:** `10` seconds
- **Timeout:** `10` seconds
- **Success Threshold:** `1`
- **Failure Threshold:** `3`

**Verification:**
- Health endpoint exists in `backend/server.js` (lines 120-137)
- Returns JSON: `{"status":"ok","timestamp":"...","environment":"..."}`
- Configured in `app.yaml` (lines 26-32)

### Frontend Service Health Checks

**Status:** ✅ Configured

- **Health Endpoint:** `/` (root path) or `/test` (test endpoint)
- **HTTP Port:** `3000`
- **Initial Delay:** `10` seconds
- **Period:** `10` seconds
- **Timeout:** `10` seconds
- **Success Threshold:** `1`
- **Failure Threshold:** `3`

**Verification:**
- Test endpoint exists in `frontend/server.js` (lines 74-81)
- Returns JSON: `{"message":"Frontend server is working","timestamp":"...","buildPath":"...","buildExists":true}`
- Configured in `app.yaml` (lines 68-74)

---

## Required Environment Variables

### Backend Service (Required)

| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `MONGODB_URI` | SECRET | MongoDB connection string | `mongodb+srv://...` |
| `JWT_SECRET` | SECRET | Secret key for JWT tokens | `your-secret-key` |
| `JWT_EXPIRE` | String | JWT expiration time | `7d` |
| `PORT` | String | Server port | `5000` |
| `FRONTEND_URL` | String | Frontend URL for CORS and email links | See deployment differences below |
| `NODE_ENV` | String | Environment mode | `production` |

### Backend Service (Optional - Email)

| Variable | Type | Description | Required For |
|----------|------|-------------|--------------|
| `EMAIL_HOST` | String | SMTP server hostname | Password reset emails |
| `EMAIL_PORT` | String | SMTP server port | Password reset emails |
| `EMAIL_SECURE` | String | Use TLS (`true`/`false`) | Password reset emails |
| `EMAIL_USER` | String | SMTP username | Password reset emails |
| `EMAIL_PASS` | String | SMTP password | Password reset emails |

**Note:** If email variables are not set, password reset functionality will fail. The app will still run but users cannot reset passwords.

### Backend Service (Optional - Xero Integration)

| Variable | Type | Description | Required For |
|----------|------|-------------|--------------|
| `XERO_CLIENT_ID` | SECRET | Xero OAuth client ID | Xero invoice sync |
| `XERO_CLIENT_SECRET` | SECRET | Xero OAuth client secret | Xero invoice sync |
| `XERO_REDIRECT_URI` | String | Xero OAuth redirect URI | Xero invoice sync |

**Note:** If Xero variables are not set, Xero integration is disabled gracefully. The app will still run but Xero features will not be available.

### Frontend Service (Required)

| Variable | Type | Scope | Description | Example |
|----------|------|-------|-------------|---------|
| `REACT_APP_API_URL` | String | **BUILD_TIME** | Backend API URL | See deployment differences below |
| `PORT` | String | RUN_TIME | Server port | `3000` |
| `NODE_ENV` | String | RUN_TIME | Environment mode | `production` |

### Frontend Service (Optional)

| Variable | Type | Scope | Description |
|----------|------|-------|-------------|
| `REACT_APP_GOOGLE_MAPS_API_KEY` | SECRET | RUN_TIME | Google Maps API key for map features |

**⚠️ CRITICAL:** `REACT_APP_API_URL` must have **BUILD_TIME** scope because React embeds environment variables during the build process. If this is set to RUN_TIME only, the frontend will not be able to connect to the backend.

### Optional: CORS Additional Origins

| Variable | Type | Description |
|----------|------|-------------|
| `CORS_ORIGINS` | String | Comma-separated list of additional allowed origins (backend only) |

---

## DigitalOcean Settings: Main vs Development

### Summary of Differences

| Setting | Main (Production) | Development |
|---------|-------------------|-------------|
| **App Name** | `landd-app-prod` (or your production app name) | `landd-app-dev` (or your development app name) |
| **GitHub Branch** | `main` | `development` |
| **Frontend URL** | `https://app.landd.com.au` | `https://plankton-app-npflt.ondigitalocean.app` |
| **Backend URL** | `https://app.landd.com.au/api` | `https://plankton-app-npflt.ondigitalocean.app/api` |
| **FRONTEND_URL (Backend)** | `https://app.landd.com.au` | `https://plankton-app-npflt.ondigitalocean.app` |
| **REACT_APP_API_URL (Frontend)** | `https://app.landd.com.au/api` | `https://plankton-app-npflt.ondigitalocean.app/api` |

### Detailed Configuration Comparison

#### 1. App-Level Settings

**Main (Production):**
- App Name: `landd-app-prod`
- Region: `sgp` (or your preferred region)
- Branch: `main`
- Deploy on Push: `true`

**Development:**
- App Name: `landd-app-dev` (or separate app)
- Region: `sgp` (or your preferred region)
- Branch: `development`
- Deploy on Push: `true`

#### 2. Backend Service Configuration

**Both Environments (Same):**
- Dockerfile Path: `./backend/Dockerfile`
- Dockerfile Context: `./backend`
- HTTP Port: `5000`
- Instance Count: `1`
- Instance Size: `professional-xs`
- Route: `/api`
- Health Check Path: `/api/health`
- Health Check Port: `5000`
- Initial Delay: `30` seconds
- Period: `10` seconds
- Timeout: `10` seconds

**Environment Variables (Different):**

| Variable | Main | Development |
|----------|------|-------------|
| `FRONTEND_URL` | `https://app.landd.com.au` | `https://plankton-app-npflt.ondigitalocean.app` |
| `MONGODB_URI` | Production database (SECRET) | Development database (SECRET) |
| `JWT_SECRET` | Production secret (SECRET) | Development secret (SECRET) |

**Note:** You may want to use the same `MONGODB_URI` and `JWT_SECRET` for both, or separate them. Using separate databases is recommended for development.

#### 3. Frontend Service Configuration

**Both Environments (Same):**
- Source Directory: `/`
- Build Command: `npm run build`
- Run Command: `cd frontend && node server.js`
- HTTP Port: `3000`
- Instance Count: `1`
- Instance Size: `basic-xxs`
- Route: `/`
- Health Check Path: `/`
- Health Check Port: `3000`
- Initial Delay: `10` seconds
- Period: `10` seconds
- Timeout: `10` seconds

**Environment Variables (Different):**

| Variable | Main | Development | Scope |
|----------|------|-------------|------|
| `REACT_APP_API_URL` | `https://app.landd.com.au/api` | `https://plankton-app-npflt.ondigitalocean.app/api` | **BUILD_TIME** ⚠️ |
| `REACT_APP_GOOGLE_MAPS_API_KEY` | Same key (SECRET) | Same key (SECRET) | RUN_TIME |

**⚠️ CRITICAL:** `REACT_APP_API_URL` must be set with **BUILD_TIME** scope in DigitalOcean. This ensures the URL is embedded in the React build during compilation.

#### 4. HTTP Request Routes

**Both Environments (Same):**

**Backend Service:**
- Path: `/api`
- Routes all `/api/*` requests to backend

**Frontend Service:**
- Path: `/`
- Routes all other requests (including React Router routes) to frontend

**Route Matching Order:**
- DigitalOcean matches routes from most specific to least specific
- `/api` is more specific than `/`, so `/api/*` requests go to backend first
- All other requests (`/`, `/dashboard`, `/projects`, etc.) go to frontend

---

## Deployment Checklist

### Pre-Deployment

- [ ] Verify GitHub repository is connected
- [ ] Verify correct branch is selected for each app
- [ ] Verify `deploy_on_push` is enabled (if desired)

### Backend Service Setup

- [ ] Set `MONGODB_URI` (SECRET) - **Required**
- [ ] Set `JWT_SECRET` (SECRET) - **Required**
- [ ] Set `JWT_EXPIRE` = `7d`
- [ ] Set `PORT` = `5000`
- [ ] Set `FRONTEND_URL` - **Environment-specific** (see table above)
- [ ] Set `NODE_ENV` = `production`
- [ ] (Optional) Set email variables if using password reset
- [ ] (Optional) Set Xero variables if using Xero integration
- [ ] Verify HTTP Request Route `/api` is configured
- [ ] Verify Health Check:
  - Path: `/api/health`
  - Port: `5000`
  - Initial Delay: `30` seconds

### Frontend Service Setup

- [ ] Set `REACT_APP_API_URL` - **Environment-specific** (see table above)
  - **CRITICAL:** Must have **BUILD_TIME** scope
- [ ] Set `PORT` = `3000`
- [ ] Set `NODE_ENV` = `production`
- [ ] (Optional) Set `REACT_APP_GOOGLE_MAPS_API_KEY` (SECRET)
- [ ] Verify HTTP Request Route `/` is configured
- [ ] Verify Health Check:
  - Path: `/` or `/test`
  - Port: `3000`
  - Initial Delay: `10` seconds

### Post-Deployment Verification

- [ ] Backend health check passes: `https://[your-url]/api/health`
- [ ] Frontend health check passes: `https://[your-url]/` or `https://[your-url]/test`
- [ ] Frontend can connect to backend (check browser console)
- [ ] Login functionality works
- [ ] CORS is working (no CORS errors in browser console)
- [ ] Password reset works (if email configured)
- [ ] Xero integration works (if configured)

---

## Common Issues and Solutions

### Issue: Frontend can't connect to backend (404 errors)

**Solution:**
1. Verify `REACT_APP_API_URL` is set correctly
2. Verify `REACT_APP_API_URL` has **BUILD_TIME** scope
3. Verify backend route `/api` is configured
4. Rebuild frontend after setting environment variable

### Issue: CORS errors in browser

**Solution:**
1. Verify `FRONTEND_URL` in backend matches actual frontend URL
2. Check `CORS_ORIGINS` if using additional origins
3. Verify backend CORS configuration in `backend/server.js`

### Issue: Health check failing

**Solution:**
1. Verify health check path matches endpoint in code
2. Verify health check port matches `http_port`
3. Increase initial delay if service needs more startup time
4. Check runtime logs for errors

### Issue: Build fails

**Solution:**
1. Check build logs for specific errors
2. Verify all dependencies are in `package.json`
3. Verify build command is correct: `npm run build`
4. Check for memory issues (may need larger instance)

### Issue: Service shows "Degraded"

**Solution:**
1. Check which service is degraded (Backend or Frontend)
2. Verify health check configuration
3. Check runtime logs for errors
4. Verify all required environment variables are set
5. Test health endpoints manually

---

## Testing Health Endpoints

### Backend Health Check

```bash
# Production
curl https://app.landd.com.au/api/health

# Development
curl https://plankton-app-npflt.ondigitalocean.app/api/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": "production"
}
```

### Frontend Health Check

```bash
# Production
curl https://app.landd.com.au/test

# Development
curl https://plankton-app-npflt.ondigitalocean.app/test
```

**Expected Response:**
```json
{
  "message": "Frontend server is working",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "buildPath": "/app/frontend/build",
  "buildExists": true
}
```

---

## Quick Reference: Environment Variables by Deployment

### Main (Production) Deployment

**Backend:**
```
MONGODB_URI=<production-db-uri> (SECRET)
JWT_SECRET=<production-secret> (SECRET)
JWT_EXPIRE=7d
PORT=5000
FRONTEND_URL=https://app.landd.com.au
NODE_ENV=production
EMAIL_HOST=<smtp-host> (Optional)
EMAIL_PORT=<smtp-port> (Optional)
EMAIL_SECURE=true (Optional)
EMAIL_USER=<smtp-user> (Optional)
EMAIL_PASS=<smtp-pass> (Optional)
XERO_CLIENT_ID=<xero-id> (Optional, SECRET)
XERO_CLIENT_SECRET=<xero-secret> (Optional, SECRET)
XERO_REDIRECT_URI=<xero-redirect> (Optional)
```

**Frontend:**
```
REACT_APP_API_URL=https://app.landd.com.au/api (BUILD_TIME ⚠️)
PORT=3000
NODE_ENV=production
REACT_APP_GOOGLE_MAPS_API_KEY=<maps-key> (Optional, SECRET)
```

### Development Deployment

**Backend:**
```
MONGODB_URI=<dev-db-uri> (SECRET) - Can be same as production or separate
JWT_SECRET=<dev-secret> (SECRET) - Can be same as production or separate
JWT_EXPIRE=7d
PORT=5000
FRONTEND_URL=https://plankton-app-npflt.ondigitalocean.app
NODE_ENV=production
EMAIL_HOST=<smtp-host> (Optional)
EMAIL_PORT=<smtp-port> (Optional)
EMAIL_SECURE=true (Optional)
EMAIL_USER=<smtp-user> (Optional)
EMAIL_PASS=<smtp-pass> (Optional)
XERO_CLIENT_ID=<xero-id> (Optional, SECRET)
XERO_CLIENT_SECRET=<xero-secret> (Optional, SECRET)
XERO_REDIRECT_URI=<xero-redirect> (Optional)
```

**Frontend:**
```
REACT_APP_API_URL=https://plankton-app-npflt.ondigitalocean.app/api (BUILD_TIME ⚠️)
PORT=3000
NODE_ENV=production
REACT_APP_GOOGLE_MAPS_API_KEY=<maps-key> (Optional, SECRET)
```

---

## Notes

1. **Database:** You can use the same MongoDB database for both environments, or separate them. Using separate databases is recommended for development to avoid affecting production data.

2. **JWT Secret:** You can use the same JWT secret for both environments, or separate them. Using the same secret allows tokens to work across environments (useful for testing).

3. **Email Configuration:** If you want password reset to work in development, you need to configure email variables. You can use the same email configuration for both environments.

4. **Xero Integration:** Xero integration can be configured for both environments. You may need separate Xero apps or use the same app with different redirect URIs.

5. **Google Maps API Key:** You can use the same Google Maps API key for both environments, or create separate keys with different domain restrictions.

6. **Health Checks:** Health checks are critical for DigitalOcean to know if your services are running. If health checks fail, DigitalOcean will mark the service as "Degraded" and may restart it.

7. **Build Time vs Runtime:** React environment variables must be available at BUILD_TIME because they are embedded in the JavaScript bundle during compilation. Backend environment variables are available at runtime.

---

## Support

If you encounter issues:

1. Check the runtime logs for each service
2. Verify all environment variables are set correctly
3. Test health endpoints manually
4. Check DigitalOcean service status
5. Review the troubleshooting guides in the `Guides/` directory

