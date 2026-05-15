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
    expect(recommendedAgents.coder.alsoAllow).not.toContain("wisteria_create_draft_pr");
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
    expect(recommendedAgents.scout.alsoAllow).toContain("wisteria_daily_issue_digest");
    expect(recommendedAgents.analyst.alsoAllow).not.toContain("wisteria_daily_issue_digest");
    expect(recommendedAgents.coder.alsoAllow).not.toContain("wisteria_daily_issue_digest");
    expect(recommendedAgents.maintainer.alsoAllow).not.toContain("wisteria_daily_issue_digest");
  });

  it("lets every role read runtime preferences", () => {
    expect(recommendedAgents.orchestrator.alsoAllow).toContain("wisteria_get_preferences");
    expect(recommendedAgents.scout.alsoAllow).toContain("wisteria_get_preferences");
    expect(recommendedAgents.analyst.alsoAllow).toContain("wisteria_get_preferences");
    expect(recommendedAgents.coder.alsoAllow).toContain("wisteria_get_preferences");
    expect(recommendedAgents.maintainer.alsoAllow).toContain("wisteria_get_preferences");
  });

  it("keeps the orchestrator on delegation-only workflow tools", () => {
    expect(recommendedAgents.orchestrator.alsoAllow).not.toContain("wisteria_search_repos");
    expect(recommendedAgents.orchestrator.alsoAllow).not.toContain("wisteria_search_issues");
    expect(recommendedAgents.orchestrator.alsoAllow).not.toContain("wisteria_get_issue_context");
    expect(recommendedAgents.orchestrator.alsoAllow).not.toContain("wisteria_daily_issue_digest");
  });

  it("widens plugin tools with alsoAllow instead of relying on allow alone", () => {
    expect(recommendedAgents.scout.alsoAllow).toEqual(
      expect.arrayContaining([
        "read",
        "wisteria_get_preferences",
        "wisteria_search_repos",
        "wisteria_daily_issue_digest",
      ]),
    );
    expect(recommendedAgents.analyst.alsoAllow).toEqual([
      "read",
      "wisteria_get_preferences",
      "wisteria_get_issue_context",
    ]);
    expect(recommendedAgents.coder.alsoAllow).toEqual(
      expect.arrayContaining([
        "read",
        "exec",
        "process",
        "wisteria_get_preferences",
        "wisteria_prepare_contribution",
        "wisteria_check_workspace",
      ]),
    );
    expect(recommendedAgents.maintainer.alsoAllow).toEqual(
      expect.arrayContaining([
        "read",
        "exec",
        "process",
        "wisteria_get_preferences",
        "wisteria_check_workspace",
        "wisteria_create_draft_pr",
      ]),
    );
    expect(recommendedAgents.orchestrator.alsoAllow).toEqual(
      expect.arrayContaining([
        "read",
        "sessions_spawn",
        "wisteria_get_preferences",
      ]),
    );
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
