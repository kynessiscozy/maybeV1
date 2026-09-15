window.MI = window.MI || {};
(function (MI) {
  'use strict';

  var routes = [];
  var outlet = null;
  var active = null;
  var currentPath = null;

  function compile(pattern) {
    var keys = [];
    var regex = new RegExp('^' + pattern.replace(/:[A-Za-z0-9_]+/g, function (m) {
      keys.push(m.slice(1));
      return '([^/]+)';
    }).replace(/\//g, '\\/') + '$');
    return { regex: regex, keys: keys };
  }

  function define(pattern, view) {
    routes.push({ pattern: pattern, compiled: compile(pattern), view: view });
  }

  function match(path) {
    for (var i = 0; i < routes.length; i++) {
      var hit = routes[i].compiled.regex.exec(path);
      if (hit) {
        var params = {};
        routes[i].compiled.keys.forEach(function (k, idx) { params[k] = decodeURIComponent(hit[idx + 1]); });
        return { route: routes[i], params: params };
      }
    }
    return null;
  }

  function parseHash() {
    var raw = location.hash.replace(/^#/, '');
    // 首页已移除：空路径或根路径直接落到自由实验，不再渲染 landing。
    if (!raw || raw === '/') return '/lab';
    return raw.replace(/\/+$/, '') || '/lab';
  }

  // 视图转场：不做整页替换，而是复用同一个容器做一次入场动画。
  // 这样既保留「页面变了」的感知，又不会因为重建节点丢掉滚动位置与焦点。
  var TRANSITION_MS = 320;

  function playEnter(node) {
    if (!node) return;
    if (MI.motion && MI.motion.reduced) return;
    node.classList.remove('view-enter');
    // 读取布局，确保动画可重播
    void node.offsetWidth;
    node.classList.add('view-enter');
    clearTimeout(playEnter.timer);
    playEnter.timer = setTimeout(function () {
      node.classList.remove('view-enter');
    }, TRANSITION_MS);
  }

  function render() {
    if (!outlet) return;
    var path = parseHash();
    var found = match(path) || match('/404');
    if (!found) return;

    var view = found.route.view;
    var previousPath = currentPath;

    if (active && typeof active.view.unmount === 'function') {
      try { active.view.unmount(); } catch (e) { /* 忽略卸载异常 */ }
    }

    var ctx = { path: path, params: found.params, query: {}, previous: previousPath };
    var html;
    try {
      html = view.render(ctx);
    } catch (e) {
      html = '<section class="page"><h1 class="page-title">这一页没能展开</h1>' +
        '<p class="page-desc">渲染时出现了问题：' + MI.dom.esc(e && e.message) + '</p></section>';
    }

    outlet.innerHTML = html;
    active = { view: view, ctx: ctx };
    currentPath = path;

    document.title = (view.title ? view.title + ' · ' : '') + '未发生事务所';
    if (typeof view.mount === 'function') {
      try { view.mount(outlet, ctx); } catch (e) { /* 挂载异常不阻断导航 */ }
    }

    // 挂载之后再恢复折叠状态：视图可能自己会改写 open 属性
    restoreFolds();

    // 只有真的换页才播放转场；同一页内的重渲染（例如保存设置后）不闪
    if (previousPath !== path) playEnter(outlet.firstElementChild);

    // 锚点式滚动：换页回到顶部，同页重渲染保持不动
    if (previousPath !== path) window.scrollTo({ top: 0, behavior: 'auto' });

    // 让键盘与读屏用户知道页面已切换
    var heading = outlet.querySelector('h1');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      try { heading.focus({ preventScroll: true }); } catch (e) { /* 某些浏览器不支持参数 */ }
    }

    MI.router.notify(path);
  }

  var navListeners = [];

  // ── 折叠状态记忆 ──────────────────────────────────────
  // 这些页面里的操作（保存、删除、反馈）都会触发整页重渲染，
  // 若不记住展开状态，用户展开折叠块后一点操作它就会自己合上。
  // 用「页面路径 + 折叠块在页内的序号」做键，避免依赖 DOM id。
  var foldState = {};

  function foldKey() {
    return currentPath || '/lab';
  }

  function rememberFolds() {
    if (!outlet) return;
    var path = foldKey();
    foldState[path] = foldState[path] || {};
    MI.dom.$$('details.fold', outlet).forEach(function (el, i) {
      foldState[path][i] = el.open;
    });
  }

  function restoreFolds() {
    if (!outlet) return;
    var saved = foldState[foldKey()];
    if (!saved) return;
    MI.dom.$$('details.fold', outlet).forEach(function (el, i) {
      if (saved[i] !== undefined) el.open = saved[i];
    });
  }

  function bindFoldPersistence() {
    if (!outlet) return;
    outlet.addEventListener('toggle', function (e) {
      var el = e.target;
      if (!el || el.tagName !== 'DETAILS' || !el.classList.contains('fold')) return;
      rememberFolds();
    }, true);
  }

  function go(path) {
    var next = '#' + path;
    if (location.hash === next) { render(); return; }
    location.hash = next;
  }

  function start(node) {
    outlet = node;
    bindFoldPersistence();
    window.addEventListener('hashchange', render);
    render();
  }

  MI.router = {
    define: define,
    go: go,
    start: start,
    render: render,
    current: function () { return currentPath; },
    params: function () { return active ? active.ctx.params : {}; },
    // 导航变化（用于高亮当前菜单）
    onChange: function (fn) { navListeners.push(fn); },
    notify: function (path) { navListeners.forEach(function (fn) { fn(path); }); }
  };
})(window.MI);
