# NodePilot

NodePilot is a unified control panel for managing a home server.

This repository is a monorepo containing:

- A .NET backend server agent
- A Next.js web client

## Monorepo Structure

```text
nodepilot/
├─ apps/
│  ├─ backend/     # ASP.NET Core Web API
│  └─ web/         # Next.js web application
├─ .gitignore
├─ .env.example
└─ README.md
```

## Tech Stack

- Backend: .NET (ASP.NET Core Web API)
- Frontend: Next.js (React, TypeScript)
- Architecture: Client-server (REST API, JSON)

## Requirements

Make sure you have installed:

- .NET SDK 10.0
- Node.js 20+
- npm (comes with Node.js)
- Git

## Environment Variables

### Global Reference

See `.env.example` in the repository root.

### Web (Next.js)

Copy the example file:

```bash
cd apps/web
cp .env.local.example .env.local
```

Default value:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

This defines the backend API base URL used by the frontend.

## Running The Project Locally

You need to run both the backend and the frontend.

### 1. Start the Backend (.NET API)

```bash
cd apps/backend/src/NodePilot.Api
dotnet restore
dotnet run
```

By default, the API will be available at:

```text
http://localhost:5000
```

Test endpoint:

```text
GET /
```

### 2. Start the Web App (Next.js)

In a new terminal:

```bash
cd apps/web
npm install
npm run dev
```

Open in your browser:

```text
http://localhost:3000
```

## Verification Checklist

After setup, confirm that:

- The backend runs without errors
- `http://localhost:5000/` returns `"OK"`
- The frontend loads at `http://localhost:3000`
