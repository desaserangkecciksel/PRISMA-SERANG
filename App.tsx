
import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import InputForm from './pages/InputForm';
import Archive from './pages/Archive';
import Settings from './pages/Settings';
import EmployeeData from './pages/EmployeeData';
import LoginPage from './components/LoginPage';
import WordEditor from './pages/WordEditor'; 
import { LetterData } from './types';
import { StorageService } from './services/storageService';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true); 
  const [editingLetter, setEditingLetter] = useState<LetterData | null>(null);
  
  // State untuk mengontrol tab default di halaman Archive (letters/taxes)
  const [archiveTab, setArchiveTab] = useState<'letters' | 'taxes' | 'bank_fees'>('letters');

  useEffect(() => {
    const initApp = async () => {
        const loggedIn = localStorage.getItem('espm_logged_in') === 'true';
        setIsLoggedIn(loggedIn);

        // Load Theme from Settings
        try {
          const settings = await StorageService.getSettings();
          if (settings.isDarkMode) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        } catch (e) {
          console.error("Error loading theme", e);
        }

        // Auto collapse sidebar on mobile load
        if (window.innerWidth < 1024) {
            setSidebarOpen(false);
        }
    };
    initApp();
  }, []);

  const handleLogin = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('espm_logged_in');
    setIsLoggedIn(false);
    setCurrentPage('dashboard');
  };

  const handlePageChange = (page: string) => {
    // Logic khusus untuk membuka Arsip bagian Pajak dari Dashboard
    if (page === 'archive-taxes') {
        setCurrentPage('archive');
        setArchiveTab('taxes');
    } else if (page === 'archive-bank') {
        setCurrentPage('archive');
        setArchiveTab('bank_fees');
    } else {
        setCurrentPage(page);
        // Reset tab ke default ('letters') jika navigasi biasa (misal dari sidebar)
        if (page === 'archive') {
            setArchiveTab('letters');
        }
    }
    
    setEditingLetter(null); 
    // Auto close sidebar on mobile when navigating
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  const handleEditLetter = (letter: LetterData) => {
    setEditingLetter(letter);
    setCurrentPage('input');
  };

  const handleBack = () => {
    if (editingLetter) {
        setEditingLetter(null);
        setCurrentPage('archive');
    } else {
        setCurrentPage('dashboard');
    }
  };

  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onNavigate={handlePageChange} />;
      case 'input':
        return <InputForm initialData={editingLetter} onBack={handleBack} />;
      case 'archive':
        return <Archive onEdit={handleEditLetter} initialTab={archiveTab} />;
      case 'employees':
        return <EmployeeData />;
      case 'settings':
        return <Settings />;
      case 'editor': // Jika ada fitur WordEditor
         return <WordEditor />; 
      default:
        return <Dashboard onNavigate={handlePageChange} />;
    }
  };

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    // Gunakan flex-row untuk layout sidebar + konten
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 font-inter text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-300">
      <Sidebar 
        currentPage={currentPage} 
        setCurrentPage={handlePageChange} 
        isOpen={sidebarOpen}
        toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onLogout={handleLogout}
      />
      
      {/* 
         flex-1: Mengambil sisa ruang
         min-w-0: CRITICAL FIX. Mencegah flex item (konten) memaksa container melebar melebihi layar.
         overflow-auto: Scroll ada di sini, bukan di body.
      */}
      <main className="flex-1 min-w-0 overflow-auto h-screen relative scroll-smooth bg-[#f8fafc] dark:bg-slate-900 transition-all duration-300">
         {/* Added animate-page-enter class here */}
         <div key={currentPage} className="w-full max-w-[1600px] mx-auto p-4 md:p-6 lg:p-8 pb-24 animate-page-enter">
            {renderContent()}
         </div>
      </main>
    </div>
  );
}

export default App;
