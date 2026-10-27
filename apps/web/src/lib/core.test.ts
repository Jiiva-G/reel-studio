import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BundleError, bundleJson, exportBackup, exportBundle, importFile } from "./bundle";
import { blankProject, blankScene, sampleProject } from "./samples";
import { chunkText, sceneTimings, toReelProps } from "./timeline";
import { counts, validateProject } from "./validate";
import type { Project } from "./types";

describe("validation (port of script.validate)", () => {
  it("the sample storyboard is clean, as the engine reports for examples/demo", () => {
    expect(counts(validateProject(sampleProject()))).toEqual({ errors: 0, warnings: 0 });
  });

  it("uses the engine's limits and messages", () => {
    const p = sampleProject();
    p.scenes[0].on_screen.heading = "x".repeat(61);
    p.scenes[2].on_screen.code = "y".repeat(45);
    p.scenes[3].narration = " ";
    const msgs = validateProject(p).map((i) => i.message);
    expect(msgs).toContain("Scene 1 (hook): heading too long (61 > 60).");
    expect(msgs.some((m) => m.startsWith("Scene 3 (code): code line too long (45 > 44)"))).toBe(true);
    expect(msgs).toContain("Scene 4 (code): empty narration.");
  });

  it("asterisks do not count toward the heading limit", () => {
    const p = sampleProject();
    p.scenes[0].on_screen.heading = `*${"x".repeat(60)}*`;
    expect(counts(validateProject(p)).errors).toBe(0);
  });

  it("flags structure and missing fields", () => {
    const p = blankProject("x");
    const issues = validateProject(p);
    expect(issues.some((i) => i.message === "Scene 1 (hook): missing on_screen.heading.")).toBe(true);
    p.scenes = [];
    expect(validateProject(p)[0].message).toBe("Storyboard has no scenes.");
  });
});

describe("preview timing (port of timeline.build)", () => {
  it("matches the engine's silent render of the demo (timeline.json: 39.13 s)", () => {
    const props = toReelProps(sampleProject());
    expect(Math.abs(props.durationInFrames / 30 - 39.13)).toBeLessThan(0.25);
  });

  it("scenes are contiguous and captions never overlap", () => {
    const props = toReelProps(sampleProject());
    props.scenes.forEach((s, i) => i && expect(s.from).toBe(props.scenes[i - 1].from + props.scenes[i - 1].duration));
    props.captions.forEach((c, i) => i && expect(props.captions[i - 1].to).toBeLessThanOrEqual(c.from));
    expect(sceneTimings(sampleProject()).every((t) => t.duration > 0)).toBe(true);
  });

  it("chunks captions like the engine", () => {
    expect(chunkText("One client can flood your API with requests.")).toEqual(["One client can flood your", "API with requests."]);
  });
});

describe("bundle", () => {
  const roundTrip = (p: Project) => importFile(exportBundle(p)) as Project;

  it("round-trips a project", () => {
    const p = sampleProject();
    p.brand.name = "Acme Labs";
    p.brand.colors.accent = "#ff0000";
    const q = roundTrip(p);
    expect(q.name).toBe(p.name);
    expect(q.brand.name).toBe("Acme Labs");
    expect(q.brand.colors.accent).toBe("#ff0000");
    expect(q.scenes.map((s) => [s.type, s.narration, s.on_screen])).toEqual(p.scenes.map((s) => [s.type, s.narration, s.on_screen]));
    expect(q.id).not.toBe(p.id);
  });

  it("writes the engine's format and only its fields", () => {
    const b = bundleJson(sampleProject());
    expect(b.format).toBe("reel-studio.bundle");
    expect(b.version).toBe(1);
    expect(Object.keys(b.storyboard.scenes[0]).sort()).toEqual(
      ["music_intensity", "narration", "on_screen", "sfx", "subtitle", "transition", "type", "visual"]);
    expect(JSON.stringify(b)).not.toContain("uid");
  });

  it("rejects files that are not bundles", () => {
    const enc = (o: unknown) => new TextEncoder().encode(JSON.stringify(o));
    expect(() => importFile(enc({ format: "nope" }))).toThrow(BundleError);
    expect(() => importFile(enc({ ...bundleJson(sampleProject()), version: 9 }))).toThrow(/Unsupported bundle version/);
    expect(() => importFile(new TextEncoder().encode("{oops"))).toThrow(/not valid JSON/);
    const empty = bundleJson(sampleProject());
    empty.storyboard.scenes = [];
    expect(() => importFile(enc(empty))).toThrow(/no scenes/);
  });

  it("ignores bad colours and unknown scene types", () => {
    const b = bundleJson(blankProject("x")) as any;
    b.brand.colors.bg = "red; background:url(x)";
    b.storyboard.scenes[0].type = "<script>";
    const q = importFile(new TextEncoder().encode(JSON.stringify(b))) as Project;
    expect(q.brand.colors.bg).toBe("#0b0f0d");
    expect(q.scenes[0].type).toBe("title");
  });

  it("backs up and restores several projects", () => {
    const ps = [sampleProject("A"), blankProject("B")];
    const back = importFile(exportBackup(ps)) as Project[];
    expect(back.map((p) => p.name)).toEqual(["A", "B"]);
  });

  it("writes the sample bundle for the engine import check (CI)", () => {
    const out = process.env.BUNDLE_OUT;
    const p = sampleProject("Bundle from the web editor");
    p.scenes.splice(2, 0, blankScene("quote"));
    p.scenes[2].on_screen.quote = "Rate limits are a feature.";
    p.scenes[2].narration = "Rate limits are a feature.";
    if (out) writeFileSync(out, exportBundle(p));
    expect(counts(validateProject(p)).errors).toBe(0);
  });
});
