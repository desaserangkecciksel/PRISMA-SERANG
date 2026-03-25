
import React, { useState, useEffect, useRef } from 'react';
import { Save, Trash2, Check, Calculator, UploadCloud, Camera, FileCheck, AlertTriangle, Plus, X, ArrowLeft, RefreshCw, Lock, Loader2, Printer, FileText, ArrowRight } from 'lucide-react';
import { LetterData, TransactionItem, Employee, AppSettings } from '../types';
import { INITIAL_FORM_DATA, INITIAL_SETTINGS } from '../constants';
import { StorageService } from '../services/storageService';
import { BlobService } from '../services/blobService';
import { generateSPM, generateSPP, generateBA } from '../services/pdfGenerator';
import { v4 as uuidv4 } from 'uuid';

const SUB_FIELDS: Record<string, string[]> = {
  "Bidang Penyelenggaran Pemerintahan Desa": [
    "Penyelenggaran Belanja Siltap, Tunjangan dan Operasional Pemerintahan Desa",
    "Penyediaan Sarana Prasarana Pemerintahan Desa",
    "Pengelolaan Administrasi Kependudukan, Pencatatan Sipil, Statistik dan Kearsipan",
    "Penyelenggaraan Tata Praja Pemerintahan, Perencanaan, Keuangan dan Pelaporan",
    "Sub Bidang Pertanahan"
  ],
  "Bidang Pelaksanaan Pembangunan Desa": [
    "Sub Bidang Pendidikan",
    "Sub Bidang Kesehatan",
    "Sub Bidang Pekerjaan Umum dan Penataan Ruang",
    "Sub Bidang Kawasan Pemukiman",
    "Sub Bidang Kehutanan dan Lingkungan Hidup",
    "Sub Bidang Perhubungan, Komunikasi dan Informatika",
    "Sub Bidang Energi dan Sumberdaya Mineral",
    "Sub Bidang Pariwisata"
  ],
  "Bidang Pembinaan Kemasyarakatan": [
    "Sub Bidang Ketenteraman, Ketertiban Umum dan Perlindungan Masyarakat",
    "Sub Bidang Kebudayaan dan Keagamaan",
    "Sub Bidang Kepemudaan dan Olahraga",
    "Sub Bidang Kelembagaan Masyarakat"
  ],
  "Bidang Pemberdayaan Masyarakat": [
    "Sub Bidang Kelautan dan Perikanan",
    "Sub Bidang Pertanian dan Peternakan",
    "Sub Bidang Peningkatan Kapasitas Aparatur Desa",
    "Sub Bidang Pemberdayaan Perempuan, Perlindungan Anak dan Keluarga",
    "Sub Bidang Koperasi, Usaha Micro Kecil dan Menengah (UMKM)",
    "Sub Bidang Dukungan Penananam Modal",
    "Sub Bidang Perdagangan dan Perindustrian"
  ],
  "Bidang Penanggulangan Bencana, Darurat dan Mendesak Desa": [
    "Sub Bidang Penanggulangan Bencana",
    "Sub Bidang Keadaan Darurat",
    "Sub Bidang Keadaan Mendesak"
  ]
};

const SOURCE_FUND_OPTIONS = [
  "PAD",
  "ADD",
  "DDS",
  "PBH",
  "PBP",
  "SILPA"
];

const NATURE_OPTIONS = [
  "Penting",
  "Biasa",
  "Segera"
];

// Helper Function for Terbilang
const terbilang = (nilai: number): string => {
  const bilangan = [
    "", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"
  ];
  let temp = "";
  const absNilai = Math.abs(nilai);

  if (absNilai < 12) {
    temp = " " + bilangan[absNilai];
  } else if (absNilai < 20) {
    temp = terbilang(absNilai - 10) + " Belas";
  } else if (absNilai < 100) {
    temp = terbilang(Math.floor(absNilai / 10)) + " Puluh" + terbilang(absNilai % 10);
  } else if (absNilai < 200) {
    temp = " Seratus" + terbilang(absNilai - 100);
  } else if (absNilai < 1000) {
    temp = terbilang(Math.floor(absNilai / 100)) + " Ratus" + terbilang(absNilai % 100);
  } else if (absNilai < 2000) {
    temp = " Seribu" + terbilang(absNilai - 1000);
  } else if (absNilai < 1000000) {
    temp = terbilang(Math.floor(absNilai / 1000)) + " Ribu" + terbilang(absNilai % 1000);
  } else if (absNilai < 1000000000) {
    temp = terbilang(Math.floor(absNilai / 1000000)) + " Juta" + terbilang(absNilai % 1000000);
  } else if (absNilai < 1000000000000) {
    temp = terbilang(Math.floor(absNilai / 1000000000000)) + " Milyar" + terbilang(absNilai % 1000000000);
  } else if (absNilai < 1000000000000000) {
    temp = terbilang(Math.floor(absNilai / 1000000000000)) + " Trilyun" + terbilang(absNilai % 1000000000000);
  }

  return temp;
};

