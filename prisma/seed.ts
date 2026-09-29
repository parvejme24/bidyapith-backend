import { PrismaPg } from '@prisma/adapter-pg';
import {
  AttendanceStatus,
  CourseType,
  DayOfWeek,
  DegreeType,
  Designation,
  EnrollmentStatus,
  ExamType,
  InvoiceStatus,
  InvoiceType,
  LetterGrade,
  OfferingStatus,
  PaymentGateway,
  PaymentStatus,
  Prisma,
  PrismaClient,
  Role,
  SemesterStatus,
  SemesterTerm,
  StudentStatus,
  UserStatus,
} from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const connectionString = process.env['DATABASE_URL'];
if (connectionString === undefined || connectionString.length === 0) {
  throw new Error('DATABASE_URL is required to seed the database');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const ADMIN_PASSWORD = process.env['SEED_ADMIN_PASSWORD'] ?? 'Admin1234';
const TEST_ADMIN_PASSWORD = process.env['SEED_TEST_ADMIN_PASSWORD'] ?? '12345678';
const STUDENT_PASSWORD = 'Student1234';
const INSTRUCTOR_PASSWORD = 'Teach1234';
const BCRYPT_ROUNDS = 10;

const addDays = (base: Date, days: number): Date => {
  const next = new Date(base.getTime());
  next.setDate(next.getDate() + days);
  return next;
};

const UNSPLASH_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544717305-2782549b5136?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1534751516642-a171edd273c6?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1548142813-c348350df52b?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=400&auto=format&fit=crop&q=80',
];

const getAvatar = (idx: number) => UNSPLASH_AVATARS[idx % UNSPLASH_AVATARS.length]!;

const BANGLA_FIRST_NAMES = [
  'Rafiul', 'Ayesha', 'Tanvir', 'Sabina', 'Mahmud', 'Nusrat', 'Kamal', 'Farhana',
  'Shahriar', 'Sadia', 'Rezaul', 'Mitali', 'Nafisa', 'Sharmin', 'Imran', 'Tariq',
  'Farid', 'Tasnim', 'Sabbir', 'Anisur', 'Sumaiya', 'Rakib', 'Nazmul', 'Mehedi',
  'Tahsin', 'Samira', 'Zubair', 'Lamia', 'Fahim', 'Nabila', 'Ahsan', 'Tamanna',
  'Jubayer', 'Ishrat', 'Asif', 'Rubaba', 'Saad', 'Munira', 'Arman', 'Raisa',
  'Shakib', 'Anika', 'Rifat', 'Nafis', 'Suhana', 'Moin', 'Afia', 'Zayan',
  'Rumana', 'Tanzeem', 'Shazia', 'Adnan', 'Zareen', 'Faiaz', 'Bushra', 'Salman',
  'Fariha', 'Habib', 'Sania', 'Rayhan', 'Jannat', 'Mahir', 'Mahira', 'Siam',
  'Suraiya', 'Nahian', 'Tasfia', 'Kazi', 'Mahnur', 'Zawad', 'Samia', 'Ibtisam',
  'Shadman', 'Nawrin', 'Maruf', 'Lubna', 'Tamjid', 'Sadaf', 'Tanjim', 'Afreen',
  'Wasif', 'Nuzhat', 'Farhan', 'Naveed', 'Zubeda', 'Munim', 'Abrar', 'Ateeq',
  'Faheem', 'Samiya', 'Sharaf', 'Nayeed', 'Subah', 'Rownak', 'Sifat', 'Naim'
];

const BANGLA_LAST_NAMES = [
  'Karim', 'Rahman', 'Ahmed', 'Yeasmin', 'Hasan', 'Jahan', 'Hossain', 'Islam',
  'Kabir', 'Noor', 'Karim', 'Saha', 'Haque', 'Akter', 'Chowdhury', 'Hasan',
  'Uddin', 'Khan', 'Mia', 'Reza', 'Binte Karim', 'Huda', 'Alam', 'Mahmood',
  'Talukder', 'Sikder', 'Bhuiyan', 'Molla', 'Mirza', 'Siddiqui', 'Majumder', 'Dewan'
];

const DEPARTMENTS_DATA = [
  { code: 'CSE', name: 'Computer Science and Engineering', email: 'cse@bidyapith.edu' },
  { code: 'EEE', name: 'Electrical and Electronic Engineering', email: 'eee@bidyapith.edu' },
  { code: 'CIV', name: 'Civil and Environmental Engineering', email: 'civ@bidyapith.edu' },
  { code: 'BBA', name: 'Business Administration', email: 'bba@bidyapith.edu' },
  { code: 'ECO', name: 'Economics', email: 'eco@bidyapith.edu' },
  { code: 'PHY', name: 'Physics', email: 'phy@bidyapith.edu' },
  { code: 'MAT', name: 'Mathematics', email: 'mat@bidyapith.edu' },
  { code: 'ENG', name: 'English and Modern Languages', email: 'eng@bidyapith.edu' },
  { code: 'LAW', name: 'Law and Justice', email: 'law@bidyapith.edu' },
  { code: 'PHA', name: 'Pharmacy and Health Sciences', email: 'pha@bidyapith.edu' },
];

