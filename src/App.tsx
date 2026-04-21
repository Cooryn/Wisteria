import { useEffect, useState } from "react";
import { DraftWorkspace } from "./components/DraftWorkspace";
import { ProfileForm } from "./components/ProfileForm";
import {
  RecommendationsPanel,
  sortIssues
} from "./components/RecommendationsPanel";
import {
  defaultProfile,
  type AppView,
  type DraftPrArtifact,
  type GitHubTokenStatus,
  type IssueCandidate,
  type LlmConfig,
  type LlmConfigStatus,
  type ScanWorkspace,
  type SortMode,
  type SystemProbe,
  type UserProfile
} from "./domain/types";
import {
  createScanRun,
  finalizeScanRun,
  initDatabase,
  insertDraftPrArtifact,
  insertIssueCandidates,
  insertRepoCandidates,
  loadLatestScanWorkspace,
  loadProfile,
  saveProfile
} from "./lib/db";
import { createTemplateDraftPr } from "./lib/draftPr";
import { scanGitHubForIssues } from "./lib/github";
import { describeQuery, buildRepositoryQuery } from "./lib/queries";
import { hydrateSecretSession, persistGithubToken, persistLlmConfig } from "./lib/secrets";
import { tauriCommands } from "./lib/tauri";

const EMPTY_TOKEN_STATUS: GitHubTokenStatus = {
  hasToken: false,
  maskedToken: null,
  token: null,
  hydratedFromVault: false
};

const EMPTY_LLM_STATUS: LlmConfigStatus = {
  configured: false,
  model: null,
  baseUrl: null
};

const EMPTY_SYSTEM_PROBE: SystemProbe = {
  gitVersion: null,
  cargoAvailable: false,
  rustcAvailable: false,
  webview2Available: false,
  tauriPackagesPresent: false,
  notes: []
};

const DEFAULT_LLM_CONFIG: LlmConfig = {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4.1-mini",
  organization: "",
  project: ""
};

const NAV_ITEMS: { id: AppView; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "recommendations", label: "Recommendations" },
  { id: "issue", label: "Issue Detail" },
  { id: "draft", label: "Draft PR" },
  { id: "settings", label: "Settings" }
];

function formatResetTime(reset: number | null): string {
  if (!reset) {
    return "Unknown";
  }

  return new Date(reset * 1000).toLocaleString();
}

function healthCopy(probe: SystemProbe): string {
  if (!probe.cargoAvailable || !probe.rustcAvailable) {
    return "Rust toolchain missing from PATH. Install rustup before trying to build the Tauri shell.";
  }

  if (!probe.webview2Available) {
    return "WebView2 runtime not detected. The frontend can still be edited, but Windows packaging will need WebView2.";
  }

  return "Desktop prerequisites look healthy for local Tauri work.";
}

