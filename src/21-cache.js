/*
 * 21-cache.js — 简单内存查询缓存（成功 30 分钟 / 失败 1 分钟负缓存）
 */
var BD = BD || {};

BD.cache = (function () {
  var data = Object.create(null), order = [];

  function get(key) {
    var e = data[key];
    if (!e) { return undefined; }
    if (e.expire <= BD.now()) {
      delete data[key];
      var i = order.indexOf(key);
      if (i >= 0) { order.splice(i, 1); }
      return undefined;
    }
    return e.value;
  }

  function set(key, value, ok) {
    if (!data[key]) { order.push(key); }
    data[key] = { value: value, expire: BD.now() + (ok ? BD.CACHE_TTL.ok : BD.CACHE_TTL.fail) };
    while (order.length > BD.CACHE_MAX) { delete data[order.shift()]; }
  }

  return { get: get, set: set };
})();
