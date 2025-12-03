# WordSlash MCP Server v0.2.0 Release Notes

## 🎉 Release Summary

This release adds powerful new features for word learning: morpheme segmentation support, comprehensive dashboard statistics, and knowledge graph generation.

## ✨ New Features

### 1. Morpheme Segmentation
Break down complex words into meaningful morphological units to better understand word structure and etymology.

**Usage:**
```javascript
// Create a card with morphemes
{
  "term": "ephemeral",
  "phonetic": "/ɪˈfem.ər.əl/",
  "morphemes": ["ephe", "meral"],
  "translation": "短暂的"
}

// Update existing card with morphemes
{
  "id": "card-uuid",
  "morphemes": ["un", "break", "able"]
}
```

**Benefits:**
- Learn word roots, prefixes, and suffixes
- Better vocabulary retention through structural understanding
- Visual morpheme display in flashcards (word + breakdown)

### 2. Dashboard Statistics API
Get comprehensive learning analytics through the new `get_dashboard_stats` tool.

**Metrics provided:**
- Total cards, due cards, new cards, learned cards, mastered cards
- Total reviews and reviews today
- Current learning streak (consecutive days)
- Average ease factor and retention rate
- Card distribution by type (word/phrase/sentence)
- Ratings distribution (again/hard/good/easy)
- Reviews per day for last 30 days

**Example response:**
```json
{
  "totalCards": 150,
  "dueCards": 12,
  "newCards": 8,
  "learnedCards": 130,
  "masteredCards": 45,
  "totalReviews": 850,
  "reviewsToday": 15,
  "currentStreak": 7,
  "averageEaseFactor": 2.65,
  "retentionRate": 0.85,
  "cardsByType": {
    "word": 120,
    "phrase": 25,
    "sentence": 5
  }
}
```

### 3. Knowledge Graph Generation
Visualize vocabulary relationships through the new `generate_knowledge_graph` tool.

**Features:**
- Nodes for vocabulary cards, synonyms, antonyms, and tags
- Edges showing relationships between words
- Configurable max nodes and orphan filtering
- Tag-based filtering for focused graphs

**Parameters:**
- `maxNodes`: Limit graph size (default: 100)
- `includeOrphans`: Include cards without connections (default: false)
- `tag`: Filter by specific tag

**Example output:**
```json
{
  "nodes": [
    {
      "id": "card-uuid",
      "label": "ephemeral",
      "type": "card",
      "masteryLevel": 3,
      "weight": 1.4
    },
    {
      "id": "synonym:transient",
      "label": "transient",
      "type": "synonym",
      "weight": 0.5
    }
  ],
  "edges": [
    {
      "source": "card-uuid",
      "target": "synonym:transient",
      "type": "synonym",
      "weight": 1
    }
  ]
}
```

## 🔧 API Changes

### Updated Interfaces

**CardFront:**
```typescript
interface CardFront {
  term: string;
  phonetic?: string;
  morphemes?: string[];  // NEW
  example?: string;
  exampleCn?: string;
  context?: CardContext;
}
```

**CreateCardInput:**
```typescript
interface CreateCardInput {
  term: string;
  morphemes?: string[];  // NEW
  // ... other fields
}
```

**UpdateCardInput:**
```typescript
interface UpdateCardInput {
  morphemes?: string[];  // NEW
  // ... other fields
}
```

## 📦 Installation

### From npm (when published)
```bash
npm install -g wordslash-mcp
```

### From source
```bash
cd scripts/mcp-server
npm install
npm run build
```

## 🚀 Usage

### Claude Desktop Configuration
```json
{
  "mcpServers": {
    "wordslash": {
      "command": "node",
      "args": ["/path/to/wordslash/scripts/mcp-server/dist/index.js"]
    }
  }
}
```

## 📚 Documentation

- Full API documentation: [README.md](./README.md)
- Changelog: [CHANGELOG.md](./CHANGELOG.md)

## 🐛 Bug Reports

Please report issues at: https://github.com/talkincode/wordslash/issues

## 📄 License

MIT
