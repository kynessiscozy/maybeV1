window.MI = window.MI || {};
(function (MI) {
  'use strict';

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function delegate(root, type, selector, handler) {
    root.addEventListener(type, function (e) {
      var target = e.target.closest(selector);
      if (target && root.contains(target)) handler(e, target);
    });
  }

  var toastTimer = null;
  function toast(text, ms) {
    var node = $('#toast');
    if (!node) return;
    clearTimeout(toastTimer);
    node.textContent = text;
    node.hidden = false;
    toastTimer = setTimeout(function () { node.hidden = true; }, ms || 3800);
  }

  function pad(n, width) {
    return String(n).padStart(width, '0');
  }

  function formatDate(iso) {
    try {
      return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
    } catch (e) {
      return '日期未记录';
    }
  }

  function relativeDay(iso) {
    var then = new Date(iso);
    var now = new Date();
    var days = Math.floor((now - then) / 86400000);
    if (days <= 0) return '今天';
    if (days === 1) return '昨天';
    if (days < 7) return days + ' 天前';
    return formatDate(iso);
  }

  function uid() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return String(Date.now()) + Math.random().toString(36).slice(2, 8);
  }

  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

  function truncate(text, len) {
    text = String(text || '');
    return text.length > len ? text.slice(0, len) + '…' : text;
  }

  // ── 折叠块 ────────────────────────────────────────────
  // 页面上大段说明性文字默认收起，只在用户想知道时才展开。
  // 用原生 <details>，键盘与读屏开箱可用，不需要额外的 ARIA 补丁。
  //
  //   opts.summary  折叠时可见的标题
  //   opts.hint     标题右侧的短提示（说明里面是什么）
  //   opts.open     是否默认展开
  //   opts.body     展开后的内容（HTML 字符串）
  //   opts.id       需要外部引用时给出
  function fold(opts) {
    opts = opts || {};
    var hint = opts.hint
      ? '<span class="fold-hint">' + esc(opts.hint) + '</span>'
      : '';
    // cls 必须拼进 class 属性里——以前拼成了裸属性（<details class="fold" fold-panel>），
    // .fold-panel / .fold-aside / .fold-warn / .fold-inset 这些样式从未生效过。
    return '<details class="fold' + (opts.cls ? ' ' + opts.cls : '') + '"' +
      (opts.open ? ' open' : '') +
      (opts.id ? ' id="' + esc(opts.id) + '"' : '') + '>' +
      '<summary><span class="fold-title">' + (opts.summary || '展开') + '</span>' + hint +
      '<span class="fold-mark" aria-hidden="true"></span></summary>' +
      '<div class="fold-body">' + (opts.body || '') + '</div>' +
      '</details>';
  }

  // 一组要点，折叠块内部常用
  function points(list) {
    return '<div class="about-list">' + list.map(function (item) {
      return '<div>' + item + '</div>';
    }).join('') + '</div>';
  }

  MI.dom = {
    esc: esc, $: $, $$: $$, delegate: delegate, toast: toast,
    pad: pad, formatDate: formatDate, relativeDay: relativeDay,
    uid: uid, clamp: clamp, truncate: truncate,
    fold: fold, points: points
  };
})(window.MI);
