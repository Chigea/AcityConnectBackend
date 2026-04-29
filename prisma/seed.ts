/**
 * Seed database with demo accounts and sample listings.
 * Run from backend/: npx prisma db seed
 */
import bcrypt from "bcrypt";
import {
  PrismaClient,
  ListingCategory,
  ListingStatus,
  ModerationStatus,
  SkillSubtype,
  Role,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordPlain = process.env.SEED_PASSWORD ?? "Password123!";
  const hash = await bcrypt.hash(passwordPlain, 10);

  const demoEmail = process.env.SEED_USER_EMAIL ?? "fidelia.chimezie@acity.edu.gh";
  const demo = await prisma.user.upsert({
    where: { email: demoEmail },
    update: {},
    create: {
      email: demoEmail,
      passwordHash: hash,
      displayName: "Fidelia Chimezie",
      bio: "Computer Science · ACITY Connect enthusiast",
      skillsOffered: ["Python tutoring", "Calculus revision"],
      skillsNeeded: ["Graphic design basics"],
      role: Role.user,
    },
  });

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@acity.edu.gh";
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: Role.admin },
    create: {
      email: adminEmail,
      passwordHash: hash,
      displayName: "Platform Admin",
      role: Role.admin,
    },
  });

  await prisma.listing.deleteMany({ where: { sellerId: demo.id } });

  await prisma.listing.createMany({
    data: [
      {
        sellerId: demo.id,
        title: "Discrete Math textbook, 2nd edition",
        description:
          "Light wear, annotated in pencil. Meet on campus weekdays after 4pm.",
        category: ListingCategory.item,
        status: ListingStatus.available,
        moderationStatus: ModerationStatus.approved,
      },
      {
        sellerId: demo.id,
        title: "Offer: React study sessions",
        description:
          "Weekly paired sessions covering components, hooks, and Vite toolchain.",
        category: ListingCategory.skill,
        skillSubtype: SkillSubtype.offer,
        status: ListingStatus.available,
        moderationStatus: ModerationStatus.approved,
      },
      {
        sellerId: demo.id,
        title: "Seeking: DSLR photography basics",
        description:
          "Looking for someone to walk through exposure triangle and Lightroom basics.",
        category: ListingCategory.skill,
        skillSubtype: SkillSubtype.request,
        status: ListingStatus.available,
        moderationStatus: ModerationStatus.pending,
      },
    ],
  });

  console.log(
    JSON.stringify({
      seeded: true,
      user: demo.email,
      admin: admin.email,
      passwordWas: passwordPlain,
    })
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
