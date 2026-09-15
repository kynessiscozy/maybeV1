window.MI = window.MI || {};
(function (MI) {
  'use strict';

  var d = MI.dom;

  function memoStyles() {
    return '*{box-sizing:border-box}' +
      'body{margin:0;background:#f5f4ef;color:#344033;font-family:"Segoe UI","Microsoft YaHei",sans-serif;line-height:1.9}' +
      '.paper{max-width:850px;margin:50px auto;background:#fffef8;padding:55px;border:1px solid #dedfd5}' +
      '.brand{letter-spacing:3px;font-size:12px;color:#c96939}' +
      'h1{font-family:Georgia,SimSun,serif;font-weight:400;font-size:33px;line-height:1.6;margin:32px 0 20px;overflow-wrap:anywhere}' +
      '.tag{font-size:12px;color:#929980}' +
      'h2{font-family:Georgia,SimSun,serif;font-weight:400;font-size:26px;margin-top:34px}' +
      'p{font-size:14px;color:#7b876e}' +
      '.node{padding:16px 0;border-bottom:1px solid #e1e5d7}' +
      '.node strong{font-size:15px;font-weight:500}' +
      '.node p{font-size:12px;margin:5px 0}' +
      'ol{padding:0;list-style:none}' +
      'li{padding:14px 0;border-bottom:1px solid #e2e7d8;font-size:13px}' +
      '.day{font:10px monospace;color:#b76c43;margin-right:15px}' +
      '.done{color:#91a181;text-decoration:line-through}' +
      '.note{font-size:11px;line-height:1.9;border-top:1px dashed #d2d9c6;padding-top:25px;margin-top:30px;color:#8b947d}' +
      '.quote{font:italic 17px Georgia,SimSun,serif;color:#849374}' +
      'footer{font-size:10px;color:#929a83;margin-top:30px}' +
      '@media(max-width:600px){.paper{margin:0;padding:30px 23px}h1{font-size:28px}}' +
      '@media print{body{background:white}.paper{border:none;margin:0;max-width:none;padding:20px}.node,li{break-inside:avoid}}';
  }

  // 把当前方案整理成一份可离线阅读、可打印的静态文档
  function buildMemoHTML() {
    var s = MI.store.get();
    var plan = MI.session.ensure();
    var route = s.session.route;
    var routeData = plan.routes[route];
    var done = s.session.done[route] || [];
    var date = new Date().toISOString();

    var nodes = routeData.nodes.map(function (n, i) {
      return '<section class="node"><strong>0' + (i + 1) + ' / ' + d.esc(n.title) + '</strong>' +
        '<p>' + d.esc(n.advice) + '</p></section>';
    }).join('');

    var days = routeData.days.map(function (text, i) {
      var isDone = done.indexOf(i) > -1;
      return '<li' + (isDone ? ' class="done"' : '') + '><span class="day">DAY 0' + (i + 1) +
        ' ' + (isDone ? '✓' : '□') + '</span>' + d.esc(text) + '</li>';
    }).join('');

    var memory = MI.memory.summary();
    var memoryBlock = memory.length
      ? '<h2>事务所记得的你</h2><p>' + memory.map(d.esc).join('<br>') + '</p>'
      : '';

    var engineNote = plan.engine === 'ai'
      ? '本方案由你在设置中接入的模型生成，经由本地关键词与规则引擎校验。'
      : '本方案由本地关键词匹配与策划好的行动模板生成，未调用任何模型。';

    return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + d.esc(plan.idea) + ' · 可能性备忘录</title>' +
      '<style>' + memoStyles() + '</style></head><body><main class="paper">' +
      '<div class="brand">未发生事务所 / THE MAYBE INSTITUTE</div>' +
      '<h1>' + d.esc(plan.idea) + '</h1>' +
      '<div class="tag">' + d.esc(MI.data.ROUTE_NAMES[route]) + ' · ' + plan.time + ' 分钟 / 天 · ' +
      '偏离惯性 ' + plan.courage + '% · ' + d.esc(d.formatDate(date)) + '</div>' +
      '<h2>' + d.esc(MI.data.ROUTE_NAMES[route]) + '</h2>' +
      '<p>' + d.esc(routeData.description) + '</p>' +
      nodes +
      memoryBlock +
      '<h2>七天，让它真实一点。</h2>' +
      '<p>已完成 ' + done.length + ' / 7 · 每天以 ' + plan.time + ' 分钟为上限，可自由拆分。可以跳过，可以重来。</p>' +
      '<ol>' + days + '</ol>' +
      '<div class="note">' + engineNote +
      '不预测未来，不代表成功保证，也不构成专业建议。所写的远期愿景不意味着七天内实现。<br>' +
      '这是导出时的静态副本，可用浏览器打印或另存为 PDF；勾选进度请回到原作品操作。本文件不上传数据。</div>' +
      '<footer><p class="quote">“允许生活，出现计划之外的分支。”</p>' +
      '从尚未发生的地方，寄给准备开始的你。</footer>' +
      '</main></body></html>';
  }

  function downloadMemo() {
    var html = buildMemoHTML();
    var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = '未发生事务所-' + MI.data.ROUTE_NAMES[MI.store.get().session.route] + '-可能性备忘录.html';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
    d.toast('已开始导出备忘录。打开后可以离线阅读或打印。');
  }

  MI.exporter = { buildMemoHTML: buildMemoHTML, downloadMemo: downloadMemo };
})(window.MI);
