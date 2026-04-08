import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, 
  FileText, 
  Truck, 
  Factory, 
  BarChart3, 
  Settings, 
  Headset, 
  LogOut,
  Leaf,
  PlusCircle,
  UserCircle
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useUser } from '../contexts/UserContext';

const navItems = [
  { icon: Home, label: 'หน้าหลัก', path: '/', roles: ['farmer'] },
  { icon: FileText, label: 'รายการประกาศ', path: '/announcements', roles: ['farmer'] },
  { icon: Truck, label: 'การขนส่ง', path: '/logistics', roles: ['logistics'] },
  { icon: Factory, label: 'โรงงาน', path: '/factory', roles: ['factory'] },
  { icon: BarChart3, label: 'รายงานสรุป', path: '/dashboard', roles: ['executive'] },
  { icon: Settings, label: 'ตั้งค่า', path: '/settings', roles: ['farmer', 'executive', 'logistics', 'factory'] },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { role, logout } = useUser();

  const filteredNavItems = navItems.filter(item => item.roles.includes(role || ''));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="hidden md:flex flex-col fixed left-0 top-0 h-screen w-64 p-4 gap-2 bg-stone-50 border-r-0 z-40">
      <div className="flex flex-col gap-3 mb-8 px-2 py-4">
        {/* AREX Logo — badge = บพข (pmuc_logo) ถูกต้อง */}
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-xl primary-gradient flex items-center justify-center text-white shadow-lg">
              <Leaf className="w-6 h-6 fill-current" />
            </div>
            <div className="absolute -bottom-2 -right-2 w-6 h-6 rounded-full bg-white border border-stone-200 shadow-md flex items-center justify-center overflow-hidden p-0.5">
              <img
                src="/assets/pmuc_logo.png"
                alt="บพข Logo"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
          <div className="pt-0.5">
            <h1 className="text-xl font-medium text-emerald-900 leading-tight">AREX Platform</h1>
            <p className="text-[10px] text-stone-500 font-medium tracking-wider uppercase">ระบบบริหารจัดการวัสดุเหลือใช้</p>
            <p className="text-[9px] text-stone-400 font-medium mt-0.5">ภายใต้ บพข. (อว.)</p>
          </div>
        </div>

      </div>

      <nav className="flex-1 flex flex-col gap-1">
        {filteredNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 hover:translate-x-1",
              isActive 
                ? "bg-emerald-100 text-emerald-900 font-medium" 
                : "text-stone-600 hover:bg-stone-200/50"
            )}
          >
            <item.icon className={cn("w-5 h-5", location.pathname === item.path && "fill-current")} />
            <span className="text-sm">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-1 pt-4 border-t border-stone-200">
        {role === 'farmer' && (
          <button className="w-full primary-gradient text-white py-3 rounded-xl font-medium text-sm mb-4 shadow-md active:opacity-80 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
            <PlusCircle className="w-4 h-4" />
            เพิ่มรายการประกาศ
          </button>
        )}
        
        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
        >
          <UserCircle className="w-5 h-5" />
          <span className="text-sm">สลับผู้ใช้งาน (Demo)</span>
        </button>
        
        <a href="#" className="flex items-center gap-3 px-4 py-3 text-stone-600 hover:bg-stone-200/50 rounded-xl transition-all">
          <Headset className="w-5 h-5" />
          <span className="text-sm">ติดต่อเจ้าหน้าที่</span>
        </a>
        
        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 text-tertiary hover:bg-red-50 rounded-xl transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm">ออกจากระบบ</span>
        </button>
      </div>
    </aside>
  );
}
