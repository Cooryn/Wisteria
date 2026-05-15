import { describe, expect, it } from "vitest";

import {
  assertReadOnlyDigest,
  assertSafeWorkDir,
  isSensitivePath,
  redactSecrets,
  sanitizePrBody,
} from "../src/core/safety.js";

describe("safety helpers", () => {
  it("redacts token-like values", () => {
    const output = redactSecrets("token=ghp_abcdefghijklmnopqrstuvwxyz123456");
    expect(output).not.toContain("ghp_");
    expect(output).toContain("[REDACTED]");
  });

  it("detects .env paths as sensitive", () => {
    expect(isSensitivePath("C:/repo/.env")).toBe(true);
  });

  it("detects SSH private key paths as sensitive", () => {
    expect(isSensitivePath("C:/Users/me/.ssh/id_rsa")).toBe(true);
  });

  it("blocks workdir traversal", () => {
    expect(() =>
      assertSafeWorkDir("C:/code/other", "C:/code/project"),
    ).toThrow(/outside the allowed work directory/i);
  });

  it("sanitizes secrets from PR bodies", () => {
    const output = sanitizePrBody("GITHUB_TOKEN=ghp_secretvalue and .env");
    expect(output).not.toContain("ghp_secretvalue");
  });

  it("can redact high-risk tool output", () => {
    const output = redactSecrets(
      "https://user:ghp_secretvalue@github.com/octo/example.git",
      ["ghp_secretvalue"],
    );
    expect(output).not.toContain("ghp_secretvalue");
  });

  it("keeps the daily digest read-only helper callable", () => {
    expect(() => assertReadOnlyDigest()).not.toThrow();
  });
});
