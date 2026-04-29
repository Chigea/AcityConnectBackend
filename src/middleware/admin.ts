import type { Response, NextFunction } from "express";
import type { AuthedRequest } from "./auth.js";

export function requireAdmin(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): void {
  if (req.userRole !== "admin") {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  next();
}
