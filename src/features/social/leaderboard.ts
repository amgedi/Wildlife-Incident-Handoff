/**
 * Reporter leaderboard (0.2.0-dev.14) — motivation without a server.
 *
 * A LOCAL leaderboard: your own report count with milestone levels, plus —
 * when LAN sync is enabled — friendly counts from devices on the same
 * network. There is NO global ranking anywhere: nothing leaves the devices
 * involved, and no account exists. Pure functions are exported for tests.
 */

export interface LeaderboardEntry {
  name: string;
  count: number;
  /** true when this entry is the local device ("you"). */
  isYou: boolean;
  level: MilestoneLevel;
  rank: number;
}

export interface MilestoneLevel {
  threshold: number;
  name: string;
}

export const MILESTONES: MilestoneLevel[] = [
  { threshold: 0, name: "Newcomer" },
  { threshold: 1, name: "First Reporter" },
  { threshold: 5, name: "Helper" },
  { threshold: 10, name: "Guardian" },
  { threshold: 25, name: "Protector" },
  { threshold: 50, name: "Steward" },
  { threshold: 100, name: "Champion" },
];

export function levelFor(count: number): MilestoneLevel {
  let level = MILESTONES[0]!;
  for (const m of MILESTONES) {
    if (count >= m.threshold) level = m;
  }
  return level;
}

export function nextMilestone(count: number): MilestoneLevel | null {
  return MILESTONES.find((m) => m.threshold > count) ?? null;
}

/**
 * Build the leaderboard. Local count first, then LAN peers (optional).
 * Ties share the lower rank; "you" always keeps its name label.
 */
export function computeLeaderboard(
  you: { name: string; count: number },
  peers: Array<{ name: string; count: number }> = []
): LeaderboardEntry[] {
  const all: Array<{ name: string; count: number; isYou: boolean }> = [
    { name: you.name || "You", count: you.count, isYou: true },
    ...peers
      .filter((p) => p.count >= 0)
      .map((p) => ({ name: p.name || "Device", count: p.count, isYou: false })),
  ];
  all.sort((a, b) => b.count - a.count || (a.isYou ? -1 : 1));
  let lastCount: number | null = null;
  let lastRank = 0;
  return all.map((e, i) => {
    const rank = e.count === lastCount ? lastRank : i + 1;
    lastCount = e.count;
    lastRank = rank;
    return { ...e, level: levelFor(e.count), rank };
  });
}
