#!/usr/bin/env node
// 底部 Tab 栏的实机核对：量测固定条几何 + 截图。
// 与 mobile-audit 分开，因为这个脚本的用途是「改完之后肉眼看一眼」，
// 而不是当门槛用——门槛在 mobile-audit.js。
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

const GEO = `(function(){
  var nav = document.getElementById('nav');
  var bar = document.getElementById('ledger-bar');
  var toast = document.querySelector('.toast');
  var nb = nav.getBoundingClientRect();
  // 只量「可见」的那一层。回响条可见时真正贴着导航的是 .ledger-bar 容器
  // （它的下沿被 padding 撑到视口底，靠 bottom:100vh 整体提上来），
  // 而它自己是块级 + 顶部对齐 —— 所以下面按钮的底边天然离导航还有一截。
  // 只看按钮会误判成「裂了一条缝」，那是量错了对象。
  var barBox = bar && !bar.hidden ? bar.getBoundingClientRect() : null;
  var btn = bar ? bar.querySelector('button') : null;
  var bb2 = (barBox && btn) ? btn.getBoundingClientRect() : null;
  return JSON.stringify({
    vh: window.innerHeight,
    nav: { top: Math.round(nb.top), bottom: Math.round(nb.bottom), h: Math.round(nb.height),
           pos: getComputedStyle(nav).position, z: getComputedStyle(nav).zIndex },
    barHidden: bar ? bar.hidden : null,
    bar: barBox ? { top: Math.round(barBox.top), bottom: Math.round(barBox.bottom),
                    pos: getComputedStyle(bar).position, z: getComputedStyle(bar).zIndex,
                    h: Math.round(barBox.height) } : null,
    barBtn: bb2 ? { bottom: Math.round(bb2.bottom), h: Math.round(bb2.height) } : null,
    toastBottom: toast ? getComputedStyle(toast).bottom : null,
    docSW: document.documentElement.scrollWidth,
    bodyPadBottom: getComputedStyle(document.body).paddingBottom
  }, null, 1);
})()`;

const SEED = `(function(){
  var now=new Date().toISOString();
  var t=(new Date(Date.now()-4*86400000)).toISOString();
  var st={version:2,
    meta:{createdAt:t,storageOK:true,lastSeenAt:t,seenGuide:true,ledger:[
      {kind:'generate',title:'已经展开。',detail:'这是你写下的第 3 个念头。',date:now},
      {kind:'day',title:'第 2 天完成了。',detail:'还剩 5 天。',date:now}]},
    session:{idea:'把备忘录里的碎碎念，做成一本有人等待的独立杂志。',courage:65,time:45,motive:'m_expression',route:1,done:[[0,1],['hard'],[],[]],savedId:null},
    saved:[{id:'A1B2C3',at:now,idea:'做一个只在周日营业的咖啡角',courage:70,time:45,themeLabel:'独立创作',route:2,motive:null,done:[[0,1,2],[0],[]]}],
    observed:{totalIdeas:3,ideas:['a','b','c'],themes:{独立创作:2}},
    profile:{name:'测试',cares:['稳定的作息']},
    settings:{ai:{enabled:false,endpoint:'',model:'',key:''}},
    fear:{turns:[{role:'fear',text:'你怕的其实不是失败，是被人看见你还没准备好。',at:now,engine:'local'}],
          stats:{rebut:1,avoid:0,hit:0},model:{log:[]},distilled:null},
    evolution:{log:[]},feedback:[],memory:{}};
  localStorage.setItem('maybe-institute-v2',JSON.stringify(st));
})()`;

