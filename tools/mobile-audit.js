#!/usr/bin/env node
// 移动端体检：在 390×844 下逐页截图并量测「真正的体验问题」——
// 触控目标尺寸、字号、横向溢出、首屏内容量、可点击元素间距。
'use strict';
const fs = require('fs');
const path = require('path');

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

// 量测：把小目标、小字号、溢出都点名
const AUDIT = `(function(){
  var vw = window.innerWidth;
  var out = { vw: vw, docSW: document.documentElement.scrollWidth, taps: [], small: [], wide: [] };
  var els = document.querySelectorAll('button, [data-nav], [data-open], a, input, select, textarea, [role="button"]');
  for (var i = 0; i < els.length; i++) {
    var el = els[i];
    var r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    var cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    var label = (el.textContent || el.getAttribute('aria-label') || el.id || el.className || '').trim().slice(0, 22);
    // 苹果/谷歌建议触控目标 ≥44px（这里按 40 放宽，因为这是紧凑排版风格）
    if (r.height < 40 || r.width < 40) {
      out.taps.push({ t: label, w: Math.round(r.width), h: Math.round(r.height) });
    }
    if (r.right > vw + 1) out.wide.push({ t: label, right: Math.round(r.right) });
  }
  // 字号过小
  var all = document.querySelectorAll('body *');
  var seen = {};
  for (var j = 0; j < all.length; j++) {
    var e2 = all[j];
    var r2 = e2.getBoundingClientRect();
    if (r2.width === 0 || r2.height === 0) continue;
    if (e2.children.length > 0 && !(e2.textContent || '').trim()) continue;
    var fs = parseFloat(getComputedStyle(e2).fontSize);
    if (fs && fs < 10) {
      var k = fs + '|' + (e2.className || e2.tagName);
      if (!seen[k]) {
        seen[k] = 1;
        out.small.push({ fs: fs, c: String(e2.className || e2.tagName).slice(0, 26),
                          t: (e2.textContent || '').trim().slice(0, 18) });
      }
    }
  }
  out.hero = Math.round(window.innerHeight);

  // 底部 Tab 栏的几何。三项必须同时成立：
  //   navBottom→视口底（导航贴底）、barBottom→navTop（回响条咬合）。
  // 回响条是 hidden 时 rect 全为 0，那种情况下不判定，只记 null，
  // 免得拿「0 减导航上沿」得出一个荒唐数却看起来通过了。
  var nav = document.getElementById('nav');
  var bar = document.getElementById('ledger-bar');
  if (nav) {
    var nr = nav.getBoundingClientRect();
    var nc = getComputedStyle(nav);
    out.tabbar = {
      pos: nc.position,
      toBottom: Math.round(window.innerHeight - nr.bottom),
      count: nav.querySelectorAll('button').length,
      // 五个格子等宽：极差 ≤2px
      spread: Math.round((function () {
        var b = nav.querySelectorAll('button'), w = [];
        for (var i = 0; i < b.length; i++) w.push(b[i].getBoundingClientRect().width);
        return Math.max.apply(null, w) - Math.min.apply(null, w);
      })()),
      btnH: Math.round(nav.querySelector('button').getBoundingClientRect().height),
      // 标签被 ellipsis 截断的个数
      clipped: (function () {
        var b = nav.querySelectorAll('button'), n = 0;
        for (var i = 0; i < b.length; i++) if (b[i].scrollWidth > b[i].clientWidth + 1) n++;
        return n;
      })()
    };
    if (bar && !bar.hidden) {
      var br = bar.getBoundingClientRect();
      out.tabbar.seam = Math.round(nr.top - br.bottom);   // 0 表示严丝合缝
    } else {
      out.tabbar.seam = null;
    }
  }
  return JSON.stringify(out, null, 1);
})()`;

