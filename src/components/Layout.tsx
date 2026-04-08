import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  return (
    <div className="min-h-screen bg-surface">
      <Sidebar />
      <div className="md:ml-64 flex flex-col min-h-screen">
        <main className="flex-1 pt-8 pb-12 px-6 md:px-12 max-w-7xl mx-auto w-full flex flex-col">
          <div className="flex-1">
            <Outlet />
          </div>
          
          {/* Footer */}
          <footer className="mt-20 pt-8 pb-4 border-t border-stone-200 flex flex-col md:flex-row items-start justify-between gap-8 text-stone-500">
            {/* ซ้าย: พัฒนาโดย CEDT */}
            <div className="flex items-center gap-4">
              <img
                src="/assets/cedt_logo.png"
                alt="CEDT Logo"
                className="h-12 object-contain grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all"
              />
              <div className="h-8 w-px bg-stone-300 hidden md:block" />
              <div className="text-xs font-medium leading-relaxed">
                <p className="text-stone-400 text-[10px] uppercase tracking-wider font-bold mb-0.5">พัฒนาโดย</p>
                <p className="text-stone-700 font-semibold">Computer Engineering & Digital Technology</p>
                <p className="text-stone-600">Chulalongkorn University (CEDT)</p>
              </div>
            </div>

            {/* กลาง: เจ้าของระบบ */}
            <div className="flex flex-col gap-2">
              <p className="text-[10px] uppercase tracking-wider font-bold text-stone-400">เจ้าของระบบ</p>
              <div className="flex items-center gap-3">
                <img src="/assets/pmuc_logo.png" alt="บพข (PMUC) Logo" className="h-8 object-contain" />
                <div>
                  <p className="text-xs font-semibold text-stone-700">บพข. (PMUC)</p>
                  <p className="text-[10px] text-stone-400">ภายใต้กระทรวง อว.</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-emerald-100 flex items-center justify-center shrink-0">
                  <span className="text-xs font-black text-emerald-700">L</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-stone-700">LAWDEE CO., LTD.</p>
                  <p className="text-[10px] text-stone-400">ผู้ร่วมพัฒนาและดูแลระบบ</p>
                </div>
              </div>
            </div>

            {/* ขวา: links + copyright */}
            <div className="flex flex-col items-end gap-3 text-[10px] font-bold uppercase tracking-widest">
              <div className="flex items-center gap-4">
                <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
                <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
              </div>
              <p className="text-stone-400">© 2025 AREX Platform</p>
              <p className="text-stone-400 normal-case font-normal tracking-normal text-[9px]">บพข. & LAWDEE CO., LTD. All rights reserved.</p>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
