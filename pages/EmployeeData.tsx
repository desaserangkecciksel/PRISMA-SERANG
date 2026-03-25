
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Users, Plus, Save, Trash2, Edit, X, Search, User, CreditCard, Building, Briefcase, Download, FileSpreadsheet, FileText, ChevronDown, Printer, Loader2 } from 'lucide-react';
import { StorageService } from '../services/storageService';
import { Employee } from '../types';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const EmployeeData: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Export Menu State
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Form State
  const [formData, setFormData] = useState<Omit<Employee, 'id'>>({
    name: '',
    position: '',
    accountNumber: '',
    bankName: ''
  });

  const loadEmployees = async () => {
      setLoading(true);
      const data = await StorageService.getEmployees();
      setEmployees(data);
      setLoading(false);
  };

  useEffect(() => {
    loadEmployees();

    // Click outside handler for export menu
    const handleClickOutside = (event: MouseEvent) => {
        if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
          setShowExportMenu(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    if (isEditing) {
        const updatedEmployee = { ...formData, id: isEditing };
        await StorageService.saveEmployee(updatedEmployee);
        setIsEditing(null);
    } else {
        const newEmployee = { ...formData, id: uuidv4() };
        await StorageService.saveEmployee(newEmployee);
    }

    // Reset and Refresh
    setFormData({ name: '', position: '', accountNumber: '', bankName: '' });
    await loadEmployees();
  };

  const handleEdit = (employee: Employee) => {
    setIsEditing(employee.id);
    setFormData({
        name: employee.name,
        position: employee.position || '',
        accountNumber: employee.accountNumber,
        bankName: employee.bankName
    });
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Yakin ingin menghapus data pegawai ini?')) {
        await StorageService.deleteEmployee(id);
        await loadEmployees();
    }
  };

  const handleCancel = () => {
      setIsEditing(null);
      setFormData({ name: '', position: '', accountNumber: '', bankName: '' });
  };

  // --- Export Functions ---

  const getExportData = () => {
    const dataToExport = employees.filter(e => 
        (e.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (e.accountNumber || '').includes(searchTerm) ||
        (e.position || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sort by position roughly for export
    dataToExport.sort((a, b) => (a.position || '').localeCompare(b.position || ''));

    return dataToExport.map((e, index) => ({
        'No': index + 1,
        'Nama Lengkap': e.name,
        'Jabatan': e.position,
        'No. Rekening': e.accountNumber,
        'Nama Bank': e.bankName
    }));
  };

  const exportExcel = () => {
    const data = getExportData();
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Pegawai");
    XLSX.writeFile(wb, `Data-Pegawai-Serang-${new Date().toISOString().split('T')[0]}.xlsx`);
    setShowExportMenu(false);
  };

  const exportCSV = () => {
    const data = getExportData();
    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Data-Pegawai-Serang-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  const exportPDFReport = () => {
    const doc = new jsPDF(); // Portrait is fine for this
    
    // Header Report
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text("DATA PEGAWAI & KELEMBAGAAN DESA SERANG", 14, 15);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Dicetak pada: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}`, 14, 22);

    const dataToExport = employees.filter(e => 
        (e.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (e.accountNumber || '').includes(searchTerm) ||
        (e.position || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sort alphabetically by name for the flat PDF list, or leave as is
    dataToExport.sort((a, b) => (a.position || '').localeCompare(b.position || ''));

    const tableData = dataToExport.map((e, index) => [
        (index + 1).toString(),
        e.name,
        e.position,
        e.accountNumber,
        e.bankName
    ]);

    autoTable(doc, {
        head: [['No', 'Nama', 'Jabatan', 'No. Rekening', 'Bank']],
        body: tableData,
        startY: 30,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [13, 148, 136] }, // Teal color
    });

    doc.save(`Data-Pegawai-Serang-${new Date().toISOString().split('T')[0]}.pdf`);
    setShowExportMenu(false);
  };

  // --- Grouping Logic ---
  // Added explicit return type to useMemo to fix 'unknown' type errors in JSX mapping
  const groupedEmployees: Record<string, Employee[]> = useMemo(() => {
    const filtered = employees.filter(e => 
        (e.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (e.accountNumber || '').includes(searchTerm) ||
        (e.position || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const groups: Record<string, Employee[]> = {};

    filtered.forEach(emp => {
        let posRaw = emp.position ? emp.position.trim().toUpperCase() : 'LAINNYA';
        let groupName = posRaw; // Default to the position name itself

        // --- Aturan Pengelompokan Berdasarkan Kata Kunci ---

        // 1. Perangkat Desa (Prioritas Tertinggi: Kades, Sekdes, Kasi, Kaur & Kadus)
        // Pengecualian: BIMASPOL seringkali memiliki pangkat tapi bukan perangkat desa
        if (
            (posRaw.includes('KEPALA DESA') || 
            posRaw.includes('SEKRETARIS DESA') || 
            posRaw.includes('SEKDES') || 
            posRaw.includes('KASI') || 
            posRaw.includes('KAUR') || 
            posRaw.includes('KADUS') || 
            posRaw.includes('KEPALA DUSUN')) && 
            !posRaw.includes('BIMASPOL') && 
            !posRaw.includes('BPD')
        ) {
            groupName = 'PERANGKAT DESA (KADES, SEKDES, KASI, KAUR & KADUS)';
        }
        // 2. Staf Desa
        else if (posRaw.includes('STAF DESA') || posRaw.includes('STAFF DESA')) {
            groupName = 'STAF DESA';
        }
        // 3. BPD
        else if (posRaw.includes('BPD')) {
            groupName = 'BPD (KETUA, ANGGOTA & STAF)';
        }
        // 4. RT
        else if (posRaw.includes('RT')) {
            groupName = 'KETUA RT (001-050)';
        }
        // 5. RW
        else if (posRaw.includes('RW')) {
            groupName = 'KETUA RW (001-020)';
        }
        // 6. Upas Kantor
        else if (posRaw.includes('UPAS')) {
            groupName = 'UPAS KANTOR';
        }
        // 7. Tukang Kebun
        else if (posRaw.includes('KEBUN')) {
            groupName = 'TUKANG KEBUN';
        }
        // 8. Linmas
        else if (posRaw.includes('LINMAS') || posRaw.includes('HANSIP')) {
            groupName = 'LINMAS';
        }
        // 9. Bimaspol / Babinsa
        else if (posRaw.includes('BIMASPOL') || posRaw.includes('BABINSA') || posRaw.includes('BHABIN')) {
            groupName = 'BIMASPOL / BABINSA';
        }
        // 10. PKK
        else if (posRaw.includes('PKK')) {
            groupName = 'PKK (KETUA, KADER, ANGGOTA)';
        }
        // 11. Posyandu
        else if (posRaw.includes('POSYANDU')) {
            groupName = 'POSYANDU (KETUA, KADER, ANGGOTA)';
        }
        // 12. PKTD
        else if (posRaw.includes('PKTD')) {
            groupName = 'PKTD (KETUA, ANGGOTA)';
        }
        // 13. Petugas Gali Kubur
        else if (posRaw.includes('GALI KUBUR') || posRaw.includes('PENGGALI KUBUR')) {
            groupName = 'PETUGAS GALI KUBUR';
        }
        // 14. Guru Ngaji
        else if (posRaw.includes('GURU NGAJI') || posRaw.includes('MAGRIB MENGAJI')) {
            groupName = 'GURU NGAJI';
        }
        // 15. Pemulasaraan Jenazah
        else if (posRaw.includes('JENAZAH') || posRaw.includes('PEMULASARAAN') || posRaw.includes('AMIL')) {
            groupName = 'PEMULASARAAN JENAZAH';
        }
        // 16. Pendamping Desa
        else if (posRaw.includes('PENDAMPING DESA') || posRaw.includes('PLD') || posRaw.includes('PD')) {
            groupName = 'PENDAMPING DESA';
        }
        // 17. Bantuan Langsung Tunai (BLT)
        else if (posRaw.includes('BLT') || posRaw.includes('BANTUAN LANGSUNG TUNAI')) {
            groupName = 'BANTUAN LANGSUNG TUNAI (BLT)';
        }
        // 18. Pihak Ketiga (BUMDES, WIFI, LISTRIK, dll)
        else if (
            posRaw.includes('BUMDES') || 
            posRaw.includes('WIFI') || 
            posRaw.includes('INTERNET') || 
            posRaw.includes('LISTRIK') || 
            posRaw.includes('PLN') || 
            posRaw.includes('MEDIA') || 
            posRaw.includes('KORAN') || 
            posRaw.includes('SAMPAH') ||
            posRaw.includes('KEBERSIHAN')
        ) {
            groupName = 'PIHAK KETIGA (BUMDES, WIFI, LISTRIK, MEDIA, SAMPAH)';
        }

        if (!groups[groupName]) {
            groups[groupName] = [];
        }
        groups[groupName].push(emp);
    });

    // Urutkan grup sesuai prioritas yang diminta
    const priorityOrder = [
        'PERANGKAT DESA (KADES, SEKDES, KASI, KAUR & KADUS)',
        'STAF DESA',
        'BPD (KETUA, ANGGOTA & STAF)',
        'KETUA RT (001-050)',
        'KETUA RW (001-020)',
        'UPAS KANTOR',
        'TUKANG KEBUN',
        'LINMAS',
        'BIMASPOL / BABINSA',
        'PKK (KETUA, KADER, ANGGOTA)',
        'POSYANDU (KETUA, KADER, ANGGOTA)',
        'PKTD (KETUA, ANGGOTA)',
        'PETUGAS GALI KUBUR',
        'GURU NGAJI',
        'PEMULASARAAN JENAZAH',
        'PENDAMPING DESA',
        'BANTUAN LANGSUNG TUNAI (BLT)',
        'PIHAK KETIGA (BUMDES, WIFI, LISTRIK, MEDIA, SAMPAH)'
    ];

    const orderedGroups: Record<string, Employee[]> = {};

    // Masukkan grup prioritas terlebih dahulu
    priorityOrder.forEach(key => {
        if (groups[key]) {
            orderedGroups[key] = groups[key];
            delete groups[key];
        }
    });

    // Masukkan sisa grup (yang tidak masuk list prioritas) secara alfabetis
    Object.keys(groups).sort().forEach(key => {
        orderedGroups[key] = groups[key];
    });

    return orderedGroups;
  }, [employees, searchTerm]);

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500 dark:text-slate-400"><Loader2 className="animate-spin mr-2"/> Memuat Data Pegawai...</div>;

  return (
    <div className="space-y-8 animate-fade-in text-black dark:text-slate-100 pb-20">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center space-x-4">
                <h2 className="text-3xl font-extrabold text-black dark:text-white tracking-tight flex items-center">
                    <Users className="mr-3 text-teal-600 dark:text-teal-400"/> Data Pegawai & Kelembagaan
                </h2>
            </div>

            {/* Export Dropdown */}
            <div className="relative" ref={exportMenuRef}>
                <button 
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className="flex items-center px-6 py-2.5 bg-slate-800 dark:bg-slate-700 text-white rounded-xl hover:bg-slate-900 dark:hover:bg-slate-600 transition-all font-bold shadow-lg shadow-slate-300 dark:shadow-slate-900/40 active:scale-95"
                >
                    <Download size={18} className="mr-2" /> 
                    Export Data 
                    <ChevronDown size={16} className={`ml-2 transition-transform duration-200 ${showExportMenu ? 'rotate-180' : ''}`} />
                </button>
                
                {showExportMenu && (
                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-700 z-50 overflow-hidden animate-scale-up origin-top-right">
                        <div className="p-2 border-b border-slate-50 dark:border-slate-700">
                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2">Format File</span>
                        </div>
                        <button onClick={exportExcel} className="w-full text-left px-4 py-3 hover:bg-green-50 dark:hover:bg-green-900/30 text-slate-700 dark:text-slate-200 hover:text-green-700 dark:hover:text-green-400 flex items-center transition-colors font-medium text-sm group">
                            <FileSpreadsheet size={18} className="mr-3 text-green-600 dark:text-green-500 group-hover:scale-110 transition-transform" /> 
                            Export Excel (.xlsx)
                        </button>
                        <button onClick={exportCSV} className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-slate-700 dark:text-slate-200 hover:text-blue-700 dark:hover:text-blue-400 flex items-center transition-colors font-medium text-sm group">
                            <FileText size={18} className="mr-3 text-blue-600 dark:text-blue-500 group-hover:scale-110 transition-transform" /> 
                            Export CSV (.csv)
                        </button>
                        <div className="border-t border-slate-100 dark:border-slate-700 my-1"></div>
                         <div className="p-2">
                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2">Laporan</span>
                        </div>
                        <button onClick={exportPDFReport} className="w-full text-left px-4 py-3 hover:bg-rose-50 dark:hover:bg-rose-900/30 text-slate-700 dark:text-slate-200 hover:text-rose-700 dark:hover:text-rose-400 flex items-center transition-colors font-medium text-sm group">
                            <Printer size={18} className="mr-3 text-rose-600 dark:text-rose-500 group-hover:scale-110 transition-transform" /> 
                            Cetak Laporan PDF
                        </button>
                    </div>
                )}
            </div>
        </div>

        {/* Input Form Section */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-6 pb-2 border-b border-slate-100 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center">
                    {isEditing ? <Edit size={20} className="mr-2 text-amber-500" /> : <Plus size={20} className="mr-2 text-teal-500" />}
                    {isEditing ? 'Edit Data Pegawai' : 'Tambah Pegawai Baru'}
                </h3>
                {isEditing && (
                    <button onClick={handleCancel} className="text-slate-400 hover:text-red-500 transition-colors">
                        <X size={20} />
                    </button>
                )}
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                <div className="lg:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Nama Lengkap</label>
                    <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                            <User size={16} />
                        </div>
                        <input 
                            type="text" 
                            name="name"
                            required
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent font-medium bg-white dark:bg-slate-900 text-slate-900 dark:text-white" 
                            placeholder="Nama Pegawai"
                            value={formData.name} 
                            onChange={handleInputChange}
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Jabatan</label>
                    <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                            <Briefcase size={16} />
                        </div>
                        <input 
                            type="text" 
                            name="position"
                            required
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent font-medium bg-white dark:bg-slate-900 text-slate-900 dark:text-white" 
                            placeholder="Contoh: Ketua RT 001"
                            value={formData.position} 
                            onChange={handleInputChange}
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Nomor Rekening</label>
                    <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                            <CreditCard size={16} />
                        </div>
                        <input 
                            type="text" 
                            name="accountNumber"
                            required
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent font-medium bg-white dark:bg-slate-900 text-slate-900 dark:text-white" 
                            placeholder="Contoh: 0065..."
                            value={formData.accountNumber} 
                            onChange={handleInputChange}
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Nama Bank</label>
                    <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                            <Building size={16} />
                        </div>
                        <input 
                            type="text" 
                            name="bankName"
                            required
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent font-medium bg-white dark:bg-slate-900 text-slate-900 dark:text-white" 
                            placeholder="Contoh: BJB"
                            value={formData.bankName} 
                            onChange={handleInputChange}
                        />
                    </div>
                </div>
                <div className="lg:col-span-5 flex justify-end mt-2">
                    <button 
                        type="submit" 
                        disabled={loading}
                        className={`px-8 py-2.5 rounded-xl font-bold text-white shadow-lg transition-all transform active:scale-95 flex items-center justify-center ${
                            isEditing 
                            ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200 dark:shadow-amber-900/40' 
                            : 'bg-teal-600 hover:bg-teal-700 shadow-teal-200 dark:shadow-teal-900/40'
                        } ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        {loading ? <Loader2 size={18} className="animate-spin mr-2" /> : (isEditing ? <Save size={18} className="mr-2" /> : <Plus size={18} className="mr-2" />)}
                        {isEditing ? 'Simpan Perubahan' : 'Tambah Pegawai'}
                    </button>
                </div>
            </form>
        </div>

        {/* List Section */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
             <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10">
                <h3 className="font-bold text-slate-700 dark:text-slate-200">Daftar Pegawai</h3>
                <div className="relative max-w-xs w-full">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Cari Nama / Jabatan..." 
                        className="w-full pl-9 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
             </div>
             
             <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-100 dark:bg-slate-700/50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-black dark:text-slate-200 uppercase tracking-wider w-10">No</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-black dark:text-slate-200 uppercase tracking-wider">Nama Pegawai & Jabatan</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-black dark:text-slate-200 uppercase tracking-wider">No. Rekening</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-black dark:text-slate-200 uppercase tracking-wider">Bank</th>
                            <th className="px-6 py-3 text-center text-xs font-bold text-black dark:text-slate-200 uppercase tracking-wider w-32">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                        {Object.keys(groupedEmployees).length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-slate-400 dark:text-slate-500">
                                    Tidak ada data pegawai ditemukan.
                                </td>
                            </tr>
                        ) : (
                            Object.entries(groupedEmployees).map(([jabatan, groupEmployees]) => (
                                <React.Fragment key={jabatan}>
                                    {/* Group Header Row */}
                                    <tr className="bg-slate-200/70 dark:bg-slate-700/30">
                                        <td colSpan={5} className="px-4 py-2 text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200/50 dark:border-slate-700/50">
                                            <div className="flex items-center">
                                                <Briefcase size={14} className="mr-2 text-slate-500 dark:text-slate-400" />
                                                {jabatan}
                                                <span className="ml-2 bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded text-[10px]">{groupEmployees.length}</span>
                                            </div>
                                        </td>
                                    </tr>
                                    {/* Group Items */}
                                    {groupEmployees.map((emp, index) => (
                                        <tr key={emp.id} className="hover:bg-teal-50 dark:hover:bg-teal-900/10 transition-colors group">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400 font-medium pl-8 border-l-4 border-transparent group-hover:border-teal-400">
                                                {index + 1}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-800 dark:text-white">
                                                {emp.name}
                                                <div className="text-xs text-teal-600 dark:text-teal-400 font-normal mt-1 flex items-center">
                                                    <Briefcase size={12} className="mr-1 opacity-75" />
                                                    {emp.position}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300 font-mono">
                                                {emp.accountNumber}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                                                <span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded border border-slate-200 dark:border-slate-600 font-bold text-xs">{emp.bankName}</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <div className="flex justify-center space-x-2">
                                                    <button 
                                                        onClick={() => handleEdit(emp)} 
                                                        className="p-1.5 text-amber-600 dark:text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-lg transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete(emp.id)} 
                                                        className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                                        title="Hapus"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            ))
                        )}
                    </tbody>
                </table>
             </div>
        </div>
    </div>
  );
};

export default EmployeeData;
