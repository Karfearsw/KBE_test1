import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ChartErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ChartErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ChartErrorBoundary extends React.Component<
  ChartErrorBoundaryProps,
  ChartErrorBoundaryState
> {
  constructor(props: ChartErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ChartErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Chart component error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      return (
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-destructive">Chart Error</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-muted-foreground text-center mb-4">
              Unable to load chart data
            </p>
            {this.state.error && (
              <p className="text-xs text-muted-foreground text-center mb-4 max-w-sm">
                {this.state.error.message}
              </p>
            )}
            <Button onClick={this.handleRetry} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

export const ChartLoadingSkeleton = ({ className = "" }: { className?: string }) => (
  <Card className={className}>
    <CardHeader>
      <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
    </CardHeader>
    <CardContent>
      <div className="h-64 bg-muted animate-pulse rounded" />
    </CardContent>
  </Card>
);

export const ChartLoadingSpinner = ({ className = "" }: { className?: string }) => (
  <div className={`flex items-center justify-center py-8 ${className}`}>
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    <span className="ml-2 text-sm text-muted-foreground">Loading chart...</span>
  </div>
);