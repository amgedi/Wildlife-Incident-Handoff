import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { REPORTER_NAV_ITEMS, PROFESSIONAL_NAV_ITEMS, FOOTER_NAV_ITEMS } from "./app/navigation";
import { useApp } from "./app/AppContext";
import { Icons } from "./components/Icons";
import { BrandMark } from "./components/BrandMark";
import { CommandPaletteBinding } from "./components/CommandPalette";
import { ProfilePhoto } from "./components/ProfilePhoto";
import { Dialog } from "./components/Dialog";
import { buildInterfaceTourSteps } from "./features/tutorial/guidance";
import { TitleBar } from "./components/TitleBar";
import { HomePage } from "./features/home/HomePage";
import { OnboardingPage } from "./features/onboarding/OnboardingPage";
import { IncidentListPage } from "./features/incidents/IncidentListPage";
import { CreateIncidentPage } from "./features/incidents/CreateIncidentPage";
import { IncidentDetailPage } from "./features/incidents/IncidentDetailPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { NetworkPage } from "./features/network/NetworkPage";
import { TutorialPage } from "./features/tutorial/TutorialPage";
import { SpotlightTour } from "./features/tutorial/SpotlightTour";
import { HelpPage } from "./features/help/HelpPage";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { NotificationBell } from "./components/NotificationCenter";
import { registerNavigate } from "./app/routerNavigate";
import { isTauri } from "./utils/platformFile";
import { registerTourLauncher } from "./features/help/launchTour";

function roleLine(settings: ReturnType<typeof useApp>["settings"], t: (k: string, o?: unknown) => string): string {
  if (settings.workspace !== "professional") {
    return t("navigation:roleReporter", { defaultValue: "Reporter" });
  }
  const active = settings.professionalRoles?.find((r) => r.role === settings.activeProfessionalRole)
    ?? settings.professionalRoles?.[0];
  const label = active
    ? t(`navigation:role_${active.role}`, { defaultValue: active.role.replaceAll("_", " ") })
    : t("navigation:roleResponder", { defaultValue: "Wildlife responder" });
  return label;
}

