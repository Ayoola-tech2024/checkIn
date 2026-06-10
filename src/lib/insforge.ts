// ============================================================
// checkIn - InsForge Database Client (PostgREST API)
// ============================================================

const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL || 'https://9djdhppd.us-east.insforge.app';
const INSFORGE_API_KEY = process.env.INSFORGE_API_KEY || 'ik_39c8cf61aaa8029228324329603f0f49';

// PostgREST-compatible fetch wrapper for InsForge
class InsForgeClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  from(table: string) {
    return new InsForgeQueryBuilder(this.baseUrl, this.apiKey, table);
  }
}

class InsForgeQueryBuilder {
  private baseUrl: string;
  private apiKey: string;
  private table: string;
  private queryParts: string[] = [];
  private orderField?: string;
  private orderAsc: boolean = true;
  private limitCount?: number;
  private offsetCount?: number;

  constructor(baseUrl: string, apiKey: string, table: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.table = table;
  }

  select(columns?: string) {
    if (columns) {
      this.queryParts.push(`select=${columns}`);
    } else {
      this.queryParts.push('select=*');
    }
    return this;
  }

  insert(data: Record<string, unknown> | Record<string, unknown>[]) {
    return new InsForgeMutationBuilder(
      this.baseUrl, this.apiKey, this.table, 'INSERT', Array.isArray(data) ? data : [data]
    );
  }

  update(data: Record<string, unknown>) {
    return new InsForgeMutationBuilder(
      this.baseUrl, this.apiKey, this.table, 'PATCH', [data], this.queryParts
    );
  }

  delete() {
    return new InsForgeMutationBuilder(
      this.baseUrl, this.apiKey, this.table, 'DELETE', [], this.queryParts
    );
  }

  upsert(data: Record<string, unknown> | Record<string, unknown>[]) {
    return new InsForgeMutationBuilder(
      this.baseUrl, this.apiKey, this.table, 'UPSERT', Array.isArray(data) ? data : [data]
    );
  }

  eq(column: string, value: unknown) {
    if (value === null || value === undefined) {
      this.queryParts.push(`${column}=is.null`);
    } else if (typeof value === 'string') {
      this.queryParts.push(`${column}=eq.${encodeURIComponent(value)}`);
    } else if (typeof value === 'boolean') {
      this.queryParts.push(`${column}=is.${value}`);
    } else {
      this.queryParts.push(`${column}=eq.${value}`);
    }
    return this;
  }

  neq(column: string, value: unknown) {
    if (typeof value === 'string') {
      this.queryParts.push(`${column}=neq.${encodeURIComponent(value)}`);
    } else {
      this.queryParts.push(`${column}=neq.${value}`);
    }
    return this;
  }

  gt(column: string, value: unknown) {
    this.queryParts.push(`${column}=gt.${value}`);
    return this;
  }

  gte(column: string, value: unknown) {
    this.queryParts.push(`${column}=gte.${value}`);
    return this;
  }

  lt(column: string, value: unknown) {
    this.queryParts.push(`${column}=lt.${value}`);
    return this;
  }

  lte(column: string, value: unknown) {
    this.queryParts.push(`${column}=lte.${value}`);
    return this;
  }

  is(column: string, value: null | boolean) {
    if (value === null) {
      this.queryParts.push(`${column}=is.null`);
    } else {
      this.queryParts.push(`${column}=is.${value}`);
    }
    return this;
  }

  in(column: string, values: unknown[]) {
    const vals = values.map(v => typeof v === 'string' ? encodeURIComponent(v) : v).join(',');
    this.queryParts.push(`${column}=in.(${vals})`);
    return this;
  }

  or(conditions: string) {
    this.queryParts.push(`or=(${conditions})`);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderField = column;
    this.orderAsc = options?.ascending !== false;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  offset(count: number) {
    this.offsetCount = count;
    return this;
  }

  single() {
    this.limitCount = 1;
    return this;
  }

  maybeSingle() {
    this.limitCount = 1;
    return this;
  }

  private getHeaders(): Record<string, string> {
    return {
      'apikey': this.apiKey,
      'Authorization': `Bearer ${this.apiKey}`,
    };
  }

  private buildUrl(): string {
    let url = `${this.baseUrl}/api/database/records/${this.table}`;
    const params = [...this.queryParts];
    if (this.orderField) {
      params.push(`order=${this.orderField}.${this.orderAsc ? 'asc' : 'desc'}`);
    }
    if (this.limitCount !== undefined) {
      params.push(`limit=${this.limitCount}`);
    }
    if (this.offsetCount !== undefined) {
      params.push(`offset=${this.offsetCount}`);
    }
    if (params.length > 0) {
      url += '?' + params.join('&');
    }
    return url;
  }

  // Make the query builder thenable (like a Promise)
  then(resolve: (result: { data: unknown[] | null; error: Error | null; count?: number }) => void) {
    this.execute().then(resolve);
  }

  catch(reject: (err: Error) => void) {
    this.execute().then((result) => {
      if (result.error) {
        reject(result.error);
      }
    });
  }

  private async execute(): Promise<{ data: unknown[] | null; error: Error | null; count?: number }> {
    try {
      const url = this.buildUrl();
      const res = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!res.ok) {
        const text = await res.text();
        return { data: null, error: new Error(`InsForge query error: ${res.status} ${text}`) };
      }

      const data = await res.json();
      const arr = Array.isArray(data) ? data : [data];
      return { data: arr, error: null, count: arr.length };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }
}

class InsForgeMutationBuilder {
  private baseUrl: string;
  private apiKey: string;
  private table: string;
  private method: 'INSERT' | 'PATCH' | 'DELETE' | 'UPSERT';
  private data: Record<string, unknown>[];
  private filterParts: string[];

