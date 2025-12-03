# Changelog

All notable changes to the WordSlash MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2025-12-03

### Added
- **Morpheme segmentation support**: New `morphemes` field for word breakdown
  - Added to `create_card` tool: create cards with morpheme arrays (e.g., `["ephe", "meral"]`)
  - Added to `update_card` tool: update existing cards with morpheme segmentation
  - Morphemes are stored in `CardFront` interface as `string[]`
- **Dashboard statistics**: New `get_dashboard_stats` tool for comprehensive learning analytics
  - Card counts by type (word/phrase/sentence)
  - Review statistics and retention rate
  - Streak tracking
  - Reviews per day (last 30 days)
  - Ratings distribution
- **Knowledge graph generation**: New `generate_knowledge_graph` tool
  - Visualize vocabulary relationships through synonyms, antonyms, and tags
  - Configurable max nodes and orphan filtering
  - Tag-based graph filtering

### Changed
- Updated `CreateCardInput` and `UpdateCardInput` types to include `morphemes` field
- Enhanced card creation/update logic to handle morpheme arrays
- Improved README with morpheme usage examples

### Fixed
- None

## [0.1.3] - 2025-12-02

### Added
- Initial MCP server implementation
- Basic CRUD operations for vocabulary cards
- Review events read access
- Index management tools

### Features
- `list_cards`: List all vocabulary cards with filtering
- `get_card`: Get single card by ID or term
- `create_card`: Create new vocabulary cards
- `update_card`: Update existing cards
- `delete_card`: Soft delete cards
- `delete_cards_batch`: Batch delete with safety confirmation
- `list_events`: Access review history
- `get_index`: Get index status
- `rebuild_index`: Rebuild index from data
- `get_storage_path`: Get storage location

[0.2.0]: https://github.com/talkincode/wordslash/compare/v0.1.3...v0.2.0
[0.1.3]: https://github.com/talkincode/wordslash/releases/tag/v0.1.3
