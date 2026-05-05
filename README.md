# X Giveaway Tracker & Trust Index

A community-driven platform to report, verify, and track X (Twitter) giveaway accounts and specific giveaways.

## Core Features
- **Trust Index**: Search X handles to see if they are legit or scams.
- **Reporting System**: Users can flag giveaways with proof (screenshots, links).
- **Community Voting**: "Community Notes" style validation where users upvote/downvote reports.
- **Admin Dashboard**: Admins can review reports and permanently mark accounts as scammers.
- **Profiles**: Users can sign up, set an avatar, and build their reputation.

## Stack
- Frontend: React + Vite + Vanilla CSS (Glassmorphism & Neon accents)
- Backend/DB/Auth: Supabase (Free Tier)
- Icons: Lucide React
- Routing: React Router v6

## Supabase Schema & Setup

To make this app work, you need to create a free Supabase project.

### 1. Authentication
Enable **Email Auth** in the Supabase dashboard (Authentication -> Providers).

### 2. Database Tables

Run the following SQL in your Supabase SQL Editor:

```sql
-- 1. Profiles Table (Linked to auth.users)
create table public.profiles (
  id uuid references auth.users not null primary key,
  username text unique,
  avatar_url text,
  role text default 'user' check (role in ('user', 'admin')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Tracked Accounts Table (The X profiles being tracked)
create table public.tracked_accounts (
  id uuid default uuid_generate_v4() primary key,
  x_handle text unique not null,
  trust_score integer default 50,
  status text default 'pending' check (status in ('verified', 'pending', 'scam')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Reports Table (Reports filed against X profiles)
create table public.reports (
  id uuid default uuid_generate_v4() primary key,
  tracked_account_id uuid references public.tracked_accounts(id) on delete cascade not null,
  reporter_id uuid references public.profiles(id) on delete cascade not null,
  giveaway_url text not null,
  reason text not null,
  proof_url text,
  notes text,
  status text default 'pending' check (status in ('approved', 'rejected', 'pending')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Votes Table (Upvotes/Downvotes on reports)
create table public.votes (
  id uuid default uuid_generate_v4() primary key,
  report_id uuid references public.reports(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  vote_type integer not null check (vote_type in (1, -1)),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(report_id, user_id)
);
```

### 3. Setting up Triggers (Optional but recommended for Profile auto-creation)

```sql
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (new.id, new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

## Getting Started

1. Set up your Supabase project with the schema above.
2. Rename `.env.example` to `.env.local` and add your Supabase URL and Anon Key.
3. Run `npm install`
4. Run `npm run dev`
