# Bob Multi Dictionary

Bob 英语词典插件，查询英文单词，提供按词性分组的中文释义、英式与美式 IPA 音标及对应原生发音。

## 功能

- 基于 Cambridge Dictionary 英汉简体词典查询。
- 中文释义按词性分组，去重后以分号连接。
- 分别显示英式、美式 IPA 及对应发音，缺失的读音不显示。
- 保留词典原始音标符号、重音和音长标记，准确区分不同音素。
- 支持同一单词的多个读音及不同词性的发音差异。
- 使用 Bob 原生词典结果渲染，无需额外安装运行时依赖。

## 安装

1. 安装 [Bob](https://bobtranslate.com/)，版本要求为 1.8.0 或更高。
2. 从 [GitHub Releases](https://github.com/oooocccc/bob-plugin-multi-dictionary/releases) 下载最新 `.bobplugin` 安装包。
3. 双击安装包，在「偏好设置 → 服务」中启用「多源英语词典」。

插件标识符：`com.multidictionary.bob`

## 使用

在 Bob 中选中英文单词进行查询。

结果示例：

```text
main

英 [meɪn]  🔊
美 [meɪn]  🔊

adj.   主要的; 最重要的; 首要的
n.     主管道; 总管; 干线
```

英式、美式音标与发音分别对应。可在插件设置中调整音标显示边界：

- 裸 IPA：由 Bob 显示为 `[meɪn]`。
- 标准音位：显示为 `/meɪn/`。

**查询范围：** 英文单词及不超过 3 个词的短语。不支持整句翻译、中文查词及词形还原。词典未收录的单词返回「未收录」。

## 配置

| 配置项 | 默认值 | 说明 |
|---|---|---|
| 音标显示边界 | 裸 IPA | 可切换为标准音位形式 `/…/` |

无需配置 API Key。

## 构建

需要 Node.js（仅构建时使用；插件运行不依赖任何额外环境）。

```bash
node build.js --check       # 语法、入口与版本一致性检查（不写产物）
node build.js               # 生成 info.json 与 release/*.bobplugin 安装包
node build.js --appcast     # 发布时同步 appcast.json 的版本与 SHA256
```

`package.json` 中的 `version` 是版本号唯一来源；`info.json`、安装包内的 `main.js` 与安装包文件名均由 `build.js` 从 `src/`、`vendor/`、`static/` 生成。`release/` 内的安装包为构建产物，不纳入版本管理。

## 第三方数据来源与隐私

本插件通过解析 Cambridge Dictionary 英汉简体词典网页获取查询数据，不使用 Cambridge 官方 API。

- **数据来源：** [Cambridge Dictionary](https://dictionary.cambridge.org/)。
- **产品关系：** 本项目为独立开发项目，与 Cambridge University Press、Cambridge Dictionary 及其关联方不存在合作、授权、背书或隶属关系。
- **网络请求：** 用户主动查询时，插件向 Cambridge Dictionary 发起请求，获取词性、中文释义、英式与美式 IPA 及对应音频地址；音频由 Bob 请求播放。
- **隐私：** 查询词会发送至 Cambridge Dictionary。插件不包含独立埋点或遥测。
- **数据处理：** 插件不提供批量抓取、全词库下载或后台定时抓取功能，不持久化词典查询内容。

## 版权与许可

本项目自身代码采用 MIT License，具体许可条款及第三方依赖声明见 [LICENSE](LICENSE)。

Cambridge Dictionary 的词典文本、释义、音频、网页内容、商标及品牌素材不属于本项目的 MIT 许可范围，其权利归各自权利人所有。

本项目未获得 Cambridge 书面授权。使用者应自行查阅并遵守 [Cambridge 数据许可说明](https://dictionary.cambridge.org/license) 及相关使用条款。