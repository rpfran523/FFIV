#!/bin/bash

echo "🗄️  Flower Fairies - Update Render Database"
echo "============================================="
echo ""
echo "This script will update your Render database with the new products."
echo ""
echo "📋 Steps:"
echo "1. Go to your Render Dashboard: https://dashboard.render.com"
echo "2. Click on 'ff-chi-db' database"
echo "3. Scroll down to find 'External Database URL' or 'Connection String'"
echo "4. Click 'Copy' button next to it"
echo ""
read -p "Paste your database connection string here: " DATABASE_URL
echo ""

if [ -z "$DATABASE_URL" ]; then
    echo "❌ No database URL provided. Exiting."
    exit 1
fi

echo "🔄 Updating database with new products..."
echo ""

# Run the seed file
PGPASSWORD="" psql "$DATABASE_URL" -f server/db/seed.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Database updated successfully!"
    echo ""
    echo "Your new products are now live on:"
    echo "https://ff-chi.onrender.com"
    echo ""
    echo "New products:"
    echo "  🌙 Twilight Blooms"
    echo "  🌷 Tulip Trip"
    echo "  ☁️  Fleur de Haze"
    echo "  🌸 Peony Dreams"
else
    echo ""
    echo "❌ Error updating database."
    echo "Please check your connection string and try again."
fi

