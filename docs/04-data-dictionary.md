# 数据字典

## 1. 类型与命名规范

| 类别 | 规范 |
|---|---|
| 主键 | UUID v7，列名 `<entity>_id` |
| Amazon 外部 ID | 字符串，不假定纯数字；保留 `external_id` 与 source |
| 时间点 | `timestamptz`，数据库存 UTC |
| 业务日期 | `date` + `timezone`，不能只存无时区 timestamp |
| 金额 | `numeric(20,6)` + ISO 4217 `currency` |
| 比率 | `numeric(18,8)`，数据库保存小数，如 0.125；UI 显示 12.5% |
| 数量 | `numeric(20,6)`，订单/件数通常约束为整数但支持费用分摊 |
| 置信度 | `numeric(5,4)`，范围 `[0,1]`；未知用 NULL，不用 0 |
| 枚举 | PostgreSQL check 或 lookup table；API 使用字符串枚举 |
| JSON | 仅保存来源扩展、规则参数、证据引用；核心可查询字段必须列化 |
| 删除 | 业务记录软删除或有效期；raw、audit 不删除/覆盖 |

## 2. 强制 provenance envelope

每个数据记录必须引用一条不可变 `data_provenance`。为了防止查询遗漏，所有事实、指标、洞察和 AI 输出还冗余 `synthetic` 与 `source_kind` 并由数据库触发器/约束校验与 provenance 一致。

### 2.1 `data_provenance`

| 字段 | 类型 | 必填 | 定义 |
|---|---|---:|---|
| `provenance_id` | uuid | 是 | 不可变来源记录主键 |
| `tenant_id` | uuid | 是 | 数据租户 |
| `source_id` | uuid | 是 | `source_registry` 外键 |
| `source` | text | 是 | 稳定来源名，如 `amazon_sp_api`、`synthetic:amazon_ads` |
| `source_kind` | text | 是 | 实际采集通道：SYNTHETIC/LIVE_API/USER_UPLOAD/PUBLIC_WEB |
| `semantic_source_kind` | text | 是 | 数值语义：FIRST_PARTY/THIRD_PARTY_ESTIMATE/PUBLIC_OBSERVATION/USER_PROVIDED/AI_INFERENCE；合成数据仍标明其模拟语义 |
| `collected_at` | timestamptz | 是 | 系统收到数据的 UTC 时间 |
| `observed_at` | timestamptz | 否 | 快照观测时间；区间数据为空 |
| `period_start` | timestamptz | 否 | 数据覆盖区间起点 |
| `period_end` | timestamptz | 否 | 数据覆盖区间终点，采用半开区间 `[start,end)` |
| `marketplace` | text | 是 | 站点代码，MVP 为 US |
| `timezone` | text | 是 | IANA 时区名 |
| `currency` | char(3) | 是 | ISO 4217；不适用货币的记录使用 `XXX`（No currency） |
| `grain` | text | 是 | 如 `ASIN_DAY`、`TARGET_HOUR`、`DOCUMENT` |
| `date_basis` | text | 是 | ORDER_DATE/TRAFFIC_DATE/SNAPSHOT_TIME/DOCUMENT_DATE/OTHER |
| `attribution_window` | text | 是 | ISO 8601 duration/来源枚举；不适用时为 `NONE` |
| `attribution_model` | text | 是 | LAST_CLICK/ENHANCED_LAST_TOUCH/NONE/UNKNOWN 等 |
| `is_estimated` | boolean | 是 | 是否估算或推断 |
| `confidence` | numeric(5,4) | 是 | 来源/推断置信度，不代表业务成功概率 |
| `synthetic` | boolean | 是 | 是否合成数据 |
| `schema_version` | text | 是 | 来源 schema 版本 |
| `raw_object_id` | uuid | 否 | 原始对象清单外键 |
| `ingestion_run_id` | uuid | 是 | 采集/生成运行外键 |
| `source_record_key` | text | 否 | 来源行/事件稳定 key，不含 PII |
| `warnings` | jsonb | 是 | 来源限制、部分缺失、口径警告，默认 `[]` |
| `created_at` | timestamptz | 是 | 数据库写入时间 |

