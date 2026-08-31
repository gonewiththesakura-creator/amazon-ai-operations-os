# MVP 验收标准

## 1. 验收定义

MVP 只有在“数据经过真实管道进入数据库、指标可复算、Supervisor/Agent 通过受控工具形成诊断、首页由有效 HomeComposition 动态组合、建议可审批、无外部写能力”同时成立时才通过。页面从静态 JSON 导入固定卡片、为七个场景分别硬编码页面、或让 LLM 直接编造 JSON 数值均不算完成。

当前文档仅定义验收标准；尚未开发、运行或验收。

## 2. 验收环境

- 本地 Docker Compose 或等价可重复环境。
- 20 个合成 ASIN，365 天零售日数据，至少 180 天广告/关键词数据。
- 所有合成数据通过 `SyntheticAdapter -> raw -> validation -> core -> mart -> API` 路径生成。
- 所有外部连接在 UI 显示 `SIMULATED` 或 `DISCONNECTED`。
- 无 Amazon/第三方生产密钥也能完成除真实连接以外的全部验收。

## 3. 产品闭环

| ID | 验收项 | 通过条件 |
|---|---|---|
| P-01 | 首页回答经营状态 | 数据完整场景显示 ON_TRACK/BELOW_EXPECTATION/NO_ORDERS 之一，并有证据 metric ID |
| P-02 | 数据不足处理 | 缺少关键源时显示 DATA_INCOMPLETE，不生成确定性“没出单原因” |
| P-03 | 原因树 | 至少覆盖流量、转化、供给、广告、排名、数据质量六类，按实际证据显示 |
| P-04 | 最佳行动 | 首页最多三条建议，显示影响、紧迫、置信度、风险和阶段权重 |
| P-05 | 证据下钻 | 从首页建议三次点击内到指标时间序列、公式版本和 provenance |
| P-06 | 审批草案 | 建议可创建、编辑、提交、批准/驳回；批准终态为 APPROVED_NOT_EXECUTED |
| P-07 | 人工执行 | 用户可记录 Seller Central 人工执行，明确标为 MANUAL_RECORDED |
| P-08 | 复盘 | 已记录执行可按预设窗口展示基线、结果、guardrails、干扰事件和成熟度 |
| P-09 | 反馈闭环 | 建议可标不相关/延后/已处理，反馈进入审计并影响队列，不改历史事实 |
| P-10 | 阶段策略 | 四阶段均有可演示 ASIN，切换后建议排序变化且指标事实不变化 |
| P-11 | AI 第一入口 | 默认进入 GPT 式动态工作空间，可直接提问；专业页面仍保留筛选、表格、图表和钻取 |
| P-12 | 页面内问 AI | 从指标/图表/数据行发起时自动携带对象、筛选、时间、来源和 metric ID，服务端重新授权 |
| P-13 | 动态组合 | 同一稳定骨架能根据业务状态改变组件、顺序和优先级，且所有块来自组件注册表 |
| P-14 | 可解释运行 | 任一发布结论可展开到 agent run、tool call、tool output、数据范围、来源、新鲜度和限制 |
| P-15 | 主动发现 | 无需用户提问，每日、小时和事件触发均能产生可审计 run；小时通知正确去重 |
| P-16 | 业务记忆 | 用户偏好/事实/假设/推断分型、可过期和可纠正；过期记忆不替代当前查询 |

## 4. 十个功能中心

| ID | 页面 | 最小可验收行为 |
|---|---|---|
| F-01 | AI 运营首页 | AI 问候/输入、数据健康、今日判断、动态画布、三条行动、重大问题、最佳信号、审批/补数队列 |
| F-02 | ASIN 驾驶舱 | 销售/流量/广告/排名/库存/利润联动趋势，事件叠加，阶段与来源筛选 |
| F-03 | 广告与搜索词 | Campaign -> Ad Group -> Target -> Search Term 下钻，浪费/机会检测和草案 |
| F-04 | 关键词与排名 | 关键词池、自然/广告排名、visibility、份额、采集 context 对齐 |
| F-05 | 竞品市场 | 竞品集合、价格/评分/BSR/估算销量；估算标识始终可见 |
| F-06 | Listing 与评价 | Listing 版本 diff、issues、评价/退货主题、证据与文案草案 |
| F-07 | 库存利润采购 | 库存构成、覆盖天数、断货日期、利润分解、成本完整度、文档确认流程 |
| F-08 | 实验审批日志 | 工作队列、状态机、冲突/过期、实验、操作与审计时间线 |
| F-09 | 选品机会/候选产品 | 机会召回、候选证据、估算与事实区分、利润/合规风险、验证任务和淘汰原因 |
| F-10 | 新闻与政策 | 官方原文/发布日期/生效日、变更、受影响 ASIN、严重度、期限、建议和来源优先级 |

