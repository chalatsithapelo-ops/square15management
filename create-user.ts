import { PrismaClient } from '@prisma/client';
import bcryptjs from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcryptjs.hash('1991Slowmo*', 10);
  
  const user = await prisma.user.upsert({
    where: { email: 'chalatsithapelo@gmail.com' },
    update: {},
    create: {
      email: 'chalatsithapelo@gmail.com',
      password: hashedPassword,
      firstName: 'Thapelo',
      lastName: 'Chalatsit',
      role: 'SENIOR_ADMIN',
      phone: '+27123456789',
    },
  });
  
  console.log('User created/updated:', user.email, user.role);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
