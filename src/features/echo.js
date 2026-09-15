window.MI = window.MI || {};
(function (MI) {
  'use strict';

  var d = MI.dom;

  /* ────────────────────────────────────────────────────────────
     回响（echo）
     这个应用原本只有三处操作会留下可见后果：评任务难度、判断路线、
     回应恐惧模型。其余八类操作——打卡、走完七天、收藏、展开念头、
     选预设、设置资料、蒸馏、清空——做完就没了，只闪一个 toast。
     其中「走完七天」最严重：它连恐惧模型都不触发重算，而恐惧模型的
     you_will_quit 原型明确把「完成天数」当作证据。

     echo 的职责：让每一次有后果的操作都留下一条看得见的记录。
     它与 receipt 的分工是刻意的——
       · receipt 渲染「引擎改了什么」，带 ⟳ / REV 的语义；
       · echo 渲染「刚刚发生了什么」，包括与引擎无关的事（走完七天）。
     把两者压成一条通道，就得给「走完七天」伪造一个状态增量，
     否则 receipt 的 effective 标记会渲染出假话。

     push() 的顺序不能改：
       1. 重算派生状态（必须在 store.update 返回之后，见下）
       2. 追加日志
       3. 渲染
     ──────────────────────────────────────────────────────────── */

  var mounted = false;

  function root() { return document.getElementById('view'); }

  // ── 派生状态重算 ─────────────────────────────────────
  // 注意：这个函数只能在 store.update 返回之后调用。
  // 若放进 update 的回调里，会形成 update → persist → emit 的嵌套，
  // emit 会跑两次，syncCounts 会在数据改到一半时就读到中间态。
  // 既有代码 feedback.afterFeedback() 也是这个模式，保持一致。
  function recompute(delta) {
    if (!delta) return;
    if (delta.fear && MI.fear && MI.fear.recompute) {
      try { MI.fear.recompute(); } catch (e) { /* 重算失败不应阻断这次操作 */ }
    }
    if (delta.evolution && MI.evolution && MI.evolution.recompute) {
      try { MI.evolution.recompute(); } catch (e) { /* 同上 */ }
    }
  }

  // ── 渲染 ─────────────────────────────────────────────
  function renderEntry(entry) {
    return '<div class="ledger-entry">' +
      '<span class="ledger-entry-mark" aria-hidden="true">·</span>' +
      '<span class="ledger-entry-body">' +
      '<strong>' + d.esc(entry.title) + '</strong>' +
      (entry.detail ? '<span>' + d.esc(entry.detail) + '</span>' : '') +
      '</span>' +
      '<time class="ledger-entry-time">' + d.esc(d.relativeDay(entry.date)) + '</time>' +
      '</div>';
  }

  // 日志条只显示最新一条，让「每一步都有回响」在界面上始终成立
  function renderBar() {
    var bar = document.getElementById('ledger-bar');
    var latest = document.getElementById('ledger-latest');
    var list = document.getElementById('ledger-list');
    if (!bar || !latest) return;
    var log = MI.store.get().meta.ledger || [];

    if (!log.length) {
      bar.hidden = true;
      if (list) list.innerHTML = '<p class="ledger-empty">还没有记录。你做的每一步都会出现在这里。</p>';
      return;
    }

    var top = log[0];
    latest.innerHTML = '<span class="ledger-latest-body">' +
      '<strong>' + d.esc(top.title) + '</strong>' +
      (top.detail ? '<span>' + d.esc(top.detail) + '</span>' : '') +
      '</span>' +
      '<span class="ledger-count">' + log.length + '</span>';
    bar.hidden = false;

    if (list) {
      list.innerHTML = log.map(renderEntry).join('');
    }
  }

  function paint(entry) {
    renderBar();
    var bar = document.getElementById('ledger-bar');
    if (bar && MI.motion && entry) MI.motion.flash(bar, 'ledger-pulse', 1200);
  }

  // ── 主入口 ───────────────────────────────────────────
  function push(opts) {
    opts = opts || {};
    if (!opts.title) return null;

    // 1. 先重算派生状态。放在写日志之前，这样日志里的数字已经是新的。
    recompute(opts.delta);

    // 2. 落盘
    var entry = null;
    MI.store.update(function () { entry = MI.store.appendLedger(opts); });

    // 3. 渲染。
    //    inline 目标若带 anchor 就写进该容器；但宿主在 shell 层，
    //    所以即便后面跟一次 router.render() 把 #view 清空，
    //    日志条上的记录仍然在。
    if (opts.surface !== 'ledger' && opts.anchor) {
      var host = root();
      var slot = host && host.querySelector(opts.anchor);
      if (slot) {
        slot.innerHTML = '<div class="echo-inline">' +
          '<span class="echo-inline-mark" aria-hidden="true">⟳</span>' +
          '<span><strong>' + d.esc(opts.title) + '</strong>' +
          (opts.detail ? '<span>' + d.esc(opts.detail) + '</span>' : '') +
          '</span></div>';
        slot.hidden = false;
        if (MI.motion) MI.motion.flash(slot.firstChild, 'receipt-in', 1400);
      }
    }

    paint(entry);
    return entry;
  }

  // 引擎侧的回执：复用 receipt 的 ⟳ / REV 视觉语言。
  // 这些是既有行为，必须原样保留。
  function engineReceipt(rootEl, selector, receiptObj) {
    if (!MI.receipt) return null;
    var shown = MI.receipt.show(rootEl, selector, receiptObj);
    if (shown) {
      push({
        kind: receiptObj.kind,
        title: receiptObj.title,
        detail: receiptObj.detail,
        surface: 'ledger'
      });
    }
    return shown;
  }

  function reset() {
    MI.store.update(function () { MI.store.clearLedger(); });
    var bar = document.getElementById('ledger-bar');
    if (bar) bar.hidden = true;
    var list = document.getElementById('ledger-list');
    if (list) list.innerHTML = '<p class="ledger-empty">还没有记录。你做的每一步都会出现在这里。</p>';
  }

  // ── 挂载 ─────────────────────────────────────────────
  function mount() {
    if (mounted) return;
    mounted = true;

    var open = document.getElementById('ledger-open');
    var close = document.getElementById('ledger-close');
    if (open) {
      open.addEventListener('click', function () {
        if (MI.app && MI.app.paintLedgerNote) MI.app.paintLedgerNote();
        if (MI.app && MI.app.openOverlay) MI.app.openOverlay('ledger-drawer', 'ledger-close');
        open.setAttribute('aria-expanded', 'true');
      });
    }
    if (close) {
      close.addEventListener('click', function () {
        // 走既有的遮罩关闭路径：它已经处理了 inert、焦点归还与 Escape
        if (MI.app && MI.app.closeOverlay) MI.app.closeOverlay('ledger-drawer');
        var btn = document.getElementById('ledger-open');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      });
    }
    var drawer = document.getElementById('ledger-drawer');
    if (drawer) {
      drawer.addEventListener('click', function (e) {
        if (e.target === this && MI.app && MI.app.closeOverlay) {
          MI.app.closeOverlay('ledger-drawer');
        }
      });
    }

    // 数据变化（导入、清空、回滚）后日志条要跟着走
    MI.store.subscribe(renderBar);
    renderBar();
  }

  MI.echo = {
    push: push,
    engineReceipt: engineReceipt,
    renderBar: renderBar,
    reset: reset,
    mount: mount,
    count: function () { return (MI.store.get().meta.ledger || []).length; }
  };
})(window.MI);