### 2.2 provenance 规则

- `synthetic=true` 时 source 必须以 `synthetic:` 开头或 source registry 标记 synthetic，且 `source_kind=SYNTHETIC`。
- 合成记录必须用 `semantic_source_kind` 区分模拟 first-party、第三方估算、公开观察、用户提供或 AI 推断。
- `semantic_source_kind=THIRD_PARTY_ESTIMATE|AI_INFERENCE` 时同样要求 `is_estimated=true`。
- `date_basis=SNAPSHOT_TIME` 时 `observed_at` 必填。
- 区间 grain 必须有 `period_start` 和 `period_end`。
- 不适用币种使用 `currency=XXX`，不适用归因使用 `attribution_window=NONE, attribution_model=NONE`，禁止留空。
- `confidence` 必须在 `[0,1]`。验证通过的直接观测可用 1.0 表示对来源转录的信心；数据新鲜度和业务解释可信度另行计算。

## 3. 平台与采集表

### 3.1 主数据

| 表 | 关键字段 | 定义 |
|---|---|---|
| `tenant` | `tenant_id`, `name`, `status`, `created_at` | 租户；首版仅一条业务租户 |
| `marketplace_account` | `account_id`, `tenant_id`, `marketplace`, `seller_id_hash`, `business_timezone`, `default_currency` | 店铺账户；seller ID 可加密/哈希显示 |
| `source_registry` | `source_id`, `code`, `kind`, `synthetic`, `terms_url`, `enabled` | 来源分类与治理 |
| `source_connection` | `connection_id`, `source_id`, `account_id`, `status`, `secret_ref`, `capabilities`, `last_health_at` | 连接元数据；只保存 secret reference |
| `ingestion_run` | `ingestion_run_id`, `connection_id`, `dataset`, `window_start`, `window_end`, `status`, `idempotency_key`, row counts, timestamps | 一次采集/生成运行 |
| `raw_object` | `raw_object_id`, `ingestion_run_id`, `object_uri`, `sha256`, `bytes`, `content_type`, `source_cursor`, `created_at` | S3/MinIO 原始对象不可变清单 |
| `quarantine_record` | `quarantine_id`, `raw_object_id`, `record_locator`, `error_code`, `error_detail`, `created_at`, `resolved_at` | 无法标准化的记录 |
| `data_quality_result` | `dq_result_id`, `run_id`, `rule_code`, `scope`, `severity`, `status`, `observed_value`, `expected`, `provenance_id` | schema/完整性/新鲜度/协调检查 |

## 4. 商品与 Listing

### 4.1 `product`

| 字段 | 类型 | 定义 |
|---|---|---|
| `product_id` | uuid | 内部商品主键 |
| `tenant_id` | uuid | 租户 |
| `marketplace` | text | US |
| `asin` | varchar(20) | Amazon ASIN，唯一键的一部分 |
| `parent_asin` | varchar(20) nullable | 父体 ASIN |
| `brand` | text nullable | 品牌 |
| `product_type` | text nullable | 规范产品类型 |
| `title_current` | text nullable | 当前视图标题；权威历史在 listing_version |
| `active` | boolean | 是否纳入管理 |
| `provenance_id` | uuid | 创建/最近确认来源 |
| `synthetic` | boolean | 冗余安全标记 |

唯一约束：`tenant_id, marketplace, asin`。

### 4.2 `seller_sku`

`sku_id`、`product_id`、`seller_sku`、`fnsku`、`fulfillment_channel`、`condition`、`active_from`、`active_to`、`provenance_id`、`synthetic`。同一 SKU 仅在账户与 marketplace 范围唯一。

### 4.3 `product_stage_history`

