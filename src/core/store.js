window.MI = window.MI || {};
(function (MI) {
  'use strict';

  var KEY = 'maybe-institute-v2';
  var LEGACY_KEY = 'maybe-institute-v1';
  var MAX_HISTORY = 40;
  var MAX_SAVED = 100;
  var MAX_FEEDBACK = 200;
  var MAX_LEDGER = 40;

  function blank() {
    return {
      version: 2,
      session: { idea: '', courage: 65, time: 45, route: 1, done: [[], [], []], savedId: null, actor: null, motive: null },
      saved: [],
      profile: { name: '', cares: [], updatedAt: null },
      observed: { totalIdeas: 0, themes: {}, courageSum: 0, courageCount: 0, timeCount: {}, history: [] },
      feedback: { routes: [], tasks: [] },
      evolution: { scale: 1, routeBias: [0, 0, 0], log: [], revision: 1 },
      fear: {
        turns: [],
        stats: { hit: 0, rebut: 0, avoid: 0 },
        model: { pressure: 0.45, certainty: 0.55, focus: null, log: [], revision: 1 },
        distilled: null
      },
      stress: { last: null, history: [], draft: null },
      settings: { ai: { endpoint: '', model: '', key: '', enabled: false, lastTest: null } },
      // lastSeenAt：上一次打开的时刻，用来在回访时说出「你离开了几天」。
      // ledger：事务所日志，记录每一次有后果的操作。上限见 MAX_LEDGER。
      meta: { createdAt: new Date().toISOString(), storageOK: true, lastSeenAt: null, ledger: [] }
    };
  }

  function num(n, fallback) { return Number.isFinite(n) ? n : fallback; }

  // 从旧版单页格式迁移，保住用户已有的档案与进度
  function migrateLegacy(legacy) {
    var state = blank();
    if (legacy && legacy.current && typeof legacy.current.idea === 'string') {
      state.session.idea = legacy.current.idea.slice(0, 120);
      state.session.courage = MI.dom.clamp(num(legacy.current.courage, 65), 0, 100);
      state.session.time = [15, 45, 90].indexOf(legacy.current.time) > -1 ? legacy.current.time : 45;
      state.session.route = MI.dom.clamp(num(legacy.current.route, 1), 0, 2);
      state.session.done = sanitizeDone(legacy.current.done);
    }
    if (Array.isArray(legacy && legacy.saved)) {
      state.saved = legacy.saved.slice(-MAX_SAVED).filter(function (s) {
        return s && typeof s.idea === 'string' && s.idea.trim();
      }).map(function (s) {
        return {
          id: typeof s.id === 'string' ? s.id : MI.dom.uid(),
          date: typeof s.date === 'string' ? s.date : new Date().toISOString(),
          idea: s.idea.slice(0, 120),
          courage: MI.dom.clamp(num(s.courage, 65), 0, 100),
          time: [15, 45, 90].indexOf(s.time) > -1 ? s.time : 45,
          route: MI.dom.clamp(num(s.route, 1), 0, 2),
          done: sanitizeDone(s.done)
        };
      });
      state.meta.migratedFrom = 'v1';
    }
    return state;
  }

  function sanitizeDone(done) {
    return [0, 1, 2].map(function (i) {
      var list = Array.isArray(done && done[i]) ? done[i] : [];
      return Array.from(new Set(list.filter(function (n) {
        return Number.isInteger(n) && n >= 0 && n < 7;
      }))).sort(function (a, b) { return a - b; });
    });
  }

  function sanitize(raw) {
    var base = blank();
    if (!raw || typeof raw !== 'object') return base;
    var state = Object.assign(base, raw);
    state.session = Object.assign(base.session, raw.session || {});
    state.session.done = sanitizeDone(state.session.done);
    state.session.time = [15, 45, 90].indexOf(state.session.time) > -1 ? state.session.time : 45;
    state.session.route = MI.dom.clamp(num(state.session.route, 1), 0, 2);
    state.session.courage = MI.dom.clamp(num(state.session.courage, 65), 0, 100);
    state.session.idea = typeof state.session.idea === 'string' ? state.session.idea.slice(0, 120) : '';
    // 底色微调标记：橙/红区把默认胆量下调一档后置位，展开新念头时清除（见 lab.js）
    state.session.stressAdjusted = !!state.session.stressAdjusted;
    // 情境与动机：只接受在预设表里真实存在的 key，避免存档里留下无效值
    var actorKeys = MI.data.ACTORS.map(function (a) { return a.key; });
    var motiveKeys = MI.data.MOTIVES.map(function (m) { return m.key; });
    state.session.actor = actorKeys.indexOf(state.session.actor) > -1 ? state.session.actor : null;
    state.session.motive = motiveKeys.indexOf(state.session.motive) > -1 ? state.session.motive : null;
    // 存档只做白名单筛选，防止外部导入的数据带上无关字段，
    // 同时保住 actor / motive —— 少了它们，「继续这条路」会算出另一套方案。
    state.saved = Array.isArray(raw.saved) ? raw.saved.slice(-MAX_SAVED).filter(function (s) {
      return s && typeof s.idea === 'string' && s.idea.trim();
    }).map(function (s) {
      return {
        id: typeof s.id === 'string' ? s.id : MI.dom.uid(),
        date: typeof s.date === 'string' ? s.date : new Date().toISOString(),
        idea: s.idea.slice(0, 120),
        courage: MI.dom.clamp(num(s.courage, 65), 0, 100),
        time: [15, 45, 90].indexOf(s.time) > -1 ? s.time : 45,
        route: MI.dom.clamp(num(s.route, 1), 0, 2),
        actor: MI.data.ACTORS.some(function (a) { return a.key === s.actor; }) ? s.actor : null,
        motive: MI.data.MOTIVES.some(function (m) { return m.key === s.motive; }) ? s.motive : null,
        done: sanitizeDone(s.done)
      };
    }) : [];
    state.profile = Object.assign(base.profile, raw.profile || {});
    state.profile.cares = Array.isArray(state.profile.cares) ? state.profile.cares.slice(0, 6) : [];
    state.observed = Object.assign(base.observed, raw.observed || {});
    state.observed.history = Array.isArray(state.observed.history) ? state.observed.history.slice(-MAX_HISTORY) : [];
    state.feedback = Object.assign(base.feedback, raw.feedback || {});
    state.feedback.routes = Array.isArray(state.feedback.routes) ? state.feedback.routes.slice(-MAX_FEEDBACK) : [];
    state.feedback.tasks = Array.isArray(state.feedback.tasks) ? state.feedback.tasks.slice(-MAX_FEEDBACK) : [];
    state.evolution = Object.assign(base.evolution, raw.evolution || {});
    state.evolution.routeBias = Array.isArray(state.evolution.routeBias) && state.evolution.routeBias.length === 3
      ? state.evolution.routeBias.map(function (n) { return num(n, 0); }) : [0, 0, 0];
    state.evolution.log = Array.isArray(state.evolution.log) ? state.evolution.log.slice(-40) : [];
    state.evolution.scale = num(state.evolution.scale, 1);
    state.fear = Object.assign(base.fear, raw.fear || {});
    state.fear.turns = Array.isArray(state.fear.turns) ? state.fear.turns.slice(-60) : [];
    state.fear.stats = Object.assign(base.fear.stats, (raw.fear && raw.fear.stats) || {});
    state.fear.model = Object.assign(base.fear.model, (raw.fear && raw.fear.model) || {});
    state.fear.model.log = Array.isArray(state.fear.model.log) ? state.fear.model.log.slice(-30) : [];
    state.stress = Object.assign(base.stress, raw.stress || {});
    state.stress.history = Array.isArray(state.stress.history)
      ? state.stress.history.filter(function (e) { return e && typeof e.at === 'string'; }).slice(-20)
      : [];
    if (state.stress.last && (!state.stress.last.result || typeof state.stress.last.cpsi !== 'number')) {
      state.stress.last = null;
    }
    // draft：未完成作答的草稿（answers + 停在第几页）。结构不对就丢，宁可让用户重答也不要渲染出坏页。
    state.stress.draft = (raw.stress && raw.stress.draft &&
      typeof raw.stress.draft.page === 'number' &&
      raw.stress.draft.answers && typeof raw.stress.draft.answers === 'object')
      ? raw.stress.draft : null;
    state.settings = Object.assign(base.settings, raw.settings || {});
    state.settings.ai = Object.assign(base.settings.ai, (raw.settings && raw.settings.ai) || {});
    // meta 的两个新字段必须强制转换：旧备份里没有 ledger，
    // 直接读 .length 会抛错，把一次正常的导入变成失败。
    state.meta = Object.assign(base.meta, raw.meta || {});
    if (typeof state.meta.lastSeenAt !== 'string') state.meta.lastSeenAt = null;
    state.meta.ledger = Array.isArray(state.meta.ledger)
      ? state.meta.ledger.filter(function (e) {
        return e && typeof e.title === 'string' && e.title.trim();
      }).slice(-MAX_LEDGER)
      : [];
    return state;
  }

  var listeners = [];
  var state = blank();
  var storageOK = true;

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) return sanitize(JSON.parse(raw));
      var legacyRaw = localStorage.getItem(LEGACY_KEY);
      if (legacyRaw) {
        var migrated = migrateLegacy(JSON.parse(legacyRaw));
        state = migrated;
        persist();
        return migrated;
      }
    } catch (e) {
      storageOK = false;
    }
    return blank();
  }

  function persist() {
    try {
      state.meta.storageOK = true;
      localStorage.setItem(KEY, JSON.stringify(state));
      storageOK = true;
    } catch (e) {
      storageOK = false;
      state.meta.storageOK = false;
    }
  }

  function emit() {
    listeners.forEach(function (fn) {
      try { fn(state); } catch (e) { /* 单个订阅者出错不影响其他 */ }
    });
  }

  function trimHistory() {
    if (state.observed.history.length > MAX_HISTORY) {
      state.observed.history = state.observed.history.slice(-MAX_HISTORY);
    }
  }

  MI.store = {
    KEY: KEY,
    LEGACY_KEY: LEGACY_KEY,

    init: function () { state = read(); return state; },
    get: function () { return state; },
    isStorageOK: function () { return storageOK; },

    // 修改并落盘：mutation 直接改 state，之后统一保存与广播
    update: function (mutation) {
      if (typeof mutation === 'function') mutation(state);
      trimHistory();
      persist();
      emit();
      return state;
    },

    subscribe: function (fn) { listeners.push(fn); },

    replaceAll: function (next) {
      state = sanitize(next);
      persist();
      emit();
      return state;
    },

    clearAll: function () {
      state = blank();
      persist();
      emit();
      return state;
    },

    // 追加一条日志。最新的在最前面，便于直接渲染。
    // 单独开放这个方法而不是让调用方自己 push，是为了让上限只有一处定义。
    appendLedger: function (entry) {
      if (!entry || !entry.title) return null;
      var item = {
        kind: String(entry.kind || 'misc'),
        title: String(entry.title).slice(0, 120),
        detail: entry.detail ? String(entry.detail).slice(0, 200) : '',
        date: new Date().toISOString()
      };
      state.meta.ledger.unshift(item);
      if (state.meta.ledger.length > MAX_LEDGER) {
        state.meta.ledger = state.meta.ledger.slice(0, MAX_LEDGER);
      }
      return item;
    },

    clearLedger: function () {
      state.meta.ledger = [];
      return state;
    },

    // 只清记忆与反馈，保留档案柜
    clearLearning: function () {
      var base = blank();
      state.profile = base.profile;
      state.observed = base.observed;
      state.feedback = base.feedback;
      state.evolution = base.evolution;
      persist();
      emit();
      return state;
    },

    exportJSON: function () { return JSON.stringify(state, null, 2); },

    importJSON: function (text) {
      var parsed = JSON.parse(text);
      return MI.store.replaceAll(parsed);
    }
  };
})(window.MI);
