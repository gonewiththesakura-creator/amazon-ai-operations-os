"use client";

import {
  CircleHelp,
  Home,
  MessageCircle,
  Settings2,
  Store,
  X,
} from "lucide-react";

type WorkspaceNavigationProps = {
  mobileOpen: boolean;
  userQuestions: string[];
  onClose: () => void;
  onOpenConversation: () => void;
  onHome: () => void;
  onOpenHelp: () => void;
  onOpenSettings: () => void;
};

export function WorkspaceNavigation({
  mobileOpen,
  userQuestions,
  onClose,
  onOpenConversation,
  onHome,
  onOpenHelp,
  onOpenSettings,
}: WorkspaceNavigationProps) {
  return (
    <aside className={`workspace-nav ${mobileOpen ? "workspace-nav-open" : ""}`} aria-label="主导航">
      <div className="nav-workspace-head">
        <div>
          <span className="meta-label">店铺</span>
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
          <small>店铺整体 · 模拟数据</small>
        </span>
      </div>

      <nav className="primary-nav" aria-label="产品区域">
        <button className="nav-destination nav-destination-active" type="button" onClick={onHome}>
          <Home size={17} />
          <span>今日运营</span>
        </button>
      </nav>

      <section className="session-memory" aria-labelledby="session-memory-title">
        <div className="session-memory-head">
          <button type="button" id="session-memory-title" onClick={onOpenConversation}><MessageCircle size={15} /> 会话</button>
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
          <Settings2 size={17} /><span>设置</span>
        </button>
        <button className="nav-utility" type="button" onClick={onOpenHelp}>
          <CircleHelp size={17} /><span>帮助</span>
        </button>
      </div>
    </aside>
  );
}