每个页面必须包含 loading、empty、error、stale、provisional、synthetic 状态；不能用空白或假成功代替。

## 5. 数据治理

| ID | 验收项 | 通过条件 |
|---|---|---|
| D-01 | Provenance 完整 | 随机抽取和全表约束均证明数据记录有 source、source kind、semantic source kind、collected_at、marketplace、timezone、currency、grain、attribution window、estimated、confidence、synthetic；不适用值使用约定枚举而非 NULL |
| D-02 | 合成标记 | 所有演示记录 `synthetic=true`；任何漏标导致构建/seed 验收失败 |
| D-03 | 来源类型 | FIRST_PARTY、第三方估算、AI 推断和用户确认值在 API/UI 有不同标签；合成数据同时显示 SYNTHETIC 与其 semantic source kind |
| D-04 | Raw 只追加 | 重跑相同采集不会覆盖 raw；checksum 与 manifest 可验证 |
| D-05 | 可重算 | 删除并重建 core/mart 后 golden metric 结果一致 |
| D-06 | 归因隔离 | 不同 window/model/reporting system 的数据直接聚合被拒绝并返回明确错误 |
| D-07 | 日期隔离 | ORDER_DATE 与 TRAFFIC_DATE 不被静默混成同源指标；TACOS 显示混合口径说明 |
| D-08 | 币种隔离 | 不同币种未提供 FX 时计算失败；有 FX 时显示汇率来源 |
| D-09 | 迟到修订 | 迟到广告转化使 provisional 指标重算、生成新版本并保留旧 lineage |
| D-10 | 数据质量 | schema、重复、范围、完整、连续、新鲜和 reconcile 规则均有可触发样例 |
| D-11 | Quarantine | 非法记录不进入 core，UI 数据健康可查看失败计数和原因 |
| D-12 | PII | schema 和测试 fixture 中不存在 buyer name/address/email/phone |

## 6. 指标正确性

每个核心指标至少有 golden SQL fixture 和边界测试。

| ID | 验收项 | 通过条件 |
|---|---|---|
| M-01 | Sales/Orders/Sessions | 与输入 fixture 精确一致；Orders tooltip 明示 order items |
| M-02 | USP/CTR/CPC/CVR | 使用汇总分子/分母；零分母返回 NULL |
| M-03 | ACOS/ROAS | 同归因/币种计算；不兼容输入被拒绝 |
| M-04 | TACOS | 标为 Operational mixed-basis；公式、spend date basis 和 sales date basis 可见 |
| M-05 | Contribution Margin | 每个成本分量可展开，pre/post ads 可复算 |
| M-06 | Break-even ACOS | 成本完整时等于 pre-ad contribution/net sales；成本部分缺失时不显示确定值 |
| M-07 | 库存天数 | 排除合格断货日，velocity=0 返回 NULL |
| M-08 | 断货日期 | 区分 on-hand 和含可信 inbound；预测保存假设与区间 |
| M-09 | 排名 | 未找到为 NULL + found=false，不填成 max+1；不同 context 不连线 |
| M-10 | Search shares | 只在 query-ASIN-period 内计算，不与广告 CTR/市场份额混淆 |
| M-11 | 聚合 | 比率不做日均/行均；property test 覆盖随机分组 |
| M-12 | 版本 | API 返回 definition version，重算新版本不改历史简报引用 |

核心公式测试要求 100% 分支覆盖；其余代码覆盖率不是单一放行条件，以风险为基础。

## 7. 异常、归因与建议

