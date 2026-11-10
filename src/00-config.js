/*
 * Bob Multi Dictionary — 全局常量与配置
 * 单数据源（Cambridge Dictionary）英语查词插件。
 * 运行环境为 macOS JavaScriptCore；所有模块共享 BD 命名空间，不使用模块系统。
 * 版本与插件标识符由 build.js 从 package.json 注入。
 */
var BD = BD || {};

BD.VERSION = '__BUILD_VERSION__';
BD.PLUGIN_ID = '__BUILD_PLUGIN_ID__';

BD.ENDPOINTS = {
  cambridge: 'https://dictionary.cambridge.org',
  cambridgePath: '/zhs/%E8%AF%8D%E5%85%B8/%E8%8B%B1%E8%AF%AD-%E6%B1%89%E8%AF%AD-%E7%AE%80%E4%BD%93/'
};

BD.SOURCE_TIMEOUT = 8;                 /* Bob $http timeout，单位秒 */
BD.CACHE_TTL = { ok: 30 * 60 * 1000, fail: 60 * 1000 };
BD.CACHE_MAX = 120;

/* Bob 会自动给 phonetics.value 加方括号，故默认输出裸 IPA：显示 [meɪn] 而非 [/meɪn/] */
BD.OPT = { ipaBoundary: 'ipaBoundary' };
BD.DEFAULTS = { ipaBoundary: 'bare' };

BD.option = function (name) {
  try {
    var o = (typeof $option !== 'undefined') ? $option : null;
    if (o && o[name] !== undefined && o[name] !== null && o[name] !== '') { return o[name]; }
  } catch (e) { /* ignore */ }
  return BD.DEFAULTS[name];
};
