# DigitalOcean App Platform Deployment Guide

## Quick Answers

**Q: Do I need separate backend and frontend web services in DigitalOcean like with Render?**  
**A: Yes**, you need two separate services:
- **Backend Service**: Docker-based (for Chrome/Puppeteer support)
- **Frontend Service**: Node.js-based (builds and serves React app)

**Q: What additions are needed to deploy with DigitalOcean?**  
**A: Minimal changes required:**
1. ✅ **Already done**: Updated root `package.json` build script to install frontend dependencies
2. 📄 **Created**: `app.yaml` configuration file (reference/optional)
3. 📖 **Created**: This deployment guide
4. ⚙️ **Action needed**: Configure services in DigitalOcean dashboard (see steps below)

## Overview

This guide details the setup needed to deploy your app to DigitalOcean App Platform, similar to your current Render deployment.

## Architecture

**Yes, you need separate backend and frontend services** on DigitalOcean, just like with Render:

1. **Backend Service**: Docker-based service running your Node.js backend with Chrome/Puppeteer
2. **Frontend Service**: Node.js service that builds and serves your React app

## Required Files

### 1. `app.yaml` (Root directory)
This is the main configuration file for DigitalOcean App Platform. It defines both services.

**Important**: Update the following in `app.yaml`:
- `region`: Change to your preferred region (e.g., `syd` for Sydney, `sgp` for Singapore)
- `github.repo`: Update with your actual GitHub repository path
- `FRONTEND_URL` in backend envs: Set to your DigitalOcean frontend URL
- `REACT_APP_API_URL` in frontend envs: Set to your DigitalOcean backend API URL (e.g., `https://landd-app-dev-8h6ah.ondigitalocean.app/api`)

### 2. `package.json` (Root directory) ✅ Already Updated
The build script has been updated to install frontend dependencies:
```json
"build": "cd frontend && npm install && npm run build"
```

### 3. Existing Files (No changes needed)
- `backend/Dockerfile` - Already configured for Docker deployment
- `frontend/server.js` - Already configured to serve the React build
- `frontend/package.json` - Already has `express` dependency

## Deployment Steps

### Option 1: Manual Configuration via Dashboard (Recommended)

DigitalOcean App Platform works best when configured through the dashboard. The `app.yaml` file serves as a reference.

