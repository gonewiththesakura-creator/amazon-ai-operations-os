# 数据源清单

## 1. 状态约定

当前没有任何真实 API、MCP 或店铺数据接入。下表的 `MVP mode` 全部表示计划能力；首版运行时只有 `SyntheticAdapter` 和用户上传文件可用。

| 状态 | 含义 |
|---|---|
| `SIMULATED` | 使用合成数据，所有记录 `synthetic=true`，UI 显示“模拟数据” |
| `DISCONNECTED` | 适配器存在但没有凭证或授权 |
| `CONNECTED_READ_ONLY` | 已授权，只读采集通过健康检查 |
| `DEGRADED` | 连接存在但延迟、缺字段、配额或部分数据集异常 |
| `NOT_ELIGIBLE` | 店铺、品牌或站点不满足数据集资格 |
| `DISABLED` | 配置禁用；写适配器在 MVP 固定为此状态 |

## 2. 来源分类

| `source_kind` | 定义 | 默认 `is_estimated` |
|---|---|---:|
| `FIRST_PARTY` | Amazon 店铺/广告官方接口或卖家自己的文件 | false，除非 Amazon 字段本身标为估算 |
| `THIRD_PARTY_ESTIMATE` | 卖家精灵、Keepa 等第三方推算数据 | true |
| `PUBLIC_OBSERVATION` | TikTok、YouTube 等公开页面/API 的可观察指标 | false；由此推导需求时为 true |
| `USER_PROVIDED` | 用户上传或手工确认的数据 | false；未确认 OCR 提取为 true |
| `AI_INFERENCE` | AI 主题、原因、分类或预测 | true |
| `SYNTHETIC` | 由模拟器生成的虚构数据 | 取决于模拟字段语义；始终 `synthetic=true` |

另存 `semantic_source_kind`。真实记录的 `source_kind` 表达采集通道，`semantic_source_kind` 表达数值语义；合成记录的 `source_kind=SYNTHETIC`，而 `semantic_source_kind` 指明它模拟 `FIRST_PARTY`、`THIRD_PARTY_ESTIMATE`、`PUBLIC_OBSERVATION`、`USER_PROVIDED` 或 `AI_INFERENCE`。

`synthetic` 与 `is_estimated` 不等价。一个虚构订单事件可以是合成世界中的“精确事件”，所以 `source_kind=SYNTHETIC, semantic_source_kind=FIRST_PARTY, synthetic=true, is_estimated=false`；一个模拟的第三方月销量为 `semantic_source_kind=THIRD_PARTY_ESTIMATE, synthetic=true, is_estimated=true`。

## 3. Amazon SP-API

