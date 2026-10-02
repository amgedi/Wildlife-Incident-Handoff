/** Workspace navigation definitions — shared by the app shell and tests. */
import { Icons } from "../components/Icons";

export interface NavItem {
  to: string;
  /** translation key in the navigation namespace */
  labelKey: string;
  icon: (p: { size?: number }) => JSX.Element;
  tourId: string;
  /** Exact matching: /incidents/new must NOT activate the /incidents item. */
  end?: boolean;
}

/** Reporter never sees professional destinations (hidden, not grayed out). */
export const REPORTER_NAV_ITEMS: NavItem[] = [
  { to: "/", labelKey: "home", icon: Icons.home, tourId: "nav-home" },
  { to: "/incidents/new", labelKey: "reportWildlife", icon: Icons.plus, tourId: "nav-create" },
  { to: "/incidents", labelKey: "myReports", icon: Icons.list, tourId: "nav-incidents", end: true },
  { to: "/examples", labelKey: "help", icon: Icons.book, tourId: "nav-examples" },
  { to: "/settings", labelKey: "settings", icon: Icons.settings, tourId: "nav-settings" },
];

export const PROFESSIONAL_NAV_ITEMS: NavItem[] = [
  { to: "/", labelKey: "home", icon: Icons.home, tourId: "nav-home" },
  { to: "/incidents", labelKey: "incidents", icon: Icons.list, tourId: "nav-incidents", end: true },
  { to: "/incidents/new", labelKey: "createIncident", icon: Icons.plus, tourId: "nav-create" },
  { to: "/network", labelKey: "responseNetwork", icon: Icons.handoff, tourId: "nav-network" },
  { to: "/examples", labelKey: "examples", icon: Icons.book, tourId: "nav-examples" },
  { to: "/settings", labelKey: "settings", icon: Icons.settings, tourId: "nav-settings" },
];
