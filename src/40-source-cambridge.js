/*
 * 40-source-cambridge.js — Cambridge Dictionary HTML 解析器（唯一数据源）
 *
 * 页面结构（dictionary.cambridge.org/zhs/词典/英语-汉语-简体/<slug>）：
 *
 *  <div class="pr entry-body__el">                    ← 一个词性词条
 *    <div class="pos-header dpos-h">
 *      <span class="headword"><span class="hw dhw">main</span></span>
 *      <div class="posgram"><span class="pos">adjective</span></div>
 *      <span class="uk dpron-i ">                     ← 英式发音块
 *        <span class="daud"><audio><source type="audio/mpeg" src="/.../uk_pron/...mp3"></audio></span>
 *        <span class="pron dpron">/<span class="ipa dipa">meɪn</span>/</span>
 *      </span>
 *      <span class="us dpron-i "> ... </span>         ← 美式发音块
 *    </div>
 *    <div class="dsense"><div class="def-block ddef_block">
 *      <div class="ddef_h">A1 [ adj ] ...</div>
 *      <div class="def-body ddef_b"><span class="trans" lang="zh-Hans">主要的</span></div>
 *    </div></div>
 *  </div>
 *
 * 关键规则：
 *  - IPA 取 .pron 完整文本（含 /…/、ˈ ˌ . ː），只做首尾空白裁剪；
 *  - 音频与 IPA 在同一个 .uk/.us 块内配对；
 *  - 只取 .entry-body__el 内、且不在 .phrase-block（习语/短语）中的 def-block，
 *    因为短语释义属于另一个词条，词性对应关系不可确认，必须舍弃；
 *  - 未收录时站点会 302 到无 headword 的词典首页 → notFound。
 */
var BD = BD || {};
BD.sources = BD.sources || {};

(function () {
  var SRC = 'cambridge';

  function loadFn() {
    try {
      if (typeof BobDictCheerio !== 'undefined' && BobDictCheerio && BobDictCheerio.load) {
        return BobDictCheerio.load;
      }
    } catch (e) {}
    return null;
  }

  function firstText($, root, selectors) {
    for (var i = 0; i < selectors.length; i++) {
      var el = root ? $(selectors[i], root).first() : $(selectors[i]).first();
      if (el && el.length) {
        var t = BD.trim(el.text());
        if (t) { return t; }
      }
    }
    return '';
  }

  function cleanPos(s) {
    return BD.trim(s.replace(/\[[^\]]*\]/g, ' ')).replace(/\s+/g, ' ');
  }

  function readPron($, $block) {
    var ipa = firstText($, $block, ['.pron', '.pron .ipa', '.ipa']);
    var audioSrc = '';
    var $src = $block.find('source[type="audio/mpeg"]').first();
    if (!$src.length) { $src = $block.find('source').first(); }
    if ($src.length) { audioSrc = $src.attr('src') || ''; }
    if (audioSrc) { audioSrc = BD.absoluteUrl(BD.ENDPOINTS.cambridge, audioSrc); }
    return { ipa: BD.verbatimIpa(ipa), audioUrl: audioSrc };
  }

  function parseHtml(html, rec) {
    var load = loadFn();
    if (!load) { return BD.model.fail('error', '词典数据解析失败'); }

    var $;
    try { $ = load(html); }
    catch (e) { return BD.model.fail('error', '词典数据解析失败'); }

    var headword = firstText($, null, ['.headword .hw', '.headword', 'h1.hw', '.di-title .hw']);
    if (!headword) { return BD.model.fail('notFound', '未收录该单词'); }
    rec.word = headword;

    var $entries = $('.entry-body__el');
    if (!$entries.length) { $entries = $('[class*="entry-body__el"]'); }
    if (!$entries.length) { return BD.model.fail('error', '词典页面结构无法识别'); }

    $entries.each(function (entryIndex, entry) {
      var $entry = $(entry);
      var pos = cleanPos(firstText($, $entry, ['.posgram', '.anc-info-head', '.pos-header .pos']));
      if (!pos) { return; }   /* 词性无法确认 → 舍弃该词条全部释义 */

      /* 读音分组：同一 entry 出现第二组 uk 时说明是不同读音（如 read /riːd/ 与 /red/） */
      var $pronBlocks = $entry.find('.uk.dpron-i, .us.dpron-i');
      var groupIndex = 0, lastAccent = '', group = pos;
      $pronBlocks.each(function (i, block) {
        var $b = $(block);
        var accent = $b.hasClass('uk') ? 'uk' : ($b.hasClass('us') ? 'us' : '');
        if (!accent) { return; }
        if (accent === 'uk' && lastAccent === 'us') { groupIndex++; }
        lastAccent = accent;
        group = groupIndex > 0 ? (pos + '（读音 ' + (groupIndex + 1) + '）') : pos;
        var p = readPron($, $b);
        BD.model.addPhonetic(rec, accent, p.ipa, p.audioUrl, group);
      });

      /* 只取属于该词条本身、且中文译义存在的 def-block */
      $entry.find('.def-block').each(function (j, def) {
        var $d = $(def);
        if ($d.parents('.phrase-block, .dphrase-block, .idiom-block, .phrase-head').length) { return; }
        var $zh = $d.find('.ddef_b').first().children('.trans').first();
        if (!$zh.length) { return; }
        var zh = BD.cleanDef($zh.text());
        if (!zh) { return; }
        BD.model.addSense(rec, pos, zh);
      });
    });

    if (!rec.phonetics.length && !rec.senses.length) {
      return BD.model.fail('error', '词典页面结构无法识别');
    }
    rec.status = 'ok';
    return rec;
  }

  BD.sources.cambridge = {
    fetch: function (ctx, cb) {
      var url = BD.ENDPOINTS.cambridge + BD.ENDPOINTS.cambridgePath + BD.encodePath(ctx.slug);
      BD.http.get({
        url: url,
        timeout: BD.SOURCE_TIMEOUT,
        header: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
        }
      }, function (err, html) {
        if (err) { cb(BD.model.fail(err.type, err.message)); return; }
        cb(parseHtml(html, BD.model.empty()));
      });
    }
  };
})();
