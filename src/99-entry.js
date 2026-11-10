/*
 * 99-entry.js — Bob 插件入口（全局函数，由 JavaScriptCore 调用）
 * 仅实现 supportLanguages / translate / pluginTimeoutInterval / pluginValidate。
 * 不使用 Promise / fetch / DOM / Node 模块。
 */
var BD = BD || {};

function supportLanguages() {
  return ['auto', 'zh-Hans', 'en'];
}

function pluginTimeoutInterval() {
  return 60;
}

function pluginValidate(completion) {
  completion({ result: true });
}

/**
 * @param {object} query Bob 传入：text / originalText / detectFrom / onCompletion
 * @param {function} completion 旧版 Bob 回调
 */
function translate(query, completion) {
  var once = false;
  var done = function (payload) {
    if (once) { return; }
    once = true;
    try {
      var fn = (query && typeof query.onCompletion === 'function') ? query.onCompletion : completion;
      if (typeof fn === 'function') { fn(payload); }
    } catch (e) { /* ignore */ }
  };

  try {
    if (!query || typeof query !== 'object') {
      done({ error: { type: 'param', message: '查询参数无效' } });
      return;
    }
    var raw = BD.trim(query.originalText || query.text || '');
    if (!raw) {
      done({ error: { type: 'param', message: '查询文本为空' } });
      return;
    }
    if ((query.detectFrom && query.detectFrom !== 'en') ||
        /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(raw)) {
      done({ error: { type: 'unsupportedLanguage', message: '仅支持英文单词查询' } });
      return;
    }
    if (raw.length > 64 || raw.split(/\s+/).length > 3) {
      done({ error: { type: 'notFound', message: '仅支持单个英文单词或短语' } });
      return;
    }

    var ctx = {
      displayWord: BD.displayWord(raw),
      slug: BD.slug(raw)
    };
    if (!ctx.slug) {
      done({ error: { type: 'notFound', message: '未收录该单词' } });
      return;
    }

    BD.aggregate.lookup(ctx, function (err, merged) {
      if (err) { done({ error: { type: err.type, message: err.message } }); return; }
      if (!merged || !merged.hasResult) {
        done({ error: { type: 'notFound', message: '未收录该单词' } });
        return;
      }
      done({ result: BD.render.build(merged) });
    });
  } catch (e) {
    done({ error: { type: 'api', message: '查询失败，请稍后重试' } });
  }
}
