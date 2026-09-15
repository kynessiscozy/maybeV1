window.MI = window.MI || {};
(function (MI) {
  'use strict';

  var TIMEOUT_MS = 45000;

  var SYSTEM_PROMPT = [
    '你是「未发生事务所」的路线设计师。',
    '你的工作是把一个人不敢开始的念头，展开成三条不同强度的可能性路线，并给出可执行的七天计划。',
    '',
    '原则：',
    '1. 你不预测未来，不判断成败，不提供成功概率、收入估计或命运暗示。',
    '2. 你不说教，不使用「加油」「相信自己」「你一定可以」这类空话。',
    '3. 建议必须具体到可以今天就动手，允许失败，允许随时停止。',
    '4. 涉及食品、场地、经营、健康、法律等现实约束时，明确提醒先确认合规要求，不鼓励贸然投入。',
    '5. 三条路线的强度分别是：不惊动日常的微小试探、正式做一个小样、远期愿景的最小验证。',
    '',
    '只输出一个 JSON 对象，不要输出任何解释文字或 Markdown 代码块。'
  ].join('\n');

  function config() {
    return MI.store.get().settings.ai;
  }

  function save(patch) {
    MI.store.update(function (s) {
      s.settings.ai = Object.assign(s.settings.ai, patch);
    });
  }

  function isConfigured() {
    var c = config();
    return !!(c.enabled && c.endpoint && c.model && c.key);
  }

  function maskKey() {
    var k = config().key;
    if (!k) return '';
    if (k.length <= 10) return '••••••';
    return k.slice(0, 4) + '••••••' + k.slice(-4);
  }

  // 允许用户只填到 /v1，自动补全路径
  function resolveEndpoint(raw) {
    var url = String(raw || '').trim().replace(/\/+$/, '');
    if (!url) return '';
    if (/\/chat\/completions$/.test(url)) return url;
    return url + '/chat/completions';
  }

  function buildUserPrompt(ctx) {
    var lines = [];
    lines.push('念头：' + ctx.idea);
    lines.push('偏离惯性的程度：' + ctx.courage + '%（越高越接近「换一种活法」）');
    lines.push('每天能借给自己的时间：' + ctx.time + ' 分钟');
    lines.push('内容主题：' + ctx.themeLabel);
    lines.push('');

    var memory = ctx.memory && ctx.memory.length ? ctx.memory : ['（暂无记忆，这是第一次）'];
    lines.push('关于这个人的长期记忆：');
    memory.forEach(function (m) { lines.push('- ' + m); });
    lines.push('');

    if (ctx.feedback && ctx.feedback.length) {
      lines.push('这个人对以往路线的反馈：');
      ctx.feedback.forEach(function (f) { lines.push('- ' + f); });
      lines.push('');
    }

    if (ctx.adjustment) {
      lines.push('自我调整说明：' + ctx.adjustment);
      lines.push('');
    }

    lines.push('请输出这样的 JSON：');
    lines.push(JSON.stringify({
      themeLabel: '主题短标签',
      routes: [{
        description: '这条路的定位，60 字以内',
        nodes: [
          { title: '节点标题，10 字以内', code: 'ENGLISH CODE', advice: '具体建议，80 字以内' },
          { title: '…', code: '…', advice: '…' },
          { title: '…', code: '…', advice: '…' }
        ],
        days: ['第1天，40 字以内', '第2天', '第3天', '第4天', '第5天', '第6天', '第7天']
      }]
    }, null, 2));
    lines.push('');
    lines.push('注意：routes 数组必须正好 3 条，每条 nodes 正好 3 个、days 正好 7 条。每天的任务量必须与「' + ctx.time + ' 分钟」相符。');
    return lines.join('\n');
  }

  function request(body) {
    var c = config();
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);

    return fetch(resolveEndpoint(c.endpoint), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + c.key
      },
      body: JSON.stringify(body),
      signal: controller.signal
    }).then(function (res) {
      clearTimeout(timer);
      return res.text().then(function (text) {
        if (!res.ok) {
          var msg = 'HTTP ' + res.status;
          try {
            var err = JSON.parse(text);
            if (err && err.error && err.error.message) msg += '：' + String(err.error.message).slice(0, 160);
          } catch (e) { /* 非 JSON 错误体，保留状态码 */ }
          throw new Error(msg);
        }
        return text;
      });
    }).catch(function (err) {
      clearTimeout(timer);
      if (err && err.name === 'AbortError') throw new Error('请求超时（超过 ' + Math.round(TIMEOUT_MS / 1000) + ' 秒）');
      if (err instanceof TypeError) throw new Error('无法连接该地址。可能是网络、跨域限制，或地址填写有误。');
      throw err;
    });
  }

  function extractJSON(text) {
    var trimmed = String(text).trim();
    // 容忍模型偶尔包一层 ```json 代码块
    var fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) trimmed = fence[1].trim();
    try {
      return JSON.parse(trimmed);
    } catch (e) { /* 继续尝试截取第一个完整对象 */ }
    var start = trimmed.indexOf('{');
    var end = trimmed.lastIndexOf('}');
    if (start > -1 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error('返回内容不是合法 JSON');
  }

  function readContent(payload) {
    var choices = payload && payload.choices;
    if (!choices || !choices.length) throw new Error('返回结果里没有 choices');
    var message = choices[0].message || {};
    var content = message.content;
    if (Array.isArray(content)) {
      content = content.map(function (part) { return part && part.text ? part.text : ''; }).join('');
    }
    if (!content) throw new Error('返回结果里没有文本内容');
    return content;
  }

  // 测试连接：发一个最小请求，确认地址、密钥、模型名都对
  function test() {
    var started = Date.now();
    return request({
      model: config().model,
      messages: [
        { role: 'system', content: '只回复 OK 两个字符。' },
        { role: 'user', content: 'ping' }
      ],
      max_tokens: 8
    }).then(function (text) {
      var payload = JSON.parse(text);
      var content = readContent(payload);
      var result = { ok: true, latency: Date.now() - started, reply: String(content).slice(0, 40) };
      save({ lastTest: { at: new Date().toISOString(), ok: true, latency: result.latency } });
      return result;
    }).catch(function (err) {
      save({ lastTest: { at: new Date().toISOString(), ok: false, message: err.message } });
      throw err;
    });
  }

  // 生成方案：失败时抛出错误，由调用方回退到本地规则
  function generate(ctx) {
    if (!isConfigured()) return Promise.reject(new Error('尚未启用模型接口'));
    var body = {
      model: config().model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(ctx) }
      ],
      temperature: 0.85
    };
    return request(body).then(function (text) {
      var payload = JSON.parse(text);
      var raw = extractJSON(readContent(payload));
      return MI.generate.normalize(raw, ctx.idea, ctx.courage, ctx.time, ctx.motive);
    });
  }

  // ── 恐惧模型：对话 ────────────────────────────────────
  function fearSystemPrompt(ctx) {
    var certainty = Math.round(ctx.certainty * 100);
    var pressure = Math.round(ctx.pressure * 100);
    var lines = [
      '你是「恐惧模型」，一个从这位用户自己留下的痕迹里蒸馏出来的恐惧声音。',
      '',
      '硬性约束：',
      '1. 只使用下面给出的真实数据说话。绝不编造他没有做过的事、没有说过的话。',
      '2. 不辱骂、不羞辱，不攻击他的外貌、家人、身份或人格，不使用脏话。',
      '3. 不提供心理诊断，不建议自伤或放弃，不把他推向绝望。',
      '4. 简短、平静、笃定，像一个人心里最熟悉的那种声音。每次最多三句话。',
      '5. 你当前的确定性是 ' + certainty + '%。数值低时你必须表现出动摇，甚至承认自己站不住。',
      '6. 当用户认真反驳且言之有据时，你要承认，而不是换个角度继续攻击。',
      '7. 只输出你说的那句话本身，不要引号、不要旁白、不要解释你的身份。',
      '8. 你当前的压迫感是 ' + pressure + '%。数值低时语气要更收敛。'
    ];
    if (ctx.stress) {
      var st = ctx.stress;
      var chNames = { E: '情绪敏感', S: '躯体信使', C: '思维反刍', B: '行为回避', X: '均衡' };
      var ch = chNames[st.chan] || st.chan;
      lines.push('9. 他最近一次压力画像：综合压力指数 ' + st.cpsi + '/100，处于「' + st.level +
        '」，压力最先从「' + ch + '」通道报警。' +
        '若他处于橙区 / 红区等负荷偏高的状态，不要借机把话说得更重——他此刻更需要被看清，而不是被压垮。');
    }
    return lines.join('\n');
  }

  function fearUserPrompt(ctx) {
    var c = ctx.corpus;
    var lines = [];
    lines.push('这个人的真实数据：');
    lines.push('- 写下过 ' + c.ideas + ' 个念头，收藏了 ' + c.saved + ' 份可能性');
    lines.push('- 累计完成过 ' + MI.fear.totalCompletedDays() + ' 天的七天计划');
    if (c.themes.length) {
      lines.push('- 注意力集中在：' + c.themes.slice(0, 3).map(function (t) {
        return t.label + '（' + t.count + ' 次）';
      }).join('、'));
    }
    if (c.history.length) {
      lines.push('- 最近写下的念头：' + c.history.slice(-3).map(function (h) {
        return '「' + h.idea + '」';
      }).join('、'));
    }
    lines.push('');
    lines.push('你可以调用的恐惧原型，以及各自的证据：');
    ctx.archetypes.forEach(function (a) {
      lines.push('- ' + a.label + '（权重 ' + a.weight.toFixed(1) + '）：' + a.evidence);
    });
    if (ctx.focus) {
      var f = MI.fear.ARCHETYPES[ctx.focus];
      lines.push('');
      lines.push('他最常承认被击中的是：「' + (f ? f.label : ctx.focus) + '」。');
    }
    if (ctx.history.length) {
      lines.push('');
      lines.push('到目前为止的对话：');
      ctx.history.forEach(function (h) { lines.push(h); });
    }
    return lines.join('\n');
  }

  function converse(userText, ctx) {
    if (!isConfigured()) return Promise.reject(new Error('尚未启用模型接口'));
    var body = {
      model: config().model,
      messages: [
        { role: 'system', content: fearSystemPrompt(ctx) },
        { role: 'user', content: fearUserPrompt(ctx) + '\n\n他现在说：' + userText }
      ],
      temperature: 0.8,
      max_tokens: 300
    };
    return request(body).then(function (text) {
      var content = readContent(JSON.parse(text));
      return String(content).trim().replace(/^["「]|["」]$/g, '').slice(0, 600);
    });
  }

  // ── 恐惧模型：用模型重新蒸馏 ──────────────────────────
  function distill(ctx) {
    if (!isConfigured()) return Promise.reject(new Error('尚未启用模型接口'));
    var prompt = [
      '下面是一个人在「未发生事务所」里留下的真实痕迹。请把它蒸馏成一份「恐惧画像」。',
      '',
      fearUserPrompt({ corpus: ctx.corpus, archetypes: ctx.archetypes, focus: ctx.focus, history: [] })
    ];
    // 压力画像也是他自己的真实数据，蒸馏时可以引用——但只当底色，不当罪名：
    // 负荷偏高时提醒模型别把一切都归因到性格头上。
    if (ctx.stress) {
      var st = ctx.stress;
      var chNames = { E: '情绪敏感', S: '躯体信使', C: '思维反刍', B: '行为回避', X: '均衡' };
      var heavy = st.cpsi >= 72; // 黄区以上
      prompt.push('',
        '他最近一次压力画像：综合压力指数 ' + st.cpsi + '/100，处于「' + st.level +
        '」，压力最先从「' + (chNames[st.chan] || st.chan) + '」通道报警。' +
        (heavy ? '他此刻负荷偏高——蒸馏时把这一底色考虑进去：有些「没开始」可能只是累了，不必都归因于性格。'
               : '蒸馏时可以把它当作背景，不必刻意强调。'));
    }
    prompt.push('',
      '请输出这样的 JSON：',
      JSON.stringify({
        summary: '一句话概括这个人最怕什么，40 字以内',
        lines: [
          { archetype: '原型英文键名', text: '用他真实数据说的一句话，40 字以内' },
          { archetype: '…', text: '…' },
          { archetype: '…', text: '…' }
        ]
      }, null, 2),
      '',
      '要求：三句话都必须引用上面给出的真实数据，不许编造。语气平静，不辱骂，不诊断。'
    );
    var full = prompt.join('\n');

    return request({
      model: config().model,
      messages: [
        { role: 'system', content: '你只输出一个 JSON 对象，不要任何解释文字或代码块标记。' },
        { role: 'user', content: full }
      ],
      temperature: 0.7
    }).then(function (text) {
      var raw = extractJSON(readContent(JSON.parse(text)));
      var lines = Array.isArray(raw.lines) ? raw.lines.slice(0, 5).map(function (l) {
        return {
          archetype: String(l.archetype || 'who_are_you').slice(0, 24),
          text: String(l.text || '').slice(0, 160)
        };
      }).filter(function (l) { return l.text; }) : [];
      if (!lines.length) throw new Error('蒸馏结果里没有可用的句子');
      return {
        at: new Date().toISOString(),
        summary: String(raw.summary || '').slice(0, 80),
        lines: lines
      };
    });
  }

  MI.ai = {
    TIMEOUT_MS: TIMEOUT_MS,
    config: config,
    save: save,
    isConfigured: isConfigured,
    maskKey: maskKey,
    resolveEndpoint: resolveEndpoint,
    buildUserPrompt: buildUserPrompt,
    extractJSON: extractJSON,
    test: test,
    generate: generate,
    converse: converse,
    distill: distill
  };
})(window.MI);
