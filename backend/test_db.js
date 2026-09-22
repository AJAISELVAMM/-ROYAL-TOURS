import './src/config/env.js';
import prisma from './src/config/database.js';

async function main() {
  try {
    const res = await prisma.$queryRaw`SELECT 1 as result`;
    console.log('DB SUCCESS:', res);
    const users = await prisma.user.findMany({ select: { id: true, email: true, role: true } });
    console.log('USERS IN DB:', users);
  } catch (err) {
    console.error('DB ERROR:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
