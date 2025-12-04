# WordSlash

<p align="center">
  <img src="media/icon.png" width="128" height="128" alt="WordSlash Logo">
</p>

<p align="center">
  <strong>📚 在 VS Code 中构建你的英语学习闭环</strong>
</p>

<p align="center">
  <em>选词即学 · 闪卡复习 · SM-2 间隔重复 · 数据永不丢失</em>
</p>

<p align="center">
  <a href="#-安装">安装</a> •
  <a href="#-快速开始">快速开始</a> •
  <a href="#%EF%B8%8F-配置">配置</a> •
  <a href="#-mcp-服务">MCP 服务</a> •
  <a href="#-命令列表">命令</a>
</p>

<p align="center">
  <a href="README.md">English</a> | 中文
</p>

---

## ✨ 特性

- 🎯 **无缝集成** - 编码过程中一键将任意单词/短语添加到闪卡
- 🔄 **科学复习** - 基于 SM-2 间隔重复算法，高效记忆
- 📊 **可视化仪表盘** - 热力图、环形图、进度追踪
- 🔊 **语音朗读** - 多种 TTS 引擎支持发音练习
- 💾 **数据安全** - 本地 JSONL 存储 + 事件溯源，支持导出/导入
- 🤖 **AI 集成** - MCP Server 支持 Claude Desktop 等 AI 助手

---

![](media/wordslash.jpg)

## 📦 安装

### 从 VS Code 扩展市场安装

1. 打开 VS Code
2. 按 `Ctrl+Shift+X` (Windows/Linux) 或 `Cmd+Shift+X` (macOS)
3. 搜索 **"WordSlash"**
4. 点击 **安装**

### 从 VSIX 文件安装