  constructor(
    baseUrl: string, apiKey: string, table: string,
    method: 'INSERT' | 'PATCH' | 'DELETE' | 'UPSERT',
    data: Record<string, unknown>[], filterParts: string[] = []
  ) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.table = table;
    this.method = method;
    this.data = data;
    this.filterParts = filterParts;
  }

  eq(column: string, value: unknown) {
    if (value === null || value === undefined) {
      this.filterParts.push(`${column}=is.null`);
    } else if (typeof value === 'string') {
      this.filterParts.push(`${column}=eq.${encodeURIComponent(value)}`);
    } else {
      this.filterParts.push(`${column}=eq.${value}`);
    }
    return this;
  }

  neq(column: string, value: unknown) {
    if (typeof value === 'string') {
      this.filterParts.push(`${column}=neq.${encodeURIComponent(value)}`);
    } else {
      this.filterParts.push(`${column}=neq.${value}`);
    }
    return this;
  }

  in(column: string, values: unknown[]) {
    const vals = values.map(v => typeof v === 'string' ? encodeURIComponent(v) : v).join(',');
    this.filterParts.push(`${column}=in.(${vals})`);
    return this;
  }

  select(_columns?: string) {
    // For PostgREST, we request return=representation in headers
    return this;
  }

  private getHeaders(isUpsert: boolean): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': this.apiKey,
      'Authorization': `Bearer ${this.apiKey}`,
      'Prefer': isUpsert ? 'resolution=merge-duplicates,return=representation' : 'return=representation',
    };
    return headers;
  }

  then(resolve: (result: { data: unknown[] | null; error: Error | null }) => void) {
    this.execute().then(resolve);
  }

  catch(reject: (err: Error) => void) {
    this.execute().then((result) => {
      if (result.error) {
        reject(result.error);
      }
    });
  }

  private async execute(): Promise<{ data: unknown[] | null; error: Error | null }> {
    try {
      let url = `${this.baseUrl}/api/database/records/${this.table}`;
      const isUpsert = this.method === 'UPSERT';

      let method: string;
      let body: string | undefined;

      switch (this.method) {
        case 'INSERT':
          method = 'POST';
          body = JSON.stringify(this.data.length === 1 ? this.data[0] : this.data);
          break;
        case 'PATCH':
          method = 'PATCH';
          body = JSON.stringify(this.data[0]);
          if (this.filterParts.length > 0) {
            url += '?' + this.filterParts.join('&');
          }
          break;
        case 'DELETE':
          method = 'DELETE';
          if (this.filterParts.length > 0) {
            url += '?' + this.filterParts.join('&');
          }
          break;
        case 'UPSERT':
          method = 'POST';
          body = JSON.stringify(this.data.length === 1 ? this.data[0] : this.data);
          break;
        default:
          method = 'POST';
          body = JSON.stringify(this.data);
      }

      const res = await fetch(url, {
        method,
        headers: this.getHeaders(isUpsert),
        body,
      });

      if (!res.ok) {
        const text = await res.text();
        // Check for unique constraint violation
        if (res.status === 409 || text.includes('duplicate') || text.includes('unique') || text.includes('violates unique constraint')) {
          return { data: null, error: new Error('DUPLICATE') };
        }
        return { data: null, error: new Error(`InsForge mutation error: ${res.status} ${text}`) };
      }

      // Some mutations return empty body
      const contentType = res.headers.get('content-type');
      if (contentType?.includes('json')) {
        const data = await res.json();
        return { data: Array.isArray(data) ? data : data ? [data] : [], error: null };
      }
      return { data: [], error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }
}

// Export singleton client
export const insforge = new InsForgeClient(INSFORGE_URL, INSFORGE_API_KEY);
export const db = insforge;