export default function App() {
  const [bootstrapping, setBootstrapping] = useState(true);
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [workspace, setWorkspace] = useState<ScanWorkspace>({ run: null, issues: [] });
  const [currentView, setCurrentView] = useState<AppView>("dashboard");
  const [selectedIssueId, setSelectedIssueId] = useState<number | null>(null);
  const [draftArtifact, setDraftArtifact] = useState<DraftPrArtifact | null>(null);
  const [githubTokenStatus, setGithubTokenStatus] =
    useState<GitHubTokenStatus>(EMPTY_TOKEN_STATUS);
  const [llmStatus, setLlmStatus] = useState<LlmConfigStatus>(EMPTY_LLM_STATUS);
  const [systemProbe, setSystemProbe] = useState<SystemProbe>(EMPTY_SYSTEM_PROBE);
  const [tokenInput, setTokenInput] = useState("");
  const [llmConfigDraft, setLlmConfigDraft] = useState<LlmConfig>(DEFAULT_LLM_CONFIG);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("score");
  const [filterText, setFilterText] = useState("");

  const selectedIssue =
    workspace.issues.find((issue) => issue.issueId === selectedIssueId) ??
    workspace.issues[0] ??
    null;

  useEffect(() => {
    void (async () => {
      setBootstrapping(true);
      try {
        await initDatabase();
        await hydrateSecretSession();

        const [savedProfile, loadedWorkspace, tokenStatus, probe] = await Promise.all([
          loadProfile(),
          loadLatestScanWorkspace(),
          tauriCommands.getGithubTokenStatus(),
          tauriCommands.gitProbe()
        ]);

        if (savedProfile) {
          setProfile(savedProfile);
        }

        setWorkspace(loadedWorkspace);
        setSelectedIssueId(loadedWorkspace.issues[0]?.issueId ?? null);
        setGithubTokenStatus(tokenStatus);
        setSystemProbe(probe);
        setLlmStatus((current) => ({
          ...current,
          configured: false
        }));
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
      } finally {
        setBootstrapping(false);
      }
    })();
  }, []);

  async function refreshFromDatabase() {
    const loadedWorkspace = await loadLatestScanWorkspace();
    setWorkspace(loadedWorkspace);
    setSelectedIssueId(loadedWorkspace.issues[0]?.issueId ?? null);
  }

  async function handleSaveProfile(nextProfile: UserProfile) {
    setBusyMessage("Saving contributor profile...");
    setError(null);
    try {
      await saveProfile(nextProfile);
      setProfile(nextProfile);
      setNotice("Contributor profile saved.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
    } finally {
      setBusyMessage(null);
    }
  }

  async function handleSaveToken() {
    if (!tokenInput.trim()) {
      setError("Paste a GitHub fine-grained PAT before saving.");
      return;
    }

    setBusyMessage("Saving GitHub token...");
    setError(null);
    try {
      const status = await persistGithubToken(tokenInput.trim());
      setGithubTokenStatus(status);
      setNotice("GitHub PAT saved to the local vault and session.");
      setTokenInput("");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
    } finally {
      setBusyMessage(null);
    }
  }

  async function handleSaveLlmConfig() {
    if (!llmConfigDraft.baseUrl.trim() || !llmConfigDraft.model.trim()) {
      setError("Base URL and model are required for the LLM relay.");
      return;
    }

    setBusyMessage("Saving LLM relay config...");
    setError(null);
    try {
      await persistLlmConfig(llmConfigDraft);
      setLlmStatus({
        configured: true,
        model: llmConfigDraft.model,
        baseUrl: llmConfigDraft.baseUrl
      });
      setNotice("LLM config saved and hydrated into the Rust relay.");
      setLlmConfigDraft((current) => ({ ...current, apiKey: "" }));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
    } finally {
      setBusyMessage(null);
    }
  }

  async function handleScan() {
    if (!githubTokenStatus.token) {
      setCurrentView("settings");
      setError("Save and hydrate a GitHub token before scanning.");
      return;
    }

    setBusyMessage("Scanning GitHub repositories and issues...");
    setError(null);
    setNotice(null);

    const querySnapshot = buildRepositoryQuery(profile);
    const scanRunId = await createScanRun(querySnapshot);
    setWorkspace({
      run: {
        id: scanRunId,
        createdAt: new Date().toISOString(),
        status: "running",
        querySnapshot,
        rateLimit: {
          limit: null,
          remaining: null,
          reset: null,
          used: null,
          resource: null
        },
        repoCount: 0,
        issueCount: 0
      },
      issues: []
    });

    try {
      const result = await scanGitHubForIssues(githubTokenStatus.token, profile);
      const repoIdMap = await insertRepoCandidates(scanRunId, result.repos);
      await insertIssueCandidates(scanRunId, repoIdMap, result.issues);
      await finalizeScanRun(scanRunId, {
        status: "completed",
        rateLimit: result.rateLimit,
        repoCount: result.repos.length,
        issueCount: result.issues.length,
        errorMessage: null
      });

      await refreshFromDatabase();
      setNotice(`Scan completed with ${result.issues.length} shortlisted issues.`);
      setCurrentView("recommendations");
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : String(caughtError);
      await finalizeScanRun(scanRunId, {
        status: "error",
        rateLimit: {
          limit: null,
          remaining: null,
          reset: null,
          used: null,
          resource: null
        },
        repoCount: 0,
        issueCount: 0,
        errorMessage: message
      });
      await refreshFromDatabase();
      setError(message);
    } finally {
      setBusyMessage(null);
    }
  }

  async function handleGenerateDraft() {
    if (!selectedIssue) {
      setError("Select an issue before generating a draft PR.");
      return;
    }

    setBusyMessage("Generating the draft PR workspace...");
    setError(null);

    try {
      const response = await tauriCommands.generateDraftPr({
        profile,
        issue: selectedIssue,
        repo: selectedIssue.repo
      });
      const artifact = {
        ...response.artifact,
        warnings: response.warnings
      };
      if (selectedIssue.id) {
        await insertDraftPrArtifact(selectedIssue.id, artifact);
      }
      setDraftArtifact(artifact);
      setNotice("Draft PR generated with the Rust relay.");
      setCurrentView("draft");
    } catch (caughtError) {
      const warning = caughtError instanceof Error ? caughtError.message : String(caughtError);
      const artifact = createTemplateDraftPr(
        profile,
        selectedIssue,
        selectedIssue.repo,
        "template-fallback",
        [warning, "The UI fell back to the built-in template generator."]
      );
      if (selectedIssue.id) {
        await insertDraftPrArtifact(selectedIssue.id, artifact);
      }
      setDraftArtifact(artifact);
      setNotice("LLM relay was unavailable, so the template fallback generated the draft.");
      setCurrentView("draft");
    } finally {
      setBusyMessage(null);
    }
  }

  const sortedIssueCount = sortIssues(workspace.issues, sortMode).length;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <p>Wisteria</p>
          <span>GitHub issue matchmaking for focused open-source work</span>
        </div>

        <nav>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={currentView === item.id ? "nav-button active" : "nav-button"}
              onClick={() => setCurrentView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footnote">
          <p>GitHub token</p>
          <strong>{githubTokenStatus.maskedToken ?? "Not connected"}</strong>
          <p>LLM relay</p>
          <strong>{llmStatus.configured ? llmStatus.model : "Template fallback only"}</strong>
        </div>
      </aside>

      <main className="workspace">
        <section className="hero panel">
          <div>
            <p className="eyebrow">Focused open-source routing</p>
            <h1>Turn your stack into a ranked issue queue and a draft PR packet.</h1>
            <p className="hero-copy">
              Wisteria matches your time budget and tech preferences against public
              GitHub issues, stores the reasoning locally, and prepares a high-signal
              Draft PR workspace when you pick one.
            </p>
          </div>
          <div className="hero-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => void handleScan()}
              disabled={Boolean(busyMessage) || bootstrapping}
            >
              {busyMessage?.includes("Scanning") ? "Scanning..." : "Run a fresh scan"}
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => setCurrentView("settings")}
            >
              Refine profile & secrets
            </button>
          </div>
        </section>

        {notice ? <div className="toast success">{notice}</div> : null}
        {error ? <div className="toast error">{error}</div> : null}

        <section className="stats-strip">
          <article className="stat-card">
            <span>Shortlisted issues</span>
            <strong>{workspace.issues.length}</strong>
          </article>
          <article className="stat-card">
            <span>Current sort size</span>
            <strong>{sortedIssueCount}</strong>
          </article>
          <article className="stat-card">
            <span>Rate budget left</span>
            <strong>{workspace.run?.rateLimit.remaining ?? "?"}</strong>
          </article>
          <article className="stat-card">
            <span>Toolchain</span>
            <strong>{systemProbe.cargoAvailable && systemProbe.webview2Available ? "Ready" : "Needs setup"}</strong>
          </article>
        </section>

        {currentView === "dashboard" ? (
          <section className="view-grid">
            <article className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">System checks</p>
                  <h2>Desktop readiness</h2>
                </div>
              </div>
              <p>{healthCopy(systemProbe)}</p>
              <div className="status-grid">
                <div>
                  <span>Git</span>
                  <strong>{systemProbe.gitVersion ?? "Missing"}</strong>
                </div>
                <div>
                  <span>cargo</span>
                  <strong>{systemProbe.cargoAvailable ? "Found" : "Missing"}</strong>
                </div>
                <div>
                  <span>rustc</span>
                  <strong>{systemProbe.rustcAvailable ? "Found" : "Missing"}</strong>
                </div>
                <div>
                  <span>WebView2</span>
                  <strong>{systemProbe.webview2Available ? "Detected" : "Not detected"}</strong>
                </div>
              </div>
              {systemProbe.notes.length > 0 ? (
                <ul className="plain-list subdued-list">
                  {systemProbe.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              ) : null}
            </article>

            <article className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Latest scan</p>
                  <h2>Manual refresh only</h2>
                </div>
                <span className="status-pill">{workspace.run?.status ?? "idle"}</span>
              </div>
              <p>
                {workspace.run
                  ? `Last scan: ${new Date(workspace.run.createdAt).toLocaleString()}`
                  : "No scans recorded yet."}
              </p>
              <div className="status-grid">
                <div>
                  <span>Repositories</span>
                  <strong>{workspace.run?.repoCount ?? 0}</strong>
                </div>
                <div>
                  <span>Issues</span>
                  <strong>{workspace.run?.issueCount ?? 0}</strong>
                </div>
                <div>
                  <span>Rate limit remaining</span>
                  <strong>{workspace.run?.rateLimit.remaining ?? "?"}</strong>
                </div>
                <div>
                  <span>Reset</span>
                  <strong>{formatResetTime(workspace.run?.rateLimit.reset ?? null)}</strong>
                </div>
              </div>

              <div className="query-block">
                <h3>Current repository query</h3>
                <code>{buildRepositoryQuery(profile).repositoryQuery}</code>
                <ul className="plain-list subdued-list">
                  {describeQuery(buildRepositoryQuery(profile)).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            </article>
          </section>
        ) : null}

        {currentView === "recommendations" ? (
          <RecommendationsPanel
            issues={workspace.issues}
            selectedIssueId={selectedIssue?.issueId ?? null}
            sortMode={sortMode}
            filterText={filterText}
            onSortChange={setSortMode}
            onFilterTextChange={setFilterText}
            onSelectIssue={(issue) => {
              setSelectedIssueId(issue.issueId);
              setCurrentView("issue");
            }}
          />
        ) : null}

        {currentView === "issue" ? (
          <section className="view-grid">
            <article className="panel">
              {selectedIssue ? (
                <>
                  <div className="panel-header">
                    <div>
                      <p className="eyebrow">Issue detail</p>
                      <h2>{selectedIssue.title}</h2>
                    </div>
                    <span className="score-pill">{selectedIssue.scoreBreakdown.total}</span>
                  </div>
                  <p className="issue-meta">
                    <a href={selectedIssue.htmlUrl} target="_blank" rel="noreferrer">
                      Open on GitHub
                    </a>
                    <span>{selectedIssue.repo.fullName}</span>
                    <span>#{selectedIssue.number}</span>
                  </p>
                  <p>{selectedIssue.bodyExcerpt}</p>

                  <div className="detail-grid">
                    <article>
                      <h3>Why it ranked well</h3>
                      <ul className="plain-list">
                        {selectedIssue.scoreBreakdown.reasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    </article>
                    <article>
                      <h3>Risk flags</h3>
                      <ul className="plain-list">
                        {selectedIssue.scoreBreakdown.riskFlags.length > 0 ? (
                          selectedIssue.scoreBreakdown.riskFlags.map((flag) => (
                            <li key={flag}>{flag}</li>
                          ))
                        ) : (
                          <li>No major risk flags were detected.</li>
                        )}
                      </ul>
                    </article>
                    <article>
                      <h3>Repository context</h3>
                      <ul className="plain-list">
                        {selectedIssue.repo.matchReasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    </article>
                    <article>
                      <h3>README excerpt</h3>
                      <p>{selectedIssue.repo.readmeExcerpt ?? "README summary unavailable."}</p>
                    </article>
                  </div>

                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => void handleGenerateDraft()}
                    disabled={Boolean(busyMessage)}
                  >
                    {busyMessage?.includes("Generating")
                      ? "Generating draft..."
                      : "Generate Draft PR workspace"}
                  </button>
                </>
              ) : (
                <div className="empty-state">
                  <h2>No issue selected yet</h2>
                  <p>Run a scan and pick an issue from the recommendations list.</p>
                </div>
              )}
            </article>
          </section>
        ) : null}

        {currentView === "draft" ? <DraftWorkspace artifact={draftArtifact} /> : null}

        {currentView === "settings" ? (
          <section className="view-grid">
            <article className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">GitHub access</p>
                  <h2>Fine-grained PAT</h2>
                </div>
              </div>
              <p>
                Save a fine-grained Personal Access Token for read-only public repository
                search and issue discovery.
              </p>
              <label>
                <span>GitHub token</span>
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(event) => setTokenInput(event.target.value)}
                  placeholder="github_pat_..."
                />
              </label>
              <button
                className="primary-button"
                type="button"
                onClick={() => void handleSaveToken()}
                disabled={Boolean(busyMessage)}
              >
                Save GitHub token
              </button>
              <p className="subtle-line">
                Current session token: {githubTokenStatus.maskedToken ?? "Not connected"}
              </p>
            </article>

            <article className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">LLM relay</p>
                  <h2>OpenAI-compatible provider</h2>
                </div>
              </div>
              <div className="field-grid">
                <label>
                  <span>Base URL</span>
                  <input
                    value={llmConfigDraft.baseUrl}
                    onChange={(event) =>
                      setLlmConfigDraft((current) => ({
                        ...current,
                        baseUrl: event.target.value
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Model</span>
                  <input
                    value={llmConfigDraft.model}
                    onChange={(event) =>
                      setLlmConfigDraft((current) => ({
                        ...current,
                        model: event.target.value
                      }))
                    }
                  />
                </label>
                <label>
                  <span>API key</span>
                  <input
                    type="password"
                    value={llmConfigDraft.apiKey}
                    onChange={(event) =>
                      setLlmConfigDraft((current) => ({
                        ...current,
                        apiKey: event.target.value
                      }))
                    }
                    placeholder="sk-..."
                  />
                </label>
                <label>
                  <span>Organization (optional)</span>
                  <input
                    value={llmConfigDraft.organization ?? ""}
                    onChange={(event) =>
                      setLlmConfigDraft((current) => ({
                        ...current,
                        organization: event.target.value
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Project (optional)</span>
                  <input
                    value={llmConfigDraft.project ?? ""}
                    onChange={(event) =>
                      setLlmConfigDraft((current) => ({
                        ...current,
                        project: event.target.value
                      }))
                    }
                  />
                </label>
              </div>
              <button
                className="primary-button"
                type="button"
                onClick={() => void handleSaveLlmConfig()}
                disabled={Boolean(busyMessage)}
              >
                Save relay config
              </button>
              <p className="subtle-line">
                Active relay: {llmStatus.configured ? `${llmStatus.model} via ${llmStatus.baseUrl}` : "Template fallback only"}
              </p>
            </article>

            <article className="panel panel-full">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Contributor profile</p>
                  <h2>Issue fit preferences</h2>
                </div>
              </div>
              <ProfileForm value={profile} onSave={handleSaveProfile} busy={Boolean(busyMessage)} />
            </article>
          </section>
        ) : null}

        {bootstrapping ? <div className="toast">Bootstrapping local workspace...</div> : null}
      </main>
    </div>
  );
}

