import React, { useState } from 'react';
import { ChevronDown, LogOut, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const NewLandingPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [openDropdown, setOpenDropdown] = useState(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNavigate = (path) => {
    navigate(path);
    setOpenDropdown(null);
  };

  return (
    <div className="relative w-full min-h-screen bg-gradient-to-br from-sky-950 via-slate-900 to-sky-950 overflow-hidden">
      {/* Decorative vertical lines */}
      <div className="absolute left-[30%] top-0 w-0.5 h-full bg-gradient-to-b from-zinc-500 to-transparent opacity-20"></div>
      <div className="absolute left-[70%] top-0 w-0.5 h-full bg-gradient-to-b from-zinc-500 to-transparent opacity-20"></div>

      {/* Header Navigation */}
      <header className="relative z-50 max-w-7xl mx-auto px-6 py-8 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h1 className="text-white text-4xl font-bold tracking-wider">Idii</h1>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/profile')}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Profile"
          >
            <Settings size={20} className="text-white" />
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors text-sm font-medium"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="relative z-10 h-[calc(100vh-200px)] flex items-center">
        <div className="max-w-7xl mx-auto w-full px-6">
          <div className="grid grid-cols-3 gap-16 items-end">
            
            {/* Column 1: Empower */}
            <div className="mt-48">
              <div>
                <h1 className="text-7xl font-bold text-cyan-600 leading-none mb-8">
                  Empower
                </h1>
                <p className="text-lg font-semibold text-white leading-relaxed max-w-sm">
                  Shifting information into decisive action
                  on your terms
                </p>
              </div>

              <div className="space-y-4">
                <button
                  onClick={() => setOpenDropdown(openDropdown === 'empower' ? null : 'empower')}
                  className="w-full flex items-center justify-start gap-2 text-cyan-600 hover:text-cyan-400 transition-colors font-semibold group"
                >
                  <span>Explore</span>
                  <ChevronDown
                    size={24}
                    className={`transition-transform duration-300 ${
                      openDropdown === 'empower' ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                
                {openDropdown === 'empower' && (
                  <div className="space-y-2 pt-4 bg-cyan-600/10 rounded-lg p-4 backdrop-blur-sm">
                    <button
                      onClick={() => handleNavigate('/agents/career')}
                      className="block w-full text-left px-4 py-2 text-white hover:bg-cyan-600/30 rounded transition-colors font-medium"
 >
                  Career
                </button>
                  </div>
                )}
              </div>
            </div>

            {/* Column 2: Produce */}
            <div className="space-y-12 -translate-y-32">
              <div className="text-center">
                <h2 className="text-7xl font-bold text-pink-600 leading-none mb-6">
                  Pro
                </h2>
                <p className="text-white text-lg font-light">Production</p>
              </div>

              <div className="space-y-4 -translate-y-12">
                <button
                  onClick={() => setOpenDropdown(openDropdown === 'produce' ? null : 'produce')}
                  className="w-full flex items-center justify-center gap-2 text-pink-600 hover:text-pink-400 transition-colors font-semibold group"
                >
                  <span>Explore</span>
                  <ChevronDown
                    size={24}
                    className={`transition-transform duration-300 ${
                      openDropdown === 'produce' ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                
                {openDropdown === 'produce' && (
                  <div className="space-y-2 pt-4 bg-pink-600/10 rounded-lg p-4 backdrop-blur-sm">
                    <button
                      onClick={() => handleNavigate('/agents/career')}
                      className="block w-full text-left px-4 py-2 text-white hover:bg-pink-600/30 rounded transition-colors font-medium"
                    >
                      Work
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Column 3: Thrive */}
            <div className="mt-48 text-center">
              <div>
                <h2 className="text-7xl font-bold text-orange-500 leading-none mb-6">
                  Thr
                </h2>
                <p className="text-white text-lg font-light mr-10">Thrive</p>
              </div>

              <div className="space-y-4">
                <button
                  onClick={() => setOpenDropdown(openDropdown === 'thrive' ? null : 'thrive')}
                  className="w-full flex items-center justify-center gap-2 text-orange-500 hover:text-orange-400 transition-colors font-semibold group"
                >
                  <span>Explore</span>
                  <ChevronDown
                    size={24}
                    className={`transition-transform duration-300 ${
                      openDropdown === 'thrive' ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                
                {openDropdown === 'thrive' && (
                  <div className="space-y-2 pt-4 bg-orange-500/10 rounded-lg p-4 backdrop-blur-sm text-left">
                    <button
                      onClick={() => handleNavigate('/agents/body')}
                      className="block w-full px-4 py-2 text-white hover:bg-orange-500/30 rounded transition-colors font-medium"
                    >
                      Wellness
                    </button>
                    <button
                      onClick={() => handleNavigate('/agents/travel')}
                      className="block w-full px-4 py-2 text-white hover:bg-orange-500/30 rounded transition-colors font-medium"
                    >
                      Travel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Branding */}
      <footer className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        <div className="flex justify-between items-end text-white text-xs opacity-50">
          <div>
            <p className="text-6xl font-bold leading-none">Idii.</p>
          </div>
          <div className="flex gap-6 text-sm">
            <button className="hover:opacity-100 transition-opacity">Privacy</button>
            <button className="hover:opacity-100 transition-opacity">Terms</button>
            <button className="hover:opacity-100 transition-opacity">Contact</button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default NewLandingPage;
