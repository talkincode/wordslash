# WordSlash（VS Code Extension）系统详细设计（AI 可执行版）

0. 目标与非目标

0.1 目标（必须实现）
	1.	在 VS Code 内提供英语学习闭环：添加卡片 → 复习 → 记录行为 → 调度下一张
	2.	支持闪卡交互：正面评分（Again/Hard/Good/Easy）→ 必要时翻面 → Next
	3.	本地数据存储可靠：主库在 VS Code globalStorage；支持导出/导入备份到用户目录
	4.	可扩展：后续可加 LLM 生成、FSRS、同步，但 v1 不依赖它们

0.2 非目标（v1 不做）
	•	云同步、多端同步
	•	复杂 UI 动效、排行榜、成就系统
	•	花里胡哨的词典抓取
	•	MCP/工具调用生态集成（先留接口）

⸻

1. 总体架构

1.1 模块划分
	•	Extension Host（后端）
	•	数据层：存储、迁移、索引
	•	调度层：SRS 算法 + next card selection
	•	命令层：VS Code commands、右键菜单、快捷键
	•	LLM 层（可选）：生成卡片背面内容（v1 stub）
	•	备份层：导出/导入、自动备份（可选）
	•	Webview UI（前端）
	•	Flashcard View：显示卡片、评分、翻面、next
	•	Stats View（可选 v1.1）：今日复习数、due 数、正确率

1.2 进程/通信
	•	Webview 与 Extension Host 使用 postMessage 双向通信
	•	Extension Host 作为唯一数据写入口（Webview 不直接访问文件）

⸻

2. 数据设计（强约束，避免未来自爆）

2.1 存储位置
	•	主库目录：context.globalStorageUri（扩展存储目录）
	•	主库文件（v1 推荐 JSONL）：
	•	cards.jsonl（卡片实体，允许更新写新版本）
	•	events.jsonl（学习事件追加写，不修改历史）
	•	index.json（可再生索引，缓存 card 最新快照、due 列表等）
	•	备份目录：用户在设置中指定 wordslash.backup.directory（默认空，不自动）
	•	备份文件格式：JSONL 或 zip（v1 采用 JSONL 更简单）

说明：v1 使用 JSONL + 事件溯源（Event Sourcing）便于迁移与重算。未来可迁 SQLite 但不影响外部备份格式。

2.2 数据模型

2.2.1 Card（卡片）

type Card = {
  id: string;                 // uuid
  type: "word" | "phrase" | "sentence";
  front: {
    term: string;             // 单词/短语
    example?: string;         // 例句（可空）
    context?: {
      langId?: string;        // 文件语言，如 "typescript"
      filePath?: string;      // 可选，隐私考虑可开关
      lineText?: string;      // 可选，选中内容周边
    };
  };
  back?: {
    translation?: string;     // 中文翻译
    explanation?: string;     // 英文/中文解释
    synonyms?: string[];
    antonyms?: string[];
    notes?: string;
  };
  tags?: string[];
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;          // 软删除
  version: number;            // 每次更新 +1
};

2.2.2 Review Event（学习事件）

type ReviewRating = "again" | "hard" | "good" | "easy";

type ReviewEvent = {
  id: string;                 // uuid
  cardId: string;
  ts: number;
  kind: "review";
  rating: ReviewRating;
  mode: "flashcard" | "quickpeek";
  durationMs?: number;        // 可选
};

2.2.3 系统元数据

type Meta = {
  schemaVersion: number;      // 用于迁移
  createdAt: number;
};

2.3 SRS 状态（可重算，但缓存）

在 index.json 缓存每张卡的 SRS 计算结果：

type SrsState = {
  cardId: string;
  dueAt: number;              // 下次到期时间戳
  intervalDays: number;
  easeFactor: number;         // SM-2
  reps: number;
  lapses: number;
  lastReviewAt?: number;
};

关键：SrsState 必须能通过 events 重新计算，index 可以删了重建。

⸻

3. 复习调度算法（v1：SM-2，明确可验收）

3.1 评分映射（必须固定）
	•	again → quality=0
	•	hard  → quality=3
	•	good  → quality=4
	•	easy  → quality=5

3.2 SM-2 更新规则（简化版本）

维护 reps, intervalDays, easeFactor
	•	初始：reps=0, interval=0, EF=2.5
	•	若 quality < 3：
	•	reps = 0
	•	intervalDays = 1
	•	lapses += 1
	•	否则：
	•	reps += 1
	•	intervalDays:
	•	reps==1 → 1
	•	reps==2 → 6
	•	reps>=3 → round(intervalDays * EF)
	•	EF 更新：
	•	EF = EF + (0.1 - (5-q)*(0.08+(5-q)*0.02))
	•	EF 最小 1.3

dueAt = now + intervalDays * 86400s

3.3 next card selection（下一张）

优先级：
	1.	dueAt <= now 的卡（到期队列）
	2.	若到期不足：从 “新卡池” 取（未复习过 reps=0）
	3.	防无聊：同一 term 近期出现则降低权重（简单 cooldown）

策略实现：
	•	从候选集中按权重随机（weighted random）或最早 due 优先（deterministic）
v1 推荐 deterministic：最早 due 优先，可测试、可解释。

⸻

4. 插件功能规格（含 VS Code Commands）

4.1 Commands（必须实现）
	1.	wordslash.openFlashcards
	•	打开 Flashcard Webview
	2.	wordslash.addCardFromSelection
	•	从编辑器选中内容创建卡片
	3.	wordslash.exportBackup
	•	导出备份到用户选择目录（或设置目录）
	4.	wordslash.importBackup
	•	从备份文件导入（支持合并/去重）

