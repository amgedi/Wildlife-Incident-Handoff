/**
 * Duplicate review V4 (0.3.0-dev.4, spec 18–24, 64): group pairwise
 * duplicate candidates into CLUSTERS via graph connectivity — A-B, A-C, B-C
 * become ONE group, never a permutation list. Signals shown as compact
 * chips; strongest groups first; nothing is ever auto-merged.
 */
import type { Incident } from "../../types/incident";
import type { DuplicateCandidate } from "./networkService";

export interface DuplicateGroup {
  /** Deterministic id (sorted member ids joined). */
  id: string;
  members: Incident[];
  /** Compact signals that hold for the whole group. */
  signals: string[];
  /** Strength ordering: more members + tighter time/area first. */
  strength: number;
}

/** Union-find grouping over candidate pairs. */
export function groupDuplicateCandidates(
  pairs: DuplicateCandidate[],
  incidentsById?: Map<string, Incident>
): DuplicateGroup[] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    const p = parent.get(x) ?? x;
    if (p === x) return x;
    const r = find(p);
    parent.set(x, r);
    return r;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const pair of pairs) {
    if (!parent.has(pair.a.id)) parent.set(pair.a.id, pair.a.id);
    if (!parent.has(pair.b.id)) parent.set(pair.b.id, pair.b.id);
    union(pair.a.id, pair.b.id);
  }
  const clusters = new Map<string, string[]>();
  for (const id of parent.keys()) {
    const root = find(id);
    clusters.set(root, [...(clusters.get(root) ?? []), id]);
  }
  const groups: DuplicateGroup[] = [];
  for (const ids of clusters.values()) {
    const members = ids
      .map((id) => incidentsById?.get(id))
      .filter((i): i is Incident => Boolean(i));
    const groupPairs = pairs.filter((p) => ids.includes(p.a.id) && ids.includes(p.b.id));
    const signals = groupSignals(members, groupPairs);
    const times = members.map((m) => new Date(m.occurredAt ?? m.createdAt).getTime());
    const spanHours = times.length > 1 ? (Math.max(...times) - Math.min(...times)) / 3_600_000 : 0;
    groups.push({
      id: [...ids].sort().join("|"),
      members: members.sort((a, b) => a.humanReference.localeCompare(b.humanReference)),
      signals,
      strength: members.length * 10 - spanHours,
    });
  }
  return groups.sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id));
}

/** Group-level signal chips, derived only from real data (spec 22). */
export function groupSignals(members: Incident[], pairs: DuplicateCandidate[]): string[] {
  const signals: string[] = [];
  if (members.length > 2) signals.push(`${members.length} similar reports`);
  const distances = pairs.map((p) => p.distanceKm).filter((d): d is number => d != null);
  if (distances.length > 0) {
    const max = Math.max(...distances);
    signals.push(max < 0.2 ? "Same area" : `${max.toFixed(1)} km apart`);
  }
  const times = members.map((m) => new Date(m.occurredAt ?? m.createdAt).getTime());
  if (times.length > 1) {
    const spanH = (Math.max(...times) - Math.min(...times)) / 3_600_000;
    signals.push(spanH < 1 ? "Within an hour" : `Within ${Math.round(spanH)} h`);
  }
  const descriptions = new Set(members.map((m) => (m.animal.description ?? "").trim().toLowerCase()));
  if (descriptions.size === 1 && members[0]?.animal.description) signals.push("Similar description");
  const species = new Set(members.map((m) => (m.animal.species ?? "").trim().toLowerCase()).filter(Boolean));
  if (species.size === 1) signals.push(`Same species: ${members[0]!.animal.species}`);
  return signals;
}
