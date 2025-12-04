---
tools:
  ['search', 'runCommands', 'azure/search', 'usages', 'vscodeAPI', 'problems', 'changes', 'testFailure', 'fetch', 'githubRepo', 'memory', 'extensions', 'todos']
description: "Publish WordSlash MCP Server"
---

# WordSlash MCP Server 发布流程

## 任务描述

帮助完成 WordSlash MCP Server (`scripts/mcp-server`) 的 npm 发布流程。

## 前置检查

### 1. 检查是否有新的提交

```bash
# 进入 mcp-server 目录
cd scripts/mcp-server

# 获取当前 npm 发布的版本
npm view wordslash-mcp version 2>/dev/null || echo "尚未发布"

# 查看 package.json 中的版本
cat package.json | grep '"version"'

# 检查自上次 tag 以来 mcp-server 目录是否有新提交
git log --oneline $(git tag --sort=-v:refname | grep "^mcp-v" | head -1)..HEAD -- scripts/mcp-server/
```

### 2. 判断是否需要发布

**不需要发布的情况：**
- `scripts/mcp-server/` 目录自上次发布以来没有新的提交
- npm 上的版本与 package.json 版本一致

**如果不需要发布，请停止并告知用户原因。**

## 发布步骤

### 3. 更新版本号

```bash
cd scripts/mcp-server

# 根据变更类型更新版本（选择其一）
npm version patch  # Bug 修复: 0.2.0 → 0.2.1
npm version minor  # 新功能: 0.2.0 → 0.3.0
npm version major  # 重大变更: 0.2.0 → 1.0.0
```

> ⚠️ MCP Server 版本号独立于主项目，不与项目 git tag 关联

### 4. 编译

```bash
cd scripts/mcp-server

# 安装依赖（如需要）
npm install

# 编译 TypeScript
npm run build
```

### 5. 发布到 npm

```bash
cd scripts/mcp-server

# 确保已登录 npm
npm whoami || npm login

# 发布
npm publish
```

### 6. 提交版本更新（可选）

```bash
# 回到项目根目录
cd ../..

# 提交 package.json 版本更新
git add scripts/mcp-server/package.json
git commit -m "chore(mcp): bump version to vX.Y.Z"
git push origin main

# 可选：创建 mcp 专用 tag
git tag mcp-vX.Y.Z
git push origin mcp-vX.Y.Z
```

## 验证清单

- [ ] 确认 `scripts/mcp-server/` 有新的提交
- [ ] npm 版本与 package.json 不一致（需要发布）
- [ ] 版本号已更新
- [ ] 编译成功，无错误
- [ ] npm publish 成功
- [ ] 版本更新已提交到 git

## 完整脚本示例

```bash
cd scripts/mcp-server

# 检查是否需要发布
NPM_VERSION=$(npm view wordslash-mcp version 2>/dev/null || echo "0.0.0")
LOCAL_VERSION=$(node -p "require('./package.json').version")

if [ "$NPM_VERSION" = "$LOCAL_VERSION" ]; then
  echo "当前版本 $LOCAL_VERSION 已发布，检查是否有新提交..."
  
  CHANGES=$(git log --oneline mcp-v$LOCAL_VERSION..HEAD -- . 2>/dev/null | wc -l)
  if [ "$CHANGES" -eq 0 ]; then
    echo "没有新的提交，无需发布"
    exit 0
  fi
  
  # 有新提交，更新版本
  npm version patch
fi

# 编译并发布
npm install
npm run build
npm publish

echo "发布成功！"
```