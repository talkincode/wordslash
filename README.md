# WordSlash

<p align="center">
  <img src="media/icon.png" width="128" height="128" alt="WordSlash Logo">
</p>

<p align="center">
  <strong>📚 Build Your English Learning Loop in VS Code</strong>
</p>

<p align="center">
  <em>Select to Learn · Flashcard Review · SM-2 Spaced Repetition · Never Lose Data</em>
</p>

<p align="center">
  <a href="#-installation">Installation</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#%EF%B8%8F-configuration">Configuration</a> •
  <a href="#-mcp-server">MCP Server</a> •
  <a href="#-commands">Commands</a>
</p>

<p align="center">
  English | <a href="README.zh-CN.md">中文</a>
</p>

---

## ✨ Features

- 🎯 **Seamless Integration** - Add any word/phrase to flashcards with a single click while coding
- 🔄 **Scientific Review** - SM-2 spaced repetition algorithm for efficient memorization
- 📊 **Visual Dashboard** - Heatmap, donut charts, and progress tracking
- 🔊 **Text-to-Speech** - Multiple TTS engines for pronunciation practice
- 💾 **Data Safety** - Local JSONL storage with event sourcing, export/import support
- 🤖 **AI Integration** - MCP Server for Claude Desktop and other AI assistants

---

## 📦 Installation

### From VS Code Marketplace

1. Open VS Code
2. Press `Ctrl+Shift+X` (Windows/Linux) or `Cmd+Shift+X` (macOS)
3. Search for **"WordSlash"**
4. Click **Install**

### From VSIX File

1. Download the `.vsix` file from [GitHub Releases](https://github.com/talkincode/wordslash/releases)
2. Open VS Code
3. Press `Ctrl+Shift+P` / `Cmd+Shift+P`
4. Type **"Install from VSIX"** and select the downloaded file

### From Source

```bash
git clone https://github.com/talkincode/wordslash.git
cd wordslash
npm install
npm run compile
# Press F5 in VS Code to launch Extension Development Host
```

---

## 🚀 Quick Start

### 1. Add a Card

1. Select any word or phrase in the editor
2. Right-click and choose **"Add to WordSlash"**
3. The card is created with context from the current line

> 💡 If nothing is selected, the word under cursor is automatically extracted

### 2. Start Learning

- Click the **WordSlash icon** in the Activity Bar (sidebar)
- Or press `Ctrl+Shift+P` / `Cmd+Shift+P` → **"WordSlash: Open Flashcards"**

### 3. Review Cards

| Button     | Meaning           | Effect                          |
| ---------- | ----------------- | ------------------------------- |
| **Again**  | Don't remember    | Flip to back, reset interval    |
| **Hard**   | Barely remember   | Flip to back, short interval    |
| **Good**   | Remember          | Next card, normal interval      |
| **Easy**   | Very familiar     | Next card, extended interval    |
| **Reveal** | Want to see back  | Flip (not scored)               |

---

## ⚙️ Configuration

Open VS Code Settings (`Ctrl+,` / `Cmd+,`) and search for `wordslash`:

### General Settings

| Setting | Type | Default | Description |
| ------- | ---- | ------- | ----------- |
| `wordslash.newCardsPerDay` | number | `20` | Maximum new cards per day |
| `wordslash.privacy.storeFilePath` | boolean | `false` | Store source file path in cards |

### Text-to-Speech (TTS)

| Setting | Type | Default | Description |
| ------- | ---- | ------- | ----------- |
| `wordslash.tts.engine` | string | `youdao` | TTS engine: `youdao`, `google`, `browser`, `azure`, `openai` |
| `wordslash.tts.rate` | number | `1.0` | Speech rate (0.5-2.0) |
| `wordslash.tts.autoPlay` | boolean | `true` | Auto-play pronunciation on card appear |
| `wordslash.tts.azureKey` | string | - | Azure Speech API key (for azure engine) |
| `wordslash.tts.azureRegion` | string | `eastus` | Azure region |
| `wordslash.tts.openaiKey` | string | - | OpenAI API key (for openai engine) |

### TTS Engine Comparison

| Engine | Quality | Offline | API Key Required |
| ------ | ------- | ------- | ---------------- |
| **Youdao** | ⭐⭐⭐⭐ | ❌ | No |
| **Google** | ⭐⭐⭐ | ❌ | No |
| **Browser** | ⭐⭐ | ✅ | No |
| **Azure** | ⭐⭐⭐⭐⭐ | ❌ | Yes |
| **OpenAI** | ⭐⭐⭐⭐⭐ | ❌ | Yes |

---

## 📋 Commands

Press `Ctrl+Shift+P` / `Cmd+Shift+P` to open the Command Palette:

| Command | Description |
| ------- | ----------- |
| `WordSlash: Open Dashboard` | Open the full dashboard with charts and statistics |
| `WordSlash: Open Flashcards` | Open the flashcard review interface |
| `WordSlash: Add Card from Selection` | Create a card from selected text |
| `WordSlash: Export Backup` | Export all data to a backup file |
| `WordSlash: Import Backup` | Import data from a backup file |
| `WordSlash: Import Cards from JSON` | Bulk import cards from JSON file |
| `WordSlash: Export JSON Template` | Export a template for bulk import |
| `WordSlash: Open Settings` | Open WordSlash settings |

---

## 💾 Data & Backup

### Storage Location

Data is stored in VS Code's `globalStorage`:

- **macOS**: `~/Library/Application Support/Code/User/globalStorage/wordslash.wordslash/`
- **Windows**: `%APPDATA%/Code/User/globalStorage/wordslash.wordslash/`
- **Linux**: `~/.config/Code/User/globalStorage/wordslash.wordslash/`

### Data Files

| File | Description |
| ---- | ----------- |
| `cards.jsonl` | Vocabulary cards (append-only) |
| `events.jsonl` | Review events (immutable history) |
| `index.json` | Rebuildable cache |

### Export & Import

```bash
# Export backup
Ctrl+Shift+P → WordSlash: Export Backup → Choose directory

# Import backup
Ctrl+Shift+P → WordSlash: Import Backup → Select backup file
```

> 💡 Import is idempotent - same backup imported twice won't create duplicates

---

## 🤖 MCP Server

WordSlash includes an MCP (Model Context Protocol) Server that allows AI assistants like Claude Desktop to manage your vocabulary cards.

### Installation

```bash
cd scripts/mcp-server
npm install
npm run build
```

### Configure Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "wordslash": {
      "command": "node",
      "args": ["/path/to/wordslash/scripts/mcp-server/dist/index.js"],
      "env": {
        "WORDSLASH_STORAGE_PATH": "/optional/custom/path"
      }
    }
  }
}
```

**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

### Configure VS Code (Copilot / Continue)

For VS Code with GitHub Copilot or Continue extension:

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

### Available MCP Tools

| Tool | Description |
| ---- | ----------- |
| `create_card` | Create a vocabulary card with term, translation, examples, etc. |
| `list_cards` | List all cards (with optional search/tag filter) |
| `get_card` | Get a card by ID or term |
| `update_card` | Update an existing card |
| `delete_card` | Soft delete a card |
| `delete_cards_batch` | Batch delete cards |
| `list_events` | List review events (learning history) |
| `get_index` | Get index status (card count, due count) |
| `get_dashboard_stats` | Get comprehensive statistics |
| `generate_knowledge_graph` | Generate vocabulary relationship graph |

### Example Usage with Claude

```
User: Add the word "ephemeral" with translation "短暂的" and example "Fame is ephemeral."

