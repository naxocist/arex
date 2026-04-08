import React from 'react';
import { motion } from 'motion/react';
import { 
  CheckCircle2, 
  Truck, 
  Factory, 
  PlusCircle, 
  MapPin, 
  Cloud,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1
  }
};

export default function FarmerHome() {
  return (
    <motion.div 
      className="space-y-12"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header & Greeting */}
      <motion.header 
        className="flex flex-col md:flex-row md:items-end justify-between gap-6"
        variants={itemVariants}
      >
        <div>
          <h1 className="text-4xl font-light tracking-tight text-on-surface mb-2">สวัสดีคุณสมชาย</h1>
          <p className="text-on-surface-variant text-lg">ยินดีต้อนรับกลับสู่ระบบ AREX เพื่อโลกที่ยั่งยืน</p>
        </div>
        
        {/* Points Card */}
        <div className="primary-gradient p-6 rounded-full px-10 flex items-center gap-6 shadow-xl shadow-primary/10">
          <div className="text-white">
            <p className="text-xs font-semibold uppercase tracking-widest opacity-80 mb-1">คะแนนสะสม</p>
            <p className="text-3xl font-medium">2,500 <span className="text-sm font-light">PMUC Coin</span></p>
          </div>
          <button className="bg-white text-primary px-6 py-2 rounded-full text-sm font-semibold hover:bg-emerald-50 transition-colors">
            แลกรับรางวัล
          </button>
        </div>
      </motion.header>

      {/* Bento Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Tracking Section */}
        <motion.section className="lg:col-span-8 space-y-6" variants={itemVariants}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-medium text-emerald-900">รายการที่กำลังดำเนินการ</h2>
            <span className="text-primary font-medium text-sm cursor-pointer hover:underline flex items-center gap-1">
              ดูทั้งหมด <ChevronRight className="w-4 h-4" />
            </span>
          </div>

          {/* Progress Card */}
          <div className="bg-white rounded-xl p-8 border border-outline-variant/15 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between mb-10 gap-4">
              <div>
                <span className="bg-secondary-container text-on-secondary-container text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">Order #AREX-2024-089</span>
                <h3 className="text-xl font-medium mt-3">เศษฟางข้าวอัดก้อน (15 ตัน)</h3>
                <p className="text-on-surface-variant text-sm mt-1">ปลายทาง: โรงงานชีวมวลสระบุรี</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-on-surface-variant">อัปเดตล่าสุด</p>
                <p className="font-medium">14 มี.ค. 2024 • 10:30 น.</p>
              </div>
            </div>

            {/* Status Stepper */}
            <div className="relative flex justify-between items-start">
              {/* Line */}
              <div className="absolute top-4 left-0 w-full h-0.5 bg-surface-container-highest -z-0">
                <div className="h-full bg-primary w-1/2"></div>
              </div>
              
              {/* Step 1 */}
              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center mb-2">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium text-primary">ส่งคำขอแล้ว</span>
              </div>

              {/* Step 2 */}
              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center mb-2 ring-4 ring-primary/20">
                  <Truck className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium text-primary">มอบหมายรถขนส่ง</span>
              </div>

              {/* Step 3 */}
              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="w-8 h-8 rounded-full bg-surface-container-highest text-on-surface-variant flex items-center justify-center mb-2">
                  <Factory className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium text-on-surface-variant">ถึงโรงงานแล้ว</span>
              </div>
            </div>
          </div>

          {/* Form Section */}
          <div className="bg-surface-container-low rounded-xl p-8">
            <div className="flex items-center gap-3 mb-8">
              <PlusCircle className="w-8 h-8 text-primary" />
              <h2 className="text-2xl font-medium text-emerald-900">แบบฟอร์มแจ้งส่งวัสดุ</h2>
            </div>
            
            <form className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-on-surface-variant tracking-wider">ประเภทวัสดุ</label>
                <select className="w-full bg-surface-container-high border-none rounded-lg p-3 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all outline-none">
                  <option>เลือกประเภทวัสดุ</option>
                  <option>ฟางข้าว</option>
                  <option>เหง้ามันสำปะหลัง</option>
                  <option>ชานอ้อย</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-on-surface-variant tracking-wider">ปริมาณโดยประมาณ (ตัน)</label>
                <input 
                  type="number" 
                  placeholder="เช่น 10" 
                  className="w-full bg-surface-container-high border-none rounded-lg p-3 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                />
              </div>
              
              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-semibold uppercase text-on-surface-variant tracking-wider">สถานที่นัดรับ</label>
                <div className="relative">
                  <input 
                    type="text" 
                    defaultValue="ต.นาเฉลียง อ.หนองไผ่ จ.เพชรบูรณ์" 
                    className="w-full bg-surface-container-high border-none rounded-lg p-3 pl-10 text-on-surface outline-none"
                  />
                  <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
                </div>
              </div>
              
              <div className="md:col-span-2 pt-4">
                <button className="w-full primary-gradient text-white py-4 rounded-full font-semibold text-lg hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-[0.98]">
                  แจ้งส่งวัสดุใหม่
                </button>
              </div>
            </form>
          </div>
        </motion.section>

        {/* Side Cards */}
        <motion.aside className="lg:col-span-4 space-y-8" variants={itemVariants}>
          {/* Weather Info */}
          <div className="bg-secondary-container/30 rounded-xl p-6 border border-secondary-container/50">
            <div className="flex items-center justify-between mb-4">
              <span className="text-on-secondary-container font-medium">สภาพอากาศวันนี้</span>
              <Cloud className="w-5 h-5 text-on-secondary-container" />
            </div>
            <div className="flex items-center gap-4">
              <span className="text-4xl font-light text-on-secondary-container">32°C</span>
              <div className="text-sm text-on-secondary-container/80">
                <p>มีเมฆบางส่วน</p>
                <p>ความชื้น 45%</p>
              </div>
            </div>
          </div>

          {/* Rewards Preview */}
          <div className="space-y-4">
            <h3 className="text-xl font-medium text-emerald-900 px-1">แลกรับรางวัล</h3>
            
            {/* Reward Card 1 */}
            <div className="bg-white rounded-xl overflow-hidden border border-outline-variant/15 shadow-sm group cursor-pointer">
              <div className="h-40 overflow-hidden">
                <img 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBG6zH4Y_Xgl6moSIU3UX0-lKpdh0GH5Ch4bVO05ph-6C3S5wdXJXGVCznHy4unPjVBudQjxOinjXJAhsw-UJadwnlBQ4NrA92aBLX_iNzCFppTudVYF5jUMTt-fGRG3JJK1sMAdKbif1ps8LDdVREaoEmFU5yJGYWqbcSZD6HX_Dg9z2DfE-ZgKiIVRjuFDjehjzDR3O8C4TCLoNkZsbIDeQjpUJOVQajlYRkZRSYUIyAUZ0gMsh0GegKWi69Yq_uA-NcnYpnnQO4" 
                  alt="Fertilizer product" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="p-4">
                <h4 className="font-medium text-on-surface">ปุ๋ยอินทรีย์สูตรพรีเมียม</h4>
                <div className="flex justify-between items-center mt-3">
                  <span className="text-primary font-bold">1,200 <span className="text-xs font-normal">PMUC Coin</span></span>
                  <button className="text-xs bg-surface-container-highest px-3 py-1.5 rounded-full hover:bg-primary hover:text-white transition-colors">แลกเลย</button>
                </div>
              </div>
            </div>

            {/* Reward Card 2 */}
            <div className="bg-white rounded-xl overflow-hidden border border-outline-variant/15 shadow-sm group cursor-pointer">
              <div className="h-40 overflow-hidden">
                <img 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAXCRxV8WAx4DcLJWPvEQYUbToHAgi7h6k71g-Jku4UjhQEmhQa7i-J4_y6iqZbHjYrhlJC2voAFnRvim7rmHhjA27sxjdIB_4IZSpuglTNHwhjn0OQJBx5J3c3b3L6WUW7Sz5buglGhXIl882zzlGUliYRz40xIwmwL0yza7WLYjmUuB8DS1IkT5Y4WoBw2zPhRChyevT5GST70QgcOD7wCjJlTaC_J26MyeCGOaKKLvP092lPkFjCjuJnrAA_WtN-yctSUGAGth4" 
                  alt="Agriculture tools" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="p-4">
                <h4 className="font-medium text-on-surface">ชุดกรรไกรตัดแต่งกิ่ง</h4>
                <div className="flex justify-between items-center mt-3">
                  <span className="text-primary font-bold">850 <span className="text-xs font-normal">PMUC Coin</span></span>
                  <button className="text-xs bg-surface-container-highest px-3 py-1.5 rounded-full hover:bg-primary hover:text-white transition-colors">แลกเลย</button>
                </div>
              </div>
            </div>
          </div>
        </motion.aside>
      </div>
    </motion.div>
  );
}
