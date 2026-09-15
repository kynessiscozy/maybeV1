#!/usr/bin/env bash
# 浏览器验证包装器：ab <子命令...>
#
# 这里把每次调用写进一个共享脚本文件，由 abcli.js 在**同一个**浏览器会话里顺序执行，
# 因此不需要每条断言都重启一次 Chromium。
# 兼容旧用法：ab <子命令...> 之间用 `ab flush` 触发一次真正的执行并打印结果。
NODE="${MI_NODE:-node}"
CLI="${MI_AB_CLI:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/abcli.js}"
export MI_CHROME="${MI_CHROME:-/usr/bin/chromium}"
export MI_PW_PKG="${MI_PW_PKG:-}"
SCRIPT="${MI_AB_SCRIPT:-/tmp/mi-ab-script.tsv}"
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)" || exit 1

if [ "${1:-}" = "flush" ]; then
  [ -f "$SCRIPT" ] || exit 0
  "$NODE" "$CLI" "$SCRIPT"
  rm -f "$SCRIPT"
  exit $?
fi

op="${1:-}"; shift 2>/dev/null || true
case "$op" in
  open|reload|wait|click|scrollintoview|screenshot|setviewport) ;;
  # 断言用的 eval：结果以 #VAL 返回，参与逐条比对
  eval) op="eval" ;;
  # 驱动用的 eval（切 hash、点按钮等）：结果不参与比对，避免打乱顺序
  deval) op="deval" ;;
  errors) ;;
  close) rm -f "$SCRIPT"; exit 0 ;;
  set)
    # 旧用法是 `ab set viewport W H`，丢掉中间那个词
    if [ "${1:-}" = "viewport" ]; then shift; fi
    op="setviewport" ;;
  *) echo "ab: 未知子命令 $op" >&2; exit 2 ;;
esac

mkdir -p "$(dirname "$SCRIPT")"
if [ "$op" = "eval" ] || [ "$op" = "deval" ]; then
  printf '%s\t%s\n' "$op" "$(printf '%s' "$1" | "$NODE" -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.stringify(s)))')" >> "$SCRIPT"
else
  printf '%s\t%s\n' "$op" "$*" >> "$SCRIPT"
fi
