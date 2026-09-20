import sharp from 'sharp';
import fs from 'fs';
const src = 'apkicon.jfif';
// 1024x1024 crop cover, rounded corners via composite mask
const size = 1024;
const r = 220; // rounded rect radius from previous
// create rounded mask
const roundedMask = Buffer.from(`<svg width="${size}" height="${size}"><rect x="0" y="0" width="${size}" height="${size}" rx="${r}" ry="${r}" fill="white"/></svg>`);
try {
  const img = sharp(src).resize(size, size, { fit: 'cover', position: 'centre' });
  const rounded = await img.composite([{ input: roundedMask, blend: 'dest-in' }]).png().toBuffer();
  // add slight background? already rounded with transparency, composite on white?
  // Save as icon-1024 with transparent rounded corners on dark bg? Keep as is with transparent
  await sharp(rounded).png().toFile('icon-1024.png');
  console.log('icon-1024.png 1024 ok', fs.statSync('icon-1024.png').size);
  // also save icon.svg fallback? keep png
  fs.copyFileSync('icon-1024.png', 'icon.png');
  const sizes = { 'mipmap-mdpi':48, 'mipmap-hdpi':72, 'mipmap-xhdpi':96, 'mipmap-xxhdpi':144, 'mipmap-xxxhdpi':192 };
  for (const [dir, s] of Object.entries(sizes)) {
    await sharp(src).resize(s, s, { fit: 'cover' }).png().toFile(`tmp-${s}.png`);
    // also need rounded for mipmap? Android adaptive will handle, but we copy square
    console.log(`tmp-${s} ok`);
  }
  console.log('done');
} catch (e) {
  console.error(e);
  process.exit(1);
}