| ID | 场景 | 预期结果 |
|---|---|---|
| I-01 | 库存归零 | 小时告警为 Critical，原因优先指向不可售，阻止增加广告建议 |
| I-02 | Listing suppression | 产生可售/Listing 原因，不把零订单归因给价格 |
| I-03 | 广告预算提前耗尽 | 显示流量受限证据；放量阶段可建议预算草案，利润阶段按 guardrail 排序 |
| I-04 | 高点击无转化 | 触发搜索词/Listing/价格候选原因，保留替代假设 |
| I-05 | 核心词排名下跌 | 排名恢复阶段提高优先级，展示同 context 排名证据 |
| I-06 | 价格变化与 CVR 变化 | 只标 observed association，除非实验支持 |
| I-07 | 数据源断流 | 产生数据质量告警并抑制依赖结论 |
| I-08 | 广告归因回补 | 今日 ACOS provisional；成熟后修订且建议 stale 检查生效 |
| I-09 | 重复异常 | 同 dedupe key 不每小时新建事件；恢复时关闭并记录 |
| I-10 | 无可靠收益模型 | 建议 expected range 为 NULL，不生成虚假提升百分比 |

## 8. 调度与可靠性

| ID | 验收项 | 通过条件 |
|---|---|---|
| R-01 | 小时任务 | 可按时和手动触发，20 ASIN demo 数据在目标环境 2 分钟内完成重大异常检查 |
| R-02 | 每日任务 | 可按时和手动触发，完整 demo 数据在目标环境 10 分钟内完成重算与简报 |
| R-03 | 幂等 | 同 idempotency key 重跑不产生重复 core/current 事实或重复告警 |
| R-04 | 断点恢复 | report poll/page cursor 中断后续跑，不从零重复写入 |
| R-05 | 单源失败 | 一个适配器失败不阻断无依赖域，依赖指标变 INCOMPLETE |
| R-06 | Schema drift | 未识别版本停止标准化、进入 quarantine、产生告警 |
| R-07 | 配额 | Keepa/SellerSprite 模拟配额耗尽产生 deferred 状态，不伪造新数据 |
| R-08 | 可观测性 | request -> task -> run -> raw -> metric -> insight 可用 trace/request ID 关联 |

时间门槛是 MVP 本地目标，开发时在记录硬件/数据量的基准测试中验证，不是当前已实现事实。

## 9. AI 编排与动态首页

| ID | 验收项 | 通过条件 |
|---|---|---|
| AI-01 | Supervisor | 对话、每日、小时、事件四类 trigger 均创建 `ai_runs`，并保存上下文、计划摘要、状态与 trace |
| AI-02 | 12 个 Agent 契约 | 12 个专业 Agent 均在 registry 有职责、输入/输出 Schema、工具白名单、预算和 prompt version；MVP 场景所需 Agent 可真实运行 |
| AI-03 | 动态工具加载 | 不同意图获得不同最小工具集；测试证明未授权/无关/断开工具不会暴露给模型 |
| AI-04 | 工具证据 | 所有发布 finding 至少引用有效 metric/tool/policy/document evidence；无证据只能标待验证假设 |
| AI-05 | 工具返回信封 | source、collected_at、data period、marketplace、timezone、currency、grain、attribution、estimated、synthetic、confidence、limitations、raw reference 完整 |
| AI-06 | 核心指标计算边界 | ACOS、TACOS、利润、库存天数等来自 SQL/程序 observation；模型输出不同数值会被 validator 拒绝 |
| AI-07 | HomeComposition Schema | 总体判断、原因、最重要问题、最佳信号、前三行动、data status 和有序 blocks 完整且版本化 |
| AI-08 | 组件白名单 | 未注册 component type/version、任意 HTML/JS/SQL/URL payload 被拒绝；前端不执行模型代码 |
| AI-09 | 状态差异 | 正常、订单/广告异常、库存/利润风险、市场/政策变化四种状态的首要块和优先级明显不同，导航/输入/上下文骨架稳定 |
| AI-10 | 组合可追溯 | 每个 block 显示 display reason、evidence、period、updated_at、confidence、limitations、approval flag |
| AI-11 | 冲突与部分失败 | Agent 冲突不被伪装成共识；超时或数据缺失返回 partial/limitations，系统仍可安全渲染 |
| AI-12 | 输出失效 | 指标版本或 freshness 变化会定向标记 insight、block、recommendation、approval stale，不改历史版本 |
| AI-13 | 记忆类型 | 永久事实、用户偏好、临时假设、AI 推断在存储/API/UI 分型；有效期和 supersedes 测试通过 |
| AI-14 | 记忆优先级 | 当前查询与记忆冲突时使用当前数据并提示复核；过期记忆不进入分析事实 |
| AI-15 | 政策来源 | 政策卡有官方原始 URL、发布/生效日期、采集时间；第三方解读不会升级为官方事实 |
| AI-16 | AI 数据表 | 附件要求的 24 张 AI/记忆/政策/通知表均有 migration、tenant RLS、必要索引和约束 |
| AI-17 | 可观测与成本 | run -> agent -> tool -> output -> insight -> block/recommendation 可追踪，model/token/cost/latency/prompt version 可审计 |
| AI-18 | 阶段建议与生效隔离 | 每日程序生成 recommended stage/confidence/reasons；建议变化触发提醒，未经用户确认不能改变 effective stage；人工覆盖/锁定和原因有历史 |
| AI-19 | 阶段化首页目标 | LAUNCH/SCALE/HARVEST/RECOVERY 分别按已确认目标排序；贡献利润不是所有 ASIN 唯一默认目标 |

