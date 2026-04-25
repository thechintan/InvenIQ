import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Menu, Bell, Moon, Sun } from 'lucide-react';
import { useState, useEffect } from 'react';
import api from '../api/axios';

const pageTitles = {
  '/dashboard':    'Dashboard',
  '/warehouses':   'Warehouses',
  '/products':     'Products',
  '/categories':   'Categories',
  '/suppliers':    'Suppliers',
  '/inventory':    'Inventory',
  '/transactions': 'Transactions',
  '/orders':       'Orders',
  '/returns':      'Returns',
  '/transfers':    'Transfers',
  '/alerts':       'Alerts',
  '/agents':       'AI Agents',
  '/reports':      'AI Assistant',
  '/users':        'User Management',
  '/settings':     'Settings',
};

export default function TopBar({ onMenuClick }) {
  const location = useLocation();
  const { user } = useAuth();
  const [alertCount, setAlertCount] = useState(0);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') ||
             localStorage.getItem('theme') === 'dark';
    }
    return false;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  useEffect(() => {
    api.get('/alerts?is_resolved=false&limit=1')
      .then(res => setAlertCount(parseInt(res.data?.stats?.unresolved_count || 0)))
      .catch(() => {});
  }, [location.pathname]);

  const currentTitle = pageTitles[location.pathname] ||
    (location.pathname.startsWith('/warehouses/') ? 'Warehouse Detail' :
     location.pathname.startsWith('/products/')   ? 'Product Detail'   :
     location.pathname.startsWith('/orders/')     ? 'Order Detail'     : 'InvenIQ');

  return (
    <header className="h-16 bg-white dark:bg-[#111827] border-b border-slate-200 dark:border-[#1e2535] flex items-center justify-between px-4 lg:px-6 flex-shrink-0 transition-colors duration-200">
      <div className="flex items-center gap-4">
        <button onClick={onMenuClick}
          className="lg:hidden p-2 rounded-xl text-slate-500 dark:text-[#8b9ab5] hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1e2535] transition-colors">
          <Menu className="w-5 h-5" />
        </button>
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">{currentTitle}</h2>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Dark mode toggle */}
        <button
          onClick={() => setIsDark(!isDark)}
          className="p-2 rounded-xl text-slate-500 dark:text-[#8b9ab5] hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1e2535] transition-colors"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark
            ? <Sun className="w-[18px] h-[18px]" />
            : <Moon className="w-[18px] h-[18px]" />}
        </button>

        {/* Alert bell */}
        <a href="/alerts"
          className="relative p-2 rounded-xl text-slate-500 dark:text-[#8b9ab5] hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1e2535] transition-colors">
          <Bell className="w-[18px] h-[18px]" />
          {alertCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-[#111827]" />
          )}
        </a>

        {/* Divider */}
        <div className="w-px h-6 bg-slate-200 dark:bg-[#1e2535] mx-1" />

        {/* User */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-100 to-accent-100 dark:from-primary-500/20 dark:to-accent-500/20 border border-primary-200 dark:border-primary-500/20 flex items-center justify-center">
            <span className="text-xs font-bold text-primary-600 dark:text-primary-400">{user?.name?.charAt(0)?.toUpperCase()}</span>
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 leading-tight">{user?.name}</p>
            <p className="text-[11px] text-slate-400 dark:text-[#4a5a7a] capitalize">{user?.role}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
