import React from 'react';
import { motion } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { 
  Leaf, 
  Wind, 
  Wallet, 
  Users, 
  Calendar, 
  Download, 
  Truck, 
  CheckSquare, 
  UserPlus,
  ZoomIn,
  Map as MapIcon
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

const data = [
  { name: 'จ.', rice: 400, corn: 240 },
  { name: 'อ.', rice: 300, corn: 139 },
  { name: 'พ.', rice: 200, corn: 980 },
  { name: 'พฤ.', rice: 278, corn: 390 },
  { name: 'ศ.', rice: 189, corn: 480 },
  { name: 'ส.', rice: 239, corn: 380 },
  { name: 'อา.', rice: 349, corn: 430 },
];

const regionalData = [
  { label: 'ภาคเหนือ', value: 45, color: 'bg-primary' },
  { label: 'ภาคตะวันออกเฉียงเหนือ', value: 32, color: 'bg-primary-container' },
  { label: 'ภาคกลาง', value: 18, color: 'bg-secondary-container' },
  { label: 'ภาคใต้', value: 5, color: 'bg-outline-variant' },
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

export default function ExecutiveDashboard() {
  return (
    <motion.div 
      className="space-y-10"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Hero Title Section */}
      <motion.div className="flex flex-col md:flex-row md:items-end justify-between gap-4" variants={itemVariants}>
        <div>
          <h2 className="text-4xl font-light text-primary tracking-tight mb-2">แดชบอร์ดผู้บริหาร</h2>
          <p className="text-on-surface-variant max-w-2xl font-regular leading-relaxed">
            ภาพรวมประสิทธิภาพโครงการบริหารจัดการวัสดุเหลือใช้ทางการเกษตรและการลดมลพิษทางอากาศอย่างยั่งยืน
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-6 py-2.5 bg-surface-container-highest text-on-surface rounded-full font-medium text-sm flex items-center gap-2 hover:bg-surface-variant transition-colors">
            <Calendar className="w-4 h-4" />
            พฤศจิกายน 2566
          </button>
          <button className="p-2.5 bg-primary text-white rounded-full shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </motion.div>

      {/* High Impact KPIs Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'ปริมาณขยะที่ลดการเผา', value: '1,420', unit: 'ตัน', change: '+12%', icon: Leaf, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'ประมาณการลดฝุ่น PM 2.5', value: '240', unit: 'กก.', change: '+8.4%', icon: Wind, color: 'text-sky-600', bg: 'bg-sky-50' },
          { label: 'มูลค่าสวัสดิการที่จัดสรร', value: '4.8', unit: 'ล้านบาท', change: '+15%', icon: Wallet, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'จำนวนเกษตรกรที่เข้าร่วม', value: '12,450', unit: 'ราย', change: '+22', icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map((kpi, idx) => (
          <motion.div 
            key={idx}
            className="bg-white p-6 rounded-xl border border-outline-variant/15 flex flex-col gap-4 group hover:bg-primary/5 transition-colors"
            variants={itemVariants}
          >
            <div className="flex justify-between items-start">
              <div className={cn("p-2.5 rounded-xl transition-colors group-hover:bg-primary group-hover:text-white", kpi.bg, kpi.color)}>
                <kpi.icon className="w-5 h-5" />
              </div>
              <span className={cn("text-xs font-bold px-2 py-1 rounded-full", kpi.bg, kpi.color)}>{kpi.change}</span>
            </div>
            <div>
              <p className="text-on-surface-variant text-xs font-semibold uppercase tracking-wider mb-1">{kpi.label}</p>
              <h3 className="text-3xl font-medium text-on-surface">{kpi.value} <span className="text-base font-normal text-on-surface-variant">{kpi.unit}</span></h3>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <motion.div className="lg:col-span-2 bg-surface-container-low rounded-2xl p-8 border border-outline-variant/10" variants={itemVariants}>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h4 className="text-lg font-medium text-on-surface">ปริมาณการแลกเปลี่ยนรายวัน</h4>
              <p className="text-xs text-on-surface-variant">เปรียบเทียบปริมาณวัสดุเหลือใช้ย้อนหลัง 7 วัน</p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-primary"></span> ข้าว
              </div>
              <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-secondary-container"></span> ข้าวโพด
              </div>
            </div>
          </div>
          
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e6e9e8" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#404943' }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#404943' }} 
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(15, 82, 56, 0.05)' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                />
                <Bar dataKey="rice" fill="#0f5238" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="corn" fill="#bee8dc" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Regional Chart */}
        <motion.div className="bg-surface-container-low rounded-2xl p-8 border border-outline-variant/10 flex flex-col" variants={itemVariants}>
          <h4 className="text-lg font-medium text-on-surface mb-6">ปริมาณการแลกเปลี่ยนรายภูมิภาค</h4>
          <div className="flex-1 flex flex-col justify-center gap-6">
            {regionalData.map((region, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex justify-between text-xs font-medium">
                  <span>{region.label}</span>
                  <span>{region.value}%</span>
                </div>
                <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
                  <motion.div 
                    className={cn("h-full rounded-full", region.color)}
                    initial={{ width: 0 }}
                    animate={{ width: `${region.value}%` }}
                    transition={{ duration: 1, delay: 0.5 + idx * 0.1 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Activity Feed */}
        <motion.div className="lg:col-span-1 bg-surface-container-low rounded-2xl p-8 border border-outline-variant/10" variants={itemVariants}>
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-lg font-medium text-on-surface">รายการแลกเปลี่ยนล่าสุด</h4>
            <button className="text-xs font-semibold text-primary hover:underline">ดูทั้งหมด</button>
          </div>
          <div className="flex flex-col gap-6">
            {[
              { icon: Truck, color: 'bg-emerald-100 text-emerald-700', title: 'ขนย้ายฟางข้าว 12 ตัน', desc: 'สหกรณ์การเกษตรแม่ริม - โรงงาน Bio-Fuel', time: '2 นาทีที่แล้ว' },
              { icon: CheckSquare, color: 'bg-sky-100 text-sky-700', title: 'อนุมัติคูปองสวัสดิการ', desc: 'กลุ่มเกษตรกรบ้านทุ่ง ต.แม่แฝก', time: '15 นาทีที่แล้ว' },
              { icon: UserPlus, color: 'bg-amber-100 text-amber-700', title: 'เกษตรกรใหม่ลงทะเบียน', desc: 'เพิ่ม 45 ราย ในพื้นที่ อ.เชียงดาว', time: '1 ชั่วโมงที่แล้ว' },
            ].map((item, idx) => (
              <div key={idx} className="flex gap-4 items-start">
                <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", item.color)}>
                  <item.icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-on-surface-variant mb-1">{item.desc}</p>
                  <span className="text-[10px] text-stone-400">{item.time}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Strategic Map View */}
        <motion.div className="lg:col-span-2 relative h-80 lg:h-auto min-h-[400px] rounded-2xl overflow-hidden group" variants={itemVariants}>
          <img 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAermy-IQGbsc6if_3_x8W100913E_FM2yBBBuAcJUyZwLtk6DodWztLdRUJ6xJidYfSg4JdEJJaiScr3xQPCy1kdbmPGovjdc55f6Oaw6p7dyIvW7r3QwVI7rlPQlUDnAVktIb-Tu4xGArrua9hCEy1li92mAl9Dxo2_1bZYX_-FNG7cyQkHtfufJ7DuD6BEHGPbeigjHQbC02H4pAQwifDGy_D1ROU8aq9wubWf7qo4KdWuMnQJyf4a9VLSBJ1ZjHw-vczuiO1-k" 
            alt="Map area overview" 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/80 via-transparent to-transparent"></div>
          <div className="absolute top-6 left-6">
            <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
              <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></span>
              <span className="text-xs font-semibold">Live Traffic: โซนภาคเหนือ</span>
            </div>
          </div>
          <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between">
            <div className="text-white">
              <p className="text-sm font-light opacity-80 mb-1">พื้นที่ปฏิบัติงานสูงสุด</p>
              <h5 className="text-xl font-medium">จังหวัดเชียงใหม่ - ลำพูน</h5>
            </div>
            <div className="flex gap-2">
              <button className="bg-white/20 backdrop-blur-md hover:bg-white/40 p-3 rounded-full text-white transition-all">
                <ZoomIn className="w-5 h-5" />
              </button>
              <button className="bg-white text-primary p-3 rounded-full shadow-xl shadow-primary/20 hover:scale-110 transition-all">
                <MapIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
