// Cloudflare Pages Functions API 代理服务
// 支持多个 AI 服务的代理请求

// 1. API 代理映射表
const proxies: Record<string, string> = {
  discord: "discord.com/api",
  telegram: "api.telegram.org",
  httpbin: "httpbin.org",
  openai: "api.openai.com",
  claude: "api.anthropic.com",
  gemini: "generativelanguage.googleapis.com",
  gemininothink: "generativelanguage.googleapis.com",
  meta: "www.meta.ai/api",
  groq: "api.groq.com/openai",
  xai: "api.x.ai",
  cohere: "api.cohere.ai",
  huggingface: "api-inference.huggingface.co",
  together: "api.together.xyz",
  novita: "api.novita.ai",
  portkey: "api.portkey.ai",
  fireworks: "api.fireworks.ai",
  targon: "api.targon.com",
  openrouter: "openrouter.ai/api",
  siliconflow: "api.siliconflow.cn",
  modelscope: "api-inference.modelscope.cn",
  gmi: "api.gmi-serving.com",
  azureinference: "models.inference.ai.azure.com",
  githubai: "models.github.ai/inference",
  dmxcom: "www.dmxapi.com",
  dmxcn: "www.dmxapi.cn",
  light2api: "light2api.deno.dev",
  google: "accounts.google.com"
};

// 2. 增强的 Header 黑名单
const BlacklistedHeaders = new Set([
  "cf-connecting-ip",
  "cf-ipcountry",
  "cf-ray",
  "cf-visitor",
  "cf-worker",
  "cdn-loop",
  "cf-ew-via",
  "baggage",
  "sb-request-id",
  "x-amzn-trace-id",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-server",
  "x-real-ip",
  "x-original-host",
  "forwarded",
  "via",
  "referer",
  "x-request-id",
  "x-correlation-id",
  "x-trace-id"
]);

// 3. 类型定义
interface ErrorInfo {
  type: string;
  message: string;
  status: number;
}

interface ErrorResponse {
  error: string;
  status: number;
  timestamp: string;
  details?: string;
}

// 4. 日志记录辅助函数
function logRequest(method: string, pathname: string, targetUrl?: string, status?: number): void {
  const timestamp = new Date().toISOString();
  const statusInfo = status ? ` [${status}]` : '';
  const target = targetUrl ? ` -> ${targetUrl}` : '';
  console.log(`[${timestamp}] ${method} ${pathname}${target}${statusInfo}`);
}

// 5. 错误类型识别函数
function categorizeError(error: Error): ErrorInfo {
  const errorMessage = error.message.toLowerCase();
  
  if (error.name === 'AbortError' || errorMessage.includes('timeout')) {
    return {
      type: 'TIMEOUT',
      message: 'Request timeout - the target service took too long to respond',
      status: 504
    };
  }
  
  if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
    return {
      type: 'NETWORK',
      message: 'Network error - unable to reach the target service',
      status: 502
    };
  }
  
  if (errorMessage.includes('dns') || errorMessage.includes('name resolution')) {
    return {
      type: 'DNS',
      message: 'DNS resolution failed - unable to resolve target hostname',
      status: 502
    };
  }
  
  if (errorMessage.includes('connection refused') || errorMessage.includes('connect')) {
    return {
      type: 'CONNECTION',
      message: 'Connection refused - target service is not accepting connections',
      status: 503
    };
  }
  
  if (errorMessage.includes('ssl') || errorMessage.includes('tls') || errorMessage.includes('certificate')) {
    return {
      type: 'SSL',
      message: 'SSL/TLS error - certificate or encryption issue',
      status: 502
    };
  }
  
  return {
    type: 'UNKNOWN',
    message: `Unexpected error: ${error.message}`,
    status: 500
  };
}

// 6. 创建标准错误响应
function createErrorResponse(message: string, status: number, details?: string): Response {
  const errorBody: ErrorResponse = {
    error: message,
    status,
    timestamp: new Date().toISOString(),
    ...(details && { details })
  };

  return new Response(JSON.stringify(errorBody), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*"
    }
  });
}

