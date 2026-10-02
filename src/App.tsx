import { useEffect } from "react";
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
import { ExamplesPage } from "./features/tutorial/ExamplesPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { NetworkPage } from "./features/network/NetworkPage";
import { TutorialPage } from "./features/tutorial/TutorialPage";
import { SpotlightTour } from "./features/tutorial/SpotlightTour";





export function App() {
  const { settings, storageReady, guidance, startGuidance, endGuidance } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  // First-run onboarding redirect.
  useEffect(() => {
    if (storageReady && !settings.onboarded && location.pathname !== "/onboarding") {
      navigate("/onboarding", { replace: true });
    }
  }, [storageReady, settings.onboarded, location.pathname, navigate]);

  if (!storageReady) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <p style={{ color: "var(--c-ink-faint)" }}>Loading local data…</p>
      </div>
    );
  }

  if (!settings.onboarded) {
    return (
      <Routes>
        <Route path="*" element={<OnboardingPage />} />
      </Routes>
    );
  }

  const navItems = settings.workspace === "professional" ? PROFESSIONAL_NAV_ITEMS : REPORTER_NAV_ITEMS;
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
      <a href="#main-content" className="sr-only">Skip to main content</a>
      <aside className="sidebar">
        <NavLink to="/" className="brand">
          <BrandMark size={30} />
          <span className="brand-name">
            Wildlife Incident
            <br />
            Handoff
          </span>
        </NavLink>
        <nav aria-label="Main navigation">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end ?? item.to === "/"} data-tour-id={item.tourId} className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
          <button className="nav-item" style={{ background: "none", border: "none", cursor: "pointer", font: "inherit", textAlign: "left", width: "100%" }} onClick={runTour}>
            <Icons.compass size={18} />
            Take the tour
          </button>
        </nav>
        <p className="nav-note">Local-first. Your data stays in this browser on this device.</p>
      </aside>

      <div className="main-area">
        <header className="mobile-header">
          <BrandMark size={26} />
          <strong style={{ fontSize: "0.95rem" }}>Wildlife Incident Handoff</strong>
        </header>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/incidents" element={<IncidentListPage />} />
          <Route path="/incidents/new" element={<CreateIncidentPage />} />
          <Route path="/incidents/:id" element={<IncidentDetailPage />} />
          <Route path="/examples" element={<ExamplesPage />} />
          <Route path="/tutorial" element={<TutorialPage />} />
          <Route path="/network" element={<NetworkPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </div>

      <nav className="bottom-nav" aria-label="Mobile navigation">
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")} data-tour-id="nav-home">
          <Icons.home size={20} />
          Home
        </NavLink>
        <NavLink to="/incidents" className={({ isActive }) => (isActive ? "active" : "")} data-tour-id="nav-incidents">
          <Icons.list size={20} />
          {settings.workspace === "professional" ? "Incidents" : "My reports"}
        </NavLink>
        <NavLink to="/incidents/new" data-tour-id="nav-create">
          <span style={{ display: "grid", placeItems: "center", width: 40, height: 40, borderRadius: "50%", background: "var(--c-primary)", color: "var(--c-primary-ink)", marginTop: -14 }}>
            <Icons.plus size={22} />
          </span>
          {settings.workspace === "professional" ? "Create" : "Report"}
        </NavLink>
        <NavLink to="/network" className={({ isActive }) => (isActive ? "active" : "")} style={{ display: settings.workspace === "professional" ? undefined : "none" }} data-tour-id="nav-network">
          <Icons.handoff size={20} />
          Network
        </NavLink>
        <NavLink to="/examples" className={({ isActive }) => (isActive ? "active" : "")}>
          <Icons.book size={20} />
          Help
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => (isActive ? "active" : "")} data-tour-id="nav-settings">
          <Icons.settings size={20} />
          Settings
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
