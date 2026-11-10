#!/usr/bin/env node
/*
 * build.js — Bob Multi Dictionary 构建脚本（仅依赖 Node 内置模块）
 *
 *   node build.js                    生成 info.json、release/*.bobplugin
 *   node build.js --appcast          同时把当前版本写入 appcast.json
 *   node build.js --check            语法 / 入口 / 版本一致性检查（不写产物）
 *   node build.js --rebuild-vendor   重新生成 vendor/cheerio.slim.js（需先 npm install）
 *
 * 版本号唯一权威来源：package.json 的 version 字段。
 * 源文件：src/*.js、vendor/cheerio.slim.js、static/icon.png。
 * 生成物：info.json、release/*.bobplugin（安装包内 main.js 由源文件拼接，不落盘）。
 * appcast.json 由 --appcast 在发布时更新，日常构建不改动。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const vm = require('vm');

const ROOT = __dirname;
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const VERSION = pkg.version;

const PLUGIN_ID = 'com.multidictionary.bob';
const DISPLAY_NAME = '多源英语词典';
const REPO = 'https://github.com/oooocccc/bob-plugin-multi-dictionary';
const RAW_BASE = 'https://raw.githubusercontent.com/oooocccc/bob-plugin-multi-dictionary/main/';
const RELEASE_BASE = REPO + '/releases/download/v' + VERSION;
const PACKAGE_NAME = `bob-plugin-multi-dictionary${VERSION}.bobplugin`;

/* ------------------------------------------------------------ *
 * 最小 ZIP 写入器（deflate），不引入任何第三方依赖
 * ------------------------------------------------------------ */
const CRC_TABLE = (function () {
  const t = new Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) { c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); }
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) { c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function dosDateTime(d) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time: time & 0xFFFF, date: date & 0xFFFF };
}

/* 固定 ZIP 时间戳，保证同一份源码重复构建得到完全相同的安装包与 SHA256 */
const ZIP_DATE = new Date(2000, 0, 1, 0, 0, 0);

function makeZip(files) {
  const locals = [], centrals = [];
  let offset = 0;
  const fixed = dosDateTime(ZIP_DATE);

  for (const f of files) {
    const nameBuf = Buffer.from(f.name, 'utf8');
    const raw = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data, 'utf8');
    const comp = zlib.deflateRawSync(raw, { level: 9 });
    const crc = crc32(raw);

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0x0800, 6);
    lh.writeUInt16LE(8, 8);
    lh.writeUInt16LE(fixed.time, 10);
    lh.writeUInt16LE(fixed.date, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(comp.length, 18);
    lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28);
    locals.push(lh, nameBuf, comp);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(8, 10);
    ch.writeUInt16LE(fixed.time, 12);
    ch.writeUInt16LE(fixed.date, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(comp.length, 20);
    ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt16LE(0, 30);
    ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34);
    ch.writeUInt16LE(0, 36);
    ch.writeUInt32LE(0, 38);
    ch.writeUInt32LE(offset, 42);
    centrals.push(ch, nameBuf);
    offset += lh.length + nameBuf.length + comp.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, eocd]);
}

/* ------------------------------------------------------------ *
 * info.json — Bob 官方字段。所有面向用户的文案均为本产品自有文案。
 * ------------------------------------------------------------ */
function menu(id, title, desc, defaultValue, values) {
  return {
    identifier: id, type: 'menu', title: title, desc: desc, defaultValue: defaultValue,
    menuValues: values.map(([t, v]) => ({ title: t, value: v }))
  };
}
function buildInfo() {
  return {
    identifier: PLUGIN_ID,
    version: VERSION,
    category: 'translate',
    name: DISPLAY_NAME,
    summary: pkg.description,
    author: 'Bob Multi Dictionary contributors',
    homepage: REPO,
    minBobVersion: '1.8.0',
    appcast: RAW_BASE + 'appcast.json',
    options: [
      menu('ipaBoundary', '音标显示边界',
        'Bob 会自动为音标加方括号，默认输出裸 IPA，显示如「英 [meɪn]」。切换为斜线模式时输出 /meɪn/。',
        'bare', [['裸 IPA（推荐，Bob 原生括号）', 'bare'], ['标准音位 /…/', 'slash']])
    ]
  };
}

/* ------------------------------------------------------------ *
 * 构建主流程
 * ------------------------------------------------------------ */
function sourceFiles() {
  const dir = path.join(ROOT, 'src');
  return fs.readdirSync(dir).filter(f => /^\d\d-.*\.js$/.test(f)).sort();
}

