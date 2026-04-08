import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  User, 
  BarChart3, 
  Truck, 
  Factory, 
  Leaf,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useUser, UserRole } from '../contexts/UserContext';

const roles: { id: UserRole, name: string, role: string, path: string, icon: any, color: string, desc: string }[] = [
  { 
    id: 'farmer', 
    name: 'คุณสมชาย', 
    role: 'เกษตรกร', 
    path: '/', 
    icon: User, 
    color: 'bg-emerald-100 text-emerald-700',
    desc: 'แจ้งส่งวัสดุ ติดตามสถานะ และแลกรับรางวัล'
  },
  { 
    id: 'executive', 
    name: 'ผู้บริหาร AREX', 
    role: 'ผู้บริหาร', 
    path: '/dashboard', 
    icon: BarChart3, 
    color: 'bg-blue-100 text-blue-700',
    desc: 'ดูภาพรวมโครงการ KPI และรายงานสรุปรายภูมิภาค'
  },
  { 
    id: 'logistics', 
    name: 'พนักงานขับรถ', 
    role: 'ฝ่ายขนส่ง', 
    path: '/logistics', 
    icon: Truck, 
    color: 'bg-amber-100 text-amber-700',
    desc: 'รับงานขนส่ง ติดตามเส้นทาง และนำทาง GPS'
  },
  { 
    id: 'factory', 
    name: 'ผู้จัดการโรงงาน', 
    role: 'ฝ่ายโรงงาน', 
    path: '/factory', 
    icon: Factory, 
    color: 'bg-purple-100 text-purple-700',
    desc: 'บริหารจัดการคิวรถ บันทึกน้ำหนัก และสรุปยอดรับเข้า'
  },
];

export default function UserSelection() {
  const navigate = useNavigate();
  const { setRole } = useUser();

  const handleSelectRole = (roleId: UserRole, path: string) => {
    setRole(roleId);
    navigate(path);
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="max-w-4xl w-full space-y-12">
        <div className="text-center space-y-4">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center gap-5 mb-4"
          >
            {/* AREX Logo — badge คือ บพข (pmuc) ไม่ใช่ อว. */}
            <div className="relative">
              <div className="inline-flex items-center justify-center w-16 h-16 primary-gradient rounded-2xl text-white shadow-xl">
                <Leaf className="w-8 h-8 fill-current" />
              </div>
              <div className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-white border border-stone-200 shadow-md flex items-center justify-center overflow-hidden p-0.5">
                <img
                  src="/assets/pmuc_logo.png"
                  alt="บพข Logo"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            {/* เจ้าของระบบ */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-[9px] font-bold text-stone-400 uppercase tracking-[0.2em]">เจ้าของระบบ</span>
              <div className="flex items-center gap-3 px-4 py-2.5 bg-white rounded-xl border border-outline-variant/20 shadow-sm">
                {/* บพข */}
                <img
                  src="/assets/pmuc_logo.png"
                  alt="บพข (PMUC) Logo"
                  className="h-7 object-contain"
                />
                <div className="text-left">
                  <p className="text-[10px] font-bold text-stone-700 leading-tight">บพข.</p>
                  <p className="text-[8px] text-stone-400 leading-tight">ภายใต้ อว.</p>
                </div>
                <div className="w-px h-6 bg-stone-200" />
                {/* อว badge เล็กๆ แสดง hierarchy */}
                <img
                  src="/assets/อว_logo.png"
                  alt="อว. Logo"
                  className="h-5 object-contain opacity-60"
                />
                <div className="w-px h-6 bg-stone-200" />
                {/* LAWDEE */}
                <div className="text-left">
                  <p className="text-[10px] font-bold text-stone-700 leading-tight">LAWDEE CO., LTD.</p>
                  <p className="text-[8px] text-stone-400 leading-tight">ผู้ร่วมพัฒนาระบบ</p>
                </div>
              </div>
            </div>

            {/* พัฒนาโดย CEDT */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-[9px] font-bold text-stone-400 uppercase tracking-[0.2em]">พัฒนาโดย</span>
              <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-outline-variant/20 shadow-sm">
                <img
                  src="/assets/cedt_logo.png"
                  alt="CEDT Logo"
                  className="h-7 object-contain"
                />
                <div className="text-left">
                  <p className="text-[10px] font-bold text-stone-700 leading-tight">CEDT</p>
                  <p className="text-[8px] text-stone-400 leading-tight">Chulalongkorn University</p>
                </div>
              </div>
            </div>
          </motion.div>
          <motion.h1 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-4xl font-light tracking-tight text-primary"
          >
            ยินดีต้อนรับสู่ AREX Platform
          </motion.h1>
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-on-surface-variant text-lg"
          >
            กรุณาเลือกบทบาทผู้ใช้งานเพื่อเข้าสู่ระบบจำลอง (Demo)
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {roles.map((role, idx) => (
            <motion.button
              key={role.id}
              initial={{ x: idx % 2 === 0 ? -20 : 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 + idx * 0.1 }}
              onClick={() => handleSelectRole(role.id, role.path)}
              className="group relative bg-white p-6 rounded-3xl border border-outline-variant/20 shadow-sm hover:shadow-xl hover:border-primary/30 transition-all text-left flex items-center gap-6 overflow-hidden"
            >
              <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110", role.color)}>
                <role.icon className="w-8 h-8" />
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-xl font-medium text-on-surface">{role.name}</h3>
                  <span className="text-[10px] font-bold uppercase tracking-widest bg-surface-container-high px-2 py-0.5 rounded text-on-surface-variant">
                    {role.role}
                  </span>
                </div>
                <p className="text-sm text-on-surface-variant line-clamp-2">{role.desc}</p>
              </div>

              <ChevronRight className="w-5 h-5 text-outline-variant group-hover:text-primary group-hover:translate-x-1 transition-all" />
              
              {/* Decorative background element */}
              <div className={cn("absolute -right-4 -bottom-4 w-24 h-24 opacity-[0.03] transition-transform group-hover:scale-150", role.color)}>
                <role.icon className="w-full h-full" />
              </div>
            </motion.button>
          ))}
        </div>

        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center text-xs text-on-surface-variant font-medium uppercase tracking-widest"
        >
          © 2025 AREX Platform • บพข. & LAWDEE CO., LTD. • พัฒนาโดย CEDT, จุฬาลงกรณ์มหาวิทยาลัย
        </motion.p>
      </div>
    </div>
  );
}
