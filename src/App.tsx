import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { REPORTER_NAV_ITEMS, PROFESSIONAL_NAV_ITEMS } from "./app/navigation";
import { useApp } from "./app/AppContext";
import { Icons } from "./components/Icons";
import { BrandMark } from "./components/BrandMark";
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
import { isTauri } from "./utils/platformFile";
import { HelpPage } from "./features/help/HelpPage";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { NotificationBell } from "./components/NotificationCenter";





export function App() {
  const { settings, storageReady, guidance, startGuidance, endGuidance } = useApp();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const previewingOnboarding = settings.onboardingPreviewActive === true;

  // First-run onboarding redirect.
  useEffect(() => {
    if (storageReady && (previewingOnboarding || !settings.onboarded) && location.pathname !== "/onboarding") {
      navigate("/onboarding", { replace: true });
    }
    if (storageReady && settings.onboarded && !previewingOnboarding && location.pathname === "/onboarding") {
      navigate("/", { replace: true });
    }
  }, [storageReady, settings.onboarded, previewingOnboarding, location.pathname, navigate]);

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

  const isDesktop = isTauri();
  const navItems = settings.workspace === "professional" ? PROFESSIONAL_NAV_ITEMS : REPORTER_NAV_ITEMS;
  const firstName = (settings.displayName || settings.savedReporterContact?.name || "").trim().split(/\s+/)[0];
  const runTour = () => {
    void import("./features/tutorial/guidance").then(async ({ buildInterfaceTourSteps }) => {
      const steps = await buildInterfaceTourSteps(settings.workspace);
      endGuidance(false);
      navigate("/");
      setTimeout(() => startGuidance("interface-tour", steps), 60);
    });
  };

  return (
    <div className="app-shell">
      <TitleBar />
      <div className="app-body">
        <a href="#main-content" className="sr-only">{t("skipToContent")}</a>
      <aside className="sidebar">
        <NavLink to="/" className="brand">
          <BrandMark size={30} />
          {isDesktop && (
            <span className="brand-name">
              {settings.workspace === "professional"
                ? settings.professionalProfile?.organization || t("home:professionalWorkspace", { defaultValue: "Professional workspace" })
                : firstName
                  ? t("home:welcomeShort", { name: firstName, defaultValue: "Welcome, {{name}}", interpolation: { escapeValue: false } })
                  : t("navigation:home")}
            </span>
          )}
          {!isDesktop && (
            <span className="brand-name">
              Wildlife Incident
              <br />
              Handoff
            </span>
          )}
        </NavLink>
        <nav aria-label="Main navigation">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end ?? item.to === "/"} data-tour-id={item.tourId} className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
              <item.icon size={18} />
              {t(item.labelKey, { ns: "navigation" })}
            </NavLink>
          ))}
          <button className="nav-item" style={{ background: "none", border: "none", cursor: "pointer", font: "inherit", textAlign: "left", width: "100%" }} onClick={runTour}>
            <Icons.compass size={18} />
            {t("navigation:takeTheTour")}
          </button>
        </nav>
        <p className="nav-note">{t("localFirstNote")}</p>
      </aside>

      <div className="main-area">
        <header className="mobile-header">
          <BrandMark size={26} />
          <strong style={{ fontSize: "0.95rem" }}>{t("appName")}</strong>
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
          <Route path="*" element={<ErrorBoundary><HomePage /></ErrorBoundary>} />
        </Routes>
      </div>
      </div>

      <nav className="bottom-nav" aria-label={t("navigation:mobileNav")}>
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")} data-tour-id="nav-home">
          <Icons.home size={20} />
          {t("navigation:home")}
        </NavLink>
        <NavLink to="/incidents" className={({ isActive }) => (isActive ? "active" : "")} data-tour-id="nav-incidents">
          <Icons.list size={20} />
          {settings.workspace === "professional" ? t("navigation:incidents") : t("navigation:myReports")}
        </NavLink>
        <NavLink to="/incidents/new" data-tour-id="nav-create">
          <span style={{ display: "grid", placeItems: "center", width: 40, height: 40, borderRadius: "50%", background: "var(--c-primary)", color: "var(--c-primary-ink)", marginTop: -14 }}>
            <Icons.plus size={22} />
          </span>
          {settings.workspace === "professional" ? t("navigation:createIncident") : t("navigation:report")}
        </NavLink>
        <NavLink to="/network" className={({ isActive }) => (isActive ? "active" : "")} style={{ display: settings.workspace === "professional" ? undefined : "none" }} data-tour-id="nav-network">
          <Icons.handoff size={20} />
          {t("navigation:network")}
        </NavLink>
        <NavLink to="/examples" className={({ isActive }) => (isActive ? "active" : "")}>
          <Icons.book size={20} />
          {t("navigation:learn")}
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => (isActive ? "active" : "")} data-tour-id="nav-settings">
          <Icons.settings size={20} />
          {t("navigation:settings")}
        </NavLink>
      </nav>

      {guidance && (
        <SpotlightTour
          key={guidance.systemId}
          steps={guidance.steps}
          onFinish={() => endGuidance(true)}
        />
      )}
    </div>
  );
}
