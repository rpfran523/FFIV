# Render Environment Variables Setup

After deploying to Render, you need to add these environment variables in the Render Dashboard:

## For the API Service (flower-fairies)

Go to your service → Environment → Add Environment Variable:

```
TOGETHER_API_KEY=7c61fb8860184ca6028ecefdd6add2add68d11e8ca54b94d5d402006b5edb46c
```

## For the Customer Static Site (ffiv-customer)

Go to your static site → Environment → Add Environment Variable:

```
VITE_GOOGLE_PLACES_API_KEY=AIzaSyAlkkBQDMuNJP4mGLH-5H74J2DPyurw1G0
```

## After Adding Variables

1. Go to "Manual Deploy" → "Deploy latest commit"
2. Wait for deployment to complete (~5 minutes)
3. Test address autocomplete in checkout

---

## What These Keys Do

**TOGETHER_API_KEY**: Powers semantic search and product recommendations using Together AI's embedding models

**VITE_GOOGLE_PLACES_API_KEY**: Enables address autocomplete in the checkout process using Google Places API

