# Amazon AI Operations OS

> 当前状态：`M0_LOCAL_VALIDATED`。已提供并验证可运行 Web/API 壳、PostgreSQL 迁移、合成数据生成器与契约测试；当前机器未安装 Docker/psql，容器启动与真实 PostgreSQL 迁移仍待具备运行时后复验。尚未接入任何真实 Amazon 或第三方 API。

第一版面向美国站、20 个以内自有 ASIN，并包含跨类目选品市场数据。目标是形成可追溯的运营闭环：

`数据采集 -> 数据校验 -> 指标计算 -> 异常发现 -> 原因归因 -> 生成建议 -> 用户审批 -> 效果复盘`

第一版只生成建议与审批草案，不会自动修改广告、Listing 或价格。所有演示数据均须标记 `synthetic=true`，界面不得将模拟适配器显示为真实连接。

MVP 只生成建议与审批草案，批准后停留在 `APPROVED_NOT_EXECUTED`。Tool Registry 不包含 Amazon 外部写能力。所有演示数据都必须为 `synthetic=true`，界面固定显示模拟状态。

## M0 工程结构

| 路径 | 内容 |
|---|---|
| `apps/web` | Next.js 16、React 19、TypeScript 动态首页运行壳 |
| `apps/api` | FastAPI、Pydantic Schema、SyntheticAdapter、三类 Registry |
| `infra/postgres/migrations` | PostgreSQL 16、RBAC/RLS、选品/采购/AI 工作流迁移 |
| `infra/tests` | 迁移、RLS、写保护、OCR 门槛和数据规模契约测试 |
| `scripts/seed_synthetic.py` | 可复现的 41,060 条合成数据生成器 |
| `docker-compose.yml` | Web、API、PostgreSQL 与 MinIO 本地编排 |

## 本地启动

### Docker Compose

前置条件：Docker Desktop 可用。

```powershell
Copy-Item .env.example .env
docker compose up --build
```

启动后：

- Web：`http://localhost:3000`
- API：`http://localhost:8000`
- OpenAPI：`http://localhost:8000/docs`
- MinIO Console：`http://localhost:9001`

迁移在全新 PostgreSQL volume 初始化时按编号自动执行。已有 volume 如需升级，应使用正式迁移任务，不要删除生产数据卷。

### 无 Docker 本地运行

```powershell
python -m pip install -e "apps/api[dev]"
npm install --prefix apps/web
```

两个终端分别运行：

```powershell
npm run dev:api
npm run dev:web
```

### 测试与合成数据

```powershell
npm run test:all
npm run build
npm run seed:synthetic
```

合成数据固定使用美国站 `America/Los_Angeles` 业务日期，时间戳保存 UTC，并保留来源原始时区。默认 seed checksum 为 `eff0a89cd960fdca0977e289d0cd1afbe6ae8208c994f6274e32b280488af355`。

## 设计与契约

1. [PRD](docs/01-prd.md)
2. [系统架构](docs/02-system-architecture.md)
3. [数据源清单](docs/03-data-sources.md)
4. [数据字典](docs/04-data-dictionary.md)
5. [指标口径表](docs/05-metric-definitions.md)
6. [数据库 ER 模型](docs/06-er-model.md)
7. [API 与 MCP 适配器设计](docs/07-adapters-and-apis.md)
8. [权限与安全方案](docs/08-security-and-rbac.md)
9. [MVP 验收标准](docs/09-mvp-acceptance.md)
10. [模拟数据规范](docs/10-synthetic-data.md)
11. [AI 编排与动态首页](docs/11-ai-orchestration.md)

## 已确认决策

| 决策 | 已确认值 |
|---|---|
| 产品形态 | 工作流型运营系统，不是静态 Dashboard |
| MVP 架构 | Next.js + FastAPI 模块化单体 + PostgreSQL + S3 兼容对象存储 + Prefect |
| 时间基准 | 业务日以 `America/Los_Angeles` 为默认展示日，UTC 持久化，来源时区原样留存 |
| 数据分层 | 原始层只追加；标准层和指标层可重算；全链路保存来源与口径 |
| 归因 | 不跨归因窗口直接相加；广告、零售、第三方估算分别展示 |
| AI 权限 | 只读分析工具 + 创建审批草案；MVP 无写 Amazon 工具 |
| API 状态 | 缺少密钥时使用明确标记的模拟适配器，不阻塞产品开发 |
| 广告报表 | 适配 Amazon Ads 统一报表迁移，旧/新口径不混算 |
| 广告范围 | M0/MVP 优先 Sponsored Products |
| 阶段机制 | 每日生成 recommended stage；effective stage 仅由用户确认、修改或锁定 |
| 首页目标 | 随 LAUNCH/SCALE/HARVEST/RECOVERY 动态排序，不设全阶段唯一利润目标 |
