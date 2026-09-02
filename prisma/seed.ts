import { DegreeType, PrismaClient, Role, UserStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env['DATABASE_URL'];
if (connectionString === undefined || connectionString.length === 0) {
  throw new Error('DATABASE_URL is required to seed the database');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const department = await prisma.department.upsert({
    where: { code: 'CSE' },
    update: {},
    create: {
      code: 'CSE',
      name: 'Computer Science and Engineering',
      contactEmail: 'cse@bidyapith.edu',
    },
  });

  const program = await prisma.program.upsert({
    where: { code: 'BSC-CSE' },
    update: {},
    create: {
      code: 'BSC-CSE',
      name: 'B.Sc. in Computer Science and Engineering',
      departmentId: department.id,
      degreeType: DegreeType.BSC,
      totalCredits: 140,
      durationYears: 4,
      minCreditsPerSemester: 9,
      maxCreditsPerSemester: 15,
      feePerCredit: '4500.00',
      registrationFee: '5000.00',
    },
  });

  const adminPassword = await bcrypt.hash('Admin1234', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@bidyapith.edu' },
    update: {},
    create: {
      firstName: 'System',
      lastName: 'Admin',
      email: 'admin@bidyapith.edu',
      password: adminPassword,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: true,
    },
  });

  console.log(`Seeded department ${department.code} (${department.id})`);
  console.log(`Seeded program ${program.code} (${program.id})`);
  console.log(`Seeded admin ${admin.email} (${admin.id})`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
