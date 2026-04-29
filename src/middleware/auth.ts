import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "../lib/jwt.js";

export type AuthedRequest = Request & { userId?: string; userRole?: "user" | "admin" };

export function authMiddleware(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Missing token" });
    return;
  }
  try {
    const payload = verifyToken(token);
    req.userId = payload.sub;
    req.userRole = payload.role;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

export function optionalAuth(
  req: AuthedRequest,
  _res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (token) {
    try {
      const payload = verifyToken(token);
      req.userId = payload.sub;
      req.userRole = payload.role;
    } catch {
      /* ignore */
    }
  }
  next();
}
