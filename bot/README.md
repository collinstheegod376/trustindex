# @larpfinderonx - X (Twitter) Bot 🤖

This directory contains the production-ready Node.js backend for the **LarpFinder X Bot**. 

The bot is designed to parse tweets using Google Gemini (LLM), determine user intents (like checking scores, reporting users, or admin commands), and seamlessly sync with your **Supabase** web application database. It features BullMQ job queues to respect Twitter's rate limits and Redis caching for high performance.

---

## 🛠️ Architecture & Database Alignment

The bot integrates directly with your existing Supabase schema. Here is how it maps to your tables:

1. **`tracked_accounts` Table (Core Source of Truth)**
   - Used for verifying if a user is a "larp" or "verified".
   - `status = 'scam'` triggers a `🚨 LARP ALERT:` reply.
   - `status = 'verified'` triggers a `✅ SAFE` or `📊 Score` reply.
   - Commands like `!adduser` and `!mark larp` directly `INSERT` or `UPDATE` this table.

2. **`reports` Table**
   - When users tweet `@larpfinderonx report @badactor reason`, the bot extracts the reason using Gemini and inserts a new row into `reports` with `status: 'pending'`.
   - It automatically links the report to the `tracked_account_id`.

3. **`profiles` Table**
   - Used to verify if a tweeter is an admin by checking `is_admin = true` matching their `x_handle`.

4. **`processed_tweets` Table (Required Setup)**
   - Used to ensure **Idempotency** (so the bot doesn't reply to the same tweet twice if the polling loop repeats).

### Required Supabase SQL Setup
Run this exactly in your **Supabase SQL Editor** to create the idempotency table:

```sql
CREATE TABLE IF NOT EXISTS public.processed_tweets (
  tweet_id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ DEFAULT now()
);

-- Optional but recommended: Add an index if your table gets huge
CREATE INDEX IF NOT EXISTS idx_processed_tweets_id ON public.processed_tweets(tweet_id);
```

---

## 🚀 Step-by-Step Deployment Guide

Since this bot relies on continuous polling (`setInterval`) and BullMQ background workers, **you cannot host it on Vercel Serverless Functions.** You must host it on a persistent container service like **Render** or **Railway**.

### Phase 1: Prerequisites & API Keys
You need the following accounts and keys ready:

1. **Twitter / X Developer Portal**:
   - Create a project and an App.
   - Set User Authentication Settings to **Read and Write**.
   - Generate: `API Key`, `API Key Secret`, `Access Token`, and `Access Token Secret`.
2. **Supabase**:
   - You need your **Project URL**.
   - You need your **Service Role Key** (Found in Project Settings -> API. Do NOT use the `anon_key`. The Service key is required to bypass Row Level Security for admin commands).
3. **Google Gemini**:
   - Get a free API key from Google AI Studio (`gemini-1.5-flash`).
4. **Upstash (Redis)**:
   - Go to [Upstash.com](https://upstash.com/), log in, and create a free Redis database.
   - Scroll down to the Node.js connection string and copy the `rediss://...` URL.

### Phase 2: Local Testing (Optional)
To test the bot on your own computer before deploying:

1. Open a terminal and navigate to the bot directory:
   ```bash
   cd bot
   npm install
   ```
2. Create a `.env` file inside the `bot/` folder:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_service_key
   GEMINI_API_KEY=your_gemini_key
   TWITTER_API_KEY=your_x_api_key
   TWITTER_API_SECRET=your_x_api_secret
   TWITTER_ACCESS_TOKEN=your_x_access_token
   TWITTER_ACCESS_SECRET=your_x_access_secret
   REDIS_URL=rediss://default:your-upstash-password@your-upstash-url.upstash.io:6379
   ADMIN_USERNAMES=killua,promisesol
   BOT_USERNAME=larpfinderonx
   ```
   *(Note: `ADMIN_USERNAMES` is a comma-separated fallback list of X handles just in case your `profiles` table is empty).*
3. Run the bot:
   ```bash
   npm start
   ```

### Phase 3: Deploying to Render (Recommended)

1. Commit your code and push it to GitHub.
2. Go to [Render.com](https://render.com/) and click **New -> Background Worker**.
3. Connect your GitHub repository.
4. Fill in the build settings:
   - **Name**: `larpfinder-bot`
   - **Root Directory**: `bot` *(CRITICAL! Do not leave this blank. This tells Render to only build the bot folder, ignoring your React web app).*
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Scroll down to **Environment Variables** and click *Add Environment Variable*.
6. Paste all the keys from your `.env` file (Supabase, Twitter, Gemini, Redis, Admins).
7. Click **Create Background Worker**.

### Phase 4: Deploying to Railway (Alternative)

If you prefer Railway:
1. Go to [Railway.app](https://railway.app/) and click **New Project**.
2. Choose **Deploy from GitHub repo**.
3. Select your repository.
4. Before it finishes deploying, go to the project **Settings**:
   - Go to the **Build** section.
   - Set the **Root Directory** to `/bot`.
5. Go to the **Variables** section.
6. Add all your `.env` variables (Supabase, Twitter, Gemini, Redis, Admins).
7. Railway will automatically detect `package.json` in the `/bot` folder, run `npm install`, and start the bot using `npm start`.

---

## 🛡️ Admin Commands Reference

Admins (users with `is_admin = true` in Supabase OR listed in `ADMIN_USERNAMES`) can reply to the bot or tweet at it with these exact commands to trigger instant database updates.

**Note**: Commands bypass Gemini to save costs and are evaluated using strict Regex.

| Command | Action |
| :--- | :--- |
| `!adduser @username 95` | Marks user as `verified` and sets trust score to 95. |
| `!updatescore @username 80` | Changes the `trust_score` to 80 for an existing verified user. |
| `!removeuser @username` | Deletes the user entirely from `tracked_accounts`. |
| `!mark larp @username` | Forces the user to `status = 'scam'` and sets score to 0. |
| `!mark scam @username` | Same as `!mark larp`. |
| `!unlarp @username` | Restores user to `status = 'verified'`. |
| `!listreports` | DMs you the last 5 pending reports from the `reports` table. |
| `!resolvereport <id> confirm`| Marks the reported account as a larp/scam and deletes the report. |
| `!resolvereport <id> dismiss`| Deletes the false report from the database. |
| `!help` | DMs a list of commands. |

## 📦 Scalability & Rate Limiting Features Built-In

- **Twitter API Rate Limits**: The bot uses `BullMQ` to queue outgoing replies. It is strictly hardcoded to process a maximum of **8 replies every 30 minutes** (48 per 3 hours). This prevents your bot account from getting API banned if a viral tweet causes a spam wave.
- **Admin DM Rate Limits**: To prevent admin spam on errors, direct messages to admins are strictly rate-limited using a sliding Redis TTL window (1 DM per 5 minutes per admin).
- **Redis Caching**: Lookups for `tracked_accounts` are cached in Redis for 1 hour (`EX 3600`) to prevent hitting Supabase read limits. The cache is automatically invalidated when an admin command (`!updatescore`, etc.) alters an account.
- **Health Checks**: If Supabase, Redis, or Twitter goes down, the bot intentionally crashes. Render/Railway will automatically attempt to restart it until the services are back online.
