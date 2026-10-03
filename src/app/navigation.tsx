/** Workspace navigation definitions — shared by the app shell and tests.
 *  0.2.0-dev.8: primary navigation is WORK; low-frequency destinations
 *  (Help, Settings, Profile) live in the sidebar footer. Reporter users
 *  never see professional destinations. */
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

export const REPORTER_NAV_ITEMS: NavItem[] = [
  { to: "/", labelKey: "home", icon: Icons.home, tourId: "nav-home" },
  { to: "/incidents/new", labelKey: "reportWildlife", icon: Icons.plus, tourId: "nav-create" },
  { to: "/incidents", labelKey: "myReports", icon: Icons.list, tourId: "nav-incidents", end: true },
];

/** Footer (low-frequency) navigation for both workspaces. */
export const FOOTER_NAV_ITEMS: NavItem[] = [
  { to: "/help", labelKey: "help", icon: Icons.book, tourId: "nav-help" },
  { to: "/settings", labelKey: "settings", icon: Icons.settings, tourId: "nav-settings" },
  { to: "/profile", labelKey: "profile", icon: Icons.user, tourId: "nav-profile" },
];

export const PROFESSIONAL_NAV_ITEMS: NavItem[] = [
  { to: "/", labelKey: "dashboard", icon: Icons.activity, tourId: "nav-home" },
  { to: "/network", labelKey: "responseNetwork", icon: Icons.handoff, tourId: "nav-network" },
  { to: "/network?view=map", labelKey: "map", icon: Icons.map, tourId: "nav-map" },
  { to: "/incidents", labelKey: "incidents", icon: Icons.list, tourId: "nav-incidents", end: true },
  { to: "/incidents/new", labelKey: "newIntake", icon: Icons.plus, tourId: "nav-create" },
];
