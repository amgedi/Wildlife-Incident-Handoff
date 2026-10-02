import { useEffect, useState } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "./app/AppContext";
import { Icons } from "./components/Icons";
import { BrandMark } from "./components/BrandMark";
import { HomePage } from "./features/home/HomePage";
import { OnboardingPage } from "./features/onboarding/OnboardingPage";
import { IncidentListPage } from "./features/incidents/IncidentListPage";
import { CreateIncidentPage } from "./features/incidents/CreateIncidentPage";
import { IncidentDetailPage } from "./features/incidents/IncidentDetailPage";
import { ExamplesPage } from "./features/tutorial/ExamplesPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { TutorialPage } from "./features/tutorial/TutorialPage";
import { SpotlightTour } from "./features/tutorial/SpotlightTour";
import type { TourStep } from "./features/tutorial/SpotlightTour";

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: Icons.home, tourId: "nav-home" },
  { to: "/incidents", label: "Incidents", icon: Icons.list, tourId: "nav-incidents" },
  { to: "/examples", label: "Examples & tutorial", icon: Icons.book, tourId: "nav-examples" },
  { to: "/settings", label: "Settings", icon: Icons.settings, tourId: "nav-settings" },
];

const TOUR_STEPS: TourStep[] = [
  { tourId: "nav-home", title: "Home", text: "Your starting point: resume open incidents and see what needs attention." },
  { tourId: "nav-create", title: "Create incident", text: "A guided wizard walks you through recording what you observed, step by step. Unknown is always a valid answer." },
  { tourId: "nav-incidents", title: "Incidents", text: "Search and filter all incidents. Closed and archived cases stay searchable here." },
  { tourId: "nav-timeline", title: "Timeline", text: "Inside an incident, the Timeline keeps every update in chronological order. Nothing is ever overwritten." },
  { tourId: "nav-handoff", title: "Handoff", text: "Record who took responsibility, when, and what was transferred — so the next person has full context." },
  { tourId: "nav-export", title: "Export", text: "Generate a print-ready handoff summary, or a privacy-safe shareable version with location and contacts removed." },
  { tourId: "nav-settings", title: "Settings", text: "Themes, motion, accessibility, privacy and backups all live here. Your data stays on this device." },
];

export function App() {
  const { settings, updateSettings, storageReady } = useApp();
  const [tourOpen, setTourOpen] = useState(false);
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

  const runTour = () => {
    navigate("/");
    setTourOpen(true);
  };

  return (
    <div className="app-shell">
      <a href="#main-content" className="sr-only">Skip to main content</a>
      <aside className="sidebar">
        <NavLink to="/" className="brand" data-tour-id="nav-home">
          <BrandMark size={30} />
          <span className="brand-name">
            Wildlife Incident
            <br />
            Handoff
          </span>
        </NavLink>
        <nav aria-label="Main navigation">
          {NAV_ITEMS.slice(0, 2).map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === "/"} className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
          <NavLink to="/incidents/new" data-tour-id="nav-create" className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
            <Icons.plus size={18} />
            Create incident
          </NavLink>
          {NAV_ITEMS.slice(2).map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
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
          <Route path="/" element={<HomePage onStartTour={runTour} />} />
          <Route path="/incidents" element={<IncidentListPage />} />
          <Route path="/incidents/new" element={<CreateIncidentPage />} />
          <Route path="/incidents/:id" element={<IncidentDetailPage />} />
          <Route path="/examples" element={<ExamplesPage />} />
          <Route path="/tutorial" element={<TutorialPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<HomePage onStartTour={runTour} />} />
        </Routes>
      </div>

      <nav className="bottom-nav" aria-label="Mobile navigation">
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")} data-tour-id="nav-home">
          <Icons.home size={20} />
          Home
        </NavLink>
        <NavLink to="/incidents" className={({ isActive }) => (isActive ? "active" : "")} data-tour-id="nav-incidents">
          <Icons.list size={20} />
          Incidents
        </NavLink>
        <NavLink to="/incidents/new" data-tour-id="nav-create">
          <span style={{ display: "grid", placeItems: "center", width: 40, height: 40, borderRadius: "50%", background: "var(--c-primary)", color: "#fff", marginTop: -14 }}>
            <Icons.plus size={22} />
          </span>
          Create
        </NavLink>
        <NavLink to="/examples" className={({ isActive }) => (isActive ? "active" : "")}>
          <Icons.book size={20} />
          Learn
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => (isActive ? "active" : "")} data-tour-id="nav-settings">
          <Icons.settings size={20} />
          Settings
        </NavLink>
      </nav>

      {tourOpen && <SpotlightTour steps={TOUR_STEPS} onFinish={() => { setTourOpen(false); updateSettings({ tourCompleted: true }); }} />}
    </div>
  );
}