export function App() {
  const { settings, updateSettings, storageReady, guidance, startGuidance, endGuidance } = useApp();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tourPromptOpen, setTourPromptOpen] = useState(false);
  const previewingOnboarding = settings.onboardingPreviewActive === true;
  // Non-React modules (Help tutorials) navigate/launch via these bridges.
  useEffect(() => {
    registerNavigate(navigate);
    registerTourLauncher(startGuidance);
  }, [navigate, startGuidance]);

  // First-run onboarding redirect.
  useEffect(() => {
    if (storageReady && (previewingOnboarding || !settings.onboarded) && location.pathname !== "/onboarding") {
      navigate("/onboarding", { replace: true });
    }
    if (storageReady && settings.onboarded && !previewingOnboarding && location.pathname === "/onboarding") {
      navigate("/", { replace: true });
    }
  }, [storageReady, settings.onboarded, previewingOnboarding, location.pathname, navigate]);

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname, location.search]);

  // Newcomer tutorial prompt: first arrival on Home, tour not completed,
  // not previously dismissed (dev.14 — a new user should never have to find
  // the tutorial in Settings).
  useEffect(() => {
    if (
      storageReady &&
      settings.onboarded &&
      !previewingOnboarding &&
      !settings.tourCompleted &&
      !settings.tourPromptDismissed &&
      location.pathname === "/" &&
      !guidance
    ) {
      const id = window.setTimeout(() => setTourPromptOpen(true), 900);
      return () => window.clearTimeout(id);
    }
  }, [storageReady, settings.onboarded, previewingOnboarding, settings.tourCompleted, settings.tourPromptDismissed, location.pathname, guidance]);

  useEffect(() => {
    document.body.classList.toggle("drawer-open", drawerOpen);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("drawer-open");
      document.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen]);

  if (!storageReady) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <p style={{ color: "var(--c-ink-faint)" }}>Loading local data…</p>
      </div>
    );
  }

  if (!settings.onboarded || previewingOnboarding) {
    return (
      <Routes>
        <Route path="*" element={<OnboardingPage preview={previewingOnboarding} />} />
      </Routes>
    );
  }

  const isPro = settings.workspace === "professional";
  const navItems = isPro ? PROFESSIONAL_NAV_ITEMS : REPORTER_NAV_ITEMS;
  const firstName = (settings.displayName || settings.professionalProfile?.name || settings.savedReporterContact?.name || "").trim().split(/\s+/)[0];
  const identityLine = isPro
    ? (settings.professionalProfile?.organization || firstName || t("home:professionalWorkspace", { defaultValue: "Professional workspace" }))
    : (firstName || t("home:welcome", { defaultValue: "Welcome" }));
  const subLine = roleLine(settings, t as never);

  // Map is only "active" on /network?view=map; Response network on /network without it.
  const navIsActive = (item: (typeof navItems)[number], isActive: boolean): boolean => {
    if (item.to === "/network?view=map") return location.pathname === "/network" && new URLSearchParams(location.search).get("view") === "map";
    if (item.to === "/network") return location.pathname === "/network" && new URLSearchParams(location.search).get("view") !== "map";
    return isActive;
  };

  const navList = (
    <>
      {navItems.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end ?? item.to === "/"} data-tour-id={item.tourId} className={({ isActive }) => `nav-item${navIsActive(item, isActive) ? " active" : ""}`}>
          <item.icon size={18} />
          {t(item.labelKey, { ns: "navigation" })}
        </NavLink>
      ))}
    </>
  );

  const footerList = (
    <>
      {FOOTER_NAV_ITEMS.map((item) => (
        <NavLink key={item.to} to={item.to} data-tour-id={item.tourId} className={({ isActive }) => `nav-item nav-item-footer${isActive ? " active" : ""}`}>
          <item.icon size={17} />
          {t(item.labelKey, { ns: "navigation" })}
        </NavLink>
      ))}
    </>
  );

  return (
    <div className="app-shell">
      <TitleBar />
      <div className="app-body">
        <a href="#main-content" className="sr-only">{t("skipToContent")}</a>

        {drawerOpen && <button className="drawer-scrim" aria-label={t("navigation:closeMenu", { defaultValue: "Close menu" })} onClick={() => setDrawerOpen(false)} />}

        <aside className={`sidebar${drawerOpen ? " drawer-open" : ""}`} aria-label={t("navigation:mainNav")}>
          {/* Compact identity header — the desktop titlebar already carries the product name. */}
          <NavLink to="/" className="brand">
            <ProfilePhoto src={settings.profilePhoto} size={34} name={settings.professionalProfile?.name || settings.displayName} title={identityLine} />
            <span className="brand-name">
              <strong>{identityLine}</strong>
              <span className="brand-sub">{subLine}</span>
              {isPro && (
                <span className="badge" data-status="response_requested">{t("home:professionalPreview", { defaultValue: "Professional Preview" })}</span>
              )}
            </span>
          </NavLink>
          <nav aria-label={t("navigation:mainNav")} className="nav-work">
            {navList}
          </nav>
          <nav aria-label={t("navigation:footerNav", { defaultValue: "Help and settings" })} className="nav-footer">
            {footerList}
          </nav>
        </aside>

      <div className="main-area">
        <CommandPaletteBinding />
        {/* Web/PWA desktop has no titlebar — fixed top-right bell instead. */}
        {!isTauri() && (
          <div className="web-bell" style={{ position: "fixed", top: 12, right: 16, zIndex: 120 }}>
            <NotificationBell />
          </div>
        )}
        <header className="mobile-header">
          <button className="hamburger" aria-label={t("navigation:openMenu", { defaultValue: "Open menu" })} aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}>
            <span /><span /><span />
          </button>
          <BrandMark size={24} />
          <strong style={{ fontSize: "0.95rem" }}>{identityLine}</strong>
          <span style={{ marginLeft: "auto" }}><NotificationBell /></span>
        </header>
        <Routes>
          <Route path="/" element={<ErrorBoundary><HomePage /></ErrorBoundary>} />
          <Route path="/incidents" element={<ErrorBoundary><IncidentListPage /></ErrorBoundary>} />
          <Route path="/incidents/new" element={<ErrorBoundary><CreateIncidentPage /></ErrorBoundary>} />
          <Route path="/incidents/:id" element={<ErrorBoundary><IncidentDetailPage /></ErrorBoundary>} />
          <Route path="/examples" element={<ErrorBoundary><HelpPage /></ErrorBoundary>} />
          <Route path="/help" element={<ErrorBoundary><HelpPage /></ErrorBoundary>} />
          <Route path="/tutorial" element={<ErrorBoundary><TutorialPage /></ErrorBoundary>} />
          <Route path="/network" element={<ErrorBoundary><NetworkPage /></ErrorBoundary>} />
          <Route path="/settings" element={<ErrorBoundary><SettingsPage /></ErrorBoundary>} />
          <Route path="/profile" element={<ErrorBoundary><SettingsPage standaloneSection="profile" /></ErrorBoundary>} />
          <Route path="*" element={<ErrorBoundary><HomePage /></ErrorBoundary>} />
        </Routes>
      </div>
      </div>

      <nav className="bottom-nav" aria-label={t("navigation:mobileNav")}>
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")} data-tour-id="nav-home">
          <Icons.home size={20} />
          {isPro ? t("navigation:dashboard") : t("navigation:home")}
        </NavLink>
        {isPro && (
          <NavLink to="/network" className={({ isActive }) => (isActive ? "active" : "")} data-tour-id="nav-network">
            <Icons.handoff size={20} />
            {t("navigation:network")}
          </NavLink>
        )}
        <NavLink to="/incidents" className={({ isActive }) => (isActive ? "active" : "")} data-tour-id="nav-incidents">
          <Icons.list size={20} />
          {isPro ? t("navigation:incidents") : t("navigation:myReports")}
        </NavLink>
        <NavLink to="/incidents/new" data-tour-id="nav-create">
          <span style={{ display: "grid", placeItems: "center", width: 40, height: 40, borderRadius: "50%", background: "var(--c-primary)", color: "var(--c-primary-ink)", marginTop: -14 }}>
            <Icons.plus size={22} />
          </span>
          {isPro ? t("navigation:createIncident") : t("navigation:report")}
        </NavLink>
        <NavLink to="/help" className={({ isActive }) => (isActive ? "active" : "")} data-tour-id="nav-help">
          <Icons.book size={20} />
          {t("navigation:help")}
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => (isActive ? "active" : "")} data-tour-id="nav-settings">
          <Icons.settings size={20} />
          {t("navigation:settings")}
        </NavLink>
      </nav>

      {/* Newcomer tour prompt (dev.14) */}
      <Dialog
        open={tourPromptOpen}
        title={t("onboarding:tourPromptTitle", { defaultValue: "New here?" })}
        onClose={() => {
          setTourPromptOpen(false);
          void updateSettings({ tourPromptDismissed: true });
        }}
        actions={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setTourPromptOpen(false);
                void updateSettings({ tourPromptDismissed: true });
              }}
            >
              {t("onboarding:tourPromptLater", { defaultValue: "Maybe later" })}
            </button>
            <button
              className="btn btn-primary"
              onClick={async () => {
                setTourPromptOpen(false);
                void updateSettings({ tourPromptDismissed: true });
                const steps = await buildInterfaceTourSteps(settings.workspace);
                startGuidance("interface-tour", steps);
              }}
            >
              {t("onboarding:tourPromptStart", { defaultValue: "Take the tour" })}
            </button>
          </>
        }
      >
        <p>
          {t("onboarding:tourPromptBody", {
            defaultValue: "Would you like a quick guided tour of the interface? It takes about two minutes and you can leave any time.",
          })}
        </p>
      </Dialog>

      {guidance && (
        <SpotlightTour
          key={guidance.systemId}
          steps={guidance.steps}
          onFinish={(result) => endGuidance(result)}
        />
      )}
    </div>
  );
}
