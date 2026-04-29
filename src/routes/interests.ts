import { InterestStatus } from "@prisma/client";
import type { Response } from "express";
import { z } from "zod";
import type { AuthedRequest } from "../middleware/auth.js";
import { prisma } from "../prisma.js";

export async function postInterest(req: AuthedRequest, res: Response): Promise<void> {
  const listingId = req.params.id as string;
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing || listing.flagged) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  if (listing.sellerId === req.userId) {
    res.status(400).json({ error: "Cannot express interest in your own listing" });
    return;
  }

  const interest = await prisma.listingInterest.upsert({
    where: {
      listingId_userId: { listingId, userId: req.userId! },
    },
    create: {
      listingId,
      userId: req.userId!,
      status: InterestStatus.pending,
    },
    update: {
      status: InterestStatus.pending,
    },
  });
  res.status(201).json(interest);
}

const patchInterestSchema = z.object({
  status: z.nativeEnum(InterestStatus),
});

export async function patchInterestOnListing(req: AuthedRequest, res: Response): Promise<void> {
  const listingId = req.params.listingId as string;
  const interestId = req.params.interestId as string;

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing || listing.sellerId !== req.userId) {
    res.status(403).json({ error: "Only the seller can update interest status" });
    return;
  }

  const parsed = patchInterestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const interest = await prisma.listingInterest.findFirst({
    where: { id: interestId, listingId },
  });
  if (!interest) {
    res.status(404).json({ error: "Interest not found" });
    return;
  }

  const updated = await prisma.listingInterest.update({
    where: { id: interestId },
    data: { status: parsed.data.status },
    include: { user: { select: { id: true, displayName: true, email: true } } },
  });
  res.json(updated);
}

export async function getMyInterests(req: AuthedRequest, res: Response): Promise<void> {
  const rows = await prisma.listingInterest.findMany({
    where: { userId: req.userId! },
    orderBy: { updatedAt: "desc" },
    include: {
      listing: {
        include: { seller: { select: { id: true, displayName: true, email: true } } },
      },
    },
    take: 100,
  });
  res.json({ interests: rows });
}

export async function getIncomingInterests(req: AuthedRequest, res: Response): Promise<void> {
  const rows = await prisma.listingInterest.findMany({
    where: { listing: { sellerId: req.userId! } },
    orderBy: { updatedAt: "desc" },
    include: {
      user: { select: { id: true, displayName: true, email: true } },
      listing: true,
    },
    take: 100,
  });
  res.json({ interests: rows });
}
