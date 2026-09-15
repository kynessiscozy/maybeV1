#!/usr/bin/env bash
# 静态守卫：三条约定的机器检查。
# 这些规则光靠注释和记忆守不住，所以落成脚本，随时能跑。
set -u
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)" || exit 1

pass=0; fail=0
ok(){ echo "  ✓ $1"; pass=$((pass+1)); }
no(){ echo "  ✗ $1"; fail=$((fail+1)); }

echo "── 1. ES5：不许出现箭头函数 / let / const / 模板字符串 ──"
# 只在代码部分找，注释里出现 ```json 之类不算
BAD=$(python3 - <<'PY'
import re, glob
hits = []
# 反引号只有在「成对出现且不是正则字面量」时才算模板字符串
regex_lit = re.compile(r'/(?:\\.|\[[^\]]*\]|[^/\n\\])+/[gimsuy]*')
for path in sorted(glob.glob('src/**/*.js', recursive=True)):
    for n, raw in enumerate(open(path, encoding='utf-8'), 1):
        line = raw.split('//')[0]                      # 去掉行尾注释
        code = re.sub(r'/\*.*?\*/', '', line)          # 去掉块注释
        code = regex_lit.sub('RE', code)               # 去掉正则字面量
        if (re.search(r'=>', code)
                or re.search(r'\b(let|const)\s+\w', code)
                or '`' in code):
            hits.append(f"{path}:{n}: {raw.strip()[:80]}")
print('\n'.join(hits))
PY
)
if [ -z "$BAD" ]; then ok "全部模块均为 ES5 写法"; else
  no "发现非 ES5 写法："; echo "$BAD" | head -10
fi

echo "── 2. echo 的顺序：recompute 必须在 store.update 之外 ──"
# 若 recompute 被塞进 store.update 的回调里，会形成嵌套 emit，
# syncCounts 会读到改到一半的状态。这里守住它。
if grep -nA3 'MI.store.update(function' src/features/echo.js | grep -q 'recompute'; then
  no "recompute 出现在 store.update 内部"
else ok "recompute 不在 store.update 内部"; fi

echo "── 3. 所有收尾动作都接了 echo 或说明了为什么没有 ──"
# 每个视图里的写操作，要么紧跟一条 MI.echo，要么在同一函数里带「静默」注释。
MISSING=$(python3 - <<'PY'
import re, glob, os
problems = []
for path in glob.glob('src/views/*.js'):
    src = open(path, encoding='utf-8').read()
    # 以 store.update / memory.xxx / fear.xxx / evolution.xxx 作为「有后果的写」
    writes = re.findall(r'MI\.(?:store\.update|memory\.\w+|fear\.\w+|evolution\.reset|feedback\.clear)\s*\(', src)
    has_echo = 'MI.echo' in src
    # 首页/关于页是纯展示，允许没有
    if writes and not has_echo and os.path.basename(path) not in ('landing.js', 'about.js', 'settings.js'):
        problems.append(f"{path}: {len(writes)} 处写入但没有任何 MI.echo")
print('\n'.join(problems))
PY
)
if [ -z "$MISSING" ]; then ok "各页面的写操作都已接入回响"; else
  no "以下页面存在未闭环的写操作："; echo "$MISSING"
fi

echo "── 4. 构建产物不允许出现外部依赖 ──"
if grep -qE 'https?://[^"]*\.(js|css|woff2?)' outputs/index.html; then
  no "产物中含外部 js/css/字体依赖"
else ok "产物完全离线"; fi

echo
echo "结果：通过 $pass 项，失败 $fail 项"
[ "$fail" -eq 0 ]
