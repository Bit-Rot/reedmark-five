/** Minimal GitHub REST client (browser or node) for reading files and committing several files atomically. */

export interface RepoRef { owner: string; repo: string; branch: string }
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export class GitHubError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
  /** The ref update was rejected because the branch moved since we read it. */
  get isStale(): boolean { return this.status === 422 || this.status === 409; }
  get isAuth(): boolean { return this.status === 401 || this.status === 403 || this.status === 404; }
}

export interface Head { commit: string; tree: string }

export interface FileWrite {
  path: string;
  /** UTF-8 text, or base64 for binary files. */
  content: string;
  encoding: 'utf-8' | 'base64';
}

export class GitHubClient {
  repo: RepoRef;
  token: string;
  private fetchFn: FetchLike;

  constructor(repo: RepoRef, token = '', fetchFn?: FetchLike) {
    this.repo = repo;
    this.token = token;
    this.fetchFn = fetchFn ?? ((url, init) => fetch(url, init));
  }

  private base(): string {
    return `https://api.github.com/repos/${this.repo.owner}/${this.repo.repo}`;
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    const h: Record<string, string> = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...extra };
    if (this.token) h.Authorization = `Bearer ${this.token}`;
    return h;
  }

  private async request(path: string, init: RequestInit = {}, accept?: string): Promise<Response> {
    const res = await this.fetchFn(this.base() + path, {
      ...init,
      headers: this.headers({ ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(accept ? { Accept: accept } : {}) }),
    });
    return res;
  }

  private async json<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await this.request(path, init);
    if (!res.ok) throw new GitHubError(res.status, await errorMessage(res));
    return (await res.json()) as T;
  }

  async getHead(): Promise<Head> {
    const ref = await this.json<{ object: { sha: string } }>(`/git/ref/heads/${this.repo.branch}`);
    const commit = await this.json<{ tree: { sha: string } }>(`/git/commits/${ref.object.sha}`);
    return { commit: ref.object.sha, tree: commit.tree.sha };
  }

  /** Read a text file at a commit; undefined if it does not exist. */
  async readText(path: string, commit: string): Promise<string | undefined> {
    const res = await this.request(`/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${commit}`, {}, 'application/vnd.github.raw+json');
    if (res.status === 404) return undefined;
    if (!res.ok) throw new GitHubError(res.status, await errorMessage(res));
    return await res.text();
  }

  /** Create one commit containing all `files` on top of `parent` and move the branch to it. */
  async commitFiles(parent: Head, files: FileWrite[], message: string): Promise<Head> {
    const entries: { path: string; mode: string; type: string; sha: string }[] = [];
    for (const f of files) {
      const blob = await this.json<{ sha: string }>('/git/blobs', {
        method: 'POST', body: JSON.stringify({ content: f.content, encoding: f.encoding }),
      });
      entries.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
    }
    const tree = await this.json<{ sha: string }>('/git/trees', {
      method: 'POST', body: JSON.stringify({ base_tree: parent.tree, tree: entries }),
    });
    const commit = await this.json<{ sha: string }>('/git/commits', {
      method: 'POST', body: JSON.stringify({ message, tree: tree.sha, parents: [parent.commit] }),
    });
    await this.json(`/git/refs/heads/${this.repo.branch}`, {
      method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }),
    });
    return { commit: commit.sha, tree: tree.sha };
  }
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string };
    return body.message ?? `${res.status} ${res.statusText}`;
  } catch {
    return `${res.status} ${res.statusText}`;
  }
}

/** Work out which repository the editor belongs to from the page URL (`https://owner.github.io/repo/editor/`). */
export function repoFromLocation(loc: { hostname: string; pathname: string }, fallback: RepoRef): RepoRef {
  const m = /^([^.]+)\.github\.io$/i.exec(loc.hostname);
  const seg = loc.pathname.split('/').filter(Boolean)[0];
  if (m && seg && seg.toLowerCase() !== 'editor') return { owner: m[1], repo: seg, branch: fallback.branch };
  return fallback;
}