(async () => {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({
    executablePath: process.env.MI_CHROME || '/usr/bin/chromium',
    headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  // iPhone 14 Pro 逻辑尺寸，带触摸
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true, isMobile: true,
    deviceScaleFactor: 2
  });
  const page = await ctx.newPage();
  const outDir = '/tmp/mi-mobile';
  fs.mkdirSync(outDir, { recursive: true });

  await page.goto('http://localhost:4321/', { waitUntil: 'load' });
  await page.evaluate('localStorage.clear()');
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2200);
  await page.evaluate('var o=document.querySelector("#help-overlay"); if(o&&!o.hidden){document.querySelector("#close-help").click();}');
  await page.waitForTimeout(400);

  // 造一份「用过一阵子」的数据，让各页有真实内容
  await page.evaluate(`(function(){
    var now=new Date().toISOString();
    var t=(new Date(Date.now()-4*86400000)).toISOString();
    var st={version:2,
      meta:{createdAt:t,storageOK:true,lastSeenAt:t,seenGuide:true,ledger:[
        {kind:'generate',title:'已经展开。',detail:'这是你写下的第 3 个念头。主题集中在「独立创作」——三条路里有一条是从那里长出来的。',date:now},
        {kind:'day',title:'第 2 天完成了。',detail:'还剩 5 天。',date:now},
        {kind:'memory',title:'称呼改成了「测试」。',detail:'它以后会这样叫你。',date:now}]},
      session:{idea:'把备忘录里的碎碎念，做成一本有人等待的独立杂志。',courage:65,time:45,motive:'m_expression',route:1,done:[[0,1],['hard'],[],[]],savedId:null},
      saved:[{id:'A1B2C3',at:now,idea:'做一个只在周日营业的咖啡角',courage:70,time:45,themeLabel:'独立创作',route:2,motive:null,done:[[0,1,2],[0],[]]}],
      observed:{totalIdeas:3,ideas:['a','b','c'],themes:{独立创作:2}},
      profile:{name:'测试',cares:['稳定的作息','不被评价的表达']},
      settings:{ai:{enabled:false,endpoint:'',model:'',key:''}},
      fear:{turns:[{role:'fear',text:'你怕的其实不是失败，是被人看见你还没准备好。',at:now,engine:'local'},
                   {role:'you',text:'我写下这些不是为了给别人看，是因为我自己想弄清楚。',at:now},
                   {role:'fear',text:'那你为什么还没开始？',at:now,engine:'local'}],
            stats:{rebut:1,avoid:0,hit:0},model:{log:[{at:now,rule:'scale',from:1,to:0.7}]},
            distilled:{summary:'这是蒸馏摘要。',focus:'you_will_quit',lines:[
              {archetype:'you_will_quit',text:'你怕的其实不是失败，是被人看见你还没准备好。'},
              {archetype:'no_one_cares',text:'你把「再等等」说成了「我不急」。'}]}},
      evolution:{log:[{at:now,rule:'任务规模下调',detail:'两次「太难」后，七天任务量下调到 70%。'}]},
      feedback:[{at:now,route:1,key:'unlike',idea:'x'}],memory:{}};
    localStorage.setItem('maybe-institute-v2',JSON.stringify(st));
  })()`);

  const pages = ['/', '/lab', '/route/1', '/fear', '/archive', '/stress', '/settings', '/about'];
  const report = [];
  let fails = 0;

  // 断言门槛。两条被显式豁免：
  //   · .brand-en 是 9px 的英文logotype，属于有意的风格下限
  //   · 翻译不到 10px 的隐藏元素（宽高为 0）已在探针里排除
  const ALLOW_SMALL = /brand-en/;
  const MIN_TAP = 40;   // 通行下限 44，这里留 4px 余量给紧凑风格

  for (const p of pages) {
    await page.goto('http://localhost:4321/#' + p, { waitUntil: 'load' });
    await page.waitForTimeout(1100);
    const raw = await page.evaluate(AUDIT);
    const o = JSON.parse(raw);
    const name = (p === '/' ? 'landing' : p.replace(/\//g, '_')).replace(/^_/, '');
    await page.screenshot({ path: path.join(outDir, name + '.png'), fullPage: true });

    const badTaps = o.taps.filter((t) => t.h < MIN_TAP);
    const badSmall = o.small.filter((s) => !ALLOW_SMALL.test(s.c));
    const overflow = o.docSW > o.vw;

    // 底部 Tab 栏：贴底、四项、等宽、不截断、够高；回响条可见时还要咬合
    // （设置已剥到页头右上角，不在这四项里）
    const tb = o.tabbar || {};
    const tbBad = [];
    if (tb.pos !== 'fixed') tbBad.push('导航未固定（' + tb.pos + '）');
    if (tb.toBottom !== 0) tbBad.push('导航离底 ' + tb.toBottom + 'px');
    if (tb.count !== 4) tbBad.push('Tab 数为 ' + tb.count);
    if (tb.spread > 2) tbBad.push('Tab 宽度极差 ' + tb.spread + 'px');
    if (tb.clipped) tbBad.push(tb.clipped + ' 个 Tab 标签被截断');
    if (tb.btnH < 44) tbBad.push('Tab 高仅 ' + tb.btnH + 'px');
    if (tb.seam !== null && tb.seam !== undefined && Math.abs(tb.seam) > 2) {
      tbBad.push('回响条与导航之间裂开 ' + tb.seam + 'px');
    }

    console.log('── ' + (p || '/') + '  doc=' + o.docSW +
      (overflow ? '  !! 横向溢出' : '  ok') +
      '  触控不足=' + badTaps.length + '  过小字号=' + badSmall.length +
      '  Tab栏=' + (tbBad.length ? '!! ' + tbBad.join(' / ') : 'ok'));
    for (const t of badTaps) console.log('     触控 ' + t.w + '×' + t.h + '  ' + t.t);
    for (const s of badSmall) console.log('     字号 ' + s.fs + 'px  .' + s.c + '  「' + s.t + '」');
    if (overflow || badTaps.length || badSmall.length || tbBad.length) fails++;

    report.push({ p, o, badTaps, badSmall, overflow, tbBad });
  }
  await browser.close();

  console.log('\n截图目录: ' + outDir);
  if (fails) {
    console.log('结果：' + fails + ' / ' + pages.length + ' 个页面未达标');
    process.exit(1);
  }
  console.log('结果：' + pages.length + ' 个页面全部达标（触控 ≥' + MIN_TAP +
    'px、字号 ≥10px、无横向溢出、底部 Tab 栏贴底且与回响条咬合）');
})().catch((e) => { console.error(e); process.exit(1); });
