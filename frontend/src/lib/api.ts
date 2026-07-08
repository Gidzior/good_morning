// Jedyny punkt fetchowania API z rzucaniem bledow: !res.ok → Error z trescia
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
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}
