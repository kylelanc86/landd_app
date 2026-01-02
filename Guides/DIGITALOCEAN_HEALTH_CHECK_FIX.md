# Fixing Health Check Port Error

## The Error
```
error validating app spec field "services.health_check.port": 
health check port "3000" not found in internal_ports
```

## The Problem

When configuring health checks in DigitalOcean, the health check port must match the service's HTTP port. For web services, you don't need `internal_ports` - the `http_port` is sufficient.

## Solution: Configure Health Checks in Dashboard

### Option 1: Fix in DigitalOcean Dashboard (Recommended)

**Frontend Service:**
1. Go to **Frontend Service** → **Settings** → **Health Checks**
2. Make sure:
   - **HTTP Port**: `3000` (must match `http_port`)
   - **HTTP Path**: `/` or `/test`
   - **Initial Delay**: `10` seconds
   - **Timeout**: `10` seconds
3. **Save**

**Backend Service:**
1. Go to **Backend Service** → **Settings** → **Health Checks**
2. Make sure:
   - **HTTP Port**: `5000` (must match `http_port`)
   - **HTTP Path**: `/api/health` or `/health`
   - **Initial Delay**: `30` seconds
   - **Timeout**: `10` seconds
3. **Save**

**Important**: The health check port must exactly match the `http_port`:
- Frontend: `http_port: 3000` → Health check port: `3000`
- Backend: `http_port: 5000` → Health check port: `5000`

### Option 2: Use app.yaml Configuration

I've updated your `app.yaml` to include health check configuration. If you're using `app.yaml` for deployment:

1. The health checks are now defined in `app.yaml`
2. Push the updated `app.yaml` to your repository
3. DigitalOcean will use the health check settings from the file

**Note**: If you configure health checks in both `app.yaml` AND the dashboard, the dashboard settings take precedence and may cause conflicts.

## Common Mistakes

### ❌ Wrong Port
- Setting health check port to `8080` when `http_port` is `3000`
- **Fix**: Health check port must match `http_port`

### ❌ Missing http_port
- If `http_port` isn't set, DigitalOcean doesn't know which port to check
- **Fix**: Ensure `http_port` is set in service configuration

### ❌ Wrong Path
- Health check path doesn't exist or returns error
- **Fix**: Use `/api/health` for backend, `/` or `/test` for frontend

## Verification

After fixing health checks:

1. **Wait 2-3 minutes** for health checks to run
2. **Check service status** - should change from "Degraded" to "Healthy"
3. **Test endpoints manually**:
   - Backend: `https://landd-app-dev-8h6ah.ondigitalocean.app/api/health`
   - Frontend: `https://landd-app-dev-8h6ah.ondigitalocean.app/test`

## Quick Fix Checklist

- [ ] Frontend health check port = `3000` (matches `http_port`)
- [ ] Backend health check port = `5000` (matches `http_port`)
- [ ] Frontend health check path = `/` or `/test`
- [ ] Backend health check path = `/api/health` or `/health`
- [ ] Initial delay set appropriately (30s for backend, 10s for frontend)
- [ ] Health checks saved in dashboard
- [ ] Services redeployed after changes

## Still Getting Error?

If you're still getting the error after matching ports:

1. **Remove health check configuration** from dashboard temporarily
2. **Save** the service
3. **Add health check back** with correct port
4. **Save** again

This forces DigitalOcean to re-validate the configuration.