`stage_history_id`、`tenant_id`、`product_id`、`recommended_stage`、`effective_stage`（LAUNCH/SCALE/HARVEST/RECOVERY）、`stage_confidence`、`stage_reasons jsonb`、`manual_override`、`override_reason`、`locked_by_user`、`effective_from`、`effective_to`、`objective_config_version_id`、`provenance_id`、`synthetic`。

任何时间点最多一个有效阶段。系统每天根据上架天数、7/14/30 天销量、自然排名、广告销售占比、TACOS、贡献利润、流量/CVR 趋势和库存生成 `recommended_stage`；建议可直接保存并触发提醒，但 `effective_stage` 只在用户确认、修改或解除锁定后产生新历史版本，不能被系统静默覆盖。

### 4.4 `listing_version`

| 字段 | 类型 | 定义 |
|---|---|---|
| `listing_version_id` | uuid | 版本主键 |
| `product_id` / `sku_id` | uuid | ASIN 和可选 SKU |
| `observed_at` | timestamptz | 版本采集时间 |
| `title` | text | 标题 |
| `bullet_points` | jsonb | 有序文本数组 |
| `description` | text nullable | 描述 |
| `attributes` | jsonb | 源属性 |
| `image_refs` | jsonb | 图片 URL/对象引用，不复制未授权资源 |
| `issues` | jsonb | 抑制/属性问题 |
| `buyable` | boolean nullable | 可售状态 |
| `content_hash` | text | 内容去重 hash |
| `provenance_id`, `source_kind`, `synthetic` |  | 强制元数据 |

## 5. 零售、价格与库存事实

以下表均包含 `fact_id`、`tenant_id`、`account_id`、`marketplace`、`provenance_id`、`source_kind`、`semantic_source_kind`、`synthetic`、`valid_from_run_id` 和 `created_at`。

### 5.1 `fact_sales_traffic_daily`

粒度：`ASIN_DAY`；另用 `product_id=NULL` 表示店铺日汇总，不从 ASIN 行重复汇总。

| 字段 | 类型 | 定义 |
|---|---|---|
| `business_date` | date | 来源业务日 |
| `product_id` | uuid nullable | ASIN；空表示 source-provided account total |
| `ordered_product_sales` | numeric(20,6) | Amazon Sales 口径金额 |
| `units_ordered` | bigint | 件数 |
| `total_order_items` | bigint | 订单项数，不承诺是去重买家订单数 |
| `sessions` | bigint | Amazon sessions |
| `page_views` | bigint nullable | 页面浏览 |
| `buy_box_percentage` | numeric(18,8) nullable | Featured Offer/Buy Box 占比 |
| `units_refunded` | bigint nullable | 如来源支持 |
| `currency` | char(3) | 金额币种 |

唯一业务键包含来源、版本和 `business_date, product_id`，保留修订版本；`current_fact_sales_traffic_daily` 视图选择最新有效版本。

### 5.2 `fact_price_snapshot`

粒度：`SKU_SNAPSHOT` 或 `COMPETITOR_ASIN_SNAPSHOT`。

`observed_at`、`product_id/competitor_product_id`、`sku_id`、`listing_price`、`shipping_price`、`landed_price`、`coupon_value`、`coupon_type`、`featured_offer`、`seller_name`、`fulfillment_type`、`currency`、强制 provenance。

### 5.3 `fact_inventory_snapshot`

粒度：`SKU_SNAPSHOT`。

`observed_at`、`sku_id`、`fulfillable_units`、`reserved_units`、`inbound_working_units`、`inbound_shipped_units`、`inbound_receiving_units`、`unfulfillable_units`、`researching_units`、`stranded_units`、强制 provenance。

### 5.4 `fact_inbound_shipment_item`

粒度：`SHIPMENT_SKU_SNAPSHOT`。

`shipment_external_id`、`sku_id`、`shipment_status`、`units_planned`、`units_shipped`、`units_received`、`expected_arrival_start/end`、`observed_at`、强制 provenance。

### 5.5 `fact_finance_transaction`

