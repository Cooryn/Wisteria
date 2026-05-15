import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { getIssueContext } from "../src/github/issues.js";

function collectTsFiles(dir: string): string[] {
  const entries = readdirSync(dir).flatMap((name) => {
    const fullPath = path.join(dir, name);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      return collectTsFiles(fullPath);
    }
    return fullPath.endsWith(".ts") ? [fullPath] : [];
  });

  return entries;
}

describe("AI policy", () => {
  it("keeps model-provider SDKs out of package.json", () => {
    const pkg = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const dependencies = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };

    expect(Object.keys(dependencies)).not.toContain("openai");
    expect(Object.keys(dependencies)).not.toContain("@anthropic-ai/sdk");
    expect(Object.keys(dependencies)).not.toContain("@google/generative-ai");
    expect(Object.keys(dependencies)).not.toContain("langchain");
  });

  it("does not expose model API key config in the plugin manifest", () => {
    const manifest = JSON.parse(
      readFileSync(new URL("../openclaw.plugin.json", import.meta.url), "utf8"),
    ) as {
      configSchema: { properties: Record<string, unknown> };
    };

    expect(Object.keys(manifest.configSchema.properties)).not.toEqual(
      expect.arrayContaining(["openaiApiKey", "anthropicApiKey", "geminiApiKey"]),
    );
  });

  it("does not directly call provider SDKs from active source files", () => {
    const files = collectTsFiles(path.resolve("src"));
    const source = files.map((file) => readFileSync(file, "utf8")).join("\n");

    expect(source).not.toMatch(/from\s+["']openai["']/);
    expect(source).not.toMatch(/from\s+["']@anthropic-ai\/sdk["']/);
    expect(source).not.toMatch(/from\s+["']@google\/generative-ai["']/);
    expect(source).not.toMatch(/langchain/i);
  });

  it("returns issue context without model-generated analysis", async () => {
    const result = await getIssueContext(
      {
        rest: {
          repos: {
            get: async () => ({
              data: {
                full_name: "octo/example",
                html_url: "https://github.com/octo/example",
                default_branch: "main",
                language: "TypeScript",
                topics: ["react"],
              },
            }),
            getReadme: async () => ({
              data: {
                path: "README.md",
                content: Buffer.from("# Example\nHello").toString("base64"),
              },
            }),
          },
          issues: {
            get: async () => ({
              data: {
                number: 1,
                title: "Improve docs",
                body: "Details",
                html_url: "https://github.com/octo/example/issues/1",
                labels: [{ name: "documentation" }],
                comments: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                user: { login: "octo" },
              },
            }),
            listComments: async () => ({ data: [] }),
          },
        },
      } as never,
      {
        repoFullName: "octo/example",
        issueNumber: 1,
      },
    );

    expect(result).toHaveProperty("repo");
    expect(result).toHaveProperty("issue");
    expect(result).toHaveProperty("analysisPrompt");
    expect("difficulty" in result).toBe(false);
  });

  it("keeps daily digest free of model API calls", () => {
    const source = readFileSync(new URL("../src/github/daily-digest.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/openai|anthropic|gemini|chatCompletions|responses/iu);
  });
});
