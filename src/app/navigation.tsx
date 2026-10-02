/** Workspace navigation definitions — shared by the app shell and tests. */
import { Icons } from "../components/Icons";

export interface NavItem {
  to: string;
  label: string;
  icon: (p: { size?: number }) => JSX.Element;
  tourId: string;
}

/** Reporter never sees professional destinations (hidden, not grayed out). */
export const REPORTER_NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Home", icon: Icons.home, tourId: "nav-home" },
  { to: "/incidents/new", label: "Report wildlife", icon: Icons.plus, tourId: "nav-create" },
  { to: "/incidents", label: "My reports", icon: Icons.list, tourId: "nav-incidents" },
  { to: "/examples", label: "Help", icon: Icons.book, tourId: "nav-examples" },
  { to: "/settings", label: "Settings", icon: Icons.settings, tourId: "nav-settings" },
];

export const PROFESSIONAL_NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Home", icon: Icons.home, tourId: "nav-home" },
  { to: "/incidents", label: "Incidents", icon: Icons.list, tourId: "nav-incidents" },
  { to: "/incidents/new", label: "Create incident", icon: Icons.plus, tourId: "nav-create" },
  { to: "/network", label: "Response network", icon: Icons.handoff, tourId: "nav-network" },
  { to: "/examples", label: "Examples & tutorial", icon: Icons.book, tourId: "nav-examples" },
  { to: "/settings", label: "Settings", icon: Icons.settings, tourId: "nav-settings" },
];
