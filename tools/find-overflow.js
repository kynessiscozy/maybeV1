#!/usr/bin/env node
// 诊断窄屏横向溢出的元凶：逐个元素比对右边界与视口宽度，
// 把「谁把页面撑宽了」直接点名，而不是靠猜。
'use strict';
const path = require('path');
function loadPlaywright() {
  try { return require('playwright'); } catch (e) {}
  const roots = [];
  if (process.env.MI_PW_PKG) roots.push(process.env.MI_PW_PKG);
  try {
    const { execSync } = require('child_process');
    const py = execSync(
      'python3 -c "import playwright,os;print(os.path.join(os.path.dirname(playwright.__file__),\'driver\',\'package\'))"',
      { encoding: 'utf8' }
    ).trim();
    if (py) roots.push(py);
  } catch (e) {}
  roots.push('/root/.pyenv/versions/3.11.1/lib/python3.11/site-packages/playwright/driver/package');
  for (const r of roots) { try { return require(r); } catch (e) {} }
  throw new Error('找不到 playwright');
}

const PROBE = `(function(){
  var vw = window.innerWidth;
  var out = [];
  var all = document.querySelectorAll('body *');
  for (var i = 0; i < all.length; i++) {
    var el = all[i];
    var r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.right > vw + 1 || r.left < -1) {
      // 只报告「最外层」的越界者，忽略它的祖先链重复计数
      out.push({
        sel: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
             (el.className && typeof el.className === 'string'
               ? '.' + el.className.trim().split(/\\s+/).slice(0,2).join('.') : ''),
        left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width),
        sw: el.scrollWidth, cw: el.clientWidth,
        pos: getComputedStyle(el).position
      });
    }
  }
  return JSON.stringify({ vw: vw, docSW: document.documentElement.scrollWidth, bodySW: document.body.scrollWidth, hits: out.slice(0, 25) }, null, 1);
})()`;

(async () => {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({
    executablePath: process.env.MI_CHROME || '/usr/bin/chromium',
    headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const pages = ['/', '/lab', '/fear', '/route/1', '/archive', '/memory', '/settings', '/about'];
  for (const p of pages) {
    await page.goto('http://localhost:4321/#' + p, { waitUntil: 'load' });
    await page.waitForTimeout(900);
    const r = await page.evaluate(PROBE);
    const o = JSON.parse(r);
    console.log('── ' + (p || '/') + '  vw=' + o.vw + '  doc=' + o.docSW + '  body=' + o.bodySW +
      (o.docSW > o.vw ? '   <== 溢出 ' + (o.docSW - o.vw) + 'px' : '   ok'));
    for (const h of o.hits) {
      console.log('     ' + h.sel + '  left=' + h.left + ' right=' + h.right +
        ' w=' + h.w + ' sw=' + h.sw + ' cw=' + h.cw + ' pos=' + h.pos);
    }
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