AI-16 的表为：`ai_conversations`、`ai_messages`、`ai_runs`、`agent_runs`、`tool_calls`、`tool_outputs`、`ai_insights`、`homepage_compositions`、`homepage_blocks`、`recommendations`、`recommendation_evidence`、`approvals`、`action_executions`、`action_rollbacks`、`business_memories`、`policy_items`、`policy_changes`、`policy_impacts`、`news_items`、`anomaly_events`、`notification_events`、`model_usage`、`prompt_versions`、`data_freshness`。其中执行/回滚表在 MVP 仅支持人工记录或保持空表，不赋予外部写能力。

## 10. API、MCP 与写保护

| ID | 验收项 | 通过条件 |
|---|---|---|
| A-01 | OpenAPI | 文档中不存在广告/Listing/价格外部 execute 路由 |
| A-02 | MCP 工具 | 工具枚举只有读取、模拟和创建草案，无任意 SQL/URL/secret/审批/执行 |
| A-03 | 缺密钥 | 真实适配器为 DISCONNECTED；不自动 fallback 成模拟并声称成功 |
| A-04 | 状态响应 | 每个业务 API 返回 data_status、synthetic、freshness、provenance summary、metric versions |
| A-05 | Idempotency | 草案创建/状态改变重复请求结果一致 |
| A-06 | 乐观锁 | 两个并发审批中一个因版本冲突失败，不丢失事件 |
| A-07 | Stale 草案 | 输入指标版本变化后不能审批，需刷新草案 |
| A-08 | Tenant scope | 猜测其他 tenant UUID 返回 404/forbidden，不泄漏存在性或数据 |
| A-09 | 未来执行契约隔离 | `execute_approved_action` 不存在于 MVP Tool Registry、OpenAPI、MCP manifest、worker、凭证和部署清单；契约文档不算实现 |
| A-10 | 第三方 MCP | 默认只读，记录授权范围、结构化输入输出摘要、来源、延迟和错误；外部文本不能扩大工具权限 |

## 11. 安全与隐私

