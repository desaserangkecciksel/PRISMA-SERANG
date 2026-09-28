
import React, { useMemo, useEffect, useState } from 'react';
import { 
  FileText, CheckCircle, Wallet, TrendingUp, Landmark, Calculator, Loader2, 
  Percent, Activity, ArrowUpRight, CreditCard, Calendar, BarChart3, 
  PieChart as PieIcon, LayoutGrid, Settings as SettingsIcon, CheckCircle2 
} from 'lucide-react';
import { StorageService } from '../services/storageService';
import { LetterData, AppSettings } from '../types';
import { INITIAL_SETTINGS } from '../constants';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  PieChart, 
  Pie, 
  Cell,
  BarChart,
  Bar,
  Legend
} from 'recharts';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-2xl shadow-xl text-xs">
        <p className="font-bold text-slate-800 dark:text-slate-100 mb-1.5">{label}</p>
        <div className="space-y-1">
          {payload.map((item: any, index: number) => (
            <p key={index} className="font-semibold flex items-center" style={{ color: item.color || item.fill }}>
              <span className="w-2.5 h-2.5 rounded-full mr-1.5 inline-block" style={{ backgroundColor: item.color || item.fill }}></span>
              {item.name}: {item.value} Surat
            </p>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const BudgetHistogramTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const dataItem = payload[0].payload;
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl shadow-2xl text-xs space-y-2.5 min-w-[240px] z-50 animate-scale-up">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
          <span className="font-black text-sm text-teal-700 dark:text-teal-400 font-mono">{label}</span>
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight">{dataItem.fullName}</span>
        </div>
        <div className="space-y-1.5 font-sans">
          <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
            <span className="flex items-center font-medium">
              <span className="w-2.5 h-2.5 rounded-full mr-2 bg-blue-500"></span> Pagu Anggaran:
            </span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">Rp {(dataItem['Pagu Anggaran'] || 0).toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
            <span className="flex items-center font-medium">
              <span className="w-2.5 h-2.5 rounded-full mr-2 bg-amber-500"></span> Realisasi Kas:
            </span>
            <span className="font-mono font-bold text-amber-600 dark:text-amber-400">Rp {(dataItem['Realisasi (Terpakai)'] || 0).toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
            <span className="flex items-center font-medium">
              <span className="w-2.5 h-2.5 rounded-full mr-2 bg-emerald-500"></span> Sisa Kas:
            </span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">Rp {(dataItem['Sisa Anggaran'] || 0).toLocaleString('id-ID')}</span>
          </div>
        </div>
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[11px] font-bold">
          <span className="text-slate-400">Tingkat Penyerapan:</span>
          <span className={`px-2 py-0.5 rounded-md font-mono ${Number(dataItem.percentage) > 90 ? 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400' : 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300'}`}>
            {dataItem.percentage}%
          </span>
        </div>
      </div>
    );
  }
  return null;
};

interface DashboardProps {
  onNavigate: (page: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [letters, setLetters] = useState<LetterData[]>([]);
  const [settings, setSettings] = useState<AppSettings>(INITIAL_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [budgetViewMode, setBudgetViewMode] = useState<'histogram' | 'diagram' | 'cards'>('histogram');
  
  // Logic: Use current year, but minimum start year is 2026 as per project requirement
  const displayYear = Math.max(new Date().getFullYear(), 2026);

  useEffect(() => {
    const loadData = async () => {
        setLoading(true);
        try {
            const [lettersData, settingsData] = await Promise.all([
                StorageService.getLetters(),
                StorageService.getSettings()
            ]);
            setLetters(lettersData || []);
            setSettings(settingsData || INITIAL_SETTINGS);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };
    loadData();
  }, []);

  const stats = useMemo(() => {
    const nonDraftLetters = letters.filter(l => l.status !== 'draft');
    
    // Keywords for Bank Fees
    const bankKeywords = ["ADMIN BANK", "ADMIN", "POTONGAN BANK", "ADMINISTRASI BANK"];

    // Hitung Total Pajak (Potongan) dari semua surat yang bukan draft
    const totalTax = nonDraftLetters.reduce((acc, letter) => {
        const letterTax = letter.items ? letter.items.reduce((sum, item) => sum + (item.deduction || 0), 0) : 0;
        return acc + letterTax;
    }, 0);

    // Hitung Pajak yang SUDAH DIBAYAR (Status = paid)
    const totalPaidTax = nonDraftLetters
        .filter(l => l.taxStatus === 'paid')
        .reduce((acc, letter) => {
            const letterTax = letter.items ? letter.items.reduce((sum, item) => sum + (item.deduction || 0), 0) : 0;
            return acc + letterTax;
        }, 0);

    // Hitung Total Admin Bank (Dari item transaksi yang cocok dengan keyword)
    const totalBankFee = nonDraftLetters.reduce((acc, letter) => {
        const feesInLetter = letter.items ? letter.items.reduce((sum, item) => {
            const recipient = (item.recipientName || '').toUpperCase();
            const desc = (item.description || '').toUpperCase();
            
            // Cek apakah item ini adalah Admin Bank
            const isBankFee = bankKeywords.some(keyword => recipient.includes(keyword) || desc.includes(keyword));
            
            // Jika ya, tambahkan nominal transfernya (karena admin bank biasanya diinput sebagai baris transaksi)
            return isBankFee ? sum + (item.netTransfer || 0) : sum;
        }, 0) : 0;
        return acc + feesInLetter;
    }, 0);

    return {
      total: letters.length,
      saved: letters.filter(l => l.status === 'saved').length,
      drafts: letters.filter(l => l.status === 'draft').length,
      archived: letters.filter(l => l.status === 'archived').length,
      totalNetTransfer: nonDraftLetters.reduce((acc, curr) => acc + curr.totalAmount, 0), // Ini Net Transfer Total
      totalTax: totalTax,
      totalPaidTax: totalPaidTax,
      totalBankFee: totalBankFee
    };
  }, [letters]);

  const formatCurrency = (value: number) => {
    return `Rp ${value.toLocaleString('id-ID')}`;
  };

  // Kalkulasi Parameter Anggaran (Spent vs Allocated vs Remaining)
  const budgetParameterData = useMemo(() => {
    const sources = ['PAD', 'ADD', 'DDS', 'PBH', 'PBP', 'PBK', 'DLL', 'SILPA'];
    const officialLetters = letters.filter(l => l.status !== 'draft');

    return sources.map(source => {
      const sourceLetters = officialLetters.filter(l => l.sourceFund === source);
      
      // 1. Uang Keluar ke Penerima (Net Transfer, sudah termasuk Admin Bank jika diinput sebagai item)
      const netSpent = sourceLetters.reduce((acc, curr) => acc + curr.totalAmount, 0);
      
      // 2. Uang Keluar Pajak (Hanya jika status 'paid')
      const taxSpent = sourceLetters.reduce((acc, letter) => {
          if (letter.taxStatus === 'paid') {
             const letterTax = letter.items ? letter.items.reduce((sum, item) => sum + (item.deduction || 0), 0) : 0;
             return acc + letterTax;
          }
          return acc;
      }, 0);

      // Total Realisasi Kas = Net Transfer + Pajak yang sudah disetor
      const totalSpent = netSpent + taxSpent;
      
      const allocated = settings.budgetAllocations?.[source as keyof typeof settings.budgetAllocations] || 0;
      const percentage = allocated > 0 ? (totalSpent / allocated) * 100 : 0;
      const remaining = allocated - totalSpent;

      return { 
        name: source, 
        spent: totalSpent,
        allocated: allocated,
        remaining: remaining,
        percentage: percentage.toFixed(1)
      };
    });
  }, [letters, settings.budgetAllocations]);

  const totals = useMemo(() => {
    const allocated = budgetParameterData.reduce((acc, item) => acc + item.allocated, 0);
    // Hitung remaining berdasarkan akumulasi remaining per sumber (supaya sinkron)
    const remaining = budgetParameterData.reduce((acc, item) => acc + item.remaining, 0);
    return { allocated, remaining };
  }, [budgetParameterData]);

  const BUDGET_COLORS: Record<string, string> = {
    'PAD': '#0d9488', // Teal
    'ADD': '#06b6d4', // Cyan
    'DDS': '#10b981', // Emerald
    'PBH': '#f59e0b', // Amber
    'PBP': '#6366f1', // Indigo
    'PBK': '#ec4899', // Pink
    'DLL': '#8b5cf6', // Purple
    'SILPA': '#f97316', // Vibrant Orange / Coral for SILPA
  };

  const SOURCE_LABELS: Record<string, string> = {
    'PAD': 'Pendapatan Asli Desa',
    'ADD': 'Alokasi Dana Desa',
    'DDS': 'Dana Desa (APBN)',
    'PBH': 'Bagi Hasil Pajak & Retribusi',
    'PBP': 'Bantuan Keuangan Provinsi',
    'PBK': 'Bantuan Keuangan Kabupaten',
    'DLL': 'Pendapatan Lain-lain',
    'SILPA': 'Sisa Lebih Pembiayaan Anggaran'
  };

  // Data terformat untuk Histogram / BarChart Pagu vs Realisasi vs Sisa
  const budgetHistogramData = useMemo(() => {
    return budgetParameterData.map(item => ({
      name: item.name,
      fullName: SOURCE_LABELS[item.name] || item.name,
      'Pagu Anggaran': item.allocated,
      'Realisasi (Terpakai)': item.spent,
      'Sisa Anggaran': Math.max(0, item.remaining),
      percentage: item.percentage
    }));
  }, [budgetParameterData]);

  // Data terformat untuk Diagram Donat / Komposisi Porsi Pagu Tahunan
  const budgetCompositionData = useMemo(() => {
    return budgetParameterData
      .filter(item => item.allocated > 0)
      .map(item => ({
        name: item.name,
        fullName: SOURCE_LABELS[item.name] || item.name,
        value: item.allocated,
        spent: item.spent,
        remaining: item.remaining,
        percentage: item.percentage,
        color: BUDGET_COLORS[item.name] || '#0d9488'
      }));
  }, [budgetParameterData]);

  // Total Dana Keluar = Net Transfer + Pajak Terbayar
  const totalCashOut = stats.totalNetTransfer + stats.totalPaidTax;

  const currentMonthStats = useMemo(() => {
    const now = new Date();
    const currentMonthIndex = now.getMonth();
    const currentYear = now.getFullYear();
    
    const docsThisMonthList = letters.filter(l => {
      const d = new Date(l.date || l.createdAt);
      return !isNaN(d.getTime()) && d.getMonth() === currentMonthIndex && d.getFullYear() === currentYear;
    });

    const totalThisMonth = docsThisMonthList.length;
    const completedThisMonth = docsThisMonthList.filter(l => l.status === 'saved' || l.status === 'archived').length;
    const draftsThisMonth = docsThisMonthList.filter(l => l.status === 'draft').length;

    const indonesianMonths = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const monthName = indonesianMonths[currentMonthIndex];

    return {
      total: totalThisMonth,
      completed: completedThisMonth,
      drafts: draftsThisMonth,
      monthName,
      year: currentYear
    };
  }, [letters]);

  const monthlyTrendData = useMemo(() => {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
      'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
    ];
    
    const data = months.map((month) => ({
      name: month,
      'Jumlah Dokumen': 0,
      'Selesai (Saved)': 0,
      'Draft': 0
    }));

    letters.forEach(letter => {
      const d = new Date(letter.date || letter.createdAt);
      if (!isNaN(d.getTime())) {
          const year = d.getFullYear();
          if (year === displayYear) {
              const monthIndex = d.getMonth();
              if (monthIndex >= 0 && monthIndex < 12) {
                  data[monthIndex]['Jumlah Dokumen'] += 1;
                  if (letter.status === 'saved' || letter.status === 'archived') {
                      data[monthIndex]['Selesai (Saved)'] += 1;
                  } else if (letter.status === 'draft') {
                      data[monthIndex]['Draft'] += 1;
                  }
              }
          }
      }
    });

    return data;
  }, [letters, displayYear]);

  const statusDistributionData = useMemo(() => {
    const counts = {
      saved: 0,
      archived: 0,
      draft: 0
    };

    letters.forEach(l => {
      if (l.status === 'saved') counts.saved += 1;
      else if (l.status === 'archived') counts.archived += 1;
      else if (l.status === 'draft') counts.draft += 1;
    });

    return [
      { name: 'Selesai (Saved)', value: counts.saved, color: '#10b981' },
      { name: 'Terarsip', value: counts.archived, color: '#3b82f6' },
      { name: 'Draft', value: counts.draft, color: '#f59e0b' },
    ].filter(item => item.value > 0);
  }, [letters]);

  const statCards = [
    { 
      label: 'Total Dokumen', 
      value: stats.total.toString(), 
      icon: FileText, 
      color: 'bg-blue-500',
      clickable: true,
      target: 'archive'
    },
    { 
      label: 'Set Tersimpan', 
      value: stats.saved.toString(), 
      icon: CheckCircle, 
      color: 'bg-emerald-500',
      clickable: true,
      target: 'archive'
    },
    { 
      label: 'Total Pajak (Potongan)', 
      value: formatCurrency(stats.totalTax), 
      icon: Percent, 
      color: 'bg-purple-600',
      clickable: true,
      target: 'archive-taxes', // Navigasi khusus ke tab pajak
      isCurrency: true
    },
    { 
      label: 'Total Admin Bank', 
      value: formatCurrency(stats.totalBankFee), 
      icon: CreditCard, 
      color: 'bg-orange-500',
      clickable: true,
      target: 'archive-bank', // Navigasi khusus ke tab admin bank
      isCurrency: true
    },
    { 
      label: 'Total Pagu Keseluruhan', 
      value: formatCurrency(totals.allocated), 
      icon: TrendingUp, 
      color: 'bg-rose-600',
      clickable: true,
      target: 'archive',
      isCurrency: true
    },
    { 
      label: 'Total Dana Keluar', 
      value: formatCurrency(totalCashOut), 
      icon: Wallet, 
      color: 'bg-indigo-500',
      clickable: true,
      target: 'archive',
      isCurrency: true
    },
  ];

  if (loading) {
      return <div className="flex h-96 items-center justify-center text-slate-500 dark:text-slate-400 animate-pulse"><Loader2 className="animate-spin mr-2"/> Memuat Data Dashboard...</div>;
  }

  return (
    <div className="space-y-8 animate-fade-in text-black dark:text-slate-100 pb-10">
      {/* Header Section Modern */}
      <div className="relative bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-900 dark:to-slate-900 rounded-3xl p-8 shadow-2xl overflow-hidden text-white mb-10">
          {/* Decorative Background Elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-400/20 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl"></div>

          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
              <div>
                  <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm border border-white/10 text-xs font-bold uppercase tracking-wider mb-3">
                      <Activity size={14} className="mr-2" />
                      Status Anggaran & Administrasi
                  </div>
                  <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-2">
                      APBDes {displayYear}
                  </h2>
                  <p className="text-emerald-100 font-medium text-sm md:text-lg opacity-90 max-w-xl">
                      Sistem Informasi Pengelolaan Keuangan & Administrasi Desa Serang
                  </p>
              </div>

              {/* Sisa Kas Widget - Floating Glass */}
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 min-w-[280px] w-full md:w-auto shadow-lg transform transition-all hover:scale-105 hover:bg-white/15 group">
                  <div className="flex items-center justify-between mb-2">
                      <div className="p-2 bg-emerald-400/20 rounded-lg text-emerald-100 group-hover:text-white transition-colors">
                          <Calculator size={24} />
                      </div>
                      <span className="text-xs font-bold text-emerald-200 uppercase tracking-wider">Sisa Kas Desa</span>
                  </div>
                  <div className="text-2xl md:text-3xl font-black tracking-tight text-white drop-shadow-sm truncate">
                      {formatCurrency(totals.remaining)}
                  </div>
                  <div className="text-xs text-emerald-100 mt-1 flex items-center opacity-80">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-pulse"></div>
                      Update Real-time (Setelah Pajak Dibayar)
                  </div>
              </div>
          </div>
      </div>
      
      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-6 gap-6">
        {statCards.map((item, index) => (
          <div 
            key={index} 
            onClick={() => item.clickable && onNavigate(item.target || 'archive')}
            className={`group bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-xl transition-all duration-300 relative overflow-hidden ${item.clickable ? 'cursor-pointer hover:-translate-y-1' : ''}`}
          >
            {/* Background Icon Watermark */}
            <div className={`absolute top-0 right-0 p-3 opacity-[0.03] dark:opacity-[0.05] group-hover:opacity-10 transition-opacity transform group-hover:scale-125 duration-500`}>
                <item.icon size={80} className={item.color.replace('bg-', 'text-')} />
            </div>
            
            <div className="flex flex-col h-full justify-between relative z-10">
                <div className="mb-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg mb-3 ${item.color} group-hover:scale-110 transition-transform duration-300`}>
                        <item.icon size={20} />
                    </div>
                    {/* Increased font size for label */}
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{item.label}</p>
                </div>
                
                <div className="flex items-end justify-between">
                    {/* Increased font size for value */}
                    <h3 className={`font-black text-slate-800 dark:text-white leading-none ${item.isCurrency ? 'text-lg lg:text-xl xl:text-2xl' : 'text-4xl'}`}>
                        {item.value}
                    </h3>
                    {item.clickable && (
                        <div className="w-6 h-6 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center text-slate-400 group-hover:bg-teal-50 group-hover:text-teal-600 transition-colors">
                            <ArrowUpRight size={14} />
                        </div>
                    )}
                </div>
            </div>
          </div>
        ))}
      </div>

      {/* Administrasi & Aktivitas Dokumen Section with Recharts */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 shadow-lg border border-slate-100 dark:border-slate-700 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 dark:border-slate-700 pb-4">
          <div>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white flex items-center">
              <Activity className="mr-3 text-teal-600 dark:text-teal-400" size={28} />
              Aktivitas Administrasi & Ringkasan Dokumen
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Visualisasi kuantitas pembuatan berkas dan dinamika administratif di Desa Serang.
            </p>
          </div>
          <div className="flex h-fit items-center px-4 py-2 bg-teal-50 dark:bg-teal-950/30 text-teal-800 dark:text-teal-200 border border-teal-100 dark:border-teal-900/50 rounded-xl font-bold text-sm">
            <Calendar className="mr-2" size={16} />
            Bulan Ini: {currentMonthStats.monthName} {currentMonthStats.year}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chart 1: Tren Bulanan (Span 2) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h4 className="text-lg font-bold text-slate-800 dark:text-white">
                  Tren Pembuatan Surat Bulanan ({displayYear})
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Dinamika bulanan pembuatan surat (Selesai vs Draft) sepanjang tahun anggaran.
                </p>
              </div>
              <div className="flex items-center space-x-4 text-xs font-semibold">
                <span className="flex items-center">
                  <span className="w-3 h-3 rounded bg-teal-500 mr-1.5 inline-block"></span>
                  Selesai
                </span>
                <span className="flex items-center">
                  <span className="w-3 h-3 rounded bg-amber-500 mr-1.5 inline-block"></span>
                  Draft
                </span>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={monthlyTrendData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorSaved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorDraft" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-700/50" />
                  <XAxis 
                    dataKey="name" 
                    tickLine={false} 
                    axisLine={false}
                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                  />
                  <YAxis 
                    tickLine={false} 
                    axisLine={false}
                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                  />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    name="Selesai (Saved)"
                    dataKey="Selesai (Saved)" 
                    stroke="#14b8a6" 
                    strokeWidth={2.5} 
                    fillOpacity={1} 
                    fill="url(#colorSaved)" 
                  />
                  <Area 
                    type="monotone" 
                    name="Draft"
                    dataKey="Draft" 
                    stroke="#f59e0b" 
                    strokeWidth={2} 
                    fillOpacity={0.8} 
                    fill="url(#colorDraft)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Card 2: Bulan Ini & Distribusi Status (Span 1) */}
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider text-teal-750 uppercase">
                  Bulan Ini: {currentMonthStats.monthName}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-teal-150 text-[10px] font-bold text-teal-800 dark:text-teal-300 dark:bg-teal-900/40">
                  AKTIF
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-750 shadow-sm">
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-450">Total Dokumen Baru</p>
                  <p className="text-2xl font-black text-slate-800 dark:text-white mt-1">
                    {currentMonthStats.total}
                  </p>
                  <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 leading-none">Berkas terbuat</p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-750 shadow-sm">
                  <p className="text-[10px] font-semibold text-teal-650 dark:text-teal-400">Berkas Selesai</p>
                  <p className="text-2xl font-black text-teal-700 dark:text-teal-300 mt-1">
                    {currentMonthStats.completed}
                  </p>
                  <p className="text-[9px] text-teal-600/70 dark:text-teal-400/50 mt-1 leading-none">Status Saved</p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Penyebaran Status Dokumen
                </p>
                
                {statusDistributionData.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-455 dark:text-slate-500">
                    Belum ada data status dokumen.
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
                    <div className="w-28 h-28 relative shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={statusDistributionData}
                            cx="50%"
                            cy="50%"
                            innerRadius={30}
                            outerRadius={45}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {statusDistributionData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip formatter={(value) => [`${value} Surat`, 'Jumlah']} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-base font-black text-slate-800 dark:text-white leading-none">
                          {stats.total}
                        </span>
                        <span className="text-[8px] text-slate-400 uppercase tracking-widest font-semibold mt-0.5">
                          Total
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 w-full space-y-1.5">
                      {statusDistributionData.map((item, idx) => {
                        const pct = stats.total > 0 ? ((item.value / stats.total) * 100).toFixed(0) : '0';
                        return (
                          <div key={idx} className="flex items-center justify-between text-xs">
                            <span className="flex items-center text-slate-600 dark:text-slate-350 font-medium">
                              <span className="w-2 h-2 rounded-full mr-2 shrink-0" style={{ backgroundColor: item.color }}></span>
                              {item.name}
                            </span>
                            <span className="font-bold text-slate-800 dark:text-white">
                              {item.value} ({pct}%)
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Subtle links footer */}
            <div className="text-[10px] text-slate-400 dark:text-slate-500 pt-3 mt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span></span>
              <span className="underline cursor-pointer hover:text-teal-650 text-teal-650 dark:text-teal-400 dark:hover:text-teal-300 font-bold" onClick={() => onNavigate('archive')}>Lihat Detail Arsip</span>
            </div>
          </div>
        </div>
      </div>

      {/* Kontainer Utama Pagu Anggaran Tahunan (PAD, ADD, DDS, PBH, PBP, PBK, DLL, SILPA) */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 shadow-xl border border-slate-100 dark:border-slate-700 space-y-6">
        {/* Header Kontainer */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-100 dark:border-slate-700 pb-5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border border-teal-200/80 dark:border-teal-800 text-xs font-black uppercase tracking-wider mb-2">
              <Landmark size={14} />
              Pagu Anggaran Tahunan APBDes {displayYear}
            </div>
            <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Pagu Anggaran & Realisasi (8 Sumber Dana)
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Visualisasi komparatif Pagu, Realisasi Kas, dan Sisa Anggaran untuk <span className="font-bold text-teal-700 dark:text-teal-400">PAD, ADD, DDS, PBH, PBP, PBK, DLL, dan SILPA</span>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* View Switcher Buttons */}
            <div className="flex bg-slate-100 dark:bg-slate-700/80 p-1 rounded-2xl border border-slate-200 dark:border-slate-600">
              <button
                type="button"
                onClick={() => setBudgetViewMode('histogram')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  budgetViewMode === 'histogram'
                    ? 'bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-300 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Tampilkan grafik histogram batang perbandingan pagu, realisasi, dan sisa"
              >
                <BarChart3 size={15} /> Histogram Batang
              </button>
              <button
                type="button"
                onClick={() => setBudgetViewMode('diagram')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  budgetViewMode === 'diagram'
                    ? 'bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-300 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Tampilkan diagram donat komposisi proporsi alokasi pagu tahunan"
              >
                <PieIcon size={15} /> Diagram Komposisi
              </button>
              <button
                type="button"
                onClick={() => setBudgetViewMode('cards')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  budgetViewMode === 'cards'
                    ? 'bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-300 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Tampilkan kartu rincian realisasi per sumber dana"
              >
                <LayoutGrid size={15} /> Kartu Realisasi
              </button>
            </div>

            {/* Shortcut to Settings */}
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="px-3.5 py-2 bg-slate-900 hover:bg-black dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
              title="Buka Pengaturan untuk mengedit, menambah, atau menghapus nominal pagu anggaran"
            >
              <SettingsIcon size={14} /> Atur Pagu di Pengaturan
            </button>
          </div>
        </div>

        {/* Top KPI Bar Ringkasan Pagu */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Pagu APBDes</span>
            <div className="text-xl md:text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono">
              {formatCurrency(totals.allocated)}
            </div>
            <span className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold mt-0.5 block">
              8 Sumber Dana APBDes
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Realisasi Kas Keluar</span>
            <div className="text-xl md:text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 font-mono">
              {formatCurrency(totalCashOut)}
            </div>
            <span className="text-[10px] text-slate-400 font-semibold mt-0.5 block">
              Net Transfer + Pajak Terbayar
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Sisa Kas Anggaran</span>
            <div className={`text-xl md:text-2xl font-black mt-1 font-mono ${totals.remaining < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {formatCurrency(totals.remaining)}
            </div>
            <span className="text-[10px] text-slate-400 font-semibold mt-0.5 block">
              Sisa Kas Siap Digunakan
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Rata-rata Penyerapan</span>
            <div className="text-xl md:text-2xl font-black text-teal-700 dark:text-teal-300 mt-1 font-mono">
              {totals.allocated > 0 ? ((totalCashOut / totals.allocated) * 100).toFixed(1) : 0}%
            </div>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5 block flex items-center">
              <CheckCircle2 size={11} className="mr-1" /> Tingkat Realisasi Total
            </span>
          </div>
        </div>

        {/* MODE 1: HISTOGRAM BATANG (BAR CHART) */}
        {budgetViewMode === 'histogram' && (
          <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h4 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <BarChart3 className="text-teal-600 dark:text-teal-400" size={18} />
                  Histogram Komparasi: Pagu vs Realisasi vs Sisa (PAD, ADD, DDS, PBH, PBP, PBK, DLL, SILPA)
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Grafik batang komparasi nominal pagu yang dialokasikan terhadap serapan belanja kas dan sisa dana.
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-semibold">
                <span className="flex items-center">
                  <span className="w-3 h-3 rounded bg-blue-500 mr-1.5 inline-block"></span> Pagu
                </span>
                <span className="flex items-center">
                  <span className="w-3 h-3 rounded bg-amber-500 mr-1.5 inline-block"></span> Realisasi
                </span>
                <span className="flex items-center">
                  <span className="w-3 h-3 rounded bg-emerald-500 mr-1.5 inline-block"></span> Sisa
                </span>
              </div>
            </div>

            <div className="h-80 md:h-96 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={budgetHistogramData}
                  margin={{ top: 20, right: 10, left: 10, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-700/50" />
                  <XAxis 
                    dataKey="name" 
                    tickLine={false} 
                    axisLine={{ stroke: '#cbd5e1' }}
                    tick={{ fill: '#475569', fontSize: 12, fontWeight: 700 }}
                  />
                  <YAxis 
                    tickLine={false} 
                    axisLine={false}
                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                    tickFormatter={(value) => `Rp ${(value / 1000000).toLocaleString('id-ID')}Jt`}
                  />
                  <RechartsTooltip content={<BudgetHistogramTooltip />} />
                  <Legend 
                    verticalAlign="top" 
                    align="right"
                    wrapperStyle={{ paddingBottom: '10px', fontSize: '12px', fontWeight: 600 }}
                  />
                  <Bar 
                    dataKey="Pagu Anggaran" 
                    fill="#3b82f6" 
                    radius={[6, 6, 0, 0]} 
                    maxBarSize={40} 
                  />
                  <Bar 
                    dataKey="Realisasi (Terpakai)" 
                    fill="#f59e0b" 
                    radius={[6, 6, 0, 0]} 
                    maxBarSize={40} 
                  />
                  <Bar 
                    dataKey="Sisa Anggaran" 
                    fill="#10b981" 
                    radius={[6, 6, 0, 0]} 
                    maxBarSize={40} 
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Quick Badges 8 Sumber Dana */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
              {budgetParameterData.map((item) => (
                <div key={item.name} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700/70 text-center">
                  <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 block">{item.name}</span>
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200 font-mono block mt-0.5 truncate" title={`Rp ${item.allocated.toLocaleString('id-ID')}`}>
                    Rp {(item.allocated / 1000000).toFixed(0)}Jt
                  </span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded inline-block mt-1 ${Number(item.percentage) > 90 ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' : 'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300'}`}>
                    {item.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MODE 2: DIAGRAM KOMPOSISI PROPORSIONAL */}
        {budgetViewMode === 'diagram' && (
          <div className="space-y-6 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h4 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <PieIcon className="text-teal-600 dark:text-teal-400" size={18} />
                  Diagram Komposisi Proporsi Pagu APBDes ({displayYear})
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Pembagian persentase kontribusi masing-masing sumber dana terhadap total pagu anggaran desa.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Donut Chart */}
              <div className="lg:col-span-5 flex flex-col items-center justify-center">
                <div className="w-64 h-64 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={budgetCompositionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={105}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {budgetCompositionData.map((entry) => (
                          <Cell key={`cell-${entry.name}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        formatter={(value: any, name: any) => [`Rp ${Number(value).toLocaleString('id-ID')}`, `Pagu ${name}`]} 
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Pagu</span>
                    <span className="text-lg font-black text-slate-800 dark:text-white font-mono leading-tight px-4 truncate">
                      Rp {(totals.allocated / 1000000).toFixed(0)} Jt
                    </span>
                    <span className="text-[10px] text-teal-600 dark:text-teal-400 font-bold mt-0.5">8 Sumber Dana</span>
                  </div>
                </div>
              </div>

              {/* Rincian Komposisi 8 Sumber Dana */}
              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {budgetParameterData.map((item) => {
                  const shareOfTotal = totals.allocated > 0 ? ((item.allocated / totals.allocated) * 100).toFixed(1) : '0';
                  const color = BUDGET_COLORS[item.name] || '#0d9488';
                  return (
                    <div 
                      key={item.name} 
                      className="p-3.5 rounded-2xl border border-slate-100 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-900/40 flex items-start justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }}></span>
                          <span className="font-extrabold text-sm text-slate-900 dark:text-white font-mono">{item.name}</span>
                          <span className="text-[10px] text-slate-400 truncate max-w-[120px]" title={SOURCE_LABELS[item.name]}>
                            {SOURCE_LABELS[item.name]}
                          </span>
                        </div>
                        <div className="font-mono font-bold text-xs text-slate-700 dark:text-slate-300 pl-5">
                          {formatCurrency(item.allocated)}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-teal-700 dark:text-teal-300 font-mono block">
                          {shareOfTotal}%
                        </span>
                        <span className="text-[9px] text-slate-400 block">Porsi APBDes</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* MODE 3: KARTU RINCI REALISASI */}
        {budgetViewMode === 'cards' && (
          <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h4 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <LayoutGrid className="text-teal-600 dark:text-teal-400" size={18} />
                  Kartu Realisasi Per Sumber Dana (8 Sumber APBDes)
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Rincian penyerapan anggaran, sisa dana, dan status serapan untuk setiap sumber dana desa.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {budgetParameterData.map((item) => {
                const color = BUDGET_COLORS[item.name] || '#0d9488';
                return (
                  <div 
                    key={item.name} 
                    className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/80 p-4 rounded-2xl space-y-3 hover:border-teal-400 transition-all shadow-xs group"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }}></span>
                          <span className="text-base font-black text-slate-900 dark:text-white font-mono">{item.name}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[150px]" title={SOURCE_LABELS[item.name]}>
                          {SOURCE_LABELS[item.name]}
                        </p>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${Number(item.percentage) > 90 ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' : 'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300'}`}>
                        {item.percentage}%
                      </span>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Realisasi Kas:</div>
                      <div className="text-lg font-black text-slate-800 dark:text-white font-mono mt-0.5">
                        {formatCurrency(item.spent)}
                      </div>
                    </div>

                    <div className="h-2.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                      <div 
                        className="h-full rounded-full transition-all duration-1000 ease-out relative group-hover:opacity-90"
                        style={{ width: `${Math.min(Number(item.percentage), 100)}%`, backgroundColor: color }}
                      >
                        <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]"></div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200/60 dark:border-slate-800 font-semibold">
                      <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                        Pagu: <span className="font-mono text-slate-700 dark:text-slate-200">{formatCurrency(item.allocated)}</span>
                      </span>
                      <span className={`text-[11px] font-mono font-bold ${item.remaining < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        Sisa: {formatCurrency(item.remaining)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
