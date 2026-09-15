#!/usr/bin/env node
/* 构建：把 src/ 下的模块按依赖顺序拼成单文件产物。
   产物零外部依赖，可直接双击打开。 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'outputs', 'index.html');

// 顺序即依赖：dom 必须最先，app 必须最后
const MODULES = [
  'src/core/dom.js',
  'src/core/viewport.js',
  'src/core/motion.js',
  'src/core/art.js',
  'src/core/store.js',
  'src/core/router.js',
  'src/core/session.js',
  'src/features/data.js',
  'src/features/evolution.js',
  'src/features/memory.js',
  'src/features/feedback.js',
  'src/features/fear.js',
  'src/features/generate.js',
  'src/features/ai.js',
  'src/features/receipt.js',
  'src/features/echo.js',
  'src/features/journey.js',
  'src/features/export.js',
  'src/views/landing.js',
  'src/views/lab.js',
  'src/views/route.js',
  'src/views/fear.js',
  'src/views/me.js',
  'src/views/settings.js',
  'src/views/about.js',
  'src/views/stress.js',
  'src/app.js'
];

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// 产物压缩：去掉行首缩进与空行。
// 这是刻意保守的压缩——只动字符串字面量之外的空白：
// 源码是 ES5，字符串不会跨行（无模板字符串、无行尾续行），
// 行首缩进永远在引号之外，因此按行处理是安全的。
// 更激进的混淆交给部署方，这里保证产物仍然可读、可 diff。
function squeeze(code) {
  return code.split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => line.replace(/^[ \t]+/, ''))
    .join('\n');
}

function main() {
  const missing = MODULES.filter((m) => !fs.existsSync(path.join(ROOT, m)));
  if (missing.length) {
    console.error('缺少模块：\n  ' + missing.join('\n  '));
    process.exit(1);
  }

  const css = squeeze(read('src/styles.css'));
  const js = MODULES.map((m) => '/* ===== ' + m + ' ===== */\n' + squeeze(read(m))).join('\n');
  const shell = read('src/shell.html');

  // 内联脚本里出现 </script> 会提前结束脚本块
  if (/<\/script/i.test(js)) {
    console.error('构建中止：脚本内容里包含 </script，会破坏内联脚本块。');
    process.exit(1);
  }

  // 语法校验：拼装结果必须能被解析
  try {
    new vm.Script(js);
  } catch (err) {
    console.error('构建中止：拼装后的脚本无法解析。\n' + err.message);
    process.exit(1);
  }

  // 用函数式替换，避免内容里的 $ 被当作替换模式
  const html = shell
    .replace('/*__CSS__*/', () => css)
    .replace('/*__JS__*/', () => js);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, html, 'utf8');

  const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
  const external = html.match(/(?:src|href)="https?:\/\//g);
  console.log('构建完成');
  console.log('  产物      ' + path.relative(ROOT, OUT));
  console.log('  大小      ' + kb + ' KB');
  console.log('  模块      ' + MODULES.length + ' 个');
  console.log('  外部依赖  ' + (external ? external.length + ' 处（应为 0）' : '无，完全离线'));
  if (external) process.exit(1);
}

main();