Claude: I'll create a vocabulary card for "ephemeral".
[Uses create_card tool]
✓ Card created successfully!

User: What words do I have with the tag "GRE"?

Claude: Let me check your vocabulary cards.
[Uses list_cards tool with tag filter]
You have 15 cards tagged with "GRE": ephemeral, ubiquitous, ...
```

### Environment Variables

| Variable | Description | Default |
| -------- | ----------- | ------- |
| `WORDSLASH_STORAGE_PATH` | Custom storage path | VS Code globalStorage |

---

## 🧠 SM-2 Algorithm

WordSlash uses the classic SM-2 spaced repetition algorithm:

| Rating | Quality | Interval Effect |
| ------ | ------- | --------------- |
| **Again** | q=0 | Reset to 1 day, increment lapses |
| **Hard** | q=3 | Short interval |
| **Good** | q=4 | Normal interval |
| **Easy** | q=5 | Extended interval |

The algorithm dynamically adjusts review intervals based on your performance, optimizing long-term retention.

---

## 🛠️ Development

```bash
# Clone repository
git clone https://github.com/talkincode/wordslash.git
cd wordslash

# Install dependencies
npm install

# Compile
npm run compile

# Run tests
npm test

# Watch mode
npm run watch

# Debug in VS Code
# Press F5 to launch Extension Development Host
```

### Project Structure

```
wordslash/
├── src/
│   ├── extension.ts        # Extension entry point
│   ├── commands/           # VS Code commands
│   ├── storage/            # JSONL storage, indexer, schema
│   ├── srs/                # SM-2 algorithm, scheduler
│   └── webview/            # Dashboard, Flashcards UI
├── scripts/
│   └── mcp-server/         # MCP Server for AI integration
├── media/                  # Icons and assets
└── package.json
```

---

## 🗺️ Roadmap

- [x] **v0.1** - Core loop: commands, storage, flashcards, SM-2
- [x] **v0.2** - Dashboard, heatmap, charts, MCP server
- [ ] **v0.3** - Experience: keyboard shortcuts, batch operations
- [ ] **v0.4** - AI: LLM-powered card content generation

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🤝 Contributing

Issues and Pull Requests are welcome!

---

<p align="center">
  Made with ❤️ for learners who code
</p>