| ID | 验收项 | 通过条件 |
|---|---|---|
| S-01 | Secrets | repo、镜像、日志、DB 业务字段无明文 secret；secret scan 通过 |
| S-02 | RBAC/RLS | 权限矩阵和跨租户自动化测试通过 |
| S-03 | External writes | 代码路由、MCP、服务凭证和 feature flag 四处均不可写 Amazon |
| S-04 | Upload | MIME/magic/size/virus/zip bomb 测试；未扫描文件不可解析下载 |
| S-05 | Document confirm | 未确认提取字段不能形成 COMPLETE cost version |
| S-06 | Prompt injection | 恶意 Listing/文档文本不能引发任意工具调用或权限提升 |
| S-07 | Logging | token、cookie、authorization、账户号 fixture 被脱敏 |
| S-08 | Audit | 连接、文档、配置、草案、审批、人工执行、模型和重算事件齐全 |
| S-09 | PII | 不采集买家 PII，疑似 PII fixture 进入隔离流程 |
| S-10 | Dependency | 无未豁免 Critical/High 漏洞；豁免需风险说明和到期日 |
| S-11 | 选品评分 | 12 个维度均保存原始指标、程序化标准化值、权重、来源、估算、置信度、扣分和人工核实项；overall score 可复算，LLM 无直接打分写权限 |
| S-12 | 候选淘汰 | 进入 REJECTED 必须在同一事务保存原因和证据；查询历史可阻止重复研究 |
| S-13 | 采购成本确认 | OCR 未确认字段无法形成 COMPLETE 成本版本，付款分摊与批次落地成本可追溯 |

## 12. UX 与可访问性

- 首屏 1280x720 能看到数据健康、今日判断和第一行动，不需先浏览大 KPI 卡片。
- 桌面三栏保持左导航、中央动态画布/对话和右上下文/审批；右栏可折叠且折叠后中央内容无跳位溢出。
- 首页不是空白聊天页；四种业务状态均在首屏展示结论、输入、行动、问题/信号和审批摘要。
- 动态 blocks 改变时不移动底部常驻输入的主要交互位置；异步工具状态不导致页面布局抖动。
- 375px 移动宽度无横向页面溢出；宽表提供受控横向滚动和固定关键列。
- 颜色不是唯一状态信号；synthetic、estimated、provisional 均有文本/图标标签。
- 键盘可完成筛选、下钻、草案编辑和审批；焦点可见。
- 图表提供表格/文本摘要和 tooltip 口径；排名图轴方向明确。
- 所有按钮有明确动词，危险/不可逆动作需确认；MVP 无外部写按钮。
- Playwright 对桌面和移动关键路径截图检查无重叠、截断和空白画布。

## 13. 性能目标

在记录环境规格、20 ASIN、标准 demo 数据量、无冷启动迁移的条件下：

- 首页 daily brief API p95 <= 2s，页面主要内容 p75 LCP <= 2.5s（本地/受控测试基线）。
- 常用 90 天时间序列 API p95 <= 1.5s。
- 搜索词中心默认分页 p95 <= 2s，不一次返回全量。
- 审批状态改变 p95 <= 800ms，不含异步分析。
- 任何请求有 30s 上限；重计算走后台任务。
- HomeComposition 首屏使用已发布版本快速返回；后台深度分析通过运行状态渐进更新，不能让页面无限等待模型。

## 14. 七个端到端演示场景

所有场景使用同一组件注册表和动态渲染器，数据通过 SyntheticAdapter 管道产生且全程显示“模拟数据”。每个场景需保存 trigger、ai run、agent runs、tool calls、evidence、HomeComposition version 和截图/测试记录。

| 场景 | 输入与操作 | 必须观察到的结果 |
|---|---|---|
| E2E-01 昨日订单下降 | 进入首页，不输入问题；昨日订单相对合格基线下降，流量与广告搜索词有诊断证据 | Store Agent 主动发现；首页状态为 ORDER_AD_ANOMALY，优先出现订单漏斗、广告诊断、搜索词表和三项建议；可下钻到 metric/tool/raw reference |
| E2E-02 库存优先 | 广告表现正常，某重点 ASIN 库存覆盖不足 | 首页状态为 INVENTORY_PROFIT_RISK，库存/断货/补货与现金影响排在广告前；不得建议扩大即将断货 ASIN 的广告；采购仅生成草案 |
| E2E-03 政策影响 | 合成政策源出现带官方 fixture URL、发布日期和生效日的新政策 | 政策与风险 Agent 识别受影响 ASIN、风险等级、期限和建议；原始政策与第三方解读分开；无适用证据的 ASIN 不被标受影响 |
| E2E-04 正常经营机会 | 店铺无重大异常，存在增长信号、竞品变化和候选产品机会 | 首页状态为 NORMAL，优先显示正向信号、增长机会、竞品/选品和进行中实验，不人为制造警报 |
| E2E-05 指标问 AI | 在特定 ASIN/Campaign 的 ACOS 数字点击“问 AI” | 自动携带当前 ASIN、Campaign、筛选、时间、来源、归因和 metric ID；广告 Agent 调用工具完成解释；切换对象后旧上下文不串线 |
| E2E-06 竞价审批 | AI 生成竞价修改建议，用户打开并批准审批卡 | 卡片显示 before/after、why、evidence、预期、最大风险、观察期、回滚条件；终态 `APPROVED_NOT_EXECUTED`；不存在外部写调用；可另行记录 `MANUAL_RECORDED` |
| E2E-07 同用户动态布局 | 同一用户依次加载异常、库存、政策、正常四个 scenario | 左导航、输入与上下文骨架保持一致；block 类型、顺序、密度和行动优先级明显变化；每次 composition 可追溯且旧版本不被覆盖 |

