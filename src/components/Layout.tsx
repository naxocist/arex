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

          <footer className="mt-12 pt-5 border-t border-stone-200 text-xs text-stone-500 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
            <p>AREX Platform</p>
            <p>เจ้าของระบบ: บพข. และ LAWDEE CO., LTD • Development: CEDT</p>
          </footer>
        </main>
      </div>
    </div>
  );
}
