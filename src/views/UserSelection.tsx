import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  BarChart3, 
  Truck, 
  Factory, 
  PackageCheck,
  Leaf,
} from 'lucide-react';
import { useUser, UserRole } from '../contexts/UserContext';
import { ApiError, authApi, setAuthSession } from '@/src/lib/apiClient';

const roles: { id: UserRole, name: string, role: string, icon: any, color: string, desc: string }[] = [
  { 
    id: 'farmer', 
    name: 'คุณสมชาย', 
    role: 'เกษตรกร', 
    icon: User, 
    color: 'bg-emerald-100 text-emerald-700',
    desc: 'แจ้งส่งวัสดุ ติดตามสถานะ และแลกรับรางวัล'
  },
  { 
    id: 'executive', 
    name: 'ผู้บริหาร AREX', 
    role: 'ผู้บริหาร', 
    icon: BarChart3, 
    color: 'bg-blue-100 text-blue-700',
    desc: 'ติดตามภาพรวมสถานะงานและตัวชี้วัดการดำเนินงาน'
  },
  { 
    id: 'logistics', 
    name: 'พนักงานขับรถ', 
    role: 'ฝ่ายขนส่ง', 
    icon: Truck, 
    color: 'bg-amber-100 text-amber-700',
    desc: 'จัดคิวรับวัสดุ ส่งถึงโรงงาน และส่งมอบรางวัล'
  },
  { 
    id: 'factory', 
    name: 'ผู้จัดการโรงงาน', 
    role: 'ฝ่ายโรงงาน', 
    icon: Factory, 
    color: 'bg-purple-100 text-purple-700',
    desc: 'บันทึกน้ำหนักจริงและยืนยันรับเข้าเพื่อเครดิต PMUC Coin'
  },
  {
    id: 'warehouse',
    name: 'เจ้าหน้าที่คลังสินค้า',
    role: 'ฝ่ายคลังสินค้า',
    icon: PackageCheck,
    color: 'bg-teal-100 text-teal-700',
    desc: 'ตรวจสอบคำขอแลกรางวัล อนุมัติหรือปฏิเสธตามกติกา'
  },
];

export default function UserSelection() {
  const navigate = useNavigate();
  const { setRole } = useUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginMessage, setLoginMessage] = useState<string | null>(null);

  const rolePathMap = useMemo<Record<UserRole, string>>(
    () => ({
      farmer: '/',
      executive: '/dashboard',
      logistics: '/logistics',
      factory: '/factory',
      warehouse: '/warehouse',
    }),
    [],
  );

  const handleApiLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoggingIn(true);
    setLoginMessage(null);

    try {
      const login = await authApi.login({ email, password });
      setAuthSession({
        accessToken: login.access_token,
        refreshToken: login.refresh_token,
        role: login.user.role,
      });

      const role = login.user.role;
      if (role === 'farmer' || role === 'executive' || role === 'logistics' || role === 'factory' || role === 'warehouse') {
        setRole(role);
        navigate(rolePathMap[role]);
        return;
      }

      setLoginMessage('เข้าสู่ระบบสำเร็จ แต่บทบาทนี้ยังไม่มีหน้าใช้งานในระบบ');
    } catch (error) {
      if (error instanceof ApiError) {
        setLoginMessage(`เข้าสู่ระบบไม่สำเร็จ: ${error.message}`);
      } else {
        setLoginMessage('เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="max-w-5xl w-full space-y-8">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 primary-gradient rounded-2xl text-white mx-auto">
            <Leaf className="w-7 h-7 fill-current" />
          </div>
          <h1 className="text-3xl md:text-4xl font-light tracking-tight text-primary">
            ยินดีต้อนรับสู่ AREX Platform
          </h1>
          <p className="text-on-surface-variant text-base md:text-lg">
            ล็อกอินด้วยบัญชีของแต่ละบทบาทเพื่อใช้งานระบบจริงตามลำดับงาน AREX
          </p>
        </div>

        <form
          onSubmit={handleApiLogin}
          className="bg-white border border-outline-variant/20 rounded-2xl p-5 md:p-6 space-y-4 max-w-xl w-full mx-auto"
        >
          <div>
            <h2 className="text-lg font-medium text-on-surface">เข้าสู่ระบบ</h2>
            <p className="text-sm text-on-surface-variant">ระบบจะนำไปยังหน้าของบทบาทที่ล็อกอินสำเร็จโดยอัตโนมัติ</p>
          </div>
          <div className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="email"
              className="w-full bg-surface-container-high border-none rounded-lg p-3 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all outline-none"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="password"
              className="w-full bg-surface-container-high border-none rounded-lg p-3 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all outline-none"
              required
            />
          </div>
          {loginMessage && (
            <p className="text-sm text-on-surface-variant bg-surface-container-high rounded-lg px-3 py-2">{loginMessage}</p>
          )}
          <div className="pt-1">
            <button
              type="submit"
              disabled={isLoggingIn}
              className="primary-gradient text-white px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoggingIn ? 'กำลังเชื่อมต่อ...' : 'เข้าสู่ระบบ'}
            </button>
          </div>
        </form>

        <section className="bg-white border border-outline-variant/20 rounded-2xl p-5 md:p-6 space-y-3">
          <h2 className="text-lg font-medium text-on-surface">ลำดับการใช้งานหลัก</h2>
          <ol className="list-decimal pl-5 text-sm text-on-surface-variant space-y-1">
            <li>เกษตรกรแจ้งวัสดุ และยื่นคำขอแลกรางวัล</li>
            <li>ขนส่งจัดคิวและส่งวัสดุถึงโรงงาน</li>
            <li>โรงงานยืนยันรับเข้าเพื่อเครดิต PMUC Coin</li>
            <li>คลังสินค้าอนุมัติหรือปฏิเสธคำขอแลกรางวัล</li>
            <li>ขนส่งดำเนินการส่งมอบของรางวัล</li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-on-surface">บทบาทในระบบ</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {roles.map((role) => (
              <div key={role.id} className="bg-white p-5 rounded-2xl border border-outline-variant/20 text-left flex items-center gap-4">
                <div className={`${role.color} w-12 h-12 rounded-xl flex items-center justify-center shrink-0`}>
                <role.icon className="w-8 h-8" />
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-medium text-on-surface">{role.role}</h3>
                  <span className="text-[10px] font-bold uppercase tracking-widest bg-surface-container-high px-2 py-0.5 rounded text-on-surface-variant">
                    {role.name}
                  </span>
                </div>
                <p className="text-sm text-on-surface-variant line-clamp-2">{role.desc}</p>
              </div>
              </div>
            ))}
          </div>
        </section>

        <div className="pt-2">
          <p className="text-xs text-on-surface-variant text-center">© 2026 บพข. และ LAWDEE CO., LTD • Development: CEDT</p>
        </div>
      </div>
    </div>
  );
}
