
import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storageService';
import { AppSettings, BudgetAllocations, PkaOfficial } from '../types';
import { INITIAL_SETTINGS } from '../constants';
import { 
    Save, Image as ImageIcon, Wallet, Check, 
    LogIn, Building, Map, Mail, User, Info, MessageCircle, 
    ChevronRight, Shield, Layers, AlertTriangle, Landmark, PenTool, LayoutDashboard, FileText, ToggleLeft, ToggleRight, Loader2,
    Plus, Trash2, Users, Moon, Sun, Award, Edit, X, Download, FileSpreadsheet, Database, Copy, ExternalLink, RefreshCw, CheckCircle
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type SettingsTab = 'profile' | 'contact' | 'official' | 'budget' | 'branding' | 'security' | 'database';

// Helper: Resize & Compress Image
const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const MAX_WIDTH = 1200; // Limit width for storage efficiency
                
                if (width > MAX_WIDTH) {
                    height = (height * MAX_WIDTH) / width;
                    width = MAX_WIDTH;
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    // Fill white background for transparency handling if converting to JPEG
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, width, height);
                    ctx.drawImage(img, 0, 0, width, height);
                    // Export as JPEG with 0.8 quality for good compression
                    resolve(canvas.toDataURL('image/jpeg', 0.8)); 
                } else {
                    reject(new Error("Canvas context error"));
                }
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};

