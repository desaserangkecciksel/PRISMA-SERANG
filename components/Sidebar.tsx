
import React, { useEffect, useState } from 'react';
import { LayoutDashboard, FilePenLine, Archive, Settings, Menu, LogOut, ChevronLeft, ChevronRight, Users, Cloud, CloudOff } from 'lucide-react';
import { StorageService } from '../services/storageService';
import { AppSettings } from '../types';
import { INITIAL_SETTINGS } from '../constants';

interface SidebarProps {
  currentPage: string;
  setCurrentPage: (page: string) => void;
  isOpen: boolean;
  toggleSidebar: () => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, setCurrentPage, isOpen, toggleSidebar, onLogout }) => {
  const [settings, setSettings] = useState<AppSettings>(INITIAL_SETTINGS);
  const [isCloudConnected, setIsCloudConnected] = useState<boolean | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);
  const [dbWarning, setDbWarning] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
        const data = await StorageService.getSettings();
        setSettings(data);
        // Check cloud connectivity via Hostinger PHP API
        try {
            const response = await fetch('https://apbdesdesaserang.id/api.php');
            if (response.ok) {
                const status = await response.json();
                if (status && (status.status === "online" || status.success)) {
                    setIsCloudConnected(true);
                    setDbError(null);
                    setDbWarning(null);
                } else if (status && status.error) {
                    setIsCloudConnected(false);
                    setDbError(status.error);
                } else {
                    setIsCloudConnected(true);
                    setDbError(null);
                }
            } else {
                try {
                    const status = await response.json();
                    setIsCloudConnected(false);
                    setDbError(status.error || `HTTP ${response.status}`);
                } catch(err) {
                    setIsCloudConnected(false);
                    setDbError(`HTTP ${response.status}`);
                }
            }
        } catch (e) {
            setIsCloudConnected(false);
            setDbError("Tidak dapat terhubung ke server cloud");
        }
    };
    loadSettings();
  }, []);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'input', label: 'Input Surat', icon: FilePenLine },
    { id: 'archive', label: 'Arsip Surat', icon: Archive },
    { id: 'employees', label: 'Data Pegawai', icon: Users },
    { id: 'settings', label: 'Pengaturan', icon: Settings },
  ];

  // Determine logo to show
  const displayLogo = settings.sidebarLogo || settings.headerImage;

  return (
    <>
      {/* Mobile Toggle Button (Hamburger) - Visible only on mobile */}
      <button 
        onClick={toggleSidebar}
        className={`lg:hidden fixed top-4 left-4 z-50 p-2.5 bg-teal-600 text-white rounded-xl shadow-xl shadow-teal-900/20 border border-teal-500 transition-all duration-300 hover:scale-105 active:scale-95`}
      >
        <Menu size={20} strokeWidth={2.5} />
      </button>

      {/* Desktop Toggle Button (Chevron) - Visible only on desktop */}
      <button 
        onClick={toggleSidebar}
        className={`hidden lg:flex fixed top-8 z-50 p-1.5 bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-400 rounded-full border border-slate-200 dark:border-slate-600 shadow-lg transition-all duration-300 ease-in-out hover:bg-teal-50 dark:hover:bg-slate-700 hover:text-teal-800 dark:hover:text-teal-300 items-center justify-center
          ${isOpen ? 'left-[15rem]' : 'left-[4rem]'} 
        `}
        style={{ transform: 'translateX(50%)' }} 
      >
        {isOpen ? <ChevronLeft size={16} strokeWidth={3} /> : <ChevronRight size={16} strokeWidth={3} />}
      </button>

      {/* Sidebar Container */}
      <div 
        className={`fixed inset-y-0 left-0 z-40 bg-gradient-to-b from-teal-700 via-teal-800 to-emerald-900 dark:from-slate-900 dark:via-slate-800 dark:to-slate-950 text-white shadow-2xl transition-all duration-300 ease-in-out flex flex-col h-screen
          ${isOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0 lg:w-20'}
        `}
      >
        {/* Header */}
        <div className={`h-24 flex items-center border-b border-white/10 transition-all duration-300 ${isOpen ? 'px-6' : 'justify-center px-0'}`}>
          {isOpen ? (
            <div className="flex items-center gap-3 animate-fade-in">
              <div className="w-10 h-10 rounded-xl bg-white p-1 flex-shrink-0 shadow-lg">
                 {displayLogo ? (
                    <img src={displayLogo} alt="App Logo" className="w-full h-full object-contain" />
                 ) : (
                    <div className="w-full h-full flex items-center justify-center bg-teal-50 rounded-lg">
                        <span className="font-black text-teal-700 text-xl">P</span>
                    </div>
                 )}
              </div>
              <div className="overflow-hidden">
                <h1 className="text-lg font-black text-white whitespace-nowrap tracking-tight">
                  {settings.sidebarTitle || 'PRISMADES'}
                </h1>
                <p className="text-[10px] text-teal-100 mt-0.5 uppercase tracking-widest font-bold whitespace-nowrap opacity-80">
                  {settings.sidebarSubtitle || 'Admin Desa'}
                </p>
              </div>
            </div>
          ) : (
             <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center shadow-lg transition-transform hover:scale-105">
                {displayLogo ? (
                   <img src={displayLogo} alt="App Logo" className="w-full h-full object-contain" />
                ) : (
                   <span className="font-black text-teal-700 text-xl">P</span>
                )}
             </div>
          )}
        </div>

        {/* Navigation */}
        <nav className={`mt-6 px-3 space-y-2 flex-1 custom-scrollbar ${isOpen ? 'overflow-y-auto' : 'overflow-visible'}`}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentPage(item.id);
                  if (window.innerWidth < 1024) toggleSidebar();
                }}
                className={`w-full flex items-center transition-all duration-200 group rounded-xl relative
                  ${isOpen ? 'px-4 py-3.5 space-x-3' : 'justify-center py-3.5 px-0'}
                  ${isActive 
                    ? 'bg-white/10 shadow-lg text-white border border-white/20' 
                    : 'text-white/60 hover:bg-white/5 hover:text-white border border-transparent'
                  }
                `}
              >
                <div className={`relative z-10 flex-shrink-0 transition-transform ${!isOpen && 'group-hover:scale-110'}`}>
                    <Icon size={22} className={`${isActive ? 'text-white' : 'text-white/70 group-hover:text-white'}`} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                
                <span className={`font-bold whitespace-nowrap transition-all duration-300 text-sm ${isOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 absolute left-10 w-0 overflow-hidden'}`}>
                    {item.label}
                </span>
                
                {/* Active Indicator Strip */}
                {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-teal-300 rounded-r-full shadow-[0_0_10px_rgba(45,212,191,0.5)]" />
                )}

                {/* Tooltip for Collapsed Mode */}
                {!isOpen && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 px-3 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 border border-slate-700">
                    {item.label}
                    <div className="absolute top-1/2 -translate-y-1/2 -left-1 w-2 h-2 bg-slate-900 border-l border-b border-slate-700 transform rotate-45"></div>
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer (Logout & Cloud Status) */}
        <div className={`p-4 border-t border-white/10 flex flex-col gap-3 transition-all duration-300 ${!isOpen && 'items-center'}`}>
          {/* Cloud Status Indicator */}
          <div 
            title={dbWarning || dbError || (isCloudConnected ? "Terhubung ke Cloud MySQL" : "Memeriksa koneksi...")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-help
            ${isCloudConnected === true ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 
              isCloudConnected === false ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 
              'bg-slate-500/20 text-slate-400 border border-slate-500/30'}
            ${!isOpen && 'justify-center w-10 h-10 p-0'}
          `}>
            {isCloudConnected === true ? <Cloud size={14} /> : <CloudOff size={14} />}
            {isOpen && (
              <span>{isCloudConnected === true ? 'Cloud Terhubung' : isCloudConnected === false ? 'Cloud Offline' : 'Memeriksa...'}</span>
            )}
          </div>

          <button 
            onClick={onLogout}
            className={`flex items-center justify-center transition-all font-bold text-xs bg-red-500/20 hover:bg-red-600 text-white border border-red-500/30 rounded-xl overflow-visible relative group
                ${isOpen ? 'w-full py-3 px-4 space-x-2' : 'w-10 h-10 p-0'}
            `}
          >
            <LogOut size={18} className="flex-shrink-0" />
            <span className={`whitespace-nowrap transition-all duration-300 ${isOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 hidden'}`}>KELUAR</span>

             {/* Tooltip */}
             {!isOpen && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 px-3 py-2 bg-red-600 text-white text-xs font-bold rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                    Keluar
                    <div className="absolute top-1/2 -translate-y-1/2 -left-1 w-2 h-2 bg-red-600 transform rotate-45"></div>
                  </div>
                )}
          </button>
        </div>
      </div>
      
      {/* Spacer Element - Vital for pushing the main content when Sidebar is fixed */}
      {/* Ensures content doesn't get hidden behind the sidebar */}
      <div 
        className={`hidden lg:block flex-shrink-0 transition-all duration-300 ease-in-out
          ${isOpen ? 'w-64' : 'w-20'}
        `} 
      />
    </>
  );
};

export default Sidebar;
