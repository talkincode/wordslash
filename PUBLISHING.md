# WordSlash 发布指南

## 📦 发布到 VS Code Marketplace

### 1. 前置准备

#### 1.1 创建 Azure DevOps 账号和 Publisher

1. 访问 [Azure DevOps](https://dev.azure.com/)
2. 创建组织（如果没有）
3. 访问 [Marketplace 发布者管理](https://marketplace.visualstudio.com/manage)
4. 创建发布者（Publisher ID），例如：`talkincode` 或你的 GitHub 用户名

#### 1.2 生成 Personal Access Token (PAT)

1. 在 Azure DevOps 中，点击右上角头像 → **Personal access tokens**
2. 点击 **+ New Token**
3. 设置：
   - Name: `VSCode Extension Publishing`
   - Organization: `All accessible organizations`
   - Scopes: 选择 **Custom defined** → 勾选 **Marketplace (Manage)**
   - Expiration: 建议设置 90 天或更长
4. 点击 **Create**，**务必复制并保存 Token**（只显示一次）

### 2. 安装发布工具

```bash
npm install -g @vscode/vsce
```

### 3. 完善 package.json

确保 `package.json` 包含以下必需字段：

```json
{
  "name": "wordslash",
  "displayName": "WordSlash",
  "description": "English vocabulary learning with spaced repetition in VS Code",
  "version": "0.1.0",
  "publisher": "talkincode",  // 改成你的 Publisher ID
  "author": "Your Name",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/talkincode/wordslash"
  },
  "bugs": {
    "url": "https://github.com/talkincode/wordslash/issues"
  },
  "homepage": "https://github.com/talkincode/wordslash#readme",
  "keywords": [
    "vocabulary",
    "english",
    "learning",
    "flashcard",
    "spaced-repetition",
    "sm2",
    "education"
  ],
  "icon": "media/icon.png",
  "galleryBanner": {
    "color": "#1e1e1e",
    "theme": "dark"
  }
}
```

### 4. 准备图标

确保有以下文件：
- `media/icon.png` - 至少 128x128 像素的正方形图标
- 可选：创建 `media/banner.png` - Marketplace 横幅（约 1280x640）

### 5. 编译和打包

```bash
# 编译 TypeScript
npm run compile

# 打包成 .vsix 文件（本地测试）
vsce package

# 这会生成 wordslash-0.1.0.vsix 文件
```

### 6. 本地测试安装

```bash
# 安装打包好的 .vsix 文件
code --install-extension wordslash-0.1.0.vsix

# 测试功能是否正常
```

### 7. 发布到 Marketplace

#### 方式一：使用命令行（推荐）

```bash
# 首次发布需要登录
vsce login <your-publisher-id>
# 输入刚才生成的 Personal Access Token

# 发布
vsce publish
```

#### 方式二：手动上传

1. 访问 [Marketplace 管理页面](https://marketplace.visualstudio.com/manage/publishers/<your-publisher-id>)
2. 点击 **+ New extension** → **Visual Studio Code**
3. 上传生成的 `.vsix` 文件

### 8. 更新版本

每次发布新版本：

```bash
# 方式一：自动增加版本号并发布
vsce publish patch    # 0.1.0 → 0.1.1
vsce publish minor    # 0.1.0 → 0.2.0
vsce publish major    # 0.1.0 → 1.0.0

# 方式二：手动指定版本
vsce publish 0.2.0
```

## 🔒 安全注意事项

### .vscodeignore

确保 `.vscodeignore` 文件正确配置，避免包含不必要的文件：

```
.vscode/**
.vscode-test/**
src/**
.gitignore
.yarnrc
vsc-extension-quickstart.md
**/tsconfig.json
**/.eslintrc.json
**/*.map
**/*.ts
node_modules/**
coverage/**
.github/**
scripts/mcp-server/**
DEVELOPMENT_PLAN.md
PUBLISHING.md
```

### 敏感信息

- ❌ **不要**将 Personal Access Token 提交到 Git
- ❌ **不要**在代码中硬编码 API 密钥
- ✅ 使用环境变量或 VS Code 配置项

## 📊 发布后的管理

### 查看统计

访问 [Marketplace 管理页面](https://marketplace.visualstudio.com/manage) 查看：
- 安装数量
- 评分和评论
- 下载趋势

### 更新扩展信息

- README.md 更新后需要重新发布才会在 Marketplace 显示
- 可以在管理页面直接编辑描述、标签等

### 撤销版本

```bash
vsce unpublish <publisher-id>.wordslash@<version>
```

## 🚀 发布检查清单

发布前确认：

- [ ] `package.json` 中的 `publisher` 字段已修改
- [ ] `version` 版本号正确递增
- [ ] `README.md` 内容完整且准确
- [ ] `CHANGELOG.md` 记录了版本更新内容
- [ ] `icon.png` 图标清晰（建议 256x256 或更大）
- [ ] 执行 `npm run compile` 无错误
- [ ] 执行 `npm test` 所有测试通过
- [ ] 本地安装 `.vsix` 测试功能正常
- [ ] `.vscodeignore` 配置正确
- [ ] LICENSE 文件存在

## 📝 持续集成（可选）

### GitHub Actions 自动发布

创建 `.github/workflows/publish.yml`:

```yaml
name: Publish Extension

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Compile
        run: npm run compile
      
      - name: Publish to Marketplace
        run: |
          npm install -g @vscode/vsce
          vsce publish -p ${{ secrets.VSCE_PAT }}
        env:
          VSCE_PAT: ${{ secrets.VSCE_PAT }}
```

然后在 GitHub 仓库设置中添加 Secret：`VSCE_PAT`（值为你的 Personal Access Token）

## 🔗 相关链接

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Marketplace Publisher Management](https://marketplace.visualstudio.com/manage)
- [vsce CLI Documentation](https://github.com/microsoft/vscode-vsce)

---

## ⚡ 快速命令参考

```bash
# 安装 vsce
npm install -g @vscode/vsce

# 登录
vsce login <publisher-id>

# 打包（本地测试）
vsce package

# 发布新版本
vsce publish patch   # 小版本
vsce publish minor   # 中版本
vsce publish major   # 大版本

# 查看当前版本
vsce show <publisher-id>.wordslash

# 撤销发布
vsce unpublish <publisher-id>.wordslash@<version>
```
