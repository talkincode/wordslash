# WordSlash - AI Coding Agent Instructions

## Project Overview

WordSlash is a VS Code extension for English vocabulary learning with spaced repetition. It provides a closed-loop learning experience: add flashcards from selected text → review with SM-2 algorithm → track progress.

> 📌 VS Code 扩展，用于英语词汇学习，基于 SM-2 间隔重复算法。

## Architecture (Must Follow)

```
src/
├── extension.ts          # Entry point, register commands
├── storage/
│   ├── schema.ts         # Types: Card, ReviewEvent, SrsState, Meta
│   ├── storage.ts        # JSONL read/write with atomic operations
│   └── indexer.ts        # Rebuild index from events (event sourcing)
├── srs/
│   ├── sm2.ts            # SM-2 algorithm implementation
│   └── scheduler.ts      # Next card selection strategy
├── commands/             # VS Code command handlers
└── webview/
    ├── panel.ts          # Webview creation + message router
    ├── protocol.ts       # Message type definitions
    └── ui/               # Vanilla TS + CSS (v0.1-v0.2), Preact allowed after v0.3
```

> 📌 严格遵循目录结构，v0.1-v0.2 禁止 UI 框架，v0.3 后可选 Preact。

## Data Storage Constraints

- **Primary storage**: `context.globalStorageUri` (VS Code globalStorage)
- **Format**: JSONL with event sourcing pattern
  - `cards.jsonl` - Card entities (append new versions, don't modify)
  - `events.jsonl` - Review events (append-only, never modify history)
  - `index.json` - Rebuildable cache (can be deleted and regenerated)
- **Atomic writes**: Always write to `.tmp` file first, then `fs.rename()`
- **SrsState must be recalculable** from events - index is just cache
- **Import idempotency**: Same backup imported twice = no duplicates (by id + version)

> 📌 原子写入：先写 `.tmp` 再 rename；导入必须幂等（相同备份多次导入无副作用）。

## VS Code API Isolation

All VS Code API calls (`vscode.*`) must be isolated in specific modules:
- `extension.ts` - activation, command registration
- `commands/*.ts` - command handlers
- `webview/panel.ts` - webview management

**Pure modules** (no vscode imports, fully testable):
- `storage/schema.ts`, `storage/storage.ts`, `storage/indexer.ts`
- `srs/sm2.ts`, `srs/scheduler.ts`
- `webview/protocol.ts`

> 📌 纯逻辑模块禁止导入 vscode，便于单元测试。

## SM-2 Algorithm (Fixed Implementation)

Rating mapping (do not change):
- `again` → quality=0 (reset: reps=0, interval=1, lapses++)
- `hard` → quality=3
- `good` → quality=4
- `easy` → quality=5

Interval progression: 1 day → 6 days → interval × EF
EF formula: `EF + (0.1 - (5-q)*(0.08+(5-q)*0.02))`, minimum 1.3

> 📌 SM-2 参数固定，不可修改。EF 下限 1.3。

## Webview Protocol (Strict)

**UI → Extension:**
```typescript
| { type: "ui_ready" }
| { type: "get_next_card" }
| { type: "rate_card"; cardId: string; rating: ReviewRating; mode: "flashcard" }
| { type: "reveal_back"; cardId: string }
| { type: "next" }
```

**Extension → UI:**
```typescript
| { type: "card"; card: Card; srs?: SrsState }
| { type: "empty"; message: string }
| { type: "error"; message: string }
```

> 📌 消息协议固定，新增字段须向后兼容。

## LLM Integration (Stub Only in v1)

```typescript
// src/llm/generator.ts - Interface is fixed, implementation is stub
interface BackContentGenerator {
  generate(card: Card): Promise<Partial<Card["back"]> | null>;
}

// v1 stub implementation - returns null, no real API calls
class StubGenerator implements BackContentGenerator {
  async generate(_card: Card): Promise<null> { return null; }
}
```

> 📌 v1 仅保留接口，返回 null，不做真实 LLM 调用。

## Commands (Exact Names)

- `wordslash.openFlashcards` - Open Webview
- `wordslash.addCardFromSelection` - Create card from editor selection
- `wordslash.exportBackup` - Export to user-selected directory
- `wordslash.importBackup` - Import with merge (latest version wins by id)

## Testing with Vitest (Required Config)

**vitest.config.ts** (use this exact config):
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/test/**', 'src/extension.ts', 'src/commands/**', 'src/webview/panel.ts'],
    },
  },
});
```

**Mock rules**:
- Mock `vscode` module in tests: `vi.mock('vscode', () => ({ ... }))`
- Use temp directories for storage tests: `fs.mkdtemp()`
- Time-sensitive tests: use `vi.useFakeTimers()` and `vi.setSystemTime()`

```typescript
// Example: mocking vscode
vi.mock('vscode', () => ({
  Uri: { file: (p: string) => ({ fsPath: p }) },
  workspace: { getConfiguration: () => ({ get: () => undefined }) },
}));
```

**Commands**:
```bash
npm test              # Run all tests
npm test -- --watch   # Watch mode
npm test -- --coverage # Coverage report
npm run compile       # Build extension
# F5 in VS Code       # Launch Extension Development Host
```

## Privacy Default

- `wordslash.privacy.storeFilePath` defaults to `false`
- When false, `Card.front.context.filePath` must be `undefined`
- Only store `langId` and `lineText` by default

> 📌 隐私优先：默认不存储文件路径。

Test coverage targets:
- `srs/` ≥ 95% (core algorithm)
- `storage/` ≥ 90%
- Overall ≥ 85%

## Key Patterns

1. **Card versioning**: Each update increments `version` field, import takes highest
2. **Soft delete**: Set `deleted: true`, don't remove from JSONL
3. **Privacy option**: `storeFilePath` setting controls whether file paths are saved
4. **Next card selection**: Due cards first (earliest dueAt), then new cards as fallback

## v1 Scope (Do Not Exceed)

✅ In scope: JSONL storage, SM-2, flashcard webview, export/import, basic tests
❌ Out of scope: Cloud sync, complex animations, dictionary integration, LLM generation (stub only)

## Testing Requirements

Must pass these manual acceptance tests:
1. Select word → Right-click Add → Open Flashcards → Card appears immediately
2. Click Again → ReviewEvent created → Auto-flip to back (even if empty)
3. Click Easy → Direct to next card (no flip)
4. Export → Delete globalStorage → Import → Data restored, due dates continue
