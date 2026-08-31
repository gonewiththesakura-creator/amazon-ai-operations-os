# 权限与安全方案

## 1. 安全目标

- 最小化 Amazon 和用户数据采集，MVP 不需要买家 PII。
- 密钥不进入代码、数据库明文字段、日志、前端或 LLM 上下文。
- 分离分析、草案、审批和执行权限。
- 所有建议、审批、配置和人工执行记录可审计。
- 合成与真实环境强隔离，防止演示数据污染生产结论。
- 上传文件经过隔离、扫描、加密、权限控制和留存治理。

## 2. 身份与认证

### 2.1 用户认证

- 使用受支持的 OIDC 身份提供商或托管认证；生产强制 MFA。
- Web 使用安全 HttpOnly、Secure、SameSite session cookie，不把长期 token 放 localStorage。
- 状态改变请求要求 CSRF 防护、Origin 校验和短时 session。
- 登录、MFA、权限失败和异常地点/设备事件进入安全审计。
- 首版单用户也不使用共享管理员密码。

### 2.2 服务身份

`web`、`api`、`worker`、`scheduler`、`mcp`、`migration` 使用不同数据库/云服务身份：

| 服务 | 最小权限 |
|---|---|
| Web | 无数据库和对象存储直连，只访问 API |
| API | 业务读写、短时预签名 URL、无外部密钥枚举 |
| Worker | 指定数据 schema 写入、读取指定 secret、对象读写 |
| Scheduler | 触发任务，不直接读业务数据 |
| Internal MCP | 分析只读 + 创建审批草案 |
| Migration | DDL，仅部署期间启用 |

## 3. RBAC 模型

尽管 MVP 实际只有 Owner，仍定义以下角色：

| 能力 | Owner | Operator | Analyst | Approver | Auditor | Integration Service |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| 查看经营指标 | ✓ | ✓ | ✓ | ✓ | ✓ | 最小任务范围 |
| 管理数据连接 | ✓ |  |  |  | 查看状态 | 运行指定连接 |
| 上传业务文件 | ✓ | ✓ |  |  | 查看元数据 | 处理文件 |
| 确认提取成本 | ✓ | ✓ |  |  | 查看 |  |
| 编辑阶段/阈值 | ✓ | ✓ |  |  | 查看 |  |
| 创建/编辑草案 | ✓ | ✓ | ✓ | ✓ | 查看 | MCP 仅创建 |
| 批准/驳回 | ✓ |  |  | ✓ | 查看 |  |
| 记录人工执行 | ✓ | ✓ |  |  | 查看 |  |
| 调用外部写 API | 无（MVP） | 无 | 无 | 无 | 无 | 无 |
| 查看审计日志 | ✓ | 自己/业务范围 | 只读范围 | 审批范围 | ✓ |  |
| 管理用户和角色 | ✓ |  |  |  |  |  |

权限是原子 capability，例如 `metrics.read`、`connections.manage`、`approval_draft.create`、`approval.approve`。API 不依赖前端隐藏按钮进行授权。

## 4. Tenant 隔离

- 所有业务表强制 `tenant_id NOT NULL`。
- PostgreSQL Row Level Security 由 `app.tenant_id` session setting 控制。
- 请求认证层解析 tenant，repository 查询仍显式带 tenant 条件，形成双层保护。
- 对象存储 key 前缀包含不可猜 UUID tenant，不使用用户输入拼路径。
- Prefect task payload 只传 tenant ID 和受控 object reference。
- 缓存 key、idempotency key、告警 dedupe key 均包含 tenant。

## 5. Amazon 与第三方凭证

- SP-API LWA refresh token、Ads refresh token、SellerSprite secret、Keepa key、Google/TikTok credentials 存 Secrets Manager 或等价环境密钥系统。
- 数据库只保存 `secret_ref`，不保存 secret value。
- Secret 按连接和环境分隔，启用轮换、版本和访问审计。
- 日志过滤 Authorization、cookie、query 中的 key、文档账户号和 token。
- 凭证只注入需要的 worker，前端和 LLM 不可读取。
- 连接删除先撤销/禁用授权，再按留存策略处理已采集数据。

### 5.1 Amazon 最小角色

只申请 Catalog/Listings 读取、Brand Analytics、Pricing、FBA Inventory、Reports、Finances 等实际需要的非受限能力。MVP 不申请 Orders buyer info、addresses 或其他 Restricted Data Token 工作流。若后续业务必须使用受限数据，需单独威胁建模和审批，不在当前范围。

## 6. 写操作隔离

MVP 采用三重控制：

1. 代码：没有注册 Ads/Listings/Pricing mutation endpoint 和 MCP tool。
2. 身份：部署身份没有 Amazon 写 scope/secret。
3. 网络/配置：`EXTERNAL_WRITES_ENABLED=false` 且生产策略拒绝相关 egress/operation allowlist。

`APPROVED_NOT_EXECUTED` 只表示用户认可草案，不代表 Amazon 已修改。人工在 Seller Central 操作后，只能记录 `MANUAL_RECORDED`，并由后续读取快照验证变化。

未来启用 API 写操作前必须另行完成：双确认、变更 preview、幂等 key、前置状态比对、速率/金额限制、冲突检测、可回滚性、执行后读取验证和 kill switch。

## 7. 数据保护

### 7.1 传输与静态加密

- 外部/内部连接使用 TLS；生产数据库要求 TLS。
- PostgreSQL、对象存储、备份使用 KMS 管理的服务端加密。
- 特别敏感字段可应用层 envelope encryption；密钥与数据分离。
- 预签名下载 URL 短时有效、绑定方法与对象，不在日志记录完整 URL。

