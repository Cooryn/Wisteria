import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { DEFAULT_ISSUE_LABELS, resolveConfig } from "../src/core/config.js";

describe("plugin config schema", () => {
  it("lets the plugin load without a GitHub token", () => {
    const manifest = JSON.parse(
      readFileSync(new URL("../openclaw.plugin.json", import.meta.url), "utf8"),
    ) as {
      configSchema: {
        required?: string[];
        properties: {
          defaultLabels?: {
            default?: string[];
          };
        };
      };
    };

    expect(manifest.configSchema.required ?? []).not.toContain("githubToken");
    expect(manifest.configSchema.properties.defaultLabels?.default).toEqual([
      ...DEFAULT_ISSUE_LABELS,
    ]);

    const config = resolveConfig({});
    expect(config.githubToken).toBe("");
    expect(config.defaultLabels).toEqual([...DEFAULT_ISSUE_LABELS]);
  });
});
