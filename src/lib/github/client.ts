// src/lib/github/client.ts
// Cliente tipado para GitHub API — usado por el tool-use loop de CLAUD.
// MC ya tiene src/lib/github.ts para sync bidireccional — este es independiente.
const GH_BASE = 'https://api.github.com'

export interface GHRepo { name: string; full_name: string; description: string | null; html_url: string; private: boolean }
export interface GHFile { content: string; encoding: string }
export interface GHCommit { sha: string; commit: { message: string; author: { date: string } } }
export interface GHPR { number: number; title: string; state: string; html_url: string; user: { login: string } }

export async function ghFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${GH_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
  })
  if (!res.ok) throw new Error(`GitHub API error ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

export async function githubListRepos(username: string): Promise<GHRepo[]> {
  return ghFetch<GHRepo[]>(`/users/${username}/repos?per_page=30&sort=updated`)
}

export async function githubReadFile(owner: string, repo: string, path: string): Promise<{ content: string }> {
  const data = await ghFetch<GHFile>(`/repos/${owner}/${repo}/contents/${path}`)
  return { content: Buffer.from(data.content, data.encoding as BufferEncoding).toString('utf-8') }
}

export async function githubListFiles(owner: string, repo: string, path: string): Promise<unknown> {
  return ghFetch(`/repos/${owner}/${repo}/contents/${path}`)
}

export async function githubListCommits(owner: string, repo: string, limit = 10): Promise<GHCommit[]> {
  return ghFetch<GHCommit[]>(`/repos/${owner}/${repo}/commits?per_page=${limit}`)
}

export async function githubListPRs(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open'): Promise<GHPR[]> {
  return ghFetch<GHPR[]>(`/repos/${owner}/${repo}/pulls?state=${state}&per_page=20`)
}
