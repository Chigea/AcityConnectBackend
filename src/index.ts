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
