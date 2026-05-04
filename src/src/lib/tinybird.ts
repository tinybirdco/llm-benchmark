const TB_HOST = process.env.TINYBIRD_API_HOST!;
const TB_TOKEN = process.env.TINYBIRD_WORKSPACE_TOKEN!;

export async function queryTinybird<T = Record<string, unknown>>(
  endpoint: string,
  params?: Record<string, string>
): Promise<T[]> {
  const url = new URL(`/v0/pipes/${endpoint}.json`, TB_HOST);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${TB_TOKEN}` },
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    console.error(`Tinybird query failed (${res.status}): ${await res.text()}`);
    return [] as T[];
  }

  const json = await res.json();
  return json.data as T[];
}
