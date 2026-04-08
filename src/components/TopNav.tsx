import React from 'react';
import { Bell, HelpCircle, Bolt, Search } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface TopNavProps {
  title?: string;
  showSearch?: boolean;
}

export default function TopNav({ title, showSearch = false }: TopNavProps) {
  return (
    <header className="fixed top-0 right-0 left-0 md:left-64 z-30 flex justify-between items-center px-8 h-16 bg-emerald-950/80 backdrop-blur-xl transition-all text-emerald-50">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-light tracking-tighter text-emerald-50">AREX</span>
        </div>
        <nav className="hidden lg:flex items-center gap-8">
          <a href="#" className="text-emerald-100/70 hover:text-emerald-50 transition-colors tracking-tight text-sm">ตลาดซื้อขาย</a>
          <a href="#" className="text-emerald-100/70 hover:text-emerald-50 transition-colors tracking-tight text-sm">การติดตาม</a>
          <a href="#" className="text-emerald-100/70 hover:text-emerald-50 transition-colors tracking-tight text-sm">คลังสินค้า</a>
          <a href="#" className="text-emerald-400 font-medium border-b-2 border-emerald-400 pb-1 tracking-tight text-sm">แดชบอร์ด</a>
        </nav>
      </div>

      <div className="flex items-center gap-4">
        {showSearch && (
          <div className="hidden sm:flex items-center bg-emerald-900/40 rounded-full px-4 py-1.5 gap-2 border border-emerald-800/50">
            <Search className="w-4 h-4 text-emerald-400" />
            <input 
              type="text" 
              placeholder="ค้นหาเส้นทาง..." 
              className="bg-transparent border-none focus:ring-0 text-sm w-48 text-emerald-50 placeholder-emerald-100/30"
            />
          </div>
        )}
        
        <div className="hidden sm:flex items-center bg-emerald-900/40 rounded-full px-4 py-1.5 gap-2 border border-emerald-800/50">
          <Bolt className="w-4 h-4 text-emerald-400" />
          <span className="text-emerald-100 font-medium text-xs">Demo Mode</span>
        </div>

        <div className="flex items-center gap-2">
          <button className="p-2 text-emerald-100/70 hover:bg-emerald-900/40 rounded-full transition-all">
            <Bell className="w-5 h-5" />
          </button>
          <button className="p-2 text-emerald-100/70 hover:bg-emerald-900/40 rounded-full transition-all">
            <HelpCircle className="w-5 h-5" />
          </button>
          
          <div className="ml-2 w-8 h-8 rounded-full overflow-hidden border border-emerald-700">
            <img 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAdbD-aERvDjOhia_OmzdJ4524fVLLlrWPARBybxjiy4L1Yg1DzZyW36yi7KGQLsxxTX5bitxSY7_JE_ON6nTcYIhfxwItCgyCe9CyQz4MyC9c7H6Nfn1gUhO88xkpnlN2W4CYVNKh9sMRv1Rsm5MGJh95oY3lqBiBTP8RxM8GYSmsp3kvl5wgbjBAFERrdtxLerTB5kvFYdDu41GX3fTX9zgv9wzu393b5gpBynHhpx3skO2AGNIStVzi8EJPQalInDEQGu9VBlQ8" 
              alt="User profile avatar" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
