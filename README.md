# 🛡️ TrustIndex (V1.0 MVP)
**The Social Media Reputation Layer**

TrustIndex is a high-fidelity web platform designed to eliminate social media giveaway fraud through community-driven accountability and decentralized proof tracking.

---

## **🔥 Live Demo**
[Visit TrustIndex Live](https://trustindex-six.vercel.app/)

---

## **💎 Why TrustIndex?**
Social media scams are at an all-time high. TrustIndex provides a secure, transparent way for users to:
*   **Search & Verify:** Instantly check an X handle's reputation before engaging.
*   **Report Fraud:** Upload immutable proof of scam activities or failed payouts.
*   **Community Vetting:** Vote on reports to build a consensus-based trust score.

---

## **🚀 The Pitch: Scaling to V2**
We are currently in **Version 1.0 (MVP)**. Our roadmap includes official **X API integration** to automate the verification process and build real-time fraud detection tools.

👉 **[Read our full Pitch & Roadmap here](./PITCH.md)**

---

## **🛠️ Tech Stack**
*   **Frontend:** React (Vite) + Vanilla CSS (Premium Glassmorphism)
*   **Backend:** Supabase (PostgreSQL, Auth, Storage)
*   **Motion:** CSS Keyframe Animations & Micro-interactions
*   **Icons:** Lucide React

---

## **💻 Local Development**

1. **Clone & Install**
   ```bash
   git clone https://github.com/collinstheegod376/trustindex.git
   cd trustindex
   npm install
   ```

2. **Environment Variables**
   Create a `.env.local` file:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. **Run Dev Server**
   ```bash
   npm run dev
   ```

---

## **🛡️ Security**
TrustIndex uses Supabase RLS (Row Level Security) to ensure that only authenticated users can submit reports and only admins can verify accounts.

---

*Built with ❤️ to make the internet a safer place.*
