import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { loadTags, saveTags, type TagsMap } from '$lib/server/data.js';

export const GET: RequestHandler = async () => {
  const tags = await loadTags();
  return json(tags.value);
};

export const POST: RequestHandler = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw error(400, 'invalid JSON');
  }
  if (body == null || typeof body !== 'object') throw error(400, 'expected object body');
  const next = await saveTags(body as TagsMap);
  return json({ ok: true, count: Object.keys(next).length });
};
