import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Warehouse, Package, FolderOpen, Truck, ClipboardList, ArrowLeftRight,
  RotateCcw, Bell, Users, Settings, LogOut, ChevronLeft, ChevronRight,
  Bot, X, Boxes, Cpu
} from 'lucide-react';

const navSections = [
  {
    title: 'MAIN',
    items: [
      { to: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard'   },
      { to: '/warehouses',   icon: Warehouse,       label: 'Warehouses'  },
      { to: '/products',     icon: Package,         label: 'Products'    },
      { to: '/categories',   icon: FolderOpen,      label: 'Categories'  },
      { to: '/suppliers',    icon: Truck,           label: 'Suppliers'   },
    ],
  },
  {
    title: 'OPERATIONS',
    items: [
      { to: '/inventory',    icon: Boxes,           label: 'Inventory'    },
      { to: '/transactions', icon: ArrowLeftRight,  label: 'Transactions' },
      { to: '/orders',       icon: ClipboardList,   label: 'Orders'       },
      { to: '/returns',      icon: RotateCcw,       label: 'Returns'      },
      { to: '/transfers',    icon: ArrowLeftRight,  label: 'Transfers'    },
    ],
  },
  {
    title: 'INTELLIGENCE',
    items: [
      { to: '/alerts',  icon: Bell, label: 'Alerts'       },
      { to: '/agents',  icon: Cpu,  label: 'AI Agents'    },
      { to: '/reports', icon: Bot,  label: 'AI Assistant' },
    ],
  },
  {
    title: 'ADMIN',
    adminOnly: true,
    items: [
      { to: '/users',    icon: Users,    label: 'Users',    adminOnly: true },
      { to: '/settings', icon: Settings, label: 'Settings', adminOnly: true },
    ],
  },
];

export default function Sidebar({ isOpen, mobileOpen, onToggle, onMobileClose }) {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();

  return (
    <aside className={`
      fixed lg:relative inset-y-0 left-0 z-50
      ${isOpen ? 'w-64' : 'w-[72px]'}
      ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      bg-white dark:bg-[#111827] border-r border-slate-200 dark:border-[#1e2535] flex flex-col
      transition-all duration-300 ease-in-out shadow-sm dark:shadow-none
    `}>
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100 dark:border-[#1e2535] flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-primary-500/20">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          </div>
          {isOpen && (
            <div className="slide-in min-w-0">
              <h1 className="text-base font-bold text-slate-800 dark:text-slate-100 truncate">InvenIQ</h1>
              <p className="text-[10px] text-slate-400 dark:text-[#4a5a7a] tracking-widest uppercase">Inventory AI</p>
            </div>
          )}
        </div>
        <button onClick={onMobileClose} className="lg:hidden p-1 text-slate-400 hover:text-slate-600 dark:text-[#4a5a7a] dark:hover:text-slate-300 transition-colors">
          <X className="w-5 h-5" />
        </button>
        <button onClick={onToggle}
          className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:text-[#4a5a7a] dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1e2535] transition-colors">
          {isOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2.5 space-y-5">
        {navSections.map((section) => {
          if (section.adminOnly && !isAdmin()) return null;
          return (
            <div key={section.title}>
              {isOpen && (
                <p className="px-3 mb-2 text-[10px] font-bold text-slate-400 dark:text-[#3a4a6a] tracking-widest uppercase">
                  {section.title}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  if (item.adminOnly && !isAdmin()) return null;
                  const isActive = location.pathname === item.to ||
                    (item.to !== '/dashboard' && location.pathname.startsWith(item.to));
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={onMobileClose}
                      className={`
                        flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                        transition-all duration-150 group relative
                        ${isActive
                          ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-300'
                          : 'text-slate-600 dark:text-[#8b9ab5] hover:bg-slate-100 dark:hover:bg-[#1e2535] hover:text-slate-800 dark:hover:text-slate-200'
                        }
                      `}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary-500 dark:bg-primary-400 rounded-r-full" />
                      )}
                      <item.icon className={`w-[18px] h-[18px] flex-shrink-0 transition-colors
                        ${isActive ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400 dark:text-[#4a5a7a] group-hover:text-slate-600 dark:group-hover:text-slate-300'}`} />
                      {isOpen && <span className="truncate">{item.label}</span>}
                      {!isOpen && (
                        <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-800 dark:bg-[#1e2535] text-white text-xs rounded-lg
                                       opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all
                                       whitespace-nowrap z-50 shadow-xl border border-slate-700 dark:border-[#2a3347]">
                          {item.label}
                        </div>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-slate-100 dark:border-[#1e2535] p-3 flex-shrink-0">
        <div className={`flex items-center gap-3 ${isOpen ? '' : 'justify-center'}`}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-100 to-accent-100 dark:from-primary-500/20 dark:to-accent-500/20 border border-primary-200 dark:border-primary-500/20 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>
          {isOpen && (
            <div className="flex-1 min-w-0 slide-in">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 dark:text-[#4a5a7a] capitalize">{user?.role}</p>
            </div>
          )}
          {isOpen && (
            <button onClick={logout}
              className="p-1.5 rounded-lg text-slate-400 dark:text-[#4a5a7a] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              title="Logout">
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
