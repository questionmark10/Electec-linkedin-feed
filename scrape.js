// scrape.js
// Körs i GitHub Actions: renderar LinkedIn-sidan med Playwright och sparar public/index.html

const fs = require('fs');
const path = require('path');
const playwright = require('playwright');

(async () => {
  const LINKEDIN_URL = 'https://www.linkedin.com/company/electec-system-ab/posts/?feedView=all';
  const OUTPUT_DIR = path.join(process.cwd(), 'public');
  const OUTPUT_FILE = path.join(OUTPUT_DIR, 'index.html');
  const VIEWPORT = { width: 1280, height: 900 };

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await playwright.chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      locale: 'en-US'
    });

    const page = await context.newPage();

    await page.goto(LINKEDIN_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);

    const selectors = [
      '[data-urn^="urn:li:activity:"]',
      '.scaffold-finite-scroll',
      'main'
    ];

    let feedHtml = null;

    for (const sel of selectors) {
      const exists = await page.$(sel);
      if (exists) {
        if (sel === '[data-urn^="urn:li:activity:"]') {
          const items = await page.$$eval('[data-urn^="urn:li:activity:"]', nodes =>
            nodes.map(n => n.outerHTML).join('\n')
          );
          feedHtml = `<div class="linkedin-items">${items}</div>`;
        } else {
          feedHtml = await page.$eval(sel, el => el.outerHTML);
        }
        break;
      }
    }

    if (!feedHtml) {
      feedHtml = `<p>Kunde inte extrahera LinkedIn-flödet automatiskt. Sidan kan kräva inloggning eller struktur har ändrats.</p>`;
    }

    const finalHtml = `<!doctype html>
<html lang="sv">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>LinkedIn — Electec System AB</title>
  <style>
    body { font-family: Arial, sans-serif; margin:0; background:#f5f6f7; color:#111 }
    header { background:#003366; color:white; padding:14px 20px; text-align:center; font-size:22px }
    .wrap { max-width:1200px; margin:18px auto; background:white; padding:18px; border-radius:8px }
    img { max-width:100%; height:auto; display:block }
    a { color:#0b66c3; text-decoration:none }
    .linkedin-items > * { margin-bottom:18px; font-size:18px; }
  </style>
</head>
<body>
  <header>LinkedIn • Electec System AB</header>
  <div class="wrap">
    ${feedHtml}
  </div>
</body>
</html>`;

    fs.writeFileSync(OUTPUT_FILE, finalHtml, 'utf8');
    console.log('Sparade statisk fil:', OUTPUT_FILE);

    await context.close();
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('Fel vid scraping:', err);
    try { await browser.close(); } catch(e){}
    process.exit(1);
  }
})();
