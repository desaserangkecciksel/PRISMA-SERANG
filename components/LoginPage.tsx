
import React, { useState, useEffect } from 'react';
import { Lock, User, LogIn, AlertCircle, Eye, EyeOff, HelpCircle, Mail, MessageCircle, X } from 'lucide-react';
import { StorageService } from '../services/storageService';
import { INITIAL_SETTINGS } from '../constants';

interface LoginPageProps {
  onLogin: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showUsername, setShowUsername] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);
  
  // State for settings loaded from DB
  const [settings, setSettings] = useState(INITIAL_SETTINGS);

  useEffect(() => {
    // Load settings when login page mounts to check custom password/logo
    const loadSettings = async () => {
        const data = await StorageService.getSettings();
        setSettings(data);
    };
    loadSettings();
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Default credentials: SERANG / SERANG2026
    const validUsername = settings.username || 'SERANG';
    const validPassword = settings.password || 'SERANG2026';
    
    if (username === validUsername && password === validPassword) {
      localStorage.setItem('espm_logged_in', 'true');
      onLogin();
    } else {
      setError('Username atau Password salah!');
      setTimeout(() => setError(''), 3000);
    }
  };

  // Determine logo to show: specific login logo first, then header image, then fallback
  const displayLogo = settings.loginLogo || settings.headerImage;

  // Format Whatsapp Number (ensure 62 prefix)
  const getWhatsappLink = () => {
    let num = settings.villageWhatsapp || '6282217561626';
    // Clean characters
    num = num.replace(/[^0-9]/g, '');
    if (num.startsWith('0')) {
        num = '62' + num.substring(1);
    }
    return `https://wa.me/${num}?text=Halo%20Admin%20Desa%20Serang%2C%20saya%20lupa%20password%20akun%20PRISMADES.%20Mohon%20bantuannya%20untuk%20reset%20akses.`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-500 via-blue-600 to-emerald-600 p-4 font-inter">
      <div className="w-full max-w-md animate-scale-up">
        <div className="bg-white/95 backdrop-blur-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20">
          <div className="p-10 text-black">
            <div className="flex flex-col items-center mb-10">
              <div className="w-24 h-24 bg-white rounded-2xl shadow-inner flex items-center justify-center mb-6 overflow-hidden border border-slate-100">
                {displayLogo ? (
                  <img src={displayLogo} alt="Logo Desa" className="w-full h-full object-contain p-2" />
                ) : (
                  <div className="text-black font-black text-2xl">PRISMADES</div>
                )}
              </div>
              <h1 className="text-3xl font-black text-black tracking-tighter uppercase text-center leading-tight">
                {settings.loginTitle || 'PRISMADES SERANG'}
              </h1>
              <p className="text-teal-700 text-[10px] font-bold mt-2 tracking-wide uppercase text-center max-w-xs leading-relaxed">
                {settings.loginSubtitle || 'Permohonan Rincian & Instruksi Pembayaran Anggaran'}
              </p>
              <p className="text-black text-[10px] font-bold mt-4 tracking-widest uppercase opacity-60 text-center">
                {settings.loginDescription || 'PEMERINTAH DESA SERANG KECAMATAN CIKARANG SELATAN KABUPATEN BEKASI'}
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-black uppercase ml-1 tracking-widest">Username</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-black opacity-40 group-focus-within:opacity-100 transition-opacity">
                    <User size={18} />
                  </div>
                  <input
                    type={showUsername ? "text" : "password"}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-12 text-sm font-bold focus:ring-4 focus:ring-teal-500/10 focus:border-black outline-none transition-all text-black"
                    placeholder="Masukkan username..."
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowUsername(!showUsername)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-black opacity-40 hover:opacity-100 transition-opacity"
                  >
                    {showUsername ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-black uppercase ml-1 tracking-widest">Password</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-black opacity-40 group-focus-within:opacity-100 transition-opacity">
                    <Lock size={18} />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-12 text-sm font-bold focus:ring-4 focus:ring-teal-500/10 focus:border-black outline-none transition-all text-black"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-black opacity-40 hover:opacity-100 transition-opacity"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center space-x-2 text-rose-600 text-xs font-bold animate-pulse bg-rose-50 p-3 rounded-xl border border-rose-100">
                  <AlertCircle size={14} />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-black hover:bg-slate-900 text-white rounded-2xl py-4 font-black text-sm shadow-xl shadow-black/20 transform transition-all active:scale-95 flex items-center justify-center space-x-2 mt-4"
              >
                <LogIn size={18} />
                <span>MASUK KE SISTEM</span>
              </button>

              <div className="text-center pt-2">
                <button 
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-teal-600 hover:text-teal-800 text-xs font-bold transition-colors hover:underline"
                >
                  Lupa Username / Password?
                </button>
              </div>
            </form>

            <div className="mt-8 text-center">
              <p className="text-[9px] text-black font-bold uppercase tracking-[0.2em] opacity-60">
                {settings.loginFooter || `© ${new Date().getFullYear()} PEMERINTAH DESA SERANG`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 relative animate-scale-up border border-slate-100">
                <button
                    onClick={() => setShowForgotModal(false)}
                    className="absolute top-4 right-4 text-slate-400 hover:text-red-500 p-1 bg-slate-50 rounded-full transition-colors"
                >
                    <X size={20} />
                </button>

                <div className="text-center mb-6 pt-2">
                    <div className="w-16 h-16 bg-teal-50 border border-teal-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-teal-600 shadow-sm transform rotate-3">
                        <HelpCircle size={32} />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Lupa Akses Login?</h3>
                    <p className="text-xs text-slate-500 mt-2 font-medium leading-relaxed px-4">
                        Untuk keamanan, reset password dilakukan melalui verifikasi manual. Silahkan hubungi Admin Desa:
                    </p>
                </div>

                <div className="space-y-3">
                    <a
                        href={`mailto:${settings.villageEmail || 'desaserang.kec.ciksel@gmail.com'}?subject=Permohonan Reset Password PRISMADES Serang&body=Halo Admin, saya mengalami kendala login pada aplikasi PRISMADES Serang. Mohon bantuannya.`}
                        className="flex items-center p-4 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 hover:border-slate-300 transition-all group shadow-sm hover:shadow-md"
                    >
                        <div className="bg-red-50 p-2.5 rounded-xl mr-4 text-red-500 group-hover:scale-110 transition-transform">
                            <Mail size={22} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kirim Email Ke</span>
                            <span className="text-xs font-bold text-slate-800 break-all">{settings.villageEmail || 'desaserang.kec.ciksel@gmail.com'}</span>
                        </div>
                    </a>

                    <a
                        href={getWhatsappLink()}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center p-4 bg-white border border-green-200 rounded-2xl hover:bg-green-50 hover:border-green-300 transition-all group shadow-sm hover:shadow-md"
                    >
                        <div className="bg-green-50 p-2.5 rounded-xl mr-4 text-green-600 group-hover:scale-110 transition-transform">
                            <MessageCircle size={22} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-green-600/70 uppercase tracking-wider">Chat WhatsApp</span>
                            <span className="text-sm font-bold text-green-800">{settings.villageWhatsapp || '0822-1756-1626'}</span>
                        </div>
                    </a>
                </div>
                
                <div className="mt-6 text-center bg-slate-50 p-3 rounded-xl">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                        Tim IT akan merespon segera
                    </p>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
