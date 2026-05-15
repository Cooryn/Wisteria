import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("skill cleanup", () => {
  it("does not reference local .mjs skill tools", () => {
    const skill = readFileSync(new URL("../skills/wisteria/SKILL.md", import.meta.url), "utf8");
    expect(skill).not.toContain("wisteria-search.mjs");
    expect(skill).not.toContain("wisteria-scoring.mjs");
    expect(skill).not.toContain("skills/wisteria/tools");
  });

  it("declares skills through plugin manifest", () => {
    const manifest = JSON.parse(
      readFileSync(new URL("../openclaw.plugin.json", import.meta.url), "utf8"),
    ) as {
      skills: string[];
      contracts: { tools: string[] };
    };

    expect(manifest.skills).toContain("skills");
    expect(manifest.contracts.tools).toContain("wisteria_daily_issue_digest");
    expect(manifest.contracts.tools).toContain("wisteria_get_preferences");
  });

  it("registers tools in plugin runtime entry", () => {
    const entry = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
    expect(entry).toContain("registerTool");
    expect(entry).toContain("wisteria_daily_issue_digest");
  });
});
