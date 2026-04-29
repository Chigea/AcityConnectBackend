import type { Response } from "express";
import { z } from "zod";
import type { AuthedRequest } from "../middleware/auth.js";
import { prisma } from "../prisma.js";
import { ModerationStatus } from "@prisma/client";

export async function getAdminStats(req: AuthedRequest, res: Response): Promise<void> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [userCount, listingCountByStatus, pendingListings, interestCount, messageCountRecent, conversationsCount] =
    await Promise.all([
      prisma.user.count(),
      prisma.listing.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.listing.count({
        where: { moderationStatus: ModerationStatus.pending },
      }),
      prisma.listingInterest.count(),
      prisma.message.count({
        where: { createdAt: { gte: sevenDaysAgo } },
      }),
      prisma.conversation.count(),
    ]);

  res.json({
    users: userCount,
    listingsByStatus: listingCountByStatus,
    pendingModeration: pendingListings,
    totalInteractions: interestCount,
    messagesLast7Days: messageCountRecent,
    conversationsTotal: conversationsCount,
  });
}

const moderateSchema = z.object({
  moderationStatus: z.nativeEnum(ModerationStatus),
  detail: z.string().max(2000).optional(),
});

export async function patchModerateListing(req: AuthedRequest, res: Response): Promise<void> {
  const id = req.params.id as string;
  const parsed = moderateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const listing = await prisma.listing.update({
    where: { id },
    data: {
      moderationStatus: parsed.data.moderationStatus,
    },
  });

  await prisma.moderationAudit.create({
    data: {
      moderatorId: req.userId!,
      listingId: id,
      action: "moderate",
      detail: parsed.data.detail ?? parsed.data.moderationStatus,
    },
  });

  res.json(listing);
}

export async function adminDeleteListing(req: AuthedRequest, res: Response): Promise<void> {
  const id = req.params.id as string;
  try {
    await prisma.listing.delete({ where: { id } });
  } catch {
    res.status(404).json({ error: "Not found" });
    return;
  }

  await prisma.moderationAudit.create({
    data: {
      moderatorId: req.userId!,
      listingId: id,
      action: "delete",
      detail: null,
    },
  });
  res.status(204).send();
}

const flagListingSchema = z.object({
  flagged: z.boolean(),
  reason: z.string().max(2000).optional().nullable(),
});

export async function adminFlagListing(req: AuthedRequest, res: Response): Promise<void> {
  const id = req.params.id as string;
  const parsed = flagListingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const listing = await prisma.listing.update({
    where: { id },
    data: {
      flagged: parsed.data.flagged,
      flaggedReason: parsed.data.reason ?? null,
      ...(parsed.data.flagged === true ? { moderationStatus: ModerationStatus.rejected } : {}),
    },
  });

  await prisma.moderationAudit.create({
    data: {
      moderatorId: req.userId!,
      listingId: id,
      action: "flag_listing",
      detail: parsed.data.reason ?? null,
    },
  });

  res.json(listing);
}

const flagUserSchema = z.object({
  flagged: z.boolean(),
  reason: z.string().max(2000).optional().nullable(),
});

export async function adminFlagUser(req: AuthedRequest, res: Response): Promise<void> {
  const id = req.params.id as string;
  const parsed = flagUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      flagged: parsed.data.flagged,
      flaggedReason: parsed.data.reason ?? null,
    },
  });

  await prisma.moderationAudit.create({
    data: {
      moderatorId: req.userId!,
      listingId: null,
      action: parsed.data.flagged ? "flag_user" : "unflag_user",
      detail: parsed.data.reason ?? null,
    },
  });

  res.json({
    id: user.id,
    email: user.email,
    flagged: user.flagged,
    flaggedReason: user.flaggedReason,
  });
}
