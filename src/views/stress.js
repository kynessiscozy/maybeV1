window.MI = window.MI || {};
(function (MI) {
  'use strict';
  MI.views = MI.views || {};

  var d = MI.dom;

  // ─────────────────────────────────────────────────────
  //  数据：12 分量表 × 6 题 + 效度题 + 高危题
  //  移植自 SPS 心理压力画像测评（演示版），计分常模为示例参数。
  // ─────────────────────────────────────────────────────
  var OPTION_LABELS = ['从不', '很少', '有时', '经常', '总是'];

  var SCALES = [
    { id: 'A1', short: '工作负荷', name: '工作/学业负荷', mod: 'A', mu: 12.5, sd: 5.0, items: [
      { t: '每天要处理的任务超出了我能承担的范围' },
      { t: '即使休息之后，我也很难从疲惫中恢复过来' },
      { t: '我能按自己的节奏安排任务进度', r: 1 },
      { t: '我常觉得时间不够用，事情做不完' },
      { t: '工作 / 学习的要求让我感到吃力' },
      { t: '我能在截止时间前从容完成任务', r: 1 } ] },
    { id: 'A2', short: '人际压力', name: '人际压力', mod: 'A', mu: 11.5, sd: 4.8, items: [
      { t: '和身边人的摩擦让我感到很消耗' },
      { t: '为了维持关系，我常压抑自己的真实想法' },
      { t: '我在人际交往中感到放松自在', r: 1 },
      { t: '我害怕让别人失望，很难拒绝别人' },
      { t: '与人相处时，我常常需要小心翼翼' },
      { t: '我能坦然表达与他人不同的意见', r: 1 } ] },
    { id: 'A3', short: '经济财务', name: '经济财务', mod: 'A', mu: 11.0, sd: 5.2, items: [
      { t: '想到收支或债务时，我会感到紧张不安' },
      { t: '一笔突发的花销会明显影响我的情绪' },
      { t: '我对未来一年的财务状况有信心', r: 1 },
      { t: '我担心积蓄应付不了意外' },
      { t: '金钱问题会让我做其他事时难以专心' },
      { t: '目前的收入能让我安心安排生活', r: 1 } ] },
    { id: 'A4', short: '家庭责任', name: '家庭责任', mod: 'A', mu: 10.5, sd: 4.6, items: [
      { t: '照顾家人占用了我大量精力' },
      { t: '家人对我的期望让我感到有压力' },
      { t: '在家庭中，责任能够被大家共同分担', r: 1 },
      { t: '我常为了家事牺牲自己的休息时间' },
      { t: '家庭中的一些矛盾让我放心不下' },
      { t: '家人理解并支持我自己的安排', r: 1 } ] },
    { id: 'A5', short: '健康变化', name: '健康与变化', mod: 'A', mu: 9.5, sd: 4.5, items: [
      { t: '近期身体的变化让我感到担忧' },
      { t: '生活中的突发变动打乱了我的心境' },
      { t: '我有信心应对生活中的变化', r: 1 },
      { t: '我担心身边重要的人的健康状况' },
      { t: '环境变动（搬家 / 变动 / 分离等）让我适应得辛苦' },
      { t: '我的生活节奏总体稳定、可以预期', r: 1 } ] },
    { id: 'A6', short: '不确定感', name: '失控与不确定感', mod: 'A', mu: 12.0, sd: 5.0, items: [
      { t: '我担心无法控制的事情会发生' },
      { t: '面对未来的不确定，我很难安心' },
      { t: '生活中的大多数事情都在我的掌控之中', r: 1 },
      { t: '我常觉得事情的发展由不得自己' },
      { t: '许多不确定的事让我反复设防、放不下心' },
      { t: '计划被打乱时，我也能想办法应对', r: 1 } ] },
    { id: 'B1', short: '情绪反应', name: '情绪反应', mod: 'B', mu: 10.0, sd: 4.8, items: [
      { t: '我感到烦躁，容易为小事发火' },
      { t: '即使在轻松的环境里，我依然紧绷' },
      { t: '我常感到情绪低落、提不起兴趣' },
      { t: '我会无缘无故地感到心慌或不安' },
      { t: '我的情绪起伏比平时更明显' },
      { t: '很难有事情让我感到真正的开心' } ] },
    { id: 'B2', short: '躯体反应', name: '躯体反应', mod: 'B', mu: 9.0, sd: 4.6, items: [
      { t: '我入睡困难、易醒，或睡得比平时多' },
      { t: '我常感到头痛、肩背紧绷或肠胃不适' },
      { t: '最近我的食欲或体重有明显变化' },
      { t: '白天我常感到精力不足、容易疲倦' },
      { t: '我出现过心跳加快、出汗或呼吸发紧' },
      { t: '休息之后，身体的疲劳感也很难消退' } ] },
    { id: 'B3', short: '认知反应', name: '认知反应（反刍）', mod: 'B', mu: 11.5, sd: 5.0, items: [
      { t: '烦心事在脑海里反复出现，停不下来' },
      { t: '我难以集中注意力，做决定变得困难' },
      { t: '我会不自觉地预想最坏的结果' },
      { t: '我经常在入睡前反复回想白天的事' },
      { t: '我开始怀疑自己处理事情的能力' },
      { t: '脑子里的念头太多，很难静下心来' } ] },
    { id: 'B4', short: '行为反应', name: '行为反应', mod: 'B', mu: 10.5, sd: 4.8, items: [
      { t: '我会用拖延、刷手机、暴饮暴食来躲开压力' },
      { t: '我减少了社交，更愿意一个人待着' },
      { t: '我开始依赖某种东西放松（酒精、烟草、游戏等）' },
      { t: '该做的事越积越多，我却提不起劲开始' },
      { t: '我比以前更常用购物或吃东西安慰自己' },
      { t: '我会刻意回避让我有压力的人或场合' } ] },
    { id: 'C1', short: '积极应对', name: '积极应对', mod: 'C', mu: 14.0, sd: 4.2, items: [
      { t: '遇到压力时，我会把问题拆开一步步解决' },
      { t: '我会用运动、倾诉或兴趣主动调节自己' },
      { t: '压力来临时，我倾向于什么都不做等它过去', r: 1 },
      { t: '我会先让自己冷静下来，再想办法处理问题' },
      { t: '遇到难题，我能主动寻找有用的信息和方法' },
      { t: '面对压力，我常常只是抱怨而不行动', r: 1 } ] },
    { id: 'C2', short: '社会支持', name: '社会支持', mod: 'C', mu: 15.0, sd: 4.5, items: [
      { t: '遇到困难时，有人能给我实际的帮助' },
      { t: '我有一群让我有归属感的人' },
      { t: '遇到难处，我习惯完全靠自己扛', r: 1 },
      { t: '情绪低落时，有人愿意耐心听我说' },
      { t: '我能随时向家人或朋友寻求支持' },
      { t: '真正遇到困难时，我觉得无人可以求助', r: 1 } ] }
  ];

  // 题目顺序：6 轮 × 12 维度交叉排列，再穿插效度题与高危题
  var ORDER = [];
  for (var k = 0; k < 6; k++) {
    for (var si = 0; si < SCALES.length; si++) {
      var s = SCALES[si];
      ORDER.push({ key: s.id + (k + 1), text: s.items[k].t, rev: !!s.items[k].r, scale: s.id, kind: 's' });
    }
  }
  var EXTRA_AT = [
    [77, { key: 'R3', text: '我的状态已严重影响吃饭、睡觉、工作 / 学习等基本功能', kind: 'r' }],
    [72, { key: 'SD2', text: '我生活中从来没有遇到过烦心事', kind: 'v' }],
    [67, { key: 'P2b', text: '与身边人的矛盾让我感到疲惫', kind: 'v' }],
    [60, { key: 'P1b', text: '过去一个月，我的睡眠质量明显下降', kind: 'v' }],
    [52, { key: 'R2', text: '我出现过伤害自己、或者不想活了的念头', kind: 'r' }],
    [46, { key: 'SD1', text: '我从未对任何人发过脾气', kind: 'v' }],
    [36, { key: 'P2a', text: '人际间的摩擦消耗了我不少心力', kind: 'v' }],
    [30, { key: 'R1', text: '最近一个月，我觉得未来看不到希望', kind: 'r' }],
    [20, { key: 'P1a', text: '我最近的睡眠不如平时安稳', kind: 'v' }]
  ];
  EXTRA_AT.forEach(function (e) { ORDER.splice(e[0], 0, e[1]); });
  var PAGE_SIZE = 5;
  var PAGES = [];
  for (var pi = 0; pi < ORDER.length; pi += PAGE_SIZE) PAGES.push(ORDER.slice(pi, pi + PAGE_SIZE));

  // ── 解读文案 ────────────────────────────────────────
  var MAIN = {
    G: { name: '稳态掌舵者', quad: '低负荷 × 高资源', combo: '整体状态有序运转',
      desc: '过去一个月，你的负荷处于可承受范围，应对系统也运转良好：压力来了能被消化，休息能起到恢复作用，情绪与身体都没有持续报警。<br><br>这并不意味着你没有压力，而是目前「进」与「出」大体平衡。值得做的是保持现有节律，并有意识地继续储蓄心理资源——在状态好的时期建立的习惯，是未来遇到风浪时最好的缓冲垫。',
      watch: '关注重点：保持现有节律，定期复测建立自己的基线。状态好时的「储蓄」，比状态差时的「抢救」有效得多。' },
    H: { name: '负重攀登者', quad: '高负荷 × 高资源', combo: '担子很重，但你仍在有效应对',
      desc: '过去一个月，你承担着明显高于日常水平的负荷，而值得肯定的是：你的支持系统和应对习惯仍在正常工作——这正是你目前为止没有垮掉的原因。<br><br>你的主要风险不是「扛不住」，而是长期的「不敢停」带来的慢性透支。攀登者需要补给站，而不只是在登顶后才休息。',
      watch: '关注重点：把「恢复」正式排进日程，而不是等有空再说。特别留意睡眠和身体发出的早期信号——它们往往先于情绪报警。' },
    V: { name: '静水潜流者', quad: '低负荷 × 低资源', combo: '眼下平静，但心理储备偏薄',
      desc: '过去一个月，你生活中没有大的风浪，测查到的负荷并不高。但你的应对资源相对单薄——可能是习惯一个人扛，也可能是支持系统没有被真正动用。<br><br>这就像一个水位不高但堤坝不厚的状态：平时一切正常，一旦遇到突发事件冲击，水位可能涨得比预期更快。',
      watch: '关注重点：现在正是储备心理资源的最佳窗口期。主动经营一两段能「说真话」的关系、练习一项调节技巧，都是在为未来的自己铺路。' },
    O: { name: '红灯过载者', quad: '高负荷 × 低资源', combo: '负荷已明显超出缓冲能力',
      desc: '过去一个月，你承受的压力已经明显超出现有资源所能缓冲的范围，身心系统持续处于过载运转的状态。<br><br>请先记住一句话：这不是意志力的问题。当一艘船持续进水时，继续划桨解决不了问题——你当前最值得做的事，是把一部分负荷从身上移下来，并且允许自己接受外部的支持和帮助。',
      watch: '关注重点：强烈建议尽快预约专业心理咨询。「减负荷 + 借外力」双管齐下，比独自硬扛有效得多，也安全得多。' }
  };
  var CHAN = {
    E: { name: '情绪敏感通道', short: '情绪敏感', color: '#e11d48',
      desc: '你的压力最先从<b>情绪</b>发出信号：烦躁、紧绷、起伏变大。情绪不是敌人，它是报警器——当它频繁响起，说明有些负荷需要被处理，而不是被压下去。',
      tip: '可以试试：给情绪命名并记录（情绪日记），每天安排一个情绪出口（倾诉、运动、创作都可以）。' },
    S: { name: '躯体信使通道', short: '躯体信使', color: '#d97706',
      desc: '你的压力最先从<b>身体</b>发出信号：睡眠变差、疲惫、紧绷或各种不适。身体常常在意识察觉之前，就先「知道」你累了。',
      tip: '可以试试：优先修复睡眠节律，配合放松练习（渐进式肌肉放松、呼吸练习）。若躯体不适持续或加重，也请同时到正规医疗机构排查身体原因。' },
    C: { name: '思维反刍通道', short: '思维反刍', color: '#7c3aed',
      desc: '你的压力最先从<b>思维</b>发出信号：停不下来的反复回想、担忧和最坏预期。这说明你的大脑一直在试图「提前解决」那些暂时无法控制的事情。',
      tip: '可以试试：每天设 10 分钟「担忧时间」，把念头写下来并只在这个时段处理；把一件悬置的事拆成 3 个可执行的小步骤。' },
    B: { name: '行为回避通道', short: '行为回避', color: '#0891b2',
      desc: '你的压力最先从<b>行为</b>发出信号：拖延、回避、或用某些方式（刷手机、饮食、酒精等）暂时躲开。回避能换来短暂的轻松，但会让压力源原地变大。',
      tip: '可以试试：「5 分钟启动法」——只承诺做 5 分钟那件一直在回避的小事；留意代偿行为出现的场景，它在替代什么感受？' },
    X: { name: '均衡通道', short: '均衡', color: '#64748b',
      desc: '你的压力信号在情绪、躯体、认知、行为四个通道上分布相对均衡，没有某一条特别突出的报警线路。这通常意味着压力反应尚在早期或整体范围内。',
      tip: '建议保持觉察，配合下方维度地图关注相对偏高的维度，用定期复测追踪变化方向。' }
  };
  var COMBO = {
    'G-E': '整体平衡，情绪波动是你的早期信号灯', 'G-S': '状态良好，留意身体偶尔在「替你说话」',
    'G-C': '整体平衡，遇到挑战时容易多想', 'G-B': '整体平衡，压力来时习惯先缓一缓再处理',
    'H-E': '担子重但扛得住，情绪出口需要被照顾', 'H-S': '高压运转中，身体是你的首要报警器',
    'H-C': '高压之下思维高速空转，需要「认知卸载」', 'H-B': '高压之下，留意回避与补偿行为的苗头',
    'V-E': '储备偏薄，状态容易被情绪牵连', 'V-S': '表面平静，身体已在悄悄积累信号',
    'V-C': '平静期也容易做「灾难化」演练', 'V-B': '缺少支持时，容易退回自己的世界',
    'O-E': '情绪系统全面报警，优先照顾情绪安全', 'O-S': '身心俱疲、信号明显，建议尽快寻求支持',
    'O-C': '反刍与负面预期互相循环，需要外部力量帮助打断', 'O-B': '功能受损与回避互相强化，建议由外部力量介入',
    'G-X': '状态平衡且信号分布均匀，继续保持觉察', 'H-X': '高压下信号较分散，重点关注维度地图中偏高项',
    'V-X': '平静期信号不突出，趁现在储备心理资源', 'O-X': '多个通道同时报警，建议优先获得专业支持'
  };
  var LEVELS = [
    { key: 'L1', max: 40, color: '#10b981', zone: '青绿区', name: '从容应对', retest: '建议 4 周后复测，建立属于你自己的状态基线',
      adv: ['维持现有节律：规律睡眠、每周 3 次左右运动、保持社交连接', '继续储蓄心理资源：状态好时建立的习惯，是未来最好的缓冲', '留意维度地图中相对偏高的维度，作为日常自我觉察的起点'] },
    { key: 'L2', max: 56, color: '#3b82f6', zone: '蓝色区', name: '正常起伏', retest: '建议 4 周后复测，观察分数的变化方向',
      adv: ['自助小练习：4-7-8 呼吸法（吸 4 秒、停 7 秒、呼 8 秒）、睡前一小时远离屏幕', '每周留一段完全属于自己的恢复时间，并正式写进日程', '开始记录情绪日记，留意压力出现的情境规律'] },
    { key: 'L3', max: 71, color: '#eab308', zone: '黄色区', name: '主动调节', retest: '建议 2–4 周内复测；若分数继续上升，请预约个体咨询',
      adv: ['结构化练习：每天 10 分钟正念呼吸或身体扫描，持续两周', '把最大的压力源写下来，拆成 3 个可以立刻执行的小步骤', '考虑参加压力管理团体或心理教育课程，有人同行的调节更有效'] },
    { key: 'L4', max: 86, color: '#f97316', zone: '橙色区', name: '建议求助', retest: '建议 2 周后复测追踪变化，让调整有据可依',
      adv: ['建议尽快预约个体心理咨询，而不是等到「撑不住」才求助', '同时做减法：盘点可以暂缓、委托或拒绝的事务，先卸下 1–2 件', '告诉你信任的一位家人或朋友你目前的状态，不要独自承担'] },
    { key: 'L5', max: 101, color: '#ef4444', zone: '红色区', name: '优先支持', retest: '', adv: [] }
  ];
  var SIGNAL_TEXT = {
    B1: '情绪紧绷与波动偏高，烦躁容易被点燃', B2: '身体已在报警：睡眠、疲惫、不适值得优先照顾',
    B3: '思维反刍明显：念头反复出现、难以停下', B4: '回避与代偿行为增多，压力在「躲」中变大'
  };
  var MOD_STYLE = { A: ['#6366f1', '#eef2ff', '压力源'], B: ['#f43f5e', '#fff1f2', '压力反应'], C: ['#10b981', '#ecfdf5', '应对与资源'] };

  // ── 视图内部状态 ────────────────────────────────────
  var state = { answers: {}, page: 0, start: null, crisisAck: false };
  function $(id) { return document.getElementById(id); }
  function resetState() { state.answers = {}; state.page = 0; state.start = null; state.crisisAck = false; draftClear(); }

  // ─────────────────────────────────────────────────────
  //  渲染
  // ─────────────────────────────────────────────────────
  function lastSummary() {
    var st = MI.store.get().stress;
    if (!st || !st.last) return '';
    var last = st.last;
    var at = last.at ? new Date(last.at).toLocaleString('zh-CN') : '';
    return '<div class="card sp-last">' +
      '<div class="kicker">你上一次的画像</div>' +
      '<p class="sub" style="margin:8px 0 14px">完成于 ' + d.esc(at) + '</p>' +
      '<div class="sp-last-row"><span class="sp-last-num">' + Math.round(last.cpsi) + '</span>' +
      '<span class="sp-last-meta">' + d.esc(last.level) + ' · ' + d.esc(last.type) + ' 型</span></div>' +
      '<div class="btnrow">' +
      '<button class="btn ghost" data-action="view-last">查看上次报告</button>' +
      '<button class="btn ghost" data-action="clear-last">清除记录</button>' +
      '</div></div>';
  }

  // ── 中断续答 ─────────────────────────────────────────
  // 90 题要十分钟，高压用户（恰恰最需要它）最可能中途离开。
  // 每次作答与翻页都落一份草稿，回来自动给出「继续作答」的入口。
  function draftSave() {
    MI.store.update(function (s) {
      s.stress.draft = { answers: JSON.parse(JSON.stringify(state.answers)), page: state.page, at: new Date().toISOString() };
    });
  }

  function draftClear() {
    MI.store.update(function (s) { s.stress.draft = null; });
  }

  function draftCount(dr) {
    var n = 0, k;
    for (k in dr.answers) if (dr.answers.hasOwnProperty(k)) n++;
    return n;
  }

  function draftHTML() {
    var st = MI.store.get().stress;
    if (!st || !st.draft) return '';
    var dr = st.draft;
    var n = draftCount(dr);
    if (!n) return '';
    var at = dr.at ? new Date(dr.at).toLocaleString('zh-CN') : '';
    // 注意：不带 .sp-last 类——mount 会把 intro 里第一个 .sp-last 重刷为上次结果卡，
    // draft 卡若共用类名会在挂载时被替换掉。
    return '<div class="card sp-draft">' +
      '<div class="kicker">有一份没做完的作答</div>' +
      '<p class="sub" style="margin:8px 0 14px">停在第 ' + (Math.max(0, dr.page | 0) + 1) + ' / ' + PAGES.length +
      ' 页 · 已答 ' + n + ' / ' + ORDER.length + ' 题 · ' + d.esc(at) + '</p>' +
      '<div class="btnrow"><button class="btn primary" data-action="resume">继续作答</button></div>' +
      '</div>';
  }

  function render() {
    return '' +
      '<section class="page stress-page">' +
      '<div class="page-head">' +
      '<div class="eyebrow">SPS · STRESS PROFILING · 演示版</div>' +
      '<h1 class="page-title">压力画像</h1>' +
      '<p class="page-desc">像人格测试之于性格那样，把「压力」变成一张可量化、可理解、可行动的画像。本地优先，作答只存在这个浏览器。</p>' +
      '</div>' +

      // ① 说明 / 知情同意
      '<section id="sp-intro" class="sp-screen">' +
      '<div class="card">' +
      '<div class="kicker">PSYCHOLOGICAL STRESS ASSESSMENT</div>' +
      '<h2 class="sp-h2">心理压力画像测评</h2>' +
      '<p class="sub">3 大模块 · 12 个维度 · 90 题（含效度与高危题） · 约 10–15 分钟 · 锚定「最近一个月」</p>' +
      '<div class="feat">' +
      '<div><b>综合压力指数 CPSI</b><span>0–100 分，直观定位当前负荷水平</span></div>' +
      '<div><b>五级预警等级</b><span>青绿 → 红，对应不同行动建议</span></div>' +
      '<div><b>压力画像类型</b><span>4 大主类型 × 4 条反应通道</span></div>' +
      '<div><b>分层建议</b><span>从自助练习到专业转介的路径</span></div>' +
      '</div>' +
      '<div class="note">⚠️ <b>重要说明</b>：本测评为心理压力<b>筛查与自我了解工具</b>，不构成医学或临床诊断；适用于 18 岁以上人群。作答仅保存在你的浏览器中，不会上传任何服务器。</div>' +
      '<label class="consent" role="checkbox" aria-checked="false">' +
      '<input type="checkbox" id="sp-consent" class="sp-cb">' +
      '<span class="sp-box" aria-hidden="true"></span>' +
      '<span class="sp-consent-txt">我已阅读并同意以上说明，理解本工具不构成诊断，且<b>当前处于安全状态</b>。若正在经历强烈痛苦或危险，我会优先拨打心理援助热线或寻求线下专业帮助。</span>' +
      '</label>' +
      '<div class="btnrow">' +
      '<button class="btn primary" id="sp-start" disabled>开始作答（' + ORDER.length + ' 题）</button>' +
      '<button class="btn ghost" id="sp-sample">直接看示例报告</button>' +
      '</div>' +
      '</div>' +
      draftHTML() +
      lastSummary() +
      '</section>' +

      // ② 作答
      '<section id="sp-quiz" class="sp-screen" hidden>' +
      '<div class="prog no-print">' +
      '<div class="progbar"><i id="sp-pbar" style="width:0%"></i></div>' +
      '<div class="progtxt"><span id="sp-ptxt">第 1 / ' + PAGES.length + ' 页</span><span id="sp-pans">已答 0 / ' + ORDER.length + '</span></div>' +
      '</div>' +
      '<div class="card">' +
      '<div class="scalehint"><span>○ 从不</span><span>○ 很少</span><span>○ 有时</span><span>○ 经常</span><span>○ 总是</span></div>' +
      '<div style="font-size:12.5px;color:#94a3b8;margin:-8px 2px 14px">请根据<b style="color:#64748b">最近一个月</b>的真实情况作答，凭第一感觉选择即可，没有对错之分。</div>' +
      '<div id="sp-quiz-body"></div>' +
      '<div class="qnav no-print">' +
      '<button class="btn ghost" id="sp-prev">上一页</button>' +
      '<span class="errmsg" id="sp-err"></span>' +
      '<button class="btn primary" id="sp-next">下一页</button>' +
      '</div>' +
      '<div style="text-align:center;margin-top:8px" class="no-print">' +
      '<button class="linklike" id="sp-fill">演示：随机填充全部题目</button>' +
      '</div>' +
      '</div>' +
      '</section>' +

      // ③ 分析中
      '<section id="sp-loading" class="sp-screen" hidden>' +
      '<div class="card loading">' +
      '<div class="spin"></div>' +
      '<h2 class="sp-h2">正在生成你的压力画像…</h2>' +
      '<p class="sub" id="sp-load-txt">效度检查 → 维度计分 → 常模转换 → 类型判定</p>' +
      '</div>' +
      '</section>' +

      // ④ 危机关怀
      '<section id="sp-crisis" class="sp-screen" hidden>' +
      '<div class="crisis">' +
      '<div style="font-size:34px">💙</div>' +
      '<h2 class="sp-h2">先照顾好此刻的你</h2>' +
      '<p>你的作答中出现了一些需要被认真对待的信号。<br>此刻，你的感受比任何测评结果都重要。这些天一定很不容易，感谢你仍然完成了作答。</p>' +
      '<div class="breath"></div>' +
      '<div class="bcap">跟随圆圈缓慢呼吸：吸气 4 秒 · 呼气 4 秒</div>' +
      '<div class="hot">' +
      '<div class="lab">全国统一心理援助热线（24 小时，免费）</div>' +
      '<div class="num">12356</div>' +
      '</div>' +
      '<p class="emg">如果你正处于即刻的危险之中，请马上拨打当地急救电话（120 / 110），<br>或直接前往最近的医院急诊。你不需要独自扛过这一切。</p>' +
      '<div class="btnrow" style="justify-content:center;margin-top:26px">' +
      '<button class="btn ghost" id="sp-crisis-restart" style="background:transparent;color:#e2e8f0;border-color:rgba(255,255,255,.3)">重新测评</button>' +
      '<button class="btn ghost" id="sp-view-anyway" style="background:transparent;color:#93c5fd;border-color:rgba(147,197,253,.4);font-size:12.5px;padding:10px 20px">我目前处于安全状态，仍想查看本次压力画像（演示入口，正式版不显示）</button>' +
      '</div>' +
      '</div>' +
      '</section>' +

      // ⑤ 报告
      '<section id="sp-report" class="sp-screen" hidden>' +
      '<div id="sp-report-body"></div>' +
      '<div class="btnrow no-print" style="justify-content:center;margin-top:24px">' +
      '<button class="btn primary" id="sp-restart">重新测评</button>' +
      '<button class="btn ghost" onclick="window.print()">打印 / 导出报告</button>' +
      '</div>' +
      '</section>' +
      '</section>';
  }

  // ─────────────────────────────────────────────────────
  //  作答界面
  // ─────────────────────────────────────────────────────
  function show(screen) {
    ['sp-intro', 'sp-quiz', 'sp-loading', 'sp-crisis', 'sp-report'].forEach(function (id) {
      var el = $(id);
      if (el) el.hidden = (id !== screen);
    });
    window.scrollTo({ top: 0 });
  }

  function renderPage() {
    var p = PAGES[state.page];
    var startNo = state.page * PAGE_SIZE;
    var html = '';
    for (var i = 0; i < p.length; i++) {
      var it = p[i];
      var no = startNo + i + 1;
      var ans = state.answers[it.key];
      var opts = '';
      for (var v = 0; v < OPTION_LABELS.length; v++) {
        opts += '<label class="opt' + (ans === v ? ' sel' : '') + '" data-k="' + it.key + '" data-v="' + v + '">' +
          '<input type="radio" name="' + it.key + '" value="' + v + '"' + (ans === v ? ' checked' : '') + '>' + OPTION_LABELS[v] + '</label>';
      }
      html += '<div class="q" id="q-' + it.key + '"><div class="qhead"><span class="qno">' + no + '</span>' +
        '<span class="qtext">' + d.esc(it.text) + '</span></div><div class="opts">' + opts + '</div></div>';
    }
    $('sp-quiz-body').innerHTML = html;
    $('sp-prev').style.visibility = state.page === 0 ? 'hidden' : 'visible';
    $('sp-next').textContent = state.page === PAGES.length - 1 ? '✨ 生成我的报告' : '下一页';
    $('sp-err').textContent = '';
    updateProg();
  }

  function answeredCount() {
    var n = 0;
    for (var i = 0; i < ORDER.length; i++) if (state.answers[ORDER[i].key] !== undefined) n++;
    return n;
  }

  function updateProg() {
    var n = answeredCount();
    var total = ORDER.length;
    $('sp-pbar').style.width = (n / total * 100) + '%';
    $('sp-ptxt').textContent = '第 ' + (state.page + 1) + ' / ' + PAGES.length + ' 页';
    $('sp-pans').textContent = '已答 ' + n + ' / ' + total;
  }

  function pageAnswered() {
    var firstMiss = null;
    for (var i = 0; i < PAGES[state.page].length; i++) {
      var it = PAGES[state.page][i];
      if (state.answers[it.key] === undefined) {
        var el = $('q-' + it.key);
        if (el) el.classList.add('miss');
        if (!firstMiss) firstMiss = el;
      }
    }
    return firstMiss;
  }

  function randomFill() {
    var w = [18, 30, 28, 16, 8];
    for (var i = 0; i < ORDER.length; i++) {
      var r = Math.random() * 100, v = 0, acc = 0;
      for (var j = 0; j < 5; j++) { acc += w[j]; if (r < acc) { v = j; break; } }
      state.answers[ORDER[i].key] = v;
    }
  }

  // ─────────────────────────────────────────────────────
  //  控制流
  // ─────────────────────────────────────────────────────
  function goLoading() {
    draftClear(); // 走到这里说明 90 题已答完，草稿的使命结束了
    ['sp-intro', 'sp-quiz', 'sp-report', 'sp-crisis'].forEach(function (id) { var e = $(id); if (e) e.hidden = true; });
    $('sp-loading').hidden = false;
    window.scrollTo({ top: 0 });
    var steps = ['效度检查中…', '维度计分中…', '常模转换中…', '类型判定中…', '报告生成中…'];
    var idx = 0;
    var t = setInterval(function () { $('sp-load-txt').textContent = steps[idx % steps.length]; idx++; }, 400);
    setTimeout(function () {
      clearInterval(t);
      $('sp-loading').hidden = true;
      route();
    }, 1900);
  }

  function route() {
    var r = compute();
    if ((r.crisis || r.cpsi >= 86) && !state.crisisAck) { show('sp-crisis'); return; }
    renderReport(r);
  }

  function saveResult(r) {
    MI.store.update(function (s) {
      s.stress = s.stress || { last: null, history: [] };
      var rec = {
        at: new Date().toISOString(),
        cpsi: Math.round(r.cpsi),
        level: r.level.zone,
        main: r.main,
        chan: r.chan,
        type: r.main + '-' + r.chan,
        result: r
      };
      s.stress.last = rec;
      s.stress.history = s.stress.history || [];
      s.stress.history.unshift({ at: rec.at, cpsi: rec.cpsi, level: rec.level, type: rec.type });
      if (s.stress.history.length > 20) s.stress.history = s.stress.history.slice(0, 20);
    });
    if (MI.echo && MI.echo.push) {
      MI.echo.push({
        kind: 'stress', surface: 'ledger',
        title: '完成了一次压力测评。',
        detail: '综合压力指数 ' + Math.round(r.cpsi) + ' / 100，' + r.level.zone + '。'
      });
    }
  }

  function restartAll() {
    resetState();
    MI.router.render();
  }

  // ─────────────────────────────────────────────────────
  //  计分
  // ─────────────────────────────────────────────────────
  function normCDF(z) {
    var t = 1 / (1 + 0.2316419 * Math.abs(z));
    var d0 = Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);
    var p = 1 - d0 * (0.319381530 * t - 0.356563782 * t * t + 1.781477937 * Math.pow(t, 3) - 1.821255978 * Math.pow(t, 4) + 1.330274429 * Math.pow(t, 5));
    return z > 0 ? p : 1 - p;
  }

  function compute() {
    var T = {}, raw = {};
    for (var si = 0; si < SCALES.length; si++) {
      var sc = SCALES[si];
      var sum = 0;
      for (var ki = 0; ki < sc.items.length; ki++) {
        var it = sc.items[ki];
        var v = state.answers[sc.id + (ki + 1)];
        if (v == null) v = 0;
        if (it.r) v = 4 - v;
        sum += v;
      }
      raw[sc.id] = sum;
      T[sc.id] = Math.round(Math.max(20, Math.min(80, 50 + 10 * (sum - sc.mu) / sc.sd)));
    }
    function avg(arr) { var t = 0; for (var i = 0; i < arr.length; i++) t += arr[i]; return t / arr.length; }
    var A = [], B = [], C = [];
    for (var a = 0; a < SCALES.length; a++) { var m = SCALES[a].mod; if (m === 'A') A.push(T[SCALES[a].id]); else if (m === 'B') B.push(T[SCALES[a].id]); else C.push(T[SCALES[a].id]); }
    var Tsrc = avg(A), Treact = avg(B), Tres = avg(C);
    var cpsi = 0.25 * Tsrc + 0.45 * Treact + 0.30 * (100 - Tres);
    var level = null;
    for (var li = 0; li < LEVELS.length; li++) { if (cpsi < LEVELS[li].max) { level = LEVELS[li]; break; } }
    if (!level) level = LEVELS[LEVELS.length - 1];
    var load = (Tsrc + Treact) / 2, high = load >= 55, resOK = Tres >= 50;
    var main = !high && resOK ? 'G' : (high && resOK ? 'H' : (!high ? 'V' : 'O'));
    var bScales = [];
    for (var b = 0; b < SCALES.length; b++) if (SCALES[b].mod === 'B') bScales.push(SCALES[b]);
    var chan = 'X', chanT = 0;
    var mapB = { B1: 'E', B2: 'S', B3: 'C', B4: 'B' };
    for (var b2 = 0; b2 < bScales.length; b2++) { if (T[bScales[b2].id] > chanT) { chanT = T[bScales[b2].id]; chan = mapB[bScales[b2].id]; } }
    if (chanT < 55) chan = 'X';
    var sorted = bScales.slice().sort(function (a, b) { return T[b.id] - T[a.id]; }).slice(0, 3)
      .map(function (s) { return { name: s.name, t: T[s.id], txt: SIGNAL_TEXT[s.id] }; });
    var elapsed = state.start ? (Date.now() - state.start) / 1000 : 999;
    var flags = [];
    if (elapsed < 300) flags.push('作答时间偏短（' + Math.round(elapsed / 60 * 10) / 10 + ' 分钟）');
    var cnt = [0, 0, 0, 0, 0];
    for (var c = 0; c < SCALES.length; c++) {
      for (var k2 = 0; k2 < SCALES[c].items.length; k2++) {
        var vv = state.answers[SCALES[c].id + (k2 + 1)];
        if (vv == null) vv = 0;
        cnt[vv]++;
      }
    }
    if (Math.max.apply(null, cnt) >= Math.round(72 * 0.9)) flags.push('选项分布高度集中');
    if (Math.abs((state.answers.P1a || 0) - (state.answers.P1b || 0)) >= 2 || Math.abs((state.answers.P2a || 0) - (state.answers.P2b || 0)) >= 2) flags.push('近义题作答差异较大');
    if ((state.answers.SD1 || 0) >= 3 && (state.answers.SD2 || 0) >= 3) flags.push('可能存在“展现完美形象”的防御性作答倾向');
    var crisis = (state.answers.R1 || 0) >= 2 || (state.answers.R2 || 0) >= 1 || (state.answers.R3 || 0) >= 3;
    return { T: T, raw: raw, Tsrc: Tsrc, Treact: Treact, Tres: Tres, cpsi: cpsi, level: level, main: main, chan: chan, chanT: chanT, sigs: sorted, flags: flags, crisis: crisis, load: load, resOK: resOK,
      pct: Math.round(normCDF((cpsi - 50) / 15) * 100) };
  }

  // ─────────────────────────────────────────────────────
  //  图表（纯 SVG / DOM）
  // ─────────────────────────────────────────────────────
  function gaugeSVG(v) {
    var cx = 170, cy = 158, r = 128;
    function P(p) { var a = Math.PI * (1 - p); return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; }
    function arc(p0, p1, color) {
      var x0 = P(p0), y0 = P(p0);
      var x1 = P(p1), y1 = P(p1);
      return '<path d="M ' + x0[0].toFixed(1) + ' ' + y0[1].toFixed(1) + ' A ' + r + ' ' + r + ' 0 ' + ((p1 - p0) > .5 ? 1 : 0) + ' 1 ' + x1[0].toFixed(1) + ' ' + y1[1].toFixed(1) + '" fill="none" stroke="' + color + '" stroke-width="18"/>';
    }
    var s = arc(0, .40, '#10b981') + arc(.40, .56, '#3b82f6') + arc(.56, .71, '#eab308') + arc(.71, .86, '#f97316') + arc(.86, 1, '#ef4444');
    var a = Math.PI * (1 - v / 100), nr = r - 28;
    var nx = cx + nr * Math.cos(a), ny = cy - nr * Math.sin(a);
    s += '<line x1="' + cx + '" y1="' + cy + '" x2="' + nx.toFixed(1) + '" y2="' + ny.toFixed(1) + '" stroke="#0f172a" stroke-width="4" stroke-linecap="round"/><circle cx="' + cx + '" cy="' + cy + '" r="9" fill="#0f172a"/>';
    s += '<text x="' + cx + '" y="' + (cy + 44) + '" text-anchor="middle" font-size="40" font-weight="800" fill="#0f172a">' + Math.round(v) + '</text>';
    s += '<text x="' + cx + '" y="' + (cy + 66) + '" text-anchor="middle" font-size="12" fill="#64748b">CPSI 综合压力指数 / 100</text>';
    return '<svg viewBox="0 0 340 235" style="width:100%;max-width:340px;display:block;margin:0 auto">' + s + '</svg>';
  }

  function radarSVG(vals) {
    var cx = 215, cy = 182, R = 122, n = vals.length;
    function ang(i) { return -Math.PI / 2 + i * 2 * Math.PI / n; }
    function X(i, r) { return (cx + r * Math.cos(ang(i))).toFixed(1); }
    function Y(i, r) { return (cy + r * Math.sin(ang(i))).toFixed(1); }
    function rOf(t) { return (Math.max(20, Math.min(80, t)) - 20) / 60 * R; }
    var s = '';
    [30, 50, 70].forEach(function (rt) {
      var dd = '';
      for (var i = 0; i <= n; i++) dd += (i ? 'L' : 'M') + X(i % n, rOf(rt)) + ' ' + Y(i % n, rOf(rt)) + ' ';
      s += '<path d="' + dd + '" fill="none" stroke="' + (rt === 50 ? '#c7d2fe' : '#edf0f8') + '" stroke-width="1.2" ' + (rt === 50 ? 'stroke-dasharray="5 4"' : '') + '/>';
    });
    for (var i2 = 0; i2 < vals.length; i2++) {
      var v = vals[i2];
      s += '<line x1="' + cx + '" y1="' + cy + '" x2="' + X(i2, R) + '" y2="' + Y(i2, R) + '" stroke="#e8ebf5"/>';
      var cc = Math.cos(ang(i2));
      var anchor = cc > .35 ? 'start' : (cc < -.35 ? 'end' : 'middle');
      s += '<text x="' + X(i2, R + 24) + '" y="' + Y(i2, R + 24) + '" text-anchor="' + anchor + '" dominant-baseline="middle" font-size="11.5" font-weight="600" fill="' + MOD_STYLE[v.mod][0] + '">' + v.short + '</text>';
    }
    var pd = '';
    for (var i3 = 0; i3 < vals.length; i3++) pd += (i3 ? 'L' : 'M') + X(i3, rOf(vals[i3].t)) + ' ' + Y(i3, rOf(vals[i3].t)) + ' ';
    s += '<path d="' + pd + 'Z" fill="rgba(79,70,229,.13)" stroke="#4f46e5" stroke-width="2" stroke-linejoin="round"/>';
    for (var i4 = 0; i4 < vals.length; i4++) s += '<circle cx="' + X(i4, rOf(vals[i4].t)) + '" cy="' + Y(i4, rOf(vals[i4].t)) + '" r="3.5" fill="' + MOD_STYLE[vals[i4].mod][0] + '"/>';
    return '<svg viewBox="0 0 430 365" style="width:100%;max-width:560px;display:block;margin:0 auto">' + s + '</svg>';
  }

  function barRow(label, t, color) {
    var pct = Math.max(3, Math.min(100, (t - 20) / 60 * 100));
    return '<div class="brow"><div class="blab">' + label + '</div><div class="btrack"><div class="bfill" style="width:' + pct + '%;background:' + color + '"></div><div class="bmark" style="left:58.3%"></div></div><div class="bval">' + t + '</div></div>';
  }

  function tBand(t) { return t >= 65 ? ['偏高', '#fee2e2', '#b91c1c'] : t >= 55 ? ['略高于均值', '#fef3c7', '#92400e'] : t >= 45 ? ['均值区间', '#f1f5f9', '#475569'] : ['低于均值', '#ecfdf5', '#047857']; }

  // ─────────────────────────────────────────────────────
  //  报告渲染
  // ─────────────────────────────────────────────────────
  function zonesHTML(r) {
    var lv = r.level;
    var zoneW = [40, 16, 15, 15, 14];
    var zones = '';
    for (var i = 0; i < LEVELS.length; i++) {
      zones += '<i style="width:' + zoneW[i] + '%;background:' + LEVELS[i].color + (LEVELS[i] === lv ? '' : '55') + '"></i>';
    }
    var zlabels = ['青绿·从容', '蓝·起伏', '黄·调节', '橙·求助', '红·优先'].map(function (t, i) {
      return '<span style="width:' + zoneW[i] + '%">' + t + '</span>';
    }).join('');
    var pos = Math.min(97, Math.max(3, r.cpsi));
    var marker = '<div class="marker"><div class="tick" style="left:' + pos + '%"><div class="mv">你在这里</div><div class="tri"></div></div></div>';
    return '<div class="zonewrap">' + marker + '<div class="zones">' + zones + '</div><div class="zonelabels">' + zlabels + '</div></div>';
  }

  function modCardsHTML(r) {
    var mods = [['压力源', r.Tsrc], ['压力反应', r.Treact], ['应对与资源', r.Tres]];
    var html = '';
    for (var i = 0; i < mods.length; i++) {
      var mc = MOD_STYLE['ABC'.charAt(i)];
      var t = mods[i][1];
      var band = i === 2 ? (t >= 50 ? ['资源充足', '#ecfdf5', '#047857'] : ['资源偏薄', '#fee2e2', '#b91c1c']) : tBand(t);
      html += '<div class="modcard" style="border-top:3px solid ' + mc[0] + '"><div class="t" style="color:' + mc[0] + '">' + Math.round(t) + '</div><div class="n">' + mods[i][0] + '（T 分）</div><span class="s" style="background:' + band[1] + ';color:' + band[2] + '">' + band[0] + '</span></div>';
    }
    return html;
  }

  function scaleList() {
    return SCALES.map(function (s) { return { short: s.short, name: s.name, mod: s.mod, t: computeCache.T[s.id] }; });
  }

  // computeCache 让图表函数能拿到 T 分，而不必重算
  var computeCache = { T: {} };

  function chanBarsHTML(r) {
    var ch = CHAN[r.chan];
    var html = '';
    for (var i = 0; i < SCALES.length; i++) {
      if (SCALES[i].mod !== 'B') continue;
      var t = computeCache.T[SCALES[i].id];
      var color = (t === r.chanT && r.chan !== 'X') ? ch.color : '#cbd5e1';
      html += barRow(SCALES[i].short, t, color);
    }
    return html;
  }

  function srcBarsHTML() {
    var list = [];
    for (var i = 0; i < SCALES.length; i++) if (SCALES[i].mod === 'A') list.push(SCALES[i]);
    list.sort(function (a, b) { return computeCache.T[b.id] - computeCache.T[a.id]; });
    var html = '';
    for (var j = 0; j < list.length; j++) html += barRow(list[j].name, computeCache.T[list[j].id], '#6366f1');
    return html;
  }

  function sigHTML(r) {
    return r.sigs.map(function (sg) {
      return '<div class="sig"><div class="sn">' + sg.t + '</div><div><b>' + d.esc(sg.name) + ' <span style="font-weight:400;color:#94a3b8;font-size:12px">T 分 ' + sg.t + '，' + tBand(sg.t)[0] + '</span></b><span>' + sg.txt + '</span></div></div>';
    }).join('');
  }

  function advHTML(r) { return r.level.adv.map(function (a) { return '<li>' + a + '</li>'; }).join(''); }

  function renderReport(r) {
    computeCache.T = r.T;
    $('sp-report').hidden = false;
    var lv = r.level, mt = MAIN[r.main], ch = CHAN[r.chan];
    var comboKey = r.main + '-' + r.chan;
    var validHtml = r.flags.length ? '<div class="validnote">⚠️ <b>本次作答效度提示：</b>' + d.esc(r.flags.join('；')) + '。以下结果<b>仅供参考</b>，建议在安静、不被打扰的环境中重新作答。</div>' : '';
    var safetyHtml = state.crisisAck ? '<div class="safetybanner">🛟 <b>安全提示：</b>本次作答中出现了需要优先关注的信号。以下画像仅供参考，<b>强烈建议你先使用页面底部的支持资源</b>——你的安全比任何分析都重要。</div>' : '';
    var callout = (lv.key === 'L4' || state.crisisAck) ? '<div class="callout">💬 当前状态下，与专业心理咨询师的对话会比自助方法更能切实帮到你。求助不是软弱，而是对自己最有效的负责。</div>' : '';

    var zoneColor = lv.color === '#eab308' ? '#a16207' : lv.color;

    var html = '' +
      safetyHtml +
      // ① 总览
      '<div class="card">' +
      '<div class="kicker">01 · 总览 OVERVIEW</div>' +
      '<div class="ov" style="margin-top:14px">' +
      '<div class="gwrap">' + gaugeSVG(r.cpsi) + '</div>' +
      '<div class="oinfo">' +
      '<span class="lvl" style="background:' + lv.color + '1e;color:' + zoneColor + '"><span class="dot" style="background:' + lv.color + '"></span>' + lv.zone + ' · ' + lv.name + '</span>' +
      '<div class="cpsiLine">综合压力指数 <b>' + Math.round(r.cpsi) + '</b> / 100</div>' +
      '<div class="sub" style="font-size:13px">高于约 ' + r.pct + '% 的常模样本（演示常模，示例参数）</div>' +
      '<div class="badgebox"><div class="code">' + r.main + '-' + r.chan + ' 型</div><div class="nm">' + mt.name + ' × ' + ch.short + '</div><div class="cb">' + COMBO[comboKey] + '</div></div>' +
      '</div></div></div>' +
      // ② 五区定位
      '<div class="card">' +
      '<div class="kicker">02 · 等级定位 YOUR ZONE</div>' +
      '<p class="sub" style="margin:10px 0 22px;font-size:13.5px">你当前处于五级预警体系中的<b style="color:' + zoneColor + '">' + lv.zone + '（' + lv.name + '）</b>。</p>' +
      zonesHTML(r) +
      '<div class="modcards" style="margin-top:20px">' + modCardsHTML(r) + '</div>' +
      '</div>' +
      validHtml +
      // ③ 维度地图
      '<div class="card">' +
      '<div class="kicker">03 · 维度地图 12 DIMENSIONS</div>' +
      '<div class="legend" style="margin-top:10px"><span><i style="background:#6366f1"></i>压力源（A1–A6）</span><span><i style="background:#f43f5e"></i>压力反应（B1–B4）</span><span><i style="background:#10b981"></i>应对与资源（C1–C2）</span><span style="color:#94a3b8">虚线圈 = T50 常模均值</span></div>' +
      radarSVG(scaleList()) +
      '</div>' +
      // ④ 压力源构成
      '<div class="card">' +
      '<div class="kicker">04 · 压力源构成 WHAT’S WEIGHING ON YOU</div>' +
      '<p class="sub" style="margin:10px 0 18px;font-size:13.5px">六大压力源按强度排序（虚线 = T55 偏高界限）：</p>' +
      srcBarsHTML() +
      '</div>' +
      // ⑤ 类型深读
      '<div class="card">' +
      '<div class="kicker">05 · 类型深读 YOUR PROFILE</div>' +
      '<div class="typetitle" style="margin-top:12px"><span class="bigcode">' + r.main + '-' + r.chan + '</span>' +
      '<div><div style="font-size:19px;font-weight:800">' + mt.name + ' × ' + ch.name + '</div><div class="sub" style="font-size:13px">' + COMBO[comboKey] + '</div></div></div>' +
      '<div class="quadnote">判定依据：压力负荷 T' + Math.round(r.load) + '（' + (r.load >= 55 ? '偏高 ≥55' : '未达偏高线 55') + '） × 资源充足度 T' + Math.round(r.Tres) + '（' + (r.resOK ? '充足 ≥50' : '偏薄 <50') + '）。类型反映最近一个月的状态，会随行动与复测变化。</div>' +
      '<div class="desc"><b style="font-size:15px">▍' + mt.name + '</b>（' + mt.quad + '）<br>' + mt.desc + '</div>' +
      '<div class="watchbox">' + mt.watch + '</div>' +
      '<div class="chanbox"><div class="cn">▍主导信号通道：' + ch.name + '（T 分 ' + (r.chan !== 'X' ? r.chanT : '—') + '）</div>' +
      '<div style="margin:12px 0 14px">' + chanBarsHTML(r) + '</div>' +
      '<div class="desc" style="margin-top:0">' + ch.desc + '</div>' +
      '<div class="desc" style="color:#334155"><b>建议：</b>' + ch.tip + '</div></div>' +
      '</div>' +
      // ⑥ 信号清单
      '<div class="card">' +
      '<div class="kicker">06 · 信号清单 3 SIGNALS TO WATCH</div>' +
      '<p class="sub" style="margin:10px 0 14px;font-size:13.5px">最近一个月，值得你留意的三个信号（按反应维度 T 分排序）：</p>' +
      sigHTML(r) +
      '</div>' +
      // ⑦ 分层建议
      '<div class="card">' +
      '<div class="kicker">07 · 分层建议 YOUR NEXT STEPS</div>' +
      '<p style="margin:10px 0 12px;font-size:14.5px">按照你所在的<b>' + lv.zone + '</b>，建议路径如下：</p>' +
      '<ul class="adv" style="margin:0;padding-left:20px">' + advHTML(r) + '</ul>' +
      callout +
      '</div>' +
      // ⑧ 复测计划
      '<div class="card">' +
      '<div class="kicker">08 · 复测计划 RETEST</div>' +
      '<div class="rtline" style="margin-top:10px">📅 ' + (lv.retest || '建议尽快预约专业支持，并定期复测追踪变化。') + '</div>' +
      '<p class="sub" style="font-size:13px;margin-top:10px">压力是状态变量。在同一坐标系下复测，比一次分数更有价值——变化的方向，就是调整是否有效的证据。</p>' +
      '</div>' +
      // ⑨ 声明与资源
      '<div class="card">' +
      '<div class="kicker">09 · 声明与支持资源 RESOURCES</div>' +
      '<div class="resbox"><div class="hn">12356</div>' +
      '<p>全国统一心理援助热线（24 小时，免费）。如果你正处于即刻的危险中，请拨打当地急救电话（120 / 110）或前往最近的医院急诊。</p></div>' +
      '<p class="decl">· 本测评为心理压力筛查与自我了解工具，<b>不构成医学或临床诊断</b>；如长期痛苦或功能受损，请寻求正规医疗 / 心理服务。<br>' +
      '· 结果反映「最近一个月」的状态画像，会随时间与行动变化，请勿将其视为固定标签。<br>' +
      '· 演示版本地运行，数据仅保存于当前浏览器，不会上传。计分常模为示例参数，正式版以标定后的实测常模为准。<br>' +
      '· SPS 测评体系 · V1.0 Demo · 生成时间 ' + new Date().toLocaleString('zh-CN') + '</p>' +
      '</div>';

    $('sp-report-body').innerHTML = html;
    saveResult(r);
    show('sp-report');
  }

  // ─────────────────────────────────────────────────────
  //  挂载
  // ─────────────────────────────────────────────────────
  function mount(root) {
    // 入口处的「上一次」卡片
    var intro = root.querySelector('#sp-intro');
    if (intro) {
      var lastSlot = intro.querySelector('.sp-last');
      if (lastSlot) lastSlot.outerHTML = lastSummary();
    }

    var consent = root.querySelector('#sp-consent');
    var startBtn = root.querySelector('#sp-start');
    if (consent && startBtn) {
      consent.onchange = function (e) {
        startBtn.disabled = !e.target.checked;
        var lab = consent.closest('.consent');
        if (lab) lab.setAttribute('aria-checked', e.target.checked ? 'true' : 'false');
      };
    }
    if (startBtn) {
      startBtn.onclick = function () {
        resetState();
        state.start = Date.now();
        show('sp-quiz');
        renderPage();
      };
    }
    var sampleBtn = root.querySelector('#sp-sample');
    if (sampleBtn) {
      sampleBtn.onclick = function () {
        resetState();
        randomFill();
        // 示例报告用于预览完整画像，不希望随机命中高危题而落到危机关怀页，
        // 所以把三道高危题压到最低，保证一定能看到报告。
        state.answers.R1 = 0; state.answers.R2 = 0; state.answers.R3 = 0;
        state.start = Date.now() - 9 * 60 * 1000;
        goLoading();
      };
    }

    var quizBody = root.querySelector('#sp-quiz-body');
    if (quizBody) {
      quizBody.addEventListener('change', function (e) {
        var l = e.target.closest('.opt');
        if (!l) return;
        state.answers[l.dataset.k] = +l.dataset.v;
        var optsWrap = l.parentElement;
        if (optsWrap) {
          var all = optsWrap.querySelectorAll('.opt');
          for (var i = 0; i < all.length; i++) all[i].classList.remove('sel');
        }
        l.classList.add('sel');
        var qEl = document.getElementById('q-' + l.dataset.k);
        if (qEl) qEl.classList.remove('miss');
        var err = root.querySelector('#sp-err'); if (err) err.textContent = '';
        updateProg();
        draftSave();
      });
    }

    var prevBtn = root.querySelector('#sp-prev');
    if (prevBtn) {
      prevBtn.onclick = function () {
        if (state.page > 0) { state.page--; renderPage(); draftSave(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
      };
    }
    var nextBtn = root.querySelector('#sp-next');
    if (nextBtn) {
      nextBtn.onclick = function () {
        var miss = pageAnswered();
        if (miss) {
          var err = root.querySelector('#sp-err');
          if (err) err.textContent = '本页还有题目未作答（已标红）';
          miss.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        if (state.page < PAGES.length - 1) { state.page++; renderPage(); draftSave(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
        else { state.start = state.start || Date.now(); goLoading(); }
      };
    }
    var fillBtn = root.querySelector('#sp-fill');
    if (fillBtn) {
      fillBtn.onclick = function () {
        randomFill();
        renderPage();
        var err = root.querySelector('#sp-err');
        if (err) { err.style.color = '#059669'; err.textContent = '✓ 已随机填充全部 ' + ORDER.length + ' 题（演示模式）'; }
        setTimeout(function () { var e2 = root.querySelector('#sp-err'); if (e2) { e2.style.color = '#dc2626'; e2.textContent = ''; } }, 2500);
      };
    }

    var restartBtn = root.querySelector('#sp-restart');
    if (restartBtn) restartBtn.onclick = restartAll;
    var crisisRestartBtn = root.querySelector('#sp-crisis-restart');
    if (crisisRestartBtn) crisisRestartBtn.onclick = restartAll;
    var viewAnywayBtn = root.querySelector('#sp-view-anyway');
    if (viewAnywayBtn) viewAnywayBtn.onclick = function () { state.crisisAck = true; renderReport(compute()); };

    // 中断续答：草稿存在即代表上次已阅读并同意说明，直接回到停下的那一页
    var draftWrap = intro.querySelector('.sp-draft');
    if (draftWrap) {
      draftWrap.addEventListener('click', function (e) {
        if (!e.target.closest('[data-action="resume"]')) return;
        var dr = MI.store.get().stress.draft;
        if (!dr || !dr.answers) return;
        state.answers = dr.answers;
        state.page = Math.max(0, Math.min(PAGES.length - 1, dr.page | 0));
        state.start = Date.now();
        show('sp-quiz');
        renderPage();
      });
    }

    // 「上一次」卡片上的动作
    var lastWrap = root.querySelector('#sp-intro .sp-last');
    if (lastWrap) {
      lastWrap.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-action]');
        if (!btn) return;
        var action = btn.dataset.action;
        var st = MI.store.get().stress;
        if (action === 'view-last' && st && st.last && st.last.result) {
          state.crisisAck = true;
          renderReport(st.last.result);
        } else if (action === 'clear-last') {
          MI.store.update(function (s) { s.stress.last = null; s.stress.history = []; });
          if (MI.router.render) MI.router.render();
        }
      });
    }
  }

  // ── 跨模块读取：供恐惧模型等消费最近一次压力画像结果 ──
  // 把结果 shape 收敛成「展示就绪」的对象，避免其它模块直接依赖计分细节。
  MI.stress = {
    snapshot: function () {
      var st = MI.store.get().stress;
      if (!st || !st.last || !st.last.result) return null;
      var l = st.last, r = l.result;
      // levelIndex：1-5 对应五级预警（青绿/蓝/黄/橙/红）。
      // 供行动层（如实验室）按负荷做轻提示，不必理解 LEVELS 阈值细节。
      var li = LEVELS.length - 1, i;
      for (i = 0; i < LEVELS.length; i++) { if (l.cpsi < LEVELS[i].max) { li = i; break; } }
      return {
        at: l.at,
        cpsi: l.cpsi,
        level: l.level,
        levelIndex: li + 1,
        levelColor: (r.level && r.level.color) ? r.level.color : '#64748b',
        main: l.main,
        mainName: MAIN[l.main] ? MAIN[l.main].name : '',
        chan: l.chan,
        chanName: CHAN[l.chan] ? CHAN[l.chan].short : '',
        chanColor: CHAN[l.chan] ? CHAN[l.chan].color : '#64748b',
        type: l.type,
        result: r
      };
    }
  };

  MI.views.stress = {
    title: '压力画像',
    render: render,
    mount: mount
  };
})(window.MI);
