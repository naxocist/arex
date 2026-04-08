import React from 'react';
import { motion } from 'motion/react';
import { 
  CheckCircle2, 
  Truck, 
  MapPin, 
  Plus, 
  Minus, 
  Navigation,
  Search,
  Wheat,
  TreeDeciduous,
  Leaf
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { x: -20, opacity: 0 },
  visible: { x: 0, opacity: 1 }
};

const jobs = [
  { id: 1, type: 'ตอซังข้าวโพด', amount: '12 ตัน', price: '฿4,200', from: 'อ.แม่แจ่ม, เชียงใหม่', dist: '45 กม.', icon: Wheat, color: 'bg-amber-100 text-amber-700' },
  { id: 2, type: 'เศษไม้สับ', amount: '8 ตัน', price: '฿2,850', from: 'อ.หางดง, เชียงใหม่', dist: '18 กม.', icon: TreeDeciduous, color: 'bg-emerald-100 text-emerald-700' },
  { id: 3, type: 'ชานอ้อย', amount: '15 ตัน', price: '฿5,600', from: 'อ.ดอยสะเก็ด, เชียงใหม่', dist: '32 กม.', icon: Leaf, color: 'bg-sky-100 text-sky-700' },
];

export default function LogisticsTracking() {
  return (
    <motion.div 
      className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-8 overflow-hidden"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Map Section */}
      <div className="flex-1 relative rounded-3xl overflow-hidden bg-surface-container-low border border-outline-variant/10 shadow-inner">
        {/* Stylized Map Background */}
        <div className="absolute inset-0 grayscale opacity-40 mix-blend-multiply pointer-events-none">
          <img 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAmSVdLvvV1p2xjwtvjk93YrIxRylddWvwGm6w5B9KKuhIa20RrtsOG-dJTqoR_RoZ4e7Z6iv1L0qjiAa5cdq3Hnbpeszr0nYUGZd7v-vGfJZW7F2MeByactdr8cLItqMXiuJ3fiW_kIN1x3RN_hks3Wy28oWPzipAPE5NyzqUryn6MQqcqe_zE6k6gmKb97viCTcyhYE1mhhb0_wPxxXFNel7_wIUd2v7gVCnf3Z5XmTrKnlbmUMpiVECY6ZT0cui4x2EVSkKQ_vc" 
            alt="Map pattern" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Route Overlay */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1000 1000">
          <motion.path 
            d="M200 400 Q400 350 600 500 T900 450" 
            fill="none" 
            stroke="#2d6a4f" 
            strokeWidth="4" 
            strokeDasharray="10 6"
            className="opacity-60"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2, ease: "easeInOut" }}
          />
          <circle cx="200" cy="400" r="8" fill="#0f5238" />
          <circle cx="900" cy="450" r="8" fill="#ba1a1a" />
          
          {/* Moving Truck Icon Placeholder */}
          <motion.g
            initial={{ offset: 0 }}
            animate={{ offset: 1 }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          >
            <circle cx="550" cy="460" r="6" fill="#0f5238" className="animate-pulse" />
            <circle cx="550" cy="460" r="12" fill="none" stroke="#0f5238" strokeWidth="2" className="animate-ping" />
          </motion.g>
        </svg>

        {/* Map Controls */}
        <div className="absolute bottom-8 right-8 flex flex-col gap-3">
          <button className="w-12 h-12 bg-white rounded-full shadow-xl flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-all">
            <Plus className="w-5 h-5" />
          </button>
          <button className="w-12 h-12 bg-white rounded-full shadow-xl flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-all">
            <Minus className="w-5 h-5" />
          </button>
          <button className="w-12 h-12 bg-primary rounded-full shadow-xl flex items-center justify-center text-white hover:bg-primary-container transition-all">
            <Navigation className="w-5 h-5" />
          </button>
        </div>

        {/* Status Card Overlay */}
        <motion.div 
          className="absolute top-8 left-8 w-80"
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <div className="bg-white/90 backdrop-blur-md p-6 rounded-3xl shadow-2xl border border-white/20">
            <div className="flex justify-between items-start mb-4">
              <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider">กำลังดำเนินการ</span>
              <span className="text-xs text-on-surface-variant">ID: #TRK-8829</span>
            </div>
            <h3 className="text-xl font-medium text-primary mb-1">รับเศษวัสดุชีวมวล</h3>
            <p className="text-sm text-on-surface-variant mb-6">ต้นทาง: สหกรณ์การเกษตรแม่ริม</p>
            
            <div className="relative space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-outline-variant/30">
              <div className="flex items-center gap-4 relative">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center z-10">
                  <CheckCircle2 className="w-3 h-3 text-white fill-current" />
                </div>
                <div>
                  <p className="text-sm font-medium text-on-surface">รับงานแล้ว</p>
                  <p className="text-[11px] text-on-surface-variant">08:30 น. • 12 ต.ค. 66</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 relative">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center z-10 border-4 border-white">
                  <Truck className="w-3 h-3 text-white fill-current" />
                </div>
                <div>
                  <p className="text-sm font-medium text-primary">ระหว่างทาง</p>
                  <p className="text-[11px] text-on-surface-variant italic">ห่างจากจุดหมาย 12.4 กม.</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 relative opacity-40">
                <div className="w-6 h-6 rounded-full bg-surface-container-highest flex items-center justify-center z-10 border-4 border-white"></div>
                <div>
                  <p className="text-sm font-medium text-on-surface">ถึงจุดหมาย</p>
                  <p className="text-[11px] text-on-surface-variant">ประมาณการ 11:45 น.</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Side Panel: Available Jobs */}
      <aside className="w-full lg:w-[400px] flex flex-col gap-6 overflow-y-auto no-scrollbar">
        <div className="px-2">
          <h2 className="text-2xl font-light tracking-tight text-on-surface">งานที่พร้อมรับ</h2>
          <p className="text-sm text-on-surface-variant mt-1">คัดกรองตามตำแหน่งปัจจุบันของคุณ</p>
        </div>

        <div className="space-y-4">
          {jobs.map((job) => (
            <motion.div 
              key={job.id}
              className="p-5 bg-white rounded-2xl border border-outline-variant/10 group hover:bg-surface-container-low transition-all cursor-pointer shadow-sm"
              variants={itemVariants}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", job.color)}>
                    <job.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-medium text-on-surface">{job.type}</h4>
                    <p className="text-xs text-on-surface-variant">ปริมาณ: {job.amount}</p>
                  </div>
                </div>
                <span className="text-primary font-semibold text-lg">{job.price}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
                <div className="flex flex-col gap-1">
                  <span className="text-on-surface-variant uppercase tracking-widest text-[9px]">ต้นทาง</span>
                  <span className="font-medium text-on-surface truncate">{job.from}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-on-surface-variant uppercase tracking-widest text-[9px]">ระยะทาง</span>
                  <span className="font-medium text-on-surface">{job.dist}</span>
                </div>
              </div>
              
              <button className="w-full py-2.5 rounded-full bg-surface-container-low text-primary font-medium text-sm border border-primary/10 group-hover:bg-primary group-hover:text-white transition-all active:scale-[0.98]">
                รับงาน
              </button>
            </motion.div>
          ))}
        </div>
      </aside>
    </motion.div>
  );
}
