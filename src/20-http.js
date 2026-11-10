/*
 * 20-http.js — Bob $http 官方 API 薄封装
 * 只使用 $http.request + handler 回调；不使用 fetch / Promise / Node 模块。
 * 错误统一归一化为简洁提示，不向用户暴露技术细节。
 */
var BD = BD || {};

BD.http = (function () {
  function api() {
    try { if (typeof $http !== 'undefined' && $http) { return $http; } } catch (e) {}
    try {
      if (typeof Bob !== 'undefined' && Bob && Bob.api && Bob.api.$http) { return Bob.api.$http; }
    } catch (e2) {}
    return null;
  }

  /**
   * @param {object} o {url, header, timeout(秒), expect:'text'}
   * @param {function} cb (err, data)；err = {type, message}
   */
  function get(o, cb) {
    var h = api();
    if (!h || typeof h.request !== 'function') {
      cb({ type: 'network', message: '网络不可用' });
      return;
    }
    var called = false;
    var finish = function (err, data) {
      if (called) { return; }
      called = true;
      cb(err, data);
    };

    try {
      h.request({
        method: 'GET',
        url: o.url,
        timeout: o.timeout || BD.SOURCE_TIMEOUT,
        header: o.header || {},
        handler: function (resp) {
          if (!resp || resp.error) {
            finish({ type: 'network', message: '网络请求失败，请稍后重试' });
            return;
          }
          var status = 0;
          try { status = (resp.response && Number(resp.response.statusCode)) || 0; } catch (e) {}
          if (status === 404) {
            finish({ type: 'notFound', message: '未收录该单词' });
            return;
          }
          if (status && (status < 200 || status >= 300)) {
            finish({ type: 'network', message: '词典服务暂时不可用' });
            return;
          }
          var data = resp.data;
          /* Bob 一般自动解析 UTF-8 文本；若为 $data 则显式解码 */
          if (data && typeof data === 'object' && typeof data.toUTF8 === 'function') {
            try { data = data.toUTF8(); } catch (e) {}
          }
          if (typeof data !== 'string' || !data) {
            finish({ type: 'api', message: '未获取到词典数据' });
            return;
          }
          finish(null, data);
        }
      });
    } catch (e) {
      finish({ type: 'network', message: '网络请求失败，请稍后重试' });
    }
  }

  return { get: get };
})();
