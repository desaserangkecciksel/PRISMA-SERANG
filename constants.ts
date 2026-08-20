
import { LetterData, AppSettings } from './types';

const currentYear = new Date().getFullYear();

export const INITIAL_SETTINGS: AppSettings = {
  headerTitle: 'PEMERINTAH KABUPATEN BEKASI\nKECAMATAN CIKARANG SELATAN\nDESA SERANG',
  headerSubtitle: 'Jln. Cijingga KM. 0,5 Rt. 003/002 Kode Pos 17530',
  address: 'email : desaserangbersahaja@gmail.com website : desaserangbersahaja.id',
  username: 'SERANG', // Username default
  isDarkMode: false, // Default Light Mode
  isFullHeader: false, // Default: Gunakan Logo + Teks
  
  // Default Branding Texts
  sidebarTitle: 'PRISMADES',
  sidebarSubtitle: 'Admin Desa',
  loginTitle: 'PRISMADES SERANG',
  loginSubtitle: 'Permohonan Rincian & Instruksi Pembayaran Anggaran',
  loginDescription: 'PEMERINTAH DESA SERANG KECAMATAN CIKARANG SELATAN KABUPATEN BEKASI',
  loginFooter: `© ${currentYear} PEMERINTAH DESA SERANG`,

  budgetAllocations: {
    PAD: 100000000,
    ADD: 500000000,
    DDS: 1000000000,
    PBH: 200000000,
    PBP: 150000000,
    PBK: 100000000,
    DLL: 50000000,
  },
  budgetEntries: [],
  // Profile Defaults
  villageDescription: 'Desa Serang adalah salah satu desa di Kecamatan Cikarang Selatan, Kabupaten Bekasi, Jawa Barat. Desa ini terus berkomitmen untuk memberikan pelayanan terbaik bagi masyarakat.',
  vision: 'Terwujudnya Desa Serang yang Maju, Sejahtera, dan Berkeadaban.',
  mission: '1. Meningkatkan kualitas pelayanan publik.\n2. Mengembangkan potensi ekonomi lokal.\n3. Membangun infrastruktur yang berkelanjutan.',
  goals: 'Meningkatkan kesejahteraan masyarakat melalui tata kelola pemerintahan yang baik.',
  mapsEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3965.708605557766!2d107.12648531476964!3d-6.301974995439046!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e699b0c67972773%3A0xe9610214c7722765!2sKantor%20Desa%20Serang!5e0!3m2!1sen!2sid!4v1677561626000!5m2!1sen!2sid',
  
  // Contact Info
  villageEmail: 'desaserang.kec.ciksel@gmail.com',
  villagePhone: '082217561626',
  villageWhatsapp: '082217561626',
  
  // Head of Village
  headVillageName: 'ACHMAD FADILAH, SE',
  headVillageNIK: '3216212709770005',
  headVillageNIP: '',

  // Village Secretary (Integrated)
  villageSecretary: 'REZI RAHMAN DISPINDRA, S.Pd',

  // Bank Account Defaults
  defaultAccountHolder: 'PEMERINTAH DESA SERANG',
  defaultAccountNumber: '0065915960101',

  // Signatory Defaults
  defaultSignatory1: 'ACHMAD FADILAH, SE',
  defaultKtp1: '3216212709770005',
  defaultSignatory2: 'SITI NURJANAH',
  defaultKtp2: '3216195701790003',

  // Default PKA Officials
  pkaOfficials: [
    { id: 'sekdes', name: 'REZI RAHMAN DISPINDRA, S.Pd', position: 'Koordinator Pelaksana Kegiatan Anggaran' },
    { id: '1', name: 'YUSUF HAIDIR', position: 'Kaur Umum' },
    { id: '2', name: 'ROHMAN', position: 'Kaur Perencanaan' },
    { id: '3', name: 'ROY PRASETIYA IRAWAN, SM', position: 'Kasi Pelayanan' },
    { id: '4', name: 'SYAFRUDIN', position: 'Kasi Pemerintahan' },
    { id: '5', name: 'UMAR AL AFGANI', position: 'Kasi Kesejahteraan' }
  ]
};

export const INITIAL_FORM_DATA: LetterData = {
  id: '',
  status: 'draft',
  createdAt: '',
  updatedAt: '',
  letterNumber: '',
  nature: '',
  attachment: '1 Berkas',
  subject: '',
  signatoryName1: 'ACHMAD FADILAH, SE', // Will be overridden
  signatoryName2: 'SITI NURJANAH', // Will be overridden
  ktp1: '3216212709770005', // Will be overridden
  ktp2: '3216195701790003', // Will be overridden
  accountHolder: 'PEMERINTAH DESA SERANG', 
  accountNumber: '0065915960101',
  requestLetterNumber: `903/       /SPP/32.16.19.2006/I/${currentYear}`,
  pkaName: '',
  pkaPosition: '',
  sppNumber: `903/       /SPP/32.16.19.2006/I/${currentYear}`,
  dpa: 'Terlampir',
  sourceFund: 'APBDes',
  fiscalYear: currentYear.toString(),
  field: '',
  subField: '',
  activity: '',
  rabFile: '',
  rabFileName: '',
  items: [
    {
      id: '1',
      recipientName: '',
      accountNumber: '',
      bankName: '',
      grossAmount: 0,
      deduction: 0,
      netTransfer: 0,
      description: ''
    },
    {
      id: '2',
      recipientName: '',
      accountNumber: '',
      bankName: '',
      grossAmount: 0,
      deduction: 0,
      netTransfer: 0,
      description: ''
    },
    {
      id: '3',
      recipientName: '',
      accountNumber: '',
      bankName: '',
      grossAmount: 0,
      deduction: 0,
      netTransfer: 0,
      description: ''
    }
  ],
  totalAmount: 0,
  amountInWords: '',
  place: 'Serang',
  date: new Date().toISOString().split('T')[0],
  pjHeadVillage: 'ACHMAD FADILAH, SE',
  secretary: 'REZI RAHMAN DISPINDRA, S.Pd',
  ppkd: 'ROY PRASETIYA IRAWAN, SM',
  planningOfficer: 'ROY PRASETIYA IRAWAN, SM', 
  financeOfficer: 'SITI NURJANAH',
  pkaSignatory: 'REZI RAHMAN DISPINDRA, S.Pd'
};

export const COLORS = {
  primary: '#0d9488', // teal-600
  secondary: '#000000', // Black
  accent: '#06b6d4', // cyan-500
  success: '#10b981', // emerald-500
  danger: '#ef4444', // red-500
};
