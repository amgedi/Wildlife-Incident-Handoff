/** Left navigation rail with animated accent indicator. */
import { useLauncher, VIEW_META, type ViewId } from "../app/store";
import { IconAbout, IconDeveloper, IconDiagnostics, IconHome, IconSettings, IconUpdates } from "./icons";

const MAIN: ViewId[] = ["home", "updates", "diagnostics", "settings", "about"];

export function NavRail({ launcherVersion }: { launcherVersion: string }) {
  const { view, setView, prefs } = useLauncher();
  const devVisible = prefs?.devToolsVisible ?? true;

  const item = (id: ViewId, icon: React.ReactNode) => (
    <button
      key={id}
      className={`nav-item${view === id ? " selected" : ""}`}
      aria-current={view === id ? "page" : undefined}
      onClick={() => setView(id)}
    >
      <span className="nav-accent" aria-hidden="true" />
      {icon}
      <span className="nav-text">{VIEW_META[id].label}</span>
    </button>
  );

  return (
    <nav className="rail" aria-label="Launcher sections">
      {MAIN.map((id) =>
        item(
          id,
          id === "home" ? <IconHome /> : id === "updates" ? <IconUpdates /> : id === "diagnostics" ? <IconDiagnostics /> : id === "settings" ? <IconSettings /> : <IconAbout />,
        ),
      )}
      {devVisible && <span className="rail-label">Workspace</span>}
      {devVisible && item("developer", <IconDeveloper />)}
      <div className="rail-foot">Launcher {launcherVersion}</div>
    </nav>
  );
}
