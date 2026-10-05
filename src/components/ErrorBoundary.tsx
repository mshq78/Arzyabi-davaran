import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

/** Last line of defence: a render error shows a recoverable screen instead of a blank page. Offline data is untouched. */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false };

  public static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in application:', error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  public render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-sm text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-950/60 border border-amber-800 flex items-center justify-center text-amber-300">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-bold text-white">مشکلی پیش آمد</h1>
          <p className="text-xs text-slate-400 leading-6">
            صفحه به‌درستی بارگذاری نشد. ثبت‌های ذخیره‌شده روی این دستگاه از بین نرفته‌اند. صفحه را دوباره بارگذاری کنید.
          </p>
          <button
            onClick={this.handleReload}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition"
          >
            بارگذاری مجدد
          </button>
        </div>
      </div>
    );
  }
}
