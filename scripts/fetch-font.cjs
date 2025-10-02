const https = require('https');
const fs = require('fs');
const path = require('path');

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetch(res.headers.location));
      }
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  try {
    console.log('Fetching Google Fonts CSS for Press Start 2P...');
    const cssBuffer = await fetch('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
    const css = cssBuffer.toString('utf8');
    // find a font URL (woff2/woff/ttf/otf)
    const match = css.match(/url\((https:\/\/[^)]+\.(woff2|woff|ttf|otf))\)/i);
    if (!match) {
      console.error('Could not find font URL in CSS. CSS fetched length:', css.length);
      process.exit(2);
    }
    const woffUrl = match[1];
    const ext = match[2] || 'woff2';
    console.log('Found font URL:', woffUrl, 'ext:', ext);

    const fontsDir = path.join(__dirname, '..', 'fonts');
    if (!fs.existsSync(fontsDir)) fs.mkdirSync(fontsDir, { recursive: true });
  const outPath = path.join(fontsDir, `PressStart2P-Regular.${ext}`);

    console.log('Downloading font to', outPath);
    const data = await fetch(woffUrl);
    fs.writeFileSync(outPath, data);
    console.log('Saved font:', outPath, 'size:', data.length);
    process.exit(0);
  } catch (err) {
    console.error('Failed to download font:', err);
    process.exit(1);
  }
}

main();
