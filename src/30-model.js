/*
 * 30-model.js — 统一词条模型
 *
 * 不变量：
 *  1) ipa 只逐字搬运 Cambridge 原文，禁止推导、转换或补全；
 *  2) IPA 与音频在同一个 .uk/.us 发音块内配对，绝不跨口音；
 *  3) 词义按「词条 → 词性 → def-block」归属，短语/习语块不属于 headword 词性。
 */
var BD = BD || {};

BD.model = (function () {
  function empty() {
    return { word: '', phonetics: [], senses: [], status: 'ok', message: '' };
  }

  function fail(type, message) {
    var r = empty();
    r.status = type || 'error';
    r.message = message || '';
    return r;
  }

  function addPhonetic(rec, accent, ipa, audioUrl, group) {
    if (accent !== 'uk' && accent !== 'us') { return; }
    var text = BD.verbatimIpa(ipa);
    var url = BD.isString(audioUrl) && BD.validAudioUrl(audioUrl) ? audioUrl : '';
    if (!text && !url) { return; }
    for (var i = 0; i < rec.phonetics.length; i++) {
      var p = rec.phonetics[i];
      if (p.accent === accent && p.ipa === text && p.audioUrl === url && p.group === (group || '')) { return; }
    }
    rec.phonetics.push({ accent: accent, ipa: text, audioUrl: url, group: group || '' });
  }

  /** 一个 def-block 对应一条中文译义；pos 来自其所属 entry，关系明确才录入 */
  function addSense(rec, pos, zh) {
    var p = BD.trim(pos), t = BD.cleanDef(zh);
    if (!p || !t) { return; }
    rec.senses.push({ pos: p, zh: t });
  }

  return { empty: empty, fail: fail, addPhonetic: addPhonetic, addSense: addSense };
})();