### 7.2 数据分类

| 类别 | 示例 | 保护 |
|---|---|---|
| Public | 公开竞品价格、公开视频元数据 | 来源条款、完整性 |
| Internal | 指标、建议、阶段策略 | tenant 隔离、审计 |
| Confidential | 销售、广告、成本、利润 | 加密、最小权限、受控导出 |
| Restricted business document | 合同、转账/物流凭证 | 文件隔离、字段掩码、短时访问、留存策略 |
| Secret | API key、refresh token | Secrets Manager，仅工作负载访问 |

## 8. PII 最小化

- 不调用或存储买家姓名、地址、电话、邮箱。
- 订单只保存分析所需的聚合或哈希引用；不得用可逆方式构造买家身份。
- 评价主题只保存聚合证据，不保存 reviewer profile。
- 上传文件可能包含银行账户、联系人等信息：提取器仅允许白名单字段，UI 对账户号等默认掩码。
- quarantine 若发现疑似 PII，停止处理、限制访问并产生安全事件。

## 9. 上传文件安全

1. 前端申请单次预签名上传。
2. 服务端验证扩展名、MIME、magic bytes、大小和租户配额。
3. 上传到隔离 bucket/prefix，未扫描前不可下载或解析。
4. 病毒/恶意内容扫描通过后移到受控对象区域。
5. 文档解析在无外网、低权限容器中执行，限制 CPU/内存/页数/解压比。
6. OCR/LLM 只接收必要页和字段任务，不把整库文档发给模型。
7. 用户确认后才形成成本版本；确认事件可审计。

防御 zip bomb、宏、嵌入对象、路径穿越、PDF JavaScript 和 prompt injection 文本。文档里的“忽略系统规则”等文本只作为数据，不作为指令。

## 10. LLM 与 MCP 安全

- LLM 只能使用白名单结构化工具，不能访问任意 URL、任意 SQL、shell 或 secrets。
- 工具服务端执行 tenant、role、scope 和最大窗口校验。
- 外部网页、文档、Listing、评论和 MCP 返回都按不可信数据处理。
- 模型输出必须通过 JSON Schema，并验证引用的 metric/insight ID 属于当前 tenant。
- 保存 prompt template 版本、模型、工具调用、输入引用和输出；敏感内容先做脱敏。
- 模型不得决定审批，不得更改连接或权限。
- 对 MCP 返回设置大小、字段和 token 上限；禁止工具递归调用未授权工具。

## 11. 审计日志

审计事件只追加，最少包含：

`event_id`、`tenant_id`、`actor_type/id`、`action`、`target_type/id`、`occurred_at`、`request_id/trace_id`、`before_hash`、`after_hash`、`reason`、`source_ip/device summary`、`result`。

必须审计：登录、角色、连接、secret reference 变更、上传/下载、字段确认、阶段/阈值变更、建议反馈、草案编辑、审批、人工执行记录、导出、模型运行、数据重算和删除任务。

审计 payload 不复制完整密钥或文档内容。按日做 hash chain 或对象锁定可作为后续增强。

## 12. 应用安全基线

- Pydantic 严格 schema、参数化 SQL、输出编码、CSP、frame-ancestors、HSTS。
- 依赖锁定、自动漏洞扫描、SBOM、容器非 root、只读 filesystem（必要目录除外）。
- API rate limit、请求体大小限制、分页上限、查询超时。
- 错误响应不暴露 stack、SQL、secret ref 或内部路径。
- OpenAPI 生产环境按需受保护；debug 和 interactive docs 不公开。
- 测试环境使用合成凭证和数据，禁止复制生产数据库。

## 13. 备份与恢复

- PostgreSQL 开启 PITR，定期恢复演练。
- 对象存储版本化；关键文档与 raw manifest 一致性检查。
- 备份同样加密并受 tenant/环境访问控制。
- 定义 RPO/RTO 后再选择生产规格；MVP 建议目标为 RPO <= 24h、RTO <= 8h，作为待确认的业务目标而非已实现承诺。

## 14. 威胁与控制

| 威胁 | 主要控制 |
|---|---|
| 合成数据被误认真实 | 独立状态、强制字段、全局横幅、混合模式阻断 |
| LLM 幻觉经营数字 | 指标工具、引用校验、禁止核心计算、schema gate |
| Prompt injection | 不可信内容隔离、工具白名单、无 arbitrary fetch/SQL |
| 越租户读取 | RLS、显式 tenant 条件、对象前缀、授权测试 |
| 密钥泄漏 | Secrets Manager、日志脱敏、服务身份隔离、轮换 |
| 未授权 Amazon 修改 | 无写代码/路由/tool/scope，feature flag 和 egress allowlist |
| 恶意上传 | 隔离、扫描、sandbox parse、大小/解压限制 |
| 归因口径误用 | provenance、metric constraint、API 拒绝不兼容聚合 |
| 第三方条款违规 | source registry、用途/许可标签、官方 API 优先、留存治理 |

## 15. 上线安全门禁

- Secret scan、SAST、依赖扫描无未处置高危问题。
- RLS 跨租户测试全部通过。
- OpenAPI 和 MCP 工具清单确认无外部写能力。
- 合成/真实混合阻断测试通过。
- 日志脱敏测试覆盖 token、cookie、authorization、文档账户号。
- 上传恶意样本与超限样本被拒绝。
- 数据导出和对象下载经过授权与审计。
