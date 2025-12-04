# Change Log

All notable changes to the "wordslash" extension will be documented in this file.

## [0.1.0] - 2025-12-03

### Added
- 🎯 **Core Features**
  - Select text in editor to create vocabulary flashcards
  - SM-2 spaced repetition algorithm for optimal learning
  - Four-level rating system (Again/Hard/Good/Easy)
  - Automatic word extraction from cursor position
  
- 📊 **Dashboard**
  - Statistics overview (total cards, due cards, reviews, retention rate)
  - Knowledge graph visualization with force-directed layout
  - Interactive nodes (double-click to view card details)
  - Zoom and pan controls
  
- 💾 **Data Management**
  - JSONL storage with event sourcing architecture
  - Export/Import backup functionality
  - Atomic writes for data safety
  - Card versioning support
  
- 🔊 **TTS (Text-to-Speech)**
  - Multiple TTS engines (Youdao, Google, Browser)
  - Auto-play on card display
  - Manual playback controls
  - Configurable speech rate
  
- 🎨 **Flashcard Features**
  - Clean and focused UI
  - Morpheme segmentation display
  - Phonetic notation
  - Example sentences with translations
  - Synonyms and antonyms
  - Refresh functionality
  
- 🔧 **Settings**
  - Privacy: option to store/hide file paths
  - TTS engine selection
  - Auto-play configuration
  - Backup directory settings
  
- 🌐 **MCP Integration**
  - Model Context Protocol server for AI assistants
  - Published as npm package: `wordslash-mcp`
  - CRUD operations via MCP tools
  - Dashboard stats and knowledge graph generation

### Technical
- TypeScript implementation
- Pure modules (testable, no VS Code dependency)
- Vitest for unit testing
- ESLint + Prettier for code quality
- Event sourcing pattern for data integrity
