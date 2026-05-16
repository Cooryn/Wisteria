import { describe, expect, it } from "vitest";

import {
  applyPreferencesPatch,
  getPluginConfigEntry,
} from "../src/core/config.js";

describe("preference config helpers", () => {
  it("reads a plugin config entry from the runtime config snapshot", () => {
    const snapshot = {
      plugins: {
        entries: {
          "wisteria-claw": {
            enabled: true,
            config: {
              defaultLanguages: ["TypeScript"],
            },
          },
        },
      },
    };

    expect(getPluginConfigEntry(snapshot, "wisteria-claw")).toEqual({
      defaultLanguages: ["TypeScript"],
    });
  });

  it("applies non-secret preference patches and preserves untouched fields", () => {
    const rawConfig: Record<string, unknown> = {
      githubToken: "ghp_secret",
      defaultLanguages: ["TypeScript"],
      maxStars: 20,
      dailyDigest: {
        enabled: true,
        timezone: "Asia/Shanghai",
        limit: 5,
      },
    };

    const result = applyPreferencesPatch(rawConfig, {
      defaultWorkDir: "  C:/code/open-source  ",
      defaultLanguages: [" Rust ", "TypeScript", "Rust"],
      defaultTopics: ["automation", "cli"],
      allowGitCommands: true,
      minStars: 50,
      dailyDigest: {
        timezone: null,
        hour: 10,
        limit: null,
      },
    });

    expect(rawConfig.githubToken).toBe("ghp_secret");
    expect(rawConfig.defaultWorkDir).toBe("C:/code/open-source");
    expect(rawConfig.defaultLanguages).toEqual(["Rust", "TypeScript"]);
    expect(rawConfig.defaultTopics).toEqual(["automation", "cli"]);
    expect(rawConfig.allowGitCommands).toBe(true);
    expect(rawConfig.minStars).toBe(50);
    expect(rawConfig.maxStars).toBe(50);
    expect(rawConfig.dailyDigest).toEqual({
      enabled: true,
      hour: 10,
    });
    expect(result.changedFields).toEqual(
      expect.arrayContaining([
        "defaultWorkDir",
        "defaultLanguages",
        "defaultTopics",
        "allowGitCommands",
        "minStars",
        "maxStars",
        "dailyDigest.timezone",
        "dailyDigest.hour",
        "dailyDigest.limit",
      ]),
    );
    expect(result.warnings).toContain("maxStars was raised to match minStars.");
  });
});
