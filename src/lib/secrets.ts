import { appDataDir } from "@tauri-apps/api/path";
import { Client, Stronghold } from "@tauri-apps/plugin-stronghold";
import type { GitHubTokenStatus, LlmConfig } from "../domain/types";
import { tauriCommands } from "./tauri";

const SNAPSHOT_NAME = "wisteria-secrets.hold";
const CLIENT_NAME = "wisteria";
const GITHUB_KEY = "github_pat";
const LLM_KEY = "llm_config";
const LOCAL_STORAGE_PASSWORD_KEY = "wisteria.vault-password";

async function getVaultPassword(): Promise<string> {
  const existing = window.localStorage.getItem(LOCAL_STORAGE_PASSWORD_KEY);
  if (existing) {
    return existing;
  }

  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const generated = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  window.localStorage.setItem(LOCAL_STORAGE_PASSWORD_KEY, generated);
  return generated;
}

async function loadStronghold(): Promise<{ stronghold: Stronghold; client: Client }> {
  const [basePath, password] = await Promise.all([appDataDir(), getVaultPassword()]);
  const snapshotPath = `${basePath}${SNAPSHOT_NAME}`;
  const stronghold = await Stronghold.load(snapshotPath, password);
  const client = await stronghold.loadClient(CLIENT_NAME);
  if (client) {
    return { stronghold, client };
  }

  return {
    stronghold,
    client: await stronghold.createClient(CLIENT_NAME)
  };
}

async function saveString(key: string, value: string): Promise<void> {
  const { stronghold, client } = await loadStronghold();
  await client.store(key, value);
  await stronghold.save();
}

async function readString(key: string): Promise<string | null> {
  const { client } = await loadStronghold();
  try {
    const value = await client.get(key);
    return value ?? null;
  } catch {
    return null;
  }
}

export async function persistGithubToken(token: string): Promise<GitHubTokenStatus> {
  await saveString(GITHUB_KEY, token.trim());
  return tauriCommands.saveGithubToken(token.trim());
}

export async function persistLlmConfig(config: LlmConfig): Promise<void> {
  await saveString(LLM_KEY, JSON.stringify(config));
  await tauriCommands.saveLlmConfig(config);
}

export async function hydrateSecretSession(): Promise<void> {
  const githubToken = await readString(GITHUB_KEY);
  if (githubToken) {
    await tauriCommands.saveGithubToken(githubToken);
  }

  const llmConfig = await readString(LLM_KEY);
  if (llmConfig) {
    await tauriCommands.saveLlmConfig(JSON.parse(llmConfig) as LlmConfig);
  }
}

