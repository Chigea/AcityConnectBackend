import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import type { AuthedRequest } from "../middleware/auth.js";

const patchMeSchema = z.object({
  displayName: z.string().min(1).max(120).optional(),
  bio: z.string().max(2000).optional().nullable(),
  skillsOffered: z.array(z.string().max(80)).max(50).optional(),
  skillsNeeded: z.array(z.string().max(80)).max(50).optional(),
});

export async function getMe(req: AuthedRequest, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(publicUser(user));
}

export async function patchMe(req: AuthedRequest, res: Response): Promise<void> {
  const parsed = patchMeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const data = parsed.data;
  const user = await prisma.user.update({
    where: { id: req.userId! },
    data: {
      ...(data.displayName !== undefined && { displayName: data.displayName }),
      ...(data.bio !== undefined && { bio: data.bio }),
      ...(data.skillsOffered !== undefined && { skillsOffered: data.skillsOffered }),
      ...(data.skillsNeeded !== undefined && { skillsNeeded: data.skillsNeeded }),
    },
  });
  res.json(publicUser(user));
}

export async function getUserById(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.flagged) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(publicUser(user));
}

function publicUser(user: {
  id: string;
  email: string;
  role: string;
  displayName: string | null;
  bio: string | null;
  skillsOffered: string[];
  skillsNeeded: string[];
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    displayName: user.displayName,
    bio: user.bio,
    skillsOffered: user.skillsOffered,
    skillsNeeded: user.skillsNeeded,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
