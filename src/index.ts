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
 * Datamuse MCP — word-finding engine (keyless).
 *
 * Datamuse is a word-finding query engine: given a set of constraints it
 * returns words that match. Useful for writing, naming, crosswords, poetry,
 * and NLP. Supports rhymes, near-rhymes, synonyms, antonyms, "means-like"
 * (similar meaning), "sounds-like" (phonetic), "spelled-like" (wildcard
 * pattern), word-association ("triggers"), adjectives-for-a-noun /
 * nouns-for-an-adjective, plus prefix autocomplete suggestions.
 *
 * Auth: none. Fair-use cap ~100k req/day per IP.
 * Docs: https://www.datamuse.com/api/
 */


const BASE = 'https://api.datamuse.com';
const UA = 'pipeworx/1.0 (+https://pipeworx.io)';

const tools: McpToolExport['tools'] = [
  {
    name: 'find_words',
    description:
      'Find English words matching one or more constraints using the Datamuse word-finding engine. ' +
      'Combine any constraints below (at least one is required). Great for writing, naming, brainstorming, ' +
      'crosswords, poetry, and NLP. Constraints: means_like (words with a similar meaning / loose synonyms), ' +
      'rhymes_with (perfect rhymes), near_rhymes_with (approximate rhymes), synonyms_of (synonyms), ' +
      'antonyms_of (antonyms), associated_with (words statistically triggered/associated with the term), ' +
      'sounds_like (phonetically similar words), spelled_like (spelling pattern with wildcards: * = any ' +
      'sequence of letters, ? = exactly one letter, e.g. "t*k" or "t??t"), adjectives_for (adjectives that ' +
      'commonly describe the given noun), nouns_for (nouns commonly described by the given adjective). ' +
      'Optionally bias results toward comma-separated `topics`. Returns words ranked by relevance score.',
    inputSchema: {
      type: 'object',
      properties: {
        means_like: { type: 'string', description: 'Find words with a meaning similar to this (Datamuse ml=).' },
        rhymes_with: { type: 'string', description: 'Find perfect rhymes for this word (rel_rhy=).' },
        near_rhymes_with: { type: 'string', description: 'Find approximate / near rhymes for this word (rel_nry=).' },
        synonyms_of: { type: 'string', description: 'Find synonyms of this word (rel_syn=).' },
        antonyms_of: { type: 'string', description: 'Find antonyms of this word (rel_ant=).' },
        associated_with: { type: 'string', description: 'Find words statistically associated with / triggered by this word (rel_trg=).' },
        sounds_like: { type: 'string', description: 'Find words that sound like this (phonetic, sl=).' },
        spelled_like: { type: 'string', description: 'Spelling pattern; * = any sequence of letters, ? = exactly one letter (sp=), e.g. "t*k".' },
        adjectives_for: { type: 'string', description: 'Find adjectives that commonly describe this noun (rel_jjb=).' },
        nouns_for: { type: 'string', description: 'Find nouns commonly described by this adjective (rel_jja=).' },
        topics: { type: 'string', description: 'Comma-separated topic words to bias results toward (topics=).' },
        max: { type: 'number', description: 'Max results, 1-1000 (default 20).' },
      },
    },
  },
  {
    name: 'suggest',
    description:
      'Autocomplete suggestions for a partial word or phrase using the Datamuse engine. ' +
      'Given a prefix, returns likely completions ranked by relevance score — useful for ' +
      'search-as-you-type, naming, and crossword/word-game hints.',
    inputSchema: {
      type: 'object',
      properties: {
        prefix: { type: 'string', description: 'The partial word / phrase typed so far.' },
        max: { type: 'number', description: 'Max suggestions, 1-1000 (default 10).' },
      },
      required: ['prefix'],
    },
  },
];

const CONSTRAINTS: Array<[string, string]> = [
  ['means_like', 'ml'],
  ['rhymes_with', 'rel_rhy'],
  ['near_rhymes_with', 'rel_nry'],
  ['synonyms_of', 'rel_syn'],
  ['antonyms_of', 'rel_ant'],
  ['associated_with', 'rel_trg'],
  ['sounds_like', 'sl'],
  ['spelled_like', 'sp'],
  ['adjectives_for', 'rel_jjb'],
  ['nouns_for', 'rel_jja'],
  ['topics', 'topics'],
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    switch (name) {
      case 'find_words': {
        const params = new URLSearchParams();
        for (const [arg, param] of CONSTRAINTS) {
          const v = args[arg];
          if (typeof v === 'string' && v.trim()) params.set(param, v.trim());
        }
        if ([...params.keys()].length === 0) {
          return { error: 'provide at least one constraint (e.g. rhymes_with, means_like, synonyms_of)' };
        }
        params.set('max', String(clampMax(args.max, 20)));
        const data = await dmGet('/words', params);
        if (!Array.isArray(data)) return { error: 'unexpected response from Datamuse' };
        const words = data.map((w: Record<string, unknown>) => ({
          word: w.word,
          score: w.score,
          numSyllables: w.numSyllables,
        }));
        return { count: words.length, words };
      }
      case 'suggest': {
        const prefix = args.prefix;
        if (typeof prefix !== 'string' || !prefix.trim()) {
          return { error: 'prefix is required (the partial word typed so far)' };
        }
        const params = new URLSearchParams();
        params.set('s', prefix.trim());
        params.set('max', String(clampMax(args.max, 10)));
        const data = await dmGet('/sug', params);
        if (!Array.isArray(data)) return { error: 'unexpected response from Datamuse' };
        const suggestions = data.map((w: Record<string, unknown>) => ({ word: w.word, score: w.score }));
        return { count: suggestions.length, suggestions };
      }
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

function clampMax(v: unknown, fallback: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : fallback;
  return Math.min(1000, Math.max(1, n));
}

async function dmGet(path: string, params: URLSearchParams): Promise<unknown> {
  const res = await fetch(`${BASE}${path}?${params.toString()}`, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  if (res.status === 429) throw new Error('Datamuse: rate-limited (HTTP 429)');
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Datamuse: ${res.status} ${t.slice(0, 200)}`);
  }
  return res.json();
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
