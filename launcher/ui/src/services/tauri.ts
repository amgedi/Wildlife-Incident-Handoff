/** Typed wrappers around the launcher's Rust commands. */

export interface DesktopInfo {
  version: string;
  commit: string;
  frontendBuildId: string;
  webBuildId: string;
  exe: string | null;
  exeExists: boolean;
  manifestOk: boolean;
}

export interface PreviousBuild { version: string; exe: string }

export type Freshness =
  | "current" | "source-changed" | "source-dirty" | "version-mismatch"
  | "desktop-missing" | "not-git";

export interface Identity {
  root: string;
  version: string;
  commit: string;
  gitDirty: boolean;
  dirtyBuildInputs: string[];
  desktop: DesktopInfo | null;
  previous: PreviousBuild | null;
  freshness: Freshness;
  freshnessDetail: string;
}

export interface BuildStatus {
  running: boolean;
  stage: string;
  stageIndex: number;
  stages: string[];
  lines: string[];
  done: boolean | null;
}

export type UpdateStatus =
  | "no-remote" | "offline" | "remote-error" | "auth"
  | "up-to-date" | "available" | "dirty-tree" | "error";

export interface GitUpdateInfo {
  status: UpdateStatus;
  behind: number;
  ahead: number;
  localCommit: string;
  remoteCommit: string;
  detail: string;
}

export interface Diagnostics {
  launcherVersion: string;
  sourceVersion: string;
  sourceCommit: string;
  gitDirty: boolean;
  dirtyFiles: string[];
  desktopVersion: string;
  desktopCommit: string;
  desktopPath: string;
  webBuildId: string;
  releaseCurrentPath: string;
  gitRemote: string;
  lastBuildResult: string;
}

export interface ReleaseCheck {
  status: "up-to-date" | "available" | "offline" | "unavailable" | "error";
  channel: "tester" | "stable";
  currentVersion: string;
  latestVersion: string | null;
  notesUrl: string | null;
  detail: string;
}

export interface Prefs {
  theme: string;
  motion: string;
  material: string;
  channel: "tester" | "stable";
  autoCheckUpdates: boolean;
  devToolsVisible: boolean;
}

const tauri = (window as unknown as { __TAURI__?: { core: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> } } }).__TAURI__;
const rawInvoke = tauri?.core.invoke ?? (async () => { throw new Error("Tauri bridge unavailable"); });

export const invoke = <T,>(cmd: string, args?: Record<string, unknown>): Promise<T> =>
  rawInvoke(cmd, args) as Promise<T>;

export const api = {
  identity: () => invoke<Identity>("get_identity"),
  launch: () => invoke<string>("launch_app"),
  launchPrevious: () => invoke<string>("launch_previous"),
  webPreview: () => invoke<string>("launch_web"),
  build: () => invoke<void>("build_app"),
  buildStatus: () => invoke<BuildStatus>("get_build_status"),
  gitUpdateCheck: () => invoke<GitUpdateInfo>("check_updates"),
  releaseCheck: (channel: "tester" | "stable") => invoke<ReleaseCheck>("check_release_update", { channel }),
  prefs: () => invoke<Prefs>("get_prefs"),
  setPrefs: (prefs: Prefs) => invoke<void>("set_prefs", { prefs }),
  diagnostics: () => invoke<Diagnostics>("get_diagnostics"),
  openReleaseFolder: () => invoke<void>("open_release_folder"),
  openLogsFolder: () => invoke<void>("open_logs_folder"),
};

export const isTauri = Boolean(tauri);
