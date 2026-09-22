import prisma from '../src/config/database.js';

export default async function teardown() {
  await prisma.$disconnect();
}
