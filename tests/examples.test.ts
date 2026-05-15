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
      tools: {
        allow?: string[];
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

  it("keeps the multi-agent example wired to the plugin", () => {
    expect(multiAgentExample.plugins.entries["wisteria-claw"]?.enabled).toBe(true);
    expect(multiAgentExample.cron.enabled).toBe(true);
    expect(multiAgentExample.cron.store).toContain("jobs.json");
  });

  it("keeps worker roles aligned with the recommended role matrix", () => {
    expect(agentById("wisteria-scout").tools.allow).toEqual(recommendedAgents.scout.allow);
    expect(agentById("wisteria-analyst").tools.allow).toEqual(recommendedAgents.analyst.allow);
    expect(agentById("wisteria-coder").tools.allow).toEqual(
      expect.arrayContaining(recommendedAgents.coder.allow),
    );
    expect(agentById("wisteria-coder").tools.deny).toEqual(
      expect.arrayContaining(recommendedAgents.coder.deny),
    );
    expect(agentById("wisteria-maintainer").tools.allow).toEqual(
      expect.arrayContaining(recommendedAgents.maintainer.allow),
    );
    expect(agentById("wisteria-maintainer").tools.deny).toEqual(
      expect.arrayContaining(recommendedAgents.maintainer.deny),
    );
  });

  it("grants the orchestrator delegation rights without risky local-write tools", () => {
    const orchestrator = agentById("wisteria-orchestrator");
    expect(orchestrator.default).toBe(true);
    expect(orchestrator.tools.allow).toEqual(
      expect.arrayContaining([
        "sessions_spawn",
        "subagents",
        "sessions_list",
        "sessions_history",
        ...recommendedAgents.orchestrator.allow,
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