const PROGRAMS_DATA = [
  { code: 'BSC-CSE', name: 'B.Sc. in Computer Science and Engineering', dept: 'CSE', degree: DegreeType.BSC, credits: 140, years: 4, fee: '4500.00', regFee: '5000.00' },
  { code: 'MSC-CSE', name: 'M.Sc. in Computer Science and Engineering', dept: 'CSE', degree: DegreeType.MSC, credits: 36, years: 2, fee: '6000.00', regFee: '8000.00' },
  { code: 'BSC-EEE', name: 'B.Sc. in Electrical and Electronic Engineering', dept: 'EEE', degree: DegreeType.BSC, credits: 144, years: 4, fee: '4200.00', regFee: '5000.00' },
  { code: 'BSC-CIV', name: 'B.Sc. in Civil Engineering', dept: 'CIV', degree: DegreeType.BSC, credits: 142, years: 4, fee: '4000.00', regFee: '5000.00' },
  { code: 'BBA-GEN', name: 'Bachelor of Business Administration', dept: 'BBA', degree: DegreeType.BBA, credits: 128, years: 4, fee: '3800.00', regFee: '4000.00' },
  { code: 'MBA-EXE', name: 'Executive Master of Business Administration', dept: 'BBA', degree: DegreeType.MBA, credits: 48, years: 2, fee: '5500.00', regFee: '6000.00' },
  { code: 'BSC-MAT', name: 'B.Sc. in Mathematics', dept: 'MAT', degree: DegreeType.BSC, credits: 128, years: 4, fee: '3500.00', regFee: '4000.00' },
  { code: 'BSC-PHY', name: 'B.Sc. in Physics', dept: 'PHY', degree: DegreeType.BSC, credits: 130, years: 4, fee: '3500.00', regFee: '4000.00' },
  { code: 'BA-ENG', name: 'B.A. (Hons) in English Literature', dept: 'ENG', degree: DegreeType.BA, credits: 124, years: 4, fee: '3200.00', regFee: '3500.00' },
  { code: 'LLB-HON', name: 'LL.B. (Honours)', dept: 'LAW', degree: DegreeType.BA, credits: 136, years: 4, fee: '4000.00', regFee: '4500.00' },
  { code: 'BPH-PRO', name: 'Bachelor of Pharmacy (Professional)', dept: 'PHA', degree: DegreeType.BSC, credits: 160, years: 5, fee: '4800.00', regFee: '5500.00' },
  { code: 'BSS-ECO', name: 'B.S.S. in Economics', dept: 'ECO', degree: DegreeType.BBA, credits: 126, years: 4, fee: '3600.00', regFee: '4000.00' },
];

const COURSES_DATA = [
  { code: 'CSE-1101', title: 'Introduction to Programming', credits: '3.0', type: CourseType.CORE, level: 1, dept: 'CSE' },
  { code: 'CSE-1102', title: 'Programming Laboratory', credits: '1.5', type: CourseType.LAB, level: 1, dept: 'CSE' },
  { code: 'CSE-1201', title: 'Discrete Mathematics', credits: '3.0', type: CourseType.CORE, level: 1, dept: 'CSE' },
  { code: 'CSE-2201', title: 'Data Structures and Algorithms', credits: '3.0', type: CourseType.CORE, level: 2, dept: 'CSE' },
  { code: 'CSE-2202', title: 'Object-Oriented Programming', credits: '3.0', type: CourseType.CORE, level: 2, dept: 'CSE' },
  { code: 'CSE-2303', title: 'Database Systems', credits: '3.0', type: CourseType.CORE, level: 2, dept: 'CSE' },
  { code: 'CSE-3201', title: 'Software Engineering', credits: '3.0', type: CourseType.CORE, level: 3, dept: 'CSE' },
  { code: 'CSE-3301', title: 'Design & Analysis of Algorithms', credits: '3.0', type: CourseType.CORE, level: 3, dept: 'CSE' },
  { code: 'CSE-3303', title: 'Operating Systems', credits: '3.0', type: CourseType.CORE, level: 3, dept: 'CSE' },
  { code: 'CSE-4108', title: 'Artificial Intelligence & Machine Learning', credits: '3.0', type: CourseType.ELECTIVE, level: 4, dept: 'CSE' },
  { code: 'CSE-4401', title: 'Compiler Design', credits: '3.0', type: CourseType.CORE, level: 4, dept: 'CSE' },
  
  { code: 'EEE-1101', title: 'Basic Electrical Engineering', credits: '3.0', type: CourseType.CORE, level: 1, dept: 'EEE' },
  { code: 'EEE-2104', title: 'Circuit Analysis II', credits: '3.0', type: CourseType.CORE, level: 2, dept: 'EEE' },
  { code: 'EEE-3301', title: 'Power System Engineering', credits: '3.0', type: CourseType.CORE, level: 3, dept: 'EEE' },
  { code: 'EEE-4205', title: 'VLSI Design & Embedded Systems', credits: '3.0', type: CourseType.ELECTIVE, level: 4, dept: 'EEE' },

  { code: 'CIV-1101', title: 'Engineering Mechanics', credits: '3.0', type: CourseType.CORE, level: 1, dept: 'CIV' },
  { code: 'CIV-2107', title: 'Structural Mechanics', credits: '3.0', type: CourseType.CORE, level: 2, dept: 'CIV' },
  { code: 'CIV-3204', title: 'Geotechnical Engineering', credits: '4.0', type: CourseType.CORE, level: 3, dept: 'CIV' },

  { code: 'BBA-1101', title: 'Principles of Management', credits: '3.0', type: CourseType.CORE, level: 1, dept: 'BBA' },
  { code: 'BBA-2103', title: 'Financial Accounting', credits: '3.0', type: CourseType.CORE, level: 2, dept: 'BBA' },
  { code: 'BBA-3104', title: 'Corporate Finance', credits: '3.0', type: CourseType.CORE, level: 3, dept: 'BBA' },
  { code: 'BBA-3208', title: 'Consumer Behaviour & Marketing', credits: '3.0', type: CourseType.CORE, level: 3, dept: 'BBA' },

  { code: 'MAT-1101', title: 'Differential & Integral Calculus', credits: '3.0', type: CourseType.CORE, level: 1, dept: 'MAT' },
  { code: 'MAT-1201', title: 'Coordinate Geometry & Vectors', credits: '3.0', type: CourseType.CORE, level: 1, dept: 'MAT' },
  { code: 'MAT-2101', title: 'Linear Algebra', credits: '3.0', type: CourseType.CORE, level: 2, dept: 'MAT' },
  { code: 'MAT-2201', title: 'Probability and Statistics', credits: '3.0', type: CourseType.CORE, level: 2, dept: 'MAT' },
  { code: 'MAT-3204', title: 'Numerical Analysis', credits: '3.0', type: CourseType.CORE, level: 3, dept: 'MAT' },

  { code: 'PHY-1101', title: 'Physics I (Mechanics & Waves)', credits: '3.0', type: CourseType.CORE, level: 1, dept: 'PHY' },
  { code: 'PHY-2201', title: 'Quantum Mechanics I', credits: '3.0', type: CourseType.CORE, level: 2, dept: 'PHY' },
  { code: 'PHY-3106', title: 'Computational Physics', credits: '3.0', type: CourseType.ELECTIVE, level: 3, dept: 'PHY' },

  { code: 'ENG-1101', title: 'English Reading and Composition', credits: '3.0', type: CourseType.CORE, level: 1, dept: 'ENG' },
  { code: 'ENG-2105', title: 'Postcolonial Literature', credits: '3.0', type: CourseType.CORE, level: 2, dept: 'ENG' },

  { code: 'LAW-1101', title: 'Jurisprudence & Legal Theory', credits: '3.0', type: CourseType.CORE, level: 1, dept: 'LAW' },
  { code: 'LAW-2201', title: 'Constitutional Law of Bangladesh', credits: '4.0', type: CourseType.CORE, level: 2, dept: 'LAW' },

  { code: 'PHA-1101', title: 'Inorganic Pharmacy', credits: '3.0', type: CourseType.CORE, level: 1, dept: 'PHA' },
  { code: 'PHA-3105', title: 'Pharmacology and Therapeutics', credits: '4.0', type: CourseType.CORE, level: 3, dept: 'PHA' },

  { code: 'ECO-1101', title: 'Principles of Microeconomics', credits: '3.0', type: CourseType.CORE, level: 1, dept: 'ECO' },
  { code: 'ECO-2102', title: 'Intermediate Macroeconomics', credits: '3.0', type: CourseType.CORE, level: 2, dept: 'ECO' },
  { code: 'ECO-4103', title: 'Applied Econometrics', credits: '4.0', type: CourseType.CORE, level: 4, dept: 'ECO' },
];