// Helper: Format number with dots (1.000.000)
const formatNumber = (num: number | undefined): string => {
    if (num === undefined || num === null) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

// Helper: Parse dot-formatted string to number
const parseNumber = (str: string): number => {
    if (!str) return 0;
    const cleanStr = str.replace(/\./g, '');
    const parsed = parseInt(cleanStr, 10);
    return isNaN(parsed) ? 0 : parsed;
};

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(INITIAL_SETTINGS);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [processingImage, setProcessingImage] = useState<string | null>(null);

  // State for PKA Form
  const [newPkaName, setNewPkaName] = useState('');
  const [newPkaPosition, setNewPkaPosition] = useState('');
  const [editingPkaId, setEditingPkaId] = useState<string | null>(null);

  // State for Budget Entry Form
  const [newBudgetDate, setNewBudgetDate] = useState(new Date().toISOString().split('T')[0]);
  const [newBudgetAmount, setNewBudgetAmount] = useState('');
  const [newBudgetSource, setNewBudgetSource] = useState<keyof BudgetAllocations>('PAD');
  const [newBudgetDesc, setNewBudgetDesc] = useState('');
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);

  useEffect(() => {
      const loadSettings = async () => {
          try {
            const data = await StorageService.getSettings();
            if (data) {
                setSettings(data);
                setNewUsername(data.username || 'serang');
            }
          } catch (e) {
            console.error("Failed to load settings", e);
          }
      };
      loadSettings();
  }, []);

  const handleSaveClick = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setShowConfirmModal(true);
  };

  const executeSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const toSave = { ...settings };
    
    // Update username & password
    toSave.username = newUsername;
    if (newPassword) toSave.password = newPassword;
    
    try {
        await StorageService.saveSettings(toSave);
        setNewPassword('');
        setShowConfirmModal(false);
        
        setShowToast(true);
        setTimeout(() => {
            setShowToast(false);
        }, 3000);
    } catch (error) {
        alert("Gagal menyimpan pengaturan! Kemungkinan penyimpanan browser penuh. Cobalah hapus arsip lama atau gunakan gambar yang lebih kecil.");
        setShowConfirmModal(false);
    }
  };

  const toggleDarkMode = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const newMode = !settings.isDarkMode;
      
      setSettings(prev => ({...prev, isDarkMode: newMode}));
      
      // Apply immediately to DOM
      if (newMode) {
          document.documentElement.classList.add('dark');
      } else {
          document.documentElement.classList.remove('dark');
      }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'headerImage' | 'loginLogo' | 'sidebarLogo') => {
    const file = e.target.files?.[0];
    if (file) {
        setProcessingImage(field);
        try {
            const compressedBase64 = await resizeImage(file);
            setSettings(prev => ({ ...prev, [field]: compressedBase64 }));
        } catch (error) {
            console.error("Gagal memproses gambar:", error);
            alert("Gagal memproses gambar. Silakan coba file lain atau ukuran lebih kecil.");
        } finally {
            setProcessingImage(null);
            // Reset input value to allow re-uploading same file if needed
            e.target.value = '';
        }
    }
  };

  const toggleFullHeader = (e: React.MouseEvent) => {
      e.preventDefault();
      // Explicitly stop propagation to prevent any form submission bubbling
      e.stopPropagation();
      
      setSettings(prev => ({
          ...prev,
          isFullHeader: !prev.isFullHeader
      }));
  };

  const handleInputChange = (field: keyof AppSettings, value: string) => {
      setSettings(prev => ({ ...prev, [field]: value }));
  };

  // --- PKA Management ---
  const handleAddPka = () => {
    if (newPkaName && newPkaPosition) {
        if (editingPkaId) {
            // Update mode
            setSettings(prev => ({
                ...prev,
                pkaOfficials: prev.pkaOfficials.map(pka => 
                    pka.id === editingPkaId 
                    ? { ...pka, name: newPkaName, position: newPkaPosition }
                    : pka
                )
            }));
            setEditingPkaId(null);
        } else {
            // Add mode
            const newPka = {
                id: uuidv4(),
                name: newPkaName,
                position: newPkaPosition
            };
            setSettings(prev => ({
                ...prev,
                pkaOfficials: [...(prev.pkaOfficials || []), newPka]
            }));
        }
        setNewPkaName('');
        setNewPkaPosition('');
    }
  };

  const handleEditPka = (pka: PkaOfficial) => {
      setNewPkaName(pka.name);
      setNewPkaPosition(pka.position);
      setEditingPkaId(pka.id);
  };

  const handleCancelPka = () => {
      setNewPkaName('');
      setNewPkaPosition('');
      setEditingPkaId(null);
  };

  const handleRemovePka = (id: string) => {
      setSettings(prev => ({
          ...prev,
          pkaOfficials: prev.pkaOfficials.filter(pka => pka.id !== id)
      }));
      // Reset edit state if deleting the item currently being edited
      if (editingPkaId === id) {
          handleCancelPka();
      }
  };

  // --- Budget Entry Management ---
  const handleAddBudgetEntry = () => {
    const amount = parseNumber(newBudgetAmount);
    if (amount > 0 && newBudgetDate && newBudgetSource) {
        if (editingBudgetId) {
            // Update mode
            setSettings(prev => {
                const updatedEntries = prev.budgetEntries.map(e => 
                    e.id === editingBudgetId 
                    ? { ...e, date: newBudgetDate, amount: amount, source: newBudgetSource, description: newBudgetDesc }
                    : e
                );
                
                // Recalculate totals
                const totals: BudgetAllocations = {
                    PAD: 0, ADD: 0, DDS: 0, PBH: 0, PBP: 0, DLL: 0
                };
                updatedEntries.forEach(entry => {
                    totals[entry.source] += entry.amount;
                });

                return {
                    ...prev,
                    budgetEntries: updatedEntries,
                    budgetAllocations: totals
                };
            });
            setEditingBudgetId(null);
        } else {
            // Add mode
            const newEntry = {
                id: uuidv4(),
                date: newBudgetDate,
                amount: amount,
                source: newBudgetSource,
                description: newBudgetDesc
            };

            setSettings(prev => {
                const updatedEntries = [...(prev.budgetEntries || []), newEntry];
                
                // Recalculate totals
                const totals: BudgetAllocations = {
                    PAD: 0, ADD: 0, DDS: 0, PBH: 0, PBP: 0, DLL: 0
                };
                updatedEntries.forEach(entry => {
                    totals[entry.source] += entry.amount;
                });

                return {
                    ...prev,
                    budgetEntries: updatedEntries,
                    budgetAllocations: totals
                };
            });
        }

        setNewBudgetAmount('');
        setNewBudgetDesc('');
        setNewBudgetDate(new Date().toISOString().split('T')[0]);
    }
  };

  const handleEditBudgetEntry = (entry: any) => {
      setNewBudgetDate(entry.date);
      setNewBudgetAmount(formatNumber(entry.amount));
      setNewBudgetSource(entry.source);
      setNewBudgetDesc(entry.description || '');
      setEditingBudgetId(entry.id);
  };

  const handleCancelBudgetEdit = () => {
      setNewBudgetDate(new Date().toISOString().split('T')[0]);
      setNewBudgetAmount('');
      setNewBudgetSource('PAD');
      setNewBudgetDesc('');
      setEditingBudgetId(null);
  };

  const handleRemoveBudgetEntry = (id: string) => {
    setSettings(prev => {
        const updatedEntries = prev.budgetEntries.filter(e => e.id !== id);
        
        const totals: BudgetAllocations = {
            PAD: 0, ADD: 0, DDS: 0, PBH: 0, PBP: 0, DLL: 0
        };
        updatedEntries.forEach(entry => {
            totals[entry.source] += entry.amount;
        });

        return {
            ...prev,
            budgetEntries: updatedEntries,
            budgetAllocations: totals
        };
    });
    if (editingBudgetId === id) {
        handleCancelBudgetEdit();
    }
  };

  const handleExportExcel = () => {
    if (!settings.budgetEntries || settings.budgetEntries.length === 0) {
      alert("Tidak ada data untuk diekspor!");
      return;
    }

    const data = settings.budgetEntries.map((entry, index) => ({
      'NO': index + 1,
      'TANGGAL': entry.date,
      'NOMINAL': entry.amount,
      'SUMBER': entry.source,
      'KETERANGAN': entry.description || '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Anggaran");
    XLSX.writeFile(workbook, `Rincian_Anggaran_${settings.headerTitle || 'Desa'}.xlsx`);
  };

  const handleExportPDF = () => {
    if (!settings.budgetEntries || settings.budgetEntries.length === 0) {
      alert("Tidak ada data untuk diekspor!");
      return;
    }

    const doc = new jsPDF();
    const tableColumn = ["NO", "TANGGAL", "NOMINAL", "SUMBER", "KETERANGAN"];
    const tableRows = settings.budgetEntries.map((entry, index) => [
      index + 1,
      entry.date,
      `Rp ${formatNumber(entry.amount)}`,
      entry.source,
      entry.description || '-'
    ]);

    // Title and Header
    const currentYear = new Date().getFullYear();
    const title = `APBDES SERANG KEC. CIKARANG SELATAN KAB. BEKASI TAHUN ANGGARAN ${currentYear}`;
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    const splitTitle = doc.splitTextToSize(title, 180);
    doc.text(splitTitle, 14, 15);
    
    // Calculate next Y position
    const titleHeight = splitTitle.length * 7; 
    const nextY = 15 + titleHeight;

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: nextY + 5,
      theme: 'grid',
      headStyles: { fillColor: [13, 148, 136] } // Teal color
    });

    doc.save(`APBDES_SERANG_${currentYear}.pdf`);
  };

  const [isSettingUpDb, setIsSettingUpDb] = useState(false);
  const [dbSetupStatus, setDbSetupStatus] = useState<{ success?: boolean; message?: string; error?: string } | null>(null);

  const handleAutoSetupDb = async () => {
      setIsSettingUpDb(true);
      setDbSetupStatus(null);
      try {
          const response = await fetch('/api/db-setup', { method: 'POST' });
          const data = await response.json();
          setDbSetupStatus(data);
      } catch (error) {
          setDbSetupStatus({ 
              success: false, 
              error: error instanceof Error ? error.message : "Gagal menghubungi server" 
          });
      } finally {
          setIsSettingUpDb(false);
      }
  };

  const handleExportSQL = () => {
    const LS_KEYS = {
        LETTERS: 'espm_letters_local',
        SETTINGS: 'espm_settings_local',
        EMPLOYEES: 'espm_employees_local'
    };

    let sql = `-- Prismades Serang Data Export\n`;
    sql += `-- Generated on ${new Date().toLocaleString()}\n\n`;
    sql += `SET NAMES utf8mb4;\n\n`;

    // 1. Settings
    const settingsRaw = localStorage.getItem(LS_KEYS.SETTINGS);
    if (settingsRaw) {
        const escapedData = settingsRaw.replace(/'/g, "''");
        sql += `-- Settings Data\n`;
        sql += `INSERT INTO settings (id, data) VALUES (1, '${escapedData}') ON DUPLICATE KEY UPDATE data = '${escapedData}';\n\n`;
    }

    // 2. Letters
    const lettersRaw = localStorage.getItem(LS_KEYS.LETTERS);
    if (lettersRaw) {
        const letters = JSON.parse(lettersRaw);
        if (Array.isArray(letters) && letters.length > 0) {
            sql += `-- Letters Data (${letters.length} records)\n`;
            letters.forEach((l: any) => {
                const data = JSON.stringify(l).replace(/'/g, "''");
                sql += `INSERT INTO letters (id, data) VALUES ('${l.id}', '${data}') ON DUPLICATE KEY UPDATE data = '${data}';\n`;
            });
            sql += `\n`;
        }
    }

    // 3. Employees
    const employeesRaw = localStorage.getItem(LS_KEYS.EMPLOYEES);
    if (employeesRaw) {
        const employees = JSON.parse(employeesRaw);
        if (Array.isArray(employees) && employees.length > 0) {
            sql += `-- Employees Data (${employees.length} records)\n`;
            employees.forEach((e: any) => {
                const data = JSON.stringify(e).replace(/'/g, "''");
                sql += `INSERT INTO employees (id, data) VALUES ('${e.id}', '${data}') ON DUPLICATE KEY UPDATE data = '${data}';\n`;
            });
            sql += `\n`;
        }
    }

    const blob = new Blob([sql], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `prismades_data_migration_${new Date().toISOString().split('T')[0]}.sql`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const menuItems: { id: SettingsTab; label: string; icon: React.ElementType; desc: string }[] = [
      { id: 'profile', label: 'Profil Desa', icon: Building, desc: 'Deskripsi, Visi, Misi & Lokasi' },
      { id: 'contact', label: 'Kontak & Admin', icon: Info, desc: 'Email, WhatsApp & Reset Password' },
      { id: 'official', label: 'Data Pejabat', icon: User, desc: 'Kepala Desa & Pelaksana Kegiatan Anggaran' },
      { id: 'budget', label: 'Anggaran & Rekening', icon: Wallet, desc: 'Alokasi Pagu & Rekening Desa' },
      { id: 'branding', label: 'Identitas & Tampilan', icon: ImageIcon, desc: 'Logo, Kop Surat & Dark Mode' },
      { id: 'security', label: 'Keamanan Akun', icon: Shield, desc: 'Ubah Kata Sandi Aplikasi' },
      { id: 'database', label: 'Sinkronisasi Cloud', icon: Database, desc: 'Migrasi ke MySQL Hostinger' },
  ];

  const renderContent = () => {
      switch (activeTab) {
        case 'profile':
            return (
                <div className="space-y-6 animate-fade-in">
                    <div className="border-b border-slate-100 dark:border-slate-700 pb-4 mb-4">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Profil & Identitas Wilayah</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Informasi umum mengenai Desa yang akan tampil di halaman publik/login.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Deskripsi Desa</label>
                        <textarea 
                            rows={3}
                            className="w-full border-slate-300 dark:border-slate-600 rounded-xl shadow-sm p-3 border focus:ring-2 focus:ring-teal-500 transition-shadow bg-white dark:bg-slate-800 text-slate-900 dark:text-white" 
                            value={settings.villageDescription || ''} 
                            onChange={(e) => handleInputChange('villageDescription', e.target.value)}
                            placeholder="Masukkan deskripsi singkat desa..."
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Visi</label>
                            <textarea 
                                rows={4}
                                className="w-full border-slate-300 dark:border-slate-600 rounded-xl shadow-sm p-3 border focus:ring-2 focus:ring-teal-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white" 
                                value={settings.vision || ''} 
                                onChange={(e) => handleInputChange('vision', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Misi</label>
                            <textarea 
                                rows={4}
                                className="w-full border-slate-300 dark:border-slate-600 rounded-xl shadow-sm p-3 border focus:ring-2 focus:ring-teal-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white" 
                                value={settings.mission || ''} 
                                onChange={(e) => handleInputChange('mission', e.target.value)}
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Tujuan</label>
                            <textarea 
                                rows={2}
                                className="w-full border-slate-300 dark:border-slate-600 rounded-xl shadow-sm p-3 border focus:ring-2 focus:ring-teal-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white" 
                                value={settings.goals || ''} 
                                onChange={(e) => handleInputChange('goals', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center">
                            <Map size={16} className="mr-2 text-teal-600 dark:text-teal-400"/> Link Embed Google Maps (Lokasi Kantor)
                        </label>
                        <input 
                            type="text" 
                            className="w-full border-slate-300 dark:border-slate-600 rounded-xl shadow-sm p-3 border focus:ring-2 focus:ring-teal-500 text-sm font-mono text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 mb-2" 
                            value={settings.mapsEmbedUrl || ''} 
                            onChange={(e) => handleInputChange('mapsEmbedUrl', e.target.value)}
                            placeholder='<iframe src="https://www.google.com/maps/embed...">'
                        />
                        <p className="text-[10px] text-slate-400 mb-4">
                            {"*Salin URL embed dari Google Maps (Share \u2192 Embed a map \u2192 Copy HTML src only)."}
                        </p>
                        
                        {settings.mapsEmbedUrl && (
                            <div className="w-full h-48 bg-white dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
                                <iframe 
                                    src={settings.mapsEmbedUrl.match(/src="([^"]+)"/)?.[1] || settings.mapsEmbedUrl} 
                                    width="100%" 
                                    height="100%" 
                                    style={{border:0}} 
                                    allowFullScreen 
                                    loading="lazy" 
                                    referrerPolicy="no-referrer-when-downgrade"
                                ></iframe>
                            </div>
                        )}
                    </div>
                </div>
            );

        case 'contact':
            return (
                <div className="space-y-6 animate-fade-in">
                    <div className="border-b border-slate-100 dark:border-slate-700 pb-4 mb-4">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Kontak & Pusat Bantuan</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Konfigurasi kontak untuk fitur "Lupa Password" dan footer aplikasi.</p>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-xl p-4 flex items-start">
                        <Info size={20} className="text-blue-500 dark:text-blue-400 mr-3 mt-1 flex-shrink-0" />
                        <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                            <strong>PENTING:</strong> Informasi Email dan WhatsApp di bawah ini akan digunakan secara otomatis pada tombol 
                            <span className="font-bold"> "Lupa Password"</span> di halaman Login. Pastikan nomor dan email aktif dan dipegang oleh Operator/Admin.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center">
                                <Mail size={16} className="mr-2 text-teal-600 dark:text-teal-400"/> Email Desa (Untuk Reset)
                            </label>
                            <input 
                                type="email" 
                                className="w-full border-slate-300 dark:border-slate-600 rounded-xl shadow-sm p-3 border focus:ring-2 focus:ring-teal-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white" 
                                value={settings.villageEmail || ''} 
                                onChange={(e) => handleInputChange('villageEmail', e.target.value)}
                                placeholder="contoh: desa@gmail.com"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center">
                                <MessageCircle size={16} className="mr-2 text-green-600 dark:text-green-400"/> WhatsApp Operator (Untuk Reset)
                            </label>
                            <input 
                                type="text" 
                                className="w-full border-slate-300 dark:border-slate-600 rounded-xl shadow-sm p-3 border focus:ring-2 focus:ring-teal-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white" 
                                value={settings.villageWhatsapp || ''} 
                                onChange={(e) => handleInputChange('villageWhatsapp', e.target.value)}
                                placeholder="contoh: 081234567890"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center">
                                <Map size={16} className="mr-2 text-red-500 dark:text-red-400"/> Alamat Lengkap (Kop Surat)
                            </label>
                            <input 
                                type="text" 
                                className="w-full border-slate-300 dark:border-slate-600 rounded-xl shadow-sm p-3 border focus:ring-2 focus:ring-teal-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white" 
                                value={settings.address || ''} 
                                onChange={(e) => handleInputChange('address', e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            );

        case 'official':
            return (
                <div className="space-y-6 animate-fade-in">
                    <div className="border-b border-slate-100 dark:border-slate-700 pb-4 mb-4">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Data Pejabat Desa</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Konfigurasi data Kepala Desa, Sekretaris Desa dan daftar Pelaksana Kegiatan Anggaran (PKA).</p>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        {/* KEPALA DESA */}
                        <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                             <div className="flex items-center mb-4 text-slate-800 dark:text-slate-100">
                                 <User size={24} className="mr-3 text-teal-600 dark:text-teal-400" />
                                 <h3 className="text-lg font-bold">Data Kepala Desa</h3>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Nama Lengkap Kepala Desa</label>
                                    <input 
                                        type="text" 
                                        className="w-full border-slate-300 dark:border-slate-600 rounded-xl shadow-sm p-3 border focus:ring-2 focus:ring-teal-500 font-bold text-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white" 
                                        value={settings.headVillageName || ''} 
                                        onChange={(e) => handleInputChange('headVillageName', e.target.value)}
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">NIK KTP</label>
                                        <input 
                                            type="text" 
                                            className="w-full border-slate-300 dark:border-slate-600 rounded-xl shadow-sm p-3 border focus:ring-2 focus:ring-teal-500 font-mono bg-white dark:bg-slate-900 text-slate-900 dark:text-white" 
                                            value={settings.headVillageNIK || ''} 
                                            onChange={(e) => handleInputChange('headVillageNIK', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">NIP (Opsional)</label>
                                        <input 
                                            type="text" 
                                            className="w-full border-slate-300 dark:border-slate-600 rounded-xl shadow-sm p-3 border focus:ring-2 focus:ring-teal-500 font-mono bg-white dark:bg-slate-900 text-slate-900 dark:text-white" 
                                            value={settings.headVillageNIP || ''} 
                                            onChange={(e) => handleInputChange('headVillageNIP', e.target.value)}
                                            placeholder="-"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* SEKRETARIS DESA */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 dark:bg-indigo-900/20 rounded-bl-full -mr-8 -mt-8 opacity-50"></div>
                             <div className="flex items-center mb-4 text-slate-800 dark:text-slate-100 relative z-10">
                                 <Award size={24} className="mr-3 text-indigo-600 dark:text-indigo-400" />
                                 <div>
                                     <h3 className="text-lg font-bold">Data Sekretaris Desa</h3>
                                     <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Berperan sebagai Verifikator dan Koordinator PKA (Terintegrasi ke SPP/SPM/BA)</p>
                                 </div>
                            </div>
                            <div className="space-y-4 relative z-10">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Nama Lengkap Sekretaris Desa</label>
                                    <input 
                                        type="text" 
                                        className="w-full border-slate-300 dark:border-slate-600 rounded-xl shadow-sm p-3 border focus:ring-2 focus:ring-indigo-500 font-bold text-lg bg-indigo-50/50 dark:bg-slate-900 text-slate-900 dark:text-white" 
                                        value={settings.villageSecretary || ''} 
                                        onChange={(e) => handleInputChange('villageSecretary', e.target.value)}
                                        placeholder="Nama Sekretaris Desa..."
                                    />
                                    <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2 flex items-center">
                                        <Info size={12} className="mr-1"/> 
                                        Nama ini akan otomatis muncul sebagai Koordinator di Daftar PKA dan penandatangan surat.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* PKA List Manager */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <div className="flex items-center mb-4 text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-700 pb-2">
                                 <Users size={24} className="mr-3 text-blue-600 dark:text-blue-400" />
                                 <div className="flex-1">
                                    <h3 className="text-lg font-bold">Daftar Pelaksana Kegiatan Anggaran (PKA)</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Data ini akan muncul otomatis saat membuat Surat Permohonan/SPM.</p>
                                 </div>
                            </div>
                            
                            <div className="flex gap-3 mb-6 items-end bg-blue-50 dark:bg-blue-900/30 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Nama Pejabat</label>
                                    <input 
                                        type="text" 
                                        className="w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm p-2 text-sm border focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" 
                                        value={newPkaName}
                                        onChange={(e) => setNewPkaName(e.target.value)}
                                        placeholder="Contoh: YUSUF HAIDIR"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Jabatan</label>
                                    <input 
                                        type="text" 
                                        className="w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm p-2 text-sm border focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" 
                                        value={newPkaPosition}
                                        onChange={(e) => setNewPkaPosition(e.target.value)}
                                        placeholder="Contoh: Kaur Umum"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    {editingPkaId && (
                                        <button 
                                            type="button"
                                            onClick={handleCancelPka}
                                            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-lg font-bold text-sm shadow-sm flex items-center"
                                        >
                                            <X size={16} className="mr-1" /> Batal
                                        </button>
                                    )}
                                    <button 
                                        type="button"
                                        onClick={handleAddPka}
                                        className={`px-4 py-2 text-white rounded-lg font-bold text-sm shadow-md flex items-center ${editingPkaId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                                    >
                                        {editingPkaId ? <Save size={16} className="mr-1" /> : <Plus size={16} className="mr-1" />}
                                        {editingPkaId ? 'Update' : 'Tambah'}
                                    </button>
                                </div>
                            </div>

                            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                                <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
                                    <thead className="text-xs text-slate-700 dark:text-slate-200 uppercase bg-slate-50 dark:bg-slate-900/50">
                                        <tr>
                                            <th className="px-6 py-3">Nama Pejabat</th>
                                            <th className="px-6 py-3">Jabatan</th>
                                            <th className="px-6 py-3 text-center">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {settings.pkaOfficials && settings.pkaOfficials.length > 0 ? (
                                            settings.pkaOfficials.map((pka) => (
                                                <tr key={pka.id} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                                    <td className="px-6 py-3 font-medium text-slate-900 dark:text-white">{pka.name}</td>
                                                    <td className="px-6 py-3">{pka.position}</td>
                                                    <td className="px-6 py-3 text-center">
                                                        <div className="flex justify-center gap-2">
                                                            <button 
                                                                type="button"
                                                                onClick={() => handleEditPka(pka)}
                                                                className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-400 p-1.5 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-colors"
                                                                title="Edit Pejabat"
                                                            >
                                                                <Edit size={16} />
                                                            </button>
                                                            <button 
                                                                type="button"
                                                                onClick={() => handleRemovePka(pka.id)}
                                                                className="text-red-500 hover:text-red-700 dark:hover:text-red-400 p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                                                title="Hapus Pejabat"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={3} className="px-6 py-4 text-center text-slate-400 italic">Belum ada data PKA. Tambahkan data baru di atas.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            );

        case 'budget':
            return (
                <div className="space-y-8 animate-fade-in">
                     <div className="space-y-6">
                         <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-4 mb-4 gap-4">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Alokasi Anggaran Tahunan</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Pagu anggaran APBDes (Otomatis terhitung dari rincian di bawah).</p>
                            </div>
                         </div>
                         
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {(['PAD', 'ADD', 'DDS', 'PBH', 'PBP', 'DLL'] as const).map((source) => (
                                <div key={source} className={`relative p-4 rounded-xl border transition-all bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700 shadow-sm`}>
                                    <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{source} (Rupiah)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">Rp</span>
                                        <input 
                                            type="text" 
                                            className="w-full pl-10 pr-4 py-2 bg-transparent border-none focus:ring-0 font-mono font-bold text-slate-800 dark:text-slate-100 text-lg" 
                                            value={formatNumber(settings.budgetAllocations?.[source])} 
                                            readOnly
                                        />
                                    </div>
                                </div>
                            ))}
                         </div>
                     </div>

                     {/* Fitur Baru: Input Nominal Anggaran */}
                     <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="flex items-center mb-4 text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-700 pb-2">
                             <Plus size={24} className="mr-3 text-teal-600 dark:text-teal-400" />
                             <div className="flex-1">
                                <h3 className="text-lg font-bold">Input Nominal Anggaran</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Tambahkan rincian pendapatan anggaran berdasarkan sumbernya.</p>
                             </div>
                             <div className="flex gap-2">
                                <button 
                                    type="button"
                                    onClick={handleExportExcel}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-sm flex items-center transition-colors"
                                    title="Export ke Excel"
                                >
                                    <FileSpreadsheet size={14} className="mr-1.5" /> XLSX
                                </button>
                                <button 
                                    type="button"
                                    onClick={handleExportPDF}
                                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs shadow-sm flex items-center transition-colors"
                                    title="Export ke PDF"
                                >
                                    <Download size={14} className="mr-1.5" /> PDF
                                </button>
                             </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6 items-end bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                            <div className="md:col-span-1">
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Tanggal</label>
                                <input 
                                    type="date" 
                                    className="w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm p-2 text-sm border focus:ring-2 focus:ring-teal-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white" 
                                    value={newBudgetDate}
                                    onChange={(e) => setNewBudgetDate(e.target.value)}
                                />
                            </div>
                            <div className="md:col-span-1">
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Nominal (Rp)</label>
                                <input 
                                    type="text" 
                                    className="w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm p-2 text-sm border focus:ring-2 focus:ring-teal-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono" 
                                    value={newBudgetAmount}
                                    onChange={(e) => setNewBudgetAmount(formatNumber(parseNumber(e.target.value)))}
                                    placeholder="0"
                                />
                            </div>
                            <div className="md:col-span-1">
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Sumber</label>
                                <select 
                                    className="w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm p-2 text-sm border focus:ring-2 focus:ring-teal-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                    value={newBudgetSource}
                                    onChange={(e) => setNewBudgetSource(e.target.value as any)}
                                >
                                    <option value="PAD">PAD</option>
                                    <option value="ADD">ADD</option>
                                    <option value="DDS">DDS</option>
                                    <option value="PBH">PBH</option>
                                    <option value="PBP">PBP</option>
                                    <option value="DLL">DLL</option>
                                </select>
                            </div>
                            <div className="md:col-span-1">
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Keterangan</label>
                                <input 
                                    type="text" 
                                    className="w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm p-2 text-sm border focus:ring-2 focus:ring-teal-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white" 
                                    value={newBudgetDesc}
                                    onChange={(e) => setNewBudgetDesc(e.target.value)}
                                    placeholder="Keterangan..."
                                />
                            </div>
                            <div className="md:col-span-1 flex gap-2">
                                {editingBudgetId && (
                                    <button 
                                        type="button"
                                        onClick={handleCancelBudgetEdit}
                                        className="flex-1 px-3 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-lg font-bold text-sm shadow-sm flex items-center justify-center transition-colors"
                                    >
                                        <X size={16} className="mr-1" /> Batal
                                    </button>
                                )}
                                <button 
                                    type="button"
                                    onClick={handleAddBudgetEntry}
                                    className={`flex-1 px-4 py-2 text-white rounded-lg font-bold text-sm shadow-md flex items-center justify-center transition-colors ${editingBudgetId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-teal-600 hover:bg-teal-700'}`}
                                >
                                    {editingBudgetId ? <Save size={16} className="mr-1" /> : <Plus size={16} className="mr-1" />}
                                    {editingBudgetId ? 'Update' : 'Tambah'}
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                            <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
                                <thead className="text-xs text-slate-700 dark:text-slate-200 uppercase bg-slate-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-4 py-3 text-center w-12">NO</th>
                                        <th className="px-4 py-3">TANGGAL</th>
                                        <th className="px-4 py-3 text-right">NOMINAL</th>
                                        <th className="px-4 py-3 text-center">SUMBER</th>
                                        <th className="px-4 py-3">KETERANGAN</th>
                                         <th className="px-4 py-3 text-center w-24">AKSI</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {settings.budgetEntries && settings.budgetEntries.length > 0 ? (
                                        settings.budgetEntries.map((entry, index) => (
                                            <tr key={entry.id} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                                <td className="px-4 py-3 text-center font-medium">{index + 1}</td>
                                                <td className="px-4 py-3">{entry.date}</td>
                                                <td className="px-4 py-3 text-right font-mono font-bold text-teal-600 dark:text-teal-400">Rp {formatNumber(entry.amount)}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-[10px] font-bold">{entry.source}</span>
                                                </td>
                                                <td className="px-4 py-3">{entry.description || '-'}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex justify-center gap-2">
                                                        <button 
                                                            type="button"
                                                            onClick={() => handleEditBudgetEntry(entry)}
                                                            className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-400 p-1.5 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-colors"
                                                            title="Edit Anggaran"
                                                        >
                                                            <Edit size={16} />
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            onClick={() => handleRemoveBudgetEntry(entry.id)}
                                                            className="text-red-500 hover:text-red-700 dark:hover:text-red-400 p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                                            title="Hapus Anggaran"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-8 text-center text-slate-400 italic">Belum ada rincian anggaran. Silakan tambahkan data di atas.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                     </div>

                     <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 mt-8">
                        <div className="flex items-center mb-4 text-slate-800 dark:text-slate-100">
                             <Landmark size={24} className="mr-3 text-teal-600 dark:text-teal-400" />
                             <h3 className="text-lg font-bold">Rekening Kas Desa</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Nomor Rekening</label>
                                <input 
                                    type="text" 
                                    className="w-full border-slate-300 dark:border-slate-600 rounded-xl shadow-sm p-3 border focus:ring-2 focus:ring-teal-500 font-mono tracking-wide bg-white dark:bg-slate-900 text-slate-900 dark:text-white" 
                                    value={settings.defaultAccountNumber || ''} 
                                    onChange={(e) => handleInputChange('defaultAccountNumber', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Atas Nama Rekening</label>
                                <input 
                                    type="text" 
                                    className="w-full border-slate-300 dark:border-slate-600 rounded-xl shadow-sm p-3 border focus:ring-2 focus:ring-teal-500 font-bold bg-white dark:bg-slate-900 text-slate-900 dark:text-white" 
                                    value={settings.defaultAccountHolder || ''} 
                                    onChange={(e) => handleInputChange('defaultAccountHolder', e.target.value)}
                                />
                            </div>
                        </div>
                     </div>

                     <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 mt-4 shadow-sm">
                        <div className="flex items-center mb-4 text-slate-800 dark:text-slate-100">
                             <PenTool size={24} className="mr-3 text-blue-600 dark:text-blue-400" />
                             <h3 className="text-lg font-bold">Default Pemohon (Signatory)</h3>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Nama yang otomatis muncul di kolom Pemohon saat membuat surat baru.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Nama Pemohon 1</label>
                                <input 
                                    type="text" 
                                    className="w-full border-slate-300 dark:border-slate-600 rounded-xl shadow-sm p-3 border focus:ring-2 focus:ring-teal-500 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white" 
                                    value={settings.defaultSignatory1 || ''} 
                                    onChange={(e) => handleInputChange('defaultSignatory1', e.target.value)}
                                />
                            </div>
                             <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">KTP Pemohon 1</label>
                                <input 
                                    type="text" 
                                    className="w-full border-slate-300 dark:border-slate-600 rounded-xl shadow-sm p-3 border focus:ring-2 focus:ring-teal-500 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white" 
                                    value={settings.defaultKtp1 || ''} 
                                    onChange={(e) => handleInputChange('defaultKtp1', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Nama Pemohon 2</label>
                                <input 
                                    type="text" 
                                    className="w-full border-slate-300 dark:border-slate-600 rounded-xl shadow-sm p-3 border focus:ring-2 focus:ring-teal-500 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white" 
                                    value={settings.defaultSignatory2 || ''} 
                                    onChange={(e) => handleInputChange('defaultSignatory2', e.target.value)}
                                />
                            </div>
                             <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">KTP Pemohon 2</label>
                                <input 
                                    type="text" 
                                    className="w-full border-slate-300 dark:border-slate-600 rounded-xl shadow-sm p-3 border focus:ring-2 focus:ring-teal-500 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white" 
                                    value={settings.defaultKtp2 || ''} 
                                    onChange={(e) => handleInputChange('defaultKtp2', e.target.value)}
                                />
                            </div>
                        </div>
                     </div>
                </div>
            );

        case 'branding':
            return (
                <div className="space-y-6 animate-fade-in">
                    <div className="border-b border-slate-100 dark:border-slate-700 pb-4 mb-4">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Identitas Visual & Branding</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Atur logo dan tampilan visual aplikasi serta dokumen.</p>
                    </div>

                    {/* DARK MODE TOGGLE */}
                     <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden transition-all">
                        <div className="flex justify-between items-center">
                            <h4 className="font-bold text-slate-800 dark:text-slate-100 flex items-center">
                                {settings.isDarkMode ? <Moon className="mr-2 text-indigo-400" size={20}/> : <Sun className="mr-2 text-orange-500" size={20}/>}
                                Mode Gelap (Dark Mode)
                            </h4>
                            <div className="flex items-center">
                                 <button 
                                    type="button"
                                    onClick={toggleDarkMode}
                                    className={`flex items-center transition-colors ${settings.isDarkMode ? 'text-indigo-400' : 'text-slate-400'}`}
                                 >
                                     {settings.isDarkMode ? <ToggleRight size={40} className="fill-current" /> : <ToggleLeft size={40} />}
                                 </button>
                            </div>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                             Mengaktifkan tema gelap untuk kenyamanan mata di lingkungan minim cahaya.
                        </p>
                     </div>

                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden transition-all">
                         <div className="flex justify-between items-center mb-4">
                            <h4 className="font-bold text-slate-800 dark:text-slate-100 flex items-center">
                                <LayoutDashboard className="mr-2 text-indigo-600 dark:text-indigo-400" size={20}/> Logo Sidebar (Aplikasi)
                            </h4>
                        </div>

                        <div className={`flex flex-col md:flex-row gap-6 items-center md:items-start`}>
                            <div className={`w-24 h-24 bg-slate-900 rounded-xl flex items-center justify-center shadow-lg border border-slate-700 flex-shrink-0 relative overflow-hidden`}>
                                 {processingImage === 'sidebarLogo' && (
                                     <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                                         <Loader2 className="animate-spin text-white" size={24} />
                                     </div>
                                 )}
                                 {settings.sidebarLogo ? (
                                    <img src={settings.sidebarLogo} alt="Sidebar Logo" className="w-16 h-16 object-contain" />
                                 ) : (
                                    <span className="text-white font-black text-2xl">P</span>
                                 )}
                            </div>
                            <div className="flex-1 space-y-4">
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Logo ini akan tampil di pojok kiri atas sidebar aplikasi (di sebelah nama PRISMADES SERANG). 
                                    Format disarankan: PNG Transparan, Rasio 1:1.
                                </p>
                                <div className={``}>
                                    <input 
                                        type="file" 
                                        accept="image/*"
                                        onChange={(e) => handleImageUpload(e, 'sidebarLogo')}
                                        className="block w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900 dark:file:text-indigo-200 transition-all cursor-pointer disabled:cursor-not-allowed mb-4"
                                    />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Judul Sidebar (Utama)</label>
                                            <input 
                                                type="text" 
                                                className="w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm p-2 text-sm border focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                                value={settings.sidebarTitle || ''}
                                                onChange={(e) => handleInputChange('sidebarTitle', e.target.value)}
                                                placeholder="Contoh: PRISMADES"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Subjudul Sidebar (Kecil)</label>
                                            <input 
                                                type="text" 
                                                className="w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm p-2 text-sm border focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                                value={settings.sidebarSubtitle || ''}
                                                onChange={(e) => handleInputChange('sidebarSubtitle', e.target.value)}
                                                placeholder="Contoh: Admin Desa"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden transition-all">
                         <div className="flex justify-between items-center mb-4">
                            <h4 className="font-bold text-slate-800 dark:text-slate-100 flex items-center">
                                <LogIn className="mr-2 text-teal-600 dark:text-teal-400" size={20}/> Logo Halaman Login
                            </h4>
                        </div>
                        
                        <div className={`flex flex-col md:flex-row gap-6 items-center md:items-start`}>
                            <div className={`w-32 h-32 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center border border-slate-200 dark:border-slate-600 flex-shrink-0 relative overflow-hidden`}>
                                 {processingImage === 'loginLogo' && (
                                     <div className="absolute inset-0 bg-white/80 dark:bg-black/50 flex items-center justify-center z-10">
                                         <Loader2 className="animate-spin text-teal-600 dark:text-teal-400" size={24} />
                                     </div>
                                 )}
                                 {settings.loginLogo ? (
                                    <img src={settings.loginLogo} alt="Login Logo" className="w-24 h-24 object-contain" />
                                 ) : (
                                    <span className="text-slate-300 dark:text-slate-500 font-bold text-xs">Default</span>
                                 )}
                            </div>
                            <div className="flex-1 space-y-3">
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Logo utama yang tampil di halaman Login. Jika kosong, akan menggunakan gambar Kop Surat.
                                </p>
                                <div className={`space-y-3`}>
                                    <input 
                                        type="file" 
                                        accept="image/*"
                                        onChange={(e) => handleImageUpload(e, 'loginLogo')}
                                        className="block w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 dark:file:bg-teal-900 dark:file:text-teal-200 transition-all cursor-pointer disabled:cursor-not-allowed"
                                    />
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Judul Utama (Besar)</label>
                                            <input 
                                                type="text" 
                                                className="w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm p-2 text-sm border focus:ring-2 focus:ring-teal-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                                value={settings.loginTitle || ''}
                                                onChange={(e) => handleInputChange('loginTitle', e.target.value)}
                                                placeholder="Contoh: PRISMADES SERANG"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Sub-Judul (Kecil)</label>
                                            <input 
                                                type="text" 
                                                className="w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm p-2 text-sm border focus:ring-2 focus:ring-teal-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                                value={settings.loginSubtitle || ''}
                                                onChange={(e) => handleInputChange('loginSubtitle', e.target.value)}
                                                placeholder="Contoh: Permohonan Rincian..."
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Nama Instansi / Deskripsi Bawah</label>
                                            <input 
                                                type="text" 
                                                className="w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm p-2 text-sm border focus:ring-2 focus:ring-teal-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                                value={settings.loginDescription || ''}
                                                onChange={(e) => handleInputChange('loginDescription', e.target.value)}
                                                placeholder="Contoh: PEMERINTAH DESA SERANG..."
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Footer Copyright</label>
                                            <input 
                                                type="text" 
                                                className="w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm p-2 text-sm border focus:ring-2 focus:ring-teal-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                                value={settings.loginFooter || ''}
                                                onChange={(e) => handleInputChange('loginFooter', e.target.value)}
                                                placeholder="Contoh: © 2026 PEMERINTAH DESA SERANG"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-bold text-slate-800 dark:text-slate-100 flex items-center">
                                <FileText className="mr-2 text-slate-600 dark:text-slate-400" size={20}/> Kop Surat (Header PDF)
                            </h4>
                        </div>

                         {/* Toggle Full Header */}
                         <div className={`mb-6 flex items-center p-4 rounded-xl border-2 transition-colors ${settings.isFullHeader ? 'border-teal-100 bg-teal-50 dark:bg-teal-900/20 dark:border-teal-800' : 'border-slate-100 bg-slate-50 dark:bg-slate-700 dark:border-slate-600'}`}>
                             <button 
                                type="button"
                                onClick={toggleFullHeader}
                                className={`flex items-center transition-colors ${settings.isFullHeader ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400 dark:text-slate-500'}`}
                             >
                                 {settings.isFullHeader ? <ToggleRight size={40} className="mr-3 fill-current" /> : <ToggleLeft size={40} className="mr-3" />}
                             </button>
                             <div className="flex-1">
                                 <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                     {settings.isFullHeader ? 'Mode Full Header (Gambar Penuh)' : 'Mode Logo + Teks'}
                                 </p>
                                 <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                     {settings.isFullHeader 
                                        ? "Gambar akan digunakan sebagai header utuh (selebar halaman) tanpa tambahan teks."
                                        : "Gambar hanya sebagai logo di kiri, disandingkan dengan Teks Judul & Alamat."}
                                 </p>
                             </div>
                         </div>

                         <div className={`flex flex-col md:flex-row gap-6 items-center md:items-start`}>
                            <div className="w-full md:w-auto flex justify-center">
                                 <div className={`border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl flex items-center justify-center p-2 bg-white dark:bg-slate-900 relative overflow-hidden transition-all duration-300 ${settings.isFullHeader ? 'w-full md:w-80 h-32' : 'w-32 h-32'}`}>
                                    {processingImage === 'headerImage' && (
                                        <div className="absolute inset-0 bg-white/80 dark:bg-black/50 flex items-center justify-center z-10">
                                            <Loader2 className="animate-spin text-slate-600 dark:text-slate-300" size={24} />
                                        </div>
                                    )}
                                    {settings.headerImage ? (
                                        <img src={settings.headerImage} alt="Kop Surat" className="w-full h-full object-contain" />
                                    ) : (
                                        <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                                            <ImageIcon size={24} className="mb-2 opacity-50" />
                                            <span className="text-[10px] font-bold">Belum ada gambar</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex-1 space-y-4">
                                 <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-lg p-3">
                                     <p className="text-xs text-blue-800 dark:text-blue-200 flex items-start">
                                         <Info size={14} className="mr-2 mt-0.5 flex-shrink-0" />
                                         {settings.isFullHeader 
                                            ? "Upload gambar kop surat lengkap (logo + nama instansi + garis). Gambar akan otomatis dikompres agar ringan disimpan."
                                            : "Upload logo instansi saja. Logo akan diletakkan di sisi kiri header."
                                         }
                                     </p>
                                 </div>
                                 <div className="relative">
                                    <input 
                                        type="file" 
                                        accept="image/png, image/jpeg, image/jpg"
                                        onChange={(e) => handleImageUpload(e, 'headerImage')}
                                        className="block w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-800 file:text-white dark:file:bg-slate-700 hover:file:bg-slate-700 transition-all cursor-pointer disabled:cursor-not-allowed"
                                    />
                                 </div>
                            </div>
                         </div>
                    </div>
                </div>
            );

        case 'security':
            return (
                <div className="space-y-6 animate-fade-in text-black dark:text-white">
                     <div className="border-b border-slate-100 dark:border-slate-700 pb-4 mb-4">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Keamanan Akun</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Ubah username dan kata sandi untuk masuk ke aplikasi.</p>
                    </div>
                    
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm max-w-lg space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Username Login</label>
                            <input 
                                type="text" 
                                className="w-full border-slate-300 dark:border-slate-600 rounded-xl shadow-sm p-3 border focus:ring-2 focus:ring-teal-500 bg-slate-50 dark:bg-slate-900 text-black dark:text-white font-bold" 
                                value={newUsername} 
                                onChange={(e) => setNewUsername(e.target.value)}
                                placeholder="Masukkan username baru..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Kata Sandi Baru</label>
                            <input 
                                type="password" 
                                className="w-full border-slate-300 dark:border-slate-600 rounded-xl shadow-sm p-3 border focus:ring-2 focus:ring-teal-500 text-black dark:text-white bg-white dark:bg-slate-900" 
                                value={newPassword} 
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Biarkan kosong jika tidak ingin mengubah password..."
                            />
                             <div className="flex items-center p-3 bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 rounded-lg text-xs mt-4">
                                <AlertTriangle size={16} className="mr-2 flex-shrink-0" />
                                Simpan perubahan untuk menerapkan Username/Password baru.
                            </div>
                        </div>
                    </div>
                </div>
            );
        case 'database':
            return (
                <div className="space-y-6 animate-fade-in">
                    <div className="border-b border-slate-100 dark:border-slate-700 pb-4 mb-4">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Sinkronisasi & Migrasi Database Cloud</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Hubungkan aplikasi dengan MySQL di Hostinger agar data tersimpan otomatis di Cloud.</p>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex gap-4">
                        <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0" />
                        <div>
                            <h4 className="font-bold text-amber-800 dark:text-amber-200 text-sm">PENTING: Langkah Persiapan</h4>
                            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                                Pastikan Anda sudah membuat database di Hostinger dan menambahkan <b>Secrets</b> (DB_HOST, DB_USER, dll) di menu Settings AI Studio.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
                                    <Layers className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                                </div>
                                <h4 className="font-bold text-slate-800 dark:text-slate-100">1. Setup Tabel (phpMyAdmin)</h4>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                                Jalankan script SQL ini di tab <b>SQL</b> phpMyAdmin Hostinger untuk membuat struktur tabel yang dibutuhkan.
                            </p>
                            <button 
                                onClick={() => {
                                    const sql = `-- SQL Script for Prismades Serang Database\nCREATE TABLE IF NOT EXISTS \`settings\` (\n  \`id\` int(11) NOT NULL DEFAULT 1,\n  \`data\` longtext COLLATE utf8mb4_unicode_ci NOT NULL,\n  PRIMARY KEY (\`id\`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\nCREATE TABLE IF NOT EXISTS \`letters\` (\n  \`id\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,\n  \`data\` longtext COLLATE utf8mb4_unicode_ci NOT NULL,\n  \`updated_at\` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),\n  PRIMARY KEY (\`id\`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\nCREATE TABLE IF NOT EXISTS \`employees\` (\n  \`id\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,\n  \`data\` longtext COLLATE utf8mb4_unicode_ci NOT NULL,\n  \`updated_at\` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),\n  PRIMARY KEY (\`id\`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;
                                    navigator.clipboard.writeText(sql);
                                    alert("Script SQL berhasil disalin ke clipboard!");
                                }}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl transition-all text-sm font-medium"
                            >
                                <Copy className="w-4 h-4" /> Salin Script SQL Tabel
                            </button>
                        </div>

                        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                                    <Download className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <h4 className="font-bold text-slate-800 dark:text-slate-100">2. Migrasi Data Lokal</h4>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                                Tarik data yang saat ini ada di komputer ini (browser) dan ekspor menjadi file SQL untuk di-import ke Hostinger.
                            </p>
                            <button 
                                onClick={handleExportSQL}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-lg shadow-indigo-200 dark:shadow-none text-sm font-medium"
                            >
                                <Database className="w-4 h-4" /> Ekspor Data Lokal (.sql)
                            </button>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 border border-teal-200 dark:border-teal-800 rounded-2xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
                                    <RefreshCw className={`w-5 h-5 text-teal-600 dark:text-teal-400 ${isSettingUpDb ? 'animate-spin' : ''}`} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-slate-100">3. Setup Otomatis (Rekomendasi)</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Biarkan sistem membuat tabel secara otomatis di Hostinger.</p>
                                </div>
                            </div>
                            <button 
                                onClick={handleAutoSetupDb}
                                disabled={isSettingUpDb}
                                className="flex items-center gap-2 px-6 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-400 text-white rounded-xl transition-all font-medium text-sm"
                            >
                                {isSettingUpDb ? 'Memproses...' : 'Jalankan Setup Otomatis'}
                            </button>
                        </div>

                        {dbSetupStatus && (
                            <div className={`mt-4 p-4 rounded-xl flex items-start gap-3 ${dbSetupStatus.success ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'}`}>
                                {dbSetupStatus.success ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
                                <div>
                                    <p className="text-sm font-bold">{dbSetupStatus.success ? 'Berhasil!' : 'Gagal Setup'}</p>
                                    <p className="text-xs mt-1">{dbSetupStatus.message || dbSetupStatus.error}</p>
                                    {dbSetupStatus.success && (
                                        <p className="text-xs mt-2 opacity-80">Database Anda sekarang sudah siap digunakan. Semua data akan tersimpan otomatis ke Cloud.</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
                        <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                            <ExternalLink className="w-5 h-5 text-teal-600" /> Cara Import ke Hostinger
                        </h4>
                        <ol className="space-y-3 text-sm text-slate-600 dark:text-slate-400 list-decimal list-inside">
                            <li>Buka <b>hPanel Hostinger</b> dan pilih menu <b>Databases</b> {">"} <b>phpMyAdmin</b>.</li>
                            <li>Klik tombol <b>Enter phpMyAdmin</b> pada database yang Anda buat.</li>
                            <li>Pilih tab <b>SQL</b> di bagian atas, tempel script dari tombol (1) di atas, lalu klik <b>Go</b>.</li>
                            <li>Pilih tab <b>Import</b>, pilih file <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">.sql</code> yang Anda unduh dari tombol (2) di atas.</li>
                            <li>Klik <b>Go</b> di bagian bawah. Selesai! Data Anda sekarang sudah ada di Cloud.</li>
                        </ol>
                    </div>
                </div>
            );

        default:
          return null;
      }
  };

  return (
    <div className="space-y-8 pb-20 animate-fade-in text-black dark:text-slate-100">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-extrabold text-black dark:text-white tracking-tight flex items-center">
            <Layers className="mr-3 text-teal-600 dark:text-teal-400"/> Pengaturan Sistem
        </h2>
        <button 
            type="button"
            onClick={handleSaveClick}
            className="flex items-center px-6 py-2.5 bg-gradient-to-r from-teal-500 to-blue-600 text-white rounded-xl shadow-lg hover:shadow-xl hover:from-teal-600 hover:to-blue-700 font-bold transition-all transform hover:-translate-y-0.5"
        >
            <Save size={18} className="mr-2" /> Simpan Perubahan
        </button>
      </div>

      <form className="flex flex-col lg:flex-row gap-8" onSubmit={(e) => e.preventDefault()}>
          <div className="w-full lg:w-72 flex-shrink-0 space-y-2">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden p-2">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setActiveTab(item.id);
                            }}
                            className={`w-full flex items-center text-left px-4 py-3 rounded-xl transition-all mb-1 ${
                                isActive 
                                ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 shadow-sm ring-1 ring-teal-200 dark:ring-teal-800' 
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                            }`}
                        >
                            <div className={`p-2 rounded-lg mr-3 ${isActive ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-sm' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                                <Icon size={18} />
                            </div>
                            <div className="flex-1">
                                <span className={`block text-sm font-bold ${isActive ? 'text-teal-800 dark:text-teal-200' : 'text-slate-700 dark:text-slate-300'}`}>{item.label}</span>
                                <span className="block text-[10px] text-slate-400 leading-tight">{item.desc}</span>
                            </div>
                            {isActive && <ChevronRight size={16} className="text-teal-400" />}
                        </button>
                    );
                })}
              </div>
          </div>

          <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 p-8 min-h-[500px]">
              {renderContent()}
          </div>
      </form>

       {showToast && (
            <div className="fixed bottom-10 right-10 bg-black dark:bg-white text-white dark:text-black px-6 py-4 rounded-xl shadow-2xl flex items-center animate-fade-in z-[70]">
                <div className="bg-green-500 rounded-full p-1 mr-3">
                    <Check size={16} className="text-white" />
                </div>
                <div>
                    <h4 className="font-bold text-sm">Berhasil Disimpan!</h4>
                    <p className="text-xs text-slate-400 dark:text-slate-500">Pengaturan sistem telah diperbarui.</p>
                </div>
            </div>
       )}

       {showConfirmModal && (
           <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
               <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-scale-up">
                   <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Simpan Perubahan?</h3>
                   <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                       Pastikan data yang Anda masukkan sudah benar. Perubahan Username/Password akan langsung diterapkan pada login berikutnya.
                   </p>
                   <div className="flex gap-3">
                       <button 
                           type="button"
                           onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowConfirmModal(false); }}
                           className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                       >
                           Batal
                       </button>
                       <button 
                           type="button"
                           onClick={executeSave}
                           className="flex-1 px-4 py-2.5 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 shadow-lg shadow-teal-200 dark:shadow-teal-900/40 transition-colors"
                       >
                           Ya, Simpan
                       </button>
                   </div>
               </div>
           </div>
       )}
    </div>
  );
};

export default Settings;
