
import React, { useMemo, useEffect, useState } from 'react';
import { FileText, CheckCircle, Wallet, TrendingUp, Landmark, Calculator, Loader2, Percent, Activity, ArrowUpRight, CreditCard } from 'lucide-react';
import { StorageService } from '../services/storageService';
import { LetterData, AppSettings } from '../types';
import { INITIAL_SETTINGS } from '../constants';

interface DashboardProps {
  onNavigate: (page: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [letters, setLetters] = useState<LetterData[]>([]);
  const [settings, setSettings] = useState<AppSettings>(INITIAL_SETTINGS);
  const [loading, setLoading] = useState(true);
  
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
    const sources = ['PAD', 'ADD', 'DDS', 'PBH', 'PBP', 'SILPA'];
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

  const BUDGET_COLORS = {
    'PAD': '#0d9488', 
    'ADD': '#06b6d4', 
    'DDS': '#10b981', 
    'PBH': '#f59e0b', 
    'PBP': '#6366f1', 
    'SILPA': '#8b5cf6', 
  };

  // Total Dana Keluar = Net Transfer + Pajak Terbayar
  const totalCashOut = stats.totalNetTransfer + stats.totalPaidTax;

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

      {/* Budget Section Asymmetric Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Main Budget Progress (Left) */}
          <div className="xl:col-span-2 bg-white dark:bg-slate-800 rounded-3xl shadow-lg border border-slate-100 dark:border-slate-700 p-8">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8 gap-4">
                    <div>
                        <h3 className="text-2xl font-black text-slate-800 dark:text-white flex items-center">
                            <Landmark className="mr-3 text-teal-600 dark:text-teal-400" size={28} />
                            Realisasi Anggaran
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Monitoring penyerapan dana per sumber (Netto + Pajak Terbayar).</p>
                    </div>
                    <div>
                        <span className="px-4 py-2 bg-slate-50 dark:bg-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                            Tahun Anggaran {displayYear}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                    {budgetParameterData.map((item) => {
                        const color = BUDGET_COLORS[item.name as keyof typeof BUDGET_COLORS];
                        return (
                            <div key={item.name} className="group">
                                <div className="flex justify-between items-end mb-2">
                                    <div>
                                        <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{item.name}</span>
                                        <div className="text-xl font-black text-slate-900 dark:text-white mt-1">{formatCurrency(item.spent)}</div>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${Number(item.percentage) > 90 ? 'bg-red-100 text-red-700' : 'bg-teal-50 text-teal-700'} dark:bg-slate-700 dark:text-slate-300`}>
                                            {item.percentage}%
                                        </span>
                                    </div>
                                </div>
                                <div className="h-4 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden shadow-inner">
                                    <div 
                                        className="h-full rounded-full transition-all duration-1000 ease-out relative group-hover:opacity-90"
                                        style={{ width: `${Math.min(Number(item.percentage), 100)}%`, backgroundColor: color }}
                                    >
                                        {/* Shimmer Effect */}
                                        <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]" style={{ backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)' }}></div>
                                    </div>
                                </div>
                                {/* Increased Size for Pagu and Sisa */}
                                <div className="mt-3 flex justify-between items-center text-sm font-bold">
                                    <span className="text-slate-500 dark:text-slate-400">
                                        Pagu: <span className="text-slate-700 dark:text-slate-200">{formatCurrency(item.allocated)}</span>
                                    </span>
                                    <span className={item.remaining < 0 ? 'text-red-600 bg-red-50 px-2 py-0.5 rounded' : 'text-emerald-600 dark:text-emerald-400'}>
                                        Sisa: {formatCurrency(item.remaining)}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
          </div>

          {/* Budget Summary Side Cards (Right) */}
          <div className="space-y-6">
                {/* Highlight Card */}
                <div className="bg-gradient-to-br from-indigo-500 to-blue-600 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
                    <p className="text-indigo-100 font-bold text-xs uppercase tracking-widest mb-1">Total Pagu Anggaran</p>
                    <h3 className="text-2xl lg:text-3xl font-black tracking-tight">{formatCurrency(totals.allocated)}</h3>
                    <div className="mt-4 flex items-center text-xs font-medium text-indigo-100 bg-white/10 w-fit px-3 py-1.5 rounded-lg backdrop-blur-sm">
                        <TrendingUp size={14} className="mr-2" /> Target {displayYear}
                    </div>
                </div>

                {/* Secondary Cards */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-lg border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center space-x-4 mb-5 group">
                        <div className="p-3 bg-rose-100 dark:bg-rose-900/30 rounded-xl text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform">
                            <Wallet size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Dana Terpakai (Net+Pajak)</p>
                            <h3 className="text-lg font-black text-slate-800 dark:text-white">{formatCurrency(totalCashOut)}</h3>
                        </div>
                    </div>
                    <div className="h-px bg-slate-100 dark:bg-slate-700 w-full my-2"></div>
                    <div className="flex items-center space-x-4 mt-5 group">
                        <div className="p-3 bg-teal-100 dark:bg-teal-900/30 rounded-xl text-teal-600 dark:text-teal-400 group-hover:scale-110 transition-transform">
                            <CheckCircle size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Sisa Kas Desa</p>
                            <h3 className="text-lg font-black text-slate-800 dark:text-white">{formatCurrency(totals.remaining)}</h3>
                        </div>
                    </div>
                </div>
          </div>
      </div>
    </div>
  );
};

export default Dashboard;
