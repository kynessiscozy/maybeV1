window.MI = window.MI || {};
(function (MI) {
  'use strict';

  var d = MI.dom;

  /* ────────────────────────────────────────────────────────────
     反馈回执
     自进化算得很细，但用户看不到自己那一票改变了什么。
     这里把 evolution / fear 的最新一条变更翻译成一句人话回执，
     让「我给了反馈 → 引擎做了什么」这条链路在界面上闭合。

     注意：回执会出现在路线上，也会出现在导出的备忘录里，
     所以默认做匿名化处理——不回显念头原文，只给长度与主题。
     ──────────────────────────────────────────────────────────── */

  var ROUTE_SHORT = {
    like: '像我',
    unlike: '不太像我',
    unsure: '说不准'
  };

  var TASK_SHORT = {
    hard: '太难',
    ok: '刚好',
    easy: '太简单'
  };

  // 匿名化的念头代号：只暴露长度，不暴露内容
  function ideaTag(idea) {
    var text = String(idea || '').trim();
    if (!text) return '那次念头';
    return text.length + ' 个字的念头';
  }

  // 把「最近的变更日志」压缩成一句可直接展示的说明
  function latest(kind) {
    if (kind === 'fear') {
      var model = MI.store.get().fear.model;
      var log = (model && model.log) ? model.log : [];
      return log.length ? log[log.length - 1] : null;
    }
    var evo = MI.evolution.log();
    return evo && evo.length ? evo[0] : null;
  }

  function routeReceipt(route, verdict, idea) {
    var item = latest('evolution');
    return {
      kind: 'route',
      title: '你判断「' + MI.data.ROUTE_NAMES[route] + '」' + (ROUTE_SHORT[verdict] || verdict),
      detail: item
        ? item.trigger + ' → ' + item.change
        : '这是这条路上的第一次判断。再来一次不同念头的判断，权重就会开始移动。',
      effective: !!item,
      revision: MI.evolution.revision(),
      tag: ideaTag(idea)
    };
  }

  function taskReceipt(route, day, level) {
    var item = latest('evolution');
    return {
      kind: 'task',
      title: '第 ' + (day + 1) + ' 天的任务，你评了「' + (TASK_SHORT[level] || level) + '」',
      detail: item
        ? item.trigger + ' → ' + item.change
        : '继续记录几次难度，它就会开始调整之后的任务规模。',
      effective: !!item,
      revision: MI.evolution.revision(),
      scale: MI.evolution.scale(),
      tag: MI.data.ROUTE_NAMES[route]
    };
  }

  function fearReceipt(verdict, turnIndex) {
    var map = {
      hit: '你承认这句话击中了',
      rebut: '你反驳了它',
      avoid: '你选择先绕过这句'
    };
    var item = latest('fear');
    var der = MI.fear.derive();
    return {
      kind: 'fear',
      title: map[verdict] || '你给了它一个反应',
      detail: item
        ? item.change + '（REV ' + item.revision + '）'
        : '它的确定性现在是 ' + Math.round(der.certainty * 100) + '%。',
      effective: !!item,
      revision: der.certainty,
      turn: turnIndex
    };
  }

  // ── 渲染 ─────────────────────────────────────────────
  function render(receipt) {
    if (!receipt) return '';
    var cls = 'receipt' + (receipt.effective ? ' effective' : '');
    return '<div class="' + cls + '" role="status">' +
      '<span class="receipt-mark" aria-hidden="true">' + (receipt.effective ? '⟳' : '·') + '</span>' +
      '<span class="receipt-body">' +
      '<strong>' + d.esc(receipt.title) + '</strong>' +
      '<span>' + d.esc(receipt.detail) + '</span>' +
      '</span>' +
      (receipt.effective
        ? '<span class="receipt-rev">' + (receipt.kind === 'fear' ? '确定 ' : 'REV ') +
        (receipt.kind === 'fear' ? Math.round(receipt.revision * 100) + '%' : receipt.revision) + '</span>'
        : '') +
      '</div>';
  }

  // 写进指定的容器；容器不存在时静默跳过
  function show(root, selector, receipt) {
    var host = root && root.querySelector(selector);
    if (!host) return null;
    host.innerHTML = render(receipt);
    host.hidden = false;
    var node = host.firstChild;
    if (node && MI.motion) MI.motion.flash(node, 'receipt-in', 1400);
    return receipt;
  }

  function clear(root, selector) {
    var host = root && root.querySelector(selector);
    if (host) { host.hidden = true; host.innerHTML = ''; }
  }

  MI.receipt = {
    ideaTag: ideaTag,
    routeReceipt: routeReceipt,
    taskReceipt: taskReceipt,
    fearReceipt: fearReceipt,
    render: render,
    show: show,
    clear: clear
  };
})(window.MI);
