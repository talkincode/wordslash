# WordSlash 开发计划

> 🎯 **开发原则**: TDD（测试驱动开发），测试先行，红-绿-重构循环

---

## 📋 目录

- [开发环境搭建](#phase-0-开发环境搭建)
- [Phase 1: 数据层基础](#phase-1-数据层基础-优先级-p0)
- [Phase 2: SRS 调度引擎](#phase-2-srs-调度引擎-优先级-p0)
- [Phase 3: VS Code 集成](#phase-3-vs-code-集成-优先级-p0)
- [Phase 4: Webview UI](#phase-4-webview-ui-优先级-p0)
- [Phase 5: 备份恢复](#phase-5-备份恢复-优先级-p1)
- [Phase 6: 体验优化](#phase-6-体验优化-优先级-p2)
- [Phase 7: LLM 集成](#phase-7-llm-集成-优先级-p3)

---

## Phase 0: 开发环境搭建

### 目标
搭建完整的开发环境，配置测试框架，确保 TDD 流程可执行。

### 任务清单

| # | 任务 | 产出 | 预估时间 |
|---|------|------|----------|
| 0.1 | 初始化 VS Code 扩展项目 | `package.json`, `tsconfig.json` | 15min |
| 0.2 | 配置 ESLint + Prettier | `.eslintrc.js`, `.prettierrc` | 10min |
| 0.3 | 配置测试框架 (Vitest/Mocha) | `vitest.config.ts` 或 `mocharc.json` | 20min |
| 0.4 | 创建目录结构 | `src/` 目录树 | 10min |
| 0.5 | 配置 CI (GitHub Actions) | `.github/workflows/test.yml` | 15min |
| 0.6 | 编写第一个占位测试 | `src/test/example.test.ts` ✅ | 5min |

### 验收标准
- [ ] `npm test` 能运行并通过
- [ ] `npm run compile` 无错误
- [ ] F5 能启动扩展开发宿主

### 命令模板
```bash
# 创建项目
npx yo code --extensionType=ts --extensionName=wordslash

# 安装测试框架 (推荐 Vitest)
npm install -D vitest @vitest/coverage-v8

# 或使用 Mocha (VS Code 官方推荐)
npm install -D mocha @types/mocha chai @types/chai ts-node
```

---

## Phase 1: 数据层基础 (优先级: P0)

### 目标
实现可靠的本地数据存储，支持 JSONL 格式的追加写入和原子操作。

### 1.1 类型定义 (schema.ts)

#### 测试用例 (先写测试)

```typescript
// src/test/storage/schema.test.ts

describe('Schema Types', () => {
  describe('Card', () => {
    it('should create a valid word card with minimal fields', () => {
      const card = createCard({
        type: 'word',
        front: { term: 'ephemeral' }
      });
      expect(card.id).toBeDefined();
      expect(card.type).toBe('word');
      expect(card.front.term).toBe('ephemeral');
      expect(card.version).toBe(1);
      expect(card.createdAt).toBeCloseTo(Date.now(), -2);
    });

    it('should create a card with full context', () => {
      const card = createCard({
        type: 'sentence',
        front: {
          term: 'The quick brown fox',
          example: 'Typing test sentence',
          context: {
            langId: 'typescript',
            filePath: '/src/app.ts',
            lineText: 'const msg = "The quick brown fox";'
          }
        },
        back: {
          translation: '敏捷的棕色狐狸',
          explanation: 'A common typing test sentence'
        },
        tags: ['typing', 'test']
      });
      expect(card.front.context?.langId).toBe('typescript');
      expect(card.back?.translation).toBeDefined();
    });

    it('should increment version on update', () => {
      const card = createCard({ type: 'word', front: { term: 'test' } });
      const updated = updateCard(card, { back: { translation: '测试' } });
      expect(updated.version).toBe(2);
      expect(updated.updatedAt).toBeGreaterThan(card.createdAt);
    });
  });

  describe('ReviewEvent', () => {
    it('should create a valid review event', () => {
      const event = createReviewEvent({
        cardId: 'card-123',
        rating: 'good',
        mode: 'flashcard'
      });
      expect(event.id).toBeDefined();
      expect(event.kind).toBe('review');
      expect(event.ts).toBeCloseTo(Date.now(), -2);
    });

    it('should include optional duration', () => {
      const event = createReviewEvent({
        cardId: 'card-123',
        rating: 'again',
        mode: 'flashcard',
        durationMs: 5000
      });
      expect(event.durationMs).toBe(5000);
    });
  });
});
```

#### 实现任务
| # | 任务 | TDD 状态 |
|---|------|----------|
| 1.1.1 | 定义 `Card` 类型 | 🔴 Red → 🟢 Green |
| 1.1.2 | 定义 `ReviewEvent` 类型 | 🔴 Red → 🟢 Green |
| 1.1.3 | 定义 `SrsState` 类型 | 🔴 Red → 🟢 Green |
| 1.1.4 | 定义 `Meta` 类型 | 🔴 Red → 🟢 Green |
| 1.1.5 | 实现 `createCard()` 工厂函数 | 🔴 Red → 🟢 Green |
| 1.1.6 | 实现 `updateCard()` 函数 | 🔴 Red → 🟢 Green |
| 1.1.7 | 实现 `createReviewEvent()` 工厂函数 | 🔴 Red → 🟢 Green |

---

### 1.2 JSONL 存储 (storage.ts)

#### 测试用例 (先写测试)

```typescript
// src/test/storage/storage.test.ts

describe('JSONL Storage', () => {
  let tempDir: string;
  let storage: JsonlStorage;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wordslash-test-'));
    storage = new JsonlStorage(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true });
  });

  describe('append()', () => {
    it('should append a single record to file', async () => {
      const card = createCard({ type: 'word', front: { term: 'test' } });
      await storage.appendCard(card);
      
      const content = await fs.readFile(
        path.join(tempDir, 'cards.jsonl'), 
        'utf-8'
      );
      expect(content.trim()).toBe(JSON.stringify(card));
    });

    it('should append multiple records with newlines', async () => {
      const card1 = createCard({ type: 'word', front: { term: 'one' } });
      const card2 = createCard({ type: 'word', front: { term: 'two' } });
      
      await storage.appendCard(card1);
      await storage.appendCard(card2);
      
      const lines = (await fs.readFile(
        path.join(tempDir, 'cards.jsonl'), 
        'utf-8'
      )).trim().split('\n');
      
      expect(lines).toHaveLength(2);
    });
  });

  describe('readAll()', () => {
    it('should read all cards from file', async () => {
      const card1 = createCard({ type: 'word', front: { term: 'one' } });
      const card2 = createCard({ type: 'word', front: { term: 'two' } });
      
      await storage.appendCard(card1);
      await storage.appendCard(card2);
      
      const cards = await storage.readAllCards();
      expect(cards).toHaveLength(2);
      expect(cards[0].front.term).toBe('one');
      expect(cards[1].front.term).toBe('two');
    });

    it('should return empty array for non-existent file', async () => {
      const cards = await storage.readAllCards();
      expect(cards).toEqual([]);
    });

    it('should skip invalid JSON lines', async () => {
      await fs.writeFile(
        path.join(tempDir, 'cards.jsonl'),
        '{"valid": true}\ninvalid json\n{"also": "valid"}\n'
      );
      
      // 应该记录警告但不崩溃
      const result = await storage.readAllCards();
      expect(result).toHaveLength(2);
    });
  });

  describe('atomicWrite()', () => {
    it('should write atomically using temp file', async () => {
      const data = { test: 'data' };
      await storage.atomicWriteJson('test.json', data);
      
      const content = await fs.readFile(
        path.join(tempDir, 'test.json'), 
        'utf-8'
      );
      expect(JSON.parse(content)).toEqual(data);
    });

    it('should not leave temp file on success', async () => {
      await storage.atomicWriteJson('test.json', { data: 1 });
      
      const files = await fs.readdir(tempDir);
      expect(files.filter(f => f.endsWith('.tmp'))).toHaveLength(0);
    });

    it('should handle concurrent writes safely', async () => {
      const writes = Array.from({ length: 10 }, (_, i) => 
        storage.appendCard(createCard({ 
          type: 'word', 
          front: { term: `word-${i}` } 
        }))
      );
      
      await Promise.all(writes);
      
      const cards = await storage.readAllCards();
      expect(cards).toHaveLength(10);
    });
  });
});
```

#### 实现任务
| # | 任务 | TDD 状态 |
|---|------|----------|
| 1.2.1 | 实现 `JsonlStorage` 类基础结构 | 🔴 Red → 🟢 Green |
| 1.2.2 | 实现 `appendCard()` 追加写入 | 🔴 Red → 🟢 Green |
| 1.2.3 | 实现 `appendEvent()` 追加写入 | 🔴 Red → 🟢 Green |
| 1.2.4 | 实现 `readAllCards()` 读取 | 🔴 Red → 🟢 Green |
| 1.2.5 | 实现 `readAllEvents()` 读取 | 🔴 Red → 🟢 Green |
| 1.2.6 | 实现 `atomicWriteJson()` 原子写入 | 🔴 Red → 🟢 Green |
| 1.2.7 | 实现并发写入锁机制 | 🔴 Red → 🟢 Green |
| 1.2.8 | 重构：提取公共逻辑 | 🔵 Refactor |

---

### 1.3 索引管理 (indexer.ts)

#### 测试用例 (先写测试)

```typescript
// src/test/storage/indexer.test.ts

describe('Indexer', () => {
  describe('buildIndex()', () => {
    it('should build index from cards with latest versions', () => {
      const cards: Card[] = [
        { ...createCard({ type: 'word', front: { term: 'a' } }), id: '1', version: 1 },
        { ...createCard({ type: 'word', front: { term: 'a-updated' } }), id: '1', version: 2 },
        { ...createCard({ type: 'word', front: { term: 'b' } }), id: '2', version: 1 },
      ];
      
      const index = buildIndex(cards, []);
      
      expect(index.cards.size).toBe(2);
      expect(index.cards.get('1')?.front.term).toBe('a-updated');
    });

    it('should exclude soft-deleted cards', () => {
      const cards: Card[] = [
        { ...createCard({ type: 'word', front: { term: 'a' } }), id: '1', deleted: true },
        { ...createCard({ type: 'word', front: { term: 'b' } }), id: '2' },
      ];
      
      const index = buildIndex(cards, []);
      
      expect(index.cards.size).toBe(1);
      expect(index.cards.has('1')).toBe(false);
    });

    it('should compute SRS state from events', () => {
      const cards: Card[] = [
        { ...createCard({ type: 'word', front: { term: 'test' } }), id: '1' },
      ];
      const events: ReviewEvent[] = [
        { ...createReviewEvent({ cardId: '1', rating: 'good', mode: 'flashcard' }), ts: 1000 },
        { ...createReviewEvent({ cardId: '1', rating: 'good', mode: 'flashcard' }), ts: 2000 },
      ];
      
      const index = buildIndex(cards, events);
      
      const srs = index.srsStates.get('1');
      expect(srs).toBeDefined();
      expect(srs?.reps).toBe(2);
      expect(srs?.intervalDays).toBeGreaterThan(1);
    });
  });

  describe('getDueCards()', () => {
    it('should return cards with dueAt <= now', () => {
      const now = Date.now();
      const index: Index = {
        cards: new Map([
          ['1', createCard({ type: 'word', front: { term: 'due' } })],
          ['2', createCard({ type: 'word', front: { term: 'not-due' } })],
        ]),
        srsStates: new Map([
          ['1', { cardId: '1', dueAt: now - 1000, intervalDays: 1, easeFactor: 2.5, reps: 1, lapses: 0 }],
          ['2', { cardId: '2', dueAt: now + 86400000, intervalDays: 1, easeFactor: 2.5, reps: 1, lapses: 0 }],
        ]),
      };
      
      const dueCards = getDueCards(index, now);
      
      expect(dueCards).toHaveLength(1);
      expect(dueCards[0].id).toBe('1');
    });

    it('should return new cards (no SRS state) as due', () => {
      const index: Index = {
        cards: new Map([
          ['1', createCard({ type: 'word', front: { term: 'new' } })],
        ]),
        srsStates: new Map(),
      };
      
      const dueCards = getDueCards(index, Date.now());
      
      expect(dueCards).toHaveLength(1);
    });
  });
});
```

#### 实现任务
| # | 任务 | TDD 状态 |
|---|------|----------|
| 1.3.1 | 定义 `Index` 类型 | 🔴 Red → 🟢 Green |
| 1.3.2 | 实现 `buildIndex()` 函数 | 🔴 Red → 🟢 Green |
| 1.3.3 | 实现卡片去重（取最新版本） | 🔴 Red → 🟢 Green |
| 1.3.4 | 实现软删除过滤 | 🔴 Red → 🟢 Green |
| 1.3.5 | 实现 `getDueCards()` 函数 | 🔴 Red → 🟢 Green |
| 1.3.6 | 实现 `getNewCards()` 函数 | 🔴 Red → 🟢 Green |
| 1.3.7 | 实现 `saveIndex()` / `loadIndex()` | 🔴 Red → 🟢 Green |

---

## Phase 2: SRS 调度引擎 (优先级: P0)

### 目标
实现 SM-2 间隔重复算法和下一张卡片选择策略。

### 2.1 SM-2 算法 (sm2.ts)

#### 测试用例 (先写测试)

```typescript
// src/test/srs/sm2.test.ts

describe('SM-2 Algorithm', () => {
  describe('ratingToQuality()', () => {
    it.each([
      ['again', 0],
      ['hard', 3],
      ['good', 4],
      ['easy', 5],
    ])('should map %s to quality %d', (rating, expected) => {
      expect(ratingToQuality(rating as ReviewRating)).toBe(expected);
    });
  });

  describe('calculateNextState()', () => {
    const initialState: SrsState = {
      cardId: 'test',
      dueAt: 0,
      intervalDays: 0,
      easeFactor: 2.5,
      reps: 0,
      lapses: 0,
    };

    describe('first review', () => {
      it('should set interval to 1 day on first "good"', () => {
        const next = calculateNextState(initialState, 'good', Date.now());
        expect(next.intervalDays).toBe(1);
        expect(next.reps).toBe(1);
      });

      it('should set interval to 1 day on "again" and increment lapses', () => {
        const next = calculateNextState(initialState, 'again', Date.now());
        expect(next.intervalDays).toBe(1);
        expect(next.reps).toBe(0);
        expect(next.lapses).toBe(1);
      });
    });

    describe('second review', () => {
      const afterFirstReview: SrsState = {
        ...initialState,
        reps: 1,
        intervalDays: 1,
      };

      it('should set interval to 6 days on second "good"', () => {
        const next = calculateNextState(afterFirstReview, 'good', Date.now());
        expect(next.intervalDays).toBe(6);
        expect(next.reps).toBe(2);
      });
    });

    describe('third+ review', () => {
      const afterSecondReview: SrsState = {
        ...initialState,
        reps: 2,
        intervalDays: 6,
        easeFactor: 2.5,
      };

      it('should multiply interval by EF on "good"', () => {
        const next = calculateNextState(afterSecondReview, 'good', Date.now());
        expect(next.intervalDays).toBe(Math.round(6 * 2.5)); // 15
        expect(next.reps).toBe(3);
      });

      it('should adjust EF based on quality', () => {
        const nextGood = calculateNextState(afterSecondReview, 'good', Date.now());
        const nextEasy = calculateNextState(afterSecondReview, 'easy', Date.now());
        
        // easy 应该提高 EF，good 保持相对稳定
        expect(nextEasy.easeFactor).toBeGreaterThan(nextGood.easeFactor);
      });
    });

    describe('EF boundaries', () => {
      it('should not let EF drop below 1.3', () => {
        let state = { ...initialState, reps: 3, intervalDays: 10, easeFactor: 1.4 };
        
        // 连续 again 应该让 EF 降低但不低于 1.3
        for (let i = 0; i < 5; i++) {
          state = calculateNextState(state, 'hard', Date.now());
        }
        
        expect(state.easeFactor).toBeGreaterThanOrEqual(1.3);
      });
    });

    describe('dueAt calculation', () => {
      it('should set dueAt to now + intervalDays', () => {
        const now = Date.now();
        const next = calculateNextState(initialState, 'good', now);
        
        const expectedDue = now + next.intervalDays * 24 * 60 * 60 * 1000;
        expect(next.dueAt).toBe(expectedDue);
      });
    });
  });

  describe('integration: review sequence', () => {
    it('should follow expected intervals for perfect reviews', () => {
      let state: SrsState = {
        cardId: 'test',
        dueAt: 0,
        intervalDays: 0,
        easeFactor: 2.5,
        reps: 0,
        lapses: 0,
      };

      // Perfect sequence: good, good, good, good
      const expectedIntervals = [1, 6, 15, 38]; // 大约值

      expectedIntervals.forEach((expected, i) => {
        state = calculateNextState(state, 'good', Date.now());
        expect(state.intervalDays).toBeCloseTo(expected, 0);
      });
    });
  });
});
```

#### 实现任务
| # | 任务 | TDD 状态 |
|---|------|----------|
| 2.1.1 | 实现 `ratingToQuality()` 映射函数 | 🔴 Red → 🟢 Green |
| 2.1.2 | 实现 `calculateEF()` EF 更新公式 | 🔴 Red → 🟢 Green |
| 2.1.3 | 实现 `calculateInterval()` 间隔计算 | 🔴 Red → 🟢 Green |
| 2.1.4 | 实现 `calculateNextState()` 完整状态更新 | 🔴 Red → 🟢 Green |
| 2.1.5 | 边界测试：EF 下限 1.3 | 🔴 Red → 🟢 Green |
| 2.1.6 | 集成测试：完整复习序列 | 🔴 Red → 🟢 Green |

---

### 2.2 调度器 (scheduler.ts)

#### 测试用例 (先写测试)

```typescript
// src/test/srs/scheduler.test.ts

describe('Scheduler', () => {
  describe('getNextCard()', () => {
    it('should return due card with earliest dueAt first', () => {
      const now = Date.now();
      const index: Index = {
        cards: new Map([
          ['1', { ...createCard({ type: 'word', front: { term: 'first' } }), id: '1' }],
          ['2', { ...createCard({ type: 'word', front: { term: 'second' } }), id: '2' }],
        ]),
        srsStates: new Map([
          ['1', { cardId: '1', dueAt: now - 1000, intervalDays: 1, easeFactor: 2.5, reps: 1, lapses: 0 }],
          ['2', { cardId: '2', dueAt: now - 5000, intervalDays: 1, easeFactor: 2.5, reps: 1, lapses: 0 }],
        ]),
      };

      const next = getNextCard(index, now);
      
      expect(next?.id).toBe('2'); // 更早 due 的优先
    });

    it('should return new card if no due cards', () => {
      const now = Date.now();
      const index: Index = {
        cards: new Map([
          ['1', { ...createCard({ type: 'word', front: { term: 'new' } }), id: '1' }],
        ]),
        srsStates: new Map(), // 新卡没有 SRS 状态
      };

      const next = getNextCard(index, now);
      
      expect(next?.id).toBe('1');
    });

    it('should return null if no cards at all', () => {
      const index: Index = {
        cards: new Map(),
        srsStates: new Map(),
      };

      const next = getNextCard(index, Date.now());
      
      expect(next).toBeNull();
    });

    it('should return null if only future due cards', () => {
      const now = Date.now();
      const index: Index = {
        cards: new Map([
          ['1', { ...createCard({ type: 'word', front: { term: 'future' } }), id: '1' }],
        ]),
        srsStates: new Map([
          ['1', { cardId: '1', dueAt: now + 86400000, intervalDays: 1, easeFactor: 2.5, reps: 1, lapses: 0 }],
        ]),
      };

      const next = getNextCard(index, now);
      
      expect(next).toBeNull();
    });

    it('should respect newCardsPerDay limit', () => {
      const now = Date.now();
      const today = new Date(now).toDateString();
      
      // 已经学了 10 张新卡
      const reviewedToday: ReviewEvent[] = Array.from({ length: 10 }, (_, i) => ({
        ...createReviewEvent({ cardId: `card-${i}`, rating: 'good', mode: 'flashcard' }),
        ts: now - 1000 * i,
      }));
      
      const index: Index = {
        cards: new Map([
          ['new-card', { ...createCard({ type: 'word', front: { term: 'new' } }), id: 'new-card' }],
        ]),
        srsStates: new Map(),
      };

      const next = getNextCard(index, now, { 
        newCardsPerDay: 10, 
        todayNewCardCount: 10 
      });
      
      expect(next).toBeNull(); // 新卡达到上限
    });
  });

  describe('getStats()', () => {
    it('should return correct due/new/total counts', () => {
      const now = Date.now();
      const index: Index = {
        cards: new Map([
          ['1', createCard({ type: 'word', front: { term: 'due' } })],
          ['2', createCard({ type: 'word', front: { term: 'new' } })],
          ['3', createCard({ type: 'word', front: { term: 'future' } })],
        ]),
        srsStates: new Map([
          ['1', { cardId: '1', dueAt: now - 1000, intervalDays: 1, easeFactor: 2.5, reps: 1, lapses: 0 }],
          ['3', { cardId: '3', dueAt: now + 86400000, intervalDays: 10, easeFactor: 2.5, reps: 5, lapses: 0 }],
        ]),
      };

      const stats = getStats(index, now);
      
      expect(stats.total).toBe(3);
      expect(stats.due).toBe(1);
      expect(stats.newCards).toBe(1);
      expect(stats.learning).toBe(0);
      expect(stats.mature).toBe(1); // intervalDays >= 21 才算 mature? 或根据 reps?
    });
  });
});
```

#### 实现任务
| # | 任务 | TDD 状态 |
|---|------|----------|
| 2.2.1 | 实现 `getNextCard()` 基础逻辑 | 🔴 Red → 🟢 Green |
| 2.2.2 | 实现 due 优先策略 | 🔴 Red → 🟢 Green |
| 2.2.3 | 实现新卡 fallback | 🔴 Red → 🟢 Green |
| 2.2.4 | 实现每日新卡上限 | 🔴 Red → 🟢 Green |
| 2.2.5 | 实现 `getStats()` 统计函数 | 🔴 Red → 🟢 Green |
| 2.2.6 | 可选：实现 cooldown 机制 | 🔴 Red → 🟢 Green |

---

## Phase 3: VS Code 集成 (优先级: P0)

### 目标
实现 VS Code 命令、右键菜单和扩展生命周期管理。

### 3.1 扩展入口 (extension.ts)

#### 测试用例

```typescript
// src/test/extension.test.ts

describe('Extension', () => {
  let context: vscode.ExtensionContext;

  beforeEach(() => {
    context = createMockExtensionContext();
  });

  describe('activate()', () => {
    it('should register all commands', async () => {
      await activate(context);
      
      expect(context.subscriptions.length).toBeGreaterThan(0);
      
      const commands = await vscode.commands.getCommands();
      expect(commands).toContain('wordslash.openFlashcards');
      expect(commands).toContain('wordslash.addCardFromSelection');
      expect(commands).toContain('wordslash.exportBackup');
      expect(commands).toContain('wordslash.importBackup');
    });

    it('should initialize storage on activation', async () => {
      await activate(context);
      
      // 检查 globalStorage 目录存在
      const storagePath = context.globalStorageUri.fsPath;
      expect(await fs.pathExists(storagePath)).toBe(true);
    });
  });
});
```

#### 实现任务
| # | 任务 | TDD 状态 |
|---|------|----------|
| 3.1.1 | 实现 `activate()` 函数 | 🔴 Red → 🟢 Green |
| 3.1.2 | 注册所有命令 | 🔴 Red → 🟢 Green |
| 3.1.3 | 初始化存储目录 | 🔴 Red → 🟢 Green |
| 3.1.4 | 实现 `deactivate()` 清理 | 🔴 Red → 🟢 Green |

---

### 3.2 添加卡片命令 (addCard.ts)

#### 测试用例

```typescript
// src/test/commands/addCard.test.ts

describe('addCard command', () => {
  describe('getTermFromEditor()', () => {
    it('should return selected text if available', () => {
      const selection = 'ephemeral';
      const result = getTermFromEditor(mockEditor(selection));
      expect(result.term).toBe('ephemeral');
    });

    it('should extract word at cursor if no selection', () => {
      const result = getTermFromEditor(mockEditorWithCursor('const value = 42;', 6));
      expect(result.term).toBe('value');
    });

    it('should include line text as example', () => {
      const result = getTermFromEditor(mockEditor('word', 'The full line context'));
      expect(result.example).toBe('The full line context');
    });

    it('should include context info when enabled', () => {
      const result = getTermFromEditor(
        mockEditor('term', 'line', 'typescript', '/src/app.ts'),
        { storeFilePath: true }
      );
      expect(result.context?.langId).toBe('typescript');
      expect(result.context?.filePath).toBe('/src/app.ts');
    });

    it('should omit filePath when privacy setting is off', () => {
      const result = getTermFromEditor(
        mockEditor('term', 'line', 'typescript', '/src/app.ts'),
        { storeFilePath: false }
      );
      expect(result.context?.filePath).toBeUndefined();
    });
  });

  describe('addCardCommand()', () => {
    it('should create card and append to storage', async () => {
      const storage = createMockStorage();
      
      await addCardCommand(mockEditor('test'), storage);
      
      expect(storage.appendCard).toHaveBeenCalledTimes(1);
      const card = storage.appendCard.mock.calls[0][0];
      expect(card.front.term).toBe('test');
    });

    it('should show info message on success', async () => {
      const storage = createMockStorage();
      
      await addCardCommand(mockEditor('test'), storage);
      
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('test')
      );
    });
  });
});
```

#### 实现任务
| # | 任务 | TDD 状态 |
|---|------|----------|
| 3.2.1 | 实现 `getTermFromEditor()` | 🔴 Red → 🟢 Green |
| 3.2.2 | 实现光标位置单词提取 | 🔴 Red → 🟢 Green |
| 3.2.3 | 实现上下文信息收集 | 🔴 Red → 🟢 Green |
| 3.2.4 | 实现 `addCardCommand()` | 🔴 Red → 🟢 Green |
| 3.2.5 | 配置右键菜单 (package.json) | 手动验证 |

---

### 3.3 package.json 配置

#### 任务
| # | 任务 | 说明 |
|---|------|------|
| 3.3.1 | 配置 `contributes.commands` | 四个命令 |
| 3.3.2 | 配置 `contributes.menus.editor/context` | 右键菜单 |
| 3.3.3 | 配置 `contributes.configuration` | 设置项 |
| 3.3.4 | 配置 `activationEvents` | 启动事件 |

---

## Phase 4: Webview UI (优先级: P0)

### 目标
实现闪卡复习的 Webview 界面和消息通信。

### 4.1 通信协议 (protocol.ts)

#### 测试用例

```typescript
// src/test/webview/protocol.test.ts

describe('Webview Protocol', () => {
  describe('message validation', () => {
    it('should validate UI to Extension messages', () => {
      expect(isValidUiMessage({ type: 'ui_ready' })).toBe(true);
      expect(isValidUiMessage({ type: 'get_next_card' })).toBe(true);
      expect(isValidUiMessage({ 
        type: 'rate_card', 
        cardId: '123', 
        rating: 'good', 
        mode: 'flashcard' 
      })).toBe(true);
      
      expect(isValidUiMessage({ type: 'unknown' })).toBe(false);
      expect(isValidUiMessage({ type: 'rate_card' })).toBe(false); // missing fields
    });
  });
});
```

#### 实现任务
| # | 任务 | TDD 状态 |
|---|------|----------|
| 4.1.1 | 定义 `UiToExt` 消息类型 | 🔴 Red → 🟢 Green |
| 4.1.2 | 定义 `ExtToUi` 消息类型 | 🔴 Red → 🟢 Green |
| 4.1.3 | 实现消息验证函数 | 🔴 Red → 🟢 Green |

---

### 4.2 Webview Panel (panel.ts)

#### 测试用例

```typescript
// src/test/webview/panel.test.ts

describe('Webview Panel', () => {
  describe('message handling', () => {
    it('should respond to ui_ready with first card', async () => {
      const panel = createMockPanel();
      const handler = createMessageHandler(mockStorage, mockScheduler);
      
      await handler({ type: 'ui_ready' });
      
      expect(panel.webview.postMessage).toHaveBeenCalledWith({
        type: 'card',
        card: expect.any(Object),
      });
    });

    it('should handle rate_card and respond with next', async () => {
      const handler = createMessageHandler(mockStorage, mockScheduler);
      
      await handler({ 
        type: 'rate_card', 
        cardId: '123', 
        rating: 'good', 
        mode: 'flashcard' 
      });
      
      // 应该写入事件
      expect(mockStorage.appendEvent).toHaveBeenCalled();
      // 应该更新 SRS 状态
      expect(mockScheduler.updateSrsState).toHaveBeenCalled();
    });

    it('should send empty message when no more cards', async () => {
      const handler = createMessageHandler(mockStorage, emptyScheduler);
      
      await handler({ type: 'get_next_card' });
      
      expect(panel.webview.postMessage).toHaveBeenCalledWith({
        type: 'empty',
        message: expect.any(String),
      });
    });
  });
});
```

#### 实现任务
| # | 任务 | TDD 状态 |
|---|------|----------|
| 4.2.1 | 实现 `FlashcardPanel` 类 | 🔴 Red → 🟢 Green |
| 4.2.2 | 实现 `createOrShow()` 单例模式 | 🔴 Red → 🟢 Green |
| 4.2.3 | 实现 `getWebviewContent()` HTML 生成 | 手动验证 |
| 4.2.4 | 实现消息路由 `handleMessage()` | 🔴 Red → 🟢 Green |
| 4.2.5 | 实现 `ui_ready` 处理 | 🔴 Red → 🟢 Green |
| 4.2.6 | 实现 `rate_card` 处理 | 🔴 Red → 🟢 Green |
| 4.2.7 | 实现 `reveal_back` 处理 | 🔴 Red → 🟢 Green |
| 4.2.8 | 实现 `next` 处理 | 🔴 Red → 🟢 Green |

---

### 4.3 Webview UI (ui/)

#### 任务
| # | 任务 | 说明 |
|---|------|------|
| 4.3.1 | 创建 `index.html` 骨架 | 结构 + VS Code 样式变量 |
| 4.3.2 | 实现 `app.ts` 状态机 | Front/Back 状态切换 |
| 4.3.3 | 实现 Front 视图渲染 | term + example + 按钮 |
| 4.3.4 | 实现 Back 视图渲染 | translation + explanation |
| 4.3.5 | 实现消息发送 | postMessage 到 Extension |
| 4.3.6 | 实现消息接收 | 监听 Extension 消息 |
| 4.3.7 | 样式：`styles.css` | 简洁、适配暗色主题 |

---

## Phase 5: 备份恢复 (优先级: P1)

### 目标
实现数据导出/导入功能，确保数据安全。

### 5.1 导出命令 (exportBackup.ts)

#### 测试用例

```typescript
// src/test/commands/exportBackup.test.ts

describe('exportBackup command', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'backup-test-'));
  });

  describe('exportBackup()', () => {
    it('should create backup files in target directory', async () => {
      const storage = createStorageWithData();
      
      await exportBackup(storage, tempDir);
      
      expect(await fs.pathExists(path.join(tempDir, 'wordslash-cards.jsonl'))).toBe(true);
      expect(await fs.pathExists(path.join(tempDir, 'wordslash-events.jsonl'))).toBe(true);
      expect(await fs.pathExists(path.join(tempDir, 'wordslash-meta.json'))).toBe(true);
    });

    it('should use atomic write (temp file then rename)', async () => {
      const storage = createStorageWithData();
      
      // 模拟写入过程中检查
      let sawTempFile = false;
      const originalWrite = fs.writeFile;
      fs.writeFile = jest.fn(async (path, data) => {
        if (path.toString().endsWith('.tmp')) sawTempFile = true;
        return originalWrite(path, data);
      });
      
      await exportBackup(storage, tempDir);
      
      expect(sawTempFile).toBe(true);
      
      // 完成后不应该有 .tmp 文件
      const files = await fs.readdir(tempDir);
      expect(files.filter(f => f.endsWith('.tmp'))).toHaveLength(0);
    });

    it('should include meta with schema version', async () => {
      await exportBackup(createStorageWithData(), tempDir);
      
      const meta = JSON.parse(
        await fs.readFile(path.join(tempDir, 'wordslash-meta.json'), 'utf-8')
      );
      
      expect(meta.schemaVersion).toBeDefined();
      expect(meta.exportedAt).toBeDefined();
    });
  });
});
```

#### 实现任务
| # | 任务 | TDD 状态 |
|---|------|----------|
| 5.1.1 | 实现 `exportBackup()` 函数 | 🔴 Red → 🟢 Green |
| 5.1.2 | 实现原子写入逻辑 | 🔴 Red → 🟢 Green |
| 5.1.3 | 实现命令集成 | 手动验证 |

---

### 5.2 导入命令 (importBackup.ts)

#### 测试用例

```typescript
// src/test/commands/importBackup.test.ts

describe('importBackup command', () => {
  describe('importBackup()', () => {
    it('should merge cards by id, keeping latest version', async () => {
      // 现有数据
      const existing = createStorageWithData([
        { id: '1', version: 1, front: { term: 'old' } },
      ]);
      
      // 备份数据
      const backup = createBackup([
        { id: '1', version: 2, front: { term: 'new' } },
        { id: '2', version: 1, front: { term: 'another' } },
      ]);
      
      await importBackup(existing, backup);
      
      const cards = await existing.readAllCards();
      expect(cards.find(c => c.id === '1')?.front.term).toBe('new');
      expect(cards.find(c => c.id === '2')).toBeDefined();
    });

    it('should dedupe events by id', async () => {
      const existing = createStorageWithData([], [
        { id: 'e1', cardId: '1', rating: 'good' },
      ]);
      
      const backup = createBackup([], [
        { id: 'e1', cardId: '1', rating: 'good' }, // duplicate
        { id: 'e2', cardId: '1', rating: 'easy' },
      ]);
      
      await importBackup(existing, backup);
      
      const events = await existing.readAllEvents();
      expect(events.filter(e => e.id === 'e1')).toHaveLength(1);
      expect(events.find(e => e.id === 'e2')).toBeDefined();
    });

    it('should rebuild index after import', async () => {
      const storage = createStorageWithData();
      const backup = createBackup([{ id: '1', front: { term: 'test' } }]);
      
      await importBackup(storage, backup);
      
      expect(storage.rebuildIndex).toHaveBeenCalled();
    });
  });
});
```

#### 实现任务
| # | 任务 | TDD 状态 |
|---|------|----------|
| 5.2.1 | 实现 `importBackup()` 函数 | 🔴 Red → 🟢 Green |
| 5.2.2 | 实现卡片去重合并逻辑 | 🔴 Red → 🟢 Green |
| 5.2.3 | 实现事件去重逻辑 | 🔴 Red → 🟢 Green |
| 5.2.4 | 触发索引重建 | 🔴 Red → 🟢 Green |
| 5.2.5 | 实现命令集成 | 手动验证 |

---

## Phase 6: 体验优化 (优先级: P2)

### 目标
提升用户体验，添加统计、快捷键等功能。

### 任务清单

| # | 任务 | 说明 | TDD 状态 |
|---|------|------|----------|
| 6.1 | 每日新卡上限 | 配置项 + Scheduler 集成 | 🔴 Red → 🟢 Green |
| 6.2 | 状态栏显示 | due 数量实时更新 | 手动验证 |
| 6.3 | 快捷键绑定 | Ctrl+Shift+W 打开复习 | package.json |
| 6.4 | 统计面板 | 今日复习数、正确率 | 🔴 Red → 🟢 Green |
| 6.5 | 键盘快捷键 | 1/2/3/4 对应评分 | Webview |

---

## Phase 7: LLM 集成 (优先级: P3)

### 目标
接入 LLM 自动生成卡片背面内容。

### 任务清单

| # | 任务 | 说明 | TDD 状态 |
|---|------|------|----------|
| 7.1 | 定义 `generateBackContent()` 接口 | Stub 实现 | 🔴 Red → 🟢 Green |
| 7.2 | Webview "Generate" 按钮 | UI 交互 | 手动验证 |
| 7.3 | VS Code Copilot Chat 集成 | 使用官方 API | 手动验证 |
| 7.4 | 自定义模型接入 | 配置项支持 | 🔴 Red → 🟢 Green |

---

## 📊 测试覆盖率目标

| 模块 | 目标覆盖率 |
|------|------------|
| `storage/` | ≥ 90% |
| `srs/` | ≥ 95% |
| `commands/` | ≥ 80% |
| `webview/` | ≥ 70% |
| **整体** | **≥ 85%** |

---

## 🔄 TDD 工作流程

### 每个任务的标准流程

```
1. 🔴 RED: 编写失败的测试
   └─ 运行 `npm test` 确认测试失败

2. 🟢 GREEN: 编写最少代码使测试通过
   └─ 运行 `npm test` 确认测试通过

3. 🔵 REFACTOR: 重构代码，保持测试通过
   └─ 运行 `npm test` 确认重构后仍通过
   └─ 运行 `npm run lint` 确认代码质量

4. ✅ COMMIT: 提交代码
   └─ git commit -m "feat(module): implement feature X"
```

### 测试命令

```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test -- src/test/srs/sm2.test.ts

# 监听模式（开发时）
npm test -- --watch

# 生成覆盖率报告
npm test -- --coverage
```

---

## 📅 时间估算

| Phase | 预估时间 | 累计 |
|-------|----------|------|
| Phase 0: 环境搭建 | 2 小时 | 2h |
| Phase 1: 数据层 | 8 小时 | 10h |
| Phase 2: SRS 引擎 | 6 小时 | 16h |
| Phase 3: VS Code 集成 | 6 小时 | 22h |
| Phase 4: Webview UI | 8 小时 | 30h |
| **v0.1 MVP 完成** | **30 小时** | - |
| Phase 5: 备份恢复 | 4 小时 | 34h |
| **v0.2 可靠性完成** | **34 小时** | - |
| Phase 6: 体验优化 | 6 小时 | 40h |
| Phase 7: LLM 集成 | 8 小时 | 48h |

---

## ✅ 里程碑检查点

### v0.1 MVP (Phase 0-4)
- [ ] 选中词可添加卡片
- [ ] 打开 Flashcards 可复习
- [ ] Again/Hard/Good/Easy 评分正常
- [ ] SM-2 间隔计算正确
- [ ] 数据持久化到 globalStorage

### v0.2 可靠性 (Phase 5)
- [ ] Export 功能正常
- [ ] Import 功能正常，数据恢复完整
- [ ] 测试覆盖率 ≥ 85%

### v0.3 体验 (Phase 6)
- [ ] 每日新卡上限生效
- [ ] 状态栏显示 due 数
- [ ] 键盘快捷键可用

### v0.4 智能 (Phase 7)
- [ ] Generate 按钮可生成背面内容
- [ ] LLM 接入配置可用

---

<p align="center">
  <strong>🚀 开始 TDD 之旅：先写测试，再写代码！</strong>
</p>
