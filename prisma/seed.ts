import { PrismaClient, UserRole } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Admin yaratish (Telegram ID o'zgartirasiz)
  const adminTelegramId = process.env.ADMIN_TELEGRAM_IDS?.split(",")[0]?.trim();
  if (adminTelegramId) {
    await prisma.user.upsert({
      where: { telegramId: adminTelegramId },
      update: { role: UserRole.ADMIN },
      create: {
        telegramId: adminTelegramId,
        firstName: "Admin",
        role: UserRole.ADMIN,
      },
    });
    console.log(`✅ Admin yaratildi: ${adminTelegramId}`);
  }

  // Default settings
  await prisma.appSetting.upsert({
    where: { key: "maintenance_mode" },
    update: {},
    create: { key: "maintenance_mode", value: "false" },
  });
  await prisma.appSetting.upsert({
    where: { key: "maintenance_message" },
    update: {},
    create: {
      key: "maintenance_message",
      value: "🛠 Botda texnik ishlar ketmoqda. Tez orada qaytamiz!",
    },
  });

  console.log("✅ Default settings yaratildi");
}

main().finally(() => prisma.$disconnect());