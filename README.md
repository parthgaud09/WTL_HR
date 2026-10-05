# Elevate HR — cloud database edition

Express + HTML/CSS/JavaScript + PostgreSQL. Includes candidate profiles, editable notes, status tracking, interviews, role matching and side by side comparison. The database is external, so host restarts do not erase records. Scores use simple keyword matching, experience and description terms; recruiters make the final decision.

## 1. Create the database

Create a free PostgreSQL project at https://neon.com. Choose a region near your hosting region. Click **Connect**, select your database and role, and copy the complete connection string. Keep its SSL parameters. Save it in `.env` for local use and `DATABASE_URL` on Render. Never commit the password or `.env` to GitHub.

Tables `jobs`, `candidates` and `interviews` are created by `schema.sql` automatically when the server starts. No manual SQL setup is needed.

## 2. Run locally on Ubuntu

Use Node.js 22 or 24. This version uses `pg`, so it no longer needs `better-sqlite3` or a native database compilation step.

```bash
npm install
cp .env.example .env
nano .env
npm start
```

Edit `DATABASE_URL`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD` in `.env` before starting. Open http://localhost:3001 and use the administrator credentials. The browser displays a basic authentication prompt. For local development without password protection, remove ADMIN_PASSWORD from `.env`. Production requires a username and a password of at least 16 characters.

## 3. Keep existing SQLite records (optional)

Stop the old app. Copy your existing `elevatehr.db` into this project folder. Set DATABASE_URL in .env, pointing to an EMPTY PostgreSQL database. Before adding any online data, run:

```bash
npm run import:sqlite
```

The importer reads SQLite with Python's standard library, imports all three tables inside a transaction, keeps record IDs, and resets PostgreSQL sequences. It refuses to overwrite a non-empty database. Your old SQLite file is never changed. The app now saves new data to PostgreSQL.

## 4. Upload this version to GitHub

Copy these source files into your existing WTL_HR checkout, where its `.git` directory is located. Keep `.git` and your SQLite file. Replace the old package.json and server.js. Use these commands from that checkout:

```bash
git add .
git commit -m "Add PostgreSQL and deployment configuration"
git push origin main
```

Check that package.json, server.js, schema.sql and public/ are at the repository root. If you intentionally keep them in a subdirectory, set that subdirectory as Render's Root Directory. node_modules, .env and SQLite databases must stay out of GitHub.

## 5. Deploy on Render

At https://render.com choose **New > Web Service** and connect `parthgaud09/WTL_HR`.

| Setting | Value |
|---|---|
| Runtime | Node |
| Branch | main |
| Root Directory | blank if package.json is at the repo root |
| Build Command | npm install --omit=dev |
| Start Command | npm start |
| Instance | Free |
| Health Check Path | /health |

Add these environment variables before deployment:

| Key | Value |
|---|---|
| NODE_ENV | production |
| DATABASE_URL | Full Neon connection string |
| ADMIN_USERNAME | admin, or your chosen username |
| ADMIN_PASSWORD | Your private password, at least 16 characters |

Do not set PORT manually on Render; Render supplies it. Click Deploy Web Service. The server binds 0.0.0.0 and Render's port. Open the onrender.com address shown on your service page, enter your administrator credentials, add a candidate, and reload to verify it remains saved.

Alternatively use **New > Blueprint** with this repository and `render.yaml`. Provide DATABASE_URL when prompted. The blueprint generates ADMIN_PASSWORD; view it in the service's Environment settings for sign-in.

Render free web services can sleep when idle and take time to wake. Neon free plans have usage quotas. Your database remains independent of the Render service filesystem.

## Checks

`npm test` checks ranking behavior, request validation and access protection with an isolated test database adapter. `GET /health` performs a real SELECT 1 when connected to PostgreSQL. A live Neon connection and an actual Render deployment still need verification in your accounts.
