// Blad HTTP z API — niesie status odpowiedzi (Error pozostaje nadklasa).
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Jedyny punkt fetchowania API z rzucaniem bledow: !res.ok → ApiError z trescia
// {error} z serwera gdy dostepna, inaczej "HTTP <status>".
export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let detail = '';
    try {
      const body: unknown = await res.json();
      if (typeof body === 'object' && body !== null && 'error' in body && typeof (body as { error: unknown }).error === 'string') {
        detail = (body as { error: string }).error;
      }
    } catch {
      // body nie-JSON — zostaje sam status
    }
    throw new ApiError(detail || `HTTP ${res.status}`, res.status);
  }
  return (await res.json()) as T;
}
