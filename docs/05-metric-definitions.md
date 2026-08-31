# 指标口径表

## 1. 通用计算规则

1. 分母为 0 或 NULL 时，比率返回 NULL，不返回 0、无穷大或 100%。
2. 所有聚合先求分子/分母总和再相除，禁止平均日 CTR/CVR/ACOS。
3. 金额计算要求同币种；发生换汇时保留汇率 ID、原币与换算值。
4. 比较要求 scope、grain、timezone、date basis、attribution model/window 兼容。
5. 广告转化在窗口未成熟时标记 `PROVISIONAL`。
6. 第三方估算与 Amazon first-party 不合计；可以并列比较并显示来源。
7. 每个指标对应版本化 SQL 文件；文档公式是语义契约，不替代 SQL 测试。

## 2. 核心指标

| Metric key | 显示名 | 公式/来源字段 | 主要来源与粒度 | 口径约束 |
|---|---|---|---|---|
| `retail.sales` | Sales | `SUM(ordered_product_sales)` | SP Sales & Traffic，ASIN/store-day | 订单日、同币种；是 ordered product sales，不等于结算净收入 |
| `retail.orders` | Orders | `SUM(total_order_items)` | SP Sales & Traffic，ASIN/store-day | 实际为 order items；UI tooltip 明示，不声称去重客户订单 |
| `retail.units` | Units | `SUM(units_ordered)` | SP Sales & Traffic | 订单件数 |
| `retail.sessions` | Sessions | `SUM(sessions)` | SP Sales & Traffic | Amazon 会话定义；store total 优先 source-provided total |
| `retail.unit_session_percentage` | Unit Session Percentage | `SUM(units_ordered) / NULLIF(SUM(sessions),0)` | ASIN/store-period | 比率；与来源字段 reconcile |
| `ads.impressions` | Impressions | `SUM(impressions)` | Ads，同 reporting system/grain | traffic date |
| `ads.clicks` | Clicks | `SUM(clicks)` | Ads | traffic date |
| `ads.ctr` | CTR | `SUM(clicks) / NULLIF(SUM(impressions),0)` | Ads | 不平均行级 CTR |
| `ads.cpc` | CPC | `SUM(spend) / NULLIF(SUM(clicks),0)` | Ads | 同币种；traffic date |
| `retail.cvr_units` | Retail Unit CVR | `SUM(units_ordered) / NULLIF(SUM(sessions),0)` | Retail | 等同 USP 的小数形式，UI 统一命名 |
| `retail.cvr_order_items` | Retail Order-item CVR | `SUM(total_order_items) / NULLIF(SUM(sessions),0)` | Retail | 与 unit CVR 分开 |
| `ads.cvr_click_purchase` | Ad Click CVR | `SUM(attributed_purchases) / NULLIF(SUM(clicks),0)` | Ads | 同归因模型/window；provisional 状态透传 |
| `ads.spend` | Spend | `SUM(spend)` | Ads | traffic date、同币种 |
| `ads.sales` | Ad Sales | `SUM(attributed_sales)` | Ads | 按来源归因到 traffic date；保存 promoted/brand halo namespace |
| `ads.acos` | ACOS | `SUM(spend) / NULLIF(SUM(attributed_sales),0)` | Ads | 同 reporting system、window、metric namespace、币种 |
| `ads.roas` | ROAS | `SUM(attributed_sales) / NULLIF(SUM(spend),0)` | Ads | ACOS 倒数只在双方非零时成立 |
| `blended.tacos_operational` | TACOS (Operational) | `Ads spend by traffic date / retail sales by order date` | Ads + SP daily | 明确是混合 date basis 的经营监控指标，不作为因果归因 |
| `finance.contribution_margin_pre_ads` | Pre-ad Contribution Margin | `net_sales - non_ad_variable_costs` | Finance mart，ASIN-period | 成本完整才给确定值 |
| `finance.contribution_margin` | Contribution Margin | `net_sales - non_ad_variable_costs - ad_spend` | Finance mart | 广告后贡献利润；利润收割阶段优先，其他阶段作为目标或止损约束，混合口径需 tooltip |
| `finance.contribution_margin_rate` | Contribution Margin % | `contribution_margin / NULLIF(net_sales,0)` | Finance mart | 允许为负 |
| `finance.break_even_acos` | Break-even ACOS | `contribution_margin_pre_ads / NULLIF(net_sales,0)` | Finance mart | 表示广告前贡献率；成本不完整时 NULL/区间 |
| `inventory.demand_velocity_28d` | 28d Demand Velocity | `units on eligible in-stock days / eligible day count` | Retail + inventory | 排除明确断货日；规则版本化 |
| `inventory.days_on_hand` | 库存天数 | `fulfillable_units / demand_velocity_28d` | 最新库存 + velocity | velocity <= 0 时 NULL；不是无穷大 |
| `inventory.stockout_date_on_hand` | 断货日期（现货） | `as_of_business_date + floor(days_on_hand)` | Inventory mart | 不含 inbound；返回日期与置信区间 |
| `inventory.stockout_date_projected` | 断货日期（含可信入库） | 模拟每日消耗并加入 ETA 在覆盖期内的 confirmed inbound | Inventory projection | 预测值，`is_estimated=true`，保留假设 |
| `search.organic_rank` | 自然排名 | 来源快照 `rank_position` | keyword-ASIN-snapshot | 相同 search context 才形成趋势；未找到为 NULL |
| `search.ad_rank` | 广告排名 | 来源快照 `rank_position` | keyword-ASIN-snapshot | 与 Ads impression 不等价 |
| `search.click_share` | 搜索点击份额 | `asin_clicks / query_clicks` 或来源份额字段 | Brand Analytics query-ASIN-period | 分母为全查询点击；不可与广告 CTR 相加 |
| `search.purchase_share` | 搜索购买份额 | `asin_purchases / query_purchases` 或来源份额字段 | Brand Analytics | 来源周期；不是市场总销量份额 |

## 3. 财务派生口径

### 3.1 Net sales

`net_sales = gross_ordered_sales - refunds - promotion_discounts - seller_funded_concessions`

销售税等平台代收代缴项目不计为收入。若退款尚未成熟，net sales 标记 provisional。

### 3.2 Non-ad variable costs

```text
non_ad_variable_costs =
  COGS
  + packaging
  + inbound_freight_allocated
  + duty_allocated
  + referral_fees
  + fulfillment_fees
  + storage_allocated
  + coupon_and_promotion_fees
  + return_processing_and_writeoff
  + other_variable_costs
```

固定人力、软件订阅和企业管理费用不进入 MVP Contribution Margin；未来另做 operating profit。每个成本分量都可展开，禁止只保存一个黑箱利润值。

### 3.3 Ad spend allocation

- advertised product grain 可直接归属 ASIN。
- campaign/target 没有商品归属时，按已注册规则分配或进入 unallocated pool。
- 未分配广告花费不应从店铺总贡献利润消失；店铺级计入，ASIN 级显示分配覆盖率。
- 不以 ad sales 比例默认分摊花费，除非明确选择并版本化该规则。

## 4. 基线与异常指标

首页指标优先级按 `effective_stage` 解析：LAUNCH 使用 orders、核心词 impressions/clicks/CVR/rank，利润作为 guardrail；SCALE 使用 sales growth、marginal ACOS、TACOS、inventory cover；HARVEST 使用 contribution margin、cash efficiency、organic order share；RECOVERY 使用 target keyword rank、orders、CVR 与 traffic mix。跨阶段店铺视图按风险严重度和 ASIN 业务权重组合，不把贡献利润强制设为唯一总目标。

| Metric key | 定义 | 备注 |
|---|---|---|
| `baseline.same_weekday_8w_median` | 最近 8 个可用同星期业务日中位数 | 排除明确断货/数据不完整日，排除规则留痕 |
| `baseline.trailing_28d_mean` | 最近 28 个合格业务日均值 | 用于速度，不用于强季节性判断 |
| `anomaly.robust_zscore` | `(x - median) / (1.4826 * MAD)` | MAD=0 时使用业务阈值或返回 NULL |
| `anomaly.percent_change` | `(current - baseline) / abs(baseline)` | baseline=0 时 NULL，另用 zero-to-positive 规则 |
| `data.completeness_rate` | received expected keys / expected keys | expected keys 来自 active entity 和数据集契约 |
| `data.freshness_lag` | `now - max(collected_at or period_end)` | 同时显示 source SLA |

