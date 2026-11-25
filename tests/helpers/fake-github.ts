import type { FetchLike } from '../../src/data/github.ts';

/** In-memory stand-in for the parts of the GitHub REST API the editor uses. */
export class FakeGitHub {
  blobs = new Map<string, { content: string; encoding: string }>();
  trees = new Map<string, Map<string, string>>();
  commits = new Map<string, { tree: string; parents: string[]; message: string }>();
  head = '';
  n = 0;
  calls: string[] = [];
  /** Run once just before the next ref update, to simulate someone else pushing. */
  beforeRefUpdate?: () => void;

  constructor(files: Record<string, string>) {
    const tree = new Map<string, string>();
    for (const [p, c] of Object.entries(files)) tree.set(p, this.addBlob(c, 'utf-8'));
    this.head = this.addCommit(this.addTree(tree), [], 'init');
  }
  sha(prefix: string) { return `${prefix}${++this.n}`; }
  addBlob(content: string, encoding: string) { const s = this.sha('b'); this.blobs.set(s, { content, encoding }); return s; }
  addTree(t: Map<string, string>) { const s = this.sha('t'); this.trees.set(s, t); return s; }
  addCommit(tree: string, parents: string[], message: string) { const s = this.sha('c'); this.commits.set(s, { tree, parents, message }); return s; }
  /** Push a commit straight to the fake remote, bypassing the client. */
  push(files: Record<string, string>, message = 'other') {
    const tree = new Map(this.trees.get(this.commits.get(this.head)!.tree)!);
    for (const [p, c] of Object.entries(files)) tree.set(p, this.addBlob(c, 'utf-8'));
    this.head = this.addCommit(this.addTree(tree), [this.head], message);
  }
  file(path: string, commit = this.head): string | undefined {
    const sha = this.trees.get(this.commits.get(commit)!.tree)!.get(path);
    return sha ? this.blobs.get(sha)!.content : undefined;
  }
  fetch: FetchLike = async (url, init) => {
    const path = url.replace('https://api.github.com/repos/o/r', '');
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    this.calls.push(`${method} ${path.split('?')[0]}`);
    const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status });
    let m: RegExpExecArray | null;
    if ((m = /^\/git\/ref\/heads\/main$/.exec(path))) return json({ object: { sha: this.head } });
    if ((m = /^\/git\/commits\/(\w+)$/.exec(path)) && method === 'GET') return json({ tree: { sha: this.commits.get(m[1])!.tree } });
    if ((m = /^\/contents\/(.+)\?ref=(\w+)$/.exec(path))) {
      const c = this.file(decodeURIComponent(m[1]).replace(/%2F/g, '/'), m[2]);
      return c === undefined ? json({ message: 'Not Found' }, 404) : new Response(c, { status: 200 });
    }
    if (path === '/git/blobs') return json({ sha: this.addBlob(body.content, body.encoding) });
    if (path === '/git/trees') {
      const t = new Map(this.trees.get(body.base_tree)!);
      for (const e of body.tree) t.set(e.path, e.sha);
      return json({ sha: this.addTree(t) });
    }
    if (path === '/git/commits') return json({ sha: this.addCommit(body.tree, body.parents, body.message) });
    if ((m = /^\/git\/refs\/heads\/main$/.exec(path)) && method === 'PATCH') {
      this.beforeRefUpdate?.();
      this.beforeRefUpdate = undefined;
      if (this.commits.get(body.sha)!.parents[0] !== this.head) return json({ message: 'Update is not a fast forward' }, 422);
      this.head = body.sha;
      return json({ ok: true });
    }
    return json({ message: `unhandled ${method} ${path}` }, 500);
  };
}
