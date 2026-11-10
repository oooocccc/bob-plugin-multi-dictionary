/*
 * 50-aggregate.js — 单源查询编排与词性分组
 * 只查询 Cambridge Dictionary；未收录或失败直接返回简洁错误，不做其它兜底。
 */
var BD = BD || {};

BD.aggregate = (function () {
  var POS_MAP = {
    'noun': 'n.', 'verb': 'v.', 'adjective': 'adj.', 'adverb': 'adv.',
    'preposition': 'prep.', 'pronoun': 'pron.', 'conjunction': 'conj.',
    'interjection': 'interj.', 'numeral': 'num.', 'article': 'art.',
    'exclamation': 'interj.', 'phrasal verb': 'phr.v.'
  };

  function posKey(p) {
    return BD.trim(p).toLowerCase().replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ');
  }

  /** 一个词性下的中文译义：按分号拆成独立义项、去重、保留语义区别 */
  function buildParts(senses) {
    var map = Object.create(null), order = [];
    for (var i = 0; i < senses.length; i++) {
      var s = senses[i], k = posKey(s.pos);
      if (!k) { continue; }
      if (!map[k]) { map[k] = []; order.push(k); }
      var items = String(s.zh).split(/[;；]/);
      for (var j = 0; j < items.length; j++) {
        var t = BD.cleanDef(items[j]);
        if (t) { map[k].push(t); }
      }
    }
    return order.map(function (k) {
      return {
        key: k,
        label: POS_MAP[k] || k,
        means: BD.dedupe(map[k]).slice(0, 6)
      };
    }).filter(function (p) { return p.means.length > 0; });
  }

  /** 英式在前、美式在后；同一 (口音, IPA, 音频) 去重 */
  function buildPhonetics(list) {
    var out = [], seen = Object.create(null);
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      var key = p.accent + '|' + p.ipa + '|' + p.audioUrl;
      if (seen[key]) { continue; }
      seen[key] = 1;
      out.push(p);
    }
    out.sort(function (a, b) { return a.accent === b.accent ? 0 : (a.accent === 'uk' ? -1 : 1); });
    return out;
  }

  function missingAccents(phonetics) {
    var missing = [];
    var accents = ['uk', 'us'], names = { uk: '英式', us: '美式' };
    for (var i = 0; i < accents.length; i++) {
      var a = accents[i], hasIpa = false, hasAudio = false;
      for (var j = 0; j < phonetics.length; j++) {
        if (phonetics[j].accent !== a) { continue; }
        if (phonetics[j].ipa) { hasIpa = true; }
        if (phonetics[j].audioUrl) { hasAudio = true; }
      }
      if (!hasIpa) { missing.push(names[a] + ' IPA'); }
      if (!hasAudio) { missing.push(names[a] + '发音音频'); }
    }
    return missing;
  }

  /**
   * @param {object} ctx {word, slug, displayWord}
   * @param {function} done (err, merged)；err = {type, message}
   */
  function lookup(ctx, done) {
    var hit = BD.cache.get(ctx.slug);
    if (hit) {
      if (hit.error) { done(hit.error); return; }
      done(null, hit.result);
      return;
    }

    BD.sources.cambridge.fetch(ctx, function (rec) {
      if (!rec || rec.status !== 'ok') {
        var error = {
          type: rec && rec.status === 'notFound' ? 'notFound' : 'api',
          message: rec && rec.status === 'notFound' ? '未收录该单词' : '词典暂时不可用，请稍后重试'
        };
        BD.cache.set(ctx.slug, { error: error }, false);
        done(error);
        return;
      }
      var phonetics = buildPhonetics(rec.phonetics);
      var parts = buildParts(rec.senses);
      var merged = {
        word: rec.word || ctx.displayWord,
        phonetics: phonetics,
        parts: parts,
        missing: missingAccents(phonetics),
        hasResult: phonetics.length > 0 || parts.length > 0
      };
      BD.cache.set(ctx.slug, { result: merged }, true);
      done(null, merged);
    });
  }

  return { lookup: lookup };
})();