粒度：`FINANCIAL_EVENT`。保存 `transaction_type`、`posted_at`、`product_id/sku_id`、`quantity`、`amount`、`currency`、`settlement_ref_hash`、`order_ref_hash nullable`、强制 provenance。不得保存 buyer PII。

## 6. 广告数据

### 6.1 广告维表

| 表 | 关键字段 |
|---|---|
| `ad_profile` | profile ID、account、country、currency、profile type、provenance |
| `ad_campaign` | campaign ID、ad product、name、status、budget、strategy、valid_from/to、provenance |
| `ad_group` | ad group ID、campaign ID、name、status、default bid、valid_from/to |
| `ad_target` | target ID、ad group ID、target type、expression/keyword、match type、bid、status、valid_from/to |
| `advertised_product` | ad ID、ad group ID、ASIN、SKU、status、valid_from/to |

实体变更使用 SCD2：相同 source external ID 的属性变化创建新版本，不覆盖历史。

### 6.2 `fact_ad_performance`

粒度由 `grain` 明确，可为 CAMPAIGN_DAY、AD_GROUP_DAY、TARGET_DAY、SEARCH_TERM_DAY、PLACEMENT_DAY、ADVERTISED_PRODUCT_DAY、PURCHASED_PRODUCT_DAY 或对应 HOUR。

| 字段 | 类型 | 定义 |
|---|---|---|
| `period_start`, `period_end` | timestamptz | 流量日期/小时半开区间 |
| `reporting_system` | text | LEGACY_V3/UNIFIED_REPORTING/MARKETING_STREAM |
| `metric_namespace` | text | Amazon 指标集合版本 |
| `ad_product` | text | SP/SB/SD/DSP 等 |
| `campaign_id`, `ad_group_id`, `target_id`, `ad_id` | uuid nullable | 与 grain 一致的实体 |
| `search_term` | text nullable | 客户搜索词规范值 |
| `placement` | text nullable | placement 枚举 |
| `advertised_product_id` | uuid nullable | 被广告商品 |
| `purchased_product_id` | uuid nullable | 归因购买商品 |
| `impressions` | bigint | 曝光 |
| `clicks` | bigint | 点击 |
| `spend` | numeric(20,6) | 花费 |
| `attributed_purchases` | numeric(20,6) nullable | 来源定义的购买数 |
| `attributed_units` | numeric(20,6) nullable | 归因件数 |
| `attributed_sales` | numeric(20,6) nullable | 归因销售额 |
| `currency` | char(3) | 币种 |
| `conversion_maturity` | text | PROVISIONAL/MATURED/REVISED |
| `lookback_days` | smallint nullable | 回看天数 |
| `attribution_model` | text nullable | 归因模型 |

同一 grain 不能同时填充不相容实体。例如 TARGET_DAY 必须有 target，SEARCH_TERM_DAY 必须有 target/search_term。

## 7. 关键词、排名与市场

### 7.1 `keyword`

`keyword_id`、`tenant_id`、`marketplace`、`normalized_text`、`display_text`、`language`、`tags`、`priority`、`active`、`provenance_id`。规范化仅处理大小写、Unicode 和空白，不擅自做语义合并。

### 7.2 `product_keyword`

`product_keyword_id`、`product_id`、`keyword_id`、`role`（CORE/DEFENSE/EXPANSION/NEGATIVE_CANDIDATE）、`target_organic_rank`、`stage_weight`、`effective_from/to`、`provenance_id`。

### 7.3 `fact_keyword_rank_snapshot`

| 字段 | 定义 |
|---|---|
| `observed_at` | 搜索观测时间 |
| `product_id`, `keyword_id` | ASIN 与关键词 |
| `rank_type` | ORGANIC/AD |
| `rank_position` | 1-based 排名；未找到为空 |
| `found` | 是否在抓取范围找到 |
| `max_rank_checked` | 最大检查位次 |
| `page`, `position_on_page` | 来源提供时保存 |
| `device` | DESKTOP/MOBILE/UNKNOWN |
| `geo_context` | 国家/邮编策略，避免精确个人位置 |
| `search_context_hash` | 设备、地区、语言、筛选条件 hash |
| provenance | source、grain、estimated、confidence、synthetic |

