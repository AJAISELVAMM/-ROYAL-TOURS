// =============================================================================
// TourGuard AI — database seed
// Migrates the catalog data (places/hotels/restaurants/theatres/shopping/
// transport), demo tourists, emergency contacts and ONE authorized admin into
// PostgreSQL/SQLite via Prisma. Passwords are bcrypt-hashed at seed time.
//
//   npx prisma db seed        (or: node prisma/seed.js)
//
// Admin credentials are NOT hardcoded: they come from ADMIN_EMAIL and
// ADMIN_PASSWORD_HASH env vars. If ADMIN_PASSWORD_HASH is missing (dev only),
// a default development password "admin@123" is hashed and a warning is
// printed — production deployments MUST set ADMIN_PASSWORD_HASH.
// =============================================================================

import bcrypt from 'bcryptjs';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@tourguard.ai';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || null;

async function main() {
  console.log('Seeding TourGuard AI database…');

  // --- Clean (in dependency-safe order) ---
  await prisma.adminActivityLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.locationShare.deleteMany();
  await prisma.sOSRequest.deleteMany();
  await prisma.safetyAlert.deleteMany();
  await prisma.travelReport.deleteMany();
  await prisma.packingItem.deleteMany();
  await prisma.packingDay.deleteMany();
  await prisma.itineraryActivity.deleteMany();
  await prisma.itineraryDay.deleteMany();
  await prisma.tripBudget.deleteMany();
  await prisma.tripPlace.deleteMany();
  await prisma.tripMember.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.theatreShow.deleteMany();
  await prisma.theatre.deleteMany();
  await prisma.transportRoute.deleteMany();
  await prisma.shopping.deleteMany();
  await prisma.restaurant.deleteMany();
  await prisma.hotel.deleteMany();
  await prisma.place.deleteMany();
  await prisma.emergencyContact.deleteMany();
  await prisma.intelligenceFeedback.deleteMany();
  await prisma.predictionLog.deleteMany();
  await prisma.intelligenceModel.deleteMany();
  await prisma.emergencyService.deleteMany();
  await prisma.oTPVerification.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  // --- Admin ---
  let adminHash = ADMIN_PASSWORD_HASH;
  if (!adminHash) {
    console.warn(
      '⚠️  ADMIN_PASSWORD_HASH not set — seeding a DEV admin with password "admin@123". Set ADMIN_PASSWORD_HASH in production.'
    );
    adminHash = bcrypt.hashSync('admin@123', 10);
  }
  const admin = await prisma.user.create({
    data: {
      name: 'TourGuard Admin',
      email: ADMIN_EMAIL,
      phone: '0000000000',
      passwordHash: adminHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      phoneVerified: true
    }
  });

  // --- Demo tourists ---
  const touristPass = bcrypt.hashSync('tour123', 10);
  const arun = await prisma.user.create({
    data: {
      name: 'Arun Kumar',
      email: 'arun@example.com',
      phone: '9876543210',
      passwordHash: touristPass,
      role: 'TOURIST',
      status: 'ACTIVE',
      phoneVerified: true
    }
  });
  await prisma.user.create({
    data: {
      name: 'Priya Nair',
      email: 'priya@example.com',
      phone: '9812345670',
      passwordHash: touristPass,
      role: 'TOURIST',
      status: 'ACTIVE',
      phoneVerified: true
    }
  });

  // --- Places (Coimbatore catalog) ---
  const placesData = [
    ['Marudamalai Temple', 'Temple', 4.7, 12, '6:00 AM – 8:00 PM', 'Free', 'A historic hill temple dedicated to Lord Murugan, set on a scenic rocky hill.', 'Marudamalai Hill, Coimbatore', 11.0450, 76.8530],
    ['Gass Forest Museum', 'Museum', 4.4, 3, '9:00 AM – 5:30 PM (closed Fridays)', '₹15', 'One of the oldest natural history museums in South India.', 'Forest College Campus, Coimbatore', 11.0189, 76.9535],
    ['VOC Park & Zoo', 'Park', 4.2, 5, '9:00 AM – 6:00 PM', '₹20', 'A popular family park and mini zoo in the heart of Coimbatore.', 'Park Town, Coimbatore', 11.0065, 76.9680],
    ['Perur Pateeswarar Temple', 'Temple', 4.6, 8, '5:30 AM – 1:00 PM, 4:00 PM – 8:30 PM', 'Free', 'An ancient Shiva temple known for intricate Dravidian carvings.', 'Perur, Coimbatore', 10.9740, 76.9240],
    ['Siruvani Waterfalls', 'Nature', 4.5, 37, '9:00 AM – 5:00 PM', '₹50', 'A scenic waterfall in the Western Ghats.', 'Siruvani Hills, Coimbatore', 10.9392, 76.6853],
    ['Gedee Car Museum', 'Museum', 4.5, 6, '9:00 AM – 5:00 PM (closed Mondays)', '₹100', 'An automobile museum of restored vintage and classic cars.', 'Avinashi Road, Coimbatore', 11.0118, 76.9744],
    ['Eachanari Vinayagar Temple', 'Temple', 4.6, 12, '5:30 AM – 1:00 PM, 4:00 PM – 8:00 PM', 'Free', 'A revered Ganesha temple on the Coimbatore–Pollachi highway.', 'Eachanari, Coimbatore', 10.9168, 76.9690],
    ['Kovai Kondattam', 'Amusement', 4.2, 9, '10:00 AM – 6:00 PM', '₹450', 'A family amusement and water park with thrilling rides.', 'Perur Pathy, Coimbatore', 10.9850, 76.9020]
  ];
  const placeRecords = {};
  for (const [name, category, rating, distanceKm, openingHours, entryPrice, description, location, latitude, longitude] of placesData) {
    const p = await prisma.place.create({
      data: {
        name, category, rating, distanceKm, openingHours, entryPrice, description, location,
        latitude, longitude,
        reviews: 500 + Math.floor(Math.random() * 2000),
        verified: true
      }
    });
    placeRecords[name] = p;
  }

  // --- Hotels ---
  const hotelsData = [
    ['The Grand Residency', 4.6, 4200, 2, 'Free Wi-Fi, Pool, Restaurant, Parking, Spa', 'Avinashi Road, Coimbatore', 11.0118, 76.9690],
    ['Heritage Inn Coimbatore', 4.3, 2600, 4, 'Free Wi-Fi, Breakfast, Parking, Gym', 'Railway Station Road, Coimbatore', 11.0050, 76.9660],
    ['Green Valley Resort', 4.5, 5500, 14, 'Pool, Spa, Restaurant, Garden', 'Marudamalai Road, Coimbatore', 11.0400, 76.8600],
    ['City Lodge Comfort', 3.8, 1200, 3, 'Free Wi-Fi, AC, 24/7 Front Desk', 'Gandhipuram, Coimbatore', 11.0168, 76.9650]
  ];
  for (const [name, rating, price, distanceKm, facilities, location, latitude, longitude] of hotelsData) {
    await prisma.hotel.create({ data: { name, rating, pricePerNight: price, distanceKm, facilities, location, latitude, longitude, verified: true } });
  }

  // --- Restaurants ---
  const restaurantsData = [
    ['Annapoorna Gowrishankar', 4.5, '₹₹', 'South Indian', true, 2, 'RS Puram, Coimbatore', 11.0150, 76.9550],
    ['Hotel Junior Kuppanna', 4.4, '₹₹', 'Chettinad', false, 3, 'Gandhipuram, Coimbatore', 11.0180, 76.9680],
    ['The French Door', 4.3, '₹₹₹', 'Continental', false, 4, 'Race Course, Coimbatore', 11.0070, 76.9750],
    ['Saravana Bhavan', 4.1, '₹', 'South Indian', true, 1, 'Town Hall, Coimbatore', 11.0040, 76.9620]
  ];
  for (const [name, rating, priceRange, cuisine, veg, distanceKm, location, latitude, longitude] of restaurantsData) {
    await prisma.restaurant.create({ data: { name, rating, priceRange, cuisine, veg, distanceKm, location, latitude, longitude, verified: true } });
  }

  // --- Theatres + shows ---
  const kg = await prisma.theatre.create({
    data: { name: 'KG Cinemas', location: 'Race Course, Coimbatore', latitude: 11.0080, longitude: 76.9730, rating: 4.5, distanceKm: 3, verified: true }
  });
  await prisma.theatreShow.createMany({
    data: [
      { theatreId: kg.id, movieTitle: 'Thalapathy 69', language: 'Tamil', format: '2D', duration: '2h 45m', certification: 'U/A', showDate: '2026-09-04', showTime: '10:30 AM', screen: 'Screen 1' },
      { theatreId: kg.id, movieTitle: 'Pushpa 2: The Rule', language: 'Telugu', format: '2D', duration: '3h 20m', certification: 'U/A', showDate: '2026-09-04', showTime: '6:00 PM', screen: 'Screen 2' }
    ]
  });
  const fr = await prisma.theatre.create({
    data: { name: 'Fun Republic Mall Cinemas', location: 'Avinashi Road, Coimbatore', latitude: 11.0250, longitude: 77.0020, rating: 4.4, distanceKm: 4, verified: true }
  });
  await prisma.theatreShow.createMany({
    data: [
      { theatreId: fr.id, movieTitle: 'Inside Out 2', language: 'English', format: '3D', duration: '1h 36m', certification: 'U', showDate: '2026-09-04', showTime: '2:00 PM', screen: 'Screen 3' },
      { theatreId: fr.id, movieTitle: 'Viduthalai 2', language: 'Tamil', format: '2D', duration: '2h 35m', certification: 'A', showDate: '2026-09-04', showTime: '9:30 PM', screen: 'Screen 1' }
    ]
  });
  const theCinema = await prisma.theatre.create({
    data: { name: 'The Cinema @ Brookefields', location: 'Brookefields Mall, Coimbatore', latitude: 11.0080, longitude: 76.9580, rating: 4.2, distanceKm: 5, verified: true }
  });
  await prisma.theatreShow.createMany({
    data: [
      { theatreId: theCinema.id, movieTitle: 'GOAT - Greatest of All Time', language: 'Tamil', format: '2D', duration: '2h 55m', certification: 'U/A', showDate: '2026-09-04', showTime: '11:00 AM', screen: 'Screen 4' }
    ]
  });

  // --- Shopping ---
  const shoppingData = [
    ['Coimbatore Handloom House', 'Handicrafts', 4.4, 2, 'Cross Cut Road, Coimbatore', 11.0170, 76.9630],
    ['Kalanjiyam Crafts', 'Souvenirs', 4.3, 3, 'RS Puram, Coimbatore', 11.0150, 76.9540],
    ['Brookefields Mall', 'Clothing', 4.4, 5, 'Brookefields, Coimbatore', 11.0080, 76.9580],
    ['Town Hall Market', 'Local Products', 4.0, 1, 'Town Hall, Coimbatore', 11.0020, 76.9620]
  ];
  for (const [name, category, rating, distanceKm, location, latitude, longitude] of shoppingData) {
    await prisma.shopping.create({ data: { name, category, rating, distanceKm, location, latitude, longitude, verified: name !== 'Town Hall Market' } });
  }

  // --- Transport routes (demo fallback) ---
  const transportData = [
    ['Bus', 'Railway Station', 'Marudamalai', 25, '42 min', 'Cheapest'],
    ['Taxi', 'Railway Station', 'Marudamalai', 250, '25 min', 'Fastest'],
    ['Walking', 'Railway Station', 'Marudamalai', 0, '3 hr 10 min', 'Eco'],
    ['Auto', 'Railway Station', 'Marudamalai', 140, '32 min', 'Balanced']
  ];
  for (const [mode, from, to, price, duration, label] of transportData) {
    await prisma.transportRoute.create({ data: { mode, from, to, price, duration, label } });
  }

  // --- Emergency contacts (public emergency numbers, not personal) ---
  const contacts = [
    ['TourGuard Safety Desk', '0000000000', 'ADMIN'],
    ['Police Control Room', '100', 'POLICE'],
    ['Ambulance Service', '108', 'MEDICAL'],
    ['Fire & Rescue', '101', 'FIRE']
  ];
  for (const [name, phone, type] of contacts) {
    await prisma.emergencyContact.create({ data: { name, phone, type, active: true } });
  }

  // --- Geocoded emergency services (nearest-help engine) ---
  // Real, publicly-known Coimbatore facilities with real coordinates. Used by
  // the Haversine nearest-service engine and the safety map. source: "seed".
  const emergencyServices = [
    ['Coimbatore Medical College Hospital', 'HOSPITAL', 'Avinashi Road, Coimbatore', 11.0118, 76.9590, '0422-2214041'],
    ['KG Hospital', 'HOSPITAL', 'Government Arts College Road, Coimbatore', 11.0050, 76.9660, '0422-4042121'],
    ['Coimbatore City Police', 'POLICE', 'Town Hall, Coimbatore', 11.0046, 76.9659, '100'],
    ['RS Puram Police Station', 'POLICE', 'RS Puram, Coimbatore', 11.0168, 76.9690, '100'],
    ['Coimbatore Fire & Rescue Service', 'FIRE_STATION', 'Opp. Town Hall, Coimbatore', 11.0047, 76.9662, '101'],
    ['Apollo Pharmacy — RS Puram', 'PHARMACY', 'RS Puram, Coimbatore', 11.0168, 76.9690, '0422-2540000']
  ];
  for (const [name, type, address, latitude, longitude, phone] of emergencyServices) {
    await prisma.emergencyService.create({
      data: { name, type, address, latitude, longitude, phone, active: true, source: 'seed' }
    });
  }

  // --- Sample trip for Arun (matches the frontend demo experience) ---
  const trip = await prisma.trip.create({
    data: {
      userId: arun.id,
      destination: 'Coimbatore',
      from: 'Chennai',
      dates: '2026-09-10 – 2026-09-12',
      duration: '2 Days',
      durationDays: 2,
      groupType: 'Family',
      memberCount: 4,
      budget: 8000
    }
  });
  await prisma.tripMember.createMany({
    data: [
      { tripId: trip.id, userId: arun.id, name: 'Arun Kumar', phone: '9876543210', role: 'Owner' },
      { tripId: trip.id, name: 'Kavi', phone: '9876543211', role: 'Member' },
      { tripId: trip.id, name: 'Rahul', phone: '9876543212', role: 'Member' },
      { tripId: trip.id, name: 'Priya', phone: '9876543213', role: 'Member' }
    ]
  });
  await prisma.tripPlace.createMany({
    data: [
      { tripId: trip.id, placeId: placeRecords['Marudamalai Temple'].id, day: 1 },
      { tripId: trip.id, placeId: placeRecords['VOC Park & Zoo'].id, day: 1 },
      { tripId: trip.id, placeId: placeRecords['Gass Forest Museum'].id, day: 2 }
    ]
  });
  await prisma.tripBudget.create({
    data: { tripId: trip.id, hotel: 2600, food: 1800, transport: 900, entertainment: 1200, attractions: 600 }
  });

  console.log('✅ Seed complete.');
  console.log(`   Admin:    ${ADMIN_EMAIL}`);
  console.log('   Tourist:  arun@example.com / tour123');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
