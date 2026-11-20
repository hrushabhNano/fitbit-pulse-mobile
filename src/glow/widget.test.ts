import { beforeAll, describe, expect, it, vi } from "vitest";
import { MemoryStore } from "@/data/memory";
import { seedDemo } from "@/data/seed";
import type { Profile } from "@/data/types";
import { runPipeline } from "@/pipeline";
import type { QueryCtx } from "@/queries/ctx";
import { getHome } from "@/queries/home";

vi.mock("@react-native-async-storage/async-storage", () => ({ default: { getItem: async () => null } }));
const { glowWidgetData } = await import("./widgetData");

const TZ = "Asia/Kolkata";
const TODAY = "2026-10-02";
const PROFILE: Profile = { birthDate: "1990-01-01", sex: "male", maxHr: 183, heightCm: 178, timeZone: TZ };
const at = (time: string) => Date.parse(`${TODAY}T${time}+05:30`) / 1000;

let store: MemoryStore;
beforeAll(async () => {
  store = new MemoryStore();
  await seedDemo(store, { today: TODAY, timeZone: TZ, now: at("14:00") });
  await runPipeline(store, PROFILE, { today: TODAY });
});
const ctxAt = async (time: string): Promise<QueryCtx> => ({ store, profile: PROFILE, timeZone: TZ, today: TODAY, now: at(time), sync: await store.getSyncState() });

describe("glow widget data", () => {
  it("carries every card the widgets draw, from the tabs' own queries", async () => {
    const ctx = await ctxAt("14:00");
    const home = await getHome(TODAY, ctx);
    const g = await glowWidgetData(ctx, home);
    expect(g.recovery.week).toHaveLength(7);
    expect(g.recovery.score).toBe(home.dials.recovery.value === null ? null : String(Math.round(home.dials.recovery.value)));
    expect(g.sleep.stages.deep + g.sleep.stages.rem + g.sleep.stages.light).toBeGreaterThan(0);
    expect(g.steps.week).toHaveLength(7);
    expect(g.steps.share).toBeGreaterThanOrEqual(0);
    expect(g.steps.share).toBeLessThanOrEqual(1);
    expect(g.energy.level).toBeGreaterThanOrEqual(0);
    expect(g.hero.sentence.length).toBeGreaterThan(0);
    // Small enough to ride in the 64 KB snapshot many times over.
    expect(JSON.stringify(g).length).toBeLessThan(4000);
  });

  it("follows the moment of the day", async () => {
    const morning = await ctxAt("07:30");
    const evening = await ctxAt("20:30");
    const m = await glowWidgetData(morning, await getHome(TODAY, morning));
    const e = await glowWidgetData(evening, await getHome(TODAY, evening));
    expect(m.moment).not.toBe(e.moment);
    expect(e.hero.mood).not.toBe("day");
  });
});