`found=false` 不等于 rank=`max_rank_checked+1`；排名保持 NULL。

### 7.4 `fact_search_query_performance`

粒度：`QUERY_ASIN_PERIOD`。

`keyword_id/query_text`、`product_id`、`period_start/end`、`query_impressions`、`asin_impressions`、`query_clicks`、`asin_clicks`、`query_cart_adds`、`asin_cart_adds`、`query_purchases`、`asin_purchases`、来源直接份额字段、provenance。来源若只提供份额则 numerator/denominator 可空，但不得反推虚构整数。

### 7.5 `competitor_set` / `competitor_product`

竞争集合保存名称、用途和版本；成员保存 external ASIN、关系（DIRECT/SUBSTITUTE/REFERENCE）、用户确认状态、生效期。AI 只可提出候选，不能自动确认为直接竞品。

### 7.6 `fact_competitor_snapshot`

`competitor_product_id`、`observed_at`、`price`、`coupon`、`rating`、`rating_count`、`review_count`、`bsr`、`category_node`、`estimated_monthly_units`、`estimated_monthly_revenue`、`currency`、provenance。估算销量/销售额必须 `is_estimated=true`。

### 7.7 `fact_external_trend`

`platform`、`topic/keyword`、`region`、`observed_at/period`、`metric_name`、`metric_value`、`public_url`、`content_ref`、`license_use`、provenance。任何派生 trend score 单独记录 AI/估算 provenance。

### 7.8 选品市场与机会

| 表 | 关键字段与约束 |
|---|---|
| `market_niches` | `market_niche_id`、tenant、marketplace、名称、类目路径、价格带、状态、provenance、synthetic |
| `market_niche_snapshots` | niche、observed_at、需求/增长/集中度/价格/评论/季节性原始指标、估算区间、provenance；只追加 |
| `product_opportunities` | opportunity、niche、标题、hypothesis、状态、首次/最近发现时间、置信度、provenance |
| `opportunity_evidence` | opportunity、evidence_type、source ref、period、metric/value/unit、is_estimated、confidence、支持/反对方向 |
| `public_market_observations` | platform、external product/content ref、URL、observed_at、observation_type、payload、license/use note；必须 `source_kind=PUBLIC_WEB, semantic_source_kind=PUBLIC_OBSERVATION`，不得承载模拟订单、广告、销量或利润 |
| `creative_signals` | platform、content ref、topic、hook/theme/format、engagement observation、region、observed_at、public observation ref、派生分数 provenance |

### 7.9 候选产品项目

| 表 | 关键字段与约束 |
|---|---|
| `candidate_products` | `candidate_product_id`、tenant、marketplace、opportunity/niche、项目名、当前阶段、owner、active、provenance、synthetic |
| `candidate_product_snapshots` | candidate、observed_at、product concept、benchmark ASIN refs、价格/体积/重量/需求/竞争原始指标、provenance；只追加 |
| `candidate_evaluations` | candidate、score_version、evaluated_at、overall_score、decision、summary、open_verifications、calculation_run、provenance |
| `candidate_score_versions` | version、name、effective_from/to、normalization rules、weight checksum、code reference；发布后不可改 |
| `candidate_score_dimensions` | evaluation、dimension_code、raw_metrics jsonb、normalized_score、weight、weighted_score、source/evidence refs、is_estimated、confidence、penalty_reasons、manual_verification_items |
| `candidate_risks` | candidate/evaluation、risk_type、severity、likelihood、evidence refs、mitigation、status、verified_by/at |
| `candidate_differentiation_ideas` | candidate、idea、target pain point、evidence refs、feasibility、confidence、status |
| `candidate_research_tasks` | candidate、task_type、question、owner、due_at、status、result/evidence refs、created/completed time |
| `candidate_project_stage_history` | candidate、from_stage、to_stage、changed_at/by、reason、approval ref、evidence refs；只追加 |
| `candidate_rejection_reasons` | candidate、rejected_at/by、reason_code、detail、evidence refs、reconsideration_condition；拒绝时必填并可检索去重 |

