import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

export function PerformanceAnalytics() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Performance Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-neutral-50 rounded-lg flex items-center justify-center border-2 border-dashed border-neutral-200">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 text-neutral-400 mx-auto mb-2" />
              <p className="text-neutral-600">Performance analytics will be displayed here</p>
              <p className="text-sm text-neutral-500">Chart loading...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}