import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset);
      }

      return (
        <div className="p-6 bg-rose-50/70 border border-rose-200 rounded-xl m-4 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-rose-100 text-rose-600 mb-3">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-rose-900 mb-1">
            {this.props.title || 'Đã xảy ra sự cố khi hiển thị phần này'}
          </h3>
          <p className="text-xs text-rose-700 max-w-md mx-auto mb-4 font-mono bg-white/60 p-2 rounded border border-rose-100">
            {this.state.error?.message || 'Lỗi không xác định trong quá trình xử lý dữ liệu.'}
          </p>
          <button
            onClick={this.handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-rose-700 hover:bg-rose-800 text-white rounded-lg shadow-sm transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Thử lại
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}