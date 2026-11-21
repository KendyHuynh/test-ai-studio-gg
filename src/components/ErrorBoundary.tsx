import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let friendly = error.message || 'Đã xảy ra lỗi không mong muốn.';
    try {
      const parsed = JSON.parse(error.message) as {
        error?: string;
        operationType?: string;
        path?: string;
      };
      if (parsed && parsed.operationType) {
        friendly = `Lỗi lưu trữ đám mây (${parsed.operationType} · ${parsed.path ?? ''}): ${parsed.error ?? 'Không có quyền truy cập hoặc mất kết nối.'}`;
      }
    } catch {
      // Standard Error message
    }
    return { hasError: true, message: friendly };
  }

  public componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled application error:', error, info);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-rose-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-700">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h1 className="text-lg font-bold">
                EduBot gặp sự cố tạm thời
              </h1>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl cursor-pointer"
            >
              <RotateCw className="w-4 h-4" />
              <span>Tải lại ứng dụng</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