4.2 右键菜单（必须实现）
	•	editor/context 菜单项：Add to WordSlash

规则：
	•	如果 selection 为空，取当前光标所在单词（用 VS Code API 提取）
	•	example 默认取当前行完整文本
	•	front.term 为 selection.trim()

4.3 Flashcard Webview（必须实现）

界面状态机：

4.3.1 正面（Front）
显示：
	•	term（大字）
	•	example（小字，可折叠）
按钮：
	•	Again / Hard / Good / Easy
	•	Reveal（翻面）

规则：
	•	选择 Again/Hard/Good/Easy：
	•	写入 ReviewEvent
	•	若 rating=again 或 hard：自动进入 Back（展示解释）
	•	若 rating=good/easy：直接 Next（不翻面）

4.3.2 背面（Back）
显示：
	•	translation/explanation/synonyms/antonyms（缺省则显示 “未生成”）
按钮：
	•	Next

v1 背面允许为空。后续 LLM 生成由用户触发。

4.4 设置项（package.json contributes.configuration）
	•	wordslash.backup.directory: string | null
	•	wordslash.backup.auto: boolean（默认 false 或 true 自选）
	•	wordslash.backup.autoIntervalHours: number（默认 24）
	•	wordslash.study.newCardsPerDay: number（默认 10）
	•	wordslash.privacy.storeFilePath: boolean（默认 false）

⸻

5. 备份/恢复设计（你最关心的“不丢”）

5.1 导出（Export）

输出一个目录或文件：
	•	wordslash-cards.jsonl
	•	wordslash-events.jsonl
	•	wordslash-meta.json

导出过程必须原子化：
	•	写到 temp 文件 .tmp，完成后 rename 覆盖

5.2 导入（Import）
	•	读取备份文件
	•	卡片：以 id 去重，若同 id 多版本取 version 最大
	•	事件：以 id 去重，追加写入
	•	导入完成后重建 index（rebuild）

5.3 自动备份（可选 v1.1）

触发：
	•	扩展激活时若距离上次备份 > interval
	•	或事件累计 > N（例如 50）

⸻

6. LLM / Copilot 集成（v1 留接口，v1.1 实现）

6.1 生成背面内容接口（stub）

generateBackContent(card: Card): Promise<Card["back"]>

v1：返回空或 mock（不报错）
v1.1：接入 copilot chat 或自定义模型（让 agent 负责实现）

6.2 触发方式（v1.1）
	•	Flashcard Back 面 “Generate” 按钮
	•	或命令 wordslash.generateBackForCurrentCard

⸻

7. 文件与代码结构（建议，利于 AI 生成）

wordslash/
  src/
    extension.ts                 // activate, commands
    storage/
      storage.ts                 // read/write jsonl, atomic write
      indexer.ts                 // rebuild index from events
      schema.ts                  // types + version
    srs/
      sm2.ts                     // SM-2 calculate
      scheduler.ts               // next selection
    commands/
      addCard.ts
      exportBackup.ts
      importBackup.ts
      openFlashcards.ts
    webview/
      panel.ts                   // webview creation + message router
      protocol.ts                // message types
      ui/                        // bundled webview assets
        index.html
        app.ts                   // vanilla or react
        styles.css
  package.json
  tsconfig.json


⸻

8. Webview 通信协议（AI 必须按这个实现，避免乱写）

8.1 UI → Extension

type UiToExt =
 | { type: "ui_ready" }
 | { type: "get_next_card" }
 | { type: "rate_card"; cardId: string; rating: ReviewRating; mode: "flashcard" }
 | { type: "reveal_back"; cardId: string }
 | { type: "next" };

8.2 Extension → UI

type ExtToUi =
 | { type: "card"; card: Card; srs?: SrsState }
 | { type: "empty"; message: string }
 | { type: "error"; message: string };


⸻

9. 测试与验收（Copilot 最怕这块，你要逼它写）

9.1 单元测试（必须）
	•	SM-2：给定初始状态 + rating 序列 → interval/EF/dueAt 符合预期
	•	Storage：append jsonl、读回、原子写逻辑
	•	Import：去重逻辑正确（同 id 多版本取最大）
	•	Scheduler：due 优先，新卡 fallback

9.2 手工验收用例（必须写到 README）
	1.	选中一个词 → 右键 Add → 打开 Flashcards → 能立刻出现
	2.	点 again → 生成 review event → 翻面展示背面（即使为空也要可用）
	3.	点 easy → 直接 next
	4.	Export → 删除 globalStorage → Import → 数据恢复，due 能继续

⸻

10. 迭代路线图（给 AI 拆任务用）

Milestone v0.1（跑通闭环）
	•	commands + storage jsonl + flashcard webview + SM-2 + next card

Milestone v0.2（可靠性）
	•	export/import + index rebuild + basic tests

Milestone v0.3（体验）
	•	新卡每日上限、due 统计、状态栏入口、快捷键

Milestone v0.4（智能生成）
	•	LLM back content generate（可选）

⸻

11. Copilot Agent 执行指令模板（直接喂给它）

把下面这段当成“agent 任务说明”贴进去：

你将实现 VS Code 扩展 WordSlash。必须严格按照本设计的模块、数据结构、协议、命令名称实现。优先实现 v0.1 再做 v0.2。每个 milestone 结束都要提供可运行的扩展、最小 README、以及对应的单元测试。禁止引入不必要的复杂依赖。UI 可用 vanilla TS + minimal CSS。必须实现 jsonl 存储、事件日志、SM-2 调度、webview message protocol。导出/导入必须原子写并可恢复。

