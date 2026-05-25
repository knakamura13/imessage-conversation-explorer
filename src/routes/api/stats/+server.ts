import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { loadStats } from '$lib/server/data.js';

export const GET: RequestHandler = async () => {
  const stats = await loadStats();
  return json(stats.value);
};