附加恢复测试：关键数据缺失时系统进入 `DATA_INCOMPLETE`，展示缺数与受影响结论，不编造原因；HomeComposition Schema 失败时使用明确 stale/安全状态，不将原始模型文本当页面。

## 15. 不予验收的情况

- UI 写“已连接 Amazon”但实际使用 seed JSON。
- 演示数据缺少 `synthetic=true` 或来源标签不明显。
- 页面数据直接 hardcode，不经过 API/数据库/指标管道。
- 为四种首页状态或七个场景硬编码独立页面，未经过 HomeComposition Schema 与组件注册表。
- Agent 未调用工具便发布经营事实，或工具调用/输出无法审计。
- 首页 block 缺少展示理由、证据、数据期间、新鲜度、置信度或限制。
- 过期记忆覆盖当前查询，或 AI 推断被存为已确认永久事实。
- 新闻摘要被当作政策，政策卡缺少官方原始链接或发布日期。
- 指标只有 LLM 文本解释，无法由 SQL/程序重算。
- 把 SellerSprite/Keepa 估算销量当官方销量。
- 把不同归因窗口/版本的广告数据静默相加。
- 成本缺失时展示精确利润或 break-even ACOS。
- 存在任何未经确认的 Amazon 写操作。
- MVP 中可发现、注册或调用 `execute_approved_action`，或批准后 UI 显示 Amazon 已执行。
- 无 loading/error/empty/stale/provisional 状态。

## 16. 里程碑建议（确认后执行）

| 里程碑 | 范围 | 演示出口 |
|---|---|---|
| M0 工程与契约 | monorepo、Next.js/FastAPI/PostgreSQL、Docker Compose、迁移、auth/RBAC/RLS skeleton、SyntheticAdapter、provenance、AI/Tool/HomeComposition/Component registry、两状态运行壳、测试基线 | Compose 启动、迁移、Schema/写保护/synthetic/跨租户/registry 测试、前端 build、后端 pytest、可访问演示页 |
| M1 合成数据平台 | SyntheticAdapter、raw/core/mart、DQ、调度、核心指标 | 可追溯数据浏览与指标页 |
| M2 AI 首页与 ASIN | Supervisor、首批 Agent、动态首页、原因树、ASIN 驾驶舱、小时告警 | E2E-01、02、04、07 |
| M3 广告搜索排名 | 广告实体/报表、搜索词、关键词、排名、Brand Analytics 模拟 | 广告/关键词草案 |
| M4 市场 Listing/选品/政策 | 竞品、候选产品、Keepa/卖家精灵模拟、Listing diff、反馈主题、政策 fixture | 市场、选品、Listing 与 E2E-03 |
| M5 库存利润采购 | 库存预测、成本版本、文档上传确认、利润 | 断货与利润决策 |
| M6 AI/审批实验硬化 | 全部 Agent 契约、记忆、审批、人工执行、实验复盘、RBAC、审计、安全/性能 | E2E-05、06 与全闭环 MVP |

每个里程碑必须运行测试、提供可访问演示页，并列出已完成、未完成和风险；未接真实 API 的能力持续显示模拟状态。