候选状态机：`DISCOVERED -> PRELIMINARY_RESEARCH -> DEEP_VALIDATION -> PENDING_APPROVAL -> SUPPLIER_SEARCH -> SAMPLING -> COST_CONFIRMED -> SMALL_BATCH_PURCHASE -> LISTING_PREPARATION -> LAUNCH_TEST -> APPROVED_FOR_SCALE | REJECTED`。每次迁移追加历史；进入 `REJECTED` 必须存在至少一条原因和证据。

选品评分只能由 `candidate_score_versions` 的版本化规则和程序计算。初始维度为市场需求、需求增长、用户痛点、差异化空间、竞争可进入性、价格与贡献利润、广告可承受能力、供应链可行性、合规与知识产权风险、退货和售后风险、季节性、内容传播潜力。LLM 可解释或指出待核实事项，但不能直接写入 `normalized_score`、`weight` 或 `weighted_score`。

## 8. 评价、文档与成本

### 8.1 `feedback_theme_observation`

`theme_observation_id`、`product_id/browse_node`、`feedback_type`（REVIEW/RETURN）、`theme_code`、`theme_label`、`period`、`mention_count`、`sentiment`、`evidence_refs`、`model_run_id`、provenance。买家标识和原始个人资料不进入表。

### 8.2 `document`

`document_id`、`tenant_id`、`document_type`、`object_uri`、`sha256`、`original_filename`、`mime_type`、`uploaded_by`、`status`、`supersedes_document_id`、`retention_class`、`provenance_id`。对象存储加密，API 返回短时签名链接。

### 8.3 `document_extracted_field`

`field_id`、`document_id`、`field_name`、`raw_text`、`normalized_value`、`data_type`、`page_number`、`evidence_locator`、`confidence`、`confirmation_status`、`confirmed_value`、`confirmed_by/at`、`provenance_id`。

### 8.4 `product_cost_version`

| 字段 | 定义 |
|---|---|
| `cost_version_id` | 成本版本 |
| `product_id/sku_id` | 适用对象 |
| `effective_from/to` | 生效区间 |
| `unit_product_cost` | 单件采购成本 |
| `unit_packaging_cost` | 单件包装 |
| `unit_inbound_freight` | 单件头程分摊 |
| `unit_duty` | 单件关税分摊 |
| `other_unit_cost` | 其他变动成本 |
| `original_currency` | 原币 |
| `reporting_currency` | USD |
| `fx_rate_id` | 换汇依据 |
| `completeness_status` | COMPLETE/PARTIAL/UNCONFIRMED |
| `document_field_refs` | 已确认文件字段引用 |
| `provenance_id` | 用户确认来源 |

### 8.5 `fx_rate`

`fx_rate_id`、`rate_date`、`base_currency`、`quote_currency`、`rate`、`rate_type`、provenance。换算保留原币值和汇率，不覆盖原值。

### 8.6 供应商、采购与付款

| 表 | 关键字段与约束 |
|---|---|
| `suppliers` | supplier、tenant、name、country/region、status、tax/business ref hash、provenance |
| `supplier_contacts` | supplier、name/role、contact fields encrypted、preferred channel、active；最小化保存个人信息 |
| `supplier_products` | supplier、candidate/product、supplier SKU、MOQ、lead time、specification、status |
| `supplier_quotes` | quote、supplier、candidate/product、quoted_at、valid_until、currency、MOQ、quantity tiers、unit price、sample terms、payment terms、Incoterm、document ref、confirmation status |
| `contracts` | contract、supplier、contract number、amount/currency、signed/effective dates、payment terms、document ref、confirmation status |
| `purchase_orders` | PO、supplier、contract、order date、currency、total、deposit/tail amounts、status、expected ship/arrival、document ref |
| `purchase_order_items` | PO、supplier product、product/SKU/candidate、quantity、unit price、currency、line total、received quantity |
| `supplier_payments` | payment、supplier、transfer date、amount/currency、payment type DEPOSIT/BALANCE/OTHER、proof document ref、confirmation status |
| `payment_allocations` | payment、contract/PO、allocated amount/currency、allocation date；同一付款分摊合计不得超过已确认付款金额 |

