# mcp-datamuse

Datamuse MCP — word-relation lookup

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 673+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `means_like` | Synonyms / semantic relatives. |
| `rhymes` | Perfect or approximate rhymes. |
| `sounds_like` | Phonetic neighbors. |
| `spelled_like` | Wildcard-pattern matches (? = any letter, * = any sequence). |
| `predicts_next` | Autocomplete prediction. Pass the word that comes BEFORE as `after`. |
| `homophones` | Same pronunciation, different spelling. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "datamuse": {
      "url": "https://gateway.pipeworx.io/datamuse/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 673+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Datamuse data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [All tools and guides](https://github.com/pipeworx-io/examples)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
