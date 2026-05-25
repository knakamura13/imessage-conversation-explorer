import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { loadEnriched, loadTags } from '$lib/server/data.js';
import { applyFilter, parseQuery } from '$lib/server/filter.js';
import { makeEtag } from '$lib/server/etag.js';
import { DEFAULT_TAG_SCHEMA } from '$lib/tag-schema.js';
import type { EnrichedRow } from '$lib/types.js';

export const GET: RequestHandler = async ({ url, request }) => {
  const query = parseQuery(url);
  const [enriched, tags] = await Promise.all([loadEnriched(), loadTags()]);

  const etag = makeEtag(
    enriched.key,
    tags.key,
    query.offset,
    query.limit,
    query.q,
    query.regex ? 1 : 0,
    query.filter,
    query.sender
  );
  if (request.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers: { etag } });
  }

  const { total, page } = applyFilter(enriched.value, tags.value, query);
  const messages = page.map((row) => withTagMeta(row, tags.value));

  return json(
    {
      offset: query.offset,
      limit: query.limit,
      total,
      tag_schema: DEFAULT_TAG_SCHEMA,
      messages
    },
    {
      headers: {
        etag,
        'cache-control': 'private, max-age=0, must-revalidate'
      }
    }
  );
};

function withTagMeta(row: EnrichedRow, tags: Record<string, { tags: string[]; note: string }>) {
  const meta = tags[String(row.rowid)];
  return { ...row, tags: meta?.tags ?? [], note: meta?.note ?? '' };
}
