export interface DashboardConfig {
  title: string;
  refreshInterval: number;
  panels: PanelConfig[];
  alerts: AlertConfig[];
}

export interface PanelConfig {
  title: string;
  type: 'graph' | 'gauge' | 'table' | 'status';
  metrics: MetricConfig[];
  layout: PanelLayout;
}

export interface PanelLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MetricConfig {
  name: string;
  query: string;
  unit: string;
  thresholds?: {
    warning: number;
    critical: number;
  };
  currentValue?: number;
  status?: 'normal' | 'warning' | 'critical';
}

export interface AlertConfig {
  name: string;
  condition: string;
  duration: string;
  severity: 'warning' | 'critical';
  message: string;
}
