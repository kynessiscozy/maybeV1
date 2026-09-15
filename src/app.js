window.MI = window.MI || {};
(function (MI) {
  'use strict';

  var d = MI.dom;
  var focusBeforeModal = null;

  var NAV_MAP = {
    '/lab': '/lab',
    '/route': '/lab',
    '/fear': '/fear',
    '/archive': '/archive',
    '/stress': '/stress',
    '/settings': '/settings',
    '/about': '/settings'
  };

  // 每个路由对应的一行「情境提示」：比一次性弹窗更贴身
  var CONTEXT_HINTS = {
    '/': '从一句话开始：不写目标，写那个你总在回避的念头。',
    '/lab': '写下一个念头后展开。地图可以拖动，也可以用方向键在九个节点间走。',
    '/route': '每完成一天就打一次卡。给它评个难度，下次任务规模会跟着变。',
    '/fear': '它说的每一句都能追溯到你的记录。认真反驳，它的确定性会下降。',
    '/archive': '收藏的版本在一边，它学到的你在另一边。都只在本地，随时可删。',
    '/stress': '90 题，约十分钟。它把「压力」画成一张可看的图，不诊断，不评判。作答只留在本浏览器。',
    '/settings': '留空也能用。接入模型只是让建议更贴身，不是必需项。',
    '/about': '想知道它不做什么，比知道它能做什么更重要。'
  };

  // ── 未找到 ───────────────────────────────────────────
  MI.views = MI.views || {};
  MI.views.notFound = {
    title: '找不到这一页',
    render: function () {
      return '<section class="page">' +
        '<div class="page-head with-art">' +
        '<div>' +
        '<div class="eyebrow">404</div>' +
        '<h1 class="page-title">这条路还没有发生。</h1>' +
        '<p class="page-desc">你访问的页面不存在。也许它属于另一种可能。</p>' +
        '</div>' +
        MI.figure('missing', '一条虚线小路消失在空白的纸上') +
        '</div>' +
        '<button class="btn btn-primary" data-nav="/lab">回到实验室</button>' +
        '</section>';
    }
  };

  // ── 导航高亮与计数 ───────────────────────────────────
  function syncNav(path) {
    var section = '/' + (path.split('/')[1] || '');
    var target = NAV_MAP[section] || null;
    d.$$('#nav button').forEach(function (btn) {
      var on = btn.dataset.nav === target;
      btn.classList.toggle('active', on);
      if (on) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    });
    // 设置已经不在 #nav 里了，它在页头右上角。
    // 它同样需要高亮态，否则进到设置页时整页没有任何位置被点亮，
    // 用户看不出自己在哪。用的是同一个 target，/about 也一并点亮。
    var gear = document.getElementById('settings-button');
    if (gear) {
      var gearOn = gear.dataset.nav === target;
      gear.classList.toggle('active', gearOn);
      if (gearOn) gear.setAttribute('aria-current', 'page');
      else gear.removeAttribute('aria-current');
    }
    scrollNavIntoView();
  }

  // 窄屏上导航是横向滑动的，当前项可能停在可视区之外。
  // 不把它拉回视野，用户会觉得「点了没反应」——高亮确实变了，只是看不见。
  function scrollNavIntoView() {
    var nav = document.getElementById('nav');
    if (!nav) return;
    // 只在真的能横向滚动时才动，桌面端不做任何事
    if (nav.scrollWidth <= nav.clientWidth) return;
    var active = nav.querySelector('button.active');
    if (!active) return;
    var left = active.offsetLeft;
    var right = left + active.offsetWidth;
    var viewL = nav.scrollLeft;
    var viewR = viewL + nav.clientWidth;
    if (left < viewL) {
      nav.scrollLeft = Math.max(0, left - 8);
    } else if (right > viewR) {
      nav.scrollLeft = right - nav.clientWidth + 8;
    }
  }

  function syncCounts() {
    var s = MI.store.get();
    var archiveCount = document.getElementById('nav-archive-count');
    // 数字变化时滚动一下，让「又存了一份」有反馈
    if (archiveCount) rollCount(archiveCount, s.saved.length, 2);

    var dot = document.getElementById('engine-dot');
    var label = document.getElementById('engine-label');
    var ai = MI.ai.isConfigured();
    if (dot) dot.classList.toggle('warn', ai);
    if (label) label.textContent = ai ? '模型接口已启用' : '本地规则';

    // 导航当前项也同步一份到 body，便于全局样式做分层
    var section = '/' + (MI.router.current() || '/').split('/')[1];
    document.body.dataset.section = section || '/';
  }

  function rollCount(el, value, width) {
    var target = Number(value) || 0;
    var shown = Number(el.dataset.shown);
    if (shown === target) return;
    el.dataset.shown = String(target);
    // 把零填充交给滚动过程本身，否则动画途中徽标会显示成 "1" 而不是 "01"
    MI.motion.countUp(el, target, {
      from: isNaN(shown) ? 0 : shown,
      duration: 420,
      fmt: function (n) { return d.pad(n, width); }
    });
    if (!isNaN(shown) && target > shown) MI.motion.pulse(el, 'count-up', 600);
  }

  // ── 全局播报：让屏幕阅读器也能感知「引擎做了什么」 ──
  function announce(text) {
    var live = document.getElementById('live-region');
    if (!live) return;
    live.textContent = '';
    setTimeout(function () { live.textContent = text; }, 40);
  }

  // ── 通用遮罩层：供帮助弹窗与后续任何弹层复用 ─────────
  function openOverlay(id, focusId) {
    var overlay = document.getElementById(id);
    if (!overlay || !overlay.hidden) return false;
    if (!focusBeforeModal) focusBeforeModal = document.activeElement;
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    var shell = document.getElementById('shell');
    if (shell) shell.inert = true;
    var target = document.getElementById(focusId) || overlay.querySelector('button, [href], input, textarea');
    if (target) target.focus();
    MI.motion && MI.motion.flash(overlay.querySelector('.modal'), 'in', 620);
    return true;
  }

  function closeOverlay(id) {
    var overlay = document.getElementById(id);
    if (!overlay || overlay.hidden) return false;
    overlay.hidden = true;
    document.body.style.overflow = '';
    var shell = document.getElementById('shell');
    if (shell) shell.inert = false;
    if (focusBeforeModal && focusBeforeModal.focus) {
      try { focusBeforeModal.focus(); } catch (e) { /* 元素可能已不在文档里 */ }
    }
    focusBeforeModal = null;
    return true;
  }

  function anyOverlayOpen() {
    return d.$$('.overlay').some(function (o) { return !o.hidden; });
  }

  // ── 使用说明弹窗 ─────────────────────────────────────
  function openHelp() {
    if (!openOverlay('help-overlay', 'close-help')) return;
    var slot = document.getElementById('help-illu');
    if (slot && !slot.dataset.ready && MI.figure) {
      slot.innerHTML = MI.figure('help', '摊开的小册子，夹着一片叶子');
      slot.dataset.ready = '1';
    }
    paintContextHint();
  }

  function closeHelp() { closeOverlay('help-overlay'); }

  // 在帮助弹窗里补一条「你正在这一页」的提示
  function paintContextHint() {
    var slot = document.getElementById('help-context');
    if (!slot) return;
    var path = MI.router.current() || '/';
    var section = '/' + (path.split('/')[1] || '');
    var hint = CONTEXT_HINTS[section] || CONTEXT_HINTS['/'];
    slot.innerHTML = '<strong>你现在在' + d.esc(labelOf(section)) + '。</strong>' + d.esc(hint);
    slot.hidden = false;
  }

  // 日志抽屉打开时，先说一句「你离开多久了」——这是连续性最自然的位置
  function paintLedgerNote() {
    var slot = document.getElementById('ledger-note');
    if (!slot) return;
    var j = MI.journey.state();
    if (j.phase === 'returned' && j.daysSince !== null) {
      slot.textContent = '你离开了 ' + j.daysSince + ' 天。这段时间里，它没有替你继续，' +
        '也没有忘记你停在哪里。';
      slot.hidden = false;
    } else {
      slot.hidden = true;
      slot.textContent = '';
    }
  }

  function labelOf(section) {
    var map = { '/': '入口', '/lab': '实验室', '/route': '路线详情', '/fear': '恐惧模型', '/archive': '档案记忆', '/stress': '压力画像', '/settings': '设置', '/about': '应用介绍' };
    return map[section] || '这里';
  }

  function trapTab(e) {
    var overlay = d.$$('.overlay').filter(function (o) { return !o.hidden; }).pop();
    if (!overlay) return;
    var items = d.$$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', overlay)
      .filter(function (el) { return !el.hidden && el.offsetParent !== null; });
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  // ── 键盘 ─────────────────────────────────────────────
  function bindKeyboard() {
    document.addEventListener('keydown', function (e) {
      var helpOpen = d.$$('.overlay').some(function (o) { return !o.hidden; });
      var tag = document.activeElement ? document.activeElement.tagName : '';
      var editing = tag === 'INPUT' || tag === 'TEXTAREA';

      if (e.key === 'Escape') {
        if (helpOpen) {
          // 关闭最上层遮罩
          var top = d.$$('.overlay').filter(function (o) { return !o.hidden; }).pop();
          if (top) closeOverlay(top.id);
          return;
        }
        var root = document.getElementById('view');
        if (root) MI.views.lab.closeNode(root);
        return;
      }

      if (e.key === 'Tab' && helpOpen) { trapTab(e); return; }

      if (e.key === '?' && !editing && !helpOpen) {
        e.preventDefault();
        openHelp();
        return;
      }

      // 数字键 1/2/3：在实验室里直接切路线
      if (!helpOpen && !editing && MI.router.current() === '/lab' && ['1', '2', '3'].indexOf(e.key) > -1) {
        var tab = document.querySelector('#route-tabs [data-route="' + (Number(e.key) - 1) + '"]');
        if (tab) { e.preventDefault(); tab.click(); }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !helpOpen && MI.router.current() === '/lab') {
        e.preventDefault();
        var root = document.getElementById('view');
        var form = root && root.querySelector('#composer');
        if (form) form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true }));
      }
    });
  }

  // ── 启动 ─────────────────────────────────────────────
  function boot() {
    MI.store.init();

    MI.router.define('/', MI.views.landing);
    MI.router.define('/lab', MI.views.lab);
    MI.router.define('/route/:index', MI.views.route);
    MI.router.define('/fear', MI.views.fear);
    MI.router.define('/archive', MI.views.me);
  MI.router.define('/stress', MI.views.stress);
    MI.router.define('/settings', MI.views.settings);
    MI.router.define('/about', MI.views.about);
    MI.router.define('/404', MI.views.notFound);

    // 全局导航：任何带 data-nav 的元素都能跳转
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-nav]');
      if (!btn) return;
      e.preventDefault();
      MI.router.go(btn.dataset.nav);
    });

    document.getElementById('help-button').addEventListener('click', openHelp);
    document.getElementById('footer-help').addEventListener('click', openHelp);
    document.getElementById('close-help').addEventListener('click', closeHelp);
    document.getElementById('start-exploring').addEventListener('click', function () {
      closeHelp();
      MI.router.go('/lab');
    });
    document.getElementById('help-overlay').addEventListener('click', function (e) {
      if (e.target === this) closeHelp();
    });

    MI.router.onChange(function (path) {
      syncNav(path);
      syncCounts();
    });

    MI.store.subscribe(syncCounts);
    bindKeyboard();
    // 软键盘顶起时收起底部两条常驻元素。放在 bindKeyboard 之后：
    // 键盘相关的事项集中在一起，读代码时不必来回跳。
    if (MI.viewport) MI.viewport.mount();
    MI.echo.mount();

    // 先记下上一次来访，再覆盖。顺序不能反——回访叙事要拿旧值做比较。
    var prevSeen = MI.store.get().meta.lastSeenAt;
    MI.app.__lastSeen = prevSeen;
    MI.store.update(function (st) { st.meta.lastSeenAt = new Date().toISOString(); });

    // 首次使用：延迟一拍再弹，避免和首屏入场动画抢注意力
    MI.router.start(document.getElementById('view'));
    syncCounts();

    // 首次进入但没有指定路径时，停在入口页
    if (!location.hash) location.hash = '#/';

    // 用 journey.isVirgin() 而不是 totalIdeas——后者只看书写，不看进度与档案。
    // 标志位写在 return 之外：否则有念头的用户永远不会置位，每次启动都重跑这个定时器。
    if (!MI.store.get().meta.seenGuide) {
      MI.store.update(function (st) { st.meta.seenGuide = true; });
      if (MI.journey.isVirgin()) {
        setTimeout(function () {
          if (MI.journey.isVirgin()) openHelp();
        }, 900);
      }
    }
  }

  MI.app = {
    boot: boot,
    openHelp: openHelp,
    closeHelp: closeHelp,
    openOverlay: openOverlay,
    closeOverlay: closeOverlay,
    announce: announce,
    syncCounts: syncCounts,
    paintLedgerNote: paintLedgerNote
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window.MI);
