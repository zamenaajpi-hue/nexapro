import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const ownerEmail = process.env.NEXA_OWNER_EMAIL;
  const ownerPassword = process.env.NEXA_OWNER_PASSWORD;
  const ownerNickname = process.env.NEXA_OWNER_NICKNAME || 'OWNER';

  if (ownerEmail && ownerPassword) {
    const passwordHash = await bcrypt.hash(ownerPassword, 10);
    const owner = await prisma.user.upsert({
      where: { nickname: ownerNickname },
      update: {
        email: ownerEmail,
        role: 'owner',
        passwordHash,
        balance: 1000000,
      },
      create: {
        nickname: ownerNickname,
        email: ownerEmail,
        passwordHash,
        role: 'owner',
        avatarColor: '#FFD700',
        initials: 'OW',
        balance: 1000000,
      },
    });

    console.log(`Owner user ensured: ${owner.nickname} (${owner.id})`);
  } else {
    console.log('Skipping owner seed. Set NEXA_OWNER_EMAIL and NEXA_OWNER_PASSWORD to create one.');
  }

  // Create some initial Marketplace Avatars
  const avatars = [
    { name: 'Neon Cyber', price: 50, imageUrl: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=neon' },
    { name: 'Gold Crown', price: 200, imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=gold' },
    { name: 'Diamond Shield', price: 500, imageUrl: 'https://api.dicebear.com/7.x/identicon/svg?seed=diamond' },
    { name: 'Ruby Heart', price: 150, imageUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=ruby' },
  ];

  for (const avatar of avatars) {
    await prisma.avatarItem.upsert({
      where: { id: avatar.name }, // Hack: using name as ID for seeding stability or just create
      update: {},
      create: {
        id: avatar.name,
        name: avatar.name,
        price: avatar.price,
        imageUrl: avatar.imageUrl,
      },
    });
  }

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
