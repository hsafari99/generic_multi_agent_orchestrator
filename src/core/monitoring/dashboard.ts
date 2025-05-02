import { Metrics } from '../types/metrics';
import { DashboardConfig, PanelConfig, AlertConfig } from '../types/dashboard';

export class MonitoringDashboard {
  private config: DashboardConfig;

  constructor() {
    this.config = {
      title: 'Orchestrator Monitoring Dashboard',
      refreshInterval: 30000, // 30 seconds
      panels: this.createDefaultPanels(),
      alerts: this.createDefaultAlerts(),
    };
  }

  private createDefaultPanels(): PanelConfig[] {
    return [
      // System Overview Panel
      {
        title: 'System Overview',
        type: 'graph',
        metrics: [
          {
            name: 'CPU Usage',
            query: 'system.cpu.usage',
            unit: 'percent',
            thresholds: {
              warning: 70,
              critical: 90,
            },
          },
          {
            name: 'Memory Usage',
            query: 'system.memory.usage',
            unit: 'percent',
            thresholds: {
              warning: 80,
              critical: 95,
            },
          },
          {
            name: 'Active Connections',
            query: 'system.connections.active',
            unit: 'count',
          },
        ],
        layout: {
          x: 0,
          y: 0,
          width: 12,
          height: 6,
        },
      },

      // Agent Performance Panel
      {
        title: 'Agent Performance',
        type: 'graph',
        metrics: [
          {
            name: 'Message Processing Rate',
            query: 'agent.messages.processed.rate',
            unit: 'messages/second',
          },
          {
            name: 'Average Response Time',
            query: 'agent.response.time.avg',
            unit: 'milliseconds',
            thresholds: {
              warning: 500,
              critical: 1000,
            },
          },
          {
            name: 'Error Rate',
            query: 'agent.errors.rate',
            unit: 'errors/second',
            thresholds: {
              warning: 1,
              critical: 5,
            },
          },
        ],
        layout: {
          x: 0,
          y: 6,
          width: 12,
          height: 6,
        },
      },

      // Tool Performance Panel
      {
        title: 'Tool Performance',
        type: 'graph',
        metrics: [
          {
            name: 'Tool Execution Rate',
            query: 'tool.executions.rate',
            unit: 'executions/second',
          },
          {
            name: 'Average Execution Time',
            query: 'tool.execution.time.avg',
            unit: 'milliseconds',
            thresholds: {
              warning: 200,
              critical: 500,
            },
          },
          {
            name: 'Cache Hit Ratio',
            query: 'tool.cache.hit.ratio',
            unit: 'percent',
            thresholds: {
              warning: 80,
              critical: 60,
            },
          },
        ],
        layout: {
          x: 0,
          y: 12,
          width: 12,
          height: 6,
        },
      },

      // Message Queue Panel
      {
        title: 'Message Queue',
        type: 'graph',
        metrics: [
          {
            name: 'Queue Size',
            query: 'queue.size',
            unit: 'count',
            thresholds: {
              warning: 800,
              critical: 950,
            },
          },
          {
            name: 'Processing Rate',
            query: 'queue.processing.rate',
            unit: 'messages/second',
          },
          {
            name: 'Average Wait Time',
            query: 'queue.wait.time.avg',
            unit: 'milliseconds',
            thresholds: {
              warning: 1000,
              critical: 5000,
            },
          },
        ],
        layout: {
          x: 0,
          y: 18,
          width: 12,
          height: 6,
        },
      },

      // Database Performance Panel
      {
        title: 'Database Performance',
        type: 'graph',
        metrics: [
          {
            name: 'Query Rate',
            query: 'database.queries.rate',
            unit: 'queries/second',
          },
          {
            name: 'Average Query Time',
            query: 'database.query.time.avg',
            unit: 'milliseconds',
            thresholds: {
              warning: 100,
              critical: 500,
            },
          },
          {
            name: 'Connection Pool Usage',
            query: 'database.connections.usage',
            unit: 'percent',
            thresholds: {
              warning: 80,
              critical: 95,
            },
          },
        ],
        layout: {
          x: 0,
          y: 24,
          width: 12,
          height: 6,
        },
      },

      // Cache Performance Panel
      {
        title: 'Cache Performance',
        type: 'graph',
        metrics: [
          {
            name: 'Cache Hit Rate',
            query: 'cache.hits.rate',
            unit: 'hits/second',
          },
          {
            name: 'Cache Miss Rate',
            query: 'cache.misses.rate',
            unit: 'misses/second',
          },
          {
            name: 'Cache Memory Usage',
            query: 'cache.memory.usage',
            unit: 'percent',
            thresholds: {
              warning: 80,
              critical: 95,
            },
          },
        ],
        layout: {
          x: 0,
          y: 30,
          width: 12,
          height: 6,
        },
      },
    ];
  }