// 7. 主处理函数 - Cloudflare Pages Functions 格式
export async function onRequest(context: { request: Request }) {
  const { request } = context;
  const url = new URL(request.url);
  const { pathname, search } = url;
  
  logRequest(request.method, pathname);

  // OPTIONS 请求处理
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, anthropic-version, x-api-key"
      }
    });
  }

  // 路径解析逻辑
  const pathParts = pathname.split("/");
  
  // 验证路径格式 (例如: /api/openai/v1/chat/completions)
  // pathParts 将是 ['', 'api', 'openai', 'v1', 'chat', 'completions']
  if (pathParts.length < 3) {
    return createErrorResponse(
      "Invalid path format. Expected format like: /api/{service}/{path}", 
      400, 
      `Available services: ${Object.keys(proxies).join(', ')}`
    );
  }

  const targetAlias = pathParts[2]; // 获取服务别名
  const targetHost = proxies[targetAlias];
  
  console.log(`服务别名: ${targetAlias}, 目标主机: ${targetHost}`);

  // 验证服务映射
  if (!targetHost) {
    console.error(`服务映射未找到: 客户端尝试访问别名 '${targetAlias}'`);
    return createErrorResponse(
      `Service alias '${targetAlias}' not found`, 
      404, 
      `Available services: ${Object.keys(proxies).join(', ')}`
    );
  }

  // 构建目标路径和URL
  const targetPath = pathParts.slice(3).join("/");
  const targetUrl = `https://${targetHost}/${targetPath}${search}`;
  
  console.log(`目标路径: ${targetPath}`);
  console.log(`最终目标URL: ${targetUrl}`);

  try {
    // 处理请求头
    const forwardedHeaders = new Headers();
    
    for (const [key, value] of request.headers.entries()) {
      const lowerKey = key.toLowerCase();
      if (!BlacklistedHeaders.has(lowerKey) && !lowerKey.startsWith("sec-ch-ua")) {
        forwardedHeaders.set(key, value);
      }
    }

    // 设置必要的headers
    forwardedHeaders.set("Host", targetHost);
    forwardedHeaders.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

    // Claude API 特殊处理
    if (targetAlias === "claude" && !forwardedHeaders.has("anthropic-version")) {
      forwardedHeaders.set("anthropic-version", "2023-06-01");
    }

    // 处理请求体
    let requestBody: ReadableStream<Uint8Array> | string | null = null;
    
    if (request.method !== "GET" && request.method !== "HEAD") {
      // Gemini NoThink 特殊处理
      if (targetAlias === "gemininothink" && 
          request.method === "POST" && 
          request.headers.get("content-type")?.includes("application/json")) {
        try {
          const bodyText = await request.text();
          const bodyJson = JSON.parse(bodyText);
          
          bodyJson.generationConfig = {
            ...bodyJson.generationConfig || {},
            thinkingConfig: {
              thinkingBudget: 0
            }
          };
          
          requestBody = JSON.stringify(bodyJson);
          forwardedHeaders.set("content-type", "application/json");
        } catch (e: any) {
          console.error(`修改gemininothink请求体失败: ${e.message}`);
          return createErrorResponse("Invalid JSON format in request body", 400);
        }
      } else {
        requestBody = request.body;
      }
    }

    console.log(`发起请求到: ${targetUrl}`);

    // 发起代理请求
    const apiResponse = await fetch(targetUrl, {
      method: request.method,
      headers: forwardedHeaders,
      body: requestBody,
      redirect: "manual"
    });

    console.log(`API响应状态: ${apiResponse.status}`);
    logRequest(request.method, pathname, targetUrl, apiResponse.status);

    // 设置CORS响应头
    const responseHeaders = new Headers(apiResponse.headers);
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH");
    responseHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, anthropic-version, x-api-key");

    return new Response(apiResponse.body, {
      status: apiResponse.status,
      headers: responseHeaders
    });

  } catch (error: any) {
    // 详细的错误分类和日志记录
    const errorInfo = categorizeError(error);
    
    console.error(`[${errorInfo.type}] API代理请求失败:`);
    console.error(`  目标URL: ${targetUrl}`);
    console.error(`  错误详情: ${error.message}`);
    console.error(`  错误堆栈: ${error.stack}`);
    
    logRequest(request.method, pathname, targetUrl, errorInfo.status);
    
    return createErrorResponse(
      errorInfo.message, 
      errorInfo.status, 
      `Error type: ${errorInfo.type}`
    );
  }
}
