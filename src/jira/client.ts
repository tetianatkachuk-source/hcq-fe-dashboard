import type { JiraAuth } from '../config.ts';

export interface JiraIssue {
  id: string;
  key: string;
  fields: Record<string, any>;
  changelog?: {
    histories: Array<{
      created: string;
      items: Array<{
        field: string;
        fromString: string | null;
        toString: string | null;
      }>;
    }>;
  };
}

// New Atlassian /search/jql endpoint uses cursor-based pagination.
// `total` is no longer returned; rely on `nextPageToken` / `isLast`.
export interface SearchResponse {
  issues: JiraIssue[];
  nextPageToken?: string;
  isLast?: boolean;
}

export class JiraClient {
  private authHeader: string;

  constructor(private auth: JiraAuth) {
    const creds = Buffer.from(`${auth.email}:${auth.token}`).toString('base64');
    this.authHeader = `Basic ${creds}`;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = `${this.auth.baseUrl}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: this.authHeader,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Jira ${res.status} ${res.statusText} for ${path}: ${body.slice(0, 500)}`);
    }
    return (await res.json()) as T;
  }

  // Paginated JQL search via the new /rest/api/3/search/jql endpoint
  // (the old /search was sunset in Apr 2025 — see CHANGE-2046). Cursor-based.
  async searchAll(
    jql: string,
    fields: readonly string[],
    options: { expand?: string[]; pageSize?: number } = {},
  ): Promise<JiraIssue[]> {
    const pageSize = options.pageSize ?? 100;
    const all: JiraIssue[] = [];
    let nextPageToken: string | undefined;
    // Hard cap to avoid infinite loops if Jira misbehaves.
    for (let i = 0; i < 200; i++) {
      const body: Record<string, unknown> = {
        jql,
        fields,
        maxResults: pageSize,
      };
      if (options.expand && options.expand.length) body.expand = options.expand.join(',');
      if (nextPageToken) body.nextPageToken = nextPageToken;
      const page = await this.request<SearchResponse>('/rest/api/3/search/jql', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      all.push(...page.issues);
      if (page.isLast || !page.nextPageToken || page.issues.length === 0) break;
      nextPageToken = page.nextPageToken;
    }
    return all;
  }

  async getIssue(key: string, opts: { fields?: readonly string[]; expand?: string[] } = {}): Promise<JiraIssue> {
    const params = new URLSearchParams();
    if (opts.fields) params.set('fields', opts.fields.join(','));
    if (opts.expand) params.set('expand', opts.expand.join(','));
    const qs = params.toString();
    return this.request<JiraIssue>(`/rest/api/3/issue/${encodeURIComponent(key)}${qs ? `?${qs}` : ''}`);
  }

  async getSprint(id: number): Promise<{
    id: number;
    name: string;
    state: string;
    startDate?: string;
    endDate?: string;
    goal?: string;
  }> {
    return this.request(`/rest/agile/1.0/sprint/${id}`);
  }
}