Amazon 官方文档确认 SP-API 提供 Listings、Catalog、Pricing、FBA Inventory、Reports、Data Kiosk 等能力，并采用 LWA 授权、角色和限流机制。MVP 只申请非受限、完成业务目标所需的最小角色，不拉取买家 PII。参考：[SP-API onboarding](https://developer-docs.amazon.com/sp-api/docs/onboarding-overview)、[Listings management](https://developer-docs.amazon.com/sp-api/lang-en_EN/docs/manage-product-listings-guide)、[FBA Inventory API](https://developer-docs.amazon.com/sp-api/lang-en_EN/docs/fba-inventory-api)。

| Dataset ID | 候选接口/报告 | 主要数据 | 原生粒度 | 计划刷新 | MVP mode |
|---|---|---|---|---|---|
| `sp.catalog` | Catalog Items / Listings Items | ASIN、SKU、标题、属性、图片、关系、Listing issues | ASIN/SKU snapshot | 每日 + 重大问题小时检查 | `SIMULATED` |
| `sp.sales_traffic` | Sales and Traffic 数据集/报告 | Sales、Units、Orders、Sessions、Page Views、Buy Box % | ASIN-day、store-day | 每日回补 | `SIMULATED` |
| `sp.inventory` | FBA Inventory / inventory reports | fulfillable、reserved、inbound、unfulfillable | SKU snapshot | 每小时/每日 | `SIMULATED` |
| `sp.pricing` | Product Pricing / Listings offers | listing price、landed price、featured offer signals | SKU/ASIN snapshot | 每小时 | `SIMULATED` |
| `sp.fees` | Product Fees | referral/FBA 等费用估算 | ASIN/SKU-price snapshot | 价格/尺寸变化时 | `SIMULATED` |
| `sp.finances` | Finances / settlement reports | 费用、退款、结算事件 | transaction | 每日回补 | `SIMULATED` |
| `sp.returns_aggregate` | FBA customer return report | ASIN/SKU 退货事件的非 PII 字段 | return event | 每日 | `SIMULATED` |
| `sp.inbound` | Fulfillment Inbound | 入库计划、Shipment、预计/已接收数量 | shipment-item snapshot | 每日/状态变化 | `SIMULATED` |
| `sp.notifications` | Notifications/EventBridge/SQS | Listing 状态、库存、价格事件 | event | 近实时（后续） | `DISCONNECTED` |

Sales and Traffic 的实现应优先使用当前受支持的数据集版本，版本通过配置与 capability discovery 解析，不在业务代码硬编码。Amazon 的 2025 release notes 已说明旧 `analytics_salesAndTraffic_2023_11_15` 数据集于 2026-02-26 移除，并提供 `analytics_salesAndTraffic_2024_04_24` 趋势能力；适配器启动测试必须检测版本可用性。[SP-API release notes](https://developer-docs.amazon.com/sp-api/docs/sp-api-release-notes)

## 4. Brand Analytics 与 Customer Feedback

| Dataset ID | 候选接口/报告 | 主要数据 | 原生粒度 | 注意事项 | MVP mode |
|---|---|---|---|---|---|
| `sp.ba_search_query` | Search Query Performance | 查询词总曝光/点击/加购/购买，以及 ASIN 份额 | query-ASIN-period | 资格、周期和历史窗口以实际 capability 为准 | `SIMULATED` |
| `sp.ba_search_catalog` | Search Catalog Performance | ASIN 搜索参与指标 | ASIN-period | 不与广告 search term 报表视为同一来源 | `SIMULATED` |
| `sp.customer_feedback_reviews` | Customer Feedback API | 评论洞察、主题、趋势 | ASIN/browse-node-week | 官方数据周更且有站点/语言限制 | `SIMULATED` |
| `sp.customer_feedback_returns` | Customer Feedback API | 退货洞察 | browse-node-week | 节点级信息不能伪装成单 ASIN 事实 | `SIMULATED` |

Amazon 2025-06 发布了 Search Catalog/Search Query Performance 报告，并在 2025-06 增加 Search Query Performance 多 ASIN 查询；实际账户仍需验证角色与品牌资格。[Search Query Performance update](https://developer-docs.amazon.com/sp-api/lang-en_EN/changelog/update-search-query-performance-report-now-includes-support-to-query-multiple-asins) Customer Feedback 官方说明其评论洞察可到 ASIN/节点级，退货洞察仅节点级，数据周更。[Customer Feedback API](https://developer-docs.amazon.com/sp-api/lang-en_EN/docs/customer-feedback-api)

## 5. Amazon Ads API

### 5.1 数据集

| Dataset ID | 内容 | 粒度 | 计划刷新 | MVP mode |
|---|---|---|---|---|
| `ads.entities` | profile、portfolio、campaign、ad group、ad、target、budget/status | entity snapshot | 每小时 | `SIMULATED` |
| `ads.campaign_daily` | impressions、clicks、spend、purchases/sales | campaign-day | 每日回补 | `SIMULATED` |
| `ads.targeting_daily` | keyword/product target performance | target-day | 每日回补 | `SIMULATED` |
| `ads.search_term_daily` | customer search term performance | search-term-target-day | 每日回补 | `SIMULATED` |
| `ads.placement_daily` | placement performance | campaign-placement-day | 每日回补 | `SIMULATED` |
| `ads.advertised_product_daily` | advertised ASIN/SKU performance | advertised-product-day | 每日回补 | `SIMULATED` |
| `ads.purchased_product_daily` | purchased ASIN attributed result | purchased-product-day | 每日回补 | `SIMULATED` |

### 5.2 2026 报表迁移要求

截至本设计日期，Amazon Ads 官方说明 Unified Reporting 统一不同广告产品的维度和指标，Sponsored Ads/DSP 旧报表计划于 2026-12-31 关闭。统一报表的 Sponsored Products 基础指标对 Seller 默认使用 7 天回看窗口，对 Vendor 为 14 天；归因窗口未结束前转化仍可能回补。[Understand unified reporting](https://advertising.amazon.com/help/GMH8A8AJSH4ATV6T)、[Attribution rules](https://advertising.amazon.com/help/GX7KDKHMWQYMJ385)、[Data availability](https://advertising.amazon.com/help/G8A5Z6UD9ME5W3GZ)

因此：

- Ads 适配器提供 `LEGACY_V3` 与 `UNIFIED_REPORTING` 两个实现，业务层只依赖统一契约。
- 每条广告事实保存 `reporting_system`、`metric_namespace`、`attribution_model`、`lookback_days` 和 `date_basis`。
- 同名字段在不同 reporting system 下先建立显式映射并验证，不能按列名直接 union。
- 2026-12-31 前完成真实接入时，应以 Unified Reporting 为主，legacy 仅用于历史回填。
- 数据成熟度随回看窗口更新；“今日 ACOS”默认标为 provisional。

## 6. Amazon Marketing Stream（后续）

Marketing Stream 是推送式小时数据系统，可提供 Sponsored Ads 等活动指标和活动变更。它适合小时异常与日内节奏，不替代最终日级归因报表。[Amazon Marketing Stream guide](https://advertising.amazon.com/library/guides/amazon-marketing-stream)

MVP 只保留接口和表结构，不实施 AWS 消息基础设施。后续数据进入独立 `ads_stream_*` 事实表，通过 source-native event ID 去重；与日级 Ads 报表做 reconcile，不直接相加。

## 7. 卖家精灵 API 与 MCP

卖家精灵开放平台同时公开 HTTP API 与 MCP code，例如选品和市场研究端点。参考：[选产品 API/MCP](https://open.sellersprite.com/api/2)、[选市场 API/MCP](https://open.sellersprite.com/api/29)。

| Dataset ID | 用途 | 数据性质 | 计划刷新 | MVP mode |
|---|---|---|---|---|
| `sellersprite.keyword` | 搜索量、关键词趋势、关联词、竞品词 | 第三方估算 | 周/月 | `SIMULATED` |
| `sellersprite.rank` | 自然/广告排名观测 | 第三方观测/估算 | 每日多次 | `SIMULATED` |
| `sellersprite.product` | 竞品价格、评分、销量/销售额估算 | 第三方估算 | 每日/每月 | `SIMULATED` |
| `sellersprite.market` | 类目规模、集中度、新品结构 | 第三方估算 | 每月 | `SIMULATED` |

所有销量、销售额和搜索量默认 `is_estimated=true`。适配器优先使用 REST 做批量可重放采集；MCP 用于受控探索和 AI 工具调用，两种路径写入相同标准模型并记录 transport。

## 8. Keepa

Keepa 官方 API 提供产品、价格历史、offers、best sellers、seller 等数据，并按 token bucket 计费；其官方文档也说明可提供 MCP。参考：[Keepa API overview](https://keepa.com/api-docs/)。

| Dataset ID | 用途 | 粒度 | 数据性质 | MVP mode |
|---|---|---|---|---|
| `keepa.product_history` | 竞品价格、Buy Box/offer、BSR 历史 | ASIN-timestamp | 第三方观测/整理 | `SIMULATED` |
| `keepa.offers` | 卖家与 offer 快照 | ASIN-offer-snapshot | 第三方观测 | `SIMULATED` |
| `keepa.bestsellers` | 类目榜单 | category-rank-snapshot | 第三方观测，存在识别局限 | `SIMULATED` |

令牌预算由调度器统一分配；高优先级自有/核心竞品 ASIN 先采集。缺 token 时产生 `DEFERRED_QUOTA`，不得用旧数据冒充新快照。

## 9. TikTok、YouTube 等公开来源

| Dataset ID | 合规方式 | 用途 | 禁止事项 | MVP mode |
|---|---|---|---|---|
| `tiktok.creative_trends` | Creative Center 公共页面或经批准 API | Top Ads、关键词、hashtags、创意模式 | 绕过登录/反爬、下载无授权素材、把互动当销量 | `SIMULATED` |
| `youtube.public_videos` | YouTube Data API v3 | 标题、发布时间、观看/互动公开指标、主题 | 抓取私有数据、保存无必要评论者身份、把观看当 Amazon 归因 | `SIMULATED` |

TikTok 官方 Creative Center 提供按地区/行业的趋势和广告示例；Commercial Content API 需要项目批准。[Creative Center](https://ads.tiktok.com/help/article/creative-center)、[Commercial Content API](https://developers.tiktok.com/docs/en/commercial-content-api-getting-started) YouTube 搜索使用 Data API 并受 quota 管理。[YouTube Data API](https://developers.google.com/youtube/v3/docs/search/list)

公开来源只作为创意/需求信号。由多个公开观察推导出的趋势分数保存为 `source_kind=PUBLIC_WEB`、`semantic_source_kind=AI_INFERENCE`、`is_estimated=true`。

## 10. 用户上传文件

| 文件类型 | 原始保存 | 可提取字段 | 确认要求 |
|---|---|---|---|
| 采购合同 | 加密对象，只追加 | 供应商、SKU、数量、单价、币种、付款条款 | 用户确认后才进入成本版本 |
| 采购单 | 加密对象，只追加 | PO、SKU、数量、单价、日期 | 用户确认 |
| 转账凭证 | 加密对象，只追加 | 金额、币种、日期、参考号 | 用户确认；不保留非必要账户信息 |
| 物流单据 | 加密对象，只追加 | Shipment、箱数、重量、费用、预计到货 | 用户确认 |

OCR/LLM 提取记录每个字段的页码、边界框/文本证据和置信度。未确认提取值 `is_estimated=true`，不得用于确定性利润。

## 11. 手工配置

经营阶段、目标关键词、成本分摊规则、阈值和竞品集合属于用户配置，不是外部事实。每次修改保存版本、操作者、时间、原因和生效区间。

## 12. 来源优先级与冲突

同一概念冲突时不覆盖，按用途选择：

1. 店铺经营事实优先 Amazon first-party。
2. 广告事实优先 Amazon Ads 同一 reporting system 和归因口径。
3. 自有成本优先用户确认的单据/成本版本。
4. 竞品价格历史可使用 Keepa/卖家精灵，但显示来源差异。
5. 第三方销量不用于覆盖 Amazon 官方自有销量。
6. AI 推断永远不覆盖观测事实，只作为带证据的派生记录。

冲突值保存于各自观察记录；选择规则在 metric definition 中版本化。
