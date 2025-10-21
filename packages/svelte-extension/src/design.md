# AI 选择器设计规范（svelte-extension）

面向“自动生成 CSS 选择器”的 AI 说明书。强调可实现性、约束先行、评分可计算、输出可存储与复用。

## 目标

- 在目标页面上用 `document.querySelector` 稳定、唯一、简洁地定位元素。
- 支持同一组件在不同页面/位置复用，选择器仍能工作。
- 选择器尽量短，避免依赖脆弱结构，容忍轻微页面变动。

## 输入/输出契约

- 输入：
  - `element`: 目标 DOM 节点（或其位置信息）。
  - `document`: 查询上下文（可为子树根）。
  - `attrBlacklist: string[]`: 黑名单，禁止使用的类或 ID。支持 `.class`、`#id`、或裸字符串精确匹配。
  - `attrWhitelist: string[]`: 白名单属性键，允许使用：`data-target`、`data-testid`、`data-qa`。
  - `crossPages?: Document[]`: 可选的跨页校验上下文集合。
- 输出（持久化对象）：
  - `primary: string` 主选择器。
  - `fallbacks: string[]` 1–2 个备选选择器。
  - `multiInstance: { type: 'index'|'first', index?: number }` 多实例策略（不把序号写入 CSS）。
  - `confidence: number` 综合置信度 0–1。
  - `signals: { matches: number, depth: number, length: number }` 关键指标快照。

## 术语与硬性约束

- 可用原语：仅组合 `id`、`class`、标签名；可选白名单属性选择器 `[data-target]`、`[data-testid]`、`[data-qa]`。
- 禁用：`nth-child`、`nth-of-type`、`:not`、`~`、`+`、`:has`、任意样式/行内属性选择。
- 深度与长度：选择器链深度 ≤ 3；字符长度 < 64。
- 稳定性过滤：忽略明显动态/样式类与 ID：`active`、`hover`、`focus`、`selected`、`loading`、`open`、`expanded`、`show`、`hide`、`tmp`、`test`、前缀 `ng-*`、`jsx-*`、`v-*`、`svelte-*`；哈希类名（长度≥8且包含大量十六进制）降权或剔除。
- 黑名单应用：
  - 以 `.` 开头视为类名精确匹配；以 `#` 开头视为 ID 精确匹配；否则对类/ID 名称进行精确匹配。
  - 命中黑名单的 token 不可参与选择器生成。

## 生成算法（自下而上）

1. 收集目标元素 token：稳定 `id`、有效 `class`（去除动态与黑名单）、标签名；收集最近父节点作为候选锚点。
2. 单点候选：优先级 `#id`（唯一且非动态） > `.class`（唯一） > `tag.class`。
3. 父级锚点：在最近的“稳定容器”选取（如类名含 `card`、`nav`、`header`、`footer`、`sidebar`、`content`、`main`、`modal`、`dialog`、`form`、`list`、`grid`、`item` 等语义词），组合 `anchor > tag(.class)`；最多 2 层。
4. 白名单增强：若存在白名单属性，优先使用 `[data-target="..."]` 等，仍遵守深度与长度限制。
5. 去冗与压缩：移除无贡献的标签或通用类（如仅 `div`/`container` 且不增唯一性），保持链路最短。
6. 评分评估：对每个候选计算唯一性、稳定性、简洁度，得到综合分。
7. 选择与保留：选取综合分最高的作为主选择器；保留 1–2 个备选（得分次高且差异化）。
8. 多实例处理：若主选择器在当前上下文命中数 > 1，则：
   - 若有目标 `element`，记录其在 `querySelectorAll(primary)` 中的 `index`，输出 `multiInstance: { type: 'index', index }`；
   - 若无具体元素，仅需“第一项”，输出 `multiInstance: { type: 'first' }`。
9. 跨页校验（可选）：在 `crossPages` 中统计命中数与稳定性波动，调整稳定性分与置信度。

## 评分模型（0–1）

- 唯一性 `U`：`U = (matches === 1) ? 1 : max(0, 1 - log2(matches)/3)`。
- 稳定性 `S`：起始 1；每含一个动态/哈希 token 线性扣分；锚点为语义容器加分；跨页命中一致加分。
- 简洁度 `C`：`C = clamp(1 - 0.3*(depth-1) - length/128, 0, 1)`。
- 综合分：`Score = 0.5*U + 0.3*S + 0.2*C`；任何候选违反“硬性约束”直接淘汰。

## 输出与存储

- 保存内容：`primary`、`fallbacks`、`multiInstance`、`confidence`、`signals`。
- 多实例策略不写入 CSS，仅作为运行时取值：`querySelectorAll(primary)[index]` 或取第一项。

## 示例

- 推荐：
  - `#search-input`
  - `.btn-primary`
  - `button.btn-primary`
  - `.product-card > .buy-button`
  - `[data-testid="checkout"]`
- 不推荐：
  - `div:nth-child(2) .active span`
  - `[style*=""]`
  - `a[href*="?"]`
  - `div:has(span)`

## 扩展 UI（交互与校验）

- 点击元素后展示候选列表与实时命中数、评分与置信度。
- 支持切换页面快速校验，显示跨页命中统计与变化提示。
- 允许选择/替换锚点容器、剔除不稳定类、启用白名单属性。
- 保存时写入主选择器与备选，并记录多实例策略。