### 8.7 物流、批次与落地成本

| 表 | 关键字段与约束 |
|---|---|
| `logistics_shipments` | shipment、supplier/PO、mode、carrier ref hash、ship date、estimated/actual arrival、origin/destination、status、currency |
| `logistics_shipment_items` | shipment、PO item、SKU/candidate、quantity shipped/received、cartons、weight/volume |
| `inventory_batches` | batch、SKU/product/candidate、shipment、received_at、quantity、remaining quantity、cost version、status |
| `landed_cost_allocations` | batch/shipment、cost_type、source cost ref、allocation_method、allocated amount/currency、allocated unit cost、version |
| `customs_costs` | shipment、duty/tax/brokerage type、amount/currency、document ref、confirmation status |
| `freight_costs` | shipment、freight/insurance/handling type、amount/currency、document ref、confirmation status |
| `packaging_costs` | supplier product/product/candidate、packaging type、quantity basis、amount/currency、effective range、confirmation status |
| `document_entity_links` | document、entity_type/entity_id、relationship、linked_by/at、confirmation status；同租户约束 |
| `sample_orders` | candidate、supplier、quote、ordered_at、quantity、amount/currency、status、expected/received date |
| `sample_evaluations` | sample order、evaluated_at/by、dimension scores、defects、photos/document refs、decision、follow-up |
| `product_cost_scenarios` | candidate/product、version、quantity、purchase/freight/duty/packaging/other amounts、FX assumptions、unit landed cost、contribution margin、break-even ACOS、confidence、status |

OCR 写入 `document_extracted_field` 后默认 `UNCONFIRMED`。只有用户确认的字段可被供应商报价、合同、付款、物流和成本版本引用；`product_cost_version.completeness_status=COMPLETE` 还必须通过字段确认、币种、数量和分摊平衡校验。

## 9. 指标、洞察和工作流

### 9.1 `metric_definition`

`metric_definition_id`、`metric_key`、`version`、`label`、`description`、`formula_sql_ref`、`numerator_metric`、`denominator_metric`、`allowed_grains`、`required_date_basis`、`attribution_constraints`、`unit`、`zero_denominator_behavior`、`effective_from/to`、`checksum`。

### 9.2 `metric_observation`

`metric_observation_id`、`metric_definition_id`、`scope_type/scope_id`、`period_start/end`、`value_numeric`、`value_date`、`unit`、`currency`、`maturity`、`calculation_run_id`、`input_lineage`、`provenance_id`、`source_kind`、`synthetic`。数值和日期仅一个可非空。

### 9.3 `alert_event`

`alert_event_id`、`rule_version_id`、`scope`、`status`（OPEN/ACKNOWLEDGED/RECOVERED）、`severity`、`started_at`、`last_seen_at`、`recovered_at`、`dedupe_key`、`evidence_metric_ids`、provenance。

### 9.4 `insight`

`insight_id`、`type`（ANOMALY/CAUSE/OPPORTUNITY/DATA_QUALITY）、`scope`、`title`、`summary`、`confidence`、`causal_status`、`evidence_metric_ids`、`counter_evidence`、`alternative_hypotheses`、`status`、`model_run_id nullable`、provenance。

### 9.5 `recommendation`

`recommendation_id`、`insight_id`、`action_type`、`target_type/id`、`proposed_change`、`expected_direction`、`expected_range nullable`、`risk`、`priority_components`、`priority_score`、`review_window`、`expires_at`、`status`、provenance。

