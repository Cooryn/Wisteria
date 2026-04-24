import { Octokit } from '@octokit/rest';
import type { Repo, Issue, GitHubUser } from '../types';

let octokitInstance: Octokit | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function initOctokit(token: string): Octokit {
  octokitInstance = new Octokit({ auth: token });
  return octokitInstance;
}

function getOctokit(): Octokit {
  if (!octokitInstance) {
    // Create unauthenticated instance for public searches
    octokitInstance = new Octokit();
  }
  return octokitInstance;
}

// ---- Authenticated User ----
export async function getAuthenticatedUser(): Promise<GitHubUser> {
  const ok = getOctokit();
  const { data } = await ok.rest.users.getAuthenticated();
  return {
    login: data.login,
    avatar_url: data.avatar_url,
    name: data.name ?? null,
    bio: data.bio ?? null,
    public_repos: data.public_repos,
    followers: data.followers,
    html_url: data.html_url,
  };
}

// ---- Search Repositories ----
export async function searchRepositories(
  query: string,
  options?: {
    language?: string;
    sort?: 'stars' | 'forks' | 'updated';
    order?: 'asc' | 'desc';
    perPage?: number;
    page?: number;
  }
): Promise<{ items: Repo[]; total_count: number }> {
  const ok = getOctokit();
  const { data } = await ok.rest.search.repos({
    q: query,
    sort: options?.sort ?? 'stars',
    order: options?.order ?? 'desc',
    per_page: options?.perPage ?? 30,
    page: options?.page ?? 1,
  });

  const items: Repo[] = data.items.map((item) => ({
    id: item.id,
    full_name: item.full_name,
    name: item.name,
    owner: {
      login: item.owner?.login ?? '',
      avatar_url: item.owner?.avatar_url ?? '',
    },
    description: item.description ?? null,
    language: item.language ?? null,
    stargazers_count: item.stargazers_count ?? 0,
    forks_count: item.forks_count ?? 0,
    open_issues_count: item.open_issues_count ?? 0,
    topics: item.topics ?? [],
    html_url: item.html_url,
    updated_at: item.updated_at ?? '',
    created_at: item.created_at ?? '',
    license: item.license ? { spdx_id: item.license.spdx_id ?? '', name: item.license.name ?? '' } : null,
  }));

  return { items, total_count: data.total_count };
}

// ---- Build search query from preferences ----
export function buildSearchQuery(params: {
  languages: string[];
  topics: string[];
  minStars?: number;
  maxStars?: number;
  labels?: string[];
}): string {
  const parts: string[] = [];

  // Language filter
  if (params.languages.length > 0) {
    parts.push(params.languages.map((l) => `language:${l}`).join(' '));
  }

  // Topics
  if (params.topics.length > 0) {
    parts.push(params.topics.map((t) => `topic:${t}`).join(' '));
  }

  // Stars range
  if (params.minStars !== undefined || params.maxStars !== undefined) {
    const min = params.minStars ?? 0;
    const max = params.maxStars ?? '*';
    parts.push(`stars:${min}..${max}`);
  }

  // Only repos with open issues
  parts.push('has:issues');

  // Archived exclusion
  parts.push('archived:false');

  return parts.join(' ');
}

