// 健康检查 API 接口
// 监控代理服务的运行状态

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'warning';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    [key: string]: {
      status: 'pass' | 'fail' | 'warn';
      message: string;
      responseTime?: number;
      lastChecked: string;
    };
  };
}

interface ServiceCheck {
  name: string;
  alias: string;
  host: string;
  testEndpoint?: string;
  timeout: number;
}

// 支持健康检查的服务列表
const healthCheckServices: ServiceCheck[] = [
  {
    name: 'OpenAI',
    alias: 'openai',
    host: 'api.openai.com',
    testEndpoint: '/v1/models',
    timeout: 5000
  },
  {
    name: 'Claude',
    alias: 'claude',
    host: 'api.anthropic.com',
    testEndpoint: '/v1/messages',
    timeout: 5000
  },
  {
    name: 'Gemini',
    alias: 'gemini',
    host: 'generativelanguage.googleapis.com',
    testEndpoint: '/v1beta/models',
    timeout: 5000
  },
  {
    name: 'Groq',
    alias: 'groq',
    host: 'api.groq.com',
    testEndpoint: '/openai/v1/models',
    timeout: 5000
  },
  {
    name: 'Cohere',
    alias: 'cohere',
    host: 'api.cohere.ai',
    testEndpoint: '/v1/models',
    timeout: 5000
  }
];

// 缓存健康检查结果（简单的内存缓存）
let healthCache: HealthCheckResult | null = null;
let lastHealthCheck = 0;
const CACHE_TTL = 30000; // 30秒缓存

async function checkServiceHealth(service: ServiceCheck): Promise<{
  status: 'pass' | 'fail' | 'warn';
  message: string;
  responseTime?: number;
  lastChecked: string;
}> {
  const startTime = Date.now();
  const lastChecked = new Date().toISOString();

  try {
    // 构建测试 URL
    const testUrl = service.testEndpoint 
      ? `https://${service.host}${service.testEndpoint}`
      : `https://${service.host}`;

    // 创建 AbortController 用于超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), service.timeout);

    // 对于某些服务使用 GET 方法而不是 HEAD
    const method = service.alias === 'cohere' ? 'GET' : 'HEAD';
    
    const response = await fetch(testUrl, {
      method: method,
      signal: controller.signal,
      headers: {
        'User-Agent': 'HealthCheck/1.0'
      }
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    // 检查响应状态
    if (response.status === 200 || response.status === 401 || response.status === 403) {
      // 200: 正常, 401/403: 认证问题但服务可达
      return {
        status: 'pass',
        message: `Service accessible (HTTP ${response.status})`,
        responseTime,
        lastChecked
      };
    } else if (response.status >= 500) {
      return {
        status: 'fail',
        message: `Service error (HTTP ${response.status})`,
        responseTime,
        lastChecked
      };
    } else {
      return {
        status: 'warn',
        message: `Service reachable but unexpected status (HTTP ${response.status})`,
        responseTime,
        lastChecked
      };
    }

  } catch (error: any) {
    const responseTime = Date.now() - startTime;

    if (error.name === 'AbortError') {
      return {
        status: 'fail',
        message: `Service timeout (>${service.timeout}ms)`,
        responseTime,
        lastChecked
      };
    }

    return {
      status: 'fail',
      message: `Service unreachable: ${error.message}`,
      responseTime,
      lastChecked
    };
  }
}

async function performHealthCheck(): Promise<HealthCheckResult> {
  const timestamp = new Date().toISOString();
  const checks: HealthCheckResult['checks'] = {};

  // 自身服务检查
  checks.self = {
    status: 'pass',
    message: 'Proxy service is running',
    lastChecked: timestamp
  };

  // 并行检查所有服务
  const serviceChecks = await Promise.all(
    healthCheckServices.map(async (service) => {
      const result = await checkServiceHealth(service);
      return { alias: service.alias, result };
    })
  );

  // 整理检查结果
  for (const { alias, result } of serviceChecks) {
    checks[alias] = result;
  }

  // 计算整体健康状态
  let overallStatus: 'healthy' | 'unhealthy' | 'warning' = 'healthy';
  let failCount = 0;
  let warnCount = 0;

  for (const check of Object.values(checks)) {
    if (check.status === 'fail') failCount++;
    if (check.status === 'warn') warnCount++;
  }

  if (failCount > 0) {
    overallStatus = failCount > healthCheckServices.length / 2 ? 'unhealthy' : 'warning';
  } else if (warnCount > 0) {
    overallStatus = 'warning';
  }

  return {
    status: overallStatus,
    timestamp,
    uptime: Date.now(), // 简单的运行时间标记
    version: '1.0.0',
    checks
  };
}

export async function onRequest(context: { request: Request }): Promise<Response> {
  const { request } = context;
  const url = new URL(request.url);

  // 只允许 GET 请求
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({
      error: 'Method not allowed',
      message: 'Health check only supports GET requests'
    }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  try {
    const now = Date.now();
    const forceCheck = url.searchParams.has('force');

    // 使用缓存（除非强制检查）
    if (!forceCheck && healthCache && (now - lastHealthCheck) < CACHE_TTL) {
      return new Response(JSON.stringify(healthCache), {
        status: healthCache.status === 'healthy' ? 200 : 503,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': `public, max-age=${Math.floor((CACHE_TTL - (now - lastHealthCheck)) / 1000)}`
        }
      });
    }

    // 执行健康检查
    const healthResult = await performHealthCheck();
    
    // 更新缓存
    healthCache = healthResult;
    lastHealthCheck = now;

    return new Response(JSON.stringify(healthResult, null, 2), {
      status: healthResult.status === 'healthy' ? 200 : 503,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=30'
      }
    });

  } catch (error: any) {
    console.error('Health check failed:', error);

    const errorResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Date.now(),
      version: '1.0.0',
      error: 'Health check system failure',
      message: error.message,
      checks: {
        self: {
          status: 'fail',
          message: `Health check system error: ${error.message}`,
          lastChecked: new Date().toISOString()
        }
      }
    };

    return new Response(JSON.stringify(errorResponse, null, 2), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