(async () => {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({
    executablePath: process.env.MI_CHROME || '/usr/bin/chromium',
    headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const outDir = '/tmp/mi-tabbar';
  fs.mkdirSync(outDir, { recursive: true });

  // ── 手机 ──
  const mctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2
  });
  const mp = await mctx.newPage();
  await mp.goto('http://localhost:4321/', { waitUntil: 'load' });
  await mp.evaluate('localStorage.clear()');
  await mp.reload({ waitUntil: 'load' });
  await mp.waitForTimeout(2200);
  await mp.evaluate('var o=document.querySelector("#help-overlay"); if(o&&!o.hidden){document.querySelector("#close-help").click();}');
  await mp.waitForTimeout(300);
  await mp.evaluate(SEED);

  const mpages = ['/', '/lab', '/route/1', '/fear', '/archive', '/memory', '/settings'];
  console.log('── 390×844 ──');
  for (const p of mpages) {
    await mp.goto('http://localhost:4321/#' + p, { waitUntil: 'load' });
    await mp.waitForTimeout(1000);
    const g = JSON.parse(await mp.evaluate(GEO));
    const name = (p === '/' ? 'landing' : p.replace(/\//g, '_')).replace(/^_/, '');
    await mp.screenshot({ path: `/tmp/mi-tabbar/m-${name}.png` });
    const seam = g.bar ? g.bar.bottom - g.nav.top : null;
    console.log(`${p}  nav[${g.nav.top}..${g.nav.bottom}] h=${g.nav.h} ${g.nav.pos}/z${g.nav.z}` +
      ` | bar ${g.bar ? `[${g.bar.top}..${g.bar.bottom}] ${g.bar.pos}/z${g.bar.z}` : '(隐藏)'}` +
      ` | 容器缝=${seam === null ? '—' : seam} | 按钮底-导航顶=${g.barBtn ? g.barBtn.bottom - g.nav.top : '—'}` +
      ` | docSW=${g.docSW}/390 | bodyPad=${g.bodyPadBottom}`);
  }

  // 有数据时回响条可见，专门核一次对齐
  await mp.evaluate(`(function(){ if(window.MI&&MI.echo){MI.echo.push({kind:'day',surface:'both',title:'第 3 天完成了。',detail:'还剩 4 天。'});} })()`);
  await mp.waitForTimeout(600);
  const g2 = JSON.parse(await mp.evaluate(GEO));
  await mp.screenshot({ path: '/tmp/mi-tabbar/m-with-ledger.png' });
  console.log(`\n回响条可见时：nav.top=${g2.nav.top}  bar(${g2.bar.pos}).bottom=${g2.bar.bottom}  容器缝=${g2.bar.bottom - g2.nav.top}` +
    `  按钮底=${g2.barBtn.bottom}  toast.bottom=${g2.toastBottom}`);
  console.log(`nav 底边 vs 视口底：${g2.vh - g2.nav.bottom}`);
  // Tab 标签在 5 等分格里有没有被挤掉
  const tabs = await mp.evaluate(`JSON.stringify(Array.prototype.map.call(
    document.querySelectorAll('#nav button'), function (b) {
      var r = b.getBoundingClientRect();
      return { t: b.textContent.trim().replace(/\\s+/g, ' '), w: Math.round(r.width),
               clipped: b.scrollWidth > b.clientWidth + 1 };
    }))`);
  console.log('Tab 标签：' + tabs);

  await mctx.close();

  // ── 桌面 ──
  const dctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const dp = await dctx.newPage();
  await dp.goto('http://localhost:4321/', { waitUntil: 'load' });
  await dp.waitForTimeout(2000);
  // 桌面端首次打开会弹引导，盖住整页，截图看不出布局
  await dp.evaluate('var o=document.querySelector("#help-overlay"); if(o&&!o.hidden){document.querySelector("#close-help").click();}');
  await dp.waitForTimeout(300);
  await dp.evaluate(SEED);
  console.log('\n── 1440×900（桌面端必须与改动前一致）──');
  for (const p of ['/', '/lab', '/settings']) {
    await dp.goto('http://localhost:4321/#' + p, { waitUntil: 'load' });
    await dp.waitForTimeout(1000);
    const g = JSON.parse(await dp.evaluate(GEO));
    const name = (p === '/' ? 'landing' : p.replace(/\//g, '_')).replace(/^_/, '');
    await dp.screenshot({ path: `/tmp/mi-tabbar/d-${name}.png` });
    console.log(`${p}  nav[${g.nav.top}..${g.nav.bottom}] ${g.nav.pos}/z${g.nav.z}` +
      ` | bar ${g.bar ? g.bar.pos + '/z' + g.bar.z : '(隐藏)'} | bodyPad=${g.bodyPadBottom}`);
  }
  await dctx.close();
  await browser.close();
  console.log('\n截图: /tmp/mi-tabbar');
})().catch((e) => { console.error(e); process.exit(1); });
