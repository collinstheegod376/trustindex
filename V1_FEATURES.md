# 🛡️ LarpFinder V1 - Feature Breakdown

Welcome to LarpFinder V1! Here is a comprehensive breakdown of everything built into the initial MVP.

## 1. 🌐 Community-Driven Verification & Reporting
* **Global Search:** Search any X (Twitter) handle from the homepage to instantly view their historical reputation and "Trust Score".
* **Flag a Host (Report System):** Users can report scam giveaways, fake winners, or engagement farming directly to the system. Includes required proof attachment (screenshots uploaded to Supabase storage) and detailed reasoning.
* **Promote a Host:** Users can submit legitimate giveaway hosts for community and admin verification.
* **Community Voting:** The community can upvote or downvote pending scam reports.

## 2. 📊 Dynamic Trust Score & Leaderboards
* **Algorithmic Trust Gauge:** A visual, animated circular gauge (0-100) that visually demonstrates how trustworthy an account is.
* **Status Badges:** Accounts are explicitly categorized and color-coded as **VERIFIED (Green)**, **SUSPICIOUS (Yellow)**, or **SCAM (Red)**.
* **Hall of Fame:** A dedicated leaderboard ranking the most trusted and verified giveaway hosts in the ecosystem.
* **Wall of Shame:** A public warning list ranking confirmed scammers with the lowest trust scores.

## 3. ⚖️ Admin Dashboard & Moderation
* **Role-Based Access (RBAC):** Supabase-enforced security ensures only authorized users with the `admin` role can access moderation tools.
* **One-Click Moderation:** Rapid workflow queue to review pending reports. Admins can simply click "Accept Report" (immediately flags the user as a Scam and drops their score to 10) or "Reject" to dismiss false claims.
* **Manual Override:** Admins can manually add accounts to the database with custom statuses and scores without waiting for a user report.
* **Full Database Control:** Admins can delete users from the tracking database or modify their status on the fly.

## 4. 💬 Ephemeral Live Support Ecosystem
* **Live Chat (`/support`):** A dedicated, full-page support inbox for users to communicate with admins.
* **Real-time Streaming:** Messages stream instantly using Supabase WebSocket Channels—no page refreshing required.
* **Ephemeral Privacy:** Messages are strictly temporary and are designed to be cleared after 24 hours.
* **Live Notifications:** Users receive a visual red-dot notification on their navigation menu the instant an admin replies to their ticket.

## 5. 🔐 User Profiles & Authentication
* **Frictionless Onboarding:** Secure Supabase Authentication with email/password (no mandatory email verification, ensuring rapid onboarding).
* **Profile Management:** Users can set custom usernames, link their X handles to build credibility, and upload custom avatars.
* **UI Themes:** Built-in Dark Mode and Light Mode toggles.

## 6. ✨ High-Fidelity "Glass" Aesthetics
* **Dynamic Design:** Built on custom CSS focusing on "Glassmorphism" (translucent panels over blurred, animated background gradients).
* **Responsive Layout:** Works flawlessly across mobile devices, tablets, and desktop computers.
* **Micro-animations:** Subtle hover states, animated gauges, and smooth route transitions that make the app feel incredibly premium and "alive".