// ---- Search Issues ----
export async function searchIssues(
  repoFullName: string,
  options?: {
    labels?: string[];
    state?: 'open' | 'closed';
    sort?: 'created' | 'updated' | 'comments';
    perPage?: number;
    page?: number;
  }
): Promise<Issue[]> {
  const ok = getOctokit();
  const [owner, repo] = repoFullName.split('/');

  const { data } = await ok.rest.issues.listForRepo({
    owner,
    repo,
    state: options?.state ?? 'open',
    labels: options?.labels?.join(','),
    sort: options?.sort ?? 'updated',
    direction: 'desc',
    per_page: options?.perPage ?? 30,
    page: options?.page ?? 1,
  });

  return data
    .filter((item) => !item.pull_request) // Exclude PRs
    .map((item) => ({
      id: item.id,
      number: item.number,
      title: item.title,
      body: item.body ?? null,
      state: item.state ?? 'open',
      labels: (item.labels ?? [])
        .filter((l): l is { id?: number; name?: string; color?: string; description?: string | null } =>
          typeof l === 'object'
        )
        .map((l) => ({
          id: l.id ?? 0,
          name: l.name ?? '',
          color: l.color ?? '000000',
          description: l.description ?? null,
        })),
      html_url: item.html_url,
      created_at: item.created_at,
      updated_at: item.updated_at ?? item.created_at,
      comments: item.comments ?? 0,
      user: {
        login: item.user?.login ?? '',
        avatar_url: item.user?.avatar_url ?? '',
      },
      repo_full_name: repoFullName,
    }));
}

// ---- Get single issue ----
// ---- Fork a repository ----
async function forkRepository(
  owner: string,
  repo: string
): Promise<{ full_name: string; html_url: string }> {
  const ok = getOctokit();
  const { data } = await ok.rest.repos.createFork({ owner, repo });
  return {
    full_name: data.full_name,
    html_url: data.html_url,
  };
}

export async function ensureForkExists(
  owner: string,
  repo: string
): Promise<{ owner_login: string; full_name: string; html_url: string }> {
  const ok = getOctokit();
  const currentUser = await getAuthenticatedUser();

  try {
    const { data } = await ok.rest.repos.get({
      owner: currentUser.login,
      repo,
    });

    return {
      owner_login: currentUser.login,
      full_name: data.full_name,
      html_url: data.html_url,
    };
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status !== 404) {
      throw err;
    }
  }

  const fork = await forkRepository(owner, repo);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await ok.rest.repos.get({
        owner: currentUser.login,
        repo,
      });
      break;
    } catch {
      await sleep(1500);
    }
  }

  return {
    owner_login: currentUser.login,
    full_name: fork.full_name,
    html_url: fork.html_url,
  };
}

// ---- Create Draft PR ----
export async function createDraftPR(params: {
  owner: string;
  repo: string;
  title: string;
  body: string;
  head: string; // "username:branch-name"
  base: string; // e.g. "main"
}): Promise<{ html_url: string; number: number }> {
  const ok = getOctokit();
  const { data } = await ok.rest.pulls.create({
    owner: params.owner,
    repo: params.repo,
    title: params.title,
    body: params.body,
    head: params.head,
    base: params.base,
    draft: true,
  });
  return {
    html_url: data.html_url,
    number: data.number,
  };
}

export async function findOpenPullRequestByHead(params: {
  owner: string;
  repo: string;
  head: string;
}): Promise<{ html_url: string; number: number } | null> {
  const ok = getOctokit();
  const { data } = await ok.rest.pulls.list({
    owner: params.owner,
    repo: params.repo,
    state: 'open',
    head: params.head,
    per_page: 1,
  });

  const existing = data[0];
  if (!existing) {
    return null;
  }

  return {
    html_url: existing.html_url,
    number: existing.number,
  };
}

// ---- Get repo default branch ----
export async function getRepoDefaultBranch(
  owner: string,
  repo: string
): Promise<string> {
  const ok = getOctokit();
  const { data } = await ok.rest.repos.get({ owner, repo });
  return data.default_branch;
}

// ---- Validate token ----
export async function validateToken(token: string): Promise<GitHubUser | null> {
  try {
    const ok = new Octokit({ auth: token });
    const { data } = await ok.rest.users.getAuthenticated();
    return {
      login: data.login,
      avatar_url: data.avatar_url,
      name: data.name ?? null,
      bio: data.bio ?? null,
      public_repos: data.public_repos,
      followers: data.followers,
      html_url: data.html_url,
    };
  } catch {
    return null;
  }
}
