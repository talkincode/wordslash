---
tools:
  ['search', 'runCommands', 'azure/search', 'usages', 'vscodeAPI', 'problems', 'changes', 'testFailure', 'fetch', 'githubRepo', 'memory', 'extensions', 'todos']
description: "Project Code Quality Automated Detection and Analysis"
---

# Code Review Prompt

对当前修改或指定提交记录进行代码评审，输出结构化评审意见。

## 评审范围

请评审以下内容（按优先级选择）：

1. **当前未提交的修改** - 使用 `git diff` 获取工作区变更
2. **暂存区修改** - 使用 `git diff --staged` 获取已暂存变更
3. **指定提交** - 如提供 commit hash，使用 `git show <hash>` 获取变更

## 评审维度

### 1. 架构合规性 (Architecture Compliance)

根据项目架构约束检查：

- [ ] 目录结构是否符合 `copilot-instructions.md` 中定义的规范
- [ ] VS Code API 调用是否隔离在指定模块（`extension.ts`, `commands/`, `webview/panel.ts`）
- [ ] 纯逻辑模块（`storage/`, `srs/`, `protocol.ts`）是否避免了 `vscode` 导入
- [ ] 是否超出 v1 范围（禁止：云同步、复杂动画、字典集成、真实 LLM 调用）

### 2. 数据存储规范 (Data Storage)

- [ ] 是否使用 JSONL + Event Sourcing 模式
- [ ] 写操作是否采用原子写入（`.tmp` → `rename`）
- [ ] 导入操作是否幂等（相同数据多次导入无副作用）
- [ ] `SrsState` 是否可从 events 重建

### 3. SM-2 算法一致性 (Algorithm)

- [ ] Rating 映射是否正确：again=0, hard=3, good=4, easy=5
- [ ] 间隔计算：1→6→interval×EF
- [ ] EF 下限是否为 1.3

### 4. 协议兼容性 (Protocol)

- [ ] Webview 消息是否符合 `protocol.ts` 定义
- [ ] 新增字段是否向后兼容

### 5. 隐私合规 (Privacy)

- [ ] `storeFilePath` 默认是否为 `false`
- [ ] 默认情况下是否避免存储 `filePath`

### 6. 代码质量 (Code Quality)

- [ ] TypeScript 类型是否完整，避免 `any`
- [ ] 错误处理是否充分
- [ ] 是否有潜在的性能问题
- [ ] 命名是否清晰一致

### 7. 测试覆盖 (Test Coverage)

- [ ] 核心逻辑（`srs/`）是否有测试
- [ ] 存储逻辑（`storage/`）是否有测试
- [ ] 测试是否使用 Vitest + 正确的 mock 策略

## 输出格式

请按以下结构输出评审意见：

```markdown
## 📋 评审摘要

| 维度 | 状态 | 说明 |
|------|------|------|
| 架构合规性 | ✅/⚠️/❌ | 简要说明 |
| 数据存储规范 | ✅/⚠️/❌ | 简要说明 |
| SM-2 算法 | ✅/⚠️/❌ | 简要说明 |
| 协议兼容性 | ✅/⚠️/❌ | 简要说明 |
| 隐私合规 | ✅/⚠️/❌ | 简要说明 |
| 代码质量 | ✅/⚠️/❌ | 简要说明 |
| 测试覆盖 | ✅/⚠️/❌ | 简要说明 |

## 🔴 必须修复 (Blockers)

### 1. [问题标题]
- **文件**: `path/to/file.ts:行号`
- **问题**: 具体描述
- **建议**: 修复方案

## 🟡 建议改进 (Suggestions)

### 1. [改进标题]
- **文件**: `path/to/file.ts:行号`
- **现状**: 当前实现
- **建议**: 更好的做法

## 🟢 值得肯定 (Highlights)

- 描述做得好的地方

## 📝 其他备注

- 任何额外说明或讨论点
```

## 状态说明

- ✅ **通过** - 完全符合规范
- ⚠️ **警告** - 有改进空间但不阻塞
- ❌ **阻塞** - 必须修复才能合并

## 使用示例

```
# 评审当前工作区修改
@review

# 评审指定提交
@review commit:abc1234

# 评审最近 3 个提交
@review HEAD~3..HEAD
```