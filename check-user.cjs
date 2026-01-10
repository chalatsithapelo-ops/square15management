const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUser() {
  const user5 = await prisma.user.findUnique({
    where: { id: 5 },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true
    }
  });
  
  console.log('User ID 5:', user5);
  
  const user6 = await prisma.user.findUnique({
    where: { id: 6 },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true
    }
  });
  
  console.log('User ID 6 (owns quotations):', user6);
  
  await prisma.$disconnect();
}

checkUser();
