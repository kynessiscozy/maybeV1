window.MI = window.MI || {};
(function (MI) {
  'use strict';
  MI.views = MI.views || {};

  var d = MI.dom;
  var NODE_ROWS = [[20, 16.5, 22.5], [50, 49.5, 52.2], [78.5, 81, 82.2]];
  var NODE_COLS = [32.5, 58.5, 83.5];
  var ROUTE_CLASS = ['green', 'orange', 'blue'];

  // 地图虚拟画布。尺寸随窗口自适应：
  // 画布略大于窗口，拖动才有意义；但必须保证九个节点一开始就在可视范围内，
  // 否则用户会以为「路线 C 不存在」。缩放由 layout() 按窗口尺寸计算。
  var CANVAS = { w: 1420, h: 560 };
  var BASE_CANVAS = { w: 1420, h: 560 };
  var PAD = 40;

  var busy = false;

  // 地图视图状态（不持久化，属于临时探索状态）
  var view = { x: 0, y: 0, dragging: false, moved: false, cursor: { r: 1, n: 1 } };

  // 依据窗口实际尺寸决定画布大小：保证内容完整可见，同时留出适度可拖余量
  function layout() {
    var frame = document.getElementById('field-frame');
    if (!frame) return;
    var w = frame.clientWidth || 0;
    var h = frame.clientHeight || 0;
    if (!w || !h) return;
    // 容器比基准画布小时，画布跟着收缩（节点位置按百分比换算，不会重叠）
    CANVAS.w = Math.max(760, Math.min(BASE_CANVAS.w, w + 120));
    CANVAS.h = Math.max(320, Math.min(BASE_CANVAS.h, h + 60));
    var world = document.getElementById('field-world');
    if (world) {
      world.style.width = CANVAS.w + 'px';
      world.style.height = CANVAS.h + 'px';
      var svg = world.querySelector('.field-lines');
      if (svg) svg.setAttribute('viewBox', '0 0 ' + CANVAS.w + ' ' + CANVAS.h);
      paintRoutePaths(world);
    }
  }

  // 路径与辅助线按当前画布尺寸重算，避免与节点错位
  function paintRoutePaths(world) {
    var W = CANVAS.w;
    var H = CANVAS.h;
    var x0 = PAD + 3;
    var x1 = W - PAD * 0.4;
    var yA = nodePos(0, 0).y;
    var yB = nodePos(1, 0).y;
    var yC = nodePos(2, 0).y;
    var mid = (x0 + x1) / 2;

    var d0 = 'M' + x0 + ' ' + yB + 'C' + (x0 + 140) + ' ' + yB + ' ' + (x0 + 138) + ' ' + yA +
      ' ' + mid + ' ' + yA + 'S' + (W - 250) + ' ' + yA + ' ' + x1 + ' ' + yA;
    var d1 = 'M' + x0 + ' ' + yB + 'C' + (x0 + 142) + ' ' + yB + ' ' + (x0 + 190) + ' ' + yB +
      ' ' + mid + ' ' + yB + 'S' + (W - 250) + ' ' + yB + ' ' + x1 + ' ' + yB;
    var d2 = 'M' + x0 + ' ' + yB + 'C' + (x0 + 136) + ' ' + yB + ' ' + (x0 + 128) + ' ' + yC +
      ' ' + mid + ' ' + yC + 'S' + (W - 250) + ' ' + yC + ' ' + x1 + ' ' + yC;

    var paths = world.querySelectorAll('.route-path');
    if (paths[0]) paths[0].setAttribute('d', d0);
    if (paths[1]) paths[1].setAttribute('d', d1);
    if (paths[2]) paths[2].setAttribute('d', d2);

    var guides = world.querySelectorAll('.field-guide');
    if (guides[0]) {
      guides[0].setAttribute('cx', String(W / 2));
      guides[0].setAttribute('cy', String(H / 2));
      guides[0].setAttribute('rx', String(W * 0.38));
      guides[0].setAttribute('ry', String(H * 0.4));
    }
    if (guides[1]) {
      guides[1].setAttribute('d', 'M' + (PAD + 4) + ' 22v' + (H - 44) +
        'M' + (PAD + 26) + ' ' + yB + 'h' + (W - PAD - 30));
    }
    // 起点标记跟随原点
    var originEl = world.querySelector('.origin');
    if (originEl) {
      originEl.style.left = (PAD * 1.12) + 'px';
      originEl.style.top = yB + 'px';
    }
    var dot = world.querySelector('svg > circle[fill="#df632e"]');
    var arrow = world.querySelector('svg > path[stroke="#df632e"]');
    if (dot) { dot.setAttribute('cx', String(PAD + 12)); dot.setAttribute('cy', String(yB)); }
    if (arrow) arrow.setAttribute('d', 'm' + (PAD - 16) + ' ' + (yB - 5) + ' 6 5-6 5');
  }

  function currentIdea() { return MI.store.get().session.idea; }
  function currentRoute() { return MI.store.get().session.route; }

  // ── 预设：情境 → 动机 → 念头 ─────────────────────────
  // 三级递进代替原来一排六个芯片。理由：六个抽象标签（「独立杂志」）
  // 对不知道要做什么的人没有帮助，反而会让人觉得「这些都不是我」。
  // 从处境开始问，用户才有东西可答。
  function renderPreset() {
    var s = MI.store.get().session;
    var actors = MI.data.ACTORS.map(function (a) {
      var on = s.actor === a.key;
      return '<button type="button" class="preset-card' + (on ? ' on' : '') +
        '" data-actor="' + a.key + '" aria-pressed="' + on + '">' +
        '<span class="preset-label">' + d.esc(a.label) + '</span>' +
        '<span class="preset-note">' + d.esc(a.note) + '</span>' +
        '</button>';
    }).join('');

    return '' +
      '<div class="preset" id="preset">' +
      '<div class="preset-step"><span class="preset-no">01</span>' +
      '<span class="preset-q">你现在更像哪一种？</span>' +
      '<span class="preset-skip">可以跳过，直接写</span></div>' +
      '<div class="preset-actors" id="preset-actors">' + actors + '</div>' +
      '<div class="preset-step" id="preset-step-2" hidden><span class="preset-no">02</span>' +
      '<span class="preset-q">这一阵最想要什么？</span></div>' +
      '<div class="preset-motives" id="preset-motives" hidden></div>' +
      '<div class="preset-step" id="preset-step-3" hidden><span class="preset-no">03</span>' +
      '<span class="preset-q" id="preset-q3">借一个念头</span>' +
      '<button type="button" class="text-btn" id="shuffle">换一批 <span aria-hidden="true">↗</span></button></div>' +
      '<div class="sample-chips" id="sample-chips" hidden></div>' +
      '<p class="preset-echo" id="preset-echo" hidden></p>' +
      '</div>';
  }

  // 按当前情境筛出说得通的动机并渲染
  function paintMotives(root) {
    var s = MI.store.get().session;
    var box = root.querySelector('#preset-motives');
    var step = root.querySelector('#preset-step-2');
    if (!s.actor) {
      box.hidden = true; step.hidden = true;
      root.querySelector('#preset-step-3').hidden = true;
      root.querySelector('#sample-chips').hidden = true;
      root.querySelector('#preset-echo').hidden = true;
      return;
    }
    var list = MI.data.motivesFor(s.actor);
    box.innerHTML = list.map(function (m) {
      var on = s.motive === m.key;
      return '<button type="button" class="preset-motive' + (on ? ' on' : '') +
        '" data-motive="' + m.key + '" aria-pressed="' + on + '" title="' + d.esc(m.note) + '">' +
        d.esc(m.label) + '</button>';
    }).join('');
    box.hidden = false;
    step.hidden = false;
    paintSeeds(root);
  }

  // 念头候选池的唯一来源。「渲染」与「换一批」都必须走这里，
  // 否则两边各拼一套逻辑，换一批就会跳出当前推荐范围。
  //
  // 优先级：用户已经打出来的字 > 他选的动机 > 他选的处境 > 通用样本。
  //
  // 打字排在最前面，是因为用户一旦开始写，就已经知道自己要什么了。
  // 这时候还端出「独立杂志 / 周日咖啡角」这种跨主题样本，等于没听见他说话。
  // 反过来说，输入框空着的时候猜他想要什么是没意义的，所以只在
  // 命中关键词时才走这一支（seedsMatching 命中不了就返回空数组）。
  //
  // 注意：这里读输入框的实时值，而不是 store.session.idea。
  // 如果读 store，每敲一个键都要先 update store，那会让回响/持久化
  // 在草稿阶段就过度工作；输入框是唯一的真实来源。
  function seedPool(root) {
    var s = MI.store.get().session;
    var ideaEl = root.querySelector('#idea');
    var typed = ideaEl ? String(ideaEl.value || '').trim() : String(s.idea || '').trim();
    var matched = MI.data.seedsMatching(typed, 3);
    if (matched.length) return { seeds: matched, source: 'typed' };

    var m = s.motive ? MI.data.motive(s.motive) : null;
    if (m) return { seeds: MI.data.seedsFor(m.seedSet), source: 'motive' };

    if (s.actor) {
      // 选了情境还没选动机：把这个处境下最可能的几类念头混在一起
      var mixed = MI.data.motivesFor(s.actor).slice(0, 3).reduce(function (acc, mm) {
        return acc.concat(MI.data.seedsFor(mm.seedSet).slice(0, 3));
      }, []);
      return { seeds: mixed, source: 'actor' };
    }
    return { seeds: MI.data.SEEDS, source: 'generic' };
  }

  // 按动机渲染念头芯片；未选动机时给一组跨主题的通用样本
  function paintSeeds(root) {
    var s = MI.store.get().session;
    var chips = root.querySelector('#sample-chips');
    var step3 = root.querySelector('#preset-step-3');
    var echo = root.querySelector('#preset-echo');
    var q = root.querySelector('#preset-q3');

    var pool = seedPool(root);
    var seeds = pool.seeds;
    var source = pool.source;

    // 同一批念头在「换一批」之前先避开刚给过的，别原样端回来。
    // 只在非通用来源下做：通用样本本来就是轮流展示，避让反而会卡住。
    if (source !== 'generic') {
      var shown = root._shownSeeds || [];
      seeds = seeds.slice().sort(function (a, b) {
        return (shown.indexOf(a.label) > -1 ? 1 : 0) - (shown.indexOf(b.label) > -1 ? 1 : 0);
      });
    }

    // 排过序之后再截断，保证屏幕上只有三条。不截断的话，
    // 选了动机的情形会一次性铺出八条，把按钮挤到屏幕外。
    var finalSeeds = seeds.slice(0, 3);
    root._shownSeeds = finalSeeds.map(function (x) { return x.label; });

    chips.innerHTML = finalSeeds.map(function (seed) {
      return '<button type="button" class="sample-chip" data-idea="' + d.esc(seed.idea) +
        '">' + d.esc(seed.label) + '</button>';
    }).join('');
    chips.hidden = false;
    chips.dataset.offset = '0';
    step3.hidden = false;

    // 说清楚这三条是从哪来的。用户打了字却看到一组无关建议时，
    // 得能看出「它没听懂」而不是「它在乱推荐」。
    if (q) q.textContent = source === 'typed' ? '顺着你写的，找了几条' : '借一个念头';

    // 让用户看见「选了预设到底改变了什么」，否则预设只是换了个说法
    var m = s.motive ? MI.data.motive(s.motive) : null;
    if (m) {
      echo.innerHTML = '<strong>' + d.esc(m.label) + '</strong> · ' + d.esc(m.note) +
        ' · 已为你把胆量定在 ' + m.courage + '%、每天 ' + m.time + ' 分钟，可以随时改。';
      echo.hidden = false;
    } else {
      echo.hidden = true;
    }
  }

  // ── 渲染 ────────────────────────────────────────────
  function renderComposer() {
    var s = MI.store.get().session;

    return '' +
      '<form class="composer" id="composer" novalidate>' +
      '<div class="lab-hint" id="lab-hint" hidden>' +
      '<div class="lab-hint-main"><b>第一次来？三步就够了。</b>' +
      '<span>① 写下一个总在回避的念头 → ② 调好胆量与时间，点「展开我的可能性」（Ctrl / ⌘ + Enter）→ ③ 选一条路，走完第一天。' +
      '地图可以先不管，它只是另一种看路的方式。</span></div>' +
      '<button type="button" class="lab-hint-x" id="lab-hint-close" aria-label="关闭引导">知道了</button>' +
      '</div>' +
      '<div class="label-row"><label for="idea">如果，我想……</label><span class="tiny-code">THE SEED</span></div>' +
      '<div class="idea-wrap">' +
      '<textarea id="idea" maxlength="120" aria-describedby="idea-hint" placeholder="如果不用先证明自己，我最想试试什么？">' + d.esc(s.idea) + '</textarea>' +
      '<span class="char-count" id="char-count">0 / 120</span>' +
      '</div>' +
      renderPreset() +
      '<div class="range-control">' +
      '<div class="control-label"><label for="courage">偏离惯性的程度</label><output id="courage-value" for="courage">' + s.courage + '%</output></div>' +
      '<input id="courage" type="range" min="0" max="100" value="' + s.courage + '" step="1">' +
      '<div class="range-captions"><span>轻轻试探</span><span>大胆一点</span></div>' +
      '</div>' +
      '<div class="stress-hint" id="stress-hint" hidden></div>' +
      '<div class="time-control">' +
      '<div class="time-label" id="time-label">每天能借给自己</div>' +
      '<div class="time-switch" role="group" aria-labelledby="time-label">' +
      MI.data.TIME_PRESETS.map(function (t) {
        var on = t === s.time;
        return '<button type="button" data-time="' + t + '" aria-pressed="' + on + '"' +
          (on ? ' class="active"' : '') + '>' + t + ' 分钟</button>';
      }).join('') +
      '</div></div>' +
      '<button class="generate" type="submit" id="generate-btn">' +
      '<span id="generate-label">展开我的可能性</span>' +
      '<span class="key">Ctrl ↵</span>' +
      '<svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">' +
      '<path d="M3 10h13m-5-5 5 5-5 5" stroke="currentColor" stroke-width="1.5"/></svg>' +
      '</button>' +
      '<p class="privacy">' +
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="4" y="7" width="8" height="6" rx="1.2" stroke="currentColor"/><path d="M6 7V5a2 2 0 0 1 4 0v2" stroke="currentColor"/></svg>' +
      '<span id="privacy-text">念头只留在此浏览器，不上传</span></p>' +
      '</form>';
  }

  function renderMapShell() {
    return '' +
      '<div class="map-card' + (MI.motion.reduced ? ' no-motion' : '') + '">' +
      '<div class="map-header">' +
      '<div><div class="map-overline"><span aria-hidden="true">⌖</span> POSSIBILITY FIELD</div>' +
      '<h2 class="map-title" id="map-title">一颗念头，三种生长方式。</h2></div>' +
      '<div class="map-tools">' +
      '<span class="small-label" id="pannable-hint">可拖动 · 方向键移动</span>' +
      '<span class="small-label" id="field-id">FIELD / 001</span>' +
      '<button class="icon-btn" id="map-help" aria-label="如何探索分岔图" title="如何探索分岔图">' +
      '<svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="6.5" stroke="currentColor"/><path d="M10 9v5" stroke="currentColor"/><circle cx="10" cy="6.4" r=".7" fill="currentColor"/></svg>' +
      '</button></div></div>' +
      '<div class="map-banner" id="map-banner" hidden></div>' +

      // 可视窗口：overflow 裁切 + 承载指针事件
      '<div class="field-frame" id="field-frame">' +
      '<div class="field" id="field" tabindex="0" role="application" ' +
      'aria-label="可能性分岔图。使用方向键在九个节点间移动，回车查看建议。">' +

      // 世界层：唯一被 translate 的元素
      '<div class="field-world" id="field-world">' +
      '<svg class="field-lines" viewBox="0 0 1420 560" preserveAspectRatio="none" aria-hidden="true">' +
      '<ellipse class="field-guide" cx="710" cy="280" rx="540" ry="224" stroke-dasharray="2 7"/>' +
      '<path class="field-guide" d="M44 22v516M66 280h1350" stroke-dasharray="2 7"/>' +
      '<path class="route-path" data-path="0" d="M0 0"/>' +
      '<path class="route-path" data-path="1" d="M0 0"/>' +
      '<path class="route-path" data-path="2" d="M0 0"/>' +
      '<circle cx="52" cy="280" r="3" fill="#df632e"/>' +
      '<path d="m24 275 6 5-6 5" stroke="#df632e" fill="none" stroke-width="1.1"/>' +
      '</svg>' +
      '<div class="origin"><div class="origin-circle">如果</div>' +
      '<div class="origin-label">此刻的你<small>YOU ARE HERE</small></div></div>' +
      '<div class="route-label" style="top:5%">' + d.esc(MI.data.ROUTE_LABELS[0]) + '</div>' +
      '<div class="route-label" style="top:38%">' + d.esc(MI.data.ROUTE_LABELS[1]) + '</div>' +
      '<div class="route-label" style="top:70%">' + d.esc(MI.data.ROUTE_LABELS[2]) + '</div>' +
      '<div id="nodes"></div>' +
      '<div class="map-stamp">NOT A PREDICTION.<br>AN INVITATION.</div>' +
      '<div class="field-footnote">每一个节点，都可以是新的开始 +</div>' +
      '</div>' +

      // 悬停预读浮层：属于窗口层，不随世界层缩放模糊
      '<div class="node-peek" id="node-peek" hidden aria-hidden="true"></div>' +
      '</div>' +

      '<div class="pan-controls" id="pan-controls" role="group" aria-label="地图平移">' +
      '<button data-pan="up" aria-label="向上移动地图">↑</button>' +
      '<button data-pan="left" aria-label="向左移动地图">←</button>' +
      '<button data-pan="reset" aria-label="回到起点">⌖</button>' +
      '<button data-pan="right" aria-label="向右移动地图">→</button>' +
      '<button data-pan="down" aria-label="向下移动地图">↓</button>' +
      '</div>' +
      '<div class="pan-readout" id="pan-readout" aria-hidden="true"></div>' +
      '</div>' +

      '<div class="map-bottom">' +
      '<div class="route-tabs" id="route-tabs" role="group" aria-label="选择探索路线"></div>' +
      '<span class="map-caption">点一个节点，看看它如何发生 ↗</span>' +
      '</div></div>';
  }

  function render() {
    return '' +
      '<section class="page">' +
      '<div class="page-head">' +
      '<div>' +
      '<div class="eyebrow">STEP 01 &nbsp;/&nbsp; 给可能性一个入口</div>' +
      '<h1 class="page-title">如果，我想……</h1>' +
      '<p class="page-desc">写下一个真念头，它会展开成三条不同强度的路。</p>' +
      '</div>' +
      '</div>' +
      '<div class="workspace">' + renderComposer() + renderMapShell() + '</div>' +
      '<div class="node-detail" id="node-detail" hidden aria-live="polite">' +
      '<div><strong id="node-detail-title"></strong><p id="node-detail-text"></p></div>' +
      '<button id="node-close" aria-label="关闭节点详情">×</button>' +
      '</div>' +
      '<div class="section-bar" style="margin-top:26px">' +
      '<div class="section-title"><span class="section-number">02</span>从想象，到今天</div>' +
      '<button class="btn btn-ghost" id="open-route">查看这条路的七天安排' +
      '<svg viewBox="0 0 20 20" fill="none"><path d="M3 10h13m-5-5 5 5-5 5" stroke="currentColor" stroke-width="1.5"/></svg>' +
      '</button>' +
      '</div>' +
      '</section>';
  }

  // 节点坐标由「百分比」改为虚拟画布像素，配合可拖拽的世界层。
  // 纵向留出节点自身高度的一半，保证最上一排与最下一排都不出框。
  function nodePos(ri, ni) {
    var half = 44;
    var usableH = Math.max(120, CANVAS.h - half * 2);
    return {
      x: PAD + 36 + NODE_COLS[ni] / 100 * (CANVAS.w - PAD * 2 - 72),
      y: half + NODE_ROWS[ri][ni] / 100 * usableH
    };
  }

  function paintNodes(root, opts) {
    opts = opts || {};
    var plan = MI.session.ensure();
    var route = currentRoute();
    var theme = MI.data.THEMES[plan.theme] || MI.data.THEMES.general;
    var host = root.querySelector('#nodes');
    if (!host) return;

    host.innerHTML = plan.routes.map(function (r, ri) {
      return r.nodes.map(function (n, ni) {
        var pos = nodePos(ri, ni);
        return '<button class="node route-' + ROUTE_CLASS[ri] + (ri === route ? ' active' : '') +
          '" data-node="' + ri + '-' + ni + '" data-row="' + ri + '" data-col="' + ni + '"' +
          ' style="left:' + pos.x.toFixed(1) + 'px;top:' + pos.y.toFixed(1) + 'px"' +
          ' aria-label="路线' + MI.data.ROUTE_LETTERS[ri] + '，' + d.esc(n.title) + '，查看建议"' +
          ' title="' + d.esc(n.advice) + '">' +
          '<span class="node-meta"><span>' + MI.data.ROUTE_LETTERS[ri] + (ni + 1) + ' / ' + MI.data.NODE_STAGES[ni] + '</span>' +
          MI.data.icon(ni === 0 ? theme.icon : ni === 1 ? 'people' : 'flag') + '</span>' +
          '<span class="node-title">' + d.esc(n.title) + '</span>' +
          '<span class="node-sub">' + d.esc(n.code) + '</span>' +
          '</button>';
      }).join('');
    }).join('');

    root.querySelectorAll('[data-path]').forEach(function (p) {
      p.classList.toggle('selected', Number(p.dataset.path) === route);
    });

    // 生成时的「铺开」编排：按 SEED → EXPLORE → MAYBE 三列错峰出现
    if (opts.entrance) {
      var nodes = d.$$('.node', host);
      var ordered = nodes.slice().sort(function (a, b) {
        return Number(a.dataset.col) - Number(b.dataset.col);
      });
      ordered.forEach(function (el) { el.classList.remove('keep'); });
      MI.motion.inView(ordered, { step: 62, cap: 400 });
    } else {
      d.$$('.node', host).forEach(function (el) { el.classList.add('keep'); });
    }

    // 节点被重建，悬停监听也要重新绑定
    bindNodeHover(root);
    paintCursor(root);
  }

  // 逐个节点绑定悬停预读（mouseenter 不冒泡，必须直接绑）
  function bindNodeHover(root) {
    d.$$('.node', root).forEach(function (el) {
      el.addEventListener('mouseenter', function () {
        if (view.dragging) return;
        var parts = el.dataset.node.split('-').map(Number);
        showPeek(root, parts[0], parts[1]);
      });
      el.addEventListener('mouseleave', function () { hidePeek(root); });
    });
  }

  // ── 地图视图：平移与光标 ─────────────────────────────
  function clampView(root) {
    var frame = root.querySelector('#field-frame');
    if (!frame) return;
    var overX = Math.max(0, CANVAS.w - frame.clientWidth);
    var overY = Math.max(0, CANVAS.h - frame.clientHeight);
    view.x = d.clamp(view.x, -overX, 0);
    view.y = d.clamp(view.y, -overY, 0);
  }

  function paintView(root) {
    clampView(root);
    var world = root.querySelector('#field-world');
    if (world) {
      world.style.transform = 'translate3d(' + Math.round(view.x) + 'px,' +
        Math.round(view.y) + 'px,0)';
    }
    // 缩略读数：告诉用户自己在地图的哪个位置
    var frame = root.querySelector('#field-frame');
    var readout = root.querySelector('#pan-readout');
    if (frame && readout) {
      var ox = Math.max(0, CANVAS.w - frame.clientWidth);
      var oy = Math.max(0, CANVAS.h - frame.clientHeight);
      if (!ox && !oy) { readout.textContent = ''; return; }
      var px = ox ? Math.round(-view.x / ox * 100) : 0;
      var py = oy ? Math.round(-view.y / oy * 100) : 0;
      readout.textContent = '视野 ' + px + '% · ' + py + '%';
    }
  }

  // 把某个节点滚动到视野内（键盘导航时用）
  function ensureVisible(root, ri, ni) {
    var frame = root.querySelector('#field-frame');
    if (!frame) return;
    var pos = nodePos(ri, ni);
    var margin = 90;
    var w = frame.clientWidth;
    var h = frame.clientHeight;
    if (pos.x + view.x < margin) view.x = margin - pos.x;
    if (pos.x + view.x > w - margin) view.x = w - margin - pos.x;
    if (pos.y + view.y < margin * 0.7) view.y = margin * 0.7 - pos.y;
    if (pos.y + view.y > h - margin * 0.7) view.y = h - margin * 0.7 - pos.y;
    paintView(root);
  }

  function paintCursor(root) {
    var host = root.querySelector('#nodes');
    if (!host) return;
    d.$$('.node', host).forEach(function (el) {
      el.classList.toggle('cursor', Number(el.dataset.row) === view.cursor.r &&
        Number(el.dataset.col) === view.cursor.n);
    });
  }

  // 方向键在 3×3 节点网格里移动
  function moveCursor(root, dr, dn) {
    var r = d.clamp(view.cursor.r + dr, 0, 2);
    var n = d.clamp(view.cursor.n + dn, 0, 2);
    if (r === view.cursor.r && n === view.cursor.n) return;
    view.cursor = { r: r, n: n };
    ensureVisible(root, r, n);
    paintCursor(root);
    var plan = MI.session.ensure();
    var node = plan.routes[r].nodes[n];
    showPeek(root, r, n, node);
  }

  // ── 悬停 / 焦点预读 ──────────────────────────────────
  function showPeek(root, ri, ni) {
    var peek = root.querySelector('#node-peek');
    if (!peek) return;
    var routes = MI.session.ensure().routes;
    var route = routes[ri];
    var n = route && route.nodes ? route.nodes[ni] : null;
    if (!n) return;
    peek.innerHTML =
      '<span class="peek-route">' + MI.data.ROUTE_LETTERS[ri] + ' · ' +
      d.esc(MI.data.ROUTE_NAMES[ri]) + ' / ' + MI.data.NODE_STAGES[ni] + '</span>' +
      '<strong>' + d.esc(n.title) + '</strong>' +
      '<span class="peek-advice">' + d.esc(d.truncate(n.advice, 74)) + '</span>' +
      '<span class="peek-hint">点击或按回车，查看完整建议</span>';
    peek.hidden = false;
    // 浮层跟随节点在窗口层内的位置
    var fw = root.querySelector('#field-world');
    if (fw) {
      var cr = fw.getBoundingClientRect();
      var nr = fw.querySelector('[data-node="' + ri + '-' + ni + '"]');
      if (nr) {
        var r2 = nr.getBoundingClientRect();
        peek.style.left = (r2.left - cr.left + r2.width / 2) + 'px';
        peek.style.top = (r2.top - cr.top) + 'px';
      }
    }
    var el = root.querySelector('[data-node="' + ri + '-' + ni + '"]');
    if (el) el.classList.add('peeking');
  }

  function hidePeek(root) {
    var peek = root.querySelector('#node-peek');
    if (peek) { peek.hidden = true; peek.innerHTML = ''; }
    d.$$('.node.peeking', root).forEach(function (el) { el.classList.remove('peeking'); });
  }

  function paintRouteTabs(root) {
    var route = currentRoute();
    var bias = MI.evolution.bias();
    root.querySelector('#route-tabs').innerHTML = MI.data.ROUTE_NAMES.map(function (name, i) {
      var down = bias[i] < 0;
      return '<button class="route-tab' + (i === route ? ' active' : '') + (down ? ' downweighted' : '') +
        '" data-route="' + i + '" aria-pressed="' + (i === route) + '"' +
        ' title="' + (down ? '因为你曾判断这条路不太像你，它不再被默认推荐' : '') + '">' +
        '<i aria-hidden="true"></i>' + d.esc(name) + '</button>';
    }).join('');
  }

  function paintHeader(root) {
    var plan = MI.session.ensure();
    root.querySelector('#map-title').textContent = plan.themeLabel + '，三种生长方式。';
    root.querySelector('#map-title').classList.remove('draft');
    root.querySelector('#field-id').textContent = plan.fieldId;

    var banner = root.querySelector('#map-banner');
    var reason = plan.routeReason;
    var parts = [];
    if (reason) parts.push('<strong>已按你的反馈调整：</strong>' + d.esc(reason));
    if (plan.engine === 'ai') parts.push('这一版由你在设置里接入的模型生成。');
    if (parts.length) {
      banner.innerHTML = parts.join(' ');
      banner.hidden = false;
    } else {
      banner.hidden = true;
    }
  }

  function paintEngineBadge(root) {
    var ai = MI.ai.isConfigured();
    var dot = document.getElementById('engine-dot');
    var label = document.getElementById('engine-label');
    if (dot) dot.classList.toggle('warn', ai);
    if (label) label.textContent = ai ? '模型接口已启用' : '本地规则';
    var privacy = root.querySelector('#privacy-text');
    if (privacy) {
      privacy.textContent = ai
        ? '启用模型后，念头会发送到你指定的服务'
        : (MI.store.isStorageOK() ? '念头只留在此浏览器，不上传' : '浏览器未允许保存，请及时导出');
    }
  }

  // 手机上地图画布比可视框宽，默认只露左边。生成后把当前选中的路线
  // 列移到视野中央，用户一进来就看得见三条路中间那条，而不是空白一角。
  function centerRoute(root, ri) {
    var frame = root.querySelector('#field-frame');
    if (!frame) return;
    // 桌面端画布与框同宽或更窄，不需要居中
    if (CANVAS.w <= frame.clientWidth + 4) return;
    var pos = nodePos(ri, 1); // 取该路线中间那个节点做锚点
    view.x = frame.clientWidth / 2 - pos.x;
    clampView(root);
  }

  function paintAll(root, opts) {
    layout();
    paintNodes(root, opts);
    paintRouteTabs(root);
    paintHeader(root);
    paintEngineBadge(root);
    centerRoute(root, currentRoute());
    paintView(root);
  }

  // ── 交互 ────────────────────────────────────────────
  function updateCount(root) {
    var el = root.querySelector('#idea');
    root.querySelector('#char-count').textContent = el.value.length + ' / 120';
  }

  // 预设改了胆量和时间之后，把两个控件的显示同步过来，
  // 否则读数还是旧值，用户会以为设置没生效。
  function syncControls(root, courage, time) {
    var range = root.querySelector('#courage');
    var out = root.querySelector('#courage-value');
    if (range) range.value = String(courage);
    if (out) out.textContent = courage + '%';

    root.querySelectorAll('.time-switch [data-time]').forEach(function (b) {
      var on = Number(b.dataset.time) === time;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }

  function markDraft(root) {
    var title = root.querySelector('#map-title');
    title.textContent = '新念头已就位，点击「展开」更新。';
    title.classList.add('draft');
  }

  function setBusy(root, isBusy, label) {
    busy = isBusy;
    var btn = root.querySelector('#generate-btn');
    if (!btn) return;
    btn.disabled = isBusy;
    root.querySelector('#generate-label').textContent = label || (isBusy ? '正在展开…' : '展开我的可能性');
  }

  function buildAIContext(plan) {
    var log = MI.feedback.log().slice(0, 6).map(function (l) { return l.text; });
    var log2 = MI.evolution.log().slice(0, 3).map(function (l) {
      return l.trigger + ' → ' + l.change;
    });
    return {
      idea: plan.idea,
      courage: plan.courage,
      time: plan.time,
      motive: plan.motive,
      themeLabel: plan.themeLabel,
      memory: MI.memory.summary(),
      feedback: log,
      adjustment: log2.join('；')
    };
  }

  function generate(root) {
    if (busy) return;
    var ideaEl = root.querySelector('#idea');
    var idea = ideaEl.value.trim();
    if (!idea) {
      d.toast('哪怕只有一个词，也先把它写下来。');
      ideaEl.focus();
      MI.motion.flash(ideaEl, 'attention', 900);
      return;
    }
    if (idea.length < 2) {
      d.toast('再多写一点点，让这个念头更具体。');
      ideaEl.focus();
      MI.motion.flash(ideaEl, 'attention', 900);
      return;
    }

    var courage = Number(root.querySelector('#courage').value);
    var time = Number(root.querySelector('.time-switch .active').dataset.time);
    var before = MI.store.get().session;
    var sameIdea = idea === before.idea;
    var motive = before.motive;

    var plan = MI.generate.local(idea, courage, time, motive);

    MI.store.update(function (s) {
      s.session.idea = idea;
      s.session.courage = courage;
      s.session.time = time;
      s.session.route = plan.route;
      // 展开一条新念头 = 底色微调完成一轮使命，下次进实验室重新评估
      s.session.stressAdjusted = false;
      if (!sameIdea) {
        s.session.done = [[], [], []];
        s.session.savedId = null;
      }
    });
    MI.session.set(plan);
    MI.memory.recordIdea(idea, plan.theme, courage, time);
    MI.views.lab.closeNode(root);
    resetView(root);
    paintAll(root, { entrance: true });
    highlightRouteSegment(root, plan.route);

    // 展开也要有回响。原本这一处只有一句 toast，
    // 而「我又回到同一个念头」这个最私人的时刻，拿到的反馈最弱。
    var total = MI.store.get().observed.totalIdeas;
    var top = MI.memory.topTheme();
    if (sameIdea) {
      MI.echo.push({
        kind: 'generate',
        surface: 'both',
        anchor: '#map-banner',
        title: '还在这里。',
        detail: '进度保留着。要换，改上面的胆量或时间，再展开一次。',
        delta: { journey: true }
      });
    } else if (total === 1) {
      MI.echo.push({
        kind: 'generate',
        surface: 'both',
        anchor: '#map-banner',
        title: '这是第一个。',
        detail: '它已经收进你的记录里。以后每次展开，事务所都会更知道你想去哪里。',
        delta: { journey: true }
      });
    } else {
      MI.echo.push({
        kind: 'generate',
        surface: 'both',
        anchor: '#map-banner',
        title: '已经展开。',
        detail: '这是你写下的第 ' + total + ' 个念头。' +
          (top ? '主题集中在「' + top.label + '」——三条路里有一条是从那里长出来的。' : ''),
        delta: { journey: true }
      });
    }

    if (!MI.ai.isConfigured()) {
      d.toast(sameIdea ? '你的可能性还在这里，进度也为你保留着。' : '三条可能性已经展开。选一条，不代表放弃另外两条。');
      return;
    }

    // 启用了模型：先给本地结果，再异步换成模型版本
    setBusy(root, true, '正在请模型展开…');
    var banner = root.querySelector('#map-banner');
    banner.innerHTML = '正在请求模型生成更贴身的版本，稍等片刻。本地版本已经可以先看。';
    banner.hidden = false;

    MI.ai.generate(buildAIContext(plan)).then(function (aiPlan) {
      MI.session.set(aiPlan);
      paintAll(root, { entrance: true });
      highlightRouteSegment(root, aiPlan.route);
      d.toast('模型版本已生成。觉得哪里不对，随时去「记忆」页调整。');
    }).catch(function (err) {
      paintAll(root);
      paintEngineBadge(root);
      d.toast('模型没能完成（' + err.message + '）。已保留本地规则的结果。', 5200);
    }).then(function () {
      setBusy(root, false);
      paintEngineBadge(root);
    });
  }

  // 选中路线的路径「画出来」：用 stroke-dashoffset 制造描线过程
  function highlightRouteSegment(root, route) {
    var path = root.querySelector('[data-path="' + route + '"]');
    if (!path || MI.motion.reduced) return;
    var len = 0;
    try { len = path.getTotalLength(); } catch (e) { len = 0; }
    if (!len) return;
    path.style.strokeDasharray = len + ' ' + len;
    path.style.strokeDashoffset = len;
    void path.offsetWidth;
    path.style.transition = 'stroke-dashoffset .62s ease';
    path.style.strokeDashoffset = '0';
    setTimeout(function () {
      path.style.strokeDasharray = '';
      path.style.strokeDashoffset = '';
      path.style.transition = '';
    }, 760);
  }

  // 拖动后视图复位
  function resetView(root) {
    view.x = 0;
    view.y = 0;
    paintView(root);
  }

  function openNode(root, route, node) {
    MI.store.update(function (s) { s.session.route = route; });
    var plan = MI.session.ensure();
    var n = plan.routes[route].nodes[node];
    view.cursor = { r: route, n: node };
    paintAll(root);
    var el = root.querySelector('[data-node="' + route + '-' + node + '"]');
    if (el) {
      el.classList.add('selected-node');
      MI.motion.pulse(el, 'pulse', 560);
    }
    root.querySelector('#node-detail-title').textContent =
      MI.data.ROUTE_LETTERS[route] + (node + 1) + ' / ' + n.title;
    root.querySelector('#node-detail-text').textContent = n.advice;
    var detail = root.querySelector('#node-detail');
    detail.hidden = false;
    MI.motion.flash(detail, 'in', 700);
    // 打开节点时同步刷新该路线的路径描线，让「选择」有连续性
    highlightRouteSegment(root, route);
  }

  function closeNode(root) {
    var panel = root.querySelector('#node-detail');
    if (panel) panel.hidden = true;
    root.querySelectorAll('.selected-node').forEach(function (n) { n.classList.remove('selected-node'); });
  }

  function mount(root) {
    var composer = root.querySelector('#composer');
    var ideaEl = root.querySelector('#idea');
    updateCount(root);
    view.cursor = { r: currentRoute(), n: 1 };
    // 恢复上次选的处境与动机：用户回来时不该从零重选一遍
    paintMotives(root);
    // 念头芯片一开始就铺出来：用户打字时直接替换内容，
    // 而不是先空着、等他输入了再突然出现。
    paintSeeds(root);

    // ── 处女态轻引导 ──
    // 实验室是全站概念最密的一页。第一次来的人不该先研究地图，
    // 只需要知道三步。有过念头之后 phase 不再是 empty，引导自然退场。
    (function () {
      var hint = root.querySelector('#lab-hint');
      if (!hint) return;
      var show = MI.journey.phase() === 'empty' && !MI.store.get().session.labHintDismissed;
      hint.hidden = !show;
      var xc = root.querySelector('#lab-hint-close');
      if (xc) xc.addEventListener('click', function () {
        hint.hidden = true;
        MI.store.update(function (s2) { s2.session.labHintDismissed = true; });
      });
    })();

    // ── 读底色：压力画像显示橙/红区时，默认胆量下调一档 ──
    // 轻手，不阻拦：只调默认值、说清原因，滑杆随时可以拖回去。
    // 一次会话只调一次（stressAdjusted 标记），展开新念头后重置，
    // 避免用户手动改回后每切一次页就被按下去一次。
    (function () {
      var snap = (MI.stress && MI.stress.snapshot) ? MI.stress.snapshot() : null;
      if (!snap || snap.levelIndex < 4) return;
      var st = MI.store.get();
      if (st.session.stressAdjusted) return;
      var cur = st.session.courage;
      var lower = cur >= 75 ? 50 : (cur >= 34 ? 20 : cur);
      if (lower === cur) return;
      MI.store.update(function (s2) {
        s2.session.courage = lower;
        s2.session.stressAdjusted = true;
      });
      syncControls(root, lower, st.session.time);
      var hint = root.querySelector('#stress-hint');
      if (hint) {
        hint.innerHTML = '<b>你的压力画像显示最近负荷偏高（' + d.esc(snap.level) + '）。</b>' +
          '已把「偏离惯性的程度」从 ' + cur + '% 调到 ' + lower + '%——不是退缩，是让开始更容易。' +
          '随时可以拖回去。';
        hint.hidden = false;
      }
      MI.echo.push({
        kind: 'stress', surface: 'ledger',
        title: '自由实验读了你的压力底色。',
        detail: '负荷偏高（' + snap.level + '），胆量默认值从 ' + cur + '% 下调到 ' + lower + '%。'
      });
    })();

    // 数字输入框：胆量滑块的读数用滚动过渡，避免生硬跳变
    var courageOut = root.querySelector('#courage-value');
    var courageLast = Number(root.querySelector('#courage').value);

    // 输入框打字时实时更新候选念头。
    // 用 120ms 防抖：既要跟得上速度，又不要每敲一个键都重排一次。
    var seedTimer = null;
    ideaEl.addEventListener('input', function () {
      updateCount(root);
      markDraft(root);
      if (seedTimer) clearTimeout(seedTimer);
      seedTimer = setTimeout(function () {
        seedTimer = null;
        paintSeeds(root);
      }, 120);
    });

    root.querySelector('#courage').addEventListener('input', function (e) {
      var v = Number(e.target.value);
      courageLast = v;
      courageOut.textContent = v + '%';
      // 滑块位置直接反映真实值，读数则短暂地「追上」它
      MI.motion.countUp(courageOut, v, { from: courageLast, suffix: '%', duration: 180 });
      markDraft(root);
    });

    composer.querySelector('.time-switch').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-time]');
      if (!btn) return;
      composer.querySelectorAll('[data-time]').forEach(function (b) {
        var on = b === btn;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      markDraft(root);
    });

    // ── 预设：情境 → 动机 → 念头 ──
    root.querySelector('#preset-actors').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-actor]');
      if (!btn) return;
      var key = btn.dataset.actor;
      var same = MI.store.get().session.actor === key;
      // 再点一次取消选择，回到自由书写
      MI.store.update(function (st) {
        st.session.actor = same ? null : key;
        st.session.motive = null;
      });
      root.querySelectorAll('#preset-actors [data-actor]').forEach(function (b) {
        var on = !same && b.dataset.actor === key;
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', String(on));
      });
      paintMotives(root);
      // 只记「放开」，不记「打开」：还没选动机，这一步没有结论可说
      if (same) {
        MI.echo.push({
          kind: 'preset', surface: 'ledger',
          title: '回到了自由书写。',
          detail: '处境已经放开。想到什么就写什么，也可以再挑一个。'
        });
      }
    });

    root.querySelector('#preset-motives').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-motive]');
      if (!btn) return;
      var m = MI.data.motive(btn.dataset.motive);
      var a = MI.data.actor(MI.store.get().session.actor);
      MI.store.update(function (st) {
        st.session.motive = m.key;
        // 动机自带推荐的胆量与时间：让预设真的改变输出，而不只是换一句文案
        st.session.courage = m.courage;
        st.session.time = m.time;
      });
      syncControls(root, m.courage, m.time);
      paintMotives(root);
      markDraft(root);
      // 这一步真的改了下游参数，值得留痕
      MI.echo.push({
        kind: 'preset', surface: 'ledger',
        title: '你选了「' + a.label + ' / ' + m.label + '」。',
        detail: '胆量定为 ' + m.courage + '%、每天 ' + m.time + ' 分钟。预设只是起点，随时可以改。'
      });
    });

    root.querySelector('#sample-chips').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-idea]');
      if (!btn) return;
      ideaEl.value = btn.dataset.idea;
      updateCount(root);
      markDraft(root);
      ideaEl.focus();
    });

    // 换一批：沿用与 paintSeeds 相同的候选池，只是往后挪三条。
    // 以前这里自己拼了一个 base（只看 motive），于是「按输入推荐」出来的
    // 三条一按换一批就跳回通用样本，看起来像推荐失效了。
    // 现在统一走 seedPool，保证换出来的还是同一来源的下一批。
    root.querySelector('#shuffle').addEventListener('click', function () {
      var pool = seedPool(root);
      if (!pool.length) return;
      var chips = root.querySelector('#sample-chips');
      var start = (Number(chips.dataset.offset || 0) + 3) % pool.length;
      chips.dataset.offset = String(start);
      var next = [];
      for (var i = 0; i < 3 && i < pool.length; i++) next.push(pool[(start + i) % pool.length]);
      chips.innerHTML = next.map(function (seed) {
        return '<button type="button" class="sample-chip" data-idea="' + d.esc(seed.idea) +
          '">' + d.esc(seed.label) + '</button>';
      }).join('');
      root._shownSeeds = next.map(function (x) { return x.label; });
    });

    composer.addEventListener('submit', function (e) {
      e.preventDefault();
      generate(root);
    });

    root.querySelector('#route-tabs').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-route]');
      if (!btn) return;
      var next = Number(btn.dataset.route);
      MI.store.update(function (s) { s.session.route = next; });
      view.cursor = { r: next, n: view.cursor.n };
      closeNode(root);
      paintAll(root);
      highlightRouteSegment(root, next);
      // 被降权的路线：在回执条里说明原因，让用户看到自己的判断起了作用
      var bias = MI.evolution.bias()[next];
      var item = MI.evolution.log()[0];
      if (bias !== 0 && item) {
        MI.echo.engineReceipt(root, '#map-banner', MI.receipt.routeReceipt(
          next,
          bias < 0 ? 'unlike' : 'like',
          MI.store.get().session.idea
        ));
      } else {
        paintHeader(root);
      }
    });

    root.querySelector('#nodes').addEventListener('click', function (e) {
      // 拖动结束时不应该触发点击
      if (view.moved) { view.moved = false; return; }
      var btn = e.target.closest('[data-node]');
      if (!btn) return;
      var parts = btn.dataset.node.split('-').map(Number);
      openNode(root, parts[0], parts[1]);
    });

    // ── 悬停预读 ──
    // 用非冒泡的 mouseenter/mouseleave 逐节点绑定：
    // 鼠标从窗口直接移入卡片时不会产生冒泡的 mouseover，委托会漏掉这一下。
    bindNodeHover(root);
    // 键盘用户：焦点落在节点上时同样预读
    root.querySelector('#nodes').addEventListener('focusin', function (e) {
      var btn = e.target.closest('[data-node]');
      if (!btn) return;
      var parts = btn.dataset.node.split('-').map(Number);
      showPeek(root, parts[0], parts[1]);
    });
    root.querySelector('#nodes').addEventListener('focusout', function () { hidePeek(root); });

    // ── 键盘导航：方向键 + 回车 ──
    root.querySelector('#field').addEventListener('keydown', function (e) {
      var map = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      if (map[e.key]) {
        e.preventDefault();
        moveCursor(root, map[e.key][0], map[e.key][1]);
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openNode(root, view.cursor.r, view.cursor.n);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        hidePeek(root);
        closeNode(root);
      }
    });
    root.querySelector('#field').addEventListener('blur', function () { hidePeek(root); });

    // ── 拖拽平移 ──
    bindPan(root);

    root.querySelector('#node-close').addEventListener('click', function () { closeNode(root); });
    root.querySelector('#map-help').addEventListener('click', function () { MI.app.openHelp(); });
    root.querySelector('#open-route').addEventListener('click', function () {
      MI.router.go('/route/' + MI.store.get().session.route);
    });

    paintAll(root, { entrance: true });
    window.addEventListener('resize', onResize);
  }

  var resizeTimer = null;
  function onResize() {
    var root = document.getElementById('view');
    if (!root || !root.querySelector('#field-frame')) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      layout();
      paintNodes(root);
      paintView(root);
    }, 130);
  }

  // 拖拽：窗口层捕获指针，世界层跟随位移
  function bindPan(root) {
    var frame = root.querySelector('#field-frame');
    var world = root.querySelector('#field-world');
    if (!frame || !world) return;

    var start = { x: 0, y: 0, vx: 0, vy: 0, id: null };

    frame.addEventListener('pointerdown', function (e) {
      // 节点卡片按点击处理；平移控件自带点击语义，都不进入拖拽，
      // 否则指针捕获会把它们的 click 吞掉。
      if (e.target.closest('.node') || e.target.closest('.pan-controls')) return;
      if (e.button !== undefined && e.button !== 0) return;
      start.x = e.clientX;
      start.y = e.clientY;
      start.vx = view.x;
      start.vy = view.y;
      start.id = e.pointerId;
      view.dragging = true;
      view.moved = false;
      frame.classList.add('dragging');
      try { frame.setPointerCapture(e.pointerId); } catch (err) { /* 老浏览器忽略 */ }
    });

    frame.addEventListener('pointermove', function (e) {
      if (!view.dragging || e.pointerId !== start.id) return;
      var dx = e.clientX - start.x;
      var dy = e.clientY - start.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) view.moved = true;
      view.x = start.vx + dx;
      view.y = start.vy + dy;
      clampView(root);
      world.style.transform = 'translate3d(' + Math.round(view.x) + 'px,' +
        Math.round(view.y) + 'px,0)';
      // 拖动时若指针滑到节点上方，收起预读浮层，避免遮挡
      if (view.moved) hidePeek(root);
    });

    function end(e) {
      if (!view.dragging) return;
      if (e && e.pointerId !== start.id) return;
      view.dragging = false;
      start.id = null;
      frame.classList.remove('dragging');
      paintView(root);
      try { frame.releasePointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
      // 拖过之后抑制一次 click，避免误开节点
      if (view.moved) setTimeout(function () { view.moved = false; }, 0);
    }

    frame.addEventListener('pointerup', end);
    frame.addEventListener('pointercancel', end);
    frame.addEventListener('mouseleave', function () { if (!view.dragging) hidePeek(root); });

    // 平移按钮
    var controls = root.querySelector('#pan-controls');
    if (controls) {
      controls.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-pan]');
        if (!btn) return;
        var stepPx = 150;
        var dir = btn.dataset.pan;
        if (dir === 'reset') { resetView(root); return; }
        if (dir === 'left') view.x += stepPx;
        if (dir === 'right') view.x -= stepPx;
        if (dir === 'up') view.y += stepPx;
        if (dir === 'down') view.y -= stepPx;
        paintView(root);
      });
    }

    // 滚轮横向/纵向滚动地图（桌面端更像「看图纸」）
    frame.addEventListener('wheel', function (e) {
      if (!e.shiftKey && Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      var frameW = frame.clientWidth;
      var over = CANVAS.w - frameW;
      if (over <= 0) return;
      e.preventDefault();
      view.x -= (e.shiftKey ? e.deltaY : e.deltaX) || e.deltaY;
      paintView(root);
    }, { passive: false });
  }

  MI.views.lab = {
    title: '自由实验',
    render: render,
    mount: mount,
    unmount: function () {
      window.removeEventListener('resize', onResize);
      clearTimeout(resizeTimer);
    },
    closeNode: closeNode,
    refresh: function () {
      var root = document.getElementById('view');
      if (root && root.querySelector('#composer')) paintAll(root);
    }
  };
})(window.MI);
