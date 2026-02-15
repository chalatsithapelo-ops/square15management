/**
 * Generate Android mipmap launcher icons
 * Copies logo.png into all required Android density buckets
 * 
 * For production, these should be properly resized to:
 * - mdpi: 48x48
 * - hdpi: 72x72  
 * - xhdpi: 96x96
 * - xxhdpi: 144x144
 * - xxxhdpi: 192x192
 */
const fs = require('fs');
const path = require('path');

const logoSrc = path.join(__dirname, '..', 'public', 'logo.png');
const resDir = path.join(__dirname, 'app', 'src', 'main', 'res');

const densities = [
  'mipmap-mdpi',
  'mipmap-hdpi', 
  'mipmap-xhdpi',
  'mipmap-xxhdpi',
  'mipmap-xxxhdpi',
];

if (!fs.existsSync(logoSrc)) {
  console.error('logo.png not found at', logoSrc);
  process.exit(1);
}

for (const density of densities) {
  const dir = path.join(resDir, density);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.copyFileSync(logoSrc, path.join(dir, 'ic_launcher.png'));
  console.log(`Created: ${density}/ic_launcher.png`);
}

console.log('✅ Android launcher icons generated');
