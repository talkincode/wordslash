# WordSlash

<p align="center">
  <strong>📚 在 VS Code 中构建你的英语学习闭环</strong>
</p>

<p align="center">
  <em>选词即学 · 闪卡复习 · SM-2 间隔重复 · 数据永不丢失</em>
</p>

---

## ✨ 特性

- 🎯 **无缝集成** - 在代码编辑过程中，选中任意单词/短语一键添加到学习卡片
- 🔄 **科学复习** - 基于 SM-2 算法的间隔重复系统，高效记忆
- 💾 **数据安全** - 本地 JSONL 存储 + 事件溯源，支持导出/导入备份
- 🎨 **简洁交互** - 专注学习的闪卡界面，评分即走，不打断心流

## 📦 安装

1. 打开 VS Code
2. 按 `Ctrl+Shift+X` (Windows/Linux) 或 `Cmd+Shift+X` (macOS) 打开扩展面板
3. 搜索 `WordSlash`
4. 点击安装

## 🚀 快速开始

### 添加卡片

1. 在编辑器中选中你想学习的单词或短语
2. 右键选择 **"Add to WordSlash"**
3. 卡片将自动创建，包含选中的词汇和所在行的上下文

> 💡 如果没有选中内容，会自动提取光标所在的单词

### 开始复习

1. 按 `Ctrl+Shift+P` / `Cmd+Shift+P` 打开命令面板
2. 输入 `WordSlash: Open Flashcards`
3. 开始你的闪卡学习之旅！

## 🎮 复习操作

### 正面（Front）

显示单词/短语和例句，你可以选择：

| 按钮       | 说明       | 后续动作                 |
| ---------- | ---------- | ------------------------ |
| **Again**  | 完全不记得 | 翻面查看解释，卡片重置   |
| **Hard**   | 勉强记得   | 翻面查看解释，短间隔复习 |
| **Good**   | 记得       | 直接下一张，正常间隔     |
| **Easy**   | 非常熟悉   | 直接下一张，延长间隔     |
| **Reveal** | 想看解释   | 翻面（不计入评分）       |

### 背面（Back）

显示翻译、解释、同义词、反义词等信息，点击 **Next** 进入下一张卡片。

## ⚙️ 配置选项

在 VS Code 设置中搜索 `wordslash` 进行配置：

| 配置项                               | 类型    | 默认值  | 说明                     |
| ------------------------------------ | ------- | ------- | ------------------------ |
| `wordslash.backup.directory`         | string  | `null`  | 备份文件存储目录         |
| `wordslash.backup.auto`              | boolean | `false` | 是否启用自动备份         |
| `wordslash.backup.autoIntervalHours` | number  | `24`    | 自动备份间隔（小时）     |
| `wordslash.study.newCardsPerDay`     | number  | `10`    | 每日新卡片数量上限       |
| `wordslash.privacy.storeFilePath`    | boolean | `false` | 是否存储卡片来源文件路径 |

## 📋 命令列表

| 命令                                 | 说明               |
| ------------------------------------ | ------------------ |
| `WordSlash: Open Flashcards`         | 打开闪卡复习界面   |
| `WordSlash: Add Card from Selection` | 从选中内容添加卡片 |
| `WordSlash: Export Backup`           | 导出备份文件       |
| `WordSlash: Import Backup`           | 从备份文件导入     |

## 💾 数据与备份

### 存储位置

- 数据存储在 VS Code 的 `globalStorage` 目录中
- 采用 JSONL 格式 + 事件溯源架构，数据可追溯、可重建

### 数据文件

- `cards.jsonl` - 卡片实体数据
- `events.jsonl` - 学习事件日志（追加写入，不修改历史）
- `index.json` - 可重建的索引缓存

### 导出备份

1. 运行命令 `WordSlash: Export Backup`
2. 选择保存目录
3. 备份文件将包含所有卡片和学习记录

### 导入恢复

1. 运行命令 `WordSlash: Import Backup`
2. 选择备份文件
3. 数据将智能合并（同 ID 取最新版本）

## 🧠 SM-2 算法说明

WordSlash 使用经典的 SM-2 间隔重复算法：

- **Again (q=0)**: 重置复习进度，间隔设为 1 天
- **Hard (q=3)**: 保持进度，较短间隔
- **Good (q=4)**: 正常推进，标准间隔
- **Easy (q=5)**: 快速推进，延长间隔

算法会根据你的表现动态调整每张卡片的复习间隔，实现高效记忆。

## 🧪 验收测试

确保以下场景正常工作：

1. ✅ 选中单词 → 右键 Add → 打开 Flashcards → 卡片立即出现
2. ✅ 点击 Again → 生成复习事件 → 自动翻面显示背面
3. ✅ 点击 Easy → 直接进入下一张卡片
4. ✅ Export 备份 → 删除数据 → Import → 数据完整恢复

## 🗺️ 开发路线图

- [x] **v0.1** - 核心闭环：命令、存储、闪卡界面、SM-2 调度
- [ ] **v0.2** - 可靠性：导出/导入、索引重建、单元测试
- [ ] **v0.3** - 体验优化：每日上限、统计面板、快捷键
- [ ] **v0.4** - 智能生成：LLM 自动生成卡片背面内容

## 🛠️ 开发

```bash
# 克隆仓库
git clone https://github.com/your-username/wordslash.git
cd wordslash

# 安装依赖
npm install

# 编译
npm run compile

# 运行测试
npm test

# 在 VS Code 中调试
# 按 F5 启动扩展开发宿主
```

### 项目结构

```
wordslash/
├── src/
│   ├── extension.ts           # 扩展入口，注册命令
│   ├── storage/
│   │   ├── storage.ts         # JSONL 读写，原子写入
│   │   ├── indexer.ts         # 索引重建
│   │   └── schema.ts          # 类型定义与版本
│   ├── srs/
│   │   ├── sm2.ts             # SM-2 算法实现
│   │   └── scheduler.ts       # 下一张卡片选择
│   ├── commands/
│   │   ├── addCard.ts
│   │   ├── exportBackup.ts
│   │   ├── importBackup.ts
│   │   └── openFlashcards.ts
│   └── webview/
│       ├── panel.ts           # Webview 创建与消息路由
│       ├── protocol.ts        # 消息类型定义
│       └── ui/
│           ├── index.html
│           ├── app.ts
│           └── styles.css
├── package.json
└── tsconfig.json
```

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

<p align="center">
  Made with ❤️ for learners who code
</p>
