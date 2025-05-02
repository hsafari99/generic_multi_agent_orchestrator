export interface Metrics {
  system: {
    cpu: {
      usage: number;
    };
    memory: {
      usage: number;
    };
    connections: {
      active: number;
    };
  };
  agent: {
    messages: {
      processed: {
        rate: number;
      };
    };
    response: {
      time: {
        avg: number;
      };
    };
    errors: {
      rate: number;
    };
  };
  tool: {
    executions: {
      rate: number;
      errors: number;
    };
    execution: {
      time: {
        avg: number;
      };
    };
    cache: {
      hit: {
        ratio: number;
      };
    };
  };
  queue: {
    size: number;
    processing: {
      rate: number;
    };
    wait: {
      time: {
        avg: number;
      };
    };
  };
  database: {
    queries: {
      rate: number;
    };
    query: {
      time: {
        avg: number;
      };
    };
    connections: {
      usage: number;
    };
  };
  cache: {
    hits: {
      rate: number;
    };
    misses: {
      rate: number;
    };
    memory: {
      usage: number;
    };
  };
}