const formatTerbilang = (amount: number): string => {
    if (amount === 0) return "Nol Rupiah";
    return terbilang(amount).trim() + " Rupiah";
};

// Formatting Helper: 1000000 -> "1.000.000"
const formatNumber = (num: number | undefined): string => {
    if (num === undefined || num === 0) return '';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

// Parsing Helper: "1.000.000" -> 1000000
const parseNumber = (str: string): number => {
    if (!str) return 0;
    // Remove dots and convert to number
    const cleanStr = str.replace(/\./g, '');
    const parsed = parseInt(cleanStr, 10);
    return isNaN(parsed) ? 0 : parsed;
};

interface InputFormProps {
    initialData?: LetterData | null;
    onBack: () => void;
}

const InputForm: React.FC<InputFormProps> = ({ initialData, onBack }) => {
  const [formData, setFormData] = useState<LetterData>(initialData || INITIAL_FORM_DATA);
  const [fileError, setFileError] = useState<string>('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>(INITIAL_SETTINGS);
  
  // Modal State
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
  // Camera State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Roman Months helper
  const ROMAN_MONTHS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

  // Core configuration for dynamic logic
  const realYear = new Date().getFullYear();
  const baseYear = realYear < 2026 ? 2026 : realYear;
  const currentMonth = ROMAN_MONTHS[new Date().getMonth()];

  useEffect(() => {
    // Load employees for autocomplete
    const init = async () => {
        const emp = await StorageService.getEmployees();
        const sett = await StorageService.getSettings();
        setEmployees(emp);
        setAppSettings(sett);
        
        // If not editing, initialize defaults from settings
        if (!initialData) {
            const autoSPM = await StorageService.getNextSPMNumber(baseYear);
            const autoSPP = generateSPPNumber();
            const today = new Date().toISOString().split('T')[0];
            
            setFormData(prev => ({
                ...prev,
                // Override account details from settings
                accountHolder: sett.defaultAccountHolder || INITIAL_FORM_DATA.accountHolder,
                accountNumber: sett.defaultAccountNumber || INITIAL_FORM_DATA.accountNumber,
                // Override Signatories from settings
                signatoryName1: sett.defaultSignatory1 || INITIAL_FORM_DATA.signatoryName1,
                ktp1: sett.defaultKtp1 || INITIAL_FORM_DATA.ktp1,
                signatoryName2: sett.defaultSignatory2 || INITIAL_FORM_DATA.signatoryName2,
                ktp2: sett.defaultKtp2 || INITIAL_FORM_DATA.ktp2,
                // Override Secretary for integrated signing
                secretary: sett.villageSecretary || INITIAL_FORM_DATA.secretary,
                // Override Head Village from settings (Integrated)
                pjHeadVillage: sett.headVillageName || INITIAL_FORM_DATA.pjHeadVillage,
                
                letterNumber: autoSPM,
                sppNumber: autoSPP,
                requestLetterNumber: autoSPP,
                fiscalYear: baseYear.toString(),
                date: today
            }));
        } else {
             setFormData(initialData);
        }
    };
    init();
  }, [initialData]);

  const generateSPPNumber = () => {
    const emptySpace = "       ";
    return `903/${emptySpace}/SPP/32.16.19.2006/${currentMonth}/${baseYear}`;
  };

  const handleAutoGenerateSPM = async () => {
      const num = await StorageService.getNextSPMNumber(baseYear);
      handleInputChange('letterNumber', num);
  };

  const handleAutoGenerateSPP = () => {
      const newSPP = generateSPPNumber();
      setFormData(prev => ({
          ...prev,
          sppNumber: newSPP,
          requestLetterNumber: newSPP
      }));
  };

  const handleInputChange = (field: keyof LetterData, value: any) => {
    if (field === 'field') {
        setFormData(prev => ({ ...prev, [field]: value, subField: '' }));
    } else if (field === 'pkaName') {
        setFormData(prev => ({ ...prev, [field]: value, pkaSignatory: value }));
    } else {
        setFormData(prev => ({ ...prev, [field]: value }));
    }
  };
  
  // File Handling with Vercel Blob
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        if (file.size > 4 * 1024 * 1024) {
            setFileError('Ukuran file terlalu besar (Maks 4MB)');
            return;
        }

        setUploading(true);
        setFileError('');

        try {
            const blobUrl = await BlobService.upload(file);
            
            setFormData(prev => ({
                ...prev,
                rabFile: blobUrl,
                rabFileName: file.name
            }));
        } catch (err) {
            console.error(err);
            setFileError('Gagal mengupload file ke server.');
        } finally {
            setUploading(false);
        }
    }
  };

  // Camera Functions
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' }
      });
      
      streamRef.current = stream;
      setIsCameraOpen(true);
      
      setTimeout(() => {
          if (videoRef.current) {
              videoRef.current.srcObject = stream;
          }
      }, 100);

    } catch (err) {
      try {
         const streamFallback = await navigator.mediaDevices.getUserMedia({ video: true });
         streamRef.current = streamFallback;
         setIsCameraOpen(true);
         setTimeout(() => {
            if (videoRef.current) {
                videoRef.current.srcObject = streamFallback;
            }
         }, 100);
      } catch (fallbackErr) {
          console.error("Camera access denied:", fallbackErr);
          alert("Tidak dapat mengakses kamera. Pastikan izin kamera diberikan pada browser Anda.");
      }
    }
  };

  const stopCamera = () => {
      if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
      }
      setIsCameraOpen(false);
  };

  const capturePhoto = async () => {
      if (videoRef.current) {
          const canvas = document.createElement('canvas');
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
              ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
              
              const blob = BlobService.base64ToBlob(dataUrl, 'image/jpeg');
              const fileName = `Foto_Kamera_${new Date().getTime()}.jpg`;

              setUploading(true);
              stopCamera();
              
              try {
                  const blobUrl = await BlobService.upload(blob);
                  setFormData(prev => ({
                      ...prev,
                      rabFile: blobUrl,
                      rabFileName: fileName
                  }));
                  setFileError('');
              } catch (err) {
                  setFileError('Gagal mengupload foto.');
              } finally {
                  setUploading(false);
              }
          }
      }
  };

  const removeFile = () => {
      setFormData(prev => ({
          ...prev,
          rabFile: undefined,
          rabFileName: undefined
      }));
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddItem = () => {
    const newItem: TransactionItem = {
        id: uuidv4(),
        recipientName: '',
        accountNumber: '',
        bankName: '',
        grossAmount: 0,
        deduction: 0,
        netTransfer: 0,
        description: ''
    };
    setFormData(prev => ({
        ...prev,
        items: [...prev.items, newItem]
    }));
  };

  const handleRemoveItem = (index: number) => {
    if (formData.items.length <= 1) {
        alert("Minimal satu baris data diperlukan.");
        return;
    }
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    
    const total = newItems.reduce((acc, curr) => acc + curr.netTransfer, 0);
    const words = formatTerbilang(total);

    setFormData(prev => ({
        ...prev,
        items: newItems,
        totalAmount: total,
        amountInWords: words
    }));
  };

  const handleItemChange = (index: number, field: keyof TransactionItem, value: any) => {
    const newItems = [...formData.items];
    
    if (field === 'recipientName') {
        newItems[index] = { ...newItems[index], [field]: value };
        const employee = employees.find(e => (e.name || '').toLowerCase() === value.toLowerCase());
        if (employee) {
            newItems[index].accountNumber = employee.accountNumber;
            newItems[index].bankName = employee.bankName;
        }
    } else if (field === 'grossAmount' || field === 'deduction') {
        // Change: Use parseNumber to handle formatted string input (removing dots)
        const numValue = parseNumber(value);
        
        newItems[index] = { ...newItems[index], [field]: numValue };
        
        // Auto Calculate Net Transfer
        // Use values from calculation, ensure they exist
        const gross = field === 'grossAmount' ? numValue : (newItems[index].grossAmount || 0);
        const ded = field === 'deduction' ? numValue : (newItems[index].deduction || 0);
        
        // Logika Pengurangan:
        // Jika Potongan > Bruto, maka Net Transfer = 0 (Tidak bisa minus)
        newItems[index].netTransfer = Math.max(0, gross - ded);
    } else {
        newItems[index] = { ...newItems[index], [field]: value };
    }

    // Recalculate Total
    const total = newItems.reduce((acc, curr) => acc + curr.netTransfer, 0);
    const words = formatTerbilang(total);
    
    setFormData(prev => ({
        ...prev,
        items: newItems,
        totalAmount: total,
        amountInWords: words
    }));
  };

  // Function to print directly from success modal
  const handleDirectPrint = (type: 'SPM' | 'SPP' | 'BA') => {
      if(type === 'SPM') generateSPM(formData, appSettings);
      if(type === 'SPP') generateSPP(formData, appSettings);
      if(type === 'BA') generateBA(formData, appSettings);
  };

  const handleDraft = async () => {
    if (!window.confirm("Apakah Anda yakin ingin menyimpan dokumen ini sebagai Draft?")) {
        return;
    }

    setLoading(true);
    
    // Auto generate SPM number if it's empty or placeholder
    let currentSPM = formData.letterNumber;
    if (!currentSPM || currentSPM.includes('000') || !initialData) {
        currentSPM = await StorageService.getNextSPMNumber(baseYear);
    }

    const toSave = {
        ...formData,
        id: formData.id || uuidv4(),
        status: 'draft' as const,
        letterNumber: currentSPM,
        updatedAt: new Date().toISOString(),
        createdAt: formData.createdAt || new Date().toISOString()
    };
    await StorageService.saveLetter(toSave);
    setFormData(toSave);
    setLoading(false);
    alert(`Disimpan sebagai Draft dengan No. SPM: ${currentSPM}`);
  }

  const handleSave = async () => {
    setLoading(true);

    // Auto generate SPM number if it's empty or placeholder or new
    let currentSPM = formData.letterNumber;
    if (!currentSPM || currentSPM.includes('000') || !initialData) {
        currentSPM = await StorageService.getNextSPMNumber(baseYear);
    }

    const toSave = {
        ...formData,
        id: formData.id || uuidv4(),
        status: 'saved' as const,
        letterNumber: currentSPM,
        updatedAt: new Date().toISOString(),
        createdAt: formData.createdAt || new Date().toISOString(),
    };
    
    await StorageService.saveLetter(toSave);
    setFormData(toSave);
    setLoading(false);
    // Tampilkan Modal Sukses alih-alih alert
    setShowSuccessModal(true);
  };

  const subFieldOptions = formData.field ? SUB_FIELDS[formData.field] || [] : [];
  
  // Extract unique positions from PKA Officials for position dropdown
  const uniquePositions = Array.from(new Set((appSettings.pkaOfficials || []).map(p => p.position)));

  return (
    <div className="pb-20 animate-fade-in text-black dark:text-slate-100 relative">
        {isCameraOpen && (
            <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover"></video>
                <div className="absolute bottom-10 flex space-x-6">
                    <button onClick={stopCamera} className="bg-white/20 p-4 rounded-full backdrop-blur-md text-white">
                        <X size={32} />
                    </button>
                    <button onClick={capturePhoto} className="bg-white p-4 rounded-full border-4 border-slate-300 shadow-lg transform active:scale-90 transition-all">
                         <div className="w-8 h-8 bg-red-500 rounded-full"></div>
                    </button>
                </div>
            </div>
        )}

        {/* Success Modal */}
        {showSuccessModal && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
                <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md p-8 text-center animate-scale-up border border-white/20 dark:border-slate-700">
                    <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                        <Check size={40} className="text-green-600 dark:text-green-400" strokeWidth={3} />
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2">Dokumen Tersimpan!</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 leading-relaxed">
                        Data berhasil disimpan ke database. Anda dapat langsung mencetak dokumen atau kembali ke menu.
                    </p>
                    
                    <div className="grid grid-cols-1 gap-3 mb-6">
                        <button onClick={() => handleDirectPrint('SPM')} className="flex items-center justify-center px-4 py-3 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/50 font-bold rounded-xl transition-colors border border-teal-200 dark:border-teal-800">
                            <Printer size={18} className="mr-2" /> Cetak SPM (PDF)
                        </button>
                        <div className="flex gap-3">
                            <button onClick={() => handleDirectPrint('SPP')} className="flex-1 flex items-center justify-center px-4 py-3 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 font-bold rounded-xl transition-colors border border-blue-200 dark:border-blue-800 text-xs">
                                <FileText size={16} className="mr-2" /> Cetak SPP
                            </button>
                            <button onClick={() => handleDirectPrint('BA')} className="flex-1 flex items-center justify-center px-4 py-3 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 font-bold rounded-xl transition-colors border border-amber-200 dark:border-amber-800 text-xs">
                                <FileText size={16} className="mr-2" /> Cetak BA
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-3 border-t border-slate-100 dark:border-slate-700 pt-6">
                        <button 
                            onClick={() => setShowSuccessModal(false)}
                            className="flex-1 px-4 py-3 bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors border border-slate-200 dark:border-slate-600 text-sm"
                        >
                            Tutup
                        </button>
                        <button 
                            onClick={onBack}
                            className="flex-1 px-4 py-3 bg-slate-800 dark:bg-black text-white font-bold rounded-xl hover:bg-slate-900 dark:hover:bg-slate-900 shadow-lg transition-all transform hover:-translate-y-0.5 text-sm flex items-center justify-center"
                        >
                            Kembali ke Menu <ArrowRight size={16} className="ml-2"/>
                        </button>
                    </div>
                </div>
            </div>
        )}

        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <div className="flex items-center gap-4">
                 <button 
                    onClick={onBack}
                    className="p-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-full transition-colors group shadow-sm"
                    title="Kembali"
                 >
                    <ArrowLeft size={24} className="text-slate-600 dark:text-slate-400 group-hover:text-black dark:group-hover:text-white transition-colors" />
                 </button>
                 <h2 className="text-3xl font-extrabold text-black dark:text-white tracking-tight">
                    {initialData ? 'Edit Dokumen' : 'Buat Dokumen SPM, SPP & Berita Acara'}
                </h2>
            </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 p-8 space-y-8">
            <section className="space-y-4">
                <h3 className="text-lg font-bold text-teal-700 dark:text-teal-400 border-b-2 border-teal-100 dark:border-teal-900/30 pb-2">Detail Kop & Penomoran</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div>
                        <label className="block text-sm font-bold text-black dark:text-slate-300 mb-1">Tanggal Surat</label>
                        <input 
                            type="date" 
                            className="w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent p-2.5 border bg-slate-50 dark:bg-slate-900 text-black dark:text-white" 
                            value={formData.date} 
                            onChange={e => handleInputChange('date', e.target.value)} 
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-black dark:text-slate-300 mb-1">No. SPM</label>
                        <div className="relative">
                            <input 
                                type="text" 
                                className="w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent p-2.5 border bg-slate-50 dark:bg-slate-900 text-black dark:text-white pr-10" 
                                value={formData.letterNumber} 
                                onChange={e => handleInputChange('letterNumber', e.target.value)} 
                                placeholder="903/000/SPM/..."
                            />
                            <button 
                                onClick={handleAutoGenerateSPM}
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors p-1"
                                title="Auto Generate No. SPM"
                            >
                                <RefreshCw size={16} />
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-black dark:text-slate-300 mb-1">No. SPP</label>
                        <div className="relative">
                            <input 
                                type="text" 
                                className="w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent p-2.5 border bg-slate-50 dark:bg-slate-900 text-black dark:text-white pr-10" 
                                value={formData.sppNumber} 
                                onChange={e => handleInputChange('sppNumber', e.target.value)} 
                                placeholder="903/       /SPP/..."
                            />
                            <button 
                                onClick={handleAutoGenerateSPP}
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors p-1"
                                title="Auto Generate No. SPP"
                            >
                                <RefreshCw size={16} />
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-black dark:text-slate-300 mb-1">Sifat</label>
                        <select 
                            className="w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent p-2.5 border bg-slate-50 dark:bg-slate-900 text-black dark:text-white appearance-none" 
                            value={formData.nature} 
                            onChange={e => handleInputChange('nature', e.target.value)}
                        >
                            <option value="">-- Pilih Sifat --</option>
                            {NATURE_OPTIONS.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-black dark:text-slate-300 mb-1">Lampiran</label>
                        <input type="text" className="w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent p-2.5 border bg-slate-50 dark:bg-slate-900 text-black dark:text-white" 
                            value={formData.attachment} onChange={e => handleInputChange('attachment', e.target.value)} />
                    </div>
                    <div className="lg:col-span-3">
                        <label className="block text-sm font-bold text-black dark:text-slate-300 mb-1">Hal</label>
                        <input type="text" className="w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent p-2.5 border bg-slate-50 dark:bg-slate-900 text-black dark:text-white" 
                            value={formData.subject} onChange={e => handleInputChange('subject', e.target.value)} />
                    </div>
                </div>
            </section>

             <section className="space-y-4">
                <h3 className="text-lg font-bold text-teal-700 dark:text-teal-400 border-b-2 border-teal-100 dark:border-teal-900/30 pb-2">Pemohon / Penandatangan</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-bold text-black dark:text-slate-300 mb-1 flex items-center">Nama (1) <Lock size={14} className="ml-1 text-slate-400"/></label>
                        <input type="text" className="w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-0 p-2.5 border bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium cursor-not-allowed" 
                            value={formData.signatoryName1} readOnly />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-black dark:text-slate-300 mb-1 flex items-center">No. KTP (1) <Lock size={14} className="ml-1 text-slate-400"/></label>
                        <input type="text" className="w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-0 p-2.5 border bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium cursor-not-allowed" 
                            value={formData.ktp1} readOnly />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-black dark:text-slate-300 mb-1 flex items-center">Nama (2) <Lock size={14} className="ml-1 text-slate-400"/></label>
                        <input type="text" className="w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-0 p-2.5 border bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium cursor-not-allowed" 
                            placeholder="Opsional"
                            value={formData.signatoryName2 || ''} readOnly />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-black dark:text-slate-300 mb-1 flex items-center">No. KTP (2) <Lock size={14} className="ml-1 text-slate-400"/></label>
                        <input type="text" className="w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-0 p-2.5 border bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium cursor-not-allowed" 
                            placeholder="Opsional"
                            value={formData.ktp2 || ''} readOnly />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-black dark:text-slate-300 mb-1 flex items-center">Atas Nama Rekening <Lock size={14} className="ml-1 text-slate-400"/></label>
                        <input type="text" className="w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-0 p-2.5 border bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium cursor-not-allowed" 
                            value={formData.accountHolder} readOnly />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-black dark:text-slate-300 mb-1 flex items-center">Nomor Rekening <Lock size={14} className="ml-1 text-slate-400"/></label>
                        <input type="text" className="w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-0 p-2.5 border bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium cursor-not-allowed" 
                            value={formData.accountNumber} readOnly />
                    </div>
                </div>
            </section>

            <section className="space-y-4">
                <h3 className="text-lg font-bold text-teal-700 dark:text-teal-400 border-b-2 border-teal-100 dark:border-teal-900/30 pb-2">Konteks Proyek / Dana</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                     <div>
                        <label className="block text-sm font-bold text-black dark:text-slate-300 mb-1">Surat Permohonan No.</label>
                        <input type="text" className="w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent p-2.5 border bg-slate-50 dark:bg-slate-900 text-black dark:text-white" 
                            value={formData.requestLetterNumber} onChange={e => handleInputChange('requestLetterNumber', e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-black dark:text-slate-300 mb-1">Nama PKA</label>
                        <select 
                            className="w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent p-2.5 border bg-slate-50 dark:bg-slate-900 text-black dark:text-white appearance-none" 
                            value={formData.pkaName} onChange={e => handleInputChange('pkaName', e.target.value)}
                        >
                            <option value="">-- Pilih Nama PKA --</option>
                            {appSettings.pkaOfficials && appSettings.pkaOfficials.map(official => (
                                <option key={official.id} value={official.name}>{official.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-black dark:text-slate-300 mb-1">Pelaksana Kegiatan Anggaran</label>
                        <select 
                            className="w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent p-2.5 border bg-slate-50 dark:bg-slate-900 text-black dark:text-white appearance-none" 
                            value={formData.pkaPosition} onChange={e => handleInputChange('pkaPosition', e.target.value)}
                        >
                            <option value="">-- Pilih Jabatan --</option>
                            {uniquePositions.map(pos => (
                                <option key={pos} value={pos}>{pos}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-black dark:text-slate-300 mb-1">DPA</label>
                        <input type="text" className="w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent p-2.5 border bg-slate-50 dark:bg-slate-900 text-black dark:text-white" 
                            value={formData.dpa} onChange={e => handleInputChange('dpa', e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-black dark:text-slate-300 mb-1">Sumber Dana</label>
                        <select 
                            className="w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent p-2.5 border bg-slate-50 dark:bg-slate-900 text-black dark:text-white appearance-none" 
                            value={formData.sourceFund} onChange={e => handleInputChange('sourceFund', e.target.value)}
                        >
                            <option value="">-- Pilih Sumber Dana --</option>
                            {SOURCE_FUND_OPTIONS.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-black dark:text-slate-300 mb-1">Tahun Anggaran</label>
                        <input type="text" className="w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent p-2.5 border bg-slate-50 dark:bg-slate-900 text-black dark:text-white" 
                            value={formData.fiscalYear} onChange={e => handleInputChange('fiscalYear', e.target.value)} />
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-black dark:text-slate-300 mb-1">Bidang</label>
                        <select 
                            className="w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent p-2.5 border bg-slate-50 dark:bg-slate-900 text-black dark:text-white appearance-none" 
                            value={formData.field} 
                            onChange={e => handleInputChange('field', e.target.value)}
                        >
                            <option value="">-- Pilih Bidang --</option>
                            {Object.keys(SUB_FIELDS).map((key) => (
                                <option key={key} value={key}>{key}</option>
                            ))}
                        </select>
                    </div>
                    <div className="md:col-span-4">
                        <label className="block text-sm font-bold text-black dark:text-slate-300 mb-1">Sub. Bidang</label>
                        <select 
                            className="w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent p-2.5 border bg-slate-50 dark:bg-slate-900 text-black dark:text-white appearance-none" 
                            value={formData.subField} 
                            onChange={e => handleInputChange('subField', e.target.value)}
                            disabled={!formData.field}
                        >
                            <option value="">{formData.field ? "-- Pilih Sub. Bidang --" : "-- Pilih Bidang Terlebih Dahulu --"}</option>
                            {subFieldOptions.map((option, idx) => (
                                <option key={idx} value={option}>{option}</option>
                            ))}
                        </select>
                    </div>
                    <div className="md:col-span-4">
                        <label className="block text-sm font-bold text-black dark:text-slate-300 mb-1">Kegiatan</label>
                        <textarea rows={2} className="w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent p-2.5 border bg-slate-50 dark:bg-slate-900 text-black dark:text-white" 
                            value={formData.activity} onChange={e => handleInputChange('activity', e.target.value)} />
                    </div>

                     <div className="md:col-span-4 mt-4 bg-slate-50 dark:bg-slate-700/50 p-6 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-teal-400 dark:hover:border-teal-400 transition-colors">
                        <label className="block text-lg font-bold text-slate-800 dark:text-slate-200 mb-3 flex justify-between items-center">
                            <span>Upload RAB Kegiatan <span className="text-slate-400 text-sm font-normal">(Opsional)</span></span>
                            {formData.rabFile && <span className="text-teal-600 dark:text-teal-400 flex items-center text-sm"><Check size={18} className="mr-1"/> File Tersimpan</span>}
                        </label>
                        
                        {!formData.rabFile ? (
                            <div className="flex flex-col gap-4">
                                <p className="text-sm text-slate-500 dark:text-slate-400">Upload berkas RAB (PDF/JPG) jika diperlukan. Gunakan tombol kamera untuk foto langsung.</p>
                                <div className="flex gap-4">
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploading}
                                        className={`flex-1 flex items-center justify-center py-3 px-4 bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200 rounded-xl font-bold hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        {uploading ? <Loader2 size={20} className="mr-2 animate-spin"/> : <UploadCloud size={20} className="mr-2"/>}
                                        {uploading ? 'Mengupload...' : 'Upload File'}
                                    </button>
                                    <button 
                                        onClick={startCamera}
                                        disabled={uploading}
                                        className={`flex-1 flex items-center justify-center py-3 px-4 bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200 rounded-xl font-bold hover:bg-teal-200 dark:hover:bg-teal-900/60 transition-colors ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <Camera size={20} className="mr-2"/> Ambil Foto (Kamera)
                                    </button>
                                </div>
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    className="hidden" 
                                    accept="application/pdf,image/jpeg,image/jpg,image/png"
                                    onChange={handleFileChange}
                                />
                                {fileError && (
                                    <div className="flex items-center text-red-500 text-sm font-bold mt-1 bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">
                                        <AlertTriangle size={16} className="mr-2" /> {fileError}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm">
                                <div className="flex items-center">
                                    <div className="bg-teal-100 dark:bg-teal-900/40 p-3 rounded-xl mr-4">
                                        <FileCheck size={24} className="text-teal-600 dark:text-teal-400" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-slate-800 dark:text-white truncate max-w-[200px] md:max-w-md">{formData.rabFileName}</span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Berkas Siap Disimpan</span>
                                    </div>
                                </div>
                                <button 
                                    onClick={removeFile}
                                    className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                    title="Hapus File"
                                >
                                    <X size={24} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </section>

             <section className="space-y-4">
                <div className="flex justify-between items-center border-b-2 border-teal-100 dark:border-teal-900/30 pb-2">
                    <h3 className="text-lg font-bold text-teal-700 dark:text-teal-400 flex items-center">
                        <Calculator size={20} className="mr-2"/> Detail Keuangan
                    </h3>
                    <button 
                        onClick={handleAddItem}
                        className="flex items-center px-3 py-1 bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 rounded-lg hover:bg-teal-200 dark:hover:bg-teal-900/60 text-sm font-bold transition-colors"
                    >
                        <Plus size={16} className="mr-1" /> Tambah Baris
                    </button>
                </div>
                
                <datalist id="employee-list">
                    {employees.map(emp => (
                        <option key={emp.id} value={emp.name}>{emp.name} - {emp.bankName}</option>
                    ))}
                </datalist>

                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-600">
                        <thead className="bg-slate-100 dark:bg-slate-700">
                            <tr>
                                <th className="px-3 py-3 text-left text-xs font-bold text-black dark:text-slate-200 uppercase tracking-wider w-10">No</th>
                                <th className="px-3 py-3 text-left text-xs font-bold text-black dark:text-slate-200 uppercase tracking-wider">Nama Penerima</th>
                                <th className="px-3 py-3 text-left text-xs font-bold text-black dark:text-slate-200 uppercase tracking-wider">No. Rekening</th>
                                <th className="px-3 py-3 text-left text-xs font-bold text-black dark:text-slate-200 uppercase tracking-wider">Nama Bank</th>
                                <th className="px-3 py-3 text-left text-xs font-bold text-black dark:text-slate-200 uppercase tracking-wider">Keterangan</th>
                                <th className="px-3 py-3 text-right text-xs font-bold text-black dark:text-slate-200 uppercase tracking-wider w-36">Bruto (Rp)</th>
                                <th className="px-3 py-3 text-right text-xs font-bold text-black dark:text-slate-200 uppercase tracking-wider w-36">Potongan (Rp)</th>
                                <th className="px-3 py-3 text-right text-xs font-bold text-black dark:text-slate-200 uppercase tracking-wider w-36">Jumlah Transfer</th>
                                <th className="px-3 py-3 text-center text-xs font-bold text-black dark:text-slate-200 uppercase tracking-wider w-10">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-600">
                            {formData.items.map((item, idx) => (
                                <tr key={item.id}>
                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-black dark:text-white font-medium">{idx + 1}</td>
                                    <td className="px-3 py-2">
                                        <input 
                                            type="text" 
                                            list="employee-list"
                                            className="w-full border-0 border-b border-slate-200 dark:border-slate-600 focus:border-teal-500 focus:ring-0 text-sm bg-transparent text-black dark:text-white" 
                                            placeholder="Ketik Nama..."
                                            value={item.recipientName} 
                                            onChange={e => handleItemChange(idx, 'recipientName', e.target.value)} 
                                        />
                                    </td>
                                    <td className="px-3 py-2">
                                        <input type="text" className="w-full border-0 border-b border-slate-200 dark:border-slate-600 focus:border-teal-500 focus:ring-0 text-sm bg-transparent text-black dark:text-white" 
                                            placeholder="1234..."
                                            value={item.accountNumber} onChange={e => handleItemChange(idx, 'accountNumber', e.target.value)} />
                                    </td>
                                    <td className="px-3 py-2">
                                        <input type="text" className="w-full border-0 border-b border-slate-200 dark:border-slate-600 focus:border-teal-500 focus:ring-0 text-sm bg-transparent text-black dark:text-white" 
                                            placeholder="BJB..."
                                            value={item.bankName} onChange={e => handleItemChange(idx, 'bankName', e.target.value)} />
                                    </td>
                                    <td className="px-3 py-2">
                                        <input type="text" className="w-full border-0 border-b border-slate-200 dark:border-slate-600 focus:border-teal-500 focus:ring-0 text-sm bg-transparent text-black dark:text-white" 
                                            placeholder="-"
                                            value={item.description || ''} onChange={e => handleItemChange(idx, 'description', e.target.value)} />
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="relative">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">Rp</span>
                                            <input 
                                                type="text" 
                                                className="w-full pl-8 text-right border-0 border-b border-slate-200 dark:border-slate-600 focus:border-teal-500 focus:ring-0 text-sm bg-transparent text-black dark:text-white" 
                                                value={formatNumber(item.grossAmount)} 
                                                onChange={e => handleItemChange(idx, 'grossAmount', e.target.value)} 
                                                placeholder="0"
                                            />
                                        </div>
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="relative">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">Rp</span>
                                            <input 
                                                type="text" 
                                                className="w-full pl-8 text-right border-0 border-b border-slate-200 dark:border-slate-600 focus:border-teal-500 focus:ring-0 text-sm bg-transparent text-black dark:text-white" 
                                                value={formatNumber(item.deduction)} 
                                                onChange={e => handleItemChange(idx, 'deduction', e.target.value)} 
                                                placeholder="0"
                                            />
                                        </div>
                                    </td>
                                     <td className="px-3 py-2 text-right text-sm font-bold text-teal-700 dark:text-teal-400">
                                        Rp {item.netTransfer.toLocaleString('id-ID')}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <button 
                                            onClick={() => handleRemoveItem(idx)}
                                            className="text-slate-400 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            <tr className="bg-slate-50 dark:bg-slate-700 font-bold">
                                <td colSpan={7} className="px-3 py-3 text-right text-black dark:text-white uppercase tracking-wide">Total Transfer</td>
                                <td className="px-3 py-3 text-right text-teal-700 dark:text-teal-300 text-lg">Rp {formData.totalAmount.toLocaleString('id-ID')}</td>
                                <td></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                
                <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl text-center border border-slate-200 dark:border-slate-600">
                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Terbilang</p>
                    <p className="text-lg font-black text-slate-800 dark:text-slate-100 italic">"{formData.amountInWords}"</p>
                </div>
            </section>

            {/* Action Buttons */}
            <div className="flex flex-col md:flex-row gap-4 pt-6 border-t border-slate-100 dark:border-slate-700">
                <button 
                    onClick={handleDraft}
                    disabled={loading}
                    className="flex-1 py-4 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-all flex items-center justify-center space-x-2"
                >
                    {loading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                    <span>Simpan Draft</span>
                </button>
                <button 
                    onClick={handleSave}
                    disabled={loading}
                    className="flex-[2] py-4 bg-black dark:bg-teal-700 text-white font-bold rounded-xl shadow-xl hover:bg-slate-800 dark:hover:bg-teal-800 transition-all transform hover:-translate-y-1 flex items-center justify-center space-x-2"
                >
                    {loading ? <Loader2 size={20} className="animate-spin" /> : <FileCheck size={20} />}
                    <span>Simpan Permanen (Selesai)</span>
                </button>
            </div>
        </div>
    </div>
  );
};

export default InputForm;
