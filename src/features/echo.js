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

  function count() { return (MI.store.get().meta.ledger || []).length; }

  // 右上角入口的红点：有未读日志时亮，打开抽屉后熄灭。
  // 红点只提示「有没有新回响」，不显示条数——想看账本内容点进去即可。
  function syncBadge() {
    var badge = document.getElementById('ledger-badge');
    if (!badge) return;
    var hasUnread = (MI.store.get().meta.ledger || []).some(function (e) { return e.unread; });
    badge.hidden = !hasUnread;
  }

  // 日志抽屉的列表。抽屉平时是收起的，但列表随时保持最新——
  // 这样打开时永远是完整的账本，不需要「打开后再渲染」这一步。
  function renderDrawer() {
    var list = document.getElementById('ledger-list');
    if (!list) return;
    var log = MI.store.get().meta.ledger || [];
    list.innerHTML = log.length
      ? log.map(renderEntry).join('')
      : '<p class="ledger-empty">还没有记录。你做的每一步都会出现在这里。</p>';
  }

  // 兼容旧调用（store.subscribe 之外的调用方）：一次同步所有日志 UI
  function renderBar() {
    syncBadge();
    renderDrawer();
  }

  // ── 悬浮通知 ─────────────────────────────────────────
  // 有新日志时，在底部 Tab 栏（手机）/ 页脚（桌面）上方浮现几秒。
  // 常驻展示交给右上角的日志入口；这里只负责「刚刚发生了什么」。
  var TOAST_MS = 3600;
  var LEAVE_MS = 280;
  var toastTimer = null;

  function showToast(entry) {
    var toast = document.getElementById('ledger-toast');
    var body = document.getElementById('ledger-toast-body');
    var countEl = document.getElementById('ledger-toast-count');
    if (!toast || !body || !entry) return;
    body.innerHTML = '<strong>' + d.esc(entry.title) + '</strong>' +
      (entry.detail ? '<span>' + d.esc(entry.detail) + '</span>' : '');
    if (countEl) countEl.textContent = String(count());
    toast.hidden = false;
    // 重播入场动画：连续多条回响时，每一条都重新浮一次
    toast.classList.remove('is-in', 'is-leaving');
    void toast.offsetWidth;
    toast.classList.add('is-in');
    armToastTimer();
  }

  function armToastTimer() {
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, TOAST_MS);
  }

  function hideToast() {
    var toast = document.getElementById('ledger-toast');
    if (!toast || toast.hidden) return;
    clearTimeout(toastTimer);
    toast.classList.add('is-leaving');
    setTimeout(function () {
      toast.hidden = true;
      toast.classList.remove('is-in', 'is-leaving');
    }, LEAVE_MS);
  }

  function paint(entry) {
    syncBadge();
    renderDrawer();
    if (entry) showToast(entry);
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
    //    角标、抽屉列表与悬浮通知仍然在。
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
    syncBadge();
    renderDrawer();
    hideToast();
  }

  // ── 挂载 ─────────────────────────────────────────────
  function mount() {
    if (mounted) return;
    mounted = true;

    var open = document.getElementById('ledger-open');
    var close = document.getElementById('ledger-close');
    if (open) {
      open.addEventListener('click', function () {
        MI.store.markLedgerRead();
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

    // 悬浮通知：点它直接打开日志抽屉；鼠标悬停时不自动收起
    var toastBtn = document.getElementById('ledger-toast-open');
    var toast = document.getElementById('ledger-toast');
    if (toastBtn) {
      toastBtn.addEventListener('click', function () {
        hideToast();
        MI.store.markLedgerRead();
        if (MI.app && MI.app.paintLedgerNote) MI.app.paintLedgerNote();
        if (MI.app && MI.app.openOverlay) MI.app.openOverlay('ledger-drawer', 'ledger-close');
        var btn = document.getElementById('ledger-open');
        if (btn) btn.setAttribute('aria-expanded', 'true');
      });
    }
    if (toast) {
      toast.addEventListener('mouseenter', function () { clearTimeout(toastTimer); });
      toast.addEventListener('mouseleave', armToastTimer);
    }

    // 数据变化（导入、清空、回滚）后角标与抽屉列表要跟着走
    MI.store.subscribe(renderBar);
    renderBar();
  }

  MI.echo = {
    push: push,
    engineReceipt: engineReceipt,
    renderBar: renderBar,
    syncBadge: syncBadge,
    showToast: showToast,
    hideToast: hideToast,
    reset: reset,
    mount: mount,
    count: count
  };
})(window.MI);
