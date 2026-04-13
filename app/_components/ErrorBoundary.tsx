'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[40vh] items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-8 shadow-sm text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50">
              <AlertTriangle className="h-8 w-8 text-rose-500" />
            </div>
            <h2 className="text-xl font-semibold text-stone-900">
              {this.props.fallbackTitle ?? 'เกิดข้อผิดพลาดในระบบ'}
            </h2>
            <p className="mt-2 text-sm text-stone-500">
              ไม่สามารถแสดงผลส่วนนี้ได้ กรุณาลองใหม่อีกครั้ง
            </p>
            {this.state.error?.message && (
              <code className="mt-3 block rounded-lg bg-stone-100 px-3 py-2 text-left text-xs text-stone-600 break-all">
                {this.state.error.message}
              </code>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-base font-semibold text-white transition hover:opacity-90 active:scale-[0.98]"
            >
              <RefreshCw className="h-4 w-4" />
              โหลดใหม่
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
