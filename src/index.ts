interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Datamuse MCP — word-relation lookup
 *
 * Auth: none. ~100k req/day/IP cap.
 * Docs: https://www.datamuse.com/api/
 */


const BASE = 'https://api.datamuse.com';

const tools: McpToolExport['tools'] = [
  {
    name: 'words',
    description:
      'Generic words query. Combine constraints — most callers want one of the named helper tools instead.',
    inputSchema: {
      type: 'object',
      properties: {
        means_like: { type: 'string', description: 'Semantic similar (ml=)' },
        sounds_like: { type: 'string', description: 'Phonetic similar (sl=)' },
        spelled_like: { type: 'string', description: 'Spelling pattern with ? and * wildcards (sp=)' },
        follows: { type: 'string', description: 'Word that usually follows (lc=)' },
        precedes: { type: 'string', description: 'Word that usually precedes (rc=)' },
        related: { type: 'string', description: 'Related code: jja jjb syn ant trg ant spc gen com par bga bgb hom cns' },
        topics: { type: 'string', description: 'Comma-sep topic words to bias results' },
        max: { type: 'number', description: '1-1000 (default 100)' },
      },
    },
  },
  {
    name: 'means_like',
    description: 'Synonyms / semantic relatives.',
    inputSchema: {
      type: 'object',
      properties: { word: { type: 'string' }, max: { type: 'number' } },
      required: ['word'],
    },
  },
  {
    name: 'rhymes',
    description: 'Perfect or approximate rhymes.',
    inputSchema: {
      type: 'object',
      properties: {
        word: { type: 'string' },
        perfect: { type: 'boolean', description: 'true (default) = perfect rhyme, false = approximate' },
        max: { type: 'number' },
      },
      required: ['word'],
    },
  },
  {
    name: 'sounds_like',
    description: 'Phonetic neighbors.',
    inputSchema: {
      type: 'object',
      properties: { word: { type: 'string' }, max: { type: 'number' } },
      required: ['word'],
    },
  },
  {
    name: 'spelled_like',
    description: 'Wildcard-pattern matches (? = any letter, * = any sequence).',
    inputSchema: {
      type: 'object',
      properties: { pattern: { type: 'string' }, max: { type: 'number' } },
      required: ['pattern'],
    },
  },
  {
    name: 'predicts_next',
    description: 'Autocomplete prediction. Pass the word that comes BEFORE as `after`.',
    inputSchema: {
      type: 'object',
      properties: {
        after: { type: 'string', description: 'Prefix word (Datamuse param: lc)' },
        before: { type: 'string', description: 'Word that should come right after the suggestion (rc)' },
        max: { type: 'number' },
      },
      required: ['after'],
    },
  },
  {
    name: 'homophones',
    description: 'Same pronunciation, different spelling.',
    inputSchema: {
      type: 'object',
      properties: { word: { type: 'string' }, max: { type: 'number' } },
      required: ['word'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'words': {
      const p = new URLSearchParams();
      if (args.means_like) p.set('ml', String(args.means_like));
      if (args.sounds_like) p.set('sl', String(args.sounds_like));
      if (args.spelled_like) p.set('sp', String(args.spelled_like));
      if (args.follows) p.set('lc', String(args.follows));
      if (args.precedes) p.set('rc', String(args.precedes));
      if (args.related) p.set(`rel_${args.related}`, '');
      if (args.topics) p.set('topics', String(args.topics));
      p.set('max', String(Math.min(1000, Math.max(1, (args.max as number) ?? 100))));
      return dmGet(p);
    }
    case 'means_like':
      return dmGet(new URLSearchParams({ ml: reqStr(args, 'word', '"happy"'), max: String((args.max as number) ?? 25) }));
    case 'rhymes': {
      const code = args.perfect === false ? 'rel_nry' : 'rel_rhy';
      return dmGet(new URLSearchParams({ [code]: reqStr(args, 'word', '"orange"'), max: String((args.max as number) ?? 25) }));
    }
    case 'sounds_like':
      return dmGet(new URLSearchParams({ sl: reqStr(args, 'word', '"caffeine"'), max: String((args.max as number) ?? 25) }));
    case 'spelled_like':
      return dmGet(new URLSearchParams({ sp: reqStr(args, 'pattern', '"t??t"'), max: String((args.max as number) ?? 25) }));
    case 'predicts_next': {
      const p = new URLSearchParams({ lc: reqStr(args, 'after', '"the"'), max: String((args.max as number) ?? 25) });
      if (args.before) p.set('rc', String(args.before));
      return dmGet(p);
    }
    case 'homophones':
      return dmGet(new URLSearchParams({ rel_hom: reqStr(args, 'word', '"right"'), max: String((args.max as number) ?? 25) }));
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function dmGet(params: URLSearchParams) {
  const url = `${BASE}/words?${params}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'pipeworx-mcp-datamuse/1.0 (+https://pipeworx.io)',
    },
  });
  if (res.status === 429) throw new Error('Datamuse: rate-limit (HTTP 429)');
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Datamuse error: ${res.status} ${t.slice(0, 200)}`);
  }
  return res.json();
}

function reqStr(args: Record<string, unknown>, key: string, example: string): string {
  const v = args[key];
  if (typeof v !== 'string' || !v.trim()) {
    throw new Error(`Required argument "${key}" is missing. Pass a string like ${example}.`);
  }
  return v;
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
