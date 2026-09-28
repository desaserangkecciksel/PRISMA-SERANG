
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { StorageService } from '../services/storageService';
import { generateSPM, generateSPP, generateBA, generateTandaTerima } from '../services/pdfGenerator';
import { FileText, Download, FileSpreadsheet, Trash2, Printer, Archive as ArchiveIcon, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, Edit, ChevronDown, ChevronUp, Search, X, Copy, FileCheck, ChevronLeft, ChevronRight, ListFilter, Loader2, MoreHorizontal, Percent, Wallet, CheckCircle2, XCircle, Clock, CreditCard, FilterX, Calendar, Layers, Folder, FolderKanban, List } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LetterData } from '../types';
import { SUB_FIELDS, SOURCE_FUND_OPTIONS } from '../constants';
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
  initialTab?: 'letters' | 'activities' | 'taxes' | 'bank_fees';
}

const Archive: React.FC<ArchiveProps> = ({ onEdit, initialTab = 'letters' }) => {
  const [letters, setLetters] = useState<LetterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [settingsData, setSettingsData] = useState<any>(null);

  // Tab State: 'letters' | 'activities' | 'taxes' | 'bank_fees'
  const [activeTab, setActiveTab] = useState<'letters' | 'activities' | 'taxes' | 'bank_fees'>(initialTab);

  // Mode Tampilan Halaman Bidang & Kegiatan: 'hierarchy' (struktur pohon berjenjang) | 'table' (matriks rinci)
  const [activityViewMode, setActivityViewMode] = useState<'hierarchy' | 'table'>('hierarchy');
  const [expandedFields, setExpandedFields] = useState<Record<string, boolean>>({});
  const [expandedSubFields, setExpandedSubFields] = useState<Record<string, boolean>>({});

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
      sourceFund: '',
      field: '',
      subField: '',
      activity: ''
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
            const uniqueLetters: LetterData[] = [];
            const seenIds = new Set<string>();
            (l || []).forEach(item => {
                if (item && item.id && !seenIds.has(item.id)) {
                    seenIds.add(item.id);
                    uniqueLetters.push(item);
                }
            });
            setLetters(uniqueLetters);
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
    const uniqueLetters: LetterData[] = [];
    const seenIds = new Set<string>();
    (updated || []).forEach(item => {
        if (item && item.id && !seenIds.has(item.id)) {
            seenIds.add(item.id);
            uniqueLetters.push(item);
        }
    });
    setLetters(uniqueLetters);
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
      setFilterConfig({
          startDate: '',
          endDate: '',
          status: '',
          sourceFund: '',
          field: '',
          subField: '',
          activity: ''
      });
  };

  // Precomputed filter options for Bidang, Sub. Bidang, and Kegiatan
  const availableFields = useMemo(() => {
      const predefined = Object.keys(SUB_FIELDS);
      const fromLetters = letters.map(l => l.field).filter((f): f is string => Boolean(f && f.trim()));
      return Array.from(new Set([...predefined, ...fromLetters]));
  }, [letters]);

  const availableSubFields = useMemo(() => {
      if (filterConfig.field) {
          const predefined = SUB_FIELDS[filterConfig.field] || [];
          const fromLetters = letters
              .filter(l => l.field === filterConfig.field)
              .map(l => l.subField)
              .filter((sf): sf is string => Boolean(sf && sf.trim()));
          return Array.from(new Set([...predefined, ...fromLetters]));
      }
      const allPredefined = Object.values(SUB_FIELDS).flat();
      const fromLetters = letters.map(l => l.subField).filter((sf): sf is string => Boolean(sf && sf.trim()));
      return Array.from(new Set([...allPredefined, ...fromLetters]));
  }, [letters, filterConfig.field]);

  const availableActivities = useMemo(() => {
      let subset = letters;
      if (filterConfig.field) {
          subset = subset.filter(l => l.field === filterConfig.field);
      }
      if (filterConfig.subField) {
          subset = subset.filter(l => l.subField === filterConfig.subField);
      }
      const activities = subset.map(l => l.activity).filter((a): a is string => Boolean(a && a.trim()));
      return Array.from(new Set(activities));
  }, [letters, filterConfig.field, filterConfig.subField]);

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
            (letter.field || '').toLowerCase().includes(lowerTerm) ||
            (letter.subField || '').toLowerCase().includes(lowerTerm) ||
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
    if (filterConfig.field) {
        result = result.filter(l => l.field === filterConfig.field);
    }
    if (filterConfig.subField) {
        result = result.filter(l => l.subField === filterConfig.subField);
    }
    if (filterConfig.activity) {
        result = result.filter(l => (l.activity || '').toLowerCase().includes(filterConfig.activity.toLowerCase()));
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
          (l.items || []).forEach((item, itemIdx) => {
               // Mengambil item yang Keterangannya mengandung keyword bank atau suratnya adalah surat admin bank
               const isBankItem = isBankKeywordMatch(item.description || '') || isAdminBankLetter(l);
               
               if (isBankItem) {
                   records.push({
                       id: `${l.id}-bank-${item.id || itemIdx}`,
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

  // --- LOGIC: DEDICATED BIDANG, SUB. BIDANG & KEGIATAN ---
  const activitySummaries = useMemo(() => {
      const validLetters = letters.filter(l => !isAdminBankLetter(l));
      const fieldsSet = new Set<string>();
      const subFieldsSet = new Set<string>();
      const activitiesSet = new Set<string>();
      let totalRealized = 0;

      validLetters.forEach(l => {
          if (l.field && l.field.trim()) fieldsSet.add(l.field.trim());
          if (l.subField && l.subField.trim()) subFieldsSet.add(`${l.field || ''} - ${l.subField.trim()}`);
          if (l.activity && l.activity.trim()) activitiesSet.add(l.activity.trim());
          if (l.status !== 'draft') {
              totalRealized += l.totalAmount || 0;
          }
      });

      return {
          totalFields: fieldsSet.size || Object.keys(SUB_FIELDS).length,
          totalSubFields: subFieldsSet.size,
          totalActivities: activitiesSet.size,
          totalRealized
      };
  }, [letters]);

  const groupedActivities = useMemo(() => {
      let list = letters.filter(l => !isAdminBankLetter(l));

      // Filter by Search Term
      if (searchTerm) {
          const lowerTerm = searchTerm.toLowerCase();
          list = list.filter(letter =>
              (letter.letterNumber || '').toLowerCase().includes(lowerTerm) ||
              (letter.pkaName || '').toLowerCase().includes(lowerTerm) ||
              (letter.activity || '').toLowerCase().includes(lowerTerm) ||
              (letter.field || '').toLowerCase().includes(lowerTerm) ||
              (letter.subField || '').toLowerCase().includes(lowerTerm) ||
              (letter.subject || '').toLowerCase().includes(lowerTerm)
          );
      }

      // Filter by Filter Config
      if (filterConfig.status) {
          list = list.filter(l => l.status === filterConfig.status);
      }
      if (filterConfig.sourceFund) {
          list = list.filter(l => l.sourceFund === filterConfig.sourceFund);
      }
      if (filterConfig.startDate) {
          list = list.filter(l => l.date >= filterConfig.startDate);
      }
      if (filterConfig.endDate) {
          list = list.filter(l => l.date <= filterConfig.endDate);
      }
      if (filterConfig.field) {
          list = list.filter(l => l.field === filterConfig.field);
      }
      if (filterConfig.subField) {
          list = list.filter(l => l.subField === filterConfig.subField);
      }
      if (filterConfig.activity) {
          list = list.filter(l => l.activity === filterConfig.activity);
      }

      // Grouping map
      const fieldMap = new Map<string, {
          totalAmount: number;
          lettersCount: number;
          subFieldMap: Map<string, {
              totalAmount: number;
              lettersCount: number;
              activityMap: Map<string, {
                  totalAmount: number;
                  letters: LetterData[];
              }>;
          }>;
      }>();

      list.forEach(letter => {
          const fieldName = letter.field?.trim() || 'Bidang Lainnya / Belum Ditentukan';
          const subFieldName = letter.subField?.trim() || 'Sub. Bidang Umum';
          const activityName = letter.activity?.trim() || 'Kegiatan Umum';

          if (!fieldMap.has(fieldName)) {
              fieldMap.set(fieldName, { totalAmount: 0, lettersCount: 0, subFieldMap: new Map() });
          }
          const fieldEntry = fieldMap.get(fieldName)!;
          fieldEntry.totalAmount += letter.totalAmount || 0;
          fieldEntry.lettersCount += 1;

          if (!fieldEntry.subFieldMap.has(subFieldName)) {
              fieldEntry.subFieldMap.set(subFieldName, { totalAmount: 0, lettersCount: 0, activityMap: new Map() });
          }
          const subFieldEntry = fieldEntry.subFieldMap.get(subFieldName)!;
          subFieldEntry.totalAmount += letter.totalAmount || 0;
          subFieldEntry.lettersCount += 1;

          if (!subFieldEntry.activityMap.has(activityName)) {
              subFieldEntry.activityMap.set(activityName, { totalAmount: 0, letters: [] });
          }
          const actEntry = subFieldEntry.activityMap.get(activityName)!;
          actEntry.totalAmount += letter.totalAmount || 0;
          actEntry.letters.push(letter);
      });

      const groups: {
          fieldName: string;
          totalAmount: number;
          lettersCount: number;
          subFields: {
              subFieldName: string;
              totalAmount: number;
              lettersCount: number;
              activities: {
                  activityName: string;
                  totalAmount: number;
                  letters: LetterData[];
              }[];
          }[];
      }[] = [];

      fieldMap.forEach((fieldVal, fieldName) => {
          const subFieldsList: typeof groups[0]['subFields'] = [];
          fieldVal.subFieldMap.forEach((subVal, subName) => {
              const activitiesList: typeof subFieldsList[0]['activities'] = [];
              subVal.activityMap.forEach((actVal, actName) => {
                  activitiesList.push({
                      activityName: actName,
                      totalAmount: actVal.totalAmount,
                      letters: actVal.letters.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  });
              });
              activitiesList.sort((a, b) => b.totalAmount - a.totalAmount);
              subFieldsList.push({
                  subFieldName: subName,
                  totalAmount: subVal.totalAmount,
                  lettersCount: subVal.lettersCount,
                  activities: activitiesList
              });
          });
          subFieldsList.sort((a, b) => b.totalAmount - a.totalAmount);
          groups.push({
              fieldName,
              totalAmount: fieldVal.totalAmount,
              lettersCount: fieldVal.lettersCount,
              subFields: subFieldsList
          });
      });

      const predefinedFieldKeys = Object.keys(SUB_FIELDS);
      groups.sort((a, b) => {
          const indexA = predefinedFieldKeys.indexOf(a.fieldName);
          const indexB = predefinedFieldKeys.indexOf(b.fieldName);
          if (indexA !== -1 && indexB !== -1) return indexA - indexB;
          if (indexA !== -1) return -1;
          if (indexB !== -1) return 1;
          return b.totalAmount - a.totalAmount;
      });

      // Sort flatList desc by date
      const flatList = [...list].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return { groups, flatList };
  }, [letters, searchTerm, filterConfig]);

  const paginatedActivities = useMemo(() => {
      const startIndex = (currentPage - 1) * itemsPerPage;
      return groupedActivities.flatList.slice(startIndex, startIndex + itemsPerPage);
  }, [groupedActivities.flatList, currentPage, itemsPerPage]);

  const toggleField = (fieldName: string) => {
      setExpandedFields(prev => ({
          ...prev,
          [fieldName]: prev[fieldName] === false ? true : false
      }));
  };

  const toggleSubField = (subKey: string) => {
      setExpandedSubFields(prev => ({
          ...prev,
          [subKey]: prev[subKey] === false ? true : false
      }));
  };

  const allExpanded = useMemo(() => {
      return Object.values(expandedFields).every(v => v !== false) && Object.keys(expandedFields).length > 0;
  }, [expandedFields]);

  const toggleExpandAll = () => {
      if (allExpanded) {
          const newFields: Record<string, boolean> = {};
          const newSubs: Record<string, boolean> = {};
          groupedActivities.groups.forEach(g => {
              newFields[g.fieldName] = false;
              g.subFields.forEach(s => {
                  newSubs[`${g.fieldName}__${s.subFieldName}`] = false;
              });
          });
          setExpandedFields(newFields);
          setExpandedSubFields(newSubs);
      } else {
          setExpandedFields({});
          setExpandedSubFields({});
      }
  };

  // Pagination Helpers
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage, sortConfig, activeTab, filterConfig]);

  const getPageNumbers = () => {
    let totalItems = 0;
    if (activeTab === 'letters') totalItems = sortedLetters.length;
    else if (activeTab === 'activities') totalItems = groupedActivities.flatList.length;
    else if (activeTab === 'taxes') totalItems = taxRecords.length;
    else totalItems = bankFeeRecords.length;

    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
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
            'Bidang': l.field || '-',
            'Sub. Bidang': l.subField || '-',
            'Kegiatan': l.activity || '-',
            'Sumber Dana': l.sourceFund,
            'Total Nominal (Rp)': l.totalAmount,
            'Status': l.status === 'saved' ? 'Selesai' : l.status === 'archived' ? 'Terarsip' : 'Draft'
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Arsip Surat");
        XLSX.writeFile(wb, `Arsip-Surat-Serang-${new Date().toISOString().split('T')[0]}.xlsx`);
    } else if (activeTab === 'activities') {
        // Export Rekap Bidang & Kegiatan
        const data = groupedActivities.flatList.map((l, index) => ({
            'No': index + 1,
            'Bidang': l.field || '-',
            'Sub. Bidang': l.subField || '-',
            'Kegiatan': l.activity || '-',
            'Nomor Dokumen (SPM)': l.letterNumber,
            'Tanggal Dokumen': new Date(l.date).toLocaleDateString('id-ID'),
            'Hal / Uraian': l.subject,
            'Sumber Dana': l.sourceFund || '-',
            'Total Realisasi (Rp)': l.totalAmount,
            'PKA': l.pkaName || '-',
            'Status': l.status === 'saved' ? 'Selesai' : l.status === 'archived' ? 'Terarsip' : 'Draft'
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Rekap Bidang & Kegiatan");
        XLSX.writeFile(wb, `Rekap-Bidang-Kegiatan-Serang-${new Date().toISOString().split('T')[0]}.xlsx`);
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
                        onClick={() => { setActiveTab('activities'); resetFilters(); }}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center whitespace-nowrap flex-1 sm:flex-none justify-center ${
                            activeTab === 'activities' 
                            ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-sm' 
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                    >
                        <Layers size={16} className="mr-2" /> Bidang & Kegiatan
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
                     placeholder={activeTab === 'letters' ? "Cari No. Surat, PKA atau Hal..." : activeTab === 'activities' ? "Cari Bidang, Kegiatan, atau Hal..." : "Cari No. SPM atau Hal..."}
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
                        {(filterConfig.startDate || filterConfig.endDate || filterConfig.status || filterConfig.sourceFund || filterConfig.field || filterConfig.subField || filterConfig.activity) && (
                            <span className="ml-2 w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
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

            {/* Active Filters Summary Chips */}
            {(filterConfig.startDate || filterConfig.endDate || filterConfig.status || filterConfig.sourceFund || filterConfig.field || filterConfig.subField || filterConfig.activity) && (
                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <span className="text-slate-400 dark:text-slate-500 font-bold">Filter Aktif:</span>
                    {filterConfig.field && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 font-medium">
                            Bidang: {filterConfig.field.length > 25 ? filterConfig.field.substring(0, 25) + '...' : filterConfig.field}
                            <button onClick={() => setFilterConfig(prev => ({...prev, field: '', subField: ''}))} className="ml-1.5 hover:text-teal-900 dark:hover:text-white"><X size={12} /></button>
                        </span>
                    )}
                    {filterConfig.subField && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 font-medium">
                            Sub. Bidang: {filterConfig.subField.length > 25 ? filterConfig.subField.substring(0, 25) + '...' : filterConfig.subField}
                            <button onClick={() => setFilterConfig(prev => ({...prev, subField: ''}))} className="ml-1.5 hover:text-sky-900 dark:hover:text-white"><X size={12} /></button>
                        </span>
                    )}
                    {filterConfig.activity && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-medium">
                            Kegiatan: {filterConfig.activity.length > 25 ? filterConfig.activity.substring(0, 25) + '...' : filterConfig.activity}
                            <button onClick={() => setFilterConfig(prev => ({...prev, activity: ''}))} className="ml-1.5 hover:text-indigo-900 dark:hover:text-white"><X size={12} /></button>
                        </span>
                    )}
                    {filterConfig.sourceFund && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-medium">
                            Sumber: {filterConfig.sourceFund}
                            <button onClick={() => setFilterConfig(prev => ({...prev, sourceFund: ''}))} className="ml-1.5 hover:text-emerald-900 dark:hover:text-white"><X size={12} /></button>
                        </span>
                    )}
                    {filterConfig.status && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-medium">
                            Status: {filterConfig.status}
                            <button onClick={() => setFilterConfig(prev => ({...prev, status: ''}))} className="ml-1.5 hover:text-amber-900 dark:hover:text-white"><X size={12} /></button>
                        </span>
                    )}
                    {(filterConfig.startDate || filterConfig.endDate) && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600 font-medium">
                            Periode: {filterConfig.startDate || 'Awal'} s/d {filterConfig.endDate || 'Akhir'}
                            <button onClick={() => setFilterConfig(prev => ({...prev, startDate: '', endDate: ''}))} className="ml-1.5 hover:text-slate-900 dark:hover:text-white"><X size={12} /></button>
                        </span>
                    )}
                    <button 
                        onClick={resetFilters}
                        className="text-red-600 dark:text-red-400 hover:underline font-bold text-[11px] ml-1"
                    >
                        Hapus Semua Filter
                    </button>
                </div>
            )}
        </div>

        {/* Filter Panel */}
        {showFilters && (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg animate-fade-in space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
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

                    {(activeTab === 'letters' || activeTab === 'activities') && (
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
                                    {SOURCE_FUND_OPTIONS.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
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
                </div>

                {(activeTab === 'letters' || activeTab === 'activities') && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end pt-3 border-t border-slate-100 dark:border-slate-700/60">
                        {/* Filter Bidang */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-teal-700 dark:text-teal-400 uppercase flex items-center">
                                Filter Bidang
                            </label>
                            <select 
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-teal-500 text-slate-700 dark:text-slate-200"
                                value={filterConfig.field}
                                onChange={(e) => setFilterConfig(prev => ({...prev, field: e.target.value, subField: ''}))}
                            >
                                <option value="">Semua Bidang</option>
                                {availableFields.map(f => (
                                    <option key={f} value={f}>{f}</option>
                                ))}
                            </select>
                        </div>

                        {/* Filter Sub. Bidang */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-teal-700 dark:text-teal-400 uppercase flex items-center">
                                Filter Sub. Bidang
                            </label>
                            <select 
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-teal-500 text-slate-700 dark:text-slate-200"
                                value={filterConfig.subField}
                                onChange={(e) => setFilterConfig(prev => ({...prev, subField: e.target.value}))}
                            >
                                <option value="">Semua Sub. Bidang</option>
                                {availableSubFields.map(sf => (
                                    <option key={sf} value={sf}>{sf}</option>
                                ))}
                            </select>
                        </div>

                        {/* Filter Kegiatan */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-teal-700 dark:text-teal-400 uppercase flex items-center">
                                Filter Kegiatan
                            </label>
                            <select 
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-teal-500 text-slate-700 dark:text-slate-200 truncate"
                                value={filterConfig.activity}
                                onChange={(e) => setFilterConfig(prev => ({...prev, activity: e.target.value}))}
                            >
                                <option value="">Semua Kegiatan</option>
                                {availableActivities.map(act => (
                                    <option key={act} value={act} title={act}>
                                        {act.length > 55 ? act.substring(0, 55) + '...' : act}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Reset Button */}
                        <div className="flex items-end">
                            <button 
                                onClick={resetFilters} 
                                className="w-full py-2 px-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 font-bold text-sm transition-colors flex items-center justify-center border border-slate-200 dark:border-slate-600"
                            >
                                <FilterX size={16} className="mr-2" /> Reset Filter
                            </button>
                        </div>
                    </div>
                )}

                {activeTab !== 'letters' && activeTab !== 'activities' && (
                    <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-700/60">
                        <button 
                            onClick={resetFilters} 
                            className="py-2 px-6 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 font-bold text-sm transition-colors flex items-center justify-center border border-slate-200 dark:border-slate-600"
                        >
                            <FilterX size={16} className="mr-2" /> Reset
                        </button>
                    </div>
                )}
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
                                    <th className="min-w-[340px] px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Hal</th>
                                    <th className="w-40 px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => requestSort('totalAmount')}>
                                        <div className="flex items-center">Total {getSortIcon('totalAmount')}</div>
                                    </th>
                                    <th className="w-32 px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                                    <th className="w-20 px-2 py-4 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                                {paginatedLetters.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-20 text-center text-slate-400 dark:text-slate-500">
                                            <ArchiveIcon size={48} className="mx-auto mb-4 opacity-20" />
                                            {searchTerm || filterConfig.status || filterConfig.startDate || filterConfig.field || filterConfig.subField || filterConfig.activity ? 'Tidak ditemukan surat dengan filter tersebut.' : 'Belum ada surat yang diarsipkan.'}
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedLetters.map((letter, index) => {
                                        const globalIndex = (currentPage - 1) * itemsPerPage + index + 1;
                                        return (
                                            <tr key={`${letter.id}-${index}`} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
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
                                                    {/* Baris Hal: Bersih dan rapi tanpa menumpuk */}
                                                    <div className="font-semibold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2" title={letter.subject}>
                                                        {letter.subject}
                                                    </div>

                                                    {/* Metadata ringkas segaris: PKA, Sumber Dana, dan Akses Cepat ke Halaman Bidang & Kegiatan */}
                                                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-tight bg-slate-100 dark:bg-slate-700/80 px-2 py-0.5 rounded">
                                                            PKA: {letter.pkaName || '-'}
                                                        </span>
                                                        {letter.sourceFund && (
                                                            <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded font-bold border border-emerald-200 dark:border-emerald-800">
                                                                {letter.sourceFund}
                                                            </span>
                                                        )}
                                                        {letter.field && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setFilterConfig(prev => ({ 
                                                                        ...prev, 
                                                                        field: letter.field || '', 
                                                                        subField: letter.subField || '', 
                                                                        activity: letter.activity || '' 
                                                                    }));
                                                                    setActiveTab('activities');
                                                                }}
                                                                className="inline-flex items-center gap-1 text-[10px] bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/60 px-2 py-0.5 rounded font-semibold border border-teal-200/80 dark:border-teal-800 transition-colors"
                                                                title="Buka rincian lengkap di halaman Bidang & Kegiatan"
                                                            >
                                                                <Layers size={10} />
                                                                <span className="max-w-[150px] truncate">{letter.activity || letter.field}</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-white font-mono font-bold">
                                                    Rp {letter.totalAmount.toLocaleString('id-ID')}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {getStatusBadge(letter.status)}
                                                </td>
                                                <td className="px-2 py-3 text-center align-middle whitespace-nowrap">
                                                    {/* IKON AKSI KE BAWAH (VERTICAL) DENGAN WARNA KHAS */}
                                                    <div className="flex flex-col items-center justify-center gap-1.5 py-1">
                                                        {/* 1. CETAK (Hijau/Emerald) */}
                                                        <div className="relative print-menu-container">
                                                            <button 
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setActivePrintMenu(activePrintMenu === letter.id ? null : letter.id);
                                                                }}
                                                                className={`p-1.5 rounded-lg border transition-all flex items-center justify-center shadow-xs ${
                                                                    activePrintMenu === letter.id 
                                                                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-400' 
                                                                    : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-800/80 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 hover:text-emerald-700 hover:scale-105'
                                                                }`}
                                                                title="Cetak Surat (SPM, SPP, BA, Tanda Terima)"
                                                            >
                                                                <Printer size={16} />
                                                            </button>
                                                            
                                                            {activePrintMenu === letter.id && (
                                                                <div className="absolute right-full top-0 mr-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-[80] animate-scale-up origin-top-right p-1 text-left">
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

                                                        {/* 2. SALIN (Biru) */}
                                                        <button 
                                                            type="button"
                                                            onClick={() => handleCopy(letter)} 
                                                            className="p-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/80 hover:bg-blue-100 dark:hover:bg-blue-900/60 hover:text-blue-700 hover:scale-105 rounded-lg transition-all shadow-xs flex items-center justify-center" 
                                                            title="Salin Data Surat"
                                                        >
                                                            <Copy size={16} />
                                                        </button>

                                                        {/* 3. EDIT (Kuning/Amber) */}
                                                        <button 
                                                            type="button"
                                                            onClick={() => onEdit(letter)} 
                                                            className="p-1.5 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/80 hover:bg-amber-100 dark:hover:bg-amber-900/60 hover:text-amber-700 hover:scale-105 rounded-lg transition-all shadow-xs flex items-center justify-center" 
                                                            title="Edit Surat"
                                                        >
                                                            <Edit size={16} />
                                                        </button>

                                                        {/* 4. HAPUS (Merah/Rose) */}
                                                        <button 
                                                            type="button"
                                                            onClick={() => handleDeleteClick(letter.id)} 
                                                            className="p-1.5 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/80 hover:bg-rose-100 dark:hover:bg-rose-900/60 hover:text-rose-700 hover:scale-105 rounded-lg transition-all shadow-xs flex items-center justify-center" 
                                                            title="Hapus Surat"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
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
        ) : activeTab === 'activities' ? (
            /* --- TAB: DEDICATED BIDANG, SUB. BIDANG & KEGIATAN --- */
            <div key="activities-tab" className="space-y-6 animate-fade-in">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Total Bidang */}
                    <div className="bg-gradient-to-br from-teal-600 to-emerald-700 dark:from-teal-800 dark:to-emerald-950 rounded-2xl shadow-xl p-5 text-white relative overflow-hidden group">
                        <div className="relative z-10">
                            <p className="text-teal-100 text-xs font-bold uppercase tracking-wider mb-1">Bidang APBDes</p>
                            <h3 className="text-3xl font-black">{activitySummaries.totalFields}</h3>
                            <p className="text-teal-100 text-[10px] mt-1 opacity-80 flex items-center">
                                <Layers size={12} className="mr-1" /> Klasifikasi Utama
                            </p>
                        </div>
                        <Layers size={72} className="absolute -right-3 -bottom-6 opacity-20 group-hover:scale-110 transition-transform duration-500" />
                    </div>

                    {/* Total Sub. Bidang */}
                    <div className="bg-gradient-to-br from-cyan-600 to-blue-700 dark:from-cyan-800 dark:to-blue-950 rounded-2xl shadow-xl p-5 text-white relative overflow-hidden group">
                        <div className="relative z-10">
                            <p className="text-cyan-100 text-xs font-bold uppercase tracking-wider mb-1">Sub. Bidang</p>
                            <h3 className="text-3xl font-black">{activitySummaries.totalSubFields}</h3>
                            <p className="text-cyan-100 text-[10px] mt-1 opacity-80 flex items-center">
                                <Folder size={12} className="mr-1" /> Rincian Klaster
                            </p>
                        </div>
                        <Folder size={72} className="absolute -right-3 -bottom-6 opacity-20 group-hover:scale-110 transition-transform duration-500" />
                    </div>

                    {/* Total Kegiatan */}
                    <div className="bg-gradient-to-br from-indigo-600 to-violet-700 dark:from-indigo-800 dark:to-violet-950 rounded-2xl shadow-xl p-5 text-white relative overflow-hidden group">
                        <div className="relative z-10">
                            <p className="text-indigo-100 text-xs font-bold uppercase tracking-wider mb-1">Kegiatan Terdata</p>
                            <h3 className="text-3xl font-black">{activitySummaries.totalActivities}</h3>
                            <p className="text-indigo-100 text-[10px] mt-1 opacity-80 flex items-center">
                                <FolderKanban size={12} className="mr-1" /> Paket Kegiatan
                            </p>
                        </div>
                        <FolderKanban size={72} className="absolute -right-3 -bottom-6 opacity-20 group-hover:scale-110 transition-transform duration-500" />
                    </div>

                    {/* Total Realisasi Belanja */}
                    <div className="bg-gradient-to-br from-emerald-600 to-teal-800 dark:from-emerald-800 dark:to-teal-950 rounded-2xl shadow-xl p-5 text-white relative overflow-hidden group">
                        <div className="relative z-10">
                            <p className="text-emerald-100 text-xs font-bold uppercase tracking-wider mb-1">Total Realisasi</p>
                            <h3 className="text-2xl font-black">Rp {activitySummaries.totalRealized.toLocaleString('id-ID')}</h3>
                            <p className="text-emerald-100 text-[10px] mt-1 opacity-80 flex items-center">
                                <Wallet size={12} className="mr-1" /> Total Belanja Terarsip
                            </p>
                        </div>
                        <Wallet size={72} className="absolute -right-3 -bottom-6 opacity-20 group-hover:scale-110 transition-transform duration-500" />
                    </div>
                </div>

                {/* Sub-Header & Mode Switcher Bar */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                        <h3 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <Layers className="text-teal-600 dark:text-teal-400" size={20} />
                            Halaman Khusus: Bidang, Sub. Bidang & Kegiatan
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Menampilkan seluruh data surat yang dikelompokkan terpisah dan terorganisir rapi per pos kegiatan
                        </p>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        {activityViewMode === 'hierarchy' && (
                            <button
                                type="button"
                                onClick={toggleExpandAll}
                                className="px-3 py-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-all border border-slate-200 dark:border-slate-600 flex items-center gap-1.5"
                            >
                                {allExpanded ? (
                                    <>
                                        <ChevronUp size={14} /> Tutup Semua
                                    </>
                                ) : (
                                    <>
                                        <ChevronDown size={14} /> Buka Semua
                                    </>
                                )}
                            </button>
                        )}

                        {/* View Switcher: Hierarki vs Tabel */}
                        <div className="flex bg-slate-100 dark:bg-slate-700/80 p-1 rounded-xl border border-slate-200 dark:border-slate-600">
                            <button
                                type="button"
                                onClick={() => setActivityViewMode('hierarchy')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                    activityViewMode === 'hierarchy'
                                    ? 'bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-300 shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                }`}
                            >
                                <FolderKanban size={14} /> Struktur Pohon
                            </button>
                            <button
                                type="button"
                                onClick={() => setActivityViewMode('table')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                    activityViewMode === 'table'
                                    ? 'bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-300 shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                }`}
                            >
                                <List size={14} /> Matriks Tabel
                            </button>
                        </div>
                    </div>
                </div>

                {/* HIERARCHY TREE VIEW */}
                {activityViewMode === 'hierarchy' ? (
                    <div className="space-y-4">
                        {groupedActivities.groups.length === 0 ? (
                            <div className="bg-white dark:bg-slate-800 rounded-2xl p-16 text-center border border-slate-200 dark:border-slate-700 shadow-sm text-slate-400 dark:text-slate-500">
                                <Layers size={48} className="mx-auto mb-3 opacity-20" />
                                <p className="font-medium text-sm">Tidak ditemukan kegiatan atau dokumen dengan kriteria pencarian ini.</p>
                            </div>
                        ) : (
                            groupedActivities.groups.map(group => {
                                const isFieldExpanded = expandedFields[group.fieldName] !== false;
                                return (
                                    <div 
                                        key={group.fieldName} 
                                        className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-md overflow-hidden transition-all duration-200"
                                    >
                                        {/* BIDANG HEADER ACCORDION */}
                                        <div 
                                            onClick={() => toggleField(group.fieldName)}
                                            className="px-6 py-4 bg-gradient-to-r from-teal-50 via-white to-slate-50 dark:from-slate-800 dark:via-slate-800 dark:to-slate-900/60 border-b border-slate-200/80 dark:border-slate-700 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 select-none hover:bg-teal-100/30 dark:hover:bg-slate-700/40 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-black shadow-md shadow-teal-500/20 shrink-0">
                                                    <Layers size={20} />
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-teal-700 dark:text-teal-400 bg-teal-100/70 dark:bg-teal-900/40 px-2 py-0.5 rounded">
                                                        BIDANG
                                                    </span>
                                                    <h4 className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5 leading-snug">
                                                        {group.fieldName}
                                                    </h4>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4 self-end md:self-auto">
                                                <div className="text-right">
                                                    <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 block">
                                                        {group.subFields.length} Sub. Bidang • {group.lettersCount} Dokumen
                                                    </span>
                                                    <span className="text-base font-black text-teal-800 dark:text-teal-300 font-mono">
                                                        Rp {group.totalAmount.toLocaleString('id-ID')}
                                                    </span>
                                                </div>
                                                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300 shrink-0">
                                                    {isFieldExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                                </div>
                                            </div>
                                        </div>

                                        {/* SUB. BIDANG & KEGIATAN CONTAINER */}
                                        {isFieldExpanded && (
                                            <div className="p-4 sm:p-6 space-y-5 bg-slate-50/60 dark:bg-slate-900/40">
                                                {group.subFields.map(sub => {
                                                    const subKey = `${group.fieldName}__${sub.subFieldName}`;
                                                    const isSubExpanded = expandedSubFields[subKey] !== false;
                                                    return (
                                                        <div 
                                                            key={subKey} 
                                                            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/90 dark:border-slate-700/80 shadow-sm overflow-hidden"
                                                        >
                                                            {/* SUB. BIDANG HEADER */}
                                                            <div 
                                                                onClick={() => toggleSubField(subKey)}
                                                                className="px-5 py-3.5 bg-slate-100/70 dark:bg-slate-800/90 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 dark:border-slate-700 select-none transition-colors"
                                                            >
                                                                <div className="flex items-center gap-2.5">
                                                                    <Folder size={18} className="text-cyan-600 dark:text-cyan-400 shrink-0" />
                                                                    <div>
                                                                        <span className="text-[9px] font-extrabold uppercase tracking-wider text-cyan-700 dark:text-cyan-400 mr-2">
                                                                            SUB. BIDANG:
                                                                        </span>
                                                                        <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                                                            {sub.subFieldName}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-3 self-end sm:self-auto">
                                                                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                                                        {sub.activities.length} Kegiatan ({sub.lettersCount} Dokumen)
                                                                    </span>
                                                                    <span className="text-sm font-black text-cyan-700 dark:text-cyan-300 font-mono">
                                                                        Rp {sub.totalAmount.toLocaleString('id-ID')}
                                                                    </span>
                                                                    <div className="text-slate-400">
                                                                        {isSubExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* KEGIATAN & DAFTAR SURAT */}
                                                            {isSubExpanded && (
                                                                <div className="p-4 space-y-4">
                                                                    {sub.activities.map(act => (
                                                                        <div 
                                                                            key={act.activityName} 
                                                                            className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/50 p-4 space-y-3"
                                                                        >
                                                                            {/* Baris Nama Kegiatan & Subtotal */}
                                                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-700/80">
                                                                                <div className="flex items-start gap-2">
                                                                                    <div className="w-2 h-2 rounded-full bg-teal-500 mt-2 shrink-0"></div>
                                                                                    <div>
                                                                                        <span className="text-[10px] font-black uppercase text-teal-700 dark:text-teal-400 tracking-wider">
                                                                                            NAMA KEGIATAN
                                                                                        </span>
                                                                                        <h5 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                                                                                            {act.activityName}
                                                                                        </h5>
                                                                                    </div>
                                                                                </div>

                                                                                <div className="flex items-center gap-2 self-end sm:self-auto">
                                                                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                                                                        {act.letters.length} Dokumen:
                                                                                    </span>
                                                                                    <span className="text-sm font-black text-emerald-700 dark:text-emerald-400 font-mono">
                                                                                        Rp {act.totalAmount.toLocaleString('id-ID')}
                                                                                    </span>
                                                                                </div>
                                                                            </div>

                                                                            {/* DAFTAR DOKUMEN ARSIP DALAM KEGIATAN INI */}
                                                                            <div className="space-y-2">
                                                                                {act.letters.map((letter, idx) => (
                                                                                    <div 
                                                                                        key={`${letter.id}-${idx}`} 
                                                                                        className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/70 hover:border-teal-300 dark:hover:border-teal-600 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs"
                                                                                    >
                                                                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                                                                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 pt-0.5">
                                                                                                #{idx + 1}
                                                                                            </span>
                                                                                            <div className="space-y-1 flex-1 min-w-0">
                                                                                                <div className="flex flex-wrap items-center gap-2">
                                                                                                    <span className="text-xs font-extrabold text-teal-700 dark:text-teal-400 font-mono">
                                                                                                        {letter.letterNumber}
                                                                                                    </span>
                                                                                                    <span className="text-xs text-slate-400">
                                                                                                        • {new Date(letter.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                                                                    </span>
                                                                                                    {letter.sourceFund && (
                                                                                                        <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded font-bold border border-emerald-200 dark:border-emerald-800">
                                                                                                            {letter.sourceFund}
                                                                                                        </span>
                                                                                                    )}
                                                                                                    {getStatusBadge(letter.status)}
                                                                                                </div>
                                                                                                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-2" title={letter.subject}>
                                                                                                    {letter.subject}
                                                                                                </div>
                                                                                                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                                                                                    PKA: <span className="font-semibold text-slate-700 dark:text-slate-300">{letter.pkaName || '-'}</span>
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>

                                                                                        <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-700 shrink-0">
                                                                                            <div className="text-right">
                                                                                                <span className="text-sm font-black text-slate-900 dark:text-white font-mono block">
                                                                                                    Rp {letter.totalAmount.toLocaleString('id-ID')}
                                                                                                </span>
                                                                                            </div>

                                                                                            <div className="flex flex-col items-center justify-center gap-1.5 shrink-0">
                                                                                                {/* 1. CETAK (Hijau/Emerald) */}
                                                                                                <div className="relative print-menu-container">
                                                                                                    <button 
                                                                                                        type="button"
                                                                                                        onClick={(e) => {
                                                                                                            e.stopPropagation();
                                                                                                            setActivePrintMenu(activePrintMenu === letter.id ? null : letter.id);
                                                                                                        }}
                                                                                                        className={`p-1.5 rounded-lg border transition-all flex items-center justify-center shadow-xs ${
                                                                                                            activePrintMenu === letter.id 
                                                                                                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-400' 
                                                                                                            : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-800/80 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 hover:text-emerald-700 hover:scale-105'
                                                                                                        }`}
                                                                                                        title="Cetak Dokumen (SPM, SPP, BA, Tanda Terima)"
                                                                                                    >
                                                                                                        <Printer size={15} />
                                                                                                    </button>
                                                                                                    
                                                                                                    {activePrintMenu === letter.id && (
                                                                                                        <div className="absolute right-full top-0 mr-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-[80] animate-scale-up origin-top-right p-1 text-left">
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

                                                                                                {/* 2. SALIN (Biru) */}
                                                                                                <button 
                                                                                                    type="button"
                                                                                                    onClick={() => handleCopy(letter)} 
                                                                                                    className="p-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/80 hover:bg-blue-100 dark:hover:bg-blue-900/60 hover:text-blue-700 hover:scale-105 rounded-lg transition-all shadow-xs flex items-center justify-center" 
                                                                                                    title="Salin Data Dokumen"
                                                                                                >
                                                                                                    <Copy size={15} />
                                                                                                </button>

                                                                                                {/* 3. EDIT (Kuning/Amber) */}
                                                                                                <button 
                                                                                                    type="button"
                                                                                                    onClick={() => onEdit(letter)} 
                                                                                                    className="p-1.5 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/80 hover:bg-amber-100 dark:hover:bg-amber-900/60 hover:text-amber-700 hover:scale-105 rounded-lg transition-all shadow-xs flex items-center justify-center" 
                                                                                                    title="Edit Dokumen"
                                                                                                >
                                                                                                    <Edit size={15} />
                                                                                                </button>

                                                                                                {/* 4. HAPUS (Merah/Rose) */}
                                                                                                <button 
                                                                                                    type="button"
                                                                                                    onClick={() => handleDeleteClick(letter.id)} 
                                                                                                    className="p-1.5 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/80 hover:bg-rose-100 dark:hover:bg-rose-900/60 hover:text-rose-700 hover:scale-105 rounded-lg transition-all shadow-xs flex items-center justify-center" 
                                                                                                    title="Hapus Dokumen"
                                                                                                >
                                                                                                    <Trash2 size={15} />
                                                                                                </button>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                ) : (
                    /* FLAT MATRIX TABLE VIEW */
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
                        <div className="overflow-x-auto w-full">
                            <table className="w-full divide-y divide-slate-200 dark:divide-slate-700 table-fixed">
                                <thead className="bg-teal-50/70 dark:bg-teal-950/40 sticky top-0 z-20">
                                    <tr>
                                        <th className="w-12 px-3 py-3 text-center text-xs font-bold text-teal-800 dark:text-teal-300 uppercase tracking-wider">No</th>
                                        <th className="w-48 px-4 py-3 text-left text-xs font-bold text-teal-800 dark:text-teal-300 uppercase tracking-wider">Bidang</th>
                                        <th className="w-44 px-4 py-3 text-left text-xs font-bold text-teal-800 dark:text-teal-300 uppercase tracking-wider">Sub. Bidang</th>
                                        <th className="w-56 px-4 py-3 text-left text-xs font-bold text-teal-800 dark:text-teal-300 uppercase tracking-wider">Kegiatan</th>
                                        <th className="w-44 px-4 py-3 text-left text-xs font-bold text-teal-800 dark:text-teal-300 uppercase tracking-wider">No. Surat</th>
                                        <th className="min-w-[220px] px-4 py-3 text-left text-xs font-bold text-teal-800 dark:text-teal-300 uppercase tracking-wider">Hal & PKA</th>
                                        <th className="w-28 px-3 py-3 text-left text-xs font-bold text-teal-800 dark:text-teal-300 uppercase tracking-wider">Tgl</th>
                                        <th className="w-24 px-3 py-3 text-center text-xs font-bold text-teal-800 dark:text-teal-300 uppercase tracking-wider">Sumber</th>
                                        <th className="w-36 px-4 py-3 text-right text-xs font-bold text-teal-800 dark:text-teal-300 uppercase tracking-wider">Realisasi (Rp)</th>
                                        <th className="w-24 px-3 py-3 text-center text-xs font-bold text-teal-800 dark:text-teal-300 uppercase tracking-wider">Status</th>
                                        <th className="w-20 px-2 py-3 text-center text-xs font-bold text-teal-800 dark:text-teal-300 uppercase tracking-wider">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                                    {paginatedActivities.length === 0 ? (
                                        <tr>
                                            <td colSpan={11} className="px-6 py-20 text-center text-slate-400 dark:text-slate-500">
                                                <Layers size={48} className="mx-auto mb-4 opacity-20" />
                                                Tidak ada dokumen kegiatan yang sesuai dengan filter.
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedActivities.map((letter, index) => {
                                            const globalIndex = (currentPage - 1) * itemsPerPage + index + 1;
                                            return (
                                                <tr key={`${letter.id}-${index}`} className="hover:bg-teal-50/40 dark:hover:bg-slate-700/40 transition-colors">
                                                    <td className="px-3 py-3.5 whitespace-nowrap text-xs font-black text-slate-400 text-center">
                                                        {globalIndex}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-xs font-semibold text-slate-700 dark:text-slate-300 truncate" title={letter.field}>
                                                        {letter.field || '-'}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-400 truncate" title={letter.subField}>
                                                        {letter.subField || '-'}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-xs font-bold text-teal-700 dark:text-teal-400 truncate" title={letter.activity}>
                                                        {letter.activity || '-'}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-xs font-bold text-slate-900 dark:text-slate-100 font-mono truncate" title={letter.letterNumber}>
                                                        {letter.letterNumber}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-xs text-slate-700 dark:text-slate-300">
                                                        <div className="line-clamp-2 leading-relaxed font-medium" title={letter.subject}>
                                                            {letter.subject}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 mt-0.5">
                                                            PKA: {letter.pkaName || '-'}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3.5 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                                                        {new Date(letter.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                                                    </td>
                                                    <td className="px-3 py-3.5 text-center whitespace-nowrap">
                                                        <span className="text-[10px] px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 rounded font-bold border border-emerald-200 dark:border-emerald-800">
                                                            {letter.sourceFund || '-'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3.5 whitespace-nowrap text-right text-xs font-mono font-bold text-slate-900 dark:text-white">
                                                        Rp {letter.totalAmount.toLocaleString('id-ID')}
                                                    </td>
                                                    <td className="px-3 py-3.5 text-center whitespace-nowrap">
                                                        {getStatusBadge(letter.status)}
                                                    </td>
                                                    <td className="px-2 py-3 text-center align-middle whitespace-nowrap">
                                                        <div className="flex flex-col items-center justify-center gap-1.5 py-1">
                                                            {/* 1. CETAK (Hijau/Emerald) */}
                                                            <div className="relative print-menu-container">
                                                                <button 
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setActivePrintMenu(activePrintMenu === letter.id ? null : letter.id);
                                                                    }}
                                                                    className={`p-1.5 rounded-lg border transition-all flex items-center justify-center shadow-xs ${
                                                                        activePrintMenu === letter.id 
                                                                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-400' 
                                                                        : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-800/80 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 hover:text-emerald-700 hover:scale-105'
                                                                    }`}
                                                                    title="Cetak Dokumen"
                                                                >
                                                                    <Printer size={15} />
                                                                </button>
                                                                {activePrintMenu === letter.id && (
                                                                    <div className="absolute right-full top-0 mr-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-[80] animate-scale-up origin-top-right p-1 text-left">
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

                                                            {/* 2. SALIN (Biru) */}
                                                            <button 
                                                                type="button"
                                                                onClick={() => handleCopy(letter)} 
                                                                className="p-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/80 hover:bg-blue-100 dark:hover:bg-blue-900/60 hover:text-blue-700 hover:scale-105 rounded-lg transition-all shadow-xs flex items-center justify-center" 
                                                                title="Salin Data"
                                                            >
                                                                <Copy size={15} />
                                                            </button>

                                                            {/* 3. EDIT (Kuning/Amber) */}
                                                            <button 
                                                                type="button"
                                                                onClick={() => onEdit(letter)} 
                                                                className="p-1.5 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/80 hover:bg-amber-100 dark:hover:bg-amber-900/60 hover:text-amber-700 hover:scale-105 rounded-lg transition-all shadow-xs flex items-center justify-center" 
                                                                title="Edit"
                                                            >
                                                                <Edit size={15} />
                                                            </button>

                                                            {/* 4. HAPUS (Merah/Rose) */}
                                                            <button 
                                                                type="button"
                                                                onClick={() => handleDeleteClick(letter.id)} 
                                                                className="p-1.5 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/80 hover:bg-rose-100 dark:hover:bg-rose-900/60 hover:text-rose-700 hover:scale-105 rounded-lg transition-all shadow-xs flex items-center justify-center" 
                                                                title="Hapus"
                                                            >
                                                                <Trash2 size={15} />
                                                            </button>
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
                )}
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
                                            <tr key={`${record.id}-${index}`} className="hover:bg-purple-50/50 dark:hover:bg-purple-900/20 transition-colors">
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
                                            <tr key={`${record.id}-${index}`} className="hover:bg-orange-50/50 dark:hover:bg-orange-900/20 transition-colors">
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
        {(activeTab === 'letters' ? sortedLetters.length > 0 : activeTab === 'activities' ? (activityViewMode === 'table' && groupedActivities.flatList.length > 0) : activeTab === 'taxes' ? taxRecords.length > 0 : bankFeeRecords.length > 0) && (
            <div className="bg-slate-50 dark:bg-slate-800 px-6 py-6 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-b-2xl">
                <div className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                    Menampilkan {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, activeTab === 'letters' ? sortedLetters.length : activeTab === 'activities' ? groupedActivities.flatList.length : activeTab === 'taxes' ? taxRecords.length : bankFeeRecords.length)} dari {activeTab === 'letters' ? sortedLetters.length : activeTab === 'activities' ? groupedActivities.flatList.length : activeTab === 'taxes' ? taxRecords.length : bankFeeRecords.length} data
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
                                        ? ((activeTab === 'letters' || activeTab === 'activities') ? 'bg-teal-600 border-teal-600 shadow-teal-200 dark:shadow-teal-900/40' : activeTab === 'taxes' ? 'bg-purple-600 border-purple-600 shadow-purple-200 dark:shadow-purple-900/40' : 'bg-orange-600 border-orange-600 shadow-orange-200 dark:shadow-orange-900/40') + ' text-white shadow-lg'
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
