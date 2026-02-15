/**
 * PWA Icon Generator Script
 * Generates PNG icons from the existing logo for PWA manifest
 * 
 * Usage: node generate-icons.cjs
 * 
 * This creates simple branded icons with the Square 15 "S15" text.
 * For best results, replace these with professionally designed icons
 * from the existing logo.png or square15-logo-design.png.
 */

const fs = require('fs');
const path = require('path');

const ICON_DIR = path.join(__dirname, 'public', 'icons');

// Ensure icons directory exists
if (!fs.existsSync(ICON_DIR)) {
  fs.mkdirSync(ICON_DIR, { recursive: true });
}

const sizes = [16, 32, 72, 96, 128, 144, 152, 192, 384, 512];
const PRIMARY_COLOR = '#2D5016';

function generateSVG(size, maskable = false) {
  const padding = maskable ? Math.round(size * 0.1) : Math.round(size * 0.05);
  const innerSize = size - (padding * 2);
  const borderRadius = Math.round(size * 0.15);
  const fontSize = Math.round(innerSize * 0.32);
  const smallFontSize = Math.round(innerSize * 0.14);
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${maskable ? 0 : borderRadius}" fill="${PRIMARY_COLOR}"/>
  <text x="${size/2}" y="${size * 0.48}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">S15</text>
  <text x="${size/2}" y="${size * 0.72}" font-family="Arial, Helvetica, sans-serif" font-size="${smallFontSize}" fill="#F4C430" text-anchor="middle" dominant-baseline="middle">FACILITY</text>
</svg>`;
}

// Generate SVG files (these will be used as-is for now)
// For production, convert to PNG using sharp or canvas
for (const size of sizes) {
  const svg = generateSVG(size, false);
  const filePath = path.join(ICON_DIR, `icon-${size}x${size}.svg`);
  fs.writeFileSync(filePath, svg);
  console.log(`Generated: icon-${size}x${size}.svg`);
}

// Generate maskable icons
for (const maskSize of [192, 512]) {
  const svg = generateSVG(maskSize, true);
  const filePath = path.join(ICON_DIR, `icon-maskable-${maskSize}x${maskSize}.svg`);
  fs.writeFileSync(filePath, svg);
  console.log(`Generated: icon-maskable-${maskSize}x${maskSize}.svg`);
}

// Apple touch icon
const appleSvg = generateSVG(180, false);
fs.writeFileSync(path.join(ICON_DIR, 'apple-touch-icon.svg'), appleSvg);
console.log('Generated: apple-touch-icon.svg');

// Copy the existing logo as fallback icons
const logoSrc = path.join(__dirname, 'public', 'logo.png');
if (fs.existsSync(logoSrc)) {
  for (const size of sizes) {
    const dest = path.join(ICON_DIR, `icon-${size}x${size}.png`);
    fs.copyFileSync(logoSrc, dest);
  }
  // Maskable icons
  fs.copyFileSync(logoSrc, path.join(ICON_DIR, 'icon-maskable-192x192.png'));
  fs.copyFileSync(logoSrc, path.join(ICON_DIR, 'icon-maskable-512x512.png'));
  fs.copyFileSync(logoSrc, path.join(ICON_DIR, 'apple-touch-icon.png'));
  console.log('\nCopied existing logo.png as fallback PNGs');
  console.log('NOTE: For best results, resize logo.png to proper dimensions for each icon size');
}

console.log('\n✅ Icon generation complete!');
console.log('Icons directory:', ICON_DIR);