1. **Create App in DigitalOcean Dashboard**
   - Go to [DigitalOcean App Platform](https://cloud.digitalocean.com/apps)
   - Click "Create App"
   - Select "GitHub" as source
   - Choose your repository and branch (development)

2. **Configure App-Level Environment Variables** (Optional but recommended)
   - Go to Settings → Environment Variables
   - Add: `NODE_ENV` = `production` (shared across all services)
   - This can be overridden at component level if needed

3. **Configure Backend Service**
   - Click "Edit" or "Add Service" → "Web Service"
   - **Name**: `backend`
   - **Source Directory**: `/backend` (leave empty if using Dockerfile context)
   - **Type**: Docker
   - **Dockerfile Path**: `./backend/Dockerfile`
   - **Dockerfile Context**: `./backend`
   - **HTTP Port**: `5000`
   - **Instance Size**: Professional (required for Docker) - start with smallest
   - **Component-Level Environment Variables**:
     - `MONGODB_URI` = (set as secret)
     - `JWT_SECRET` = (set as secret)
     - `JWT_EXPIRE` = `7d`
     - `PORT` = `5000`
     - `FRONTEND_URL` = (your frontend URL after deployment)
     - Note: `NODE_ENV` can be inherited from app-level or set here

4. **Configure Frontend Service**
   - Click "Add Service" → "Web Service"
   - **Name**: `frontend`
   - **Source Directory**: `/` (root of repo)
   - **Type**: Node.js
   - **Build Command**: `npm run build`
   - **Run Command**: `cd frontend && node server.js`
   - **HTTP Port**: `3000`
   - **Instance Size**: Basic - start with smallest
   - **Component-Level Environment Variables**:
     - `REACT_APP_API_URL` = `https://landd-app-dev.digitalocean.com/api`
     - `REACT_APP_GOOGLE_MAPS_API_KEY` = (set as secret)
     - `PORT` = `3000`
     - Note: `NODE_ENV` can be inherited from app-level or set here

5. **Configure Secrets**
   - In each component's Environment Variables section, mark these as "Encrypted" (secrets):
     - Backend: `MONGODB_URI`, `JWT_SECRET`
     - Frontend: `REACT_APP_GOOGLE_MAPS_API_KEY`
   - Secrets are typically set at component-level for better security isolation

6. **Deploy**
   - Review configuration
   - Click "Create Resources" or "Deploy"
   - Wait for backend to deploy first
   - Ensure `REACT_APP_API_URL` is set to `https://landd-app-dev.digitalocean.com/api` in frontend service
   - Redeploy frontend if needed

### Option 2: Using app.yaml (Alternative)

If DigitalOcean supports importing `app.yaml`:

1. **Update `app.yaml`** with your repository details
2. **Push to repository**
3. **Create App** and select "Import from YAML" if available
4. **Configure secrets** in the dashboard
5. **Update URLs** after first deployment

## Key Differences from Render

1. **Configuration File**: DigitalOcean uses `app.yaml` instead of `render.yaml`
2. **Build Command**: DigitalOcean runs the root `build` script, which now installs frontend deps
3. **Service Types**: 
   - Backend: Docker (same as Render)
   - Frontend: Node.js (same as Render)
4. **Region Selection**: You can choose regions closer to your users for better latency

## Environment Variables Setup

### App-Level vs Component-Level Variables

DigitalOcean App Platform supports two levels of environment variables:

**App-Level Variables:**
- **Scope**: Available to ALL components/services in the app
- **Use Case**: Shared configuration (e.g., `NODE_ENV`, common API keys)
- **Precedence**: Lower - can be overridden by component-level variables
- **Configuration**: Set in the app's Settings → Environment Variables section

**Component-Level Variables:**
- **Scope**: Specific to a single component/service
- **Use Case**: Component-specific configuration (e.g., `PORT`, service-specific URLs)
- **Precedence**: Higher - overrides app-level variables with the same name
- **Configuration**: Set in each component's settings

**Best Practices:**
- Use **app-level** for: `NODE_ENV`, shared database URLs, common API keys
- Use **component-level** for: `PORT`, service-specific URLs (e.g., `REACT_APP_API_URL`), component-specific secrets
- **Secrets**: Generally set at component-level for better security isolation

### App-Level Variables (Shared)

These can be set once and shared across all services:
- `NODE_ENV=production` (can be set at app level)

### Backend Service (Component-Level)
- `MONGODB_URI` (SECRET) - **Required** - Component-specific
- `JWT_SECRET` (SECRET) - **Required**
- `JWT_EXPIRE=7d`
- `PORT=5000`
- `FRONTEND_URL` (your frontend URL)
- `XERO_CLIENT_ID` (SECRET) - **Optional** - Only needed if using Xero integration
- `XERO_CLIENT_SECRET` (SECRET) - **Optional** - Only needed if using Xero integration
- `XERO_REDIRECT_URI` - **Optional** - Only needed if using Xero integration

### Frontend Service (Component-Level)
- `REACT_APP_API_URL` = `https://landd-app-dev.digitalocean.com/api` - Component-specific
- `REACT_APP_GOOGLE_MAPS_API_KEY` (SECRET) - Component-specific
- `PORT=3000` - Component-specific

## Troubleshooting

### Build Fails with "react-scripts: not found"
✅ **Fixed**: The root `package.json` build script now installs frontend dependencies first.

### Frontend can't connect to backend
- Ensure `REACT_APP_API_URL` is set to `https://landd-app-dev.digitalocean.com/api`
- Check that backend service is running and accessible
- Verify CORS settings in backend if needed

### Backend Docker build fails
- Ensure `backend/Dockerfile` is correct
- Check that all required system dependencies for Puppeteer are included

## Cost Considerations

DigitalOcean App Platform pricing:
- **Backend**: Professional plan (required for Docker) - starts at $12/month
- **Frontend**: Basic plan - starts at $5/month
- Adjust `instance_size_slug` in `app.yaml` based on your needs

## DigitalOcean Domain Configuration

### Understanding DigitalOcean Routing

When you have multiple services in one app:
- **App-level domain**: `landd-app-dev-8h6ah.ondigitalocean.app` (your app domain)
- **HTTP Request Routes**: Configure which service handles which URL paths

### Recommended Setup (Current Configuration)

**Shared Domain with Different Routes** ✅
- **Backend Service**: Route `/api` → Handles all `/api/*` requests
- **Frontend Service**: Route `/` → Handles all other requests (including React Router routes)
- **REACT_APP_API_URL**: `https://landd-app-dev-8h6ah.ondigitalocean.app/api`
- **FRONTEND_URL**: `https://landd-app-dev-8h6ah.ondigitalocean.app`

### Configuring HTTP Request Routes in DigitalOcean Dashboard

**Yes, the HTTP Request Routes section is what you need to update!**

1. **Go to your Backend Service** → Settings → **HTTP Request Routes**
   - Click "Edit" or "Add Route"
   - **Path**: `/api`
   - This will route all `/api/*` requests to your backend service
   - Save the route

2. **Go to your Frontend Service** → Settings → **HTTP Request Routes**
   - Click "Edit" or "Add Route"
   - **Path**: `/`
   - This will route all other requests (including React Router routes) to your frontend service
   - Save the route

**Route Matching Order:**
- DigitalOcean matches routes from most specific to least specific
- `/api` is more specific than `/`, so `/api/*` requests go to backend first
- All other requests (`/`, `/dashboard`, `/projects`, etc.) go to frontend

### Current Configuration

The `app.yaml` is configured with:
- **Backend route**: `/api` (handles `/api/*`)
- **Frontend route**: `/` (handles everything else)
- **REACT_APP_API_URL**: `https://landd-app-dev-8h6ah.ondigitalocean.app/api`
- **FRONTEND_URL**: `https://landd-app-dev-8h6ah.ondigitalocean.app`

### CORS Configuration

The backend CORS has been updated to allow requests from:
- `https://landd-app-dev-8h6ah.ondigitalocean.app`

If you use a different frontend domain, add it to `backend/server.js` CORS configuration.

## Next Steps

1. ✅ Review and update `app.yaml` with your repository and URLs (already configured for your domain)
2. Push changes to GitHub
3. Create app in DigitalOcean App Platform
4. **Configure service routes** in DigitalOcean dashboard:
   - Backend: Ensure `/api` routes are handled
   - Frontend: Ensure root `/` and React Router routes are handled
5. Configure environment variables/secrets
6. Deploy and test

