import { readFileSync } from "node:fs";

import { createTestPluginApi } from "openclaw/plugin-sdk/plugin-test-api";
import { describe, expect, it, vi } from "vitest";

import { recommendedAgents } from "../src/agents/recommended.js";
import pluginEntry from "../src/index.js";

const manifest = JSON.parse(
  readFileSync(new URL("../openclaw.plugin.json", import.meta.url), "utf8"),
) as {
  contracts: { tools: string[] };
  toolMetadata: Record<string, { optional?: boolean }>;
};

describe("recommendedAgents", () => {
  it("keeps scout read-only and away from risky tools", () => {
    expect(recommendedAgents.scout.readOnly).toBe(true);
    expect(recommendedAgents.scout.deny).toContain("write");
    expect(recommendedAgents.scout.deny).toContain("exec");
    expect(recommendedAgents.scout.deny).toContain("wisteria_prepare_contribution");
    expect(recommendedAgents.scout.deny).toContain("wisteria_create_draft_pr");
  });

  it("keeps analyst read-only", () => {
    expect(recommendedAgents.analyst.readOnly).toBe(true);
    expect(recommendedAgents.analyst.canExecuteCommands).toBe(false);
    expect(recommendedAgents.analyst.canWriteFiles).toBe(false);
  });

  it("does not grant Draft PR creation to coder", () => {
    expect(recommendedAgents.coder.allow).not.toContain("wisteria_create_draft_pr");
    expect(recommendedAgents.coder.deny).toContain("wisteria_create_draft_pr");
  });

  it("does not grant write or apply_patch to maintainer", () => {
    expect(recommendedAgents.maintainer.deny).toContain("write");
    expect(recommendedAgents.maintainer.deny).toContain("apply_patch");
  });

  it("keeps high-risk tools optional in the manifest", () => {
    expect(manifest.toolMetadata.wisteria_prepare_contribution?.optional).toBe(true);
    expect(manifest.toolMetadata.wisteria_check_workspace?.optional).toBe(true);
    expect(manifest.toolMetadata.wisteria_create_draft_pr?.optional).toBe(true);
  });

  it("only exposes daily digest to scout in the recommended config", () => {
    expect(recommendedAgents.scout.allow).toContain("wisteria_daily_issue_digest");
    expect(recommendedAgents.analyst.allow).not.toContain("wisteria_daily_issue_digest");
    expect(recommendedAgents.coder.allow).not.toContain("wisteria_daily_issue_digest");
    expect(recommendedAgents.maintainer.allow).not.toContain("wisteria_daily_issue_digest");
  });
});

describe("plugin registration", () => {
  it("registers every manifest tool", () => {
    const registeredNames: string[] = [];
    const api = createTestPluginApi({
      pluginConfig: {},
      registerTool: vi.fn((tool: { name?: string }) => {
        if (tool.name) {
          registeredNames.push(tool.name);
        }
      }),
    });

    pluginEntry.register(api);

    expect(registeredNames.sort()).toEqual([...manifest.contracts.tools].sort());
  });
});
