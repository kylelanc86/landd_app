# DigitalOcean DNS Configuration Summary

## Current Setup

You're currently using: `landd-app-dev-8h6ah.ondigitalocean.app` (default DigitalOcean domain)

If you want to use a custom domain like `app.landd.com.au`, here's what you need:

## DNS Records Summary

### Option 1: Using Custom Domain (app.landd.com.au)

#### At Your Domain Registrar (where you bought landd.com.au):

**NS Records** (Name Servers) - ✅ You've already done this:
- `ns1.digitalocean.com.`
- `ns2.digitalocean.com.`
- `ns3.digitalocean.com.`

**Important**: NS records delegate DNS management to DigitalOcean. Once set, you manage DNS in DigitalOcean, not at your registrar.

#### In DigitalOcean Dashboard:

1. **Add Domain to App Platform:**
   - Go to your App → **Settings** → **Domains**
   - Click **Add Domain**
   - Enter: `app.landd.com.au`
   - DigitalOcean will automatically create the necessary DNS records

2. **DNS Records Created Automatically:**
   - **A Record** or **CNAME**: Points `app.landd.com.au` to your app
   - DigitalOcean handles this automatically when you add the domain

3. **No Additional Records Needed:**
   - DigitalOcean App Platform automatically creates the required DNS records
   - You don't need to manually create A or CNAME records

### Option 2: Using Default DigitalOcean Domain

If you're using `landd-app-dev-8h6ah.ondigitalocean.app`:
- **No DNS configuration needed**
- DigitalOcean handles everything automatically
- NS records are not required

## What You've Done ✅

- ✅ Added NS records at domain registrar (if using custom domain)

## What You Still Need to Do

### If Using Custom Domain (app.landd.com.au):

1. **In DigitalOcean App Platform:**
   - Go to your App → **Settings** → **Domains**
   - Click **Add Domain**
   - Enter: `app.landd.com.au`
   - DigitalOcean will verify and configure automatically

2. **Wait for DNS Propagation:**
   - NS record changes can take 24-48 hours to propagate
   - Domain verification in DigitalOcean may take a few minutes

3. **Update Environment Variables:**
   - Update `FRONTEND_URL` in backend: `https://app.landd.com.au`
   - Update `REACT_APP_API_URL` in frontend: `https://app.landd.com.au/api`
   - Update CORS in `backend/server.js` to include `https://app.landd.com.au`

### If Using Default Domain (landd-app-dev-8h6ah.ondigitalocean.app):

- **Nothing else needed** - you're all set!

## DNS Record Types Explained

### NS Records (Name Servers)
- **Purpose**: Delegates DNS management to DigitalOcean
- **Where**: Set at your domain registrar (where you bought the domain)
- **Value**: `ns1.digitalocean.com.`, `ns2.digitalocean.com.`, `ns3.digitalocean.com.`
- **Status**: ✅ You've already done this

### A Records / CNAME Records
- **Purpose**: Points your domain to your app
- **Where**: Created automatically in DigitalOcean when you add the domain
- **Action**: No manual configuration needed - DigitalOcean handles this

## Verification Checklist

### For Custom Domain Setup:

- [ ] NS records set at domain registrar (✅ Done)
- [ ] Domain added in DigitalOcean App Platform → Settings → Domains
- [ ] Domain verified in DigitalOcean (shows as "Active")
- [ ] Environment variables updated with custom domain
- [ ] CORS updated in backend/server.js
- [ ] Wait 24-48 hours for DNS propagation
- [ ] Test: `https://app.landd.com.au` loads your app

### For Default Domain:

- [ ] Using `landd-app-dev-8h6ah.ondigitalocean.app` (✅ Already configured)
- [ ] No additional DNS setup needed

## Common Questions

**Q: Do I need to create A or CNAME records manually?**  
A: No, DigitalOcean creates these automatically when you add the domain in App Platform.

**Q: How long do NS record changes take?**  
A: 24-48 hours for full propagation, but often works within a few hours.

**Q: Can I use both domains?**  
A: Yes, you can add multiple domains to your app in DigitalOcean.

**Q: What if I don't want to change NS records?**  
A: You can use A records or CNAME at your registrar instead, but NS records are recommended for easier management.

## Next Steps

1. **If using custom domain**: Add domain in DigitalOcean App Platform → Settings → Domains
2. **If using default domain**: You're done - no DNS changes needed
3. **Update environment variables** if switching to custom domain
4. **Wait for DNS propagation** (if using custom domain)
5. **Test** your domain

