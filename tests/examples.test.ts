import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { recommendedAgents } from "../src/agents/recommended.js";

const multiAgentExample = JSON.parse(
  readFileSync(new URL("../examples/openclaw/openclaw.multi-agent.fragment.json", import.meta.url), "utf8"),
) as {
  plugins: {
    entries: Record<string, { enabled: boolean; config?: Record<string, unknown> }>;
  };
  agents: {
    list: Array<{
      id: string;
      default?: boolean;
      workspace?: string;
      tools: {
        profile?: string;
        alsoAllow?: string[];
        deny?: string[];
      };
      subagents?: {
        allowAgents?: string[];
        requireAgentId?: boolean;
      };
    }>;
  };
  cron: {
    enabled: boolean;
    store: string;
  };
};

const localDevExample = JSON.parse(
  readFileSync(new URL("../examples/openclaw/openclaw.local-dev.fragment.json", import.meta.url), "utf8"),
) as {
  plugins: {
    load: {
      paths: string[];
    };
  };
};

const localReadyExample = JSON.parse(
  readFileSync(new URL("../examples/openclaw/openclaw.local-ready.json", import.meta.url), "utf8"),
) as {
  plugins: {
    load?: {
      paths?: string[];
    };
    entries: Record<string, { enabled: boolean; config?: Record<string, unknown> }>;
  };
  cron: {
    enabled: boolean;
    store: string;
  };
};

const cronStoreExample = JSON.parse(
  readFileSync(new URL("../examples/openclaw/cron.jobs.json", import.meta.url), "utf8"),
) as {
  version: number;
  jobs: Array<{
    id: string;
    agentId?: string;
    schedule: { kind: string };
    sessionTarget: string;
    payload: {
      kind: string;
      toolsAllow?: string[];
    };
    delivery?: { mode: string };
  }>;
};

function agentById(id: string) {
  const agent = multiAgentExample.agents.list.find((entry) => entry.id === id);
  expect(agent).toBeDefined();
  return agent!;
}

describe("example configuration files", () => {
  it("keeps the local-dev example on explicit plugin discovery paths", () => {
    expect(localDevExample.plugins.load.paths).toEqual([
      "REPLACE_WITH_ABSOLUTE_PATH_TO_WISTERIA",
    ]);
  });

  it("keeps the local-ready example self-contained on a single file path", () => {
    expect(localReadyExample.plugins.entries["wisteria-claw"]?.enabled).toBe(true);
    expect(localReadyExample.plugins.load?.paths?.length).toBe(1);
    expect(localReadyExample.cron.enabled).toBe(true);
    expect(localReadyExample.cron.store).toContain("jobs.json");
  });

  it("keeps the multi-agent example wired to the plugin", () => {
    expect(multiAgentExample.plugins.entries["wisteria-claw"]?.enabled).toBe(true);
    expect(
      multiAgentExample.plugins.entries["wisteria-claw"]?.config?.defaultWorkDir,
    ).toBe("~/.openclaw/workspace/wisteria-contributions");
    expect(multiAgentExample.cron.enabled).toBe(true);
    expect(multiAgentExample.cron.store).toContain("jobs.json");
  });

  it("keeps every example workspace under the OpenClaw workspace root", () => {
    for (const agent of multiAgentExample.agents.list) {
      expect(agent.workspace).toMatch(/^~\/\.openclaw\/workspace(?:\/|$)/);
    }
  });

  it("keeps worker roles aligned with the recommended role matrix", () => {
    expect(agentById("wisteria-scout").tools.profile).toBe(recommendedAgents.scout.profile);
    expect(agentById("wisteria-scout").tools.alsoAllow).toEqual(
      recommendedAgents.scout.alsoAllow,
    );
    expect(agentById("wisteria-analyst").tools.profile).toBe(recommendedAgents.analyst.profile);
    expect(agentById("wisteria-analyst").tools.alsoAllow).toEqual(
      recommendedAgents.analyst.alsoAllow,
    );
    expect(agentById("wisteria-coder").tools.profile).toBe(recommendedAgents.coder.profile);
    expect(agentById("wisteria-coder").tools.alsoAllow).toEqual(
      recommendedAgents.coder.alsoAllow,
    );
    expect(agentById("wisteria-coder").tools.deny).toEqual(
      expect.arrayContaining(recommendedAgents.coder.deny),
    );
    expect(agentById("wisteria-maintainer").tools.profile).toBe(
      recommendedAgents.maintainer.profile,
    );
    expect(agentById("wisteria-maintainer").tools.alsoAllow).toEqual(
      recommendedAgents.maintainer.alsoAllow,
    );
    expect(agentById("wisteria-maintainer").tools.deny).toEqual(
      expect.arrayContaining(recommendedAgents.maintainer.deny),
    );
  });

  it("grants the orchestrator delegation rights without risky local-write tools", () => {
    const orchestrator = agentById("wisteria-orchestrator");
    expect(orchestrator.default).toBe(true);
    expect(orchestrator.tools.profile).toBe(recommendedAgents.orchestrator.profile);
    expect(orchestrator.tools.alsoAllow).toEqual(
      expect.arrayContaining([
        ...recommendedAgents.orchestrator.alsoAllow,
      ]),
    );
    expect(orchestrator.tools.alsoAllow).not.toEqual(
      expect.arrayContaining([
        "wisteria_search_repos",
        "wisteria_search_issues",
        "wisteria_get_issue_context",
        "wisteria_daily_issue_digest",
      ]),
    );
    expect(orchestrator.subagents?.allowAgents).toEqual([
      "wisteria-scout",
      "wisteria-analyst",
      "wisteria-coder",
      "wisteria-maintainer",
    ]);
    expect(orchestrator.tools.deny).toEqual(
      expect.arrayContaining([
        "write",
        "edit",
        "apply_patch",
        "exec",
        "process",
        "wisteria_create_draft_pr",
      ]),
    );
  });

  it("keeps the cron example read-only and bound to defined agents", () => {
    expect(cronStoreExample.version).toBe(1);
    const knownAgents = new Set(multiAgentExample.agents.list.map((agent) => agent.id));

    for (const job of cronStoreExample.jobs) {
      expect(job.payload.kind).toBe("agentTurn");
      expect(job.schedule.kind).toBe("cron");
      expect(job.sessionTarget).toBe("isolated");
      expect(job.delivery?.mode).toBe("none");
      expect(knownAgents.has(job.agentId ?? "")).toBe(true);
      expect(job.payload.toolsAllow).toContain("read");
      if (job.agentId === "wisteria-orchestrator") {
        expect(job.payload.toolsAllow).toEqual(
          expect.arrayContaining([
            "wisteria_get_preferences",
            "sessions_spawn",
            "subagents",
          ]),
        );
      }
      expect(job.payload.toolsAllow).not.toEqual(
        expect.arrayContaining([
          "wisteria_prepare_contribution",
          "wisteria_check_workspace",
          "wisteria_create_draft_pr",
        ]),
      );
    }
  });
});
