window.MI = window.MI || {};
(function (MI) {
  'use strict';

  function state() { return MI.store.get(); }

  // ── 写入 ──────────────────────────────────────────────
  // 对某条路线的整体判断：这条路像我吗
  // 按「念头 + 路线」去重：同一个念头下的重复点击只留最后一次，
  // 但不同念头对同一条路线的判断会累积，这样偏好才有统计意义
  function rateRoute(route, verdict, idea) {
    var key = String(idea || '').slice(0, 60);
    MI.store.update(function (s) {
      s.feedback.routes = s.feedback.routes.filter(function (f) {
        return !(f.route === route && f.idea === key);
      });
      s.feedback.routes.push({
        route: route,
        verdict: verdict,
        idea: key,
        date: new Date().toISOString()
      });
    });
    afterFeedback();
  }

  // 对某个具体任务的难度反馈。
  // 与 rateRoute 一样带念头维度：同一念头下的重复点击只留最后一次，
  // 不同念头对同一天任务的感受互不覆盖——「写公开信的第一天太难」
  // 不该抹掉「约人聊天的第一天刚好」。
  function rateTask(route, day, level, idea) {
    var key = String(idea || '').slice(0, 60);
    MI.store.update(function (s) {
      s.feedback.tasks = s.feedback.tasks.filter(function (f) {
        return !((f.idea || '') === key && f.route === route && f.day === day);
      });
      s.feedback.tasks.push({
        route: route,
        day: day,
        level: level,
        idea: key,
        date: new Date().toISOString()
      });
    });
    afterFeedback();
  }

  function clear() {
    MI.store.update(function (s) {
      s.feedback.routes = [];
      s.feedback.tasks = [];
    });
    MI.evolution.recompute();
  }

  // 每次反馈之后立刻重算规则，让自进化是即时的
  function afterFeedback() {
    if (MI.evolution && MI.evolution.recompute) MI.evolution.recompute();
  }

  // ── 读取 ──────────────────────────────────────────────
  // 当前念头下对某条路线的判断
  function routeVerdict(route, idea) {
    var key = String(idea || '').slice(0, 60);
    var hit = state().feedback.routes.filter(function (f) {
      return f.route === route && f.idea === key;
    })[0];
    return hit ? hit.verdict : null;
  }

  // 当前念头下某天任务被标过的难度
  function taskLevel(route, day, idea) {
    var key = String(idea || '').slice(0, 60);
    var hit = state().feedback.tasks.filter(function (f) {
      return (f.idea || '') === key && f.route === route && f.day === day;
    })[0];
    return hit ? hit.level : null;
  }

  // 每条路线累计的「像我 / 不太像」次数
  function routeStats() {
    return [0, 1, 2].map(function (route) {
      var list = state().feedback.routes.filter(function (f) { return f.route === route; });
      return {
        route: route,
        name: MI.data.ROUTE_NAMES[route],
        like: list.filter(function (f) { return f.verdict === 'like'; }).length,
        unlike: list.filter(function (f) { return f.verdict === 'unlike'; }).length,
        unsure: list.filter(function (f) { return f.verdict === 'unsure'; }).length
      };
    });
  }

  function taskStats() {
    var list = state().feedback.tasks;
    return {
      hard: list.filter(function (f) { return f.level === 'hard'; }).length,
      ok: list.filter(function (f) { return f.level === 'ok'; }).length,
      easy: list.filter(function (f) { return f.level === 'easy'; }).length,
      total: list.length
    };
  }

  // 按时间倒序的反馈流水，供「记忆」页展示
  function log() {
    var s = state();
    var out = s.feedback.routes.map(function (f) {
      var label = (MI.data.FEEDBACK_VERDICTS.filter(function (v) { return v.key === f.verdict; })[0] || {}).label || f.verdict;
      return {
        type: 'route',
        date: f.date,
        text: '对「' + MI.data.ROUTE_NAMES[f.route] + '」的判断：' + label,
        detail: f.idea ? '当时的念头：' + f.idea : ''
      };
    }).concat(s.feedback.tasks.map(function (f) {
      var label = (MI.data.TASK_LEVELS.filter(function (v) { return v.key === f.level; })[0] || {}).label || f.level;
      return {
        type: 'task',
        date: f.date,
        text: '第 ' + (f.day + 1) + ' 天任务：' + label,
        detail: '来自「' + MI.data.ROUTE_NAMES[f.route] + '」' +
          (f.idea ? ' · 当时的念头：' + f.idea : '')
      };
    }));
    out.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    return out;
  }

  MI.feedback = {
    rateRoute: rateRoute,
    rateTask: rateTask,
    clear: clear,
    routeVerdict: routeVerdict,
    taskLevel: taskLevel,
    routeStats: routeStats,
    taskStats: taskStats,
    log: log
  };
})(window.MI);
