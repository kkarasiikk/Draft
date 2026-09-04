const { chromium } = require('@playwright/test');
const fs = require('fs');
const STUB = fs.readFileSync('ui-tests/firebase-stub.js', 'utf8');
const iso = (sh=0) => { const d=new Date(); d.setDate(d.getDate()+sh); return d.toISOString().slice(0,10); };
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: {width:390,height:844}, hasTouch: true, isMobile: true });
  let served = false;
  await page.route('**/firebasejs/**', (r) => { const b = served ? '' : STUB; served = true; r.fulfill({status:200, contentType:'application/javascript', body:b}); });
  await page.route('**/cdnjs.cloudflare.com/**', (r) => r.fulfill({status:200, body:''}));
  await page.route('**/fonts.googleapis.com/**', (r) => r.fulfill({status:200, contentType:'text/css', body:''}));
  await page.addInitScript(() => { window.__fbSeed = { profile:{currency:'PLN'}, tasks:[] };
    try { localStorage.setItem('financeAppTheme','light'); localStorage.setItem('financeAppLang','uk'); } catch(e){} });
  await page.goto('http://localhost:8123/index.html');
  await page.waitForSelector('#homeScreen', { state:'visible' });
  await page.waitForTimeout(400);

  const cdp = await page.context().newCDPSession(page);
  const frame = () => page.evaluate(() => {
    const el = document.getElementById('calWeek');
    const cells = [...el.children];
    const step = cells[1].offsetLeft - cells[0].offsetLeft;
    const i = Math.round(el.scrollLeft / step);
    return { step: Math.round(step), scroll: Math.round(el.scrollLeft), idx: i,
      first: cells[i].getAttribute('href').split('#day=')[1] };
  });

  async function drag(px, steps = 8, pause = 16) {
    const box = await page.locator('#calWeek').boundingBox();
    const y = box.y + box.height / 2;
    const x0 = box.x + box.width * 0.7;
    await cdp.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{x:x0, y}] });
    for (let i = 1; i <= steps; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type:'touchMove', touchPoints:[{x: x0 - (px*i/steps), y}] });
      await new Promise(r => setTimeout(r, pause));
    }
    await cdp.send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
    await page.waitForTimeout(700);
  }

  const start = await frame();
  console.log('start        ', JSON.stringify(start));
  const dayDiff = (a,b) => (new Date(a) - new Date(b)) / 86400000;

  for (const px of [30, 55, 110, 200]) {
    // повертаємось у початок
    await page.click('#calMonth'); await page.waitForTimeout(300);
    const before = await frame();
    await drag(px);
    const after = await frame();
    console.log(`drag ${String(px).padStart(3)}px -> зсув ${dayDiff(after.first, before.first)} дн  ${JSON.stringify(after)}`);
  }
  await browser.close();
})();