1. 从 [GitHub Releases](https://github.com/talkincode/wordslash/releases) 下载 `.vsix` 文件
2. 打开 VS Code
3. 按 `Ctrl+Shift+P` / `Cmd+Shift+P`
4. 输入 **"Install from VSIX"** 并选择下载的文件

### 从源码安装

```bash
git clone https://github.com/talkincode/wordslash.git
cd wordslash
npm install
npm run compile
# 在 VS Code 中按 F5 启动扩展开发宿主
```

---

## 🚀 快速开始

### 1. 添加卡片

1. 在编辑器中选中任意单词或短语
2. 右键选择 **"Add to WordSlash"**
3. 卡片将自动创建，包含当前行的上下文

> 💡 如果没有选中内容，会自动提取光标所在的单词

### 2. 开始学习

- 点击侧边栏的 **WordSlash 图标**
- 或按 `Ctrl+Shift+P` / `Cmd+Shift+P` → **"WordSlash: Open Flashcards"**

### 3. 复习卡片

| 按钮       | 含义       | 效果                     |
| ---------- | ---------- | ------------------------ |
| **Again**  | 完全不记得 | 翻面查看，重置间隔       |
| **Hard**   | 勉强记得   | 翻面查看，短间隔复习     |
| **Good**   | 记得       | 直接下一张，正常间隔     |
| **Easy**   | 非常熟悉   | 直接下一张，延长间隔     |
| **Reveal** | 想看解释   | 仅翻面（不计入评分）     |

---

## ⚙️ 配置

打开 VS Code 设置 (`Ctrl+,` / `Cmd+,`)，搜索 `wordslash`：

### 通用设置

| 配置项 | 类型 | 默认值 | 说明 |
| ------ | ---- | ------ | ---- |
| `wordslash.newCardsPerDay` | number | `20` | 每日新卡片上限 |
| `wordslash.privacy.storeFilePath` | boolean | `false` | 是否存储卡片来源文件路径 |

### 语音朗读 (TTS)

| 配置项 | 类型 | 默认值 | 说明 |
| ------ | ---- | ------ | ---- |
| `wordslash.tts.engine` | string | `youdao` | TTS 引擎：`youdao`、`google`、`browser`、`azure`、`openai` |
| `wordslash.tts.rate` | number | `1.0` | 语速 (0.5-2.0) |
| `wordslash.tts.autoPlay` | boolean | `true` | 卡片出现时自动播放发音 |
| `wordslash.tts.azureKey` | string | - | Azure Speech API 密钥 |
| `wordslash.tts.azureRegion` | string | `eastus` | Azure 区域 |
| `wordslash.tts.openaiKey` | string | - | OpenAI API 密钥 |

### TTS 引擎对比

| 引擎 | 质量 | 离线 | 需要 API Key |
| ---- | ---- | ---- | ------------ |
| **有道 (Youdao)** | ⭐⭐⭐⭐ | ❌ | 否 |
| **谷歌 (Google)** | ⭐⭐⭐ | ❌ | 否 |
| **浏览器 (Browser)** | ⭐⭐ | ✅ | 否 |
| **Azure** | ⭐⭐⭐⭐⭐ | ❌ | 是 |
| **OpenAI** | ⭐⭐⭐⭐⭐ | ❌ | 是 |

---

## 📋 命令列表

按 `Ctrl+Shift+P` / `Cmd+Shift+P` 打开命令面板：

| 命令 | 说明 |
| ---- | ---- |
| `WordSlash: Open Dashboard` | 打开完整仪表盘，查看图表和统计 |
| `WordSlash: Open Flashcards` | 打开闪卡复习界面 |
| `WordSlash: Add Card from Selection` | 从选中内容创建卡片 |
| `WordSlash: Export Backup` | 导出所有数据到备份文件 |
| `WordSlash: Import Backup` | 从备份文件导入数据 |
| `WordSlash: Import Cards from JSON` | 从 JSON 文件批量导入卡片 |
| `WordSlash: Export JSON Template` | 导出批量导入模板 |
| `WordSlash: Open Settings` | 打开 WordSlash 设置 |

---

## 💾 数据与备份

### 存储位置

数据存储在 VS Code 的 `globalStorage` 目录：

- **macOS**: `~/Library/Application Support/Code/User/globalStorage/wordslash.wordslash/`
- **Windows**: `%APPDATA%/Code/User/globalStorage/wordslash.wordslash/`
- **Linux**: `~/.config/Code/User/globalStorage/wordslash.wordslash/`

### 数据文件

| 文件 | 说明 |
| ---- | ---- |
| `cards.jsonl` | 词汇卡片（追加写入） |
| `events.jsonl` | 复习事件（不可变历史） |
| `index.json` | 可重建的缓存 |

### 导出与导入

```bash
# 导出备份
Ctrl+Shift+P → WordSlash: Export Backup → 选择目录

# 导入备份
Ctrl+Shift+P → WordSlash: Import Backup → 选择备份文件
```

> 💡 导入是幂等的 - 同一备份多次导入不会产生重复数据

---

## 🤖 MCP 服务

WordSlash 包含 MCP (Model Context Protocol) 服务，允许 Claude Desktop 等 AI 助手管理你的词汇卡片。

### 安装

```bash
cd scripts/mcp-server
npm install
npm run build
```

### 配置 Claude Desktop

在 `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) 中添加：

```json
{
  "mcpServers": {
    "wordslash": {
      "command": "node",
      "args": ["/path/to/wordslash/scripts/mcp-server/dist/index.js"],
      "env": {
        "WORDSLASH_STORAGE_PATH": "/可选/自定义/路径"
      }
    }
  }
}
```

**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

### 配置 VS Code (Copilot / Continue)

对于 VS Code 中的 GitHub Copilot 或 Continue 扩展：

```json
{
  "mcpServers": [
    {
      "name": "wordslash",
      "command": "node",
      "args": ["/path/to/wordslash/scripts/mcp-server/dist/index.js"]
    }
  ]
}
```

### 可用的 MCP 工具

| 工具 | 说明 |
| ---- | ---- |
| `create_card` | 创建词汇卡片（包含词汇、翻译、例句等） |
| `list_cards` | 列出所有卡片（支持搜索/标签过滤） |
| `get_card` | 通过 ID 或词汇获取卡片 |
| `update_card` | 更新现有卡片 |
| `delete_card` | 软删除卡片 |
| `delete_cards_batch` | 批量删除卡片 |
| `list_events` | 列出复习事件（学习历史） |
| `get_index` | 获取索引状态（卡片数、待复习数） |
| `get_dashboard_stats` | 获取完整统计数据 |
| `generate_knowledge_graph` | 生成词汇关系图谱 |

### 与 Claude 的对话示例

```
用户: 添加单词 "ephemeral"，翻译是 "短暂的"，例句 "Fame is ephemeral."

Claude: 我来为你创建 "ephemeral" 的词汇卡片。
[使用 create_card 工具]
✓ 卡片创建成功！

用户: 我有哪些标签是 "GRE" 的单词？

Claude: 让我查看你的词汇卡片。
[使用 list_cards 工具并按标签过滤]
你有 15 张标记为 "GRE" 的卡片：ephemeral、ubiquitous...
```

### 环境变量

| 变量 | 说明 | 默认值 |
| ---- | ---- | ------ |
| `WORDSLASH_STORAGE_PATH` | 自定义存储路径 | VS Code globalStorage |

---

## 🧠 SM-2 算法

WordSlash 使用经典的 SM-2 间隔重复算法：

| 评分 | 质量值 | 间隔效果 |
| ---- | ------ | -------- |
| **Again** | q=0 | 重置为 1 天，增加遗忘次数 |
| **Hard** | q=3 | 短间隔 |
| **Good** | q=4 | 正常间隔 |
| **Easy** | q=5 | 延长间隔 |

算法根据你的表现动态调整复习间隔，优化长期记忆效果。

---

## 🛠️ 开发

```bash
# 克隆仓库
git clone https://github.com/talkincode/wordslash.git
cd wordslash

# 安装依赖
npm install

# 编译
npm run compile

# 运行测试
npm test

# 监听模式
npm run watch

# 在 VS Code 中调试
# 按 F5 启动扩展开发宿主
```

### 项目结构

```
wordslash/
├── src/
│   ├── extension.ts        # 扩展入口
│   ├── commands/           # VS Code 命令
│   ├── storage/            # JSONL 存储、索引、类型定义
│   ├── srs/                # SM-2 算法、调度器
│   └── webview/            # 仪表盘、闪卡 UI
├── scripts/
│   └── mcp-server/         # AI 集成的 MCP 服务
├── media/                  # 图标和资源
└── package.json
```

---

## 🗺️ 路线图

- [x] **v0.1** - 核心闭环：命令、存储、闪卡、SM-2
- [x] **v0.2** - 仪表盘、热力图、图表、MCP 服务
- [ ] **v0.3** - 体验优化：快捷键、批量操作
- [ ] **v0.4** - AI 增强：LLM 自动生成卡片内容

---

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

<p align="center">
  Made with ❤️ for learners who code
</p>