function buildMain() {
  const vendor = fs.readFileSync(path.join(ROOT, 'vendor', 'cheerio.slim.js'), 'utf8');
  const parts = [vendor];
  for (const f of sourceFiles()) {
    parts.push('\n/* ===== src/' + f + ' ===== */\n');
    parts.push(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'));
  }
  let js = parts.join('\n');
  js = js.split('__BUILD_VERSION__').join(VERSION)
         .split('__BUILD_PLUGIN_ID__').join(PLUGIN_ID);
  return js;
}

/* ---- 版本 / 标识符 / 发布地址一致性检查 ---- */
function checkVersions() {
  const bad = [];
  const appcast = JSON.parse(fs.readFileSync(path.join(ROOT, 'appcast.json'), 'utf8'));
  if (appcast.identifier !== PLUGIN_ID) { bad.push('appcast.identifier 与 build.js 不一致'); }
  const versions = appcast.versions.map(v => v.version);
  if (versions.indexOf(VERSION) < 0) {
    bad.push('appcast.versions 缺少当前版本 ' + VERSION);
  }
  const infoPath = path.join(ROOT, 'info.json');
  if (fs.existsSync(infoPath)) {
    const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
    if (info.identifier !== PLUGIN_ID) { bad.push('info.json.identifier 与 build.js 不一致'); }
    if (info.version !== VERSION) { bad.push('info.json.version 与 package.json 不一致'); }
  }
  if (bad.length) {
    console.error('✗ 版本一致性检查失败：');
    bad.forEach(x => console.error('   ' + x));
    return false;
  }
  console.log('✓ 版本一致性检查通过：package.json / info.json / appcast.json 均为 ' + VERSION + ' / ' + PLUGIN_ID);
  return true;
}

function rebuildVendor() {
  const entry = path.join(ROOT, '.vendor-entry.js');
  const out = path.join(ROOT, 'vendor', 'cheerio.slim.js');
  const esbuild = path.join(ROOT, 'node_modules', '.bin', 'esbuild');
  if (!fs.existsSync(esbuild)) {
    console.error('✗ 未找到 esbuild，请先执行 npm install');
    process.exit(1);
  }
  fs.writeFileSync(entry, "export { load } from 'cheerio/lib/slim';\n", 'utf8');
  try {
    require('child_process').execFileSync(esbuild, [
      entry, '--bundle', '--platform=browser', '--format=iife',
      '--global-name=BobDictCheerio', '--outfile=' + out, '--log-level=warning'
    ], { cwd: ROOT, stdio: 'inherit' });
  } finally { fs.unlinkSync(entry); }
  console.log('✓ 已重新生成 vendor/cheerio.slim.js');
}

function main() {
  if (process.argv.includes('--rebuild-vendor')) { rebuildVendor(); }
  const checkOnly = process.argv.includes('--check');
  const mainJs = buildMain();

  try { new vm.Script(mainJs, { filename: 'main.js' }); }
  catch (e) { console.error('✗ main.js 语法检查失败：', e.message); process.exit(1); }
  for (const fn of ['supportLanguages', 'translate', 'pluginValidate', 'pluginTimeoutInterval']) {
    if (mainJs.indexOf('function ' + fn + '(') < 0) {
      console.error('✗ 缺少入口函数 ' + fn); process.exit(1);
    }
  }
  if (/__BUILD_(VERSION|PLUGIN_ID)__/.test(mainJs)) {
    console.error('✗ 版本信息注入失败'); process.exit(1);
  }
  console.log('✓ 语法检查通过，src 模块：' + sourceFiles().join(', '));

  if (checkOnly) {
    if (!checkVersions()) { process.exit(1); }
    return;
  }

  const releaseDir = path.join(ROOT, 'release');
  fs.mkdirSync(releaseDir, { recursive: true });

  const info = buildInfo();
  const infoText = JSON.stringify(info, null, 2);
  fs.writeFileSync(path.join(ROOT, 'info.json'), infoText + '\n', 'utf8');

  const icon = fs.readFileSync(path.join(ROOT, 'static', 'icon.png'));
  const zip = makeZip([
    { name: 'main.js', data: Buffer.from(mainJs, 'utf8') },
    { name: 'info.json', data: Buffer.from(infoText, 'utf8') },
    { name: 'icon.png', data: icon }
  ]);
  const out = path.join(releaseDir, PACKAGE_NAME);
  fs.writeFileSync(out, zip);
  const sha = crypto.createHash('sha256').update(zip).digest('hex');
  console.log('✓ 已生成 ' + path.relative(ROOT, out));
  console.log('  main.js  ' + Buffer.byteLength(mainJs, 'utf8') + ' bytes');
  console.log('  zip      ' + zip.length + ' bytes');
  console.log('  sha256   ' + sha);

  if (process.argv.includes('--appcast')) {
    const p = path.join(ROOT, 'appcast.json');
    const appcast = JSON.parse(fs.readFileSync(p, 'utf8'));
    appcast.identifier = PLUGIN_ID;
    const info2 = {
      version: VERSION,
      desc: '详见 CHANGELOG.md',
      sha256: sha,
      url: RELEASE_BASE + '/' + PACKAGE_NAME,
      minBobVersion: info.minBobVersion
    };
    const existing = appcast.versions.find(v => v.version === VERSION);
    if (existing) { Object.assign(existing, info2); }
    else { appcast.versions.push(info2); }
    fs.writeFileSync(p, JSON.stringify(appcast, null, 2) + '\n', 'utf8');
    console.log('✓ appcast.json 已' + (existing ? '更新' : '追加') + ' ' + VERSION);
  }
}

main();
