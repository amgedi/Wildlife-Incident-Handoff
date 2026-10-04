/** 0.2.0-dev.14: leaderboard milestones, satellite provider, photo borders. */
import { describe, it, expect } from "vitest";
import { computeLeaderboard, levelFor, nextMilestone } from "./social/leaderboard";
import { getMapProviderDescriptor, MAP_PROVIDERS } from "./network/mapProvider";
import { readFileSync } from "fs";

describe("reporter leaderboard (local, honest)", () => {
  it("milestone levels increase with count", () => {
    expect(levelFor(0).name).toBe("Newcomer");
    expect(levelFor(1).name).toBe("First Reporter");
    expect(levelFor(14).name).toBe("Guardian");
    expect(levelFor(500).name).toBe("Champion");
    expect(nextMilestone(14)?.threshold).toBe(25);
    expect(nextMilestone(500)).toBeNull();
  });

  it("ranks you and peers by count, ties favour you", () => {
    const board = computeLeaderboard({ name: "Amged", count: 14 }, [
      { name: "Peer A", count: 20 },
      { name: "Peer B", count: 14 },
      { name: "Peer C", count: 3 },
    ]);
    expect(board[0]!.name).toBe("Peer A");
    expect(board.find((e) => e.isYou)!.rank).toBe(2);
    expect(board.find((e) => e.name === "Peer B")!.rank).toBe(2);
  });
});

describe("satellite basemap (real-life view)", () => {
  it("default provider is satellite imagery with attribution and health check", () => {
    const d = getMapProviderDescriptor(null);
    expect(d.id).toBe("esri-satellite");
    expect(d.tiles[0]).toContain("World_Imagery");
    expect(d.attribution).toContain("Esri");
    expect(d.healthCheckUrl).toBeTruthy();
    expect(MAP_PROVIDERS.some((p) => p.id === "osm-raster")).toBe(true);
  });

  it("map CSP allows the satellite host", () => {
    const conf = readFileSync("src-tauri/tauri.conf.json", "utf-8");
    expect(conf).toContain("server.arcgisonline.com");
  });
});

describe("profile photo decorative borders (0.3: retired)", () => {
  it("decorative rings are retired — the avatar uses a single subtle accent ring", () => {
    const src = readFileSync("src/components/ProfilePhoto.tsx", "utf-8");
    expect(src.includes("leaves")).toBe(false);
    expect(src.includes("stars")).toBe(false);
    expect(src.includes("rope")).toBe(false);
    // paw is no longer the person's default identity
    expect(src.includes("BearPawMark")).toBe(false);
  });
});

describe("newcomer tour prompt + onboarding", () => {
  it("App shows a tour prompt gated on tourCompleted/tourPromptDismissed", () => {
    const src = readFileSync("src/App.tsx", "utf-8");
    expect(src).toContain("tourPromptDismissed");
    expect(src).toContain("New here?");
  });
  it("onboarding includes a theme step", () => {
    const src = readFileSync("src/features/onboarding/OnboardingPage.tsx", "utf-8");
    expect(src).toContain("themeTitle");
    expect(src).toContain("THEMES");
  });
});
