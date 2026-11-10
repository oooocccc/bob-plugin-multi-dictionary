/*
 * 10-utils.js — 纯函数工具集（无网络、无 DOM、无 Node 依赖）
 */
var BD = BD || {};

BD.isString = function (v) { return typeof v === 'string'; };

BD.trim = function (s) {
  if (!BD.isString(s)) { return ''; }
  return s.replace(/[\u00a0\u200b\u200c\u200d\ufeff]/g, ' ')
          .replace(/\s+/g, ' ')
          .replace(/^\s+|\s+$/g, '');
};

/** IPA 专用：只去首尾空白，内部字符（ˈ ˌ ː . ʊ ɪ …）逐字保留 */
BD.verbatimIpa = function (s) {
  if (!BD.isString(s)) { return ''; }
  return s.replace(/^[\s\u00a0]+|[\s\u00a0]+$/g, '');
};

/** 释义清洗：折叠空白、移除 CEFR 等级 / 语法标签 / 考试标签 */
BD.cleanDef = function (s) {
  var t = BD.trim(s);
  if (!t) { return ''; }
  t = t.replace(/^(?:A1|A2|B1|B2|C1|C2)\s*(?:\[[^\]]*\]\s*)*/g, '');
  t = t.replace(/^(?:\[[^\]]*\]\s*)+/g, '');
  t = t.replace(/(中考|高考|考研|雅思|托福|四级|六级|专四|专八)\s*[-·:：]?\s*/g, '');
  t = t.replace(/\b(?:IELTS|TOEFL|GRE|CET\s?[46]|SAT|GMAT)\b\s*[-·:：]?\s*/gi, '');
  return BD.trim(t);
};

BD.dedupe = function (arr) {
  var out = [], seen = Object.create(null);
  for (var i = 0; i < (arr || []).length; i++) {
    var v = arr[i];
    if (!v) { continue; }
    if (seen[v]) { continue; }
    seen[v] = 1; out.push(v);
  }
  return out;
};

/** 查询用 slug：小写、空白转连字符 */
BD.slug = function (text) {
  var t = BD.trim(text).toLowerCase();
  t = t.replace(/[\s_]+/g, '-').replace(/[^a-z0-9\-\u00c0-\u024f']/g, '');
  return t.replace(/\-+/g, '-').replace(/^\-+|\-+$/g, '');
};

BD.displayWord = function (text) { return BD.trim(text).replace(/\s+/g, ' '); };

BD.encodePath = function (s) {
  try { return encodeURIComponent(s); } catch (e) { return s; }
};

BD.absoluteUrl = function (base, path) {
  if (!BD.isString(path) || !path) { return ''; }
  if (/^https?:\/\//i.test(path)) { return path; }
  if (path.indexOf('//') === 0) { return 'https:' + path; }
  if (path.charAt(0) === '/') { return base + path; }
  return base + '/' + path;
};

BD.validAudioUrl = function (url) {
  if (!BD.isString(url) || !/^https?:\/\//i.test(url) || /\s/.test(url)) { return false; }
  return /\.(mp3|ogg|wav|m4a)(\?|$)/i.test(url) || /\/media\//i.test(url);
};

BD.now = function () {
  try { return Date.now(); } catch (e) { return new Date().getTime(); }
};
