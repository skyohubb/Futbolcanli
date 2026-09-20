import fs from 'fs';
const svg = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" rx="220" fill="#18181b"/>
  <circle cx="512" cy="512" r="340" fill="#064e3b" stroke="#10b981" stroke-width="12"/>
  <!-- football pattern -->
  <circle cx="512" cy="512" r="140" fill="white" stroke="#18181b" stroke-width="8"/>
  <circle cx="512" cy="405" r="26" fill="#18181b"/>
  <circle cx="512" cy="619" r="26" fill="#18181b"/>
  <circle cx="410" cy="512" r="26" fill="#18181b"/>
  <circle cx="614" cy="512" r="26" fill="#18181b"/>
  <circle cx="442" cy="448" r="20" fill="#f59e0b"/>
  <circle cx="582" cy="448" r="20" fill="#f59e0b"/>
  <g stroke="#18181b" stroke-width="6" fill="none">
    <path d="M512 405 L410 512 L512 619 L614 512 Z"/>
    <path d="M512 405 L442 448 L410 512 M512 405 L582 448 L614 512 M410 512 L442 576 L512 619 M614 512 L582 576 L512 619"/>
  </g>
  <text x="512" y="888" text-anchor="middle" font-family="Arial Black, sans-serif" font-size="110" font-weight="900" fill="#10b981" letter-spacing="14">CANLI</text>
</svg>`;
fs.writeFileSync('icon.svg', svg);
console.log('svg written', svg.length);
try {
  const sharp = await import('sharp');
  await sharp.default(Buffer.from(svg)).png().toFile('icon-1024.png');
  console.log('png 1024 ok');
  const sizes = { 'mipmap-mdpi':48, 'mipmap-hdpi':72, 'mipmap-xhdpi':96, 'mipmap-xxhdpi':144, 'mipmap-xxxhdpi':192 };
  for (const [dir, s] of Object.entries(sizes)) {
    await sharp.default(Buffer.from(svg)).resize(s, s).png().toFile(`tmp-${s}.png`);
    console.log(`tmp ${s} ok`);
  }
} catch (e) {
  console.log('sharp err', e.message);
  // fallback: just copy svg as png placeholder
  fs.copyFileSync('icon.svg', 'icon-1024.png');
  console.log('fallback copy');
}
