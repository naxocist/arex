import React from 'react';
import { motion } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { 
  Factory, 
  CheckCircle, 
  Truck, 
  Search, 
  Filter, 
  ArrowRight, 
  Flag, 
  Scale, 
  Clock,
  Plus
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

const weeklyData = [
  { day: 'Mon', value: 12 },
  { day: 'Tue', value: 16 },
  { day: 'Wed', value: 20 },
  { day: 'Thu', value: 24, today: true },
  { day: 'Fri', value: 14 },
  { day: 'Sat', value: 10 },
  { day: 'Sun', value: 16 },
];

const intakeLog = [
  { time: '14:20', id: '70-1234 กทม.', type: 'กากใยอุตสาหกรรม (A)', weightIn: '12.50', weightOut: '12.48', status: 'Complete' },
  { time: '14:05', id: '82-5590 รังสิต', type: 'เปลือกปาล์มสกัด', weightIn: '28.00', weightOut: '29.15', status: 'Complete', alert: true },
  { time: '13:48', id: '10-8844 ฉะเชิงเทรา', type: 'วัสดุอินทรีย์ผสม', weightIn: '8.40', weightOut: '8.38', status: 'In Process' },
  { time: '13:30', id: '71-0021 นนทบุรี', type: 'กากใยอุตสาหกรรม (B)', weightIn: '15.00', weightOut: '15.02', status: 'Complete' },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1 }
};

