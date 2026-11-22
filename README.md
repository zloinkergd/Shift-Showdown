# SHIFT SHOWDOWN V59 — Chromebook Website Multiplayer Alpha

**The important part:** Nobody playing SHIFT SHOWDOWN needs Node.js installed. The Node server runs on a hosting provider, and every player uses Chrome and the same public HTTPS website. **This ZIP is deployment-ready, but it is not automatically deployed.**

## What you get

- `index.html`: the V58 3D private dorm, Garage, all six SHIFT Lab stations, solo racing, Ghost Chase, and two-player multiplayer, with V59 sharing UI.
- `server.js`: the multiplayer WebSocket game server, using Node's built-in modules (no third-party dependencies).
- `package.json`: starts the game with `npm start` on a cloud host; no build step or packages required.
- `render.yaml`: optional Render deployment settings for a **Free Web Service**, with a `/health` endpoint.
- `README.md`: this guide.

The first multiplayer version is deliberately restricted to **two racers per room** until testing with real Chromebooks is complete. It is a network **alpha**: movement is simulated on each browser; the server synchronizes the room countdown, SHIFT race clock, snapshots, checkpoints, and finish results. It does not yet offer robust anti-cheat or true server-authoritative physics.

## Easiest deployment: GitHub + Render, entirely from Chrome

You (or a parent/teacher helping with the hosting accounts if needed) only need a Chromebook with Chrome and eligible GitHub/Render accounts. No Chromebook terminal or Node.js install.

1. **Download and extract** `SHIFT_SHOWDOWN_V59_Website.zip` in Chrome's Files app. Don't upload the ZIP itself as your GitHub game source.
2. In GitHub, **create a new repository** (for example `shift-showdown-web`). A public repository is easiest for connecting to hosting; do not put passwords, addresses, personal files, or other private information in it. Private repositories may also work if you authorize the Render GitHub connection.
3. In the repository, select **Add file → Upload files**. Upload these files directly to the **top level** of the repository: `index.html`, `server.js`, `package.json`, `render.yaml`, and `README.md`. Confirm/commit the upload.
4. In **Render** (https://dashboard.render.com/), choose **New → Web Service** and connect the GitHub repository. Do not choose Static Site: multiplayer requires a running WebSocket server.
5. Select the **Free** compute option if it is available for your account. Use **Build Command:** `npm install --omit=dev` and **Start Command:** `npm start`. Set **Health Check Path:** `/health`. The server automatically uses Render's `PORT` setting and binds to `0.0.0.0`.
6. Deploy. After Render reports that the service is live, it will provide your own unique HTTPS address, usually ending in `.onrender.com`. **This ZIP does not already have a live URL.**
7. Open that HTTPS address in Chrome. You will begin in your 3D dorm. Walk to **CREATE ROOM** and press **E**. Enter your nickname, select **CREATE ROOM**, then **COPY INVITE LINK**.
8. Send the link privately to a friend. They open it in Chrome, enter their nickname, and press **JOIN ROOM**. The six-character code is filled in automatically. Both players click **I'M READY** to start the shared five-second countdown.

If Render offers a Blueprint deployment route, the included `render.yaml` contains equivalent settings. The steps above use the ordinary Web Service UI so you don't have to understand Blueprints.

## Troubleshooting on Chromebooks

- **Friend sees 'Room not found':** Ensure both use the *same website address*. Rooms are stored only in server memory and disappear after a restart or an extended idle sleep. Create a new room and copy a fresh invite link.
- **'Server waking up':** Render Free services can spin down after 15 minutes of inactivity. The first website visit may take roughly a minute to wake the server. Reload after it finishes waking up.
- **WebGL unavailable:** The Chromebook must support WebGL in Chrome. Try the Low Graphics option (`G`) if it is slow. If school policy blocks the site or WebGL, that restriction must be handled by the school—do not circumvent it.
- **Can solo play without hosting?** Yes. Open `index.html` directly in Chrome for the dorm, Garage, SHIFT Lab, and solo racing. Room creation/joining only works at the deployed web address.
- **Friends see a 'nullblank' link:** A copied link must come from the **hosted HTTPS website**, not a locally opened HTML file. A real invite looks like `https://YOUR-SITE.onrender.com/?room=ABC234` (placeholder only, not a live website).
- **Lost connection during racing:** This alpha does not seamlessly restore disconnected race sessions. Return to the room station and rejoin or make a new room.
- **Six players?** Not yet validated. V59 intentionally remains two-player; six-player networking, collision fairness, and the full championship are later milestones.

## Hosting limitations

The hosting provider runs Node.js remotely—not on your Chromebook. Render's Free Web Services support WebSockets but may sleep when inactive and may restart. The service is internet-accessible; a room code limits discovery but is **not** an authentication or privacy guarantee. Avoid sharing personal information as a nickname. There are no in-game accounts or chat messages in this build.

Sources for deployment behavior:
- https://render.com/docs/web-services
- https://render.com/docs/free
- https://render.com/docs/websocket

## For developers / optional local testing

If a developer does have Node.js on their own computer, they can run `npm start` and open `http://localhost:3000`. This is optional and **not required for any Chromebook player**.

The `/health` route responds with JSON like `{"ok":true,"version":"V59","rooms":0,"maxPlayers":2}`. The server accepts shareable links at `/?room=CODE` and WebSocket clients at `/ws`, using encrypted `wss://` automatically on HTTPS sites.
