"use client";

import {
  Activity,
  BarChart3,
  CircleHelp,
  FileClock,
  FlaskConical,
  Home,
  PackageSearch,
  Search,
  Settings2,
  Store,
  X,
} from "lucide-react";

const futureDestinations = [
  { label: "ASIN 经营", icon: BarChart3 },
  { label: "广告与搜索词", icon: Activity },
  { label: "关键词与排名", icon: Search },
  { label: "选品机会", icon: PackageSearch },
  { label: "实验与执行", icon: FlaskConical },
  { label: "审计日志", icon: FileClock },
];

type WorkspaceNavigationProps = {
  mobileOpen: boolean;
  userQuestions: string[];
  onClose: () => void;
  onHome: () => void;
  onOpenHelp: () => void;
  onOpenSettings: () => void;
};

export function WorkspaceNavigation({
  mobileOpen,
  userQuestions,
  onClose,
  onHome,
  onOpenHelp,
  onOpenSettings,
}: WorkspaceNavigationProps) {
  return (
    <aside className={`workspace-nav ${mobileOpen ? "workspace-nav-open" : ""}`} aria-label="主导航">
      <div className="nav-workspace-head">
        <div>
          <span className="meta-label">WORKSPACE</span>
          <strong>Atlas Home Goods</strong>
        </div>
        <button className="icon-control nav-close" type="button" aria-label="关闭导航" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <div className="store-context" data-testid="store-context">
        <span className="store-context-icon"><Store size={15} /></span>
        <span>
          <strong>Amazon 美国站</strong>
          <small>Store level · Synthetic</small>
        </span>
      </div>

      <nav className="primary-nav" aria-label="产品区域">
        <span className="nav-group-label">当前可用</span>
        <button className="nav-destination nav-destination-active" type="button" onClick={onHome}>
          <Home size={17} />
          <span>今日运营</span>
          <span className="release-tag release-current">M1.5</span>
        </button>

        <span className="nav-group-label nav-group-later">后续工作台</span>
        {futureDestinations.map(({ label, icon: Icon }) => (
          <button
            className="nav-destination nav-destination-disabled"
            type="button"
            key={label}
            disabled
            title={`${label} 将在 M2 开放`}
            aria-label={`${label}，M2 开放`}
          >
            <Icon size={17} />
            <span>{label}</span>
            <span className="release-tag">M2</span>
          </button>
        ))}
      </nav>

      <section className="session-memory" aria-labelledby="session-memory-title">
        <div className="session-memory-head">
          <span id="session-memory-title">本次会话</span>
          <span>{userQuestions.length}</span>
        </div>
        {userQuestions.length === 0 ? (
          <p>Jarvis 会在这里保留当前经营追问。</p>
        ) : (
          <ol>
            {userQuestions.slice(-3).reverse().map((question, index) => (
              <li key={`${question}-${index}`}>{question}</li>
            ))}
          </ol>
        )}
      </section>

      <div className="nav-utilities">
        <button className="nav-utility" type="button" onClick={onOpenSettings}>
          <Settings2 size={17} /><span>工作区设置</span>
        </button>
        <button className="nav-utility" type="button" onClick={onOpenHelp}>
          <CircleHelp size={17} /><span>帮助与边界</span>
        </button>
      </div>
    </aside>
  );
}
