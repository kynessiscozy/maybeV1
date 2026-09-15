window.MI = window.MI || {};
(function (MI) {
  'use strict';

  var d = MI.dom;

  function state() { return MI.store.get(); }

  // ── 写入 ──────────────────────────────────────────────
  function recordIdea(idea, theme, courage, time) {
    MI.store.update(function (s) {
      s.observed.totalIdeas += 1;
      s.observed.themes[theme] = (s.observed.themes[theme] || 0) + 1;
      s.observed.courageSum += courage;
      s.observed.courageCount += 1;
      s.observed.timeCount[time] = (s.observed.timeCount[time] || 0) + 1;
      s.observed.history.push({
        idea: idea.slice(0, 120),
        theme: theme,
        courage: courage,
        time: time,
        date: new Date().toISOString()
      });
    });
  }

  function setProfile(patch) {
    MI.store.update(function (s) {
      if (typeof patch.name === 'string') s.profile.name = patch.name.slice(0, 20);
      if (Array.isArray(patch.cares)) {
        s.profile.cares = patch.cares
          .map(function (t) { return String(t).trim().slice(0, 16); })
          .filter(Boolean).slice(0, 6);
      }
      s.profile.updatedAt = new Date().toISOString();
    });
  }

  function forgetHistory(index) {
    MI.store.update(function (s) {
      s.observed.history.splice(index, 1);
    });
  }

  // ── 读取 ──────────────────────────────────────────────
  function themeRanking() {
    var themes = state().observed.themes;
    var total = Object.keys(themes).reduce(function (n, k) { return n + themes[k]; }, 0);
    return Object.keys(MI.data.THEMES).map(function (key) {
      var count = themes[key] || 0;
      return {
        key: key,
        label: MI.data.THEMES[key].label,
        count: count,
        share: total ? count / total : 0
      };
    }).filter(function (t) { return t.count > 0; })
      .sort(function (a, b) { return b.count - a.count; });
  }

  function topTheme() {
    var rank = themeRanking();
    return rank.length ? rank[0] : null;
  }

  function preferredDefaults() {
    var o = state().observed;
    var courage = o.courageCount ? Math.round(o.courageSum / o.courageCount) : null;
    var time = null;
    var best = -1;
    Object.keys(o.timeCount).forEach(function (k) {
      if (o.timeCount[k] > best) { best = o.timeCount[k]; time = Number(k); }
    });
    return { courage: courage, time: time };
  }

  function history(limit) {
    var list = state().observed.history.slice();
    list.reverse();
    return typeof limit === 'number' ? list.slice(0, limit) : list;
  }

  function lastIdea() {
    var list = state().observed.history;
    return list.length ? list[list.length - 1] : null;
  }

  function isEmpty() {
    var s = state();
    return !s.profile.name && !s.profile.cares.length &&
      s.observed.totalIdeas === 0 && s.feedback.routes.length === 0 && s.feedback.tasks.length === 0;
  }

  function count() {
    var s = state();
    var n = 0;
    if (s.profile.name) n += 1;
    n += s.profile.cares.length;
    n += s.observed.history.length;
    n += s.feedback.routes.length + s.feedback.tasks.length;
    if (s.evolution.log.length) n += 1;
    return n;
  }

  // 供界面展示的「记得的事」清单
  function facts() {
    var s = state();
    var out = [];
    if (s.profile.name) {
      out.push({ kind: 'name', label: '你希望被称为', value: s.profile.name });
    }
    s.profile.cares.forEach(function (c, i) {
      out.push({ kind: 'care', index: i, label: '你在意的事', value: c });
    });
    var top = topTheme();
    if (top) {
      out.push({ kind: 'theme', label: '最常出现的主题', value: top.label + '（' + top.count + ' 次）' });
    }
    var def = preferredDefaults();
    if (def.courage !== null) {
      out.push({ kind: 'courage', label: '惯用的胆量', value: def.courage + '%' });
    }
    if (def.time !== null) {
      out.push({ kind: 'time', label: '常用的时长', value: def.time + ' 分钟 / 天' });
    }
    if (s.observed.totalIdeas) {
      out.push({ kind: 'count', label: '写下的念头', value: s.observed.totalIdeas + ' 个' });
    }
    if (s.evolution.revision > 1) {
      out.push({ kind: 'revision', label: '规则已自我调整', value: '第 ' + s.evolution.revision + ' 版' });
    }
    return out;
  }

  // 记忆摘要：同时用于界面展示与模型提示词注入
  function summary() {
    var s = state();
    var lines = [];
    if (s.profile.name) lines.push('希望被称为「' + s.profile.name + '」。');
    if (s.profile.cares.length) lines.push('在意的几件事：' + s.profile.cares.join('、') + '。');
    var rank = themeRanking();
    if (rank.length) {
      lines.push('写过的念头集中在：' + rank.slice(0, 3).map(function (t) {
        return t.label + '（' + t.count + ' 次）';
      }).join('、') + '。');
    }
    var def = preferredDefaults();
    if (def.courage !== null) lines.push('习惯的偏离惯性程度约 ' + def.courage + '%。');
    if (def.time !== null) lines.push('通常每天能借出 ' + def.time + ' 分钟。');
    if (s.observed.totalIdeas) lines.push('累计写下 ' + s.observed.totalIdeas + ' 个念头。');

    var liked = s.feedback.routes.filter(function (f) { return f.verdict === 'like'; });
    var unliked = s.feedback.routes.filter(function (f) { return f.verdict === 'unlike'; });
    if (liked.length) {
      lines.push('觉得「像我」的路线：' + uniq(liked.map(function (f) {
        return MI.data.ROUTE_NAMES[f.route];
      })).join('、') + '。');
    }
    if (unliked.length) {
      lines.push('觉得「不太像」的路线：' + uniq(unliked.map(function (f) {
        return MI.data.ROUTE_NAMES[f.route];
      })).join('、') + '。');
    }
    var hard = s.feedback.tasks.filter(function (f) { return f.level === 'hard'; }).length;
    var easy = s.feedback.tasks.filter(function (f) { return f.level === 'easy'; }).length;
    if (hard || easy) {
      lines.push('任务难度反馈：偏难 ' + hard + ' 次，偏简单 ' + easy + ' 次。');
    }
    return lines;
  }

  function uniq(list) {
    return list.filter(function (v, i) { return list.indexOf(v) === i; });
  }

  MI.memory = {
    recordIdea: recordIdea,
    setProfile: setProfile,
    forgetHistory: forgetHistory,
    themeRanking: themeRanking,
    topTheme: topTheme,
    preferredDefaults: preferredDefaults,
    history: history,
    lastIdea: lastIdea,
    isEmpty: isEmpty,
    count: count,
    facts: facts,
    summary: summary
  };
})(window.MI);
