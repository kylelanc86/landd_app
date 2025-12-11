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
- `FRONTEND_URL` in backend envs: Update with your actual frontend URL
- `REACT_APP_API_URL` in frontend envs: Update with your backend URL (you'll get this after first deploy)

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

2. **Configure Backend Service**
   - Click "Edit" or "Add Service" → "Web Service"
   - **Name**: `backend`
   - **Source Directory**: `/backend` (leave empty if using Dockerfile context)
   - **Type**: Docker
   - **Dockerfile Path**: `./backend/Dockerfile`
   - **Dockerfile Context**: `./backend`
   - **HTTP Port**: `5000`
   - **Instance Size**: Professional (required for Docker) - start with smallest
   - **Environment Variables**:
     - `NODE_ENV` = `production`
     - `MONGODB_URI` = (set as secret)
     - `JWT_SECRET` = (set as secret)
     - `JWT_EXPIRE` = `7d`
     - `PORT` = `5000`
     - `FRONTEND_URL` = (your frontend URL after deployment)

3. **Configure Frontend Service**
   - Click "Add Service" → "Web Service"
   - **Name**: `frontend`
   - **Source Directory**: `/` (root of repo)
   - **Type**: Node.js
   - **Build Command**: `npm run build`
   - **Run Command**: `cd frontend && node server.js`
   - **HTTP Port**: `3000`
   - **Instance Size**: Basic - start with smallest
   - **Environment Variables**:
     - `REACT_APP_API_URL` = (your backend URL - update after backend deploys)
     - `NODE_ENV` = `production`
     - `REACT_APP_GOOGLE_MAPS_API_KEY` = (set as secret)
     - `PORT` = `3000`

4. **Configure Secrets**
   - In the Environment Variables section, mark these as "Encrypted" (secrets):
     - `MONGODB_URI`
     - `JWT_SECRET`
     - `REACT_APP_GOOGLE_MAPS_API_KEY`

5. **Deploy**
   - Review configuration
   - Click "Create Resources" or "Deploy"
   - Wait for backend to deploy first
   - Copy backend URL and update `REACT_APP_API_URL` in frontend service
   - Redeploy frontend

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

### Backend Service
- `NODE_ENV=production`
- `MONGODB_URI` (SECRET)
- `JWT_SECRET` (SECRET)
- `JWT_EXPIRE=7d`
- `PORT=5000`
- `FRONTEND_URL` (your frontend URL)

### Frontend Service
- `REACT_APP_API_URL` (your backend URL)
- `NODE_ENV=production`
- `REACT_APP_GOOGLE_MAPS_API_KEY` (SECRET)
- `PORT=3000`

## Troubleshooting

### Build Fails with "react-scripts: not found"
✅ **Fixed**: The root `package.json` build script now installs frontend dependencies first.

### Frontend can't connect to backend
- Ensure `REACT_APP_API_URL` points to your backend service URL
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

## Next Steps

1. Review and update `app.yaml` with your repository and URLs
2. Push changes to GitHub
3. Create app in DigitalOcean App Platform
4. Configure environment variables/secrets
5. Deploy and test

