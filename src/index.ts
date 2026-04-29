import "dotenv/config";
import cors from "cors";
import express from "express";
import { authMiddleware, optionalAuth } from "./middleware/auth.js";
import { requireAdmin } from "./middleware/admin.js";
import { postRegister, postLogin } from "./routes/auth.js";
import { getMe, patchMe, getUserById } from "./routes/users.js";
import {
  getListings,
  postListing,
  getListing,
  patchListing,
  deleteListing,
} from "./routes/listings.js";
import {
  postInterest,
  patchInterestOnListing,
  getMyInterests,
  getIncomingInterests,
} from "./routes/interests.js";
import {
  getConversations,
  postConversation,
  getMessages,
  postMessage,
} from "./routes/messages.js";
import {
  getAdminStats,
  patchModerateListing,
  adminDeleteListing,
  adminFlagListing,
  adminFlagUser,
} from "./routes/admin.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors({ origin: process.env.FRONTEND_ORIGIN ?? "*", credentials: true }));
app.use(express.json());

app.get("/", (_req, res) => {
  res.type("html").send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Fidelia Acity connect</title>
  <style>
    :root { color-scheme: light dark; --fg: #1a1a1a; --muted: #666; --accent: #2563eb; --bg: #f8fafc; }
    @media (prefers-color-scheme: dark) {
      :root { --fg: #f1f5f9; --muted: #94a3b8; --accent: #60a5fa; --bg: #0f172a; }
    }
    * { box-sizing: border-box; }
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--bg); color: var(--fg); }
    main { text-align: center; padding: 2rem; max-width: 28rem; }
    h1 { font-size: 1.5rem; font-weight: 600; margin: 0 0 0.5rem; letter-spacing: -0.02em; }
    .badge { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.875rem; color: #166534; background: #dcfce7; padding: 0.25rem 0.65rem; border-radius: 9999px; margin-bottom: 1rem; }
    @media (prefers-color-scheme: dark) {
      .badge { color: #86efac; background: #14532d; }
    }
    p { margin: 0; color: var(--muted); line-height: 1.5; font-size: 0.9375rem; }
    a { color: var(--accent); text-decoration: none; font-weight: 500; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <main>
    <div class="badge"><span aria-hidden="true">●</span> Online</div>
    <h1>Fidelia Acity connect backend</h1>
    <p>API is up. Use the app’s frontend for the full UI. JSON health check: <a href="/health">/health</a>.</p>
  </main>
</body>
</html>`);
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/auth/register", postRegister);
app.post("/api/auth/login", postLogin);

app.get("/api/users/me", authMiddleware, getMe);
app.patch("/api/users/me", authMiddleware, patchMe);
app.get("/api/users/:id", getUserById);

app.get("/api/listings", optionalAuth, getListings);
app.post("/api/listings", authMiddleware, postListing);
app.get("/api/listings/:id", optionalAuth, getListing);
app.patch("/api/listings/:id", authMiddleware, patchListing);
app.delete("/api/listings/:id", authMiddleware, deleteListing);

app.post("/api/listings/:id/interest", authMiddleware, postInterest);
app.patch(
  "/api/listings/:listingId/interests/:interestId",
  authMiddleware,
  patchInterestOnListing
);
app.get("/api/interests/mine", authMiddleware, getMyInterests);
app.get("/api/interests/incoming", authMiddleware, getIncomingInterests);

app.get("/api/conversations", authMiddleware, getConversations);
app.post("/api/conversations", authMiddleware, postConversation);
app.get("/api/conversations/:id/messages", authMiddleware, getMessages);
app.post("/api/conversations/:id/messages", authMiddleware, postMessage);

app.get("/api/admin/stats", authMiddleware, requireAdmin, getAdminStats);
app.patch(
  "/api/admin/listings/:id/moderate",
  authMiddleware,
  requireAdmin,
  patchModerateListing
);
app.delete(
  "/api/admin/listings/:id",
  authMiddleware,
  requireAdmin,
  adminDeleteListing
);
app.patch(
  "/api/admin/listings/:id/flag",
  authMiddleware,
  requireAdmin,
  adminFlagListing
);
app.patch(
  "/api/admin/users/:id/flag",
  authMiddleware,
  requireAdmin,
  adminFlagUser
);

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
);

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
