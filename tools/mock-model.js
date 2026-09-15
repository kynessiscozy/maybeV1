const http = require('http');

/* 本地假的 OpenAI 兼容服务，用来端到端验证模型接口：
   不需要真实密钥，也能确认请求构造、鉴权头、超时、错误处理和回退路径。 */

const PORT = Number(process.argv[2] || 4399);
const MODE = process.argv[3] || 'ok';

// 版本戳：验证脚本据此判断跑着的是不是当前这份代码。
// 之前只判断「端口通不通」，结果改了 mock 之后旧进程还在，
// 回退用例永远测不出来，看起来像应用坏了。
const VERSION = '3';

const plan = {
  themeLabel: '独立创作',
  routes: [0, 1, 2].map((i) => ({
    description: '模型生成的第 ' + (i + 1) + ' 条路线定位说明，用来验证结构校验与渲染。',
    nodes: [0, 1, 2].map((j) => ({
      title: '模型节点' + (i + 1) + '-' + (j + 1),
      code: 'MODEL NODE ' + (i + 1) + (j + 1),
      advice: '这是模型给出的建议文本，用于确认节点卡片能正确显示外部内容。'
    })),
    days: [0, 1, 2, 3, 4, 5, 6].map((d) => '模型第 ' + (d + 1) + ' 天任务')
  }))
};

http.createServer((req, res) => {
  // 浏览器直连第三方接口会受 CORS 限制，这里补上跨域头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  // 探针：让验证脚本能确认端口后面跑的是当前版本，而不是上一次的残留进程。
  if (req.url === '/__version') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end(VERSION);
  }

  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    const auth = req.headers.authorization || '';
    const record = {
      url: req.url,
      method: req.method,
      authOK: /^Bearer .+/.test(auth),
      authPrefix: auth.slice(0, 12),
      hasSystem: body.includes('路线设计师'),
      hasMemory: body.includes('长期记忆'),
      hasFeedback: body.includes('反馈'),
      bodyLen: body.length
    };
    console.log('REQ ' + JSON.stringify(record));

    // 应用侧的「失败回退」用例会打一个不存在的路径。
    // 之前这里对任何路径都回 200，那条用例就永远测不出回退。
    if (/notexist/.test(req.url)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: { message: 'Not Found' } }));
    }

    if (MODE === 'unauthorized') {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: { message: 'Incorrect API key provided' } }));
    }
    if (MODE === 'badjson') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ choices: [{ message: { content: '这不是 JSON' } }] }));
    }
    if (MODE === 'slow') {
      return setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(plan) } }] }));
      }, 120000);
    }
    if (MODE === 'fenced') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        choices: [{ message: { content: '```json\n' + JSON.stringify(plan) + '\n```' } }]
      }));
    }

    const isPing = body.includes('ping');
    // 蒸馏要的是「几句从用户记录里长出来的话」，结构与路线方案完全不同。
    // 之前这里一律回路线方案，应用侧校验不过就静默保持 distilled=null，
    // 看起来像蒸馏坏了。按请求意图分流。
    const isDistill = /恐惧|fear|distill|蒸馏/i.test(body) && !body.includes('路线设计师');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (isDistill) {
      return res.end(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              summary: '这是本地模拟服务返回的蒸馏摘要，用于端到端验证。',
              // 应用侧要求每条是 { archetype, text } 对象；给纯字符串会被判为无可用句子
              lines: [
                { archetype: 'you_will_quit', text: '你怕的其实不是失败，是被人看见你还没准备好。' },
                { archetype: 'no_one_cares', text: '你把「再等等」说成了「我不急」。' },
                { archetype: 'not_good_enough', text: '你真的动手的时候，从不告诉任何人。' }
              ],
              focus: 'you_will_quit'
            })
          }
        }]
      }));
    }
    res.end(JSON.stringify({
      choices: [{ message: { content: isPing ? 'OK' : JSON.stringify(plan) } }]
    }));
  });
}).listen(PORT, () => console.log('mock model server on http://localhost:' + PORT + ' mode=' + MODE));