const INSTRUCTORS_DATA = [
  { email: 'ayesha.rahman@bidyapith.edu', first: 'Ayesha', last: 'Rahman', dept: 'CSE', des: Designation.PROFESSOR, spec: 'Distributed Systems & Cloud Computing', phone: '+880 1700-000000' },
  { email: 'tanvir.ahmed@bidyapith.edu', first: 'Tanvir', last: 'Ahmed', dept: 'CSE', des: Designation.ASSOCIATE_PROFESSOR, spec: 'Database Systems & Big Data', phone: '+8801711223345' },
  { email: 'nafisa.haque@bidyapith.edu', first: 'Nafisa', last: 'Haque', dept: 'CSE', des: Designation.ASSISTANT_PROFESSOR, spec: 'Machine Learning & NLP', phone: '+8801711223346' },
  { email: 'sabbir.rahman@bidyapith.edu', first: 'Sabbir', last: 'Rahman', dept: 'CSE', des: Designation.ASSISTANT_PROFESSOR, spec: 'Operating Systems & Networks', phone: '+8801711223347' },
  { email: 'mahmud.hasan@bidyapith.edu', first: 'Mahmud', last: 'Hasan', dept: 'CSE', des: Designation.PROFESSOR, spec: 'Algorithms & Theoretical CS', phone: '+8801711223348' },
  { email: 'sabina.yasmin@bidyapith.edu', first: 'Sabina', last: 'Yasmin', dept: 'CSE', des: Designation.LECTURER, spec: 'Software Engineering & Web Technologies', phone: '+8801711223349' },

  { email: 'kamal.hossain@bidyapith.edu', first: 'Kamal', last: 'Hossain', dept: 'EEE', des: Designation.PROFESSOR, spec: 'Power Systems & Smart Grids', phone: '+8801811223350' },
  { email: 'rubel.mia@bidyapith.edu', first: 'Rubel', last: 'Mia', dept: 'EEE', des: Designation.ASSOCIATE_PROFESSOR, spec: 'VLSI Design & Semiconductors', phone: '+8801811223351' },
  { email: 'farhana.tasnim@bidyapith.edu', first: 'Farhana', last: 'Tasnim', dept: 'EEE', des: Designation.ASSISTANT_PROFESSOR, spec: 'Renewable Energy & IoT', phone: '+8801811223352' },

  { email: 'nusrat.jahan@bidyapith.edu', first: 'Nusrat', last: 'Jahan', dept: 'CIV', des: Designation.ASSOCIATE_PROFESSOR, spec: 'Structural & Earthquake Engineering', phone: '+8801911223353' },
  { email: 'imran.chowdhury@bidyapith.edu', first: 'Imran', last: 'Chowdhury', dept: 'CIV', des: Designation.ASSISTANT_PROFESSOR, spec: 'Geotechnical & Foundation Engineering', phone: '+8801911223354' },

  { email: 'shahriar.kabir@bidyapith.edu', first: 'Shahriar', last: 'Kabir', dept: 'BBA', des: Designation.PROFESSOR, spec: 'Strategic Management & Business Policy', phone: '+8801711223355' },
  { email: 'sharmin.akter@bidyapith.edu', first: 'Sharmin', last: 'Akter', dept: 'BBA', des: Designation.ASSOCIATE_PROFESSOR, spec: 'Corporate Finance & Investment Banking', phone: '+8801711223356' },
  { email: 'rakib.hasan@bidyapith.edu', first: 'Rakib', last: 'Hasan', dept: 'BBA', des: Designation.ASSISTANT_PROFESSOR, spec: 'Digital Marketing & Consumer Insights', phone: '+8801711223357' },

  { email: 'selim.reza@bidyapith.edu', first: 'Selim', last: 'Reza', dept: 'MAT', des: Designation.PROFESSOR, spec: 'Linear Algebra & Dynamical Systems', phone: '+8801611223358' },
  { email: 'sumaiya.karim@bidyapith.edu', first: 'Sumaiya', last: 'Karim', dept: 'MAT', des: Designation.ASSOCIATE_PROFESSOR, spec: 'Numerical Methods & Optimization', phone: '+8801611223359' },
  { email: 'tariq.aziz@bidyapith.edu', first: 'Tariq', last: 'Aziz', dept: 'MAT', des: Designation.LECTURER, spec: 'Probability, Statistics & Stochastic Models', phone: '+8801611223360' },

  { email: 'mahfuz.alam@bidyapith.edu', first: 'Mahfuz', last: 'Alam', dept: 'PHY', des: Designation.PROFESSOR, spec: 'Quantum Optics & Condensed Matter', phone: '+8801711223361' },
  { email: 'anisur.rahman@bidyapith.edu', first: 'Anisur', last: 'Rahman', dept: 'PHY', des: Designation.ASSOCIATE_PROFESSOR, spec: 'Computational Physics & Nanomaterials', phone: '+8801711223362' },

  { email: 'sadia.noor@bidyapith.edu', first: 'Sadia', last: 'Noor', dept: 'ENG', des: Designation.ASSOCIATE_PROFESSOR, spec: 'Postcolonial Literature & Literary Translation', phone: '+8801811223363' },
  { email: 'tasneem.fatima@bidyapith.edu', first: 'Tasneem', last: 'Fatima', dept: 'ENG', des: Designation.ASSISTANT_PROFESSOR, spec: 'Applied Linguistics & ELT', phone: '+8801811223364' },

  { email: 'rezaul.karim@bidyapith.edu', first: 'Rezaul', last: 'Karim', dept: 'LAW', des: Designation.PROFESSOR, spec: 'Constitutional & Administrative Law', phone: '+8801911223365' },
  { email: 'nazmul.huda@bidyapith.edu', first: 'Nazmul', last: 'Huda', dept: 'LAW', des: Designation.ASSISTANT_PROFESSOR, spec: 'Corporate Law, Securities & Cyber Law', phone: '+8801911223366' },

  { email: 'mitali.saha@bidyapith.edu', first: 'Mitali', last: 'Saha', dept: 'PHA', des: Designation.ASSOCIATE_PROFESSOR, spec: 'Clinical Pharmacology & Therapeutics', phone: '+8801511223367' },
  { email: 'farhana.islam@bidyapith.edu', first: 'Farhana', last: 'Islam', dept: 'ECO', des: Designation.ASSOCIATE_PROFESSOR, spec: 'Development Economics & Micro-econometrics', phone: '+8801511223368' },
];

