import {
  ListingCategory,
  ListingStatus,
  ModerationStatus,
  SkillSubtype,
  Prisma,
} from "@prisma/client";
import type { Response, Request } from "express";
import { z } from "zod";
import type { AuthedRequest } from "../middleware/auth.js";
import { prisma } from "../prisma.js";

const sellerPick = {
  id: true,
  displayName: true,
  email: true,
} as const;

const createListingSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(8000),
  category: z.nativeEnum(ListingCategory),
  skillSubtype: z.nativeEnum(SkillSubtype).optional().nullable(),
  status: z.nativeEnum(ListingStatus).optional(),
});

function visibilityFilter(
  userId: string | null | undefined,
  isAdmin: boolean
): Prisma.ListingWhereInput {
  if (isAdmin) return {};
  if (userId) {
    return {
      OR: [
        { moderationStatus: ModerationStatus.approved },
        { sellerId: userId },
      ],
    };
  }
  return { moderationStatus: ModerationStatus.approved };
}

export async function getListings(req: Request, res: Response): Promise<void> {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const categoryStr = typeof req.query.category === "string" ? req.query.category : undefined;
  const statusStr = typeof req.query.status === "string" ? req.query.status : undefined;

  const optionalUser = (req as AuthedRequest).userId;
  const isAdmin = (req as AuthedRequest).userRole === "admin";

  const categoryParsed = categoryStr
    ? safeEnum(ListingCategory, categoryStr)
    : undefined;
  const statusParsed = statusStr ? safeEnum(ListingStatus, statusStr) : undefined;

  let moderationFilter: Prisma.ListingWhereInput = {};
  if (req.query.moderation === "pending" && isAdmin) {
    moderationFilter = { moderationStatus: ModerationStatus.pending };
  }

  const textFilter = q
    ? {
        OR: [
          { title: { contains: q, mode: "insensitive" as const } },
          { description: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const categoryFilter =
    categoryParsed !== undefined ? { category: categoryParsed } : {};
  const statusFilter = statusParsed !== undefined ? { status: statusParsed } : {};

  const where: Prisma.ListingWhereInput = {
    AND: [
      visibilityFilter(optionalUser ?? null, isAdmin),
      textFilter,
      categoryFilter,
      statusFilter,
      moderationFilter,
      { flagged: false },
    ],
  };

  const listings = await prisma.listing.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { seller: { select: sellerPick } },
    take: 100,
  });
  res.json({ listings: listings.map(serialiseListing) });
}

function safeEnum<T extends Record<string, string>>(en: T, raw: string): T[keyof T] | undefined {
  const v = Object.values(en).find((x) => x === raw.toLowerCase());
  return v as T[keyof T] | undefined;
}

export async function postListing(req: AuthedRequest, res: Response): Promise<void> {
  const parsed = createListingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { category, skillSubtype } = parsed.data;
  if (category === ListingCategory.skill && !skillSubtype) {
    res.status(400).json({ error: "skillSubtype required for skill listings" });
    return;
  }
  if (category === ListingCategory.item && skillSubtype) {
    res.status(400).json({ error: "skillSubtype only for skill category" });
    return;
  }

  const listing = await prisma.listing.create({
    data: {
      sellerId: req.userId!,
      title: parsed.data.title,
      description: parsed.data.description,
      category,
      skillSubtype: skillSubtype ?? undefined,
      status: parsed.data.status ?? ListingStatus.available,
      moderationStatus: ModerationStatus.pending,
    },
    include: { seller: { select: sellerPick } },
  });
  res.status(201).json(serialiseListing(listing));
}

export async function getListing(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const optionalUser = (req as AuthedRequest).userId;
  const isAdmin = (req as AuthedRequest).userRole === "admin";

  const listing = await prisma.listing.findUnique({
    where: { id },
    include: { seller: { select: sellerPick } },
  });
  if (!listing) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const canSee =
    isAdmin ||
    listing.moderationStatus === ModerationStatus.approved ||
    listing.sellerId === optionalUser;
  if (!canSee || listing.flagged) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(serialiseListing(listing));
}

const patchListingSchema = createListingSchema.partial().extend({
  moderationStatus: z.nativeEnum(ModerationStatus).optional(),
  flagged: z.boolean().optional(),
});

export async function patchListing(req: AuthedRequest, res: Response): Promise<void> {
  const id = req.params.id as string;
  const parsed = patchListingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const existing = await prisma.listing.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const isOwner = existing.sellerId === req.userId;
  const isAdmin = req.userRole === "admin";
  if (!isOwner && !isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (!isAdmin && (parsed.data.moderationStatus !== undefined || parsed.data.flagged !== undefined)) {
    res.status(403).json({ error: "Only admins can moderate" });
    return;
  }

  const listing = await prisma.listing.update({
    where: { id },
    data: {
      ...(parsed.data.title !== undefined && { title: parsed.data.title }),
      ...(parsed.data.description !== undefined && { description: parsed.data.description }),
      ...(parsed.data.category !== undefined && { category: parsed.data.category }),
      ...(parsed.data.skillSubtype !== undefined && {
        skillSubtype: parsed.data.skillSubtype ?? null,
      }),
      ...(parsed.data.status !== undefined && { status: parsed.data.status }),
      ...(parsed.data.moderationStatus !== undefined && {
        moderationStatus: parsed.data.moderationStatus,
      }),
      ...(parsed.data.flagged !== undefined && { flagged: parsed.data.flagged }),
    },
    include: { seller: { select: sellerPick } },
  });
  res.json(serialiseListing(listing));
}

export async function deleteListing(req: AuthedRequest, res: Response): Promise<void> {
  const id = req.params.id as string;
  const existing = await prisma.listing.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const isOwner = existing.sellerId === req.userId;
  const isAdmin = req.userRole === "admin";
  if (!isOwner && !isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  await prisma.listing.delete({ where: { id } });
  res.status(204).send();
}

export function serialiseListing(listing: {
  id: string;
  sellerId: string;
  seller: { id: string; email: string; displayName: string | null };
  title: string;
  description: string;
  category: ListingCategory;
  skillSubtype: SkillSubtype | null;
  status: ListingStatus;
  moderationStatus: ModerationStatus;
  flagged: boolean;
  flaggedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: listing.id,
    sellerId: listing.sellerId,
    seller: listing.seller,
    title: listing.title,
    description: listing.description,
    category: listing.category,
    skillSubtype: listing.skillSubtype,
    status: listing.status,
    moderationStatus: listing.moderationStatus,
    flagged: listing.flagged,
    flaggedReason: listing.flaggedReason,
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt,
  };
}
