---
tools:
  ['search', 'runCommands', 'azure/search', 'usages', 'vscodeAPI', 'problems', 'changes', 'testFailure', 'fetch', 'githubRepo', 'memory', 'extensions', 'todos']
description: "Publish WordSlash VS Code Extension"
---


# WordSlash 发布流程

## 任务描述

帮助完成 WordSlash VS Code 扩展的版本发布流程。

## 发布步骤

### 1. 版本检查与更新

```bash
# 检查当前 git tag
git tag --sort=-v:refname | head -5

# 查看 package.json 中的版本
cat package.json | grep '"version"'
```

根据语义化版本规则更新版本号：
- **patch** (0.1.0 → 0.1.1): Bug 修复
- **minor** (0.1.0 → 0.2.0): 新功能，向后兼容
- **major** (0.1.0 → 1.0.0): 重大变更，不向后兼容

更新 `package.json` 中的 `version` 字段。

### 2. Git 提交检查

```bash
# 检查未提交的更改
git status

# 如果有未提交的更改，执行：
git add .
git commit -m "chore: prepare release vX.Y.Z"
git push origin main
```

### 3. 编译与本地安装

```bash
# 编译 TypeScript
npm run compile

# 打包成 .vsix 文件
npx vsce package

# 安装到当前 VS Code（替换 X.Y.Z 为实际版本号）
code --install-extension wordslash-X.Y.Z.vsix
```

### 4. 推送新 Tag

```bash
# 创建新 tag（替换 X.Y.Z 为实际版本号）
git tag vX.Y.Z

# 推送 tag 到远程
git push origin vX.Y.Z
```

## 验证清单

- [ ] package.json 版本号已更新
- [ ] 所有更改已提交并推送
- [ ] 扩展编译无错误
- [ ] .vsix 文件生成成功
- [ ] 本地安装测试通过
- [ ] Git tag 已创建并推送

## 完整一键脚本示例

```bash
# 设置新版本号
NEW_VERSION="0.2.0"

# 1. 更新 package.json 版本
npm version $NEW_VERSION --no-git-tag-version

# 2. 提交版本更新
git add package.json
git commit -m "chore: bump version to v$NEW_VERSION"
git push origin main

# 3. 编译和打包
npm run compile
npx vsce package

# 4. 本地安装
code --install-extension wordslash-$NEW_VERSION.vsix

# 5. 创建并推送 tag
git tag v$NEW_VERSION
git push origin v$NEW_VERSION
```

## 发布到 Marketplace（可选）

如果需要发布到 VS Code Marketplace：

```bash
# 使用 PAT 登录（首次）
npx vsce login TeraTeams

# 发布
npx vsce publish
```

详细说明请参考 [PUBLISHING.md](../../PUBLISHING.md)