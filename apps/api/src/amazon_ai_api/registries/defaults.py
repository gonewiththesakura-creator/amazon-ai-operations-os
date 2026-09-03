from __future__ import annotations

from dataclasses import dataclass

from amazon_ai_api.models.components import (
    AdDiagnosisPayload,
    CompetitorChangePayload,
    CriticalAlertPayload,
    DataReferencePayload,
    ExecutiveSummaryPayload,
    ExperimentResultPayload,
    OrderFunnelPayload,
    PositiveSignalPayload,
    ProductOpportunityPayload,
)
from amazon_ai_api.models.home import ComponentType
from amazon_ai_api.registries.agents import AgentDefinition, AgentRegistry
from amazon_ai_api.registries.base import RegistryError
from amazon_ai_api.registries.components import ComponentDefinition, ComponentRegistry
from amazon_ai_api.registries.tools import ToolAccessMode, ToolDefinition, ToolRegistry


STORE = "store_operations"
ADS = "ads_search_terms"
LISTING = "listing_conversion"
KEYWORD = "keyword_ranking"
COMPETITOR = "competitor"
PRODUCT = "product_research"
INVENTORY = "inventory_replenishment"
FINANCE = "finance_profit"
REVIEWS = "reviews_customer_voice"
POLICY = "market_policy"
CREATIVE = "creative_short_video"
RISK = "risk_compliance"


@dataclass(frozen=True, slots=True)
class RegistryBundle:
    components: ComponentRegistry
    agents: AgentRegistry
    tools: ToolRegistry

    def validate(self) -> None:
        self.tools.assert_mvp_safe()
        for agent in self.agents.list_public():
            unknown_tools = [name for name in agent.tool_names if name not in self.tool_names]
            if unknown_tools:
                raise RegistryError(
                    f"agent {agent.agent_id} references unknown tools: {unknown_tools}"
                )
            disallowed = [
                name
                for name in agent.tool_names
                if agent.agent_id not in self.tools.get(name).allowed_agents
            ]
            if disallowed:
                raise RegistryError(
                    f"agent {agent.agent_id} is not allowed to use tools: {disallowed}"
                )

    @property
    def tool_names(self) -> frozenset[str]:
        return frozenset(item.name for item in self.tools.list_public())


def _build_component_registry() -> ComponentRegistry:
    registry = ComponentRegistry()
    payload_models = {
        ComponentType.EXECUTIVE_SUMMARY: ExecutiveSummaryPayload,
        ComponentType.POSITIVE_SIGNAL: PositiveSignalPayload,
        ComponentType.CRITICAL_ALERT: CriticalAlertPayload,
        ComponentType.ORDER_FUNNEL: OrderFunnelPayload,
        ComponentType.AD_DIAGNOSIS: AdDiagnosisPayload,
        ComponentType.COMPETITOR_CHANGE: CompetitorChangePayload,
        ComponentType.PRODUCT_OPPORTUNITY: ProductOpportunityPayload,
        ComponentType.EXPERIMENT_RESULT: ExperimentResultPayload,
    }
    for component_type in ComponentType:
        registry.register(
            ComponentDefinition(
                component_type=component_type,
                version="1.0",
                payload_model=payload_models.get(component_type, DataReferencePayload),
            )
        )
    return registry


def _tool(
    name: str,
    description: str,
    capabilities: tuple[str, ...],
    agents: tuple[str, ...],
    *,
    draft: bool = False,
) -> ToolDefinition:
    return ToolDefinition(
        name=name,
        description=description,
        access_mode=(
            ToolAccessMode.INTERNAL_DRAFT_WRITE if draft else ToolAccessMode.READ_ONLY
        ),
        capabilities=capabilities,
        allowed_agents=agents,
        required_permission="recommendation:draft" if draft else "analytics:read",
    )


def _build_tool_registry() -> ToolRegistry:
    registry = ToolRegistry()
    definitions = (
        _tool("get_store_summary", "Read store summary metrics.", ("store",), (STORE,)),
        _tool(
            "get_asin_performance",
            "Read ASIN performance and availability.",
            ("asin", "conversion"),
            (STORE, LISTING, INVENTORY, REVIEWS),
        ),
        _tool("get_order_funnel", "Read the order funnel.", ("funnel",), (STORE, LISTING)),
        _tool("get_ad_performance", "Read ad performance.", ("ads",), (ADS, KEYWORD)),
        _tool("get_search_terms", "Read search term performance.", ("search_terms",), (ADS, KEYWORD)),
        _tool("get_keyword_ranking", "Read keyword rankings.", ("ranking",), (KEYWORD,)),
        _tool(
            "compare_periods",
            "Compare compatible metric periods.",
            ("comparison",),
            (STORE, ADS, LISTING, KEYWORD, COMPETITOR, INVENTORY, FINANCE),
        ),
        _tool(
            "detect_anomalies",
            "Read deterministic anomaly results.",
            ("anomaly",),
            (STORE, ADS, RISK),
        ),
        _tool(
            "get_metric_series",
            "Read a deterministic metric time series for visualization.",
            ("visualization", "series"),
            (STORE, ADS, LISTING, KEYWORD, INVENTORY, FINANCE),
        ),
        _tool(
            "get_top_entities",
            "Read a deterministic top-five entity ranking for visualization.",
            ("visualization", "ranking"),
            (STORE, ADS, LISTING, INVENTORY, FINANCE),
        ),
        _tool(
            "get_mix_breakdown",
            "Read a deterministic part-to-whole entity breakdown for visualization.",
            ("visualization", "mix"),
            (STORE, ADS, LISTING, INVENTORY, FINANCE),
        ),
        _tool(
            "explain_metric_change",
            "Read an evidence-backed metric change decomposition.",
            ("explanation",),
            (STORE, ADS, LISTING, KEYWORD),
        ),
        _tool(
            "get_inventory_risk",
            "Read inventory coverage and stockout projections.",
            ("inventory",),
            (INVENTORY, RISK),
        ),
        _tool(
            "calculate_contribution_margin",
            "Run deterministic contribution margin calculation.",
            ("finance",),
            (FINANCE,),
        ),
        _tool(
            "simulate_price_and_profit",
            "Run a deterministic price and profit scenario.",
            ("simulation", "finance"),
            (FINANCE,),
        ),
        _tool(
            "get_competitor_changes",
            "Read confirmed competitor set changes.",
            ("competitor",),
            (COMPETITOR, LISTING),
        ),
        _tool(
            "get_review_topics",
            "Read privacy-safe review and feedback topics.",
            ("reviews",),
            (REVIEWS, LISTING, PRODUCT, CREATIVE),
        ),
        _tool(
            "find_product_opportunities",
            "Read ranked synthetic product opportunity candidates.",
            ("product_research",),
            (PRODUCT,),
        ),
        _tool(
            "evaluate_product_candidate",
            "Run deterministic candidate evaluation.",
            ("candidate_evaluation",),
            (PRODUCT, RISK),
        ),
        _tool(
            "search_amazon_policy",
            "Search authorized policy fixtures or approved official sources.",
            ("policy",),
            (POLICY, RISK),
        ),
        _tool(
            "analyze_policy_impact",
            "Analyze policy impact against current catalog facts.",
            ("policy_impact",),
            (POLICY, RISK),
        ),
        _tool(
            "search_market_news",
            "Search authorized market news sources.",
            ("market_news",),
            (POLICY, PRODUCT, CREATIVE),
        ),
        _tool(
            "get_experiment_results",
            "Read experiment results and maturity.",
            ("experiments",),
            (STORE, PRODUCT, CREATIVE),
        ),
        _tool(
            "create_recommendation",
            "Create an internal recommendation draft only.",
            ("recommendation_draft",),
            (STORE, ADS, LISTING, KEYWORD, PRODUCT, INVENTORY, FINANCE, POLICY, CREATIVE, RISK),
            draft=True,
        ),
        _tool(
            "request_user_approval",
            "Create an internal approval request; it never executes externally.",
            ("approval_draft",),
            (ADS, LISTING, INVENTORY, FINANCE, POLICY, RISK),
            draft=True,
        ),
    )
    for definition in definitions:
        registry.register(definition)
    registry.assert_mvp_safe()
    return registry


def _agent(
    agent_id: str,
    display_name: str,
    responsibility: str,
    tool_names: tuple[str, ...],
    *,
    max_tool_calls: int = 8,
) -> AgentDefinition:
    return AgentDefinition(
        agent_id=agent_id,
        display_name=display_name,
        responsibility=responsibility,
        tool_names=tool_names,
        output_schema="FindingEnvelope@1.0",
        prompt_version="1.0",
        max_tool_calls=max_tool_calls,
    )


def _build_agent_registry() -> AgentRegistry:
    registry = AgentRegistry()
    definitions = (
        _agent(
            STORE,
            "店铺经营 Agent",
            "全店经营判断、订单漏斗和行动排序。",
            ("get_store_summary", "get_asin_performance", "get_order_funnel", "compare_periods", "detect_anomalies", "explain_metric_change", "get_experiment_results", "create_recommendation"),
        ),
        _agent(
            ADS,
            "广告与搜索词 Agent",
            "广告、预算、竞价和搜索词诊断。",
            ("get_ad_performance", "get_search_terms", "compare_periods", "detect_anomalies", "explain_metric_change", "create_recommendation", "request_user_approval"),
        ),
        _agent(
            LISTING,
            "Listing 与转化 Agent",
            "Listing、可售、价格和转化阻断。",
            ("get_asin_performance", "get_order_funnel", "compare_periods", "explain_metric_change", "get_competitor_changes", "get_review_topics", "create_recommendation", "request_user_approval"),
        ),
        _agent(
            KEYWORD,
            "关键词与自然排名 Agent",
            "收录、排名、份额和关键词机会。",
            ("get_ad_performance", "get_search_terms", "get_keyword_ranking", "compare_periods", "explain_metric_change", "create_recommendation"),
        ),
        _agent(
            COMPETITOR,
            "竞品 Agent",
            "竞品价格、优惠、评价和变化。",
            ("get_competitor_changes", "compare_periods"),
        ),
        _agent(
            PRODUCT,
            "选品 Agent",
            "机会召回、候选评估和验证计划。",
            ("get_review_topics", "find_product_opportunities", "evaluate_product_candidate", "search_market_news", "get_experiment_results", "create_recommendation"),
        ),
        _agent(
            INVENTORY,
            "库存与补货 Agent",
            "库存覆盖、断货和补货草案。",
            ("get_asin_performance", "compare_periods", "get_inventory_risk", "create_recommendation", "request_user_approval"),
        ),
        _agent(
            FINANCE,
            "财务与利润 Agent",
            "成本完整度、贡献利润和情景模拟。",
            ("compare_periods", "calculate_contribution_margin", "simulate_price_and_profit", "create_recommendation", "request_user_approval"),
        ),
        _agent(
            REVIEWS,
            "评价与用户痛点 Agent",
            "评价、退货和用户痛点主题。",
            ("get_asin_performance", "get_review_topics"),
        ),
        _agent(
            POLICY,
            "市场趋势与政策 Agent",
            "官方政策、新闻、市场趋势和影响对象。",
            ("search_amazon_policy", "analyze_policy_impact", "search_market_news", "create_recommendation", "request_user_approval"),
        ),
        _agent(
            CREATIVE,
            "创意与短视频 Agent",
            "公开创意信号和实验草案。",
            ("get_review_topics", "search_market_news", "get_experiment_results", "create_recommendation"),
        ),
        _agent(
            RISK,
            "风险与合规 Agent",
            "数据、政策、审批和操作风险。",
            ("detect_anomalies", "get_inventory_risk", "evaluate_product_candidate", "search_amazon_policy", "analyze_policy_impact", "create_recommendation", "request_user_approval"),
        ),
    )
    for definition in definitions:
        registry.register(definition)
    return registry


def build_default_registries() -> RegistryBundle:
    bundle = RegistryBundle(
        components=_build_component_registry(),
        agents=_build_agent_registry(),
        tools=_build_tool_registry(),
    )
    bundle.validate()
    return bundle
