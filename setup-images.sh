#!/bin/bash

echo "🖼️  Flower Fairies - Image Setup"
echo "=================================="
echo ""
echo "Please save your 4 product images to:"
echo "  client/public/images/"
echo ""
echo "Required filenames:"
echo "  1. twilight-blooms.jpg    (sparkly background, mixed flowers)"
echo "  2. tulip-trip.jpg         (woman with pink tulips, rainbow)"
echo "  3. fleur-de-haze.jpg      (woman with red roses, rainbow)"
echo "  4. peony-dreams.jpg       (woman from back, peony bouquet)"
echo ""
echo "Opening the images folder..."
open client/public/images/
echo ""
echo "After copying your images:"
echo "  1. Restart the dev server: npm run dev"
echo "  2. Visit http://localhost:5173 to see your products"
echo "  3. Commit and push to deploy: git add . && git commit -m 'Add product images' && git push"

