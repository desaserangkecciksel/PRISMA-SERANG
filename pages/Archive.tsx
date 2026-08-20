
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { StorageService } from '../services/storageService';
import { generateSPM, generateSPP, generateBA, generateTandaTerima } from '../services/pdfGenerator';
import { FileText, Download, FileSpreadsheet, Trash2, Printer, Archive as ArchiveIcon, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, Edit, ChevronDown, Search, X, Copy, FileCheck, ChevronLeft, ChevronRight, ListFilter, Loader2, MoreHorizontal, Percent, Wallet, CheckCircle2, XCircle, Clock, CreditCard, FilterX, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LetterData } from '../types';
import { v4 as uuidv4 } from 'uuid';

const isBankKeywordMatch = (text: string) => {
    if (!text) return false;
    // Mencocokkan "ADMIN", "ADMIN BANK", atau "POTONGAN BANK" sebagai kata utuh
    // Menggunakan regex dengan word boundary (\b) untuk menghindari kecocokan dengan "ADMINISTRASI"
    const regex = /\b(ADMIN BANK|POTONGAN BANK|ADMIN)\b/i;
    return regex.test(text);
};

const isAdminBankLetter = (l: LetterData) => {
    if (isBankKeywordMatch(l.subject || '') || isBankKeywordMatch(l.activity || '')) {
        return true;
    }
    if (l.items && l.items.length > 0) {
        // Hanya cek kolom Keterangan (description) sesuai permintaan user
        return l.items.every(item => isBankKeywordMatch(item.description || ''));
    }
    return false;
};

interface ArchiveProps {
  onEdit: (letter: LetterData) => void;
  initialTab?: 'letters' | 'taxes' | 'bank_fees';
}

