"use client";

import { CircleHelp, Keyboard, Moon, Settings2, ShieldCheck, X } from "lucide-react";

export type WorkspacePreferences = {
  density: "comfortable" | "compact";
  displayTimezone: "America/Los_Angeles" | "Asia/Shanghai" | "BROWSER_LOCAL";
  evidenceExpanded: boolean;
  reducedMotion: boolean;
  theme: "dark" | "system";
};

type DrawerProps = {
  open: boolean;
  onClose: () => void;
};

type SettingsDrawerProps = DrawerProps & {
  preferences: WorkspacePreferences;
  onChange: (preferences: WorkspacePreferences) => void;
};

export function SettingsDrawer({ open, onClose, preferences, onChange }: SettingsDrawerProps) {
  if (!open) return null;

  function update<Key extends keyof WorkspacePreferences>(key: Key, value: WorkspacePreferences[Key]) {
    onChange({ ...preferences, [key]: value });
  }

  return (
    <DrawerFrame title="工作区设置" icon={<Settings2 size={18} />} onClose={onClose}>
      <div className="drawer-section">
        <label className="field-label" htmlFor="timezone-setting">时间显示</label>
        <select
          id="timezone-setting"
          value={preferences.displayTimezone}
          onChange={(event) => update("displayTimezone", event.target.value as WorkspacePreferences["displayTimezone"])}
        >
          <option value="America/Los_Angeles">美国业务时间 · Los Angeles</option>
          <option value="Asia/Shanghai">中国运营时间 · Shanghai</option>
          <option value="BROWSER_LOCAL">当前设备本地时间</option>
        </select>
        <p>业务日期始终使用 America/Los_Angeles；这里只改变显示。</p>
      </div>

      <fieldset className="drawer-section">
        <legend>信息密度</legend>
        <div className="segmented-control">
          {(["comfortable", "compact"] as const).map((density) => (
            <button
              type="button"
              key={density}
              className={preferences.density === density ? "segment-active" : ""}
              onClick={() => update("density", density)}
            >
              {density === "comfortable" ? "舒适" : "紧凑"}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="drawer-section">
        <legend>主题</legend>
        <div className="segmented-control">
          {(["dark", "system"] as const).map((theme) => (
            <button
              type="button"
              key={theme}
              className={preferences.theme === theme ? "segment-active" : ""}
              onClick={() => update("theme", theme)}
            >
              {theme === "dark" ? "深色" : "跟随系统"}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="toggle-row">
        <span><strong>减少动态</strong><small>关闭数字过渡与 Jarvis 阶段动画</small></span>
        <input
          type="checkbox"
          checked={preferences.reducedMotion}
          onChange={(event) => update("reducedMotion", event.target.checked)}
        />
      </label>
      <label className="toggle-row">
        <span><strong>默认展开证据</strong><small>动态组件直接显示来源与口径</small></span>
        <input
          type="checkbox"
          checked={preferences.evidenceExpanded}
          onChange={(event) => update("evidenceExpanded", event.target.checked)}
        />
      </label>
    </DrawerFrame>
  );
}

export function HelpDrawer({ open, onClose }: DrawerProps) {
  if (!open) return null;
  return (
    <DrawerFrame title="帮助与运行边界" icon={<CircleHelp size={18} />} onClose={onClose}>
      <div className="help-principle">
        <ShieldCheck size={18} />
        <div>
          <strong>当前系统只读</strong>
          <p>Jarvis 可以分析、追问并打开建议草案，但没有注册任何 Amazon 写工具。</p>
        </div>
      </div>
      <div className="help-list">
        <div><Keyboard size={16} /><span><strong>/</strong> 聚焦底部输入框</span></div>
        <div><Keyboard size={16} /><span><strong>Esc</strong> 关闭菜单或抽屉</span></div>
        <div><Moon size={16} /><span>“模拟数据”表示所有经营数值均为 synthetic，不代表真实店铺。</span></div>
      </div>
      <div className="drawer-section">
        <h3>如何检查结论</h3>
        <p>点击任意动态块的“检查证据”，右侧会显示数据期间、来源语义、归因窗口、更新时间、置信度、限制与原始引用。</p>
      </div>
    </DrawerFrame>
  );
}

function DrawerFrame({ title, icon, onClose, children }: { title: string; icon: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="drawer-layer" role="presentation">
      <button className="drawer-scrim" type="button" aria-label={`关闭${title}`} onClick={onClose} />
      <aside className="workspace-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <header className="drawer-head">
          <div>{icon}<h2 id="drawer-title">{title}</h2></div>
          <button className="icon-control" type="button" aria-label={`关闭${title}`} onClick={onClose}><X size={18} /></button>
        </header>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}
