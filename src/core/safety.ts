import path from "node:path";

import type { WisteriaConfig } from "./types.js";
import { WisteriaError } from "./errors.js";

const PLAIN_SECRET_PATTERNS: RegExp[] = [
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bsk-[A-Za-z0-9_-]{12,}\b/g,
  /\bAIza[0-9A-Za-z\-_]{20,}\b/g,
];

const STRUCTURED_SECRET_PATTERNS = [
  {
    pattern: /(Authorization:\s*(?:Bearer|Basic)\s+)[A-Za-z0-9._\-+/=]+/gi,
    replace: "$1[REDACTED]",
  },
  {
    pattern: /(https?:\/\/[^/\s:@]+:)([^@/\s]+)(@)/gi,
    replace: "$1[REDACTED]$3",
  },
  {
    pattern:
      /([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY|PRIVATE_KEY)[A-Z0-9_]*\s*=\s*)([^\s]+)/gi,
    replace: "$1[REDACTED]",
  },
] as const;

const SENSITIVE_PATH_PATTERNS: RegExp[] = [
  /(^|[\\/])\.env([.][^\\/]+)?$/i,
  /(^|[\\/])id_(rsa|dsa|ecdsa|ed25519)$/i,
  /(^|[\\/])known_hosts$/i,
  /(^|[\\/])authorized_keys$/i,
  /(^|[\\/])credentials$/i,
  /(^|[\\/])\.npmrc$/i,
  /(^|[\\/])\.pypirc$/i,
  /(^|[\\/])\.netrc$/i,
  /(^|[\\/])\.aws[\\/](credentials|config)$/i,
  /(^|[\\/])\.ssh([\\/]|$)/i,
  /\.(pem|key|p12|pfx)$/i,
];

export function redactSecrets(text: string, extraSecrets: readonly string[] = []): string {
  let output = text;

  for (const secret of [...extraSecrets].sort((left, right) => right.length - left.length)) {
    if (!secret) {
      continue;
    }
    output = output.split(secret).join("[REDACTED]");
  }

  for (const pattern of PLAIN_SECRET_PATTERNS) {
    output = output.replace(pattern, "[REDACTED]");
  }

  for (const entry of STRUCTURED_SECRET_PATTERNS) {
    output = output.replace(entry.pattern, entry.replace);
  }

  return output;
}

export function assertSafeWorkDir(targetPath: string, allowedRoot: string): void {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedRoot = path.resolve(allowedRoot);
  const relative = path.relative(resolvedRoot, resolvedTarget);

  if (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  ) {
    return;
  }

  throw new WisteriaError(
    `Path is outside the allowed work directory: ${resolvedTarget}`,
    "UNSAFE_WORKDIR",
  );
}

export function isSensitivePath(targetPath: string): boolean {
  const normalized = path.normalize(targetPath.trim());
  return SENSITIVE_PATH_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function assertGitCommandsAllowed(config: WisteriaConfig): void {
  if (!config.allowGitCommands) {
    throw new WisteriaError(
      "Local Git commands are disabled. Enable allowGitCommands first.",
      "GIT_COMMANDS_DISABLED",
    );
  }
}

export function sanitizePrBody(body: string): string {
  const redacted = redactSecrets(body);
  return redacted.replace(
    /(?:(?:^)|\s)(~?[A-Za-z]:?[\\/][^\s]+|[.]{0,2}[\\/][^\s]+)/g,
    (match) => (isSensitivePath(match.trim()) ? " [REDACTED_PATH]" : match),
  );
}

export function assertReadOnlyDigest(): void {
  return;
}
