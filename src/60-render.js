/*
 * 60-render.js — Bob 原生 toDict 结果映射
 *
 * Bob 官方结构：
 *   toDict.word / phonetics[{type:'uk'|'us', value, tts:{type:'url',value}}]
 *   / parts[{part, means:string[]}] / additions[{name,value}]
 *
 * 展示层规则：
 *  - 原始 IPA 逐字保存在统一模型与 raw.phonetics[].ipa；
 *  - 默认输出裸 IPA（Bob 自动加方括号 → 英 [meɪn]），可选 /.../ 模式；
 *  - 只映射中文释义，不输出英文释义、例句、标签、来源或任何调试信息。
 */
var BD = BD || {};

BD.render = (function () {

  /** 只剥离首尾边界符号（/ [ ] 与空白），IPA 内部字符完全不动 */
  function ipaBody(raw) {
    var s = BD.verbatimIpa(raw);
    if (!s) { return ''; }
    return s.replace(/^[\/\[\s]+/, '').replace(/[\/\]\s]+$/, '');
  }

  /** @param mode 'bare'（默认）| 'slash' */
  function normalizeIpaForDisplay(raw, mode) {
    var body = ipaBody(raw);
    if (!body) { return ''; }
    return mode === 'slash' ? ('/' + body + '/') : body;
  }

  function phoneticObject(p, mode) {
    var display = normalizeIpaForDisplay(p.ipa, mode);
    var o = { type: p.accent };
    if (display) { o.value = display; }
    if (p.audioUrl) { o.tts = { type: 'url', value: p.audioUrl }; }
    if (!display && !o.tts) { return null; }
    return o;
  }

  function build(m) {
    var mode = BD.option(BD.OPT.ipaBoundary);
    if (mode !== 'slash') { mode = 'bare'; }

    var phonetics = [];
    for (var i = 0; i < m.phonetics.length; i++) {
      var obj = phoneticObject(m.phonetics[i], mode);
      if (obj) { phonetics.push(obj); }
    }

    var parts = [];
    for (var j = 0; j < m.parts.length; j++) {
      parts.push({ part: m.parts[j].label, means: m.parts[j].means });
    }

    return {
      from: 'en',
      to: 'zh-Hans',
      toDict: { word: m.word, phonetics: phonetics, parts: parts },
      raw: {
        plugin: BD.PLUGIN_ID,
        version: BD.VERSION,
        ipaBoundaryMode: mode,
        phonetics: m.phonetics.map(function (p) {
          return { accent: p.accent, ipa: p.ipa, displayIpa: normalizeIpaForDisplay(p.ipa, mode),
                   audio: p.audioUrl, group: p.group };
        }),
        missing: m.missing
      }
    };
  }

  return { build: build };
})();
