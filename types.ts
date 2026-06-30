
export interface TransactionItem {
  id: string;
  recipientName: string;
  accountNumber: string;
  bankName: string;
  grossAmount: number;
  deduction: number;
  netTransfer: number;
  description?: string;
}

export interface Employee {
  id: string;
  name: string;
  position: string; // Jabatan
  accountNumber: string;
  bankName: string;
}

export interface LetterData {
  id: string;
  status: 'draft' | 'saved' | 'archived' | 'pending' | 'rejected';
  createdAt: string;
  updatedAt: string;
  
  // Header Info
  letterNumber: string; // No. Surat
  nature: string; // Sifat
  attachment: string; // Lampiran
  subject: string; // Hal
  
  // Identity Info
  signatoryName1: string;
  signatoryName2?: string;
  ktp1: string;
  ktp2?: string;
  accountHolder: string;
  accountNumber: string;
  
  // Context Info
  requestLetterNumber: string; // Surat Permohonan Nomor
  pkaName: string; // PKA
  pkaPosition: string; // Pelaksana Kegiatan Anggaran (Jabatan)
  sppNumber: string;
  dpa: string;
  sourceFund: string; // Sumber Dana
  fiscalYear: string; // Tahun Anggaran
  field: string; // Bidang
  subField: string; // Sub. Bidang
  activity: string; // Kegiatan
  
  // RAB File
  rabFile?: string; // Base64 string of the file
  rabFileName?: string; // Name of the file

  // Transaction Data
  items: TransactionItem[];
  totalAmount: number;
  amountInWords: string; // Terbilang
  
  // Date & Place
  place: string;
  date: string;
  
  // Signatories
  pjHeadVillage: string; // PJ. Kepala Desa
  secretary: string; // Sekretaris Desa
  ppkd: string; // Pelaksana Pengelolaan Keuangan Desa
  planningOfficer: string; // Kaur Perencanaan
  financeOfficer: string; // Kaur Keuangan
  pkaSignatory: string; // Pelaksana Kegiatan Anggaran (Signatory Name)

  // Tax Management
  taxStatus?: 'paid' | 'unpaid'; // Status Pembayaran Pajak
  taxNote?: string; // Catatan Pajak
}

export interface BudgetAllocations {
  PAD: number;
  ADD: number;
  DDS: number;
  PBH: number;
  PBP: number;
  DLL: number;
}

export interface PkaOfficial {
  id: string;
  name: string;
  position: string;
}

export interface BudgetEntry {
  id: string;
  date: string;
  amount: number;
  source: keyof BudgetAllocations;
  description: string;
}

export interface AppSettings {
  headerImage?: string; // Base64 for letterhead
  loginLogo?: string; // Base64 for login page
  sidebarLogo?: string; // Base64 for sidebar header
  isFullHeader: boolean; // Jika true, headerImage akan dipakai full width menggantikan teks
  isDarkMode: boolean; // Dark Mode Toggle
  headerTitle: string;
  headerSubtitle: string;
  address: string;
  username?: string; // Field username baru
  password?: string;
  budgetAllocations: BudgetAllocations;
  budgetEntries: BudgetEntry[];

  // Branding Texts (New)
  sidebarTitle: string;
  sidebarSubtitle: string;
  loginTitle: string;
  loginSubtitle: string;
  loginDescription: string;
  loginFooter: string;

  // New Profile Fields
  villageDescription: string;
  vision: string;
  mission: string;
  goals: string; // Tujuan
  mapsEmbedUrl: string; // Google Maps Embed HTML/URL
  
  // Contact Info (Connected to Login Reset)
  villageEmail: string;
  villagePhone: string;
  villageWhatsapp: string;
  
  // Head of Village
  headVillageName: string;
  headVillageNIK: string;
  headVillageNIP?: string;

  // Village Secretary (Sekdes)
  villageSecretary: string;

  // Village Bank Account
  defaultAccountHolder: string;
  defaultAccountNumber: string;

  // Default Signatories (Pemohon)
  defaultSignatory1: string;
  defaultKtp1: string;
  defaultSignatory2: string;
  defaultKtp2: string;

  // PKA Officials List
  pkaOfficials: PkaOfficial[];
}
