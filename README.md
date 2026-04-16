# WikiCheck Frontend

Next.js frontend for WikiCheck, a tool that searches Wikipedia articles, extracts citations, and verifies citation support using Gemini plus a local MarkItDown conversion service.

## Requirements

- Node.js 20+
- npm
- The Python service in `../python-service` running locally for source conversion

## Environment Variables

Create `.env.local` from `.env.example` and fill in your values.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | Yes | none | Gemini API key used by the verification route |
| `MARKITDOWN_SERVICE_URL` | No | `http://localhost:5000` | URL of the local Python conversion service |

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Verification Before Push

```bash
npm run lint
npm run build
```

## Notes

- `.env.local` is ignored and should not be committed.
- `.env.example` is committed as the public template for required configuration.
