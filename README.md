
<h1 align="center"> ClipWise Backend</h1>

<p align="center">
  <strong>Express · Prisma · TypeScript · OpenRouter AI</strong><br>
  RESTful API that turns YouTube videos into smart summaries.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white" alt="Node 20">
  <img src="https://img.shields.io/badge/Express-4-000?logo=express&logoColor=white" alt="Express 4">
  <img src="https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript&logoColor=white" alt="TS 5.3">
  <img src="https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white" alt="Prisma 6">
  <img src="https://img.shields.io/badge/Zod-3-3068B7?logo=zod&logoColor=white" alt="Zod 3">
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL">
</p>

---

## Table of Contents

- [Overview](#overview)
- [Built With](#built-with)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
  - [Run](#run)
- [API Reference](#api-reference)
  - [POST /api/v1/summarize](#post-apiv1summarize)
  - [GET /api/v1/summarize](#get-apiv1summarize)
  - [GET /api/v1/summarize/:id](#get-apiv1summarizeid)
  - [POST /api/v1/summarize/:id/generate](#post-apiv1summarizeidgenerate)
  - [DELETE /api/v1/summarize/:id](#delete-apiv1summarizeid)
- [AI Pipeline](#ai-pipeline)
- [Rate Limiting](#rate-limiting)
- [Error Handling](#error-handling)
- [Docker](#docker)
- [Scripts](#scripts)

---

## Overview

ClipWise Backend accepts a YouTube URL, fetches its transcript, and sends it to OpenRouter AI (free tier) to produce a structured summary. Results are persisted in PostgreSQL via Prisma, and users can lazily re-format summaries into different styles (bullet points, Q&A, etc.) without re-processing the video.

Key capabilities:

- **YouTube transcript extraction** via `youtube-transcript`
- **Video title resolution** via YouTube oEmbed
- **Sequential, rate-limited OpenRouter AI calls** (token-bucket, 18 req/min, 3 s min interval)
- **Lazy format generation** — generate bullet points, Q&A, tl;dr, etc. on demand without refetching the transcript
- **Structured error responses** with typed `AppError` classes
- **Zod-validated** request bodies, query params, and URL params

---

## Built With

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 |
| Framework | Express 4 |
| Language | TypeScript (strict) |
| ORM | Prisma 6 + PostgreSQL |
| Validation | Zod 3 |
| AI Provider | OpenRouter (`openrouter/free` router model) |
| Logging | Winston |
| Transcript | `youtube-transcript` npm package |
| Rate Limiting | `express-rate-limit` (HTTP) + custom token-bucket (AI) |
| Security | Helmet, CORS |

---

## Project Structure

```
src/
├── index.ts                      # Bootstrap — starts server
├── app.ts                        # Express app factory (middleware stack)
├── routes.ts                     # Central route registry
├── config/
│   └── env.config.ts             # Zod-validated env vars
├── features/
│   └── summarize/
│       ├── summarize.controller.ts   # Route handlers
│       ├── summarize.routes.ts       # Express Router with validation
│       ├── summarize.schema.ts       # Zod schemas (URL, format, pagination)
│       └── summarize.service.ts      # Business logic + AI calls
├── infrastructure/
│   ├── middleware/
│   │   ├── error.middleware.ts       # Global error handler + 404
│   │   └── validate.middleware.ts    # Zod validation middleware
│   └── utils/
│       ├── errors.util.ts            # AppError hierarchy
│       ├── response.util.ts          # Standardized JSON responses
│       ├── logger.util.ts            # Winston logger factory
│       └── rate-limiter.util.ts      # Token-bucket AI rate limiter
└── shared/
    └── prisma.ts                 # Prisma client singleton
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL running on `localhost:5432` (or a remote instance)
- OpenRouter API key from [openrouter.ai/keys](https://openrouter.ai/keys)

### Installation

```bash
cd clip-wise-backend
npm install
cp .env.example .env
```

Edit `.env` with your `OPENROUTER_API_KEY` and `DATABASE_URL`.

### Configuration

All environment variables are validated by Zod at startup. See `.env.example`:

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `OPENROUTER_API_KEY` | ✅ | — | API key from openrouter.ai |
| `CORS_ORIGIN` | ❌ | `http://localhost:3001` | Comma-separated allowed origins |
| `NODE_ENV` | ❌ | `development` | `development` / `production` / `test` |
| `PORT` | ❌ | `3000` | Server port |
| `API_PREFIX` | ❌ | `/api/v1` | API route prefix |
| `LOG_LEVEL` | ❌ | `info` | `error` / `warn` / `info` / `debug` |
| `OPENROUTER_MODEL` | ❌ | `openrouter/free` | OpenRouter model identifier |

### Run

```bash
npx prisma migrate dev
npm run dev          # → http://localhost:3000
```

---

## API Reference

All responses follow a uniform envelope:

```json
{
  "success": true,
  "message": "...",
  "data": { ... }
}
```

### `POST /api/v1/summarize`

Submit a YouTube URL for summarization.

**Body** (`application/json`):

```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

**Response** `201`:

```json
{
  "success": true,
  "message": "Video summarized successfully",
  "data": {
    "id": "cm7abc123...",
    "videoId": "dQw4w9WgXcQ",
    "videoTitle": "Rick Astley - Never Gonna Give You Up",
    "summary": "...",
    "keyPoints": null,
    "tlDr": null,
    "qa": null,
    "bullets": null,
    "createdAt": "2026-06-26T12:00:00.000Z"
  }
}
```

### `GET /api/v1/summarize`

List all summaries (paginated).

| Query | Type | Default | Description |
|---|---|---|---|
| `page` | number | `1` | Page number |
| `limit` | number | `10` | Items per page (max 50) |

### `GET /api/v1/summarize/:id`

Retrieve a single summary by ID.

### `POST /api/v1/summarize/:id/generate`

Generate a specific format for an existing summary (lazy generation).

**Body** (`application/json`):

```json
{
  "format": "keyPoints"
}
```

**Available formats**: `keyPoints`, `tlDr`, `qa`, `bullets`

### `DELETE /api/v1/summarize/:id`

Delete a summary by ID.

---

## AI Pipeline

```
YouTube URL
  ↓ extractVideoId() — regex parse
  ↓ fetchTranscript() — youtube-transcript package
  ↓ getVideoTitle()  — YouTube oEmbed API
  ↓ callAI(SUMMARY_PROMPT) — rate-limited sequential OpenRouter call
  ↓ prisma.summary.create() — persist initial summary
  ↓ return saved Summary

On-demand format generation (lazy):
  POST /summarize/:id/generate { format }
  ↓ prisma.summary.findUnique()
  ↓ callAI(FORMAT_PROMPT) — rate-limited
  ↓ prisma.summary.update({ [format]: content })
  ↓ return updated Summary
```

The OpenRouter free router model automatically selects the best available free model, providing intelligent summaries at zero cost.

---

## Rate Limiting

| Layer | Limit | Tool |
|---|---|---|
| HTTP requests | 30 req/min per IP | `express-rate-limit` |
| AI API calls | 18 req/min, 1 concurrent, 3 s min interval | Custom token-bucket `RateLimiter` |

The AI rate limiter operates on a token-bucket algorithm with separate capacity and refill rate, ensuring the free-tier OpenRouter endpoint is never overwhelmed.

---

## Error Handling

Errors are categorized by a typed `AppError` hierarchy:

| Class | HTTP Status | When |
|---|---|---|
| `BadRequestError` | 400 | Invalid input / Zod validation failure |
| `NotFoundError` | 404 | Summary ID not found |
| `RateLimitError` | 429 | Too many requests |
| `InternalServerError` | 500 | Unexpected failures |

All errors are caught by the global error middleware and returned in the standard envelope:

```json
{
  "success": false,
  "message": "Summary not found",
  "data": null
}
```

---

## Docker

```bash
docker build -t clipwise-backend .
docker run -p 3000:3000 --env-file .env clipwise-backend
```

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with hot reload (`tsx watch`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled production build |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Run database migrations |
| `npm run prisma:studio` | Open Prisma Studio GUI |
