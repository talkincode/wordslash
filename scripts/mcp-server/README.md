# WordSlash MCP Server

MCP (Model Context Protocol) Server for managing WordSlash vocabulary data. Provides stdio-based tools for reading, creating, updating, and deleting vocabulary cards.

## What's New in v0.2.0

✨ **Morpheme Segmentation**: Break down words into meaningful parts
- Add morphemes when creating cards: `morphemes: ["ephe", "meral"]`
- Update existing cards with morpheme breakdown
- Perfect for learning word roots and prefixes/suffixes

📊 **Dashboard Statistics**: Get comprehensive learning analytics
- Card counts, review stats, retention rate
- Learning streaks and progress tracking

🕸️ **Knowledge Graph**: Visualize vocabulary relationships
- See connections through synonyms, antonyms, and tags
- Interactive graph generation with filtering options

## Installation

```bash
cd scripts/mcp-server
npm install
npm run build
```

## Usage

### With Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

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

### With VS Code + Continue

Add to your Continue config:

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

### Development Mode

```bash
npm run dev
```

## Available Tools

### Cards Management

| Tool | Description |
|------|-------------|
| `list_cards` | List all vocabulary cards (with optional search/tag filter) |
| `get_card` | Get a single card by ID or term |
| `create_card` | Create a new vocabulary card |
| `update_card` | Update an existing card |
| `delete_card` | Soft delete a card |

### Events (Read-only)

| Tool | Description |
|------|-------------|
| `list_events` | List review events (learning history) |

### Index Management

| Tool | Description |
|------|-------------|
| `get_index` | Get current index status |
| `rebuild_index` | Rebuild index from cards and events |
| `get_storage_path` | Get the storage path location |

## Examples

### Create a card with morphemes

```
Use create_card to add "ephemeral" with:
- phonetic: /ɪˈfem.ər.əl/
- morphemes: ["ephe", "meral"]
- translation: "短暂的"
- example: "Fame is ephemeral."
```

### Create a simple card

```
Use create_card to add "ephemeral" with translation "短暂的" and example "Fame is ephemeral."
```

### List cards with filter

```
Use list_cards to find cards with tag "GRE"
```

### Update a card with morphemes

```
Use update_card to add morphemes ["trans", "ient"] and synonyms ["ephemeral", "fleeting"] to card id "xxx"
```

### Update card synonyms

```
Use update_card to add synonyms ["transient", "fleeting"] to card id "xxx"
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `WORDSLASH_STORAGE_PATH` | Custom storage path | VS Code globalStorage path |

## Storage Location

Default storage paths:

- **macOS**: `~/Library/Application Support/Code/User/globalStorage/wordslash.wordslash/`
- **Windows**: `%APPDATA%/Code/User/globalStorage/wordslash.wordslash/`
- **Linux**: `~/.config/Code/User/globalStorage/wordslash.wordslash/`

## Data Files

| File | Description | Operations |
|------|-------------|------------|
| `cards.jsonl` | Vocabulary cards (JSONL format) | Read/Write |
| `events.jsonl` | Review events | Read-only |
| `index.json` | Cached index | Read/Write (via rebuild) |