export default function FactoryIntake() {
  return (
    <motion.div 
      className="space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Page Header */}
      <motion.div className="flex justify-between items-end" variants={itemVariants}>
        <div>
          <span className="text-xs font-semibold text-primary uppercase tracking-widest bg-emerald-100 px-2 py-0.5 rounded">INTAKE DASHBOARD</span>
          <h2 className="text-4xl font-light text-on-surface mt-2 tracking-tight">การรับเข้าโรงงาน</h2>
          <p className="text-on-surface-variant mt-1">ระบบติดตามวัสดุและบริหารจัดการคิวรถขนส่งแบบเรียลไทม์</p>
        </div>
        <button className="primary-gradient text-white px-6 py-2.5 rounded-full flex items-center gap-2 font-medium hover:opacity-90 transition-all shadow-lg shadow-primary/10">
          <Plus className="w-5 h-5" />
          <span>ลงทะเบียนรถใหม่</span>
        </button>
      </motion.div>

      {/* Bento Grid Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Metric 1 */}
        <motion.div className="bg-white p-8 rounded-xl border border-outline-variant/10 flex flex-col justify-between h-48 relative overflow-hidden group" variants={itemVariants}>
          <div className="z-10">
            <p className="text-sm font-medium text-on-surface-variant flex items-center gap-2">
              <Flag className="w-4 h-4 text-primary" />
              เป้าหมายการรับวันนี้
            </p>
            <h3 className="text-5xl font-light mt-4 tracking-tighter">1,200 <span className="text-lg font-normal text-on-surface-variant">ตัน</span></h3>
          </div>
          <div className="w-full h-1 bg-surface-container-high rounded-full overflow-hidden mt-6">
            <div className="w-3/4 h-full bg-primary"></div>
          </div>
          <Clock className="absolute -bottom-4 -right-4 w-32 h-32 opacity-[0.03] group-hover:scale-110 transition-transform" />
        </motion.div>

        {/* Metric 2 */}
        <motion.div className="bg-surface-container-low p-8 rounded-xl border border-outline-variant/10 flex flex-col justify-between h-48 relative overflow-hidden group" variants={itemVariants}>
          <div className="z-10">
            <p className="text-sm font-medium text-on-surface-variant flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              ปริมาณที่รับแล้ว
            </p>
            <h3 className="text-5xl font-light mt-4 tracking-tighter text-primary">845 <span className="text-lg font-normal text-on-surface-variant">ตัน</span></h3>
          </div>
          <p className="text-xs text-primary font-semibold uppercase tracking-wider mt-4">70% ของเป้าหมายทั้งหมด</p>
          <Scale className="absolute -bottom-4 -right-4 w-32 h-32 opacity-[0.03] group-hover:scale-110 transition-transform" />
        </motion.div>

        {/* Metric 3 */}
        <motion.div className="bg-white p-8 rounded-xl border border-outline-variant/10 flex flex-col justify-between h-48 relative overflow-hidden group" variants={itemVariants}>
          <div className="z-10">
            <p className="text-sm font-medium text-on-surface-variant flex items-center gap-2">
              <Truck className="w-4 h-4 text-tertiary" />
              รถที่รอคิว
            </p>
            <h3 className="text-5xl font-light mt-4 tracking-tighter">12 <span className="text-lg font-normal text-on-surface-variant">คัน</span></h3>
          </div>
          <div className="flex -space-x-2 mt-4 overflow-hidden">
            {[1, 2, 3].map((i) => (
              <img 
                key={i}
                src={`https://picsum.photos/seed/driver${i}/100/100`} 
                alt="Driver" 
                className="inline-block h-8 w-8 rounded-full ring-2 ring-white"
                referrerPolicy="no-referrer"
              />
            ))}
            <div className="h-8 w-8 rounded-full bg-secondary-container flex items-center justify-center text-[10px] font-bold text-secondary ring-2 ring-white">+9</div>
          </div>
          <Factory className="absolute -bottom-4 -right-4 w-32 h-32 opacity-[0.03] group-hover:scale-110 transition-transform" />
        </motion.div>
      </div>

      {/* Table Section */}
      <motion.section className="bg-white rounded-xl overflow-hidden shadow-sm border border-outline-variant/10" variants={itemVariants}>
        <div className="px-8 py-6 flex justify-between items-center border-b border-surface-container-high bg-white/50 backdrop-blur">
          <div>
            <h4 className="text-xl font-medium text-on-surface tracking-tight">บันทึกรายการวัสดุขาเข้า</h4>
            <p className="text-sm text-on-surface-variant">ข้อมูลเรียงลำดับตามเวลาล่าสุดของการชั่งน้ำหนัก</p>
          </div>
          <div className="flex gap-2">
            <div className="bg-surface-container-low px-4 py-2 rounded-full flex items-center gap-2">
              <Search className="w-4 h-4 text-on-surface-variant" />
              <input 
                type="text" 
                placeholder="ค้นหารหัสรถ..." 
                className="bg-transparent border-none focus:ring-0 text-sm w-40 outline-none"
              />
            </div>
            <button className="bg-surface-container-highest p-2 rounded-full hover:bg-surface-dim transition-colors">
              <Filter className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/50">
                <th className="px-8 py-4 text-xs font-semibold uppercase tracking-widest text-on-surface-variant">เวลา</th>
                <th className="px-8 py-4 text-xs font-semibold uppercase tracking-widest text-on-surface-variant">รหัสรถ</th>
                <th className="px-8 py-4 text-xs font-semibold uppercase tracking-widest text-on-surface-variant">ประเภทวัสดุ</th>
                <th className="px-8 py-4 text-xs font-semibold uppercase tracking-widest text-on-surface-variant text-right">น้ำหนักแจ้ง (ตัน)</th>
                <th className="px-8 py-4 text-xs font-semibold uppercase tracking-widest text-on-surface-variant text-right">น้ำหนักจริง (ตัน)</th>
                <th className="px-8 py-4 text-xs font-semibold uppercase tracking-widest text-on-surface-variant text-center">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high">
              {intakeLog.map((log, idx) => (
                <tr key={idx} className="hover:bg-surface-container-low/30 transition-colors">
                  <td className="px-8 py-5 text-sm font-medium">{log.time}</td>
                  <td className="px-8 py-5 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded bg-surface-container-high flex items-center justify-center">
                        <Truck className="w-4 h-4 text-on-surface-variant" />
                      </div>
                      <span className="font-semibold">{log.id}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-sm">{log.type}</td>
                  <td className="px-8 py-5 text-sm text-right font-light">{log.weightIn}</td>
                  <td className={cn("px-8 py-5 text-sm text-right font-semibold", log.alert && "text-tertiary")}>
                    {log.weightOut}
                  </td>
                  <td className="px-8 py-5 text-center">
                    <span className={cn(
                      "px-3 py-1 text-[10px] font-bold rounded-full uppercase",
                      log.status === 'Complete' ? "bg-emerald-100 text-emerald-800" : "bg-secondary-container text-secondary"
                    )}>
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="px-8 py-4 bg-surface-container-low/30 flex justify-center">
          <button className="text-sm font-semibold text-primary hover:underline flex items-center gap-1">
            ดูรายการทั้งหมด
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </motion.section>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <motion.div className="relative h-64 rounded-xl overflow-hidden group shadow-2xl" variants={itemVariants}>
          <img 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBenGYfGEw2eAkXwJAy7GScTwUzZ2Sp-N2Lrj7VI7xicxh8fd1AEsGousIdsIdPdMT67ZPGdOnnBPzZWjyTqJhpi5YP_ore39fPKpDMl_pHs-h5DBueIp7wokNrXpa_WiQvswVw4MpwUwAAeFxWsmgaOpz44LWDffyi6tLlwv2GU71iIBE9OA5lfzDdIQvv0Aefn0cp_q_zgYbRNk96S6r27QJ4MSyvC3ilhctcu81MLUKsq8ffPzYxMOhm2dVxDGyvu7ferFG8EfY" 
            alt="Factory weighing scale" 
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-transparent"></div>
          <div className="absolute bottom-6 left-6 text-white">
            <span className="text-xs font-bold uppercase tracking-widest opacity-80">Factory View</span>
            <h5 className="text-2xl font-light">ทางเข้าสะพานชั่ง A1</h5>
            <p className="text-sm opacity-90 mt-1">สถานะ: เปิดให้บริการปกติ (Calibrated: 12 ต.ค. 66)</p>
          </div>
        </motion.div>

        <motion.div className="bg-surface-container p-8 rounded-xl flex flex-col justify-center border-l-4 border-primary" variants={itemVariants}>
          <h5 className="text-xl font-medium tracking-tight">สรุปยอดประจำสัปดาห์</h5>
          <p className="text-on-surface-variant mt-2 text-sm">เปรียบเทียบปริมาณวัสดุที่รับเข้าเฉลี่ยรายวันเทียบกับสัปดาห์ที่ผ่านมา</p>
          
          <div className="mt-6 h-32 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {weeklyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.today ? '#0f5238' : '#e1e3e2'} />
                  ))}
                </Bar>
                <XAxis 
                  dataKey="day" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#404943' }} 
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Footer Status */}
      <footer className="bg-surface-container-high px-8 py-3 flex justify-between items-center text-[10px] font-semibold text-on-surface-variant uppercase tracking-widest border-t border-outline-variant/10 rounded-xl">
        <div className="flex gap-6">
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-primary"></span> Scale System: Online</span>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-primary"></span> Cloud Sync: Active</span>
        </div>
        <span>© 2024 AREX PLATFORM • FACTORY MANAGEMENT MODULE</span>
      </footer>
    </motion.div>
  );
}
