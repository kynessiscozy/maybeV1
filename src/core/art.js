window.MI = window.MI || {};
(function (MI) {
  'use strict';
  /* 全站插图只保留这三张，全部是手写内联 SVG —— 取代原来的 JPEG base64：
     - 三张 JPEG 约占构建产物的 40%，换成 SVG 后缩到几 KB；
     - 线稿与纸面美学同源，任意尺寸不糊；
     - MI.figure 里编成 data:image/svg+xml 塞进 <img>，依旧零外部请求。
     加图之前先问一句：这张图是在替代内容，还是只是陪衬？
     只有前者值得付体积。
       archive —— 档案柜空状态（三封尚未写上名字的信）
       missing —— 路由 404（虚线小路消失在纸上）
       help    —— 使用说明弹层（摊开的小册子，夹着一片叶子） */

  var INK = '#7d8a70';       // 主线：灰绿
  var INK_SOFT = '#a9b39a';  // 次线
  var FAINT = '#dfe3d2';     // 极浅
  var PAPER = '#fffef8';     // 纸面
  var ACCENT = '#c96939';    // 强调：橙红
  var ACCENT_SOFT = '#e5b294';

  var NS = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 280">';
  var NSE = '</svg>';

  // 点缀：小十字星与圆点，让空白处有呼吸
  function spark(x, y, s, color, op) {
    s = s || 7;
    return '<g stroke="' + (color || INK_SOFT) + '" stroke-width="2" stroke-linecap="round" opacity="' + (op || 0.55) + '">' +
      '<line x1="' + (x - s) + '" y1="' + y + '" x2="' + (x + s) + '" y2="' + y + '"/>' +
      '<line x1="' + x + '" y1="' + (y - s) + '" x2="' + x + '" y2="' + (y + s) + '"/></g>';
  }
  function dot(x, y, r, color, op) {
    return '<circle cx="' + x + '" cy="' + y + '" r="' + (r || 3) + '" fill="' + (color || INK_SOFT) + '" opacity="' + (op || 0.4) + '"/>';
  }

  // 一封信：信封 + 封口折线，可贴一张空白姓名条
  function letter(x, y, w, h, rot, nameless) {
    var cx = x + w / 2, cy = y + h / 2;
    var g = '<g transform="rotate(' + rot + ' ' + cx + ' ' + cy + ')">' +
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="5" fill="' + PAPER + '" stroke="' + INK + '" stroke-width="2.4"/>' +
      '<path d="M ' + x + ' ' + (y + 4) + ' L ' + cx + ' ' + (cy + 2) + ' L ' + (x + w) + ' ' + (y + 4) + '" fill="none" stroke="' + INK + '" stroke-width="2" opacity="0.75"/>';
    if (nameless) {
      // 姓名条：一条浅底和两条占位短线——名字还没写
      g += '<rect x="' + (x + w * 0.22) + '" y="' + (y + h * 0.52) + '" width="' + w * 0.56 + '" height="' + h * 0.3 + '" rx="3" fill="' + FAINT + '"/>' +
        '<line x1="' + (x + w * 0.3) + '" y1="' + (y + h * 0.67) + '" x2="' + (x + w * 0.7) + '" y2="' + (y + h * 0.67) + '" stroke="' + INK_SOFT + '" stroke-width="1.6" opacity="0.5"/>';
    }
    return g + '</g>';
  }

  MI.art = {};

  // ── 档案柜空状态：柜顶叠着三封没写名字的信 ─────────────
  MI.art.archive = [
    NS,
    // 地面
    '<line x1="84" y1="240" x2="336" y2="240" stroke="' + FAINT + '" stroke-width="4" stroke-linecap="round"/>',
    // 柜身
    '<rect x="126" y="66" width="168" height="170" rx="10" fill="' + PAPER + '" stroke="' + INK + '" stroke-width="2.6"/>',
    '<line x1="126" y1="152" x2="294" y2="152" stroke="' + INK + '" stroke-width="2.2" opacity="0.85"/>',
    // 两层抽屉把手
    '<rect x="192" y="102" width="36" height="9" rx="4.5" fill="' + INK_SOFT + '"/>',
    '<rect x="192" y="188" width="36" height="9" rx="4.5" fill="' + INK_SOFT + '"/>',
    // 下层抽屉微微拉开
    '<path d="M 126 222 L 294 222 L 294 240 L 108 240 Z" fill="' + PAPER + '" stroke="' + INK + '" stroke-width="2.2"/>',
    '<rect x="184" y="224" width="36" height="9" rx="4.5" fill="' + ACCENT_SOFT + '"/>',
    // 三封信：一封立着的、两封斜靠，中间那封贴着空白姓名条
    letter(140, 22, 92, 58, -7, false),
    letter(232, 18, 92, 58, 9, false),
    letter(186, 34, 96, 60, -1, true),
    // 呼吸
    spark(70, 96, 7), spark(352, 76, 6), dot(62, 190, 3), dot(356, 160, 3.5, ACCENT, 0.45), spark(340, 208, 5, ACCENT, 0.5),
    NSE
  ].join('');

  // ── 404：一条虚线小路，走着走着消失在纸上 ──────────────
  MI.art.missing = [
    NS,
    // 一张纸
    '<rect x="44" y="26" width="332" height="230" rx="14" fill="' + PAPER + '" stroke="' + INK_SOFT + '" stroke-width="2.2"/>',
    // 小路：从左下角出发向右上蜿蜒，越远越淡
    '<path d="M 78 226 C 150 214 118 172 186 152 C 246 134 296 128 318 92" fill="none" stroke="' + ACCENT + '" stroke-width="3.2" stroke-linecap="round" stroke-dasharray="1 13"/>',
    '<path d="M 318 92 C 326 78 330 70 334 60" fill="none" stroke="' + ACCENT + '" stroke-width="3.2" stroke-linecap="round" stroke-dasharray="1 12" opacity="0.5"/>',
    '<path d="M 334 60 C 338 52 340 46 342 40" fill="none" stroke="' + ACCENT + '" stroke-width="3" stroke-linecap="round" stroke-dasharray="1 10" opacity="0.25"/>',
    // 起点：一枚脚印般的圆点
    '<circle cx="78" cy="226" r="5" fill="' + ACCENT + '" opacity="0.8"/>',
    // 消失处：一个越来越淡的问号
    '<text x="352" y="52" font-family="Georgia, serif" font-size="30" fill="' + ACCENT + '" opacity="0.55" text-anchor="middle">?</text>',
    // 呼吸
    spark(120, 66, 7), spark(296, 214, 6), dot(96, 120, 3), dot(262, 70, 3.5, ACCENT, 0.35),
    NSE
  ].join('');

  // ── 使用说明：摊开的小册子，中缝夹着一片叶子 ───────────
  MI.art.help = (function () {
    // 左右两页：对称的圆角四边形
    var page = function (dir) {
      // dir: -1 左页，1 右页
      var x1 = 210 + dir * 6, y1 = 74;
      var x2 = 210 + dir * 138, y2 = 88;
      var x3 = 210 + dir * 138, y3 = 208;
      var x4 = 210 + dir * 6, y4 = 196;
      return '<path d="M ' + x1 + ' ' + y1 + ' L ' + x2 + ' ' + y2 + ' L ' + x3 + ' ' + y3 + ' L ' + x4 + ' ' + y4 + ' Z" ' +
        'fill="' + PAPER + '" stroke="' + INK + '" stroke-width="2.4" stroke-linejoin="round"/>';
    };
    // 页内占位横线
    function lines(dir) {
      var out = '';
      for (var i = 0; i < 4; i++) {
        var y = 108 + i * 20;
        var x1 = 210 + dir * 22, x2 = 210 + dir * (i === 3 ? 92 : 116);
        out += '<line x1="' + x1 + '" y1="' + y + '" x2="' + x2 + '" y2="' + (y + (dir * -3)) + '" stroke="' + FAINT + '" stroke-width="4" stroke-linecap="round" opacity="0.9"/>';
      }
      return out;
    }
    // 叶子书签：从书口垂下来
    var leaf = '<g transform="rotate(14 210 200)">' +
      '<path d="M 210 196 C 224 208 226 226 212 240 C 198 228 197 210 210 196 Z" fill="' + PAPER + '" stroke="' + ACCENT + '" stroke-width="2.2"/>' +
      '<line x1="211" y1="202" x2="212" y2="234" stroke="' + ACCENT + '" stroke-width="1.6" opacity="0.7"/>' +
      '</g>';
    return [
      NS,
      page(-1), page(1),
      lines(-1), lines(1),
      // 中缝
      '<line x1="210" y1="74" x2="210" y2="196" stroke="' + INK + '" stroke-width="2.4" opacity="0.85"/>',
      // 书下沿的阴影线
      '<path d="M 78 214 C 130 224 176 226 210 224 C 244 226 290 224 342 214" fill="none" stroke="' + FAINT + '" stroke-width="4" stroke-linecap="round"/>',
      leaf,
      spark(88, 108, 7), spark(330, 132, 6), dot(104, 172, 3), dot(322, 92, 3.5, ACCENT, 0.4),
      NSE
    ].join('');
  })();

  MI.figure = function (name, alt, extra) {
    var src = MI.art[name];
    if (!src) return '';
    var cls = 'illu illu-' + name + (extra ? ' ' + extra : '');
    // 手写 SVG 源码在这里编成 data URI：单引号属性 + encodeURIComponent，
    // 产物里依旧是可读的矢量源码，而不是一大段 base64。
    var uri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
    return '<figure class="' + cls + '">' +
      '<img src="' + uri + '" alt="' + (alt || '') + '"></figure>';
  };
})(window.MI);
