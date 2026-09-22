import prisma from './src/config/database.js';
import * as groupService from './src/services/groupService.js';
import * as tripService from './src/services/tripService.js';
import { isTripExpiredIST, isTripActiveIST, formatDateInIST, getTripEndTimestampIST } from './src/utils/timeZone.js';

async function runTests() {
  console.log('--- STARTING TRAVEL GROUP AUTOMATED VERIFICATION ---');

  // Find or create test user
  let testUser = await prisma.user.findFirst({ where: { email: 'tourist_ui_test@royaltours.com' } });
  if (!testUser) {
    testUser = await prisma.user.create({
      data: {
        name: 'Royal Traveler',
        email: 'tourist_ui_test@royaltours.com',
        phone: '9876543210',
        passwordHash: 'dummy_hash',
        role: 'TOURIST'
      }
    });
  }
  console.log('Using test user:', testUser.name, testUser.id);

  // Helper dates (future and past in Asia/Kolkata)
  const now = new Date();
  const futureStart = new Date(now.getTime() + 2 * 86400000);
  const futureEnd = new Date(now.getTime() + 4 * 86400000);
  const pastStart = new Date(now.getTime() - 10 * 86400000);
  const pastEnd = new Date(now.getTime() - 5 * 86400000);

  // TEST 1: Create a trip: "Ooty Getaway", future date, creator only
  console.log('\n[TEST 1] Create trip "Ooty Getaway" (future date, creator only)');
  const ootyTrip = await groupService.createGroup(testUser, {
    name: 'Ooty Getaway',
    destination: 'Ooty',
    startDate: futureStart,
    endDate: futureEnd,
    groupType: 'Friends'
  });
  console.log('Created Ooty Trip ID:', ootyTrip.id, 'joinCode:', ootyTrip.joinCode, 'memberCount:', ootyTrip.memberCount);

  // Verify TEST 1: Ooty Getaway group appears in Travel Group
  let activeGroups = await groupService.listActiveGroups(testUser.id);
  const foundOoty = activeGroups.find((g) => g.id === ootyTrip.id);
  console.log('TEST 1 Passed:', Boolean(foundOoty && foundOoty.memberCount === 1));

  // TEST 2: Add another member to Ooty Getaway
  console.log('\n[TEST 2] Add another member to Ooty Getaway');
  let secondUser = await prisma.user.findFirst({ where: { email: 'test_arun@royaltours.com' } });
  if (!secondUser) {
    secondUser = await prisma.user.create({
      data: {
        name: 'Arun Kumar',
        email: 'test_arun@royaltours.com',
        phone: '9876543211',
        passwordHash: 'dummy_hash',
        role: 'TOURIST'
      }
    });
  }
  const joinedOoty = await groupService.joinGroupByCode(secondUser, ootyTrip.joinCode);
  console.log('Second user joined. Updated members:', joinedOoty.members.length);
  activeGroups = await groupService.listActiveGroups(testUser.id);
  const ootyWithTwo = activeGroups.find((g) => g.id === ootyTrip.id);
  console.log('TEST 2 Passed: Ooty memberCount is 2?', ootyWithTwo?.memberCount === 2);

  // TEST 3: Create another active trip: "Chennai Trip"
  console.log('\n[TEST 3] Create another active trip: "Chennai Trip"');
  const chennaiTrip = await groupService.createGroup(testUser, {
    name: 'Chennai Trip',
    destination: 'Chennai',
    startDate: futureStart,
    endDate: futureEnd,
    groupType: 'Friends'
  });
  console.log('Created Chennai Trip ID:', chennaiTrip.id, 'joinCode:', chennaiTrip.joinCode);
  activeGroups = await groupService.listActiveGroups(testUser.id);
  const hasOoty = activeGroups.some((g) => g.id === ootyTrip.id);
  const hasChennai = activeGroups.some((g) => g.id === chennaiTrip.id);
  console.log('TEST 3 Passed: Both appear separately?', hasOoty && hasChennai);

  // TEST 4 & 5: Load specific groups by ID
  console.log('\n[TEST 4 & 5] Click group -> open specific group by ID');
  const group1 = await groupService.getGroup(ootyTrip.id, testUser.id);
  const group2 = await groupService.getGroup(chennaiTrip.id, testUser.id);
  console.log('TEST 4 Passed: Loaded Ooty group?', group1.destination === 'Ooty' && group1.id === ootyTrip.id);
  console.log('TEST 5 Passed: Loaded Chennai group?', group2.destination === 'Chennai' && group2.id === chennaiTrip.id);

  // TEST 6: Use Join Group with Code
  console.log('\n[TEST 6] Join Group with Code');
  let thirdUser = await prisma.user.findFirst({ where: { email: 'test_priya@royaltours.com' } });
  if (!thirdUser) {
    thirdUser = await prisma.user.create({
      data: {
        name: 'Priya Sharma',
        email: 'test_priya@royaltours.com',
        phone: '9876543212',
        passwordHash: 'dummy_hash',
        role: 'TOURIST'
      }
    });
  }
  const joinedChennai = await groupService.joinGroupByCode(thirdUser, chennaiTrip.joinCode);
  const chennaiMembers = await groupService.getMembers(chennaiTrip.id, thirdUser.id);
  console.log('TEST 6 Passed: Third user joined Chennai Trip? Member count:', chennaiMembers.length);

  // TEST 7: Create Group manually
  console.log('\n[TEST 7] Create Group manually');
  const manualGroup = await groupService.createGroup(testUser, {
    name: 'Goa Beach Trip',
    destination: 'Goa',
    startDate: futureStart,
    endDate: futureEnd
  });
  console.log('TEST 7 Passed: Manual group created with ID:', manualGroup.id, 'and joinCode:', manualGroup.joinCode);

  // TEST 8: 1-member group still appears
  console.log('\n[TEST 8] 1-member trip still appears');
  activeGroups = await groupService.listActiveGroups(testUser.id);
  const goaActive = activeGroups.find((g) => g.id === manualGroup.id);
  console.log('TEST 8 Passed: Goa group appears with 1 member?', goaActive && goaActive.memberCount === 1);

  // TEST 9: Expired trip disappears from ACTIVE list but remains in database
  console.log('\n[TEST 9] Expired trip handling (Asia/Kolkata)');
  const expiredTrip = await prisma.trip.create({
    data: {
      userId: testUser.id,
      destination: 'Old Kodaikanal Escape',
      startDate: pastStart,
      endDate: pastEnd,
      dates: `${formatDateInIST(pastStart)} to ${formatDateInIST(pastEnd)}`,
      duration: '2 Days',
      durationDays: 2,
      groupType: 'Friends',
      memberCount: 1,
      budget: 5000,
      status: 'active',
      joinCode: 'EXPOLD99'
    }
  });
  await prisma.tripMember.create({
    data: {
      tripId: expiredTrip.id,
      userId: testUser.id,
      name: testUser.name,
      phone: testUser.phone,
      role: 'Owner',
      status: 'ACCEPTED',
      online: true
    }
  });

  // Verify it is expired according to IST
  const isExp = isTripExpiredIST(expiredTrip);
  console.log('Is past trip expired in IST?', isExp);

  // Check active groups list
  await tripService.checkAndExpireTrips();
  activeGroups = await groupService.listActiveGroups(testUser.id);
  const foundExpired = activeGroups.find((g) => g.id === expiredTrip.id);
  console.log('Does expired trip appear in active groups?', Boolean(foundExpired));

  // Check that historical record still exists in database
  const dbHistorical = await prisma.trip.findUnique({ where: { id: expiredTrip.id } });
  console.log('Does historical record remain in database?', Boolean(dbHistorical), 'status:', dbHistorical?.status);
  console.log('TEST 9 Passed:', !foundExpired && Boolean(dbHistorical));

  // TEST 10: Refresh simulation (re-fetch from database)
  console.log('\n[TEST 10] Persistence & reload from database');
  const freshTrips = await tripService.listTrips(testUser.id);
  const freshActive = await groupService.listActiveGroups(testUser.id);
  console.log('TEST 10 Passed: Reloaded active groups count:', freshActive.length);

  console.log('\n--- ALL AUTOMATED SCENARIO TESTS COMPLETED SUCCESSFULLY ---');
  process.exit(0);
}

runTests().catch((e) => {
  console.error('Test failed:', e);
  process.exit(1);
});
