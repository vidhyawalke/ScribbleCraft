# 🔥 Firebase Setup Guide — ScribbleCraft Real-Time Collaboration

This guide takes ~5 minutes. No credit card required. Free tier is more than enough.

---

## Step 1 — Create a Firebase Project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Add project"**
3. Enter a project name (e.g. `scribblecraft`) → Continue
4. **Disable** Google Analytics (not needed) → **Create project**

---

## Step 2 — Enable Realtime Database

1. In the left sidebar, click **Build → Realtime Database**
2. Click **"Create Database"**
3. Choose a region close to your users (e.g. `us-central1`)
4. Select **"Start in test mode"** → **Enable**

> ⚠️ Test mode rules expire after **30 days**. Before expiry, set production rules (Step 4).

---

## Step 3 — Get Your Config Keys

1. Click the **gear icon ⚙️** → **Project settings**
2. Scroll to **"Your apps"** → click **"Add app"** → choose **Web `</>`**
3. Enter a nickname (e.g. `scribblecraft-web`) → **Register app**
4. Copy the `firebaseConfig` object — it looks like:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "yourproject.firebaseapp.com",
  databaseURL: "https://yourproject-default-rtdb.firebaseio.com",
  projectId: "yourproject",
  storageBucket: "yourproject.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123:web:abc123"
};
```

---

## Step 4 — Set Security Rules (for production)

In Firebase Console → Realtime Database → **Rules** tab, paste:

```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        ".read": true,
        ".write": true,
        "state": {
          ".validate": "newData.hasChildren(['writerId', 'timestamp', 'elements'])"
        },
        "presence": {
          "$userId": {
            ".write": "auth == null"
          }
        }
      }
    }
  }
}
```

Click **Publish**.

---

## Step 5A — Local Development

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in the values from Step 3:
   ```
   VITE_FIREBASE_API_KEY=AIza...
   VITE_FIREBASE_AUTH_DOMAIN=yourproject.firebaseapp.com
   VITE_FIREBASE_DATABASE_URL=https://yourproject-default-rtdb.firebaseio.com
   VITE_FIREBASE_PROJECT_ID=yourproject
   VITE_FIREBASE_STORAGE_BUCKET=yourproject.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123:web:abc123
   ```

3. Restart the dev server:
   ```bash
   npm run dev
   ```

---

## Step 5B — Vercel Deployment

1. Go to your Vercel project dashboard
2. Click **Settings → Environment Variables**
3. Add each variable from `.env.example` with the values from Step 3
4. **Redeploy** the project (Deployments tab → ⋯ → Redeploy)

---

## ✅ Verify It Works

1. Open your app in **two different browsers** (or one incognito)
2. Share the URL (click **Share Room** button)
3. Open the shared URL in the second browser
4. Draw something — it should appear on both screens within ~50–100 ms
5. You should see the other user's cursor moving in real-time

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Firebase not configured" in console | `.env` file missing or vars not set in Vercel |
| Collaboration works on same device but not cross-device | Firebase env vars not applied; redeploy Vercel |
| Changes stop syncing after 30 days | Set production security rules (Step 4) |
| Large images not syncing | Known limitation: base64 images > 200KB are stripped from Firebase sync |