const ADMINS_DATA = [
  { email: 'admin@bidyapith.edu', first: 'System', last: 'Administrator', phone: '+8801700000001', pass: ADMIN_PASSWORD },
  { email: 'devparvejme@gmail.com', first: 'Parvej', last: 'Admin', phone: '+8801700000002', pass: TEST_ADMIN_PASSWORD },
  { email: 'registrar@bidyapith.edu', first: 'Sabina', last: 'Yeasmin', phone: '+8801700000003', pass: ADMIN_PASSWORD },
  { email: 'controller@bidyapith.edu', first: 'Kamal', last: 'Hossain', phone: '+8801700000004', pass: ADMIN_PASSWORD },
  { email: 'admissions@bidyapith.edu', first: 'Jahangir', last: 'Alam', phone: '+8801700000005', pass: ADMIN_PASSWORD },
  { email: 'finance@bidyapith.edu', first: 'Farzana', last: 'Rahman', phone: '+8801700000006', pass: ADMIN_PASSWORD },
];

async function main(): Promise<void> {
  console.log('🚀 Starting Bidyapith Comprehensive Database Seeding...');

  console.log('🔑 Pre-hashing passwords...');
  const [adminHash, testAdminHash, studentHash, instructorHash] = await Promise.all([
    bcrypt.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS),
    bcrypt.hash(TEST_ADMIN_PASSWORD, BCRYPT_ROUNDS),
    bcrypt.hash(STUDENT_PASSWORD, BCRYPT_ROUNDS),
    bcrypt.hash(INSTRUCTOR_PASSWORD, BCRYPT_ROUNDS),
  ]);

  // 1. Seed Departments
  console.log('🏛️ Seeding Departments...');
  const deptMap = new Map<string, string>();
  for (const d of DEPARTMENTS_DATA) {
    const dept = await prisma.department.upsert({
      where: { code: d.code },
      update: { name: d.name, contactEmail: d.email, deletedAt: null },
      create: { code: d.code, name: d.name, contactEmail: d.email },
    });
    deptMap.set(d.code, dept.id);
  }

  // 2. Seed Programs
  console.log('🎓 Seeding Programs...');
  const progMap = new Map<string, string>();
  for (const p of PROGRAMS_DATA) {
    const deptId = deptMap.get(p.dept);
    if (!deptId) continue;
    const prog = await prisma.program.upsert({
      where: { code: p.code },
      update: {
        departmentId: deptId,
        name: p.name,
        degreeType: p.degree,
        totalCredits: p.credits,
        durationYears: p.years,
        feePerCredit: p.fee,
        registrationFee: p.regFee,
        deletedAt: null,
      },
      create: {
        code: p.code,
        name: p.name,
        departmentId: deptId,
        degreeType: p.degree,
        totalCredits: p.credits,
        durationYears: p.years,
        feePerCredit: p.fee,
        registrationFee: p.regFee,
      },
    });
    progMap.set(p.code, prog.id);
  }

  // 3. Seed Courses
  console.log('📚 Seeding Courses...');
  const courseMap = new Map<string, string>();
  for (const c of COURSES_DATA) {
    const deptId = deptMap.get(c.dept);
    if (!deptId) continue;
    const course = await prisma.course.upsert({
      where: { code: c.code },
      update: {
        title: c.title,
        credits: c.credits,
        type: c.type,
        level: c.level,
        departmentId: deptId,
        deletedAt: null,
      },
      create: {
        code: c.code,
        title: c.title,
        credits: c.credits,
        type: c.type,
        level: c.level,
        departmentId: deptId,
      },
    });
    courseMap.set(c.code, course.id);
  }

  // 4. Seed Admins
  console.log('🛡️ Seeding Admins...');
  for (let i = 0; i < ADMINS_DATA.length; i++) {
    const a = ADMINS_DATA[i]!;
    const hash = a.email === 'devparvejme@gmail.com' ? testAdminHash : adminHash;
    await prisma.user.upsert({
      where: { email: a.email },
      update: {
        firstName: a.first,
        lastName: a.last,
        password: hash,
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
        phone: a.phone,
        avatarUrl: getAvatar(i + 40),
        emailVerified: true,
        deletedAt: null,
      },
      create: {
        email: a.email,
        firstName: a.first,
        lastName: a.last,
        password: hash,
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
        phone: a.phone,
        avatarUrl: getAvatar(i + 40),
        emailVerified: true,
      },
    });
  }

  // 5. Seed Instructors (25+)
  console.log(`👨‍🏫 Seeding ${INSTRUCTORS_DATA.length} Instructors...`);
  const instructorIds: string[] = [];
  for (let i = 0; i < INSTRUCTORS_DATA.length; i++) {
    const ins = INSTRUCTORS_DATA[i]!;
    const deptId = deptMap.get(ins.dept)!;
    const user = await prisma.user.upsert({
      where: { email: ins.email },
      update: {
        firstName: ins.first,
        lastName: ins.last,
        password: instructorHash,
        role: Role.INSTRUCTOR,
        status: UserStatus.ACTIVE,
        phone: ins.phone,
        avatarUrl: getAvatar(i + 15),
        emailVerified: true,
        deletedAt: null,
      },
      create: {
        email: ins.email,
        firstName: ins.first,
        lastName: ins.last,
        password: instructorHash,
        role: Role.INSTRUCTOR,
        status: UserStatus.ACTIVE,
        phone: ins.phone,
        avatarUrl: getAvatar(i + 15),
        emailVerified: true,
      },
    });

    const empId = `FAC-${String(100 + i + 1).padStart(4, '0')}`;
    const profile = await prisma.instructorProfile.upsert({
      where: { userId: user.id },
      update: {
        departmentId: deptId,
        designation: ins.des,
        specialization: ins.spec,
        employeeId: empId,
        deletedAt: null,
      },
      create: {
        userId: user.id,
        employeeId: empId,
        departmentId: deptId,
        designation: ins.des,
        specialization: ins.spec,
        joiningDate: new Date('2016-01-15'),
      },
    });
    instructorIds.push(profile.id);
  }

  // 6. Seed Semesters
  console.log('🗓️ Seeding Semesters...');
  const now = new Date();
  const currentSemester = await prisma.semester.upsert({
    where: { term_year: { term: SemesterTerm.FALL, year: 2026 } },
    update: {
      name: 'Fall 2026',
      status: SemesterStatus.REGISTRATION,
      registrationStart: addDays(now, -10),
      registrationEnd: addDays(now, 15),
      dropDeadline: addDays(now, 25),
      classStartDate: addDays(now, 20),
      classEndDate: addDays(now, 120),
      deletedAt: null,
    },
    create: {
      term: SemesterTerm.FALL,
      year: 2026,
      name: 'Fall 2026',
      status: SemesterStatus.REGISTRATION,
      registrationStart: addDays(now, -10),
      registrationEnd: addDays(now, 15),
      dropDeadline: addDays(now, 25),
      classStartDate: addDays(now, 20),
      classEndDate: addDays(now, 120),
    },
  });

  const springSemester = await prisma.semester.upsert({
    where: { term_year: { term: SemesterTerm.SPRING, year: 2026 } },
    update: {
      name: 'Spring 2026',
      status: SemesterStatus.COMPLETED,
      registrationStart: addDays(now, -200),
      registrationEnd: addDays(now, -170),
      dropDeadline: addDays(now, -160),
      classStartDate: addDays(now, -150),
      classEndDate: addDays(now, -30),
      resultPublishedAt: addDays(now, -15),
      deletedAt: null,
    },
    create: {
      term: SemesterTerm.SPRING,
      year: 2026,
      name: 'Spring 2026',
      status: SemesterStatus.COMPLETED,
      registrationStart: addDays(now, -200),
      registrationEnd: addDays(now, -170),
      dropDeadline: addDays(now, -160),
      classStartDate: addDays(now, -150),
      classEndDate: addDays(now, -30),
      resultPublishedAt: addDays(now, -15),
    },
  });

  // 7. Seed Course Offerings
  console.log('🏛️ Seeding Course Offerings (Assigning sections to Prof. Dr. Ayesha Rahman and other faculty)...');
  const offeringList: { id: string; courseId: string; instructorId: string }[] = [];
  const ayeshaOfferings: { id: string; courseCode: string; section: string }[] = [];

  const sampleOfferings = [
    // --- Dr. Ayesha Rahman (insIdx: 0) Course Sections ---
    { code: 'CSE-1101', sec: 'A', room: 'AB2-401', insIdx: 0, day: DayOfWeek.SUNDAY, start: '09:00', end: '10:30' },
    { code: 'CSE-1101', sec: 'B', room: 'AB2-402', insIdx: 0, day: DayOfWeek.MONDAY, start: '11:00', end: '12:30' },
    { code: 'CSE-1102', sec: 'A', room: 'LAB-301', insIdx: 0, day: DayOfWeek.SUNDAY, start: '14:00', end: '17:00' },
    { code: 'CSE-2202', sec: 'A', room: 'AB2-405', insIdx: 0, day: DayOfWeek.TUESDAY, start: '13:00', end: '14:30' },
    { code: 'CSE-3303', sec: 'A', room: 'AB2-502', insIdx: 0, day: DayOfWeek.SUNDAY, start: '11:00', end: '12:30' },
    { code: 'CSE-4108', sec: 'A', room: 'AB3-208', insIdx: 0, day: DayOfWeek.MONDAY, start: '14:00', end: '15:30' },

    // --- Other Faculty Course Sections ---
    { code: 'CSE-2201', sec: 'A', room: 'AB2-402', insIdx: 4, day: DayOfWeek.MONDAY, start: '10:30', end: '12:00' },
    { code: 'CSE-2303', sec: 'A', room: 'AB2-305', insIdx: 1, day: DayOfWeek.TUESDAY, start: '09:00', end: '10:30' },
    { code: 'CSE-3201', sec: 'A', room: 'AB2-306', insIdx: 5, day: DayOfWeek.WEDNESDAY, start: '11:00', end: '12:30' },
    { code: 'EEE-1101', sec: 'A', room: 'AB1-201', insIdx: 6, day: DayOfWeek.SUNDAY, start: '11:00', end: '12:30' },
    { code: 'MAT-1101', sec: 'A', room: 'AB1-112', insIdx: 14, day: DayOfWeek.MONDAY, start: '13:00', end: '14:30' },
    { code: 'MAT-2101', sec: 'A', room: 'AB1-114', insIdx: 15, day: DayOfWeek.TUESDAY, start: '14:30', end: '16:00' },
    { code: 'BBA-1101', sec: 'A', room: 'AB4-101', insIdx: 11, day: DayOfWeek.WEDNESDAY, start: '09:30', end: '11:00' },
    { code: 'ENG-1101', sec: 'A', room: 'AB4-202', insIdx: 19, day: DayOfWeek.THURSDAY, start: '10:00', end: '11:30' },
    { code: 'LAW-1101', sec: 'A', room: 'AB3-102', insIdx: 21, day: DayOfWeek.SUNDAY, start: '13:00', end: '14:30' },
    { code: 'PHA-1101', sec: 'A', room: 'PHA-201', insIdx: 23, day: DayOfWeek.TUESDAY, start: '10:00', end: '11:30' },
    { code: 'ECO-1101', sec: 'A', room: 'AB4-301', insIdx: 24, day: DayOfWeek.WEDNESDAY, start: '13:30', end: '15:00' },
  ];

  for (const o of sampleOfferings) {
    const cId = courseMap.get(o.code);
    if (!cId) continue;
    const instructorId = instructorIds[o.insIdx] ?? instructorIds[0];
    if (instructorId === undefined) {
      throw new Error('No instructors were seeded for course offerings');
    }
    const offering = await prisma.courseOffering.upsert({
      where: {
        courseId_semesterId_section: {
          courseId: cId,
          semesterId: currentSemester.id,
          section: o.sec,
        },
      },
      update: {
        instructorId,
        capacity: 45,
        enrolledCount: 30,
        status: OfferingStatus.OPEN,
        room: o.room,
        deletedAt: null,
      },
      create: {
        courseId: cId,
        semesterId: currentSemester.id,
        instructorId,
        section: o.sec,
        capacity: 45,
        enrolledCount: 30,
        status: OfferingStatus.OPEN,
        room: o.room,
      },
    });
    offeringList.push({ id: offering.id, courseId: cId, instructorId });
    if (o.insIdx === 0) {
      ayeshaOfferings.push({ id: offering.id, courseCode: o.code, section: o.sec });
    }

    await prisma.classSchedule.upsert({
      where: {
        offeringId_dayOfWeek_startTime: {
          offeringId: offering.id,
          dayOfWeek: o.day,
          startTime: o.start,
        },
      },
      update: { endTime: o.end, room: o.room },
      create: {
        offeringId: offering.id,
        dayOfWeek: o.day,
        startTime: o.start,
        endTime: o.end,
        room: o.room,
      },
    });
  }

  // 8. Seed 100 Students!
  console.log('🎒 Seeding 100 Students with realistic profiles and photos...');
  const studentProfiles: { id: string; userId: string; firstName: string; lastName: string }[] = [];
  const programCodes = ['BSC-CSE', 'BSC-EEE', 'BSC-CIV', 'BBA-GEN', 'BSC-MAT', 'BSC-PHY', 'BA-ENG', 'LLB-HON', 'BPH-PRO', 'BSS-ECO'];
  const batches = ['2023', '2024', '2025', '2026'];
  const cities = ['Dhaka', 'Chittagong', 'Sylhet', 'Rajshahi', 'Khulna', 'Cumilla', 'Gazipur', 'Narayanganj'];

  for (let i = 1; i <= 100; i++) {
    const padded = String(i).padStart(3, '0');
    const email = `student${padded}@bidyapith.edu`;
    const firstName = BANGLA_FIRST_NAMES[(i - 1) % BANGLA_FIRST_NAMES.length]!;
    const lastName = BANGLA_LAST_NAMES[(i * 3) % BANGLA_LAST_NAMES.length]!;
    const progCode = programCodes[(i - 1) % programCodes.length]!;
    const progId = progMap.get(progCode) || progMap.get('BSC-CSE')!;
    const batch = batches[(i - 1) % batches.length]!;
    const studentIdNum = `${batch}-${progCode}-${String(1000 + i)}`;
    const avatar = getAvatar(i);
    const phone = `+88017${String(10000000 + i * 83).slice(0, 8)}`;
    const guardianPhone = `+88018${String(20000000 + i * 71).slice(0, 8)}`;
    const city = cities[i % cities.length]!;
    const cgpa = (2.60 + ((i * 17) % 140) / 100).toFixed(2);
    const credits = (15 + (i % 4) * 32).toFixed(1);

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        firstName,
        lastName,
        password: studentHash,
        role: Role.STUDENT,
        status: UserStatus.ACTIVE,
        phone,
        avatarUrl: avatar,
        emailVerified: true,
        deletedAt: null,
      },
      create: {
        email,
        firstName,
        lastName,
        password: studentHash,
        role: Role.STUDENT,
        status: UserStatus.ACTIVE,
        phone,
        avatarUrl: avatar,
        emailVerified: true,
      },
    });

    const studentProf = await prisma.studentProfile.upsert({
      where: { userId: user.id },
      update: {
        studentId: studentIdNum,
        programId: progId,
        batch,
        cgpa: new Prisma.Decimal(cgpa),
        totalCreditsEarned: new Prisma.Decimal(credits),
        guardianName: `Md. ${BANGLA_LAST_NAMES[i % BANGLA_LAST_NAMES.length]}`,
        guardianPhone,
        address: `${12 + (i % 40)}, Road ${1 + (i % 20)}, Sector ${3 + (i % 14)}, ${city}`,
        status: StudentStatus.ACTIVE,
        deletedAt: null,
      },
      create: {
        userId: user.id,
        studentId: studentIdNum,
        programId: progId,
        batch,
        admissionDate: new Date(`${batch}-01-15`),
        cgpa: new Prisma.Decimal(cgpa),
        totalCreditsEarned: new Prisma.Decimal(credits),
        guardianName: `Md. ${BANGLA_LAST_NAMES[i % BANGLA_LAST_NAMES.length]}`,
        guardianPhone,
        address: `${12 + (i % 40)}, Road ${1 + (i % 20)}, Sector ${3 + (i % 14)}, ${city}`,
        status: StudentStatus.ACTIVE,
      },
    });
    studentProfiles.push({ id: studentProf.id, userId: user.id, firstName, lastName });
  }

  // 9. Enroll Students into Dr. Ayesha Rahman's Sections & populate Attendance + Grades
  console.log("📝 Enrolling students, attendance records, and grades for Dr. Ayesha Rahman's courses...");
  const attendanceDates = [
    new Date('2026-09-01'),
    new Date('2026-09-03'),
    new Date('2026-09-08'),
    new Date('2026-09-10'),
    new Date('2026-09-15'),
    new Date('2026-09-17'),
    new Date('2026-09-22'),
    new Date('2026-09-24'),
    new Date('2026-09-28'),
    new Date('2026-09-29'),
  ];

  const attendanceRows: { enrollmentId: string; date: Date; status: AttendanceStatus }[] = [];

  for (const [offIdx, aOff] of ayeshaOfferings.entries()) {
    // Assign 22 students to this section
    const startIdx = (offIdx * 15) % (studentProfiles.length - 25);
    const enrolledStudents = studentProfiles.slice(startIdx, startIdx + 22);

    for (const [sIdx, sp] of enrolledStudents.entries()) {
      const midterm = 18 + ((sIdx * 7) % 8); // 18-25
      const final = 35 + ((sIdx * 11) % 15); // 35-49
      const assignment = 15 + ((sIdx * 3) % 6); // 15-20
      const total = midterm + final + assignment;
      const letterGrade: LetterGrade =
        total >= 80 ? LetterGrade.A_PLUS : total >= 75 ? LetterGrade.A : total >= 70 ? LetterGrade.A_MINUS : LetterGrade.B_PLUS;
      const gradePoint = total >= 80 ? '4.00' : total >= 75 ? '3.75' : total >= 70 ? '3.50' : '3.25';

      const enrollment = await prisma.enrollment.upsert({
        where: { studentId_offeringId: { studentId: sp.id, offeringId: aOff.id } },
        update: {
          status: EnrollmentStatus.ENROLLED,
          examEligible: true,
          totalMarks: new Prisma.Decimal(total.toFixed(2)),
          letterGrade,
          gradePoint: new Prisma.Decimal(gradePoint),
          gradedAt: new Date('2026-09-28'),
        },
        create: {
          studentId: sp.id,
          offeringId: aOff.id,
          status: EnrollmentStatus.ENROLLED,
          examEligible: true,
          totalMarks: new Prisma.Decimal(total.toFixed(2)),
          letterGrade,
          gradePoint: new Prisma.Decimal(gradePoint),
          gradedAt: new Date('2026-09-28'),
        },
      });

      // Prepare attendance for each date
      for (const [dIdx, attDate] of attendanceDates.entries()) {
        const statusVal =
          (sIdx + dIdx) % 11 === 0
            ? AttendanceStatus.ABSENT
            : (sIdx + dIdx) % 7 === 0
              ? AttendanceStatus.LATE
              : AttendanceStatus.PRESENT;

        attendanceRows.push({
          enrollmentId: enrollment.id,
          date: attDate,
          status: statusVal,
        });
      }
    }
  }

  console.log(`⚡ Inserting ${attendanceRows.length} attendance records in bulk...`);
  await prisma.attendance.createMany({
    data: attendanceRows,
    skipDuplicates: true,
  });

  // 10. Seed Exams for Dr. Ayesha Rahman's Course Offerings (Grading Assessments)
  console.log("📝 Creating exam assessments for Dr. Ayesha Rahman's course offerings...");
  const existingExamTypes = new Set(
    (
      await prisma.exam.findMany({
        where: {
          offeringId: { in: ayeshaOfferings.map((offering) => offering.id) },
          deletedAt: null,
        },
        select: { offeringId: true, type: true },
      })
    ).map((exam) => `${exam.offeringId}:${exam.type}`),
  );
  const examRows: Prisma.ExamCreateManyInput[] = [];
  for (const aOff of ayeshaOfferings) {
    const assessments: Prisma.ExamCreateManyInput[] = [
      {
        offeringId: aOff.id,
        type: ExamType.MIDTERM,
        title: 'Midterm Examination',
        totalMarks: new Prisma.Decimal('30.00'),
        weight: new Prisma.Decimal('30.00'),
        examDate: new Date('2026-10-15'),
        isPublished: true,
      },
      {
        offeringId: aOff.id,
        type: ExamType.ASSIGNMENT,
        title: 'Continuous Assessment & Lab Assignments',
        totalMarks: new Prisma.Decimal('20.00'),
        weight: new Prisma.Decimal('20.00'),
        examDate: new Date('2026-10-25'),
        isPublished: true,
      },
      {
        offeringId: aOff.id,
        type: ExamType.FINAL,
        title: 'Semester Final Examination',
        totalMarks: new Prisma.Decimal('50.00'),
        weight: new Prisma.Decimal('50.00'),
        examDate: new Date('2026-11-20'),
        isPublished: false,
      },
    ];
    for (const assessment of assessments) {
      const key = `${assessment.offeringId}:${assessment.type}`;
      if (existingExamTypes.has(key)) continue;
      examRows.push(assessment);
      existingExamTypes.add(key);
    }
  }
  await prisma.exam.createMany({
    data: examRows,
  });

  // 11. Seed Invoices for first 40 students
  console.log('💵 Seeding Fee Invoices for 40 students...');
  const invoiceRows = [];
  for (let i = 0; i < 40; i++) {
    const sp = studentProfiles[i];
    if (!sp) continue;
    const invNum = `INV-2026-${String(1001 + i)}`;
    invoiceRows.push({
      invoiceNumber: invNum,
      studentId: sp.id,
      semesterId: currentSemester.id,
      type: InvoiceType.TUITION,
      status: i % 2 === 0 ? InvoiceStatus.PAID : InvoiceStatus.UNPAID,
      totalAmount: new Prisma.Decimal('45000.00'),
      paidAmount: i % 2 === 0 ? new Prisma.Decimal('45000.00') : new Prisma.Decimal('0.00'),
      dueDate: addDays(now, 20),
    });
  }
  await prisma.feeInvoice.createMany({
    data: invoiceRows,
    skipDuplicates: true,
  });

  console.log('✅ Database Seeding Completed Successfully!');
  console.log(`- 10 Departments`);
  console.log(`- 12 Academic Programs`);
  console.log(`- ${COURSES_DATA.length} Courses`);
  console.log(`- ${ADMINS_DATA.length} Administrators`);
  console.log(`- ${INSTRUCTORS_DATA.length} Instructors`);
  console.log(`- 100 Enrolled Students`);
  console.log(`\nDemo Credentials:`);
  console.log(`- Student: student001@bidyapith.edu / Student1234`);
  console.log(`- Instructor: ayesha.rahman@bidyapith.edu / Teach1234`);
  console.log(`- Admin: devparvejme@gmail.com / 12345678 (or admin@bidyapith.edu / Admin1234)`);
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
