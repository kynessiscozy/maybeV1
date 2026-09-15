window.MI = window.MI || {};
(function (MI) {
  'use strict';

  // 本地规则引擎：关键词匹配主题 → 套用策划好的行动模板
  // 不是大模型，也不做成功预测。evolution 会调整任务规模与默认路线。

  function scoreTheme(idea, theme) {
    var text = String(idea).toLowerCase();
    return theme.keywords.reduce(function (sum, k) {
      return sum + (text.indexOf(k.toLowerCase()) > -1 ? k.length : 0);
    }, 0);
  }

  // 主题决定用哪一套行动模板。默认按关键词猜；
  // 如果用户是从预设动机进来的，就直接用那套模板，
  // 否则会出现「选了『想找回自己的节奏』却拿到开店模板」这种明显错配。
  function themeFor(idea, motiveKey) {
    var pinned = motiveKey && MI.data.motive(motiveKey);
    if (pinned && MI.data.THEMES[pinned.theme]) return MI.data.THEMES[pinned.theme];

    var best = MI.data.THEMES.general;
    var bestScore = 0;
    Object.keys(MI.data.THEMES).forEach(function (key) {
      var theme = MI.data.THEMES[key];
      var score = scoreTheme(idea, theme);
      if (score > bestScore) { bestScore = score; best = theme; }
    });
    return best;
  }

  // 时间决定任务规模，自进化的 scale 在此基础上再调整
  function variables(time, courage) {
    var base = { 15: { n: 1, words: 80 }, 45: { n: 3, words: 250 }, 90: { n: 5, words: 500 } }[time] ||
      { n: 3, words: 250 };
    var scale = MI.evolution.scale();
    return {
      n: Math.max(1, Math.round(base.n * scale)),
      words: Math.max(40, Math.round(base.words * scale / 10) * 10),
      minutes: time,
      audience: courage < 34 ? '一位信任的人' : courage < 75 ? '两位合适的人' : '三位愿意参与的人'
    };
  }

  function fill(text, vars) {
    return text.replace(/\{(\w+)\}/g, function (m, k) {
      return vars[k] === undefined ? m : String(vars[k]);
    });
  }

  function hash(text) {
    var h = 0;
    for (var i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
    return h;
  }

  function buildDays(routeData, vars) {
    return routeData.days.map(function (t) { return fill(t, vars); });
  }

  // 生成完整方案
  function local(idea, courage, time, motiveKey) {
    var theme = themeFor(idea, motiveKey);
    var vars = variables(time, courage);
    var route = MI.evolution.suggestedRoute(courage);

    return {
      engine: 'local',
      idea: idea,
      courage: courage,
      time: time,
      motive: motiveKey || null,
      theme: theme.key,
      themeLabel: theme.label,
      themeIcon: theme.icon,
      route: route,
      routeReason: MI.evolution.routeReason(courage, route),
      fieldId: 'FIELD / ' + MI.dom.pad(hash(idea) % 999 + 1, 3),
      routes: theme.routes.map(function (r) {
        return {
          nodes: r.nodes.map(function (n) {
            return { title: n[0], code: n[1], advice: n[2] };
          }),
          description: r.description,
          days: buildDays(r, vars)
        };
      })
    };
  }

  // 把模型返回的内容套进同一套结构，保证界面不用区分来源
  function normalize(raw, idea, courage, time, motiveKey) {
    var fallback = local(idea, courage, time, motiveKey);
    if (!raw || !Array.isArray(raw.routes) || raw.routes.length !== 3) return fallback;

    var routes = raw.routes.map(function (r, i) {
      var base = fallback.routes[i];
      var nodes = Array.isArray(r.nodes) && r.nodes.length === 3 ? r.nodes.map(function (n, j) {
        return {
          title: String(n.title || base.nodes[j].title).slice(0, 24),
          code: String(n.code || base.nodes[j].code).slice(0, 20),
          advice: String(n.advice || base.nodes[j].advice).slice(0, 160)
        };
      }) : base.nodes;
      var days = Array.isArray(r.days) && r.days.length === 7 ? r.days.map(function (d) {
        return String(d).slice(0, 70);
      }) : base.days;
      return {
        nodes: nodes,
        description: String(r.description || base.description).slice(0, 200),
        days: days
      };
    });

    return {
      engine: 'ai',
      idea: idea,
      courage: courage,
      time: time,
      motive: motiveKey || null,
      theme: fallback.theme,
      themeLabel: String(raw.themeLabel || fallback.themeLabel).slice(0, 16),
      themeIcon: fallback.themeIcon,
      route: fallback.route,
      routeReason: fallback.routeReason,
      fieldId: fallback.fieldId,
      routes: routes
    };
  }

  MI.generate = {
    themeFor: themeFor,
    variables: variables,
    fill: fill,
    local: local,
    normalize: normalize
  };
})(window.MI);
