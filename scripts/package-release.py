"""
0.3.0-dev.2 release packaging (spec 10, 14, 15, 63, 64).

Assembles release/desktop for the current version:
  - Portable EXE: copy of the built release exe, renamed to the dev.19
    convention (Wildlife-Incident-Handoff-Portable-<ver>.exe). Data lives in
    the same per-user directory as the installed version; a second copy
    focuses the existing window (single-instance mutex).
  - Installer: copied from the Tauri NSIS bundle.
  - checksums.sha256 for every distributable.
  - INSTALL.txt tester readme + release-manifest.json.

Usage: npm run build && npx tauri build && python scripts/package-release.py
"""
import hashlib
import json
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VERSION = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]
RELEASE = ROOT / "release" / "desktop"
NSIS = ROOT / "src-tauri" / "target" / "release" / "bundle" / "nsis" / f"Wildlife Incident Handoff_{VERSION}_x64-setup.exe"
PORTABLE_SRC = ROOT / "src-tauri" / "target" / "release" / "wildlife-incident-handoff.exe"

RELEASE.mkdir(parents=True, exist_ok=True)

installer_out = RELEASE / f"Wildlife-Incident-Handoff-Setup-{VERSION}.exe"
portable_out = RELEASE / f"Wildlife-Incident-Handoff-Portable-{VERSION}.exe"
shutil.copy2(NSIS, installer_out)
shutil.copy2(PORTABLE_SRC, portable_out)


def sha256(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


artifacts = {
    installer_out.name: sha256(installer_out),
    portable_out.name: sha256(portable_out),
}
checksums = RELEASE / "checksums.sha256"
checksums.write_text(
    "\n".join(f"{v}  {k}" for k, v in artifacts.items()) + "\n", encoding="utf-8"
)

commit = subprocess.run(
    ["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True
).stdout.strip()

manifest = {
    "version": VERSION,
    "buildDate": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    "gitCommit": commit,
    "architecture": "x64",
    "artifacts": {k: {"sha256": v} for k, v in artifacts.items()},
}
(RELEASE / "release-manifest.json").write_text(
    json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
)

readme = f"""Wildlife Incident Handoff — Windows desktop {VERSION}
=======================================================

DEVELOPMENT BUILD — {VERSION}
Use fictional/demo information where possible. This is not production
connected infrastructure: everything stays on this device, the network
features are local/LAN only and labeled as preview.

INSTALLER (recommended)
  {installer_out.name}
  1. Double-click the installer.
  2. Follow the prompts (installs for the current user).
  3. Launch "Wildlife Incident Handoff" from the Start Menu.
  - Adds an entry to Add/Remove Programs ("Wildlife Incident Handoff", version {VERSION}).
  - Uninstalling does NOT delete your incident data (stored in
    %LOCALAPPDATA%\\org.wildlifeincidenthandoff.app) unless you explicitly opt in
    to data removal during uninstall.

PORTABLE (no install)
  {portable_out.name}
  Run directly. Data is stored per user (the SAME location as the installed
  version — this is intentional and documented; there is no separate portable
  profile unless you set the WIH_PROFILE environment variable to a name, which
  creates and uses a separate data folder). Launching a second copy focuses
  the existing window.

VERIFY CHECKSUMS (PowerShell)
  Get-FileHash .\\<file> -Algorithm SHA256
  and compare against checksums.sha256 / release-manifest.json.

Suggested things to try
-----------------------
PROFESSIONAL OPERATIONS
  - Find what needs attention (Needs Attention band on the dashboard).
  - Select the Pickup stage in Response flow; inspect the case drawer.
  - Review an old unassigned incident (Waiting more than 2 hours tile).
  - Open a handoff from Incidents.
PROFESSIONAL DATA
  - Filter Incidents; switch List/Table; sort by Age.
  - Click a row for the side inspector.
REPORT INTEGRITY
  - Turn on Test view (dashboard) and review the fictional repeated-report
    signals; dismiss them on one report.
PROFILE / DEVICES
  - Set your profile name (the dashboard greets you by it).
  - Settings → Devices: rename this device, read the identity fingerprint.
THEMES
  - Settings → Appearance: try Forest Night / Midnight Ops / Monochrome Dark,
    and the Solid / Frosted / Glass window materials.

Feedback that helps most
------------------------
  - What was confusing?  - What felt slow?  - What looked unfinished?
  - What did you expect when clicking something?
  - Did you trust the information shown?
  - Could you find what needed attention?
"""
(RELEASE / "INSTALL.txt").write_text(readme, encoding="utf-8")

print(f"packaged {VERSION}")
print(json.dumps(manifest, indent=2))
