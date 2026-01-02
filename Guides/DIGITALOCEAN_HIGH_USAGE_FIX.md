# Fixing High Usage Alert on Frontend Service

## What "High Usage" Means

A **"High Usage"** alert means your Frontend service is using too much of its allocated resources:
- **CPU usage** is high (near 100%)
- **Memory usage** is high (near the limit)
- The current instance size is **too small** for your workload

## Current Configuration

Your frontend is currently set to: `basic-xxs` (smallest/cheapest tier)

This tier has:
- **512 MB RAM**
- **0.25 vCPU**
- Very limited resources

## How to Check Current Usage

1. **Go to Frontend Service** in DigitalOcean dashboard
2. **Click "Metrics" tab**
3. **Check**:
   - **CPU Usage**: What percentage? (If >80%, that's high)
   - **Memory Usage**: What percentage? (If >80%, that's high)
   - **Request Rate**: How many requests per second?

## Solutions

### Solution 1: Scale Up Instance Size (Quick Fix) ⚡

**Increase the instance size** to give your frontend more resources:

1. **Go to Frontend Service** → **Settings** → **Components**
2. **Change Instance Size** from `basic-xxs` to:
   - `basic-xs` (1 GB RAM, 0.5 vCPU) - **Recommended minimum**
   - `basic-s` (2 GB RAM, 1 vCPU) - If still having issues
3. **Save** and **Redeploy**

**Cost Impact:**
- `basic-xxs`: ~$5/month
- `basic-xs`: ~$12/month
- `basic-s`: ~$24/month

### Solution 2: Optimize Frontend (Long-term Fix)

Reduce resource usage by optimizing:

**A. Reduce Build Size:**
- Check if build artifacts are too large
- Remove unused dependencies
- Enable code splitting

**B. Optimize Server:**
- The Express server serving static files shouldn't need much CPU
- Check if there are memory leaks
- Review server.js for inefficiencies

**C. Check for Issues:**
- Are there infinite loops in React components?
- Are there memory leaks?
- Is the server handling too many concurrent requests?

### Solution 3: Check What's Causing High Usage

**In DigitalOcean Dashboard:**

1. **Go to Frontend Service** → **Metrics**
2. **Check**:
   - **CPU Usage Graph**: When does it spike?
   - **Memory Usage Graph**: Is it constantly high or spiking?
   - **Request Rate**: How many requests per second?

**Common Causes:**
- **High traffic**: Too many users/requests
- **Memory leak**: Memory usage growing over time
- **CPU-intensive operations**: Heavy processing in the app
- **Build process**: If build is running, it uses resources

## Immediate Action Plan

### Step 1: Check Current Metrics
- [ ] Go to Frontend Service → Metrics
- [ ] Note CPU usage percentage
- [ ] Note Memory usage percentage
- [ ] Check if usage is constant or spiking

### Step 2: Quick Fix - Scale Up
- [ ] Change instance size from `basic-xxs` to `basic-xs`
- [ ] Save and redeploy
- [ ] Wait 2-3 minutes
- [ ] Check if high usage alert clears

### Step 3: Monitor
- [ ] Check metrics after scaling up
- [ ] Verify degraded status clears
- [ ] Monitor for 24 hours to ensure stability

## Recommended Instance Sizes

### For Static File Serving (Current Setup):
- **Minimum**: `basic-xs` (1 GB RAM, 0.5 vCPU)
- **Recommended**: `basic-s` (2 GB RAM, 1 vCPU) if you have traffic

### For Development/Testing:
- `basic-xxs` (512 MB RAM) - Only if very low traffic

## Cost vs Performance

| Instance Size | RAM | vCPU | Cost/Month | Use Case |
|--------------|-----|------|------------|----------|
| `basic-xxs` | 512 MB | 0.25 | ~$5 | Dev/Testing only |
| `basic-xs` | 1 GB | 0.5 | ~$12 | **Recommended minimum** |
| `basic-s` | 2 GB | 1 | ~$24 | Production with traffic |
| `basic-m` | 4 GB | 2 | ~$48 | High traffic |

## Why This Causes Degraded Status

When a service uses too many resources:
- Health checks may **timeout** (service too busy to respond)
- Service may **crash** or **restart** (out of memory)
- Response times **increase** (CPU throttling)
- DigitalOcean marks it as **"Degraded"**

## Quick Fix Steps

1. **Go to Frontend Service** → **Settings** → **Components**
2. **Change Instance Size**: `basic-xxs` → `basic-xs`
3. **Save**
4. **Wait for redeploy** (2-3 minutes)
5. **Check metrics** - usage should drop
6. **Check status** - should change from "Degraded" to "Healthy"

## Still High Usage After Scaling?

If usage is still high after scaling to `basic-xs`:

1. **Check for memory leaks** in your React app
2. **Review server.js** for inefficiencies
3. **Check build size** - is it too large?
4. **Monitor request patterns** - are there traffic spikes?
5. **Consider scaling to `basic-s`** if needed

## Long-term Optimization

1. **Code splitting**: Load components on demand
2. **Lazy loading**: Load routes/components when needed
3. **Optimize images**: Compress and use modern formats
4. **Reduce bundle size**: Remove unused dependencies
5. **Cache static assets**: Use CDN if needed

## Summary

**Immediate Fix:**
- Scale up from `basic-xxs` to `basic-xs` (or `basic-s`)

**Why:**
- `basic-xxs` is too small for production
- Frontend serving static files needs at least 1 GB RAM
- This will resolve the high usage alert and degraded status

**Cost:**
- ~$7/month more for `basic-xs` vs `basic-xxs`
- Worth it for production stability

