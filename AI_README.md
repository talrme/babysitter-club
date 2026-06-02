# AI_README — Babysitter Club

Context for humans and coding assistants continuing this project.

**Live site:** [https://talrme.github.io/babysitter-club](https://talrme.github.io/babysitter-club)

## What this is

A **static site** (no bundler): `index.html`, `styles.css`, `script.js`, plus Firebase config. Goal is a babysitting coordination app: **Google sign-in**, optional **two-person households**, **household-to-household connections** (bidirectional accepts), and section-based flows for **my requests**, **others' requests**, **club management**, and **household linking**.

**Implemented today:** Firebase Auth with **Google** (`signInWithPopup`), Firestore user profile sync (`users/{uid}`), section-based signed-in navigation, request modals (kid count, OR-date groups, audience targeting), club invite send/accept flow (with pending dedupe), household invite/link flow, UID-based admin view (`admins/{uid}`), and admin add/remove controls for other users.

**Not implemented yet:** production-grade Firestore security rules, full booking lifecycle, notifications, and polished invitation/onboarding flows.

## Stack

- **Firebase** — Auth (Google); Firestore planned for all relationships and requests.
- **Firebase JS SDK** loaded via **ES module CDN** URLs in `script.js` (currently `11.6.0`).
- **Modules:** `index.html` uses `<script type="module" src="script.js">`; requires **HTTP**, not `file://`.

## Files

| File | Role |
|------|------|
| `index.html` | Shell, auth bar, setup hint, signed-in panel |
| `styles.css` | Modernized visual system, section layouts, cards, and modal styling |
| `script.js` | Auth handlers, profile sync, requests/club/household Firestore reads and actions |
| `admins/{uid}` (Firestore collection) | Admin UID registry for admin-only UI visibility |
| `firestore.rules` | Firestore security rules for user/admin visibility boundaries |
| `firebase.js` | Shared Firebase app/auth/firestore initialization |
| `firebase-config.js` | **`firebaseConfig` export** — user fills from Firebase Console (often gitignored in real repos; here may be empty placeholders) |
| `firebase-config.example.js` | Shape of config for copy/paste |

## Run locally

```bash
cd babysitter-club && python3 -m http.server 8080
```

Open **http://localhost:8080**. Ensure `localhost`, `127.0.0.1`, and `talrme.github.io` are listed as **Authorized domains** in Firebase Authentication settings.

## Firebase setup (click-by-click)

If you are new to Firebase, do this exactly:

1. Go to [Firebase Console](https://console.firebase.google.com/) and click **Create a project**.
2. In the project, click **</> Add app** (Web app), register it, and copy the `firebaseConfig` object.
3. Paste values into `firebase-config.js` (replace empty strings).
4. In Firebase Console, go to **Build → Authentication → Get started**.
5. Open **Sign-in method**, enable **Google**, and save.
6. Open **Authentication → Settings → Authorized domains** and add:
   - `localhost`
   - `127.0.0.1`
   - `talrme.github.io`
7. Run locally:

```bash
cd babysitter-club && python3 -m http.server 8080
```

8. Open `http://localhost:8080` and click **Sign in with Google**.
9. Open [https://talrme.github.io/babysitter-club](https://talrme.github.io/babysitter-club) and verify sign-in also works there.

If `firebase-config.js` has an empty `apiKey`, the setup hint/checklist appears and the sign-in button stays hidden.

### Common sign-in errors

- `auth/unauthorized-domain`: add the current domain in Firebase authorized domains.
- `auth/operation-not-allowed`: enable Google as a sign-in provider.
- `auth/popup-blocked`: allow popups for this site and retry.

## GitHub Pages hosting

This app is compatible with GitHub Pages because it is static HTML/CSS/JS.

1. Push this folder to a GitHub repo.
2. In GitHub repo settings, enable **Pages** from your chosen branch/folder.
3. Confirm the live URL is [https://talrme.github.io/babysitter-club](https://talrme.github.io/babysitter-club).
4. Ensure `talrme.github.io` is in Firebase authorized domains.
5. Re-test sign-in on the live Pages URL.

## Firestore security rules

- Rules file lives at `firestore.rules`.
- Publish these rules from Firebase Console: **Firestore Database → Rules** (paste file contents and Publish) or via Firebase CLI if configured.
- Current model:
  - only `admins/{uid}` users are treated as admins
  - non-admin users can read only their own `users/{uid}` document
  - non-admin users can read requests/invites only when directly involved or club-visible
  - admin users can read global users + club graph

If you tighten rules further, ensure client queries stay scoped; broad `users` queries for non-admin users will be denied.

## Product rules (target behavior — encode in Firestore + UI later)

- **Household:** exactly **two** linked accounts; linking requires **mutual confirmation**; either member’s actions visible to the household as agreed in UX (mirror requirements when implementing).
- **Connections:** users can send/accept club invites; households can send/accept household-link invites.
- **Requests:** modal for date/time/details; optional **up to five** candidate slots; when one slot is **filled**, treat request as booked and **void** other slots.
- **Admin visibility:** only UIDs in `admins/{uid}` should see all users and club graph.

## Admin setup

- Admin access is UID-based via `admins/{uid}` documents.
- Create your admin document manually in Firebase Console under the `admins` collection (document ID should be your auth UID).
- Only users with a matching `admins/{uid}` document get the Admin section in UI.
- Admin users can grant/revoke admin for other users from the Admin section.
- Firestore rules in `firestore.rules` enforce admin access server-side.

## Conventions for future changes

- Keep **vanilla JS** and **module** imports unless the user asks for a framework.
- **Firestore security rules** must enforce visibility (never rely on client-only filtering).
- Prefer **`firebase/auth`** patterns already in `script.js`; extend with thin modules (`firebase/firestore.js`) via same CDN style when adding data layer.
- **Mobile-first** responsive CSS; theme hooks already exist on `:root` for a future settings modal.

## Related docs

User onboarding steps are documented here. Update this file when major architecture lands (Firestore collections schema, rules file location, hosting URL).