const Archive: React.FC<ArchiveProps> = ({ onEdit, initialTab = 'letters' }) => {
  const [letters, setLetters] = useState<LetterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [settingsData, setSettingsData] = useState<any>(null);

  // Tab State: 'letters' | 'taxes' | 'bank_fees'
  const [activeTab, setActiveTab] = useState<'letters' | 'taxes' | 'bank_fees'>(initialTab);

  const [sortConfig, setSortConfig] = useState<{ key: keyof LetterData; direction: 'ascending' | 'descending' } | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [activePrintMenu, setActivePrintMenu] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const exportMenuRef = useRef<HTMLDivElement>(null);
  
  // Filter State
  const [showFilters, setShowFilters] = useState(false);
  const [filterConfig, setFilterConfig] = useState({
      startDate: '',
      endDate: '',
      status: '',
      sourceFund: ''
  });

  // Pagination State
  const [itemsPerPage, setItemsPerPage] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);
  
  // Modal State
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Sync activeTab with prop changes
  useEffect(() => {
      setActiveTab(initialTab);
  }, [initialTab]);

  // Load Data
  useEffect(() => {
    const fetchData = async () => {
        setLoading(true);
        try {
            const [l, s] = await Promise.all([
                StorageService.getLetters(),
                StorageService.getSettings()
            ]);
            setLetters(l || []);
            setSettingsData(s);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };
    fetchData();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
      if (activePrintMenu && !(event.target as Element).closest('.print-menu-container')) {
          setActivePrintMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activePrintMenu, showExportMenu]);

  const handleDeleteClick = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (deleteId) {
        await StorageService.deleteLetter(deleteId);
        const updated = await StorageService.getLetters();
        setLetters(updated);
        setDeleteId(null);
    }
  };

  const cancelDelete = () => {
      setDeleteId(null);
  };

  const handleCopy = async (letter: LetterData) => {
    const baseYear = new Date().getFullYear();
    const nextSPM = await StorageService.getNextSPMNumber(baseYear);
    
    const newLetter: LetterData = {
        ...letter,
        id: uuidv4(),
        status: 'draft',
        letterNumber: nextSPM,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    await StorageService.saveLetter(newLetter);
    const updated = await StorageService.getLetters();
    setLetters(updated);
    alert(`Surat berhasil disalin menjadi Draft dengan No. SPM baru: ${nextSPM}`);
  };

  const requestSort = (key: keyof LetterData) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === 'ascending'
    ) {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const resetFilters = () => {
      setFilterConfig({ startDate: '', endDate: '', status: '', sourceFund: '' });
  };

  // --- LOGIC: UPDATE PAJAK ---
  const updateTaxStatus = async (id: string, status: 'paid' | 'unpaid') => {
      const letterIndex = letters.findIndex(l => l.id === id);
      if (letterIndex > -1) {
          const updatedLetters = [...letters];
          updatedLetters[letterIndex] = { ...updatedLetters[letterIndex], taxStatus: status };
          setLetters(updatedLetters);
          await StorageService.saveLetter(updatedLetters[letterIndex]);
      }
  };

  const updateTaxNote = async (id: string, note: string) => {
      const letterIndex = letters.findIndex(l => l.id === id);
      if (letterIndex > -1) {
          const updatedLetters = [...letters];
          updatedLetters[letterIndex] = { ...updatedLetters[letterIndex], taxNote: note };
          setLetters(updatedLetters);
          await StorageService.saveLetter(updatedLetters[letterIndex]);
      }
  };

  // --- LOGIC: DATA SURAT ---
  const filteredLetters = useMemo(() => {
    let result = letters.filter(l => !isAdminBankLetter(l));

    // Filter by Search Term
    if (searchTerm) {
        const lowerTerm = searchTerm.toLowerCase();
        result = result.filter(letter =>
            (letter.letterNumber || '').toLowerCase().includes(lowerTerm) ||
            (letter.pkaName || '').toLowerCase().includes(lowerTerm) ||
            (letter.activity || '').toLowerCase().includes(lowerTerm) ||
            (letter.subject || '').toLowerCase().includes(lowerTerm) ||
            (letter.nature || '').toLowerCase().includes(lowerTerm)
        );
    }

    // Filter by Filter Config
    if (filterConfig.status) {
        result = result.filter(l => l.status === filterConfig.status);
    }
    if (filterConfig.sourceFund) {
        result = result.filter(l => l.sourceFund === filterConfig.sourceFund);
    }
    if (filterConfig.startDate) {
        result = result.filter(l => l.date >= filterConfig.startDate);
    }
    if (filterConfig.endDate) {
        result = result.filter(l => l.date <= filterConfig.endDate);
    }

    return result;
  }, [letters, searchTerm, filterConfig]);

  const letterSummaries = useMemo(() => {
      const total = filteredLetters.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);
      const finished = filteredLetters
          .filter(l => l.status === 'saved' || l.status === 'archived')
          .reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);
      const draft = filteredLetters
          .filter(l => l.status === 'draft')
          .reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);
      return { total, finished, draft };
  }, [filteredLetters]);

  const sortedLetters = useMemo(() => {
    let sortableItems = [...filteredLetters]; 
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        
        if (valA === undefined && valB === undefined) return 0;
        if (valA === undefined) return 1;
        if (valB === undefined) return -1;

        if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredLetters, sortConfig]);

  const paginatedLetters = useMemo(() => {
      const startIndex = (currentPage - 1) * itemsPerPage;
      return sortedLetters.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedLetters, currentPage, itemsPerPage]);

  // --- LOGIC: DATA PAJAK (Tax Archive) ---
  const taxRecords = useMemo(() => {
      const finishedLetters = letters.filter(l => (l.status === 'saved' || l.status === 'archived') && !isAdminBankLetter(l));
      
      const records = finishedLetters.map(l => {
          const totalTax = (l.items || []).reduce((sum, item) => {
              // Hanya cek kolom Keterangan (description) untuk mengecualikan item bank dari pajak
              const isBankItem = isBankKeywordMatch(item.description || '');
              return sum + (isBankItem ? 0 : (item.deduction || 0));
          }, 0);
          return {
              id: l.id,
              date: l.date,
              letterNumber: l.letterNumber,
              activity: l.activity,
              subject: l.subject,
              pkaName: l.pkaName,
              totalTax: totalTax,
              status: l.taxStatus || 'unpaid',
              note: l.taxNote || ''
          };
      });

      let validRecords = records.filter(r => r.totalTax > 0);

      // Search Filter
      if (searchTerm) {
          const lowerTerm = searchTerm.toLowerCase();
          validRecords = validRecords.filter(r => 
             (r.letterNumber || '').toLowerCase().includes(lowerTerm) ||
             (r.subject || '').toLowerCase().includes(lowerTerm)
          );
      }

      // Advanced Filters
      if (filterConfig.status) {
          validRecords = validRecords.filter(r => r.status === filterConfig.status);
      }
      if (filterConfig.startDate) {
          validRecords = validRecords.filter(r => r.date >= filterConfig.startDate);
      }
      if (filterConfig.endDate) {
          validRecords = validRecords.filter(r => r.date <= filterConfig.endDate);
      }

      return validRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [letters, searchTerm, filterConfig]);

  const paginatedTaxRecords = useMemo(() => {
      const startIndex = (currentPage - 1) * itemsPerPage;
      return taxRecords.slice(startIndex, startIndex + itemsPerPage);
  }, [taxRecords, currentPage, itemsPerPage]);

  const taxSummaries = useMemo(() => {
      const total = taxRecords.reduce((acc, curr) => acc + curr.totalTax, 0);
      const paid = taxRecords.filter(r => r.status === 'paid').reduce((acc, curr) => acc + curr.totalTax, 0);
      const unpaid = total - paid;
      return { total, paid, unpaid };
  }, [taxRecords]);

  // --- LOGIC: DATA ADMIN BANK (Bank Fee Archive) ---
  const bankFeeRecords = useMemo(() => {
      const finishedLetters = letters.filter(l => l.status === 'saved' || l.status === 'archived');
      
      const records: any[] = [];
      
      finishedLetters.forEach(l => {
          (l.items || []).forEach(item => {
               // Mengambil item yang Keterangannya mengandung keyword bank atau suratnya adalah surat admin bank
               const isBankItem = isBankKeywordMatch(item.description || '') || isAdminBankLetter(l);
               
               if (isBankItem) {
                   records.push({
                       id: item.id || `${l.id}-${Math.random()}`,
                       letterId: l.id,
                       date: l.date,
                       letterNumber: l.letterNumber,
                       activity: l.activity,
                       subject: l.subject,
                       recipientName: item.recipientName,
                       description: item.description,
                       amount: item.netTransfer || item.deduction || item.grossAmount || 0
                   });
               }
          });
      });

      let validRecords = records;

      // Search Filter
      if (searchTerm) {
          const lowerTerm = searchTerm.toLowerCase();
          validRecords = validRecords.filter(r => 
             (r.letterNumber || '').toLowerCase().includes(lowerTerm) ||
             (r.subject || '').toLowerCase().includes(lowerTerm) ||
             (r.recipientName || '').toLowerCase().includes(lowerTerm)
          );
      }

      // Advanced Filters (Only Date for Bank Fees currently)
      if (filterConfig.startDate) {
          validRecords = validRecords.filter(r => r.date >= filterConfig.startDate);
      }
      if (filterConfig.endDate) {
          validRecords = validRecords.filter(r => r.date <= filterConfig.endDate);
      }
      
      // Sort desc by date
      return validRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  }, [letters, searchTerm, filterConfig]);

  const paginatedBankRecords = useMemo(() => {
      const startIndex = (currentPage - 1) * itemsPerPage;
      return bankFeeRecords.slice(startIndex, startIndex + itemsPerPage);
  }, [bankFeeRecords, currentPage, itemsPerPage]);

  const bankFeeTotal = useMemo(() => {
      return bankFeeRecords.reduce((acc, curr) => acc + curr.amount, 0);
  }, [bankFeeRecords]);


  // Pagination Helpers
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage, sortConfig, activeTab, filterConfig]);

  const getPageNumbers = () => {
    let totalItems = 0;
    if (activeTab === 'letters') totalItems = sortedLetters.length;
    else if (activeTab === 'taxes') totalItems = taxRecords.length;
    else totalItems = bankFeeRecords.length;

    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const pages = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
        if (currentPage <= 3) {
            pages.push(1, 2, 3, 4, '...', totalPages);
        } else if (currentPage >= totalPages - 2) {
            pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
        } else {
            pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
        }
    }
    return { pages, totalPages };
  };

  const { pages: pageNumbers, totalPages } = getPageNumbers();

  // EXPORT FUNCTIONS
  const exportExcel = () => {
    if (activeTab === 'letters') {
        const data = sortedLetters.map((l, index) => ({
            'No': index + 1,
            'Tanggal Surat': new Date(l.date).toLocaleDateString('id-ID'),
            'Nomor Surat': l.letterNumber,
            'Nama PKA': l.pkaName,
            'Hal': l.subject,
            'Sumber Dana': l.sourceFund,
            'Total Nominal (Rp)': l.totalAmount,
            'Status': l.status === 'saved' ? 'Selesai' : l.status === 'archived' ? 'Terarsip' : 'Draft'
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Arsip Surat");
        XLSX.writeFile(wb, `Arsip-Surat-Serang-${new Date().toISOString().split('T')[0]}.xlsx`);
    } else if (activeTab === 'taxes') {
        // Export Pajak
        const data = taxRecords.map((r, index) => ({
            'No': index + 1,
            'Tanggal': new Date(r.date).toLocaleDateString('id-ID'),
            'Nomor SPM': r.letterNumber,
            'Hal': r.subject,
            'Total Potongan (Pajak)': r.totalTax,
            'Status': r.status === 'paid' ? 'Sudah Dibayar' : 'Belum Dibayar',
            'Catatan': r.note
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Arsip Pajak");
        XLSX.writeFile(wb, `Arsip-Pajak-Serang-${new Date().toISOString().split('T')[0]}.xlsx`);
    } else {
        // Export Bank Fees
        const data = bankFeeRecords.map((r, index) => ({
            'No': index + 1,
            'Tanggal': new Date(r.date).toLocaleDateString('id-ID'),
            'Nomor SPM': r.letterNumber,
            'Hal': r.subject,
            'Penerima': r.recipientName,
            'Keterangan': r.description || '-',
            'Nominal Admin': r.amount
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Admin Bank");
        XLSX.writeFile(wb, `Arsip-Admin-Bank-${new Date().toISOString().split('T')[0]}.xlsx`);
    }
    setShowExportMenu(false);
  };

  const exportPDFReport = () => {
    const doc = new jsPDF('landscape');
    const today = new Date().toLocaleDateString('id-ID', { dateStyle: 'full' });
    const currentYear = Math.max(new Date().getFullYear(), 2026);

    if (activeTab === 'letters') {
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(`LAPORAN ARSIP SPM DESA SERANG TAHUN ${currentYear}`, 14, 15);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Dicetak pada: ${today}`, 14, 22);
        
        const tableData = sortedLetters.map((l, index) => [
            (index + 1).toString(),
            new Date(l.date).toLocaleDateString('id-ID'),
            l.letterNumber,
            l.pkaName,
            (l.subject || '').length > 60 ? (l.subject || '').substring(0, 60) + '...' : (l.subject || ''),
            `Rp ${l.totalAmount.toLocaleString('id-ID')}`,
            l.status === 'saved' ? 'SELESAI' : l.status.toUpperCase()
        ]);

        autoTable(doc, {
            head: [['No', 'Tgl Surat', 'No. Surat', 'Nama PKA', 'Hal', 'Nominal', 'Status']],
            body: tableData,
            startY: 35,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2, lineWidth: 0.1 },
            headStyles: { fillColor: [30, 41, 59], textColor: 255 },
            columnStyles: { 5: { halign: 'right' } }
        });
    } else if (activeTab === 'taxes') {
        // PDF Report for Taxes
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(`LAPORAN ARSIP PAJAK (POTONGAN) TAHUN ${currentYear}`, 14, 15);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Dicetak pada: ${today}`, 14, 22);
        doc.text(`Total Akumulasi Pajak: Rp ${taxSummaries.total.toLocaleString('id-ID')} (Lunas: ${taxSummaries.paid.toLocaleString('id-ID')})`, 14, 27);

        const tableData = taxRecords.map((r, index) => [
            (index + 1).toString(),
            new Date(r.date).toLocaleDateString('id-ID'),
            r.letterNumber,
            (r.subject || '').length > 50 ? (r.subject || '').substring(0, 50) + '...' : (r.subject || ''),
            `Rp ${r.totalTax.toLocaleString('id-ID')}`,
            r.status === 'paid' ? 'LUNAS' : 'BELUM',
            r.note
        ]);

        autoTable(doc, {
            head: [['No', 'Tanggal', 'No. SPM', 'Hal', 'Total Potongan', 'Status', 'Catatan']],
            body: tableData,
            startY: 35,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2, lineWidth: 0.1 },
            headStyles: { fillColor: [88, 28, 135], textColor: 255 }, // Purple for tax
            columnStyles: { 4: { halign: 'right', fontStyle: 'bold' } }
        });
    } else {
        // PDF Report for Bank Fees
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(`LAPORAN ARSIP ADMIN BANK TAHUN ${currentYear}`, 14, 15);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Dicetak pada: ${today}`, 14, 22);
        doc.text(`Total Admin Bank: Rp ${bankFeeTotal.toLocaleString('id-ID')}`, 14, 27);

        const tableData = bankFeeRecords.map((r, index) => [
            (index + 1).toString(),
            new Date(r.date).toLocaleDateString('id-ID'),
            r.letterNumber,
            (r.subject || '').length > 40 ? (r.subject || '').substring(0, 40) + '...' : (r.subject || ''),
            r.recipientName,
            r.description || '-',
            `Rp ${r.amount.toLocaleString('id-ID')}`
        ]);

        autoTable(doc, {
            head: [['No', 'Tanggal', 'No. SPM', 'Hal', 'Penerima', 'Keterangan', 'Nominal']],
            body: tableData,
            startY: 35,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2, lineWidth: 0.1 },
            headStyles: { fillColor: [234, 88, 12], textColor: 255 }, // Orange for bank
            columnStyles: { 6: { halign: 'right', fontStyle: 'bold' } }
        });
    }

    doc.save(`Laporan-${activeTab === 'letters' ? 'Arsip' : activeTab === 'taxes' ? 'Pajak' : 'AdminBank'}-Serang.pdf`);
    setShowExportMenu(false);
  };

  const getSortIcon = (name: keyof LetterData) => {
      if (!sortConfig || sortConfig.key !== name) {
          return <ArrowUpDown size={14} className="ml-1 text-slate-400 opacity-50" />;
      }
      return sortConfig.direction === 'ascending' ? 
        <ArrowUp size={14} className="ml-1 text-teal-600 dark:text-teal-400" /> : 
        <ArrowDown size={14} className="ml-1 text-teal-600 dark:text-teal-400" />;
  };

  const getStatusBadge = (status: string) => {
      switch(status) {
          case 'saved':
              return <span className="px-3 py-1 inline-flex text-[10px] leading-5 font-black rounded-full bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 uppercase">Selesai</span>;
          case 'archived':
              return <span className="px-3 py-1 inline-flex text-[10px] leading-5 font-black rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 uppercase">Terarsip</span>;
          default:
              return <span className="px-3 py-1 inline-flex text-[10px] leading-5 font-black rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 uppercase">Draft</span>;
      }
  };

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500 dark:text-slate-400"><Loader2 className="animate-spin mr-2"/> Memuat Arsip...</div>;

  return (
    <div className="space-y-6 animate-fade-in text-black dark:text-slate-100 pb-20 w-full">
       <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 w-full">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full lg:w-auto">
                <h2 className="text-3xl font-extrabold text-black dark:text-white tracking-tight flex items-center whitespace-nowrap shrink-0">
                    <ArchiveIcon className="mr-3 text-teal-600 dark:text-teal-400"/> Arsip Surat
                </h2>
                
                {/* TAB SWITCHER */}
                <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-xl w-full sm:w-auto overflow-x-auto sm:overflow-visible">
                    <button 
                        onClick={() => { setActiveTab('letters'); resetFilters(); }}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center whitespace-nowrap flex-1 sm:flex-none justify-center ${
                            activeTab === 'letters' 
                            ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-sm' 
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                    >
                        <FileText size={16} className="mr-2" /> Data Surat
                    </button>
                    <button 
                        onClick={() => { setActiveTab('taxes'); resetFilters(); }}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center whitespace-nowrap flex-1 sm:flex-none justify-center ${
                            activeTab === 'taxes' 
                            ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-sm' 
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                    >
                        <Percent size={16} className="mr-2" /> Data Pajak
                    </button>
                    <button 
                        onClick={() => { setActiveTab('bank_fees'); resetFilters(); }}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center whitespace-nowrap flex-1 sm:flex-none justify-center ${
                            activeTab === 'bank_fees' 
                            ? 'bg-white dark:bg-slate-700 text-orange-700 dark:text-orange-300 shadow-sm' 
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                    >
                        <CreditCard size={16} className="mr-2" /> Data Admin Bank
                    </button>
                </div>
            </div>
            
            <div className="flex flex-col md:flex-row gap-3 w-full lg:w-auto justify-end">
                <div className="relative w-full md:w-64 lg:w-64">
                   <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                       <Search size={18} />
                   </div>
                   <input
                     type="text"
                     placeholder={activeTab === 'letters' ? "Cari No. Surat, PKA atau Hal..." : "Cari No. SPM atau Hal..."}
                     className="w-full pl-10 pr-10 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none shadow-sm text-sm font-medium bg-white dark:bg-slate-800 text-black dark:text-white"
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                   />
                   {searchTerm && (
                       <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                           <X size={16} />
                       </button>
                   )}
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button 
                        onClick={() => setShowFilters(!showFilters)}
                        className={`w-full md:w-auto flex items-center justify-center px-4 py-2.5 rounded-xl transition-all font-bold shadow-sm whitespace-nowrap border ${
                            showFilters 
                            ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-700' 
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                    >
                        <ListFilter size={18} className="mr-2" />
                        Filter
                        {(filterConfig.startDate || filterConfig.endDate || filterConfig.status || filterConfig.sourceFund) && (
                            <span className="ml-2 w-2 h-2 rounded-full bg-teal-500"></span>
                        )}
                    </button>

                    <div className="relative flex-1 md:flex-none">
                        <select
                            value={itemsPerPage}
                            onChange={(e) => setItemsPerPage(Number(e.target.value))}
                            className="w-full md:w-auto pl-4 pr-8 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none shadow-sm text-sm bg-white dark:bg-slate-800 appearance-none cursor-pointer font-bold text-slate-700 dark:text-slate-200"
                        >
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>

                    <div className="relative flex-1 md:flex-none" ref={exportMenuRef}>
                        <button 
                            onClick={() => setShowExportMenu(!showExportMenu)}
                            className="w-full md:w-auto flex items-center justify-center px-4 py-2.5 bg-slate-800 dark:bg-slate-700 text-white rounded-xl hover:bg-slate-900 dark:hover:bg-slate-600 transition-all font-bold shadow-lg shadow-slate-300 dark:shadow-slate-900/50 active:scale-95 whitespace-nowrap"
                        >
                            <Download size={18} className="mr-2" /> 
                            Export
                            <ChevronDown size={16} className={`ml-2 transition-transform duration-200 ${showExportMenu ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {showExportMenu && (
                            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-700 z-[60] overflow-hidden animate-scale-up origin-top-right">
                                <button onClick={exportExcel} className="w-full text-left px-4 py-3 hover:bg-green-50 dark:hover:bg-green-900/30 text-slate-700 dark:text-slate-200 hover:text-green-700 dark:hover:text-green-400 flex items-center transition-colors font-medium text-sm group">
                                    <FileSpreadsheet size={18} className="mr-3 text-green-600 dark:text-green-500" /> Export Excel
                                </button>
                                <button onClick={exportPDFReport} className="w-full text-left px-4 py-3 hover:bg-rose-50 dark:hover:bg-rose-900/30 text-slate-700 dark:text-slate-200 hover:text-rose-700 dark:hover:text-rose-400 flex items-center transition-colors font-medium text-sm group">
                                    <Printer size={18} className="mr-3 text-rose-600 dark:text-rose-500" /> Cetak Laporan
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg animate-fade-in grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Dari Tanggal</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            type="date" 
                            className="w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-teal-500 text-slate-700 dark:text-slate-200"
                            value={filterConfig.startDate}
                            onChange={(e) => setFilterConfig(prev => ({...prev, startDate: e.target.value}))}
                        />
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Sampai Tanggal</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            type="date" 
                            className="w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-teal-500 text-slate-700 dark:text-slate-200"
                            value={filterConfig.endDate}
                            onChange={(e) => setFilterConfig(prev => ({...prev, endDate: e.target.value}))}
                        />
                    </div>
                </div>

                {activeTab === 'letters' && (
                    <>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Status Surat</label>
                            <select 
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-teal-500 text-slate-700 dark:text-slate-200"
                                value={filterConfig.status}
                                onChange={(e) => setFilterConfig(prev => ({...prev, status: e.target.value}))}
                            >
                                <option value="">Semua Status</option>
                                <option value="draft">Draft</option>
                                <option value="saved">Selesai (Saved)</option>
                                <option value="archived">Terarsip</option>
                            </select>
                        </div>
                         <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Sumber Dana</label>
                            <select 
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-teal-500 text-slate-700 dark:text-slate-200"
                                value={filterConfig.sourceFund}
                                onChange={(e) => setFilterConfig(prev => ({...prev, sourceFund: e.target.value}))}
                            >
                                <option value="">Semua Sumber Dana</option>
                                <option value="ADD">ADD</option>
                                <option value="DDS">DDS</option>
                                <option value="PBH">PBH</option>
                                <option value="PBP">PBP</option>
                                <option value="PBK">PBK</option>
                                <option value="DLL">DLL</option>
                                <option value="PAD">PAD</option>
                            </select>
                        </div>
                    </>
                )}

                {activeTab === 'taxes' && (
                     <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Status Pembayaran</label>
                        <select 
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-teal-500 text-slate-700 dark:text-slate-200"
                            value={filterConfig.status}
                            onChange={(e) => setFilterConfig(prev => ({...prev, status: e.target.value}))}
                        >
                            <option value="">Semua</option>
                            <option value="paid">Lunas (Sudah Dibayar)</option>
                            <option value="unpaid">Belum Dibayar</option>
                        </select>
                    </div>
                )}
                
                {/* Reset Button - Always visible but styled subtly */}
                 <div className="flex items-end">
                    <button 
                        onClick={resetFilters} 
                        className="w-full py-2 px-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 font-bold text-sm transition-colors flex items-center justify-center border border-slate-200 dark:border-slate-600"
                    >
                        <FilterX size={16} className="mr-2" /> Reset
                    </button>
                </div>
            </div>
        )}

        {/* CONTENT AREA BASED ON TAB */}
        {activeTab === 'letters' ? (
            /* --- TAB: LETTERS TABLE --- */
            <div key="letters-tab" className="space-y-6 animate-fade-in">
                {/* Letters Accumulation Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Total All */}
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 dark:from-blue-800 dark:to-indigo-900 rounded-2xl shadow-xl p-6 text-white relative overflow-hidden group">
                        <div className="relative z-10">
                            <p className="text-blue-200 text-xs font-bold uppercase tracking-widest mb-1">Total Pengeluaran (Semua)</p>
                            <h3 className="text-2xl font-black">Rp {letterSummaries.total.toLocaleString('id-ID')}</h3>
                            <p className="text-blue-200 text-[10px] mt-1 opacity-80">
                                *Akumulasi seluruh status surat
                            </p>
                        </div>
                        <Wallet size={80} className="absolute -right-4 -bottom-8 opacity-20 group-hover:scale-110 transition-transform duration-500" />
                    </div>

                    {/* Finished / Saved */}
                    <div className="bg-gradient-to-r from-emerald-500 to-teal-600 dark:from-emerald-700 dark:to-teal-800 rounded-2xl shadow-xl p-6 text-white relative overflow-hidden group">
                        <div className="relative z-10">
                            <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest mb-1">Selesai & Terarsip</p>
                            <h3 className="text-2xl font-black">Rp {letterSummaries.finished.toLocaleString('id-ID')}</h3>
                            <p className="text-emerald-100 text-[10px] mt-1 opacity-80 flex items-center">
                                <CheckCircle2 size={12} className="mr-1"/> Dokumen Final
                            </p>
                        </div>
                        <FileCheck size={80} className="absolute -right-4 -bottom-8 opacity-20 group-hover:scale-110 transition-transform duration-500" />
                    </div>

                    {/* Draft */}
                    <div className="bg-gradient-to-r from-amber-500 to-orange-600 dark:from-amber-700 dark:to-orange-800 rounded-2xl shadow-xl p-6 text-white relative overflow-hidden group">
                        <div className="relative z-10">
                            <p className="text-amber-100 text-xs font-bold uppercase tracking-widest mb-1">Draft (Konsep)</p>
                            <h3 className="text-2xl font-black">Rp {letterSummaries.draft.toLocaleString('id-ID')}</h3>
                            <p className="text-amber-100 text-[10px] mt-1 opacity-80 flex items-center">
                                <Clock size={12} className="mr-1"/> Belum Final
                            </p>
                        </div>
                        <FileText size={80} className="absolute -right-4 -bottom-8 opacity-20 group-hover:scale-110 transition-transform duration-500" />
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
                    <div className="overflow-x-auto w-full">
                        <table className="w-full divide-y divide-slate-200 dark:divide-slate-700 table-fixed">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-20">
                                <tr>
                                    <th className="w-16 px-4 py-4 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">No</th>
                                    <th className="w-36 px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => requestSort('date')}>
                                        <div className="flex items-center">Tgl Surat {getSortIcon('date')}</div>
                                    </th>
                                    <th className="w-60 px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => requestSort('letterNumber')}>
                                        <div className="flex items-center">No Surat {getSortIcon('letterNumber')}</div>
                                    </th>
                                    <th className="min-w-[300px] px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Hal</th>
                                    <th className="w-40 px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => requestSort('totalAmount')}>
                                        <div className="flex items-center">Total {getSortIcon('totalAmount')}</div>
                                    </th>
                                    <th className="w-32 px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                                    <th className="w-48 px-6 py-4 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                                {paginatedLetters.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-20 text-center text-slate-400 dark:text-slate-500">
                                            <ArchiveIcon size={48} className="mx-auto mb-4 opacity-20" />
                                            {searchTerm || filterConfig.status || filterConfig.startDate ? 'Tidak ditemukan surat dengan filter tersebut.' : 'Belum ada surat yang diarsipkan.'}
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedLetters.map((letter, index) => {
                                        const globalIndex = (currentPage - 1) * itemsPerPage + index + 1;
                                        return (
                                            <tr key={letter.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                                                <td className="px-4 py-4 whitespace-nowrap text-xs font-black text-slate-400 dark:text-slate-500 text-center">
                                                    {globalIndex}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300 font-medium">
                                                    {new Date(letter.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </td>
                                                <td className="px-6 py-4 text-sm font-bold text-teal-700 dark:text-teal-400 truncate">
                                                    {letter.letterNumber}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">
                                                    <div className="line-clamp-2 leading-relaxed" title={letter.subject}>{letter.subject}</div>
                                                    <div className="flex gap-2 mt-1">
                                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-tight">{letter.pkaName}</span>
                                                        {letter.sourceFund && <span className="text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 rounded text-slate-500 font-bold">{letter.sourceFund}</span>}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-white font-mono font-bold">
                                                    Rp {letter.totalAmount.toLocaleString('id-ID')}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {getStatusBadge(letter.status)}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end space-x-2 items-center">
                                                        <div className="relative print-menu-container">
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setActivePrintMenu(activePrintMenu === letter.id ? null : letter.id);
                                                                }}
                                                                className={`p-2 rounded-lg transition-all ${
                                                                    activePrintMenu === letter.id 
                                                                    ? 'bg-teal-600 text-white shadow-md' 
                                                                    : 'text-slate-400 dark:text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30'
                                                                }`}
                                                            >
                                                                <Printer size={18} />
                                                            </button>
                                                            
                                                            {activePrintMenu === letter.id && (
                                                                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-[70] animate-scale-up origin-top-right p-1">
                                                                    <button onClick={() => { if(settingsData) generateSPM(letter, settingsData); setActivePrintMenu(null); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-900/30 text-slate-700 dark:text-slate-200 hover:text-teal-700 dark:hover:text-teal-400 text-xs font-bold flex items-center transition-colors mb-1">
                                                                        <FileText size={14} className="mr-2 text-teal-600 dark:text-teal-400" /> Cetak SPM
                                                                    </button>
                                                                    <button onClick={() => { if(settingsData) generateSPP(letter, settingsData); setActivePrintMenu(null); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 text-slate-700 dark:text-slate-200 hover:text-blue-700 dark:hover:text-blue-400 text-xs font-bold flex items-center transition-colors mb-1">
                                                                        <FileText size={14} className="mr-2 text-blue-600 dark:text-blue-400" /> Cetak SPP
                                                                    </button>
                                                                    <button onClick={() => { if(settingsData) generateBA(letter, settingsData); setActivePrintMenu(null); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/30 text-slate-700 dark:text-slate-200 hover:text-amber-700 dark:hover:text-amber-400 text-xs font-bold flex items-center transition-colors mb-1">
                                                                        <FileText size={14} className="mr-2 text-amber-600 dark:text-amber-400" /> Cetak Berita Acara
                                                                    </button>
                                                                    <button onClick={() => { if(settingsData) generateTandaTerima(letter, settingsData); setActivePrintMenu(null); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/30 text-slate-700 dark:text-slate-200 hover:text-rose-700 dark:hover:text-rose-400 text-xs font-bold flex items-center transition-colors">
                                                                        <FileText size={14} className="mr-2 text-rose-500 dark:text-rose-400" /> Cetak Tanda Terima
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <button onClick={() => handleCopy(letter)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors" title="Salin"><Copy size={18} /></button>
                                                        <button onClick={() => onEdit(letter)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-colors" title="Edit"><Edit size={18} /></button>
                                                        <button onClick={() => handleDeleteClick(letter.id)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"><Trash2 size={18} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        ) : activeTab === 'taxes' ? (
            /* --- TAB: TAX CONTAINER --- */
            <div key="taxes-tab" className="space-y-6 animate-fade-in">
                {/* Summary Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Total All */}
                    <div className="bg-gradient-to-r from-purple-600 to-indigo-700 dark:from-purple-800 dark:to-indigo-900 rounded-2xl shadow-xl p-6 text-white relative overflow-hidden group">
                        <div className="relative z-10">
                            <p className="text-purple-200 text-xs font-bold uppercase tracking-widest mb-1">Total Akumulasi Pajak</p>
                            <h3 className="text-2xl font-black">Rp {taxSummaries.total.toLocaleString('id-ID')}</h3>
                            <p className="text-purple-200 text-[10px] mt-1 opacity-80">
                                *Semua pajak terdata
                            </p>
                        </div>
                        <Wallet size={80} className="absolute -right-4 -bottom-8 opacity-20 group-hover:scale-110 transition-transform duration-500" />
                    </div>

                    {/* Paid */}
                    <div className="bg-gradient-to-r from-emerald-500 to-teal-600 dark:from-emerald-700 dark:to-teal-800 rounded-2xl shadow-xl p-6 text-white relative overflow-hidden group">
                        <div className="relative z-10">
                            <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest mb-1">Sudah Dibayar</p>
                            <h3 className="text-2xl font-black">Rp {taxSummaries.paid.toLocaleString('id-ID')}</h3>
                            <p className="text-emerald-100 text-[10px] mt-1 opacity-80 flex items-center">
                                <CheckCircle2 size={12} className="mr-1"/> Lunas
                            </p>
                        </div>
                        <Percent size={80} className="absolute -right-4 -bottom-8 opacity-20 group-hover:scale-110 transition-transform duration-500" />
                    </div>

                    {/* Unpaid */}
                    <div className="bg-gradient-to-r from-rose-500 to-pink-600 dark:from-rose-700 dark:to-pink-800 rounded-2xl shadow-xl p-6 text-white relative overflow-hidden group">
                        <div className="relative z-10">
                            <p className="text-rose-100 text-xs font-bold uppercase tracking-widest mb-1">Belum Dibayar</p>
                            <h3 className="text-2xl font-black">Rp {taxSummaries.unpaid.toLocaleString('id-ID')}</h3>
                            <p className="text-rose-100 text-[10px] mt-1 opacity-80 flex items-center">
                                <XCircle size={12} className="mr-1"/> Outstanding
                            </p>
                        </div>
                        <AlertTriangle size={80} className="absolute -right-4 -bottom-8 opacity-20 group-hover:scale-110 transition-transform duration-500" />
                    </div>
                </div>

                {/* Tax Table */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
                    <div className="overflow-x-auto w-full">
                        <table className="w-full divide-y divide-slate-200 dark:divide-slate-700 table-fixed">
                            <thead className="bg-purple-50 dark:bg-purple-900/20 sticky top-0 z-20">
                                <tr>
                                    <th className="w-12 px-4 py-4 text-center text-xs font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wider">No</th>
                                    <th className="w-28 px-4 py-4 text-left text-xs font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wider">Tanggal</th>
                                    <th className="w-48 px-4 py-4 text-left text-xs font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wider">No. SPM</th>
                                    <th className="min-w-[200px] px-4 py-4 text-left text-xs font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wider">Hal</th>
                                    <th className="w-40 px-4 py-4 text-right text-xs font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wider">Potongan (Rp)</th>
                                    <th className="w-40 px-4 py-4 text-center text-xs font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wider">Status</th>
                                    <th className="w-48 px-4 py-4 text-left text-xs font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wider">Catatan</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                                {paginatedTaxRecords.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-20 text-center text-slate-400 dark:text-slate-500">
                                            <Percent size={48} className="mx-auto mb-4 opacity-20 text-purple-500" />
                                            {searchTerm || filterConfig.status || filterConfig.startDate ? 'Tidak ditemukan data pajak dengan filter tersebut.' : 'Belum ada data pajak dari surat yang selesai.'}
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedTaxRecords.map((record, index) => {
                                        const globalIndex = (currentPage - 1) * itemsPerPage + index + 1;
                                        return (
                                            <tr key={record.id} className="hover:bg-purple-50/50 dark:hover:bg-purple-900/20 transition-colors">
                                                <td className="px-4 py-4 whitespace-nowrap text-xs font-black text-slate-400 dark:text-slate-500 text-center">
                                                    {globalIndex}
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-xs text-slate-600 dark:text-slate-300 font-medium">
                                                    {new Date(record.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </td>
                                                <td className="px-4 py-4 text-xs font-bold text-purple-700 dark:text-purple-400 truncate" title={record.letterNumber}>
                                                    {record.letterNumber}
                                                </td>
                                                <td className="px-4 py-4 text-xs text-slate-700 dark:text-slate-300">
                                                    <div className="line-clamp-2 leading-relaxed" title={record.subject}>{record.subject}</div>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-right text-xs text-slate-900 dark:text-white font-mono font-bold bg-slate-50/50 dark:bg-slate-700/30">
                                                    Rp {record.totalTax.toLocaleString('id-ID')}
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <select 
                                                        value={record.status}
                                                        onChange={(e) => updateTaxStatus(record.id, e.target.value as 'paid' | 'unpaid')}
                                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border-none outline-none cursor-pointer shadow-sm transition-all ${
                                                            record.status === 'paid' 
                                                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:bg-green-200' 
                                                            : 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200 hover:bg-rose-200'
                                                        }`}
                                                    >
                                                        <option value="unpaid">Belum Dibayar</option>
                                                        <option value="paid">Sudah Dibayar</option>
                                                    </select>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <input 
                                                        type="text" 
                                                        defaultValue={record.note}
                                                        onBlur={(e) => updateTaxNote(record.id, e.target.value)}
                                                        placeholder="Tulis catatan..."
                                                        className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-purple-500 outline-none text-xs text-slate-600 dark:text-slate-300 py-1 transition-colors"
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        ) : (
            /* --- TAB: BANK FEES CONTAINER --- */
            <div key="bank-fees-tab" className="space-y-6 animate-fade-in">
                 {/* Summary Grid */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Total Admin Bank */}
                    <div className="bg-gradient-to-r from-orange-500 to-amber-600 dark:from-orange-700 dark:to-amber-800 rounded-2xl shadow-xl p-6 text-white relative overflow-hidden group">
                        <div className="relative z-10">
                            <p className="text-orange-100 text-xs font-bold uppercase tracking-widest mb-1">Total Admin Bank</p>
                            <h3 className="text-2xl font-black">Rp {bankFeeTotal.toLocaleString('id-ID')}</h3>
                            <p className="text-orange-100 text-[10px] mt-1 opacity-80">
                                *Akumulasi biaya admin/potongan bank
                            </p>
                        </div>
                        <CreditCard size={80} className="absolute -right-4 -bottom-8 opacity-20 group-hover:scale-110 transition-transform duration-500" />
                    </div>
                 </div>

                 {/* Bank Fee Table */}
                 <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
                    <div className="overflow-x-auto w-full">
                        <table className="w-full divide-y divide-slate-200 dark:divide-slate-700 table-fixed">
                            <thead className="bg-orange-50 dark:bg-orange-900/20 sticky top-0 z-20">
                                <tr>
                                    <th className="w-12 px-4 py-4 text-center text-xs font-bold text-orange-800 dark:text-orange-300 uppercase tracking-wider">No</th>
                                    <th className="w-28 px-4 py-4 text-left text-xs font-bold text-orange-800 dark:text-orange-300 uppercase tracking-wider">Tanggal</th>
                                    <th className="w-48 px-4 py-4 text-left text-xs font-bold text-orange-800 dark:text-orange-300 uppercase tracking-wider">No. SPM</th>
                                    <th className="min-w-[200px] px-4 py-4 text-left text-xs font-bold text-orange-800 dark:text-orange-300 uppercase tracking-wider">Hal</th>
                                    <th className="w-48 px-4 py-4 text-left text-xs font-bold text-orange-800 dark:text-orange-300 uppercase tracking-wider">Penerima/Bank</th>
                                    <th className="w-48 px-4 py-4 text-left text-xs font-bold text-orange-800 dark:text-orange-300 uppercase tracking-wider">Keterangan</th>
                                    <th className="w-40 px-4 py-4 text-right text-xs font-bold text-orange-800 dark:text-orange-300 uppercase tracking-wider">Nominal (Rp)</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                                {paginatedBankRecords.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-20 text-center text-slate-400 dark:text-slate-500">
                                            <CreditCard size={48} className="mx-auto mb-4 opacity-20 text-orange-500" />
                                            {searchTerm || filterConfig.startDate ? 'Tidak ditemukan data admin bank dengan filter tersebut.' : 'Belum ada data admin bank (keyword: ADMIN, ADMIN BANK, POTONGAN BANK).'}
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedBankRecords.map((record, index) => {
                                        const globalIndex = (currentPage - 1) * itemsPerPage + index + 1;
                                        return (
                                            <tr key={record.id} className="hover:bg-orange-50/50 dark:hover:bg-orange-900/20 transition-colors">
                                                <td className="px-4 py-4 whitespace-nowrap text-xs font-black text-slate-400 dark:text-slate-500 text-center">
                                                    {globalIndex}
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-xs text-slate-600 dark:text-slate-300 font-medium">
                                                    {new Date(record.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </td>
                                                <td className="px-4 py-4 text-xs font-bold text-orange-700 dark:text-orange-400 truncate" title={record.letterNumber}>
                                                    {record.letterNumber}
                                                </td>
                                                <td className="px-4 py-4 text-xs text-slate-700 dark:text-slate-300">
                                                    <div className="line-clamp-2 leading-relaxed" title={record.subject}>{record.subject}</div>
                                                </td>
                                                <td className="px-4 py-4 text-xs font-medium text-slate-700 dark:text-slate-300">
                                                    {record.recipientName}
                                                </td>
                                                 <td className="px-4 py-4 text-xs text-slate-500 dark:text-slate-400">
                                                    {record.description || '-'}
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-right text-xs text-slate-900 dark:text-white font-mono font-bold bg-slate-50/50 dark:bg-slate-700/30">
                                                    Rp {record.amount.toLocaleString('id-ID')}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

        {/* Pagination Controls */}
        {(activeTab === 'letters' ? sortedLetters.length > 0 : activeTab === 'taxes' ? taxRecords.length > 0 : bankFeeRecords.length > 0) && (
            <div className="bg-slate-50 dark:bg-slate-800 px-6 py-6 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-b-2xl">
                <div className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                    Menampilkan {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, activeTab === 'letters' ? sortedLetters.length : activeTab === 'taxes' ? taxRecords.length : bankFeeRecords.length)} dari {activeTab === 'letters' ? sortedLetters.length : activeTab === 'taxes' ? taxRecords.length : bankFeeRecords.length} data
                </div>
                
                <div className="flex items-center space-x-2">
                    <button 
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className={`p-2 rounded-xl transition-all border ${currentPage === 1 ? 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 border-slate-200 dark:border-slate-700' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-teal-500 hover:text-teal-600 dark:hover:text-teal-400 shadow-sm'}`}
                    >
                        <ChevronLeft size={20} />
                    </button>
                    
                    <div className="flex items-center space-x-1">
                        {pageNumbers.map((page, idx) => (
                            page === '...' ? (
                                <span key={`dots-${idx}`} className="px-2 text-slate-400"><MoreHorizontal size={16}/></span>
                            ) : (
                                <button
                                    key={`page-${page}`}
                                    onClick={() => setCurrentPage(Number(page))}
                                    className={`w-10 h-10 rounded-xl text-sm font-bold transition-all border ${
                                        currentPage === page 
                                        ? (activeTab === 'letters' ? 'bg-teal-600 border-teal-600 shadow-teal-200 dark:shadow-teal-900/40' : activeTab === 'taxes' ? 'bg-purple-600 border-purple-600 shadow-purple-200 dark:shadow-purple-900/40' : 'bg-orange-600 border-orange-600 shadow-orange-200 dark:shadow-orange-900/40') + ' text-white shadow-lg'
                                        : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-slate-400'
                                    }`}
                                >
                                    {page}
                                </button>
                            )
                        ))}
                    </div>

                    <button 
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className={`p-2 rounded-xl transition-all border ${currentPage === totalPages ? 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 border-slate-200 dark:border-slate-700' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-teal-500 hover:text-teal-600 dark:hover:text-teal-400 shadow-sm'}`}
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteId && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
                <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-sm p-8 animate-scale-up text-center">
                    <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6 mx-auto">
                        <AlertTriangle className="text-red-600 dark:text-red-400" size={40} />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Hapus Dokumen?</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 leading-relaxed">
                        Data ini akan dihapus permanen dari sistem. Tindakan ini tidak dapat dibatalkan.
                    </p>
                    <div className="flex w-full space-x-3">
                        <button onClick={cancelDelete} className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold rounded-2xl transition-colors">Batal</button>
                        <button onClick={confirmDelete} className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl shadow-xl shadow-red-200 dark:shadow-red-900/40 transition-colors">Hapus</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default Archive;