  private createDefaultAlerts(): AlertConfig[] {
    return [
      // System Alerts
      {
        name: 'High CPU Usage',
        condition: 'system.cpu.usage > 90',
        duration: '5m',
        severity: 'critical',
        message: 'CPU usage is above 90% for 5 minutes',
      },
      {
        name: 'High Memory Usage',
        condition: 'system.memory.usage > 95',
        duration: '5m',
        severity: 'critical',
        message: 'Memory usage is above 95% for 5 minutes',
      },

      // Agent Alerts
      {
        name: 'High Error Rate',
        condition: 'agent.errors.rate > 5',
        duration: '1m',
        severity: 'critical',
        message: 'Agent error rate is above 5 errors/second',
      },
      {
        name: 'Slow Response Time',
        condition: 'agent.response.time.avg > 1000',
        duration: '5m',
        severity: 'warning',
        message: 'Average agent response time is above 1 second',
      },

      // Tool Alerts
      {
        name: 'Tool Execution Errors',
        condition: 'tool.executions.errors > 0',
        duration: '1m',
        severity: 'warning',
        message: 'Tool execution errors detected',
      },
      {
        name: 'Low Cache Hit Ratio',
        condition: 'tool.cache.hit.ratio < 60',
        duration: '5m',
        severity: 'warning',
        message: 'Cache hit ratio is below 60%',
      },

      // Queue Alerts
      {
        name: 'Queue Size Warning',
        condition: 'queue.size > 800',
        duration: '5m',
        severity: 'warning',
        message: 'Message queue size is above 800',
      },
      {
        name: 'Queue Size Critical',
        condition: 'queue.size > 950',
        duration: '1m',
        severity: 'critical',
        message: 'Message queue size is above 950',
      },

      // Database Alerts
      {
        name: 'Slow Queries',
        condition: 'database.query.time.avg > 500',
        duration: '5m',
        severity: 'warning',
        message: 'Average database query time is above 500ms',
      },
      {
        name: 'High Connection Usage',
        condition: 'database.connections.usage > 95',
        duration: '1m',
        severity: 'critical',
        message: 'Database connection pool usage is above 95%',
      },

      // Cache Alerts
      {
        name: 'Cache Memory Warning',
        condition: 'cache.memory.usage > 80',
        duration: '5m',
        severity: 'warning',
        message: 'Cache memory usage is above 80%',
      },
      {
        name: 'Cache Memory Critical',
        condition: 'cache.memory.usage > 95',
        duration: '1m',
        severity: 'critical',
        message: 'Cache memory usage is above 95%',
      },
    ];
  }

  public getConfig(): DashboardConfig {
    return this.config;
  }

  public updateMetrics(metrics: Partial<Metrics>): void {
    // Update dashboard metrics
    this.config.panels.forEach(panel => {
      panel.metrics.forEach(metric => {
        const value = this.getMetricValue(metrics, metric.query);
        if (value !== undefined) {
          metric.currentValue = value;
          this.checkThresholds(metric);
        }
      });
    });
  }

  private getMetricValue(metrics: Partial<Metrics>, query: string): number | undefined {
    // Implement metric value retrieval logic
    const parts = query.split('.');
    let current: any = metrics;

    for (const part of parts) {
      if (current === undefined) return undefined;
      current = current[part];
    }

    return typeof current === 'number' ? current : undefined;
  }

  private checkThresholds(metric: any): void {
    if (!metric.thresholds) return;

    const value = metric.currentValue;
    if (value === undefined) return;

    if (metric.thresholds.critical !== undefined && value >= metric.thresholds.critical) {
      metric.status = 'critical';
    } else if (metric.thresholds.warning !== undefined && value >= metric.thresholds.warning) {
      metric.status = 'warning';
    } else {
      metric.status = 'normal';
    }
  }
}
