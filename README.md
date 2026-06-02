# Babysitter Club

Live site: [https://talrme.github.io/babysitter-club](https://talrme.github.io/babysitter-club)

Babysitter Club is a static web app (no bundler) for coordinating babysitting with:
- Google sign-in
- two-person households
- household-to-household connections
- section-based signed-in app navigation (`My Requests`, `Upcoming Babysits`, `Others' Requests`, `My Club`, `My Household`)
- modal-driven request creation/details
- club invite send/accept flows with pending-invite dedupe
- household invite/accept flow with merged club networks

## Project files

- `index.html` — app shell and auth UI
- `styles.css` — app styling
- `script.js` — Firebase auth wiring and UI state
- `firebase.js` — shared Firebase app/auth/firestore initialization
- `firestore.rules` — security policy for user/admin data access
- `firebase-config.js` — your Firebase web config values
- `firebase-config.example.js` — config template

## Local run

```bash
cd babysitter-club && python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Firebase quick setup

1. Create a project in [Firebase Console](https://console.firebase.google.com/).
2. Add a **Web app** and copy its `firebaseConfig`.
3. Paste those values into `firebase-config.js`.
4. Enable **Authentication → Sign-in method → Google**.
5. In **Authentication → Settings → Authorized domains**, add:
   - `localhost`
   - `127.0.0.1`
   - `talrme.github.io`

## GitHub Pages

This app is hosted at [https://talrme.github.io/babysitter-club](https://talrme.github.io/babysitter-club).

For detailed implementation notes and deeper setup context, see `AI_README.md`.
