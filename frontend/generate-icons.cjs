#!/usr/bin/env node

/**
 * PWA Icon Generator Script
 * Generates PWA icons in multiple sizes from the source logo
 */

const fs = require('fs');
const path = require('path');

// Icon sizes for PWA
const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

const sourceLogoPath = path.join(__dirname, 'src/assets/img/logo.png');
const iconsDir = path.join(__dirname, 'public/icons');

// Create icons directory if it doesn't exist
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
  console.log('✓ Created icons directory');
}

// Copy the source logo to create icon placeholders
// In production, you should use an image processing library like 'sharp' or 'jimp'
console.log('\n📱 Generating PWA Icons...\n');
console.log('Note: Please replace these placeholder icons with properly sized versions');
console.log('You can use online tools like:');
console.log('  - https://realfavicongenerator.net/');
console.log('  - https://www.pwabuilder.com/imageGenerator');
console.log('  - Or install sharp: npm install sharp\n');

ICON_SIZES.forEach(size => {
  const iconPath = path.join(iconsDir, `icon-${size}x${size}.png`);
  
  // Copy source logo as placeholder (should be resized properly in production)
  try {
    fs.copyFileSync(sourceLogoPath, iconPath);
    console.log(`✓ Created placeholder: icon-${size}x${size}.png`);
  } catch (error) {
    console.error(`✗ Failed to create icon-${size}x${size}.png:`, error.message);
  }
});

console.log('\n✅ Icon generation complete!');
console.log('⚠️  Remember to replace placeholders with properly sized icons before production.\n');
