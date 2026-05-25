import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { loadEnriched } from '$lib/server/data.js';
import { suggestRows } from '$lib/server/suggest.js';

export const GET: RequestHandler = async ({ url }) => {
  const cap = Number.parseInt(url.searchParams.get('cap') ?? '500', 10);
  const enriched = await loadEnriched();
  const suggestions = suggestRows(enriched.value, Number.isFinite(cap) ? cap : 500);
  return json({ count: suggestions.length, suggestions });
};
