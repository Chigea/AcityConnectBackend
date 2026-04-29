import bcrypt from "bcrypt";
import type { Request, Response } from "express";
import { z } from "zod";
import { isInstitutionalEmail } from "../lib/emailDomain.js";
import { signToken } from "../lib/jwt.js";
import { prisma } from "../prisma.js";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(120).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function postRegister(req: Request, res: Response): Promise<void> {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { email, password, displayName } = parsed.data;
  if (!isInstitutionalEmail(email)) {
    res.status(400).json({
      error: `Registration is limited to institutional email addresses.`,
    });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      displayName: displayName ?? email.split("@")[0],
    },
  });

  const token = signToken({ sub: user.id, role: user.role });
  res.status(201).json({ token, user: publicUser(user) });
}

export async function postLogin(req: Request, res: Response): Promise<void> {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const token = signToken({ sub: user.id, role: user.role });
  res.json({ token, user: publicUser(user) });
}

type UserRow = NonNullable<Awaited<ReturnType<typeof prisma.user.findUnique>>>;

function publicUser(user: UserRow) {
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
