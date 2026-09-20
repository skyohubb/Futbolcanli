import fs from 'fs';
const map = { 'mipmap-mdpi':48, 'mipmap-hdpi':72, 'mipmap-xhdpi':96, 'mipmap-xxhdpi':144, 'mipmap-xxxhdpi':192 };
for (const [dir, size] of Object.entries(map)) {
  const dst = `android/app/src/main/res/${dir}/ic_launcher.png`;
  const dstRound = `android/app/src/main/res/${dir}/ic_launcher_round.png`;
  const dstFg = `android/app/src/main/res/${dir}/ic_launcher_foreground.png`;
  const src = `tmp-${size}.png`;
  fs.copyFileSync(src, dst);
  fs.copyFileSync(src, dstRound);
  fs.copyFileSync(src, dstFg);
  console.log(dir, 'ok', size);
}
fs.copyFileSync('icon-1024.png', 'android/app/src/main/ic_launcher-playstore.png');
console.log('playstore ok');
