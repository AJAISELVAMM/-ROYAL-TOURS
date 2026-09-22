import prisma from '../src/config/database.js';

export function generateJoinCode(destination = '') {
  const cleanDest = (destination || '').replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 4);
  const prefix = cleanDest.length >= 3 ? cleanDest : 'ROYAL';
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let suffix = '';
  const length = prefix.length === 3 ? 4 : 3;
  for (let i = 0; i < length; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}${suffix}`;
}

async function runBackfill() {
  console.log('--- Starting Safe Join Code Migration & Backfill ---');
  
  // 1. Ensure column exists in PostgreSQL
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "joinCode" TEXT;`);
    console.log('Verified column "joinCode" in table "trips".');
  } catch (err) {
    console.error('Error ensuring column:', err.message);
  }

  // 2. Fetch all trips that currently lack a joinCode
  const tripsWithoutCode = await prisma.$queryRawUnsafe(`
    SELECT "id", "destination" FROM "trips" WHERE "joinCode" IS NULL OR "joinCode" = '';
  `);

  console.log(`Found ${tripsWithoutCode.length} trips requiring a unique joinCode.`);

  const usedCodes = new Set();
  const existingWithCode = await prisma.$queryRawUnsafe(`
    SELECT "joinCode" FROM "trips" WHERE "joinCode" IS NOT NULL AND "joinCode" != '';
  `);
  existingWithCode.forEach((r) => usedCodes.add(r.joinCode.toUpperCase()));

  let updatedCount = 0;
  for (const t of tripsWithoutCode) {
    let code = '';
    let attempts = 0;
    while (!code || usedCodes.has(code)) {
      code = generateJoinCode(t.destination);
      attempts++;
      if (attempts > 50) {
        code = `ROYAL${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      }
    }
    usedCodes.add(code);

    await prisma.$executeRawUnsafe(`
      UPDATE "trips" SET "joinCode" = $1 WHERE "id" = $2;
    `, code, t.id);

    updatedCount++;
    console.log(`Trip [${t.destination}] (${t.id}) -> joinCode: ${code}`);
  }

  // 3. Ensure unique index
  try {
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "trips_joinCode_key" ON "trips"("joinCode");
    `);
    console.log('Verified unique index "trips_joinCode_key".');
  } catch (err) {
    console.error('Error creating index:', err.message);
  }

  // 4. Verify total and distinct counts
  const total = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM "trips";`);
  const withCode = await prisma.$queryRawUnsafe(`SELECT COUNT("joinCode")::int as count FROM "trips";`);
  const distinctCode = await prisma.$queryRawUnsafe(`SELECT COUNT(DISTINCT "joinCode")::int as count FROM "trips";`);

  console.log('--- Backfill Complete ---');
  console.log(`Total Trips: ${total[0].count}`);
  console.log(`Trips with joinCode: ${withCode[0].count}`);
  console.log(`Distinct joinCodes: ${distinctCode[0].count}`);

  if (total[0].count === distinctCode[0].count) {
    console.log('SUCCESS: All trips have 100% unique joinCodes!');
  } else {
    console.warn('WARNING: Total count and distinct joinCode count do not match.');
  }

  process.exit(0);
}

runBackfill().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
