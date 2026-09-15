#!/usr/bin/env node
// iOS 端专项体检：竖屏 / 横屏 / 键盘占位 / 视口单位。
// 这个脚本的用途是「在改动前后各跑一次，用数字说明问题」，
// 与 mobile-audit.js 的分工是：那个守 390px 竖屏的设计基线，
// 这个查 iOS 平台本身的坑（安全区、动态视口、键盘、横屏回落）。
'use strict';
const fs = require('fs');

function loadPlaywright() {
  try { return require('playwright'); } catch (e) { /* 继续找 */ }
  const roots = [];
  if (process.env.MI_PW_PKG) roots.push(process.env.MI_PW_PKG);
  try {
    const { execSync } = require('child_process');
    const py = execSync(
      'python3 -c "import playwright,os;print(os.path.join(os.path.dirname(playwright.__file__),\x27driver\x27,\x27package\x27))"',
      { encoding: 'utf8' }
    ).trim();
    if (py) roots.push(py);
  } catch (e) { /* 忽略 */ }
  roots.push('/root/.pyenv/versions/3.11.1/lib/python3.11/site-packages/playwright/driver/package');
  for (const r of roots) { try { return require(r); } catch (e) { /* 继续 */ } }
  throw new Error('找不到 playwright');
}

const PROBE = `(function () {
  var n = document.getElementById('nav');
  var bar = document.getElementById('ledger-bar');
  var nr = n ? n.getBoundingClientRect() : null;
  var br = bar && !bar.hidden ? bar.getBoundingClientRect() : null;
  var nb = n ? n.querySelector('button').getBoundingClientRect() : null;
  var out = {
    vw: window.innerWidth,
    vh: window.innerHeight,
    docSW: document.documentElement.scrollWidth,
    docSH: document.documentElement.scrollHeight,
    navPos: n ? getComputedStyle(n).position : 'none',
    navTop: nr ? Math.round(nr.top) : null,
    navBottom: nr ? Math.round(nr.bottom) : null,
    btnH: nb ? Math.round(nb.height) : null,
    navOverflowX: n ? getComputedStyle(n).overflowX : null,
    // 触控目标下限：数一数「最小维度」小于 44px 的可点元素。
    // 注意是 min(w,h) 而不是 w<44 || h<44 —— 「15 分钟」那种档位按钮是
    // 44×62，长边很长、短边正好达标，用 or 判会把它误报成不达标。
    // 真正压不住的只有两端都小的控件。
    //
    // 还要留 0.5px 容差：那三个档位按钮实测就是 44.0，但 getBoundingClientRect
    // 是子像素值，44 会以 43.999...x 出现，写成「小于 44」就会把它们当成不达标。
    // 这几像素的差别不是设计问题，是浮点数问题，不该报警。
    // （这段是模板字符串里的代码，注释里不要出现反引号。）
    smallTaps: (function () {
      var els = document.querySelectorAll('button, [data-nav], [data-open], input, select, textarea, [role="button"]');
      var n2 = 0;
      for (var i = 0; i < els.length; i++) {
        var r = els[i].getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (Math.min(r.width, r.height) < 43.5) n2++;
      }
      return n2;
    })()
  };
  // 视口单位：任何用 vh 算出来的实际高度，在横屏下都会明显超屏
  var chat = document.querySelector('.chat-panel');
  out.chatMinH = chat ? getComputedStyle(chat).minHeight : null;
  var modal = document.querySelector('.modal');
  out.modalMaxH = modal ? getComputedStyle(modal).maxHeight : null;
  // 安全区是否真的生效：未开 viewport-fit=cover 时这里恒为 0
  out.safeBottom = (function () {
    var d = document.createElement('div');
    d.style.cssText = 'position:absolute;height:env(safe-area-inset-bottom,0px);';
    document.body.appendChild(d);
    var h = d.getBoundingClientRect().height;
    document.body.removeChild(d);
    return Math.round(h);
  })();
  return JSON.stringify(out);
})()`;

const SEED = `(function(){
  var now=new Date().toISOString();
  var st={version:2,
    meta:{createdAt:now,storageOK:true,lastSeenAt:now,seenGuide:true,ledger:[
      {kind:'day',title:'第 3 天完成了。',detail:'还剩 4 天。',date:now}]},
    session:{idea:'把备忘录里的碎碎念，做成一本有人等待的独立杂志。',courage:65,time:45,motive:'m_expression',route:1,done:[[0,1],['hard'],[],[]],savedId:null},
    saved:[],observed:{totalIdeas:3,ideas:['a','b','c'],themes:{独立创作:2}},
    profile:{name:'测试',cares:['稳定的作息']},
    settings:{ai:{enabled:false,endpoint:'',model:'',key:''}},
    fear:{turns:[{role:'fear',text:'你怕的其实不是失败，是被人看见你还没准备好。',at:now,engine:'local'}],
          stats:{rebut:1,avoid:0,hit:0},model:{log:[]},distilled:null},
    evolution:{log:[]},feedback:[],memory:{}};
  localStorage.setItem('maybe-institute-v2',JSON.stringify(st));
})()`;

const VIEWPORTS = [
  { name: '竖屏 390×844', w: 390, h: 844, mobile: true },
  { name: '横屏 844×390', w: 844, h: 390, mobile: true },
  { name: '小屏 375×667', w: 375, h: 667, mobile: true },
  { name: '横屏小 667×375', w: 667, h: 375, mobile: true }
];

const PAGES = ['/', '/lab', '/fear', '/settings'];

(async () => {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({
    executablePath: process.env.MI_CHROME || '/usr/bin/chromium',
    headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const outDir = '/tmp/mi-ios';
  fs.mkdirSync(outDir, { recursive: true });

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.w, height: vp.h },
      hasTouch: true, isMobile: vp.mobile, deviceScaleFactor: 2
    });
    const page = await ctx.newPage();
    await page.goto('http://localhost:4321/', { waitUntil: 'load' });
    await page.waitForTimeout(2200);
    await page.evaluate('var o=document.querySelector("#help-overlay"); if(o&&!o.hidden){document.querySelector("#close-help").click();}');
    await page.evaluate(SEED);

    console.log('\n══ ' + vp.name + ' ══');
    for (const p of PAGES) {
      await page.goto('http://localhost:4321/#' + p, { waitUntil: 'load' });
      await page.waitForTimeout(900);
      const o = JSON.parse(await page.evaluate(PROBE));
      const name = (p === '/' ? 'landing' : p.replace(/\//g, '_')).replace(/^_/, '');
      await page.screenshot({ path: `${outDir}/${vp.w}x${vp.h}-${name}.png` });
      console.log(
        `${p.padEnd(9)} nav=${o.navPos}@${o.navTop}..${o.navBottom}(btn${o.btnH})` +
        ` ox=${o.navOverflowX} 小触控=${o.smallTaps}` +
        ` chatMinH=${o.chatMinH} 安全区=${o.safeBottom}` +
        (o.docSW > o.vw ? '  !!横向溢出' : '')
      );
    }
    await ctx.close();
  }
  await browser.close();
  console.log('\n截图: ' + outDir);
})().catch((e) => { console.error(e); process.exit(1); });