异常不是单一阈值：至少结合绝对变化、相对变化、持续时长、数据完整度和经营阶段。规则输出触发因子，不由 AI 决定是否越线。

## 5. “为什么出单/没出单”分解

订单近似由流量与转化共同决定，但系统不把恒等式当因果证明。

### 5.1 诊断分解

对日级 retail：

`expected_units = baseline_sessions * baseline_unit_cvr`

`traffic_effect = (current_sessions - baseline_sessions) * baseline_unit_cvr`

`conversion_effect = current_sessions * (current_unit_cvr - baseline_unit_cvr)`

`interaction_effect = (current_sessions - baseline_sessions) * (current_unit_cvr - baseline_unit_cvr)`

实现时采用无重复的 Shapley 两因子分解或明确保留 interaction；具体算法版本写入 metric definition。该分解只说明数学贡献，不声称流量/转化变化的根因。

### 5.2 下一级证据

- 流量：自然排名、广告 impressions/clicks、预算状态、外部趋势。
- 转化：价格、Coupon、Buy Box、评价主题、Listing 版本、流量结构。
- 供给：fulfillable、inbound、buyable、suppression。
- 数据：缺数、延迟、归因未成熟。

若 Sessions 日数据尚未到达，系统不得用广告 clicks 推断总 Sessions 后给确定结论；可以输出 `DATA_INCOMPLETE`。

## 6. 搜索与排名指标

### 6.1 Rank trend

- 排名越小越好，图表轴反转但原值不取负数。
- 多次日内快照保留；日指标默认中位数，并同时保存 best/worst/observations。
- 未找到不填充为最大位次；另算 `visibility_rate = found observations / total observations`。
- 不同 `search_context_hash` 不能合并成一条趋势。

### 6.2 Share 指标

Brand Analytics 的 click share/purchase share 是某 query 和 period 下该 ASIN 的份额。它们：

- 不等于广告 click share。
- 不等于全类目市场份额。
- 不与 SellerSprite 搜索量估算直接相乘后当成真实 clicks/purchases。
- 可以用估算搜索量做情景估计，但输出必须 `is_estimated=true` 并展示范围。

## 7. 广告报表成熟度

每个转化指标计算 `matures_at = period_end + attribution_lookback + source_processing_lag`。状态：

- `PROVISIONAL`：仍可能回补。
- `MATURED`：窗口结束且已完成最后一次回补。
- `REVISED`：成熟后来源又修订。
- `INCOMPLETE`：报告/字段缺失。

流量指标与转化指标可有不同 freshness；API 必须分别返回。Amazon Ads 统一报表迁移前后使用不同 metric namespace，除非映射通过 golden comparison，不生成跨版本同比。

## 8. 置信度

置信度不是一个统一拍脑袋分数，按产物类型计算：

- 观测数据：来源可靠度、schema 通过、完整度、新鲜度、reconcile 状态。
- 异常：样本量、偏差幅度、持续时间、基线稳定度、数据质量。
- 原因：证据覆盖、反证、时间先后、机制合理性；纯相关最高只能标 `OBSERVED_ASSOCIATION`。
- 预测：训练/回测误差和预测区间覆盖；没有回测时不输出精确概率。

LLM 可以解释置信度因子，不能覆盖计算结果。

## 9. SQL 复算要求

每个 metric definition 的代码资产至少包含：

```text
metrics/<metric_key>/<version>/definition.sql
metrics/<metric_key>/<version>/schema.yml
metrics/<metric_key>/<version>/tests.sql
metrics/<metric_key>/<version>/README.md
```

测试包括正常值、空值、零分母、币种冲突、归因冲突、重复输入、迟到修订和 synthetic/real 混合拒绝。API 返回 `metric_definition_id` 和可读公式，不直接向前端开放任意 SQL 执行。
