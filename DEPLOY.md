# Flower Fairies Deployment Guide

## 🚀 Render Deployment

### Prerequisites
- GitHub account
- Render account (free)

### Step 1: Push to GitHub
```bash
# In the FFIV directory:
git init
git add .
git commit -m "Production-ready Flower Fairies platform"
git remote add origin https://github.com/rpfran523/FFIV.git
git branch -M main
git push -u origin main
```

### Step 2: Create Database on Render
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "PostgreSQL"
3. Name: `flower-fairies-db`
4. Database: `flower_fairies` 
5. User: `flower_fairies_user`
6. Plan: Starter ($7/month)
7. Click "Create Database"
8. **Save the connection string** - you'll need it

### Step 3: Deploy Web Service
1. Click "New +" → "Web Service"
2. Connect your GitHub repository: `rpfran523/FFIV`
3. Configure:
   - **Name**: `flower-fairies`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free (or Starter for better performance)

### Step 4: Environment Variables
Add these in Render dashboard:
```
NODE_ENV=production
PORT=10000
DATABASE_URL=[your-render-database-connection-string]
JWT_ACCESS_SECRET=[generate-random-secret]
JWT_REFRESH_SECRET=[generate-random-secret]
CORS_ORIGIN=https://your-app-name.onrender.com
```

### Step 5: Custom Domain (Optional)
1. In Render service settings → "Custom Domains"
2. Add your domain (e.g., `yourname.repl.co`)
3. Update DNS settings in your domain provider:
   - CNAME: `yourname.repl.co` → `your-app-name.onrender.com`
   - Or A record to Render's IP

### Step 6: Database Setup
The app will automatically:
1. Create all tables from `schema.sql`
2. Load demo data from `seed.sql`
3. Set up demo accounts:
   - Admin: admin@flowerfairies.com / admin123
   - Driver: driver1@flowerfairies.com / driver123
   - Customer: customer1@flowerfairies.com / customer123

## 🎯 What You Get

- **Live URL**: https://your-app-name.onrender.com
- **Custom Domain**: Your Replit domain pointing to Render
- **SSL Certificate**: Automatic HTTPS
- **Auto-deploys**: Push to GitHub = automatic deployment
- **Managed Database**: PostgreSQL with backups
- **Environment Management**: Secure environment variables

## 🔧 Troubleshooting

**Build Issues:**
- Check build logs in Render dashboard
- Ensure all environment variables are set

**Database Issues:**
- Verify DATABASE_URL format
- Check database connection in logs

**Domain Issues:**
- DNS propagation can take up to 24 hours
- Verify CNAME/A record settings

## 📞 Support
- Render docs: https://render.com/docs
- GitHub issues: Create issue in this repository
