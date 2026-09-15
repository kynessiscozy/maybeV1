#!/usr/bin/env node
// ab.sh 的 Node 侧实现：用 Playwright 驱动系统 Chromium。
// 关键点：整个过程只启动一次浏览器，把「脚本」当参数读进来按顺序执行，
// 这样 verify.sh 里每条断言不用重开一次 Chromium。
'use strict';

const path = require('path');
const fs = require('fs');

function loadPlaywright() {
  try { return require('playwright'); } catch (e) { /* 继续找 */ }
  const roots = [];
  if (process.env.MI_PW_PKG) roots.push(process.env.MI_PW_PKG);
  try {
    const { execSync } = require('child_process');
    const py = execSync(
      'python3 -c "import playwright,os;print(os.path.join(os.path.dirname(playwright.__file__),\'driver\',\'package\'))"',
      { encoding: 'utf8' }
    ).trim();
    if (py) roots.push(py);
  } catch (e) { /* 忽略 */ }
  roots.push('/root/.pyenv/versions/3.11.1/lib/python3.11/site-packages/playwright/driver/package');
  for (const r of roots) {
    try { return require(r); } catch (e) { /* 继续找 */ }
  }
  throw new Error('找不到 playwright 包，可用 MI_PW_PKG 指定路径');
}

// 输入：每行一条命令，制表符分隔。空行与 # 开头的行忽略。
function parseScript(text) {
  const cmds = [];
  for (const raw of String(text).split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const i = line.indexOf('\t');
    if (i < 0) { cmds.push([line.trim()]); continue; }
    const op = line.slice(0, i).trim();
    const arg = line.slice(i + 1);
    if (op === 'eval' || op === 'deval') {
      try { cmds.push([op, JSON.parse(arg)]); }
      catch (e) { cmds.push([op, arg]); }
    } else {
      cmds.push([op, arg]);
    }
  }
  return cmds;
}

async function main() {
  const scriptFile = process.argv[2];
  if (!scriptFile) { process.stderr.write('abcli: 需要脚本文件路径\n'); process.exit(2); }
  const cmds = parseScript(fs.readFileSync(scriptFile, 'utf8'));

  const exe = process.env.MI_CHROME || '/usr/bin/chromium';
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({
    executablePath: exe,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push('[console.error] ' + m.text()); });
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));

  const out = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  try {
    for (const [op, a, b] of cmds) {
      try {
        if (op === 'open') {
          errors.length = 0;
          await page.goto(a, { waitUntil: 'load', timeout: 30000 });
        } else if (op === 'reload') {
          await page.reload({ waitUntil: 'load', timeout: 30000 });
        } else if (op === 'wait') {
          await sleep(Number(a) || 300);
        } else if (op === 'click') {
          await page.click(a, { timeout: 15000 });
        } else if (op === 'scrollintoview') {
          await page.locator(a).first().scrollIntoViewIfNeeded({ timeout: 15000 });
        } else if (op === 'setviewport') {
          // ab.sh 把两个数字写成一个参数（"1440 900"），也可能是两个
          const parts = String(b === undefined ? a : a + ' ' + b).trim().split(/\s+/);
          const w = Number(parts[0]);
          const h = Number(parts[1]);
          if (w > 0 && h > 0) await page.setViewportSize({ width: w, height: h });
        } else if (op === 'screenshot') {
          const p = a || path.join('/tmp', 'mi-shot-' + Date.now() + '.png');
          await page.screenshot({ path: p, fullPage: true });
          out.push('#SHOT ' + p);
        } else if (op === 'eval') {
          const r = await page.evaluate(a);
          // undefined 也必须产出一条 #VAL，否则结果序列与断言序列会错位一格，
          // 后面所有比对都会看起来「莫名其妙地错」。空串是这里唯一合法的空结果。
          const txt = r === undefined ? '' : (typeof r === 'string' ? r : JSON.stringify(r));
          out.push('#VAL ' + txt);
        } else if (op === 'deval') {
          // 驱动用：执行但不产出 #VAL，免得打乱断言与人头数的对应关系。
          //
          // 注意：在 page.evaluate 里给 location.hash 赋值不会触发 hashchange
          // （Chromium 只在用户/URL 导航时派发），路由因此不会重渲染。
          // 这里检测到这种写法就补一次事件派发。
          const src = String(a).trim();
          await page.evaluate(a);
          // 在 page.evaluate 里赋值 location.hash 不会派发 hashchange，
          // 路由因此停在原地。补一次派发，让后续断言看到新页面。
          if (/location\.hash\s*=/.test(src)) {
            await page.evaluate('window.dispatchEvent(new HashChangeEvent("hashchange"))');
          }
        } else if (op === 'errors') {
          // 多条报错不能直接 join('\n')：那会把后续内容挤成独立行，
          // 一旦某行的开头恰好像 #VAL / #SHOT，就会混进断言流里把顺序搅乱。
          // 这里把换行替换成 ' | '，始终只占一行。
          out.push('#ERR ' + errors.join(' | ').replace(/\r?\n/g, ' | '));
        } else {
          out.push('#ERR abcli: 未实现的子命令 ' + op);
        }
      } catch (e) {
        var msg = String((e && e.message) || e).replace(/\r?\n/g, ' | ');
        out.push('#ERR abcli: ' + op + ' 失败：' + msg);
      }
    }
  } finally {
    await ctx.close();
    await browser.close();
  }
  process.stdout.write(out.join('\n') + (out.length ? '\n' : ''));
}

main().catch((e) => { process.stderr.write(String((e && e.stack) || e) + '\n'); process.exit(1); });
