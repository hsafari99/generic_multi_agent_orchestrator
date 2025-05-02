import { MonitoringDashboard } from '../core/monitoring/dashboard';
import { Metrics } from '../core/types/metrics';

describe('MonitoringDashboard', () => {
  let dashboard: MonitoringDashboard;

  beforeEach(() => {
    dashboard = new MonitoringDashboard();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const config = dashboard.getConfig();
      expect(config.title).toBe('Orchestrator Monitoring Dashboard');
      expect(config.refreshInterval).toBe(30000);
      expect(config.panels.length).toBeGreaterThan(0);
      expect(config.alerts.length).toBeGreaterThan(0);
    });

    it('should create all required panels', () => {
      const config = dashboard.getConfig();
      const panelTitles = config.panels.map(panel => panel.title);
      expect(panelTitles).toContain('System Overview');
      expect(panelTitles).toContain('Agent Performance');
      expect(panelTitles).toContain('Tool Performance');
      expect(panelTitles).toContain('Message Queue');
      expect(panelTitles).toContain('Database Performance');
      expect(panelTitles).toContain('Cache Performance');
    });

    it('should create all required alerts', () => {
      const config = dashboard.getConfig();
      const alertNames = config.alerts.map(alert => alert.name);
      expect(alertNames).toContain('High CPU Usage');
      expect(alertNames).toContain('High Memory Usage');
      expect(alertNames).toContain('High Error Rate');
      expect(alertNames).toContain('Slow Response Time');
      expect(alertNames).toContain('Tool Execution Errors');
      expect(alertNames).toContain('Low Cache Hit Ratio');
    });
  });

  describe('updateMetrics', () => {
    it('should update metric values correctly', () => {
      const metrics: Partial<Metrics> = {
        system: {
          cpu: { usage: 75 },
          memory: { usage: 85 },
          connections: { active: 10 },
        },
        agent: {
          messages: { processed: { rate: 100 } },
          response: { time: { avg: 200 } },
          errors: { rate: 2 },
        },
        tool: {
          executions: { rate: 50, errors: 0 },
          execution: { time: { avg: 150 } },
          cache: { hit: { ratio: 85 } },
        },
        queue: {
          size: 500,
          processing: { rate: 200 },
          wait: { time: { avg: 800 } },
        },
        database: {
          queries: { rate: 300 },
          query: { time: { avg: 50 } },
          connections: { usage: 60 },
        },
        cache: {
          hits: { rate: 1000 },
          misses: { rate: 100 },
          memory: { usage: 70 },
        },
      };

      dashboard.updateMetrics(metrics);
      const config = dashboard.getConfig();

      // Check system metrics
      const systemPanel = config.panels.find(p => p.title === 'System Overview');
      expect(systemPanel?.metrics.find(m => m.name === 'CPU Usage')?.currentValue).toBe(75);
      expect(systemPanel?.metrics.find(m => m.name === 'Memory Usage')?.currentValue).toBe(85);
      expect(systemPanel?.metrics.find(m => m.name === 'Active Connections')?.currentValue).toBe(
        10
      );

      // Check agent metrics
      const agentPanel = config.panels.find(p => p.title === 'Agent Performance');
      expect(
        agentPanel?.metrics.find(m => m.name === 'Message Processing Rate')?.currentValue
      ).toBe(100);
      expect(agentPanel?.metrics.find(m => m.name === 'Average Response Time')?.currentValue).toBe(
        200
      );
      expect(agentPanel?.metrics.find(m => m.name === 'Error Rate')?.currentValue).toBe(2);
    });

    it('should handle undefined metric values', () => {
      const metrics: Partial<Metrics> = {
        system: {
          cpu: { usage: 75 },
          memory: { usage: 85 },
          connections: { active: 10 },
        },
        agent: {
          messages: { processed: { rate: 100 } },
          response: { time: { avg: 200 } },
          errors: { rate: 2 },
        },
        tool: {
          executions: { rate: 50, errors: 0 },
          execution: { time: { avg: 150 } },
          cache: { hit: { ratio: 85 } },
        },
        queue: {
          size: 500,
          processing: { rate: 200 },
          wait: { time: { avg: 800 } },
        },
        database: {
          queries: { rate: 300 },
          query: { time: { avg: 50 } },
          connections: { usage: 60 },
        },
        cache: {
          hits: { rate: 1000 },
          misses: { rate: 100 },
          memory: { usage: 70 },
        },
      };

      // Remove some metrics to test undefined handling
      (metrics.system as any).cpu.usage = undefined;
      (metrics.agent as any).messages.processed.rate = undefined;

      dashboard.updateMetrics(metrics);
      const config = dashboard.getConfig();

      const systemPanel = config.panels.find(p => p.title === 'System Overview');
      expect(systemPanel?.metrics.find(m => m.name === 'CPU Usage')?.currentValue).toBeUndefined();

      const agentPanel = config.panels.find(p => p.title === 'Agent Performance');
      expect(
        agentPanel?.metrics.find(m => m.name === 'Message Processing Rate')?.currentValue
      ).toBeUndefined();
    });
  });

  describe('threshold checking', () => {
    it('should set correct status for normal values', () => {
      const metrics: Partial<Metrics> = {
        system: {
          cpu: { usage: 50 },
          memory: { usage: 60 },
          connections: { active: 10 },
        },
        agent: {
          messages: { processed: { rate: 100 } },
          response: { time: { avg: 200 } },
          errors: { rate: 0.5 },
        },
        tool: {
          executions: { rate: 50, errors: 0 },
          execution: { time: { avg: 150 } },
          cache: { hit: { ratio: 85 } },
        },
        queue: {
          size: 500,
          processing: { rate: 200 },
          wait: { time: { avg: 800 } },
        },
        database: {
          queries: { rate: 300 },
          query: { time: { avg: 50 } },
          connections: { usage: 60 },
        },
        cache: {
          hits: { rate: 1000 },
          misses: { rate: 100 },
          memory: { usage: 70 },
        },
      };

      dashboard.updateMetrics(metrics);
      const config = dashboard.getConfig();

      const systemPanel = config.panels.find(p => p.title === 'System Overview');
      expect(systemPanel?.metrics.find(m => m.name === 'CPU Usage')?.status).toBe('normal');
      expect(systemPanel?.metrics.find(m => m.name === 'Memory Usage')?.status).toBe('normal');
    });

    it('should set correct status for warning values', () => {
      const metrics: Partial<Metrics> = {
        system: {
          cpu: { usage: 75 },
          memory: { usage: 85 },
          connections: { active: 10 },
        },
        agent: {
          messages: { processed: { rate: 100 } },
          response: { time: { avg: 600 } },
          errors: { rate: 2 },
        },
        tool: {
          executions: { rate: 50, errors: 0 },
          execution: { time: { avg: 300 } },
          cache: { hit: { ratio: 85 } },
        },
        queue: {
          size: 850,
          processing: { rate: 200 },
          wait: { time: { avg: 2000 } },
        },
        database: {
          queries: { rate: 300 },
          query: { time: { avg: 200 } },
          connections: { usage: 85 },
        },
        cache: {
          hits: { rate: 1000 },
          misses: { rate: 100 },
          memory: { usage: 85 },
        },
      };

      dashboard.updateMetrics(metrics);
      const config = dashboard.getConfig();

      const systemPanel = config.panels.find(p => p.title === 'System Overview');
      expect(systemPanel?.metrics.find(m => m.name === 'CPU Usage')?.status).toBe('warning');
      expect(systemPanel?.metrics.find(m => m.name === 'Memory Usage')?.status).toBe('warning');

      const agentPanel = config.panels.find(p => p.title === 'Agent Performance');
      expect(agentPanel?.metrics.find(m => m.name === 'Average Response Time')?.status).toBe(
        'warning'
      );
    });

    it('should set correct status for critical values', () => {
      const metrics: Partial<Metrics> = {
        system: {
          cpu: { usage: 95 },
          memory: { usage: 98 },
          connections: { active: 10 },
        },
        agent: {
          messages: { processed: { rate: 100 } },
          response: { time: { avg: 1200 } },
          errors: { rate: 6 },
        },
        tool: {
          executions: { rate: 50, errors: 0 },
          execution: { time: { avg: 600 } },
          cache: { hit: { ratio: 55 } },
        },
        queue: {
          size: 960,
          processing: { rate: 200 },
          wait: { time: { avg: 6000 } },
        },
        database: {
          queries: { rate: 300 },
          query: { time: { avg: 600 } },
          connections: { usage: 98 },
        },
        cache: {
          hits: { rate: 1000 },
          misses: { rate: 100 },
          memory: { usage: 98 },
        },
      };

      dashboard.updateMetrics(metrics);
      const config = dashboard.getConfig();

      const systemPanel = config.panels.find(p => p.title === 'System Overview');
      expect(systemPanel?.metrics.find(m => m.name === 'CPU Usage')?.status).toBe('critical');
      expect(systemPanel?.metrics.find(m => m.name === 'Memory Usage')?.status).toBe('critical');

      const agentPanel = config.panels.find(p => p.title === 'Agent Performance');
      expect(agentPanel?.metrics.find(m => m.name === 'Error Rate')?.status).toBe('critical');
      expect(agentPanel?.metrics.find(m => m.name === 'Average Response Time')?.status).toBe(
        'critical'
      );
    });
  });

  describe('metric value retrieval', () => {
    it('should correctly retrieve nested metric values', () => {
      const metrics: Partial<Metrics> = {
        system: {
          cpu: { usage: 75 },
          memory: { usage: 85 },
          connections: { active: 10 },
        },
        agent: {
          messages: { processed: { rate: 100 } },
          response: { time: { avg: 200 } },
          errors: { rate: 2 },
        },
        tool: {
          executions: { rate: 50, errors: 0 },
          execution: { time: { avg: 150 } },
          cache: { hit: { ratio: 85 } },
        },
        queue: {
          size: 500,
          processing: { rate: 200 },
          wait: { time: { avg: 800 } },
        },
        database: {
          queries: { rate: 300 },
          query: { time: { avg: 50 } },
          connections: { usage: 60 },
        },
        cache: {
          hits: { rate: 1000 },
          misses: { rate: 100 },
          memory: { usage: 70 },
        },
      };

      dashboard.updateMetrics(metrics);
      const config = dashboard.getConfig();

      // Test deeply nested metrics
      const agentPanel = config.panels.find(p => p.title === 'Agent Performance');
      expect(
        agentPanel?.metrics.find(m => m.name === 'Message Processing Rate')?.currentValue
      ).toBe(100);
      expect(agentPanel?.metrics.find(m => m.name === 'Average Response Time')?.currentValue).toBe(
        200
      );

      const toolPanel = config.panels.find(p => p.title === 'Tool Performance');
      expect(toolPanel?.metrics.find(m => m.name === 'Cache Hit Ratio')?.currentValue).toBe(85);
    });

    it('should handle invalid metric paths', () => {
      const metrics: Partial<Metrics> = {
        system: {
          cpu: { usage: 75 },
          memory: { usage: 85 },
          connections: { active: 10 },
        },
        agent: {
          messages: { processed: { rate: 100 } },
          response: { time: { avg: 200 } },
          errors: { rate: 2 },
        },
        tool: {
          executions: { rate: 50, errors: 0 },
          execution: { time: { avg: 150 } },
          cache: { hit: { ratio: 85 } },
        },
        queue: {
          size: 500,
          processing: { rate: 200 },
          wait: { time: { avg: 800 } },
        },
        database: {
          queries: { rate: 300 },
          query: { time: { avg: 50 } },
          connections: { usage: 60 },
        },
        cache: {
          hits: { rate: 1000 },
          misses: { rate: 100 },
          memory: { usage: 70 },
        },
      };

      // Add a panel with invalid metric path
      const config = dashboard.getConfig();
      config.panels.push({
        title: 'Invalid Metrics',
        type: 'graph',
        metrics: [
          {
            name: 'Invalid Metric',
            query: 'invalid.path.to.metric',
            unit: 'count',
          },
        ],
        layout: {
          x: 0,
          y: 36,
          width: 12,
          height: 6,
        },
      });

      dashboard.updateMetrics(metrics);
      const updatedConfig = dashboard.getConfig();
      const invalidPanel = updatedConfig.panels.find(p => p.title === 'Invalid Metrics');
      expect(invalidPanel?.metrics[0].currentValue).toBeUndefined();
    });
  });
});