### 9.6 `approval_draft` 与事件

`approval_draft` 保存 recommendation、目标当前/建议快照、状态、输入数据版本、冲突状态、版本号、创建者。`approval_event` 只追加保存 `from_status`、`to_status`、actor、reason、timestamp、payload hash。MVP 的批准终态为 `APPROVED_NOT_EXECUTED`。

### 9.7 `manual_execution_record`

`manual_execution_id`、`approval_draft_id`、`recorded_by/at`、`claimed_executed_at`、`execution_method=MANUAL_RECORDED`、`evidence_document_id nullable`、`before_snapshot`、`after_snapshot`。该记录不是 API 成功证明。

### 9.8 `experiment` / `experiment_review`

实验保存 hypothesis、treatment scope、control/baseline、primary metric、guardrails、pre/post windows、success rule 和干扰事件；复盘保存已计算结果、数据成熟度、结论与 provenance。

### 9.9 `model_run`

`model_run_id`、`purpose`、`provider/model`、`prompt_template_version`、`tool_calls`、`input_metric_ids`、`output_object_uri/json`、`schema_valid`、`citation_valid`、`tokens/cost`、`started/finished_at`、provenance。提示中不得包含密钥或非必要 PII。

## 10. 关键枚举

| 枚举 | 值 |
|---|---|
| Product stage | `LAUNCH`, `SCALE`, `HARVEST`, `RECOVERY` |
| Candidate project stage | `DISCOVERED`, `PRELIMINARY_RESEARCH`, `DEEP_VALIDATION`, `PENDING_APPROVAL`, `SUPPLIER_SEARCH`, `SAMPLING`, `COST_CONFIRMED`, `SMALL_BATCH_PURCHASE`, `LISTING_PREPARATION`, `LAUNCH_TEST`, `APPROVED_FOR_SCALE`, `REJECTED` |
| Data maturity | `PROVISIONAL`, `MATURED`, `REVISED`, `INCOMPLETE` |
| Causal status | `OBSERVED_ASSOCIATION`, `EXPERIMENT_SUPPORTED`, `UNKNOWN` |
| Approval status | `DRAFT`, `READY_FOR_REVIEW`, `APPROVED_NOT_EXECUTED`, `REJECTED`, `SNOOZED`, `EXPIRED`, `STALE` |
| Connection status | `SIMULATED`, `DISCONNECTED`, `CONNECTING`, `CONNECTED_READ_ONLY`, `DEGRADED`, `NOT_ELIGIBLE`, `AUTH_ERROR`, `DISABLED` |
| Confidence class | UI 派生：LOW `<0.5`、MEDIUM `0.5-<0.8`、HIGH `>=0.8`；原始值仍保存 |
| Extracted field confirmation | `UNCONFIRMED`, `CONFIRMED`, `REJECTED`, `SUPERSEDED` |

## 11. 数据质量最小规则

- 非负：impressions、clicks、orders、units、spend、sales、inventory，除非 transaction 类型允许负数。
- 单调约束：clicks <= impressions；ASIN share numerator <= query total（来源定义一致时）。
- 金额必须有 currency，比例必须在来源允许范围。
- 所有 ASIN/SKU/广告实体外键解析成功；否则 quarantine。
- 同一序列不混合 timezone、date basis、attribution model 或 synthetic 标志。
- 日级连续性缺口、来源延迟和异常零值分别识别。
- Store total 不通过 ASIN 行简单求和替代，除非指标定义明确允许。
- 成本 `PARTIAL/UNCONFIRMED` 时贡献利润与 break-even ACOS 不发布为确定值。
- `candidate_evaluations.overall_score` 必须等于同一 evaluation 的程序化 `weighted_score` 合计；LLM 输出不能成为评分事实。
- 候选进入 `REJECTED` 时必须存在 rejection reason 与 evidence；新研究任务创建前检查相同概念与拒绝原因，避免重复研究。
