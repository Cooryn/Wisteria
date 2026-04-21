import { invoke } from "@tauri-apps/api/core";
import type {
  DraftPrArtifact,
  GitHubTokenStatus,
  IssueCandidate,
  LlmConfig,
  LlmConfigStatus,
  RepoCandidate,
  SystemProbe,
  UserProfile
} from "../domain/types";

interface GenerateDraftPrPayload {
  profile: UserProfile;
  issue: IssueCandidate;
  repo: RepoCandidate;
}

interface DraftPrResponse {
  artifact: DraftPrArtifact;
  warnings: string[];
}

export const tauriCommands = {
  async saveGithubToken(token: string): Promise<GitHubTokenStatus> {
    return invoke<GitHubTokenStatus>("save_github_token", { token });
  },
  async getGithubTokenStatus(): Promise<GitHubTokenStatus> {
    return invoke<GitHubTokenStatus>("get_github_token_status");
  },
  async saveLlmConfig(config: LlmConfig): Promise<LlmConfigStatus> {
    return invoke<LlmConfigStatus>("save_llm_config", { config });
  },
  async generateDraftPr(payload: GenerateDraftPrPayload): Promise<DraftPrResponse> {
    return invoke<DraftPrResponse>("generate_draft_pr", { request: payload });
  },
  async gitProbe(): Promise<SystemProbe> {
    return invoke<SystemProbe>("git_probe");
  }
};

