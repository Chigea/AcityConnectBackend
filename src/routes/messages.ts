import type { Response } from "express";
import { z } from "zod";
import type { AuthedRequest } from "../middleware/auth.js";
import { prisma } from "../prisma.js";
import { ModerationStatus } from "@prisma/client";

const msgSchema = z.object({ body: z.string().min(1).max(8000) });

export async function getConversations(req: AuthedRequest, res: Response): Promise<void> {
  const uid = req.userId!;
  const rows = await prisma.conversation.findMany({
    where: { OR: [{ buyerId: uid }, { listing: { sellerId: uid } }] },
    include: {
      listing: {
        select: {
          id: true,
          title: true,
          sellerId: true,
          moderationStatus: true,
          flagged: true,
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { sender: { select: { id: true, displayName: true } } },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  const filtered = rows.filter((c) => c.listing && !c.listing.flagged);
  res.json({ conversations: filtered });
}

export async function postConversation(req: AuthedRequest, res: Response): Promise<void> {
  const body = z.object({ listingId: z.string().uuid() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.flatten() });
    return;
  }
  const { listingId } = body.data;
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
  });
  if (!listing || listing.flagged || listing.moderationStatus !== ModerationStatus.approved) {
    res.status(404).json({ error: "Listing unavailable" });
    return;
  }
  if (listing.sellerId === req.userId) {
    res.status(400).json({ error: "Use incoming messages view as seller" });
    return;
  }

  const conv = await prisma.conversation.upsert({
    where: {
      listingId_buyerId: {
        listingId,
        buyerId: req.userId!,
      },
    },
    create: {
      listingId,
      buyerId: req.userId!,
    },
    update: {},
    include: { listing: true },
  });
  res.status(201).json(conv);
}

export async function getMessages(req: AuthedRequest, res: Response): Promise<void> {
  const cid = req.params.id as string;
  const uid = req.userId!;

  const conv = await prisma.conversation.findUnique({
    where: { id: cid },
    include: { listing: true },
  });
  if (!conv) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const isBuyer = conv.buyerId === uid;
  const isSeller = conv.listing.sellerId === uid;
  if (!isBuyer && !isSeller) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const messages = await prisma.message.findMany({
    where: { conversationId: cid },
    orderBy: { createdAt: "asc" },
    include: { sender: { select: { id: true, displayName: true, email: true } } },
    take: 200,
  });
  res.json({ messages });
}

export async function postMessage(req: AuthedRequest, res: Response): Promise<void> {
  const cid = req.params.id as string;
  const parsed = msgSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const conv = await prisma.conversation.findUnique({
    where: { id: cid },
    include: { listing: true },
  });
  if (!conv) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const uid = req.userId!;
  const isBuyer = conv.buyerId === uid;
  const isSeller = conv.listing.sellerId === uid;
  if (!isBuyer && !isSeller) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const message = await prisma.message.create({
    data: {
      conversationId: cid,
      senderId: uid,
      body: parsed.data.body,
    },
    include: { sender: { select: { id: true, displayName: true, email: true } } },
  });

  await prisma.conversation.update({
    where: { id: cid },
    data: { updatedAt: new Date() },
  });

  res.status(201).json(message);
}
