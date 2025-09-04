const base64Encode = (a) => btoa(String.fromCharCode.apply(null, a));
const base64Decode = (b) => {
    const binary_string = atob(b);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes;
};

const HIGHLIGHT_BASE_URL = "https://chat-backend.highlightai.com";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Highlight/1.3.61 Chrome/132.0.6834.210 Electron/34.5.8 Safari/537.36";

const accessTokens = new Map();
const modelCache = new Map();

const Hr = {
    r: [87, 78, 72, 56, 79, 48, 122, 79, 107, 104, 82, 119, 51, 100, 78, 90, 85, 85, 69, 107, 90, 116, 87, 48, 108, 53, 83, 84, 70, 81, 121, 69],
    m: [27, 26, 25, 22, 24, 21, 17, 12, 30, 19, 20, 14, 31, 8, 18, 10, 13, 5, 29, 7, 16, 6, 28, 23, 9, 15, 4, 0, 11, 2, 3, 1]
};

const jr = {
    r: [87, 90, 109, 107, 53, 105, 81, 89, 103, 107, 68, 49, 68, 105, 106, 77, 49, 106, 53, 78, 77, 78, 106, 106, 61, 77, 89, 51, 66, 79, 86, 89, 106, 65, 106, 52, 89, 77, 87, 106, 89, 122, 78, 90, 65, 89, 50, 105, 61, 90, 106, 66, 48, 53, 71, 89, 87, 52, 81, 84, 78, 90, 74, 78, 103, 50, 70, 79, 51, 50, 50, 77, 122, 108, 84, 81, 120, 90, 89, 89, 89, 79, 119, 122, 121, 108, 69, 77],
    m: [65, 20, 1, 6, 31, 63, 74, 12, 85, 78, 33, 3, 41, 19, 45, 52, 75, 21, 23, 16, 56, 36, 5, 71, 87, 68, 72, 15, 18, 32, 82, 8, 17, 54, 83, 35, 28, 48, 49, 77, 30, 25, 10, 38, 22, 50, 29, 11, 86, 64, 57, 70, 47, 67, 81, 44, 61, 7, 58, 13, 84, 76, 42, 24, 46, 37, 62, 80, 27, 51, 73, 34, 69, 39, 53, 2, 79, 60, 26, 0, 66, 40, 55, 9, 59, 43, 14, 4]
};

async function pbkdf2(password, salt, iterations, keyLen) {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), { name: "PBKDF2" }, false, ["deriveBits"]);
    const derivedBits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: new Uint8Array(salt), iterations: iterations, hash: "SHA-256" }, key, keyLen * 8);
    return new Uint8Array(derivedBits);
}

function Ah(n, e) {
    const t = new Array(n.length);
    for (let s = 0; s < e.length; s++) {
        t[e[s]] = n[s];
    }
    return t;
}

function Fl(n, e) {
    const t = Ah(n, e);
    const s = String.fromCharCode(...t);
    const o = base64Decode(s);
    const i = Array.from(new Uint8Array(o)).reverse();
    return new TextDecoder().decode(new Uint8Array(i));
}

async function Th(n) {
    const salt = new TextEncoder().encode(Fl(Hr.r, Hr.m));
    return await pbkdf2(n, salt, 100000, 32);
}

async function kh(n, fixedIv) {
    const e = await Th(n.userId);
    const t = fixedIv || crypto.getRandomValues(new Uint8Array(16));
    const data = { ...n, apiKey: Fl(jr.r, jr.m) };
    const jsonStr = JSON.stringify(data);
    const jsonBytes = new TextEncoder().encode(jsonStr);
    const padLen = 16 - (jsonBytes.length % 16);
    const paddedData = new Uint8Array(jsonBytes.length + padLen);
    paddedData.set(jsonBytes);
    paddedData.fill(padLen, jsonBytes.length);
    const key = await crypto.subtle.importKey("raw", new Uint8Array(e), { name: "AES-CBC" }, false, ["encrypt"]);
    const encrypted = await crypto.subtle.encrypt({ name: "AES-CBC", iv: t }, key, paddedData);
    const tHex = Array.from(t).map((b: any) => b.toString(16).padStart(2, '0')).join('');
    const encryptedHex = Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${tHex}:${encryptedHex}`;
}

function H7t(t = 12) {
    const randomBytes = crypto.getRandomValues(new Uint8Array(t));
    return Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getIdentifier(userId, clientUUID, fixedIv) {
    const t = await kh({ userId, clientUUID }, fixedIv);
    return `${H7t()}:${t}`;
}

async function login(code) {
    console.log("开始登录流程...");
    const chromeDeviceId = crypto.randomUUID();
    const deviceId = crypto.randomUUID();
    const exchangeResponse = await fetch(`${HIGHLIGHT_BASE_URL}/api/v1/auth/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, amplitudeDeviceId: chromeDeviceId }),
    });
    if (!exchangeResponse.ok) {
        const errorText = await exchangeResponse.text();
        console.error(`HTTP错误: ${exchangeResponse.status} ${errorText}`);
        if (exchangeResponse.status === 500) throw new Error("服务器内部错误，请稍后重试");
        else if (exchangeResponse.status === 400) throw new Error("请求格式错误，请检查授权代码是否正确");
        else throw new Error(`登录服务暂时不可用 (错误代码: ${exchangeResponse.status})`);
    }
    const exchangeData = await exchangeResponse.json();
    if (!exchangeData.success) {
        console.error(`登录失败详情:`, exchangeData);
        const errorMessage = exchangeData.error || "未知错误";
        if (errorMessage.includes("expired") || errorMessage.includes("invalid")) throw new Error("授权代码已过期或无效。授权代码只能使用一次，请重新登录获取新的代码。");
        else if (errorMessage.includes("not found")) throw new Error("授权代码不存在，请检查是否复制完整。");
        else if (errorMessage.includes("already used")) throw new Error("此授权代码已被使用过，请重新登录获取新的代码。");
        else if (errorMessage.includes("rate limit")) throw new Error("请求过于频繁，请稍等片刻后重试。");
        else throw new Error(`登录失败: ${errorMessage}。如果问题持续存在，请重新获取授权代码。`);
    }
    const { accessToken, refreshToken } = exchangeData.data;
    const clientResponse = await fetch(`${HIGHLIGHT_BASE_URL}/api/v1/users/me/client`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({ client_uuid: deviceId }),
    });
    if (!clientResponse.ok) console.warn(`客户端注册失败: ${clientResponse.status}，但继续进行...`);
    const profileResponse = await fetch(`${HIGHLIGHT_BASE_URL}/api/v1/auth/profile`, { headers: { 'Authorization': `Bearer ${accessToken}` } });
    if (!profileResponse.ok) {
        const errorText = await profileResponse.text();
        console.error(`获取用户信息失败: ${profileResponse.status} ${errorText}`);
        throw new Error(`无法获取用户信息，请重试。如果问题持续存在，请重新登录。`);
    }
    const profileData = await profileResponse.json();
    const { id: userId, email } = profileData;
    console.log(`登录成功: ${userId} ${email}`);
    const userInfo = { rt: refreshToken, user_id: userId, email, client_uuid: deviceId };
    const apiKey = base64Encode(new TextEncoder().encode(JSON.stringify(userInfo)));
    console.log("----API KEY----");
    console.log(apiKey);
    console.log("----API KEY----");
    return userInfo;
}

function parseApiKey(apiKeyBase64) {
    try {
        return JSON.parse(new TextDecoder().decode(base64Decode(apiKeyBase64)));
    } catch {
        return null;
    }
}

function parseJwtPayload(jwtToken) {
    try {
        const parts = jwtToken.split(".");
        if (parts.length !== 3) return null;
        let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padding = payload.length % 4;
        if (padding) payload += "=".repeat(4 - padding);
        return JSON.parse(new TextDecoder().decode(base64Decode(payload)));
    } catch {
        return null;
    }
}

async function refreshAccessToken(rt) {
    const response = await fetch(`${HIGHLIGHT_BASE_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
    });
    if (!response.ok) throw new Error("无法刷新access token");
    const respJson = await response.json();
    if (!respJson.success) throw new Error("刷新access token失败");
    const newAccessToken = respJson.data.accessToken;
    const payload = parseJwtPayload(newAccessToken);
    const expiresAt = payload?.exp || Math.floor(Date.now() / 1000) + 3600;
    accessTokens.set(rt, { access_token: newAccessToken, expires_at: expiresAt });
    return newAccessToken;
}

async function getAccessToken(rt) {
    const tokenInfo = accessTokens.get(rt);
    const currentTime = Math.floor(Date.now() / 1000);
    if (tokenInfo && tokenInfo.expires_at > currentTime + 60) {
        return tokenInfo.access_token;
    }
    return await refreshAccessToken(rt);
}

async function fetchModelsFromUpstream(accessToken) {
    const response = await fetch(`${HIGHLIGHT_BASE_URL}/api/v1/models`, {
        headers: { 'Authorization': `Bearer ${accessToken}`, 'User-Agent': USER_AGENT },
    });
    if (!response.ok) throw new Error("获取模型列表失败");
    const respJson = await response.json();
    if (!respJson.success) throw new Error("获取模型数据失败");
    modelCache.clear();
    for (const model of respJson.data) {
        modelCache.set(model.name, {
            id: model.id,
            name: model.name,
            provider: model.provider,
            isFree: model.pricing?.isFree || false,
        });
    }
}

async function getModels(accessToken) {
    if (modelCache.size === 0) {
        await fetchModelsFromUpstream(accessToken);
    }
    return modelCache;
}

function getHighlightHeaders(accessToken, identifier) {
    const headers = {
        "accept": "*/*",
        "accept-encoding": "gzip, deflate, br, zstd",
        "accept-language": "zh-CN",
        "authorization": `Bearer ${accessToken}`,
        "content-type": "application/json",
        "user-agent": USER_AGENT,
    };
    if (identifier) headers["identifier"] = identifier;
    return headers;
}

function formatMessagesToPrompt(messages: any[]) {
    const formattedMessages: string[] = [];
    for (const message of messages) {
        if (message.role) {
            if (message.content) {
                if (Array.isArray(message.content)) {
                    for (const item of message.content) {
                        formattedMessages.push(`${message.role}: ${item.text}`);
                    }
                } else {
                    formattedMessages.push(`${message.role}: ${message.content}`);
                }
            }
            if (message.tool_calls) formattedMessages.push(`${message.role}: ${JSON.stringify(message.tool_calls)}`);
            if (message.tool_call_id) formattedMessages.push(`${message.role}: tool_call_id: ${message.tool_call_id} ${message.content}`);
        }
    }
    return formattedMessages.join("\n\n");
}

function formatOpenAITools(openaiTools) {
    if (!openaiTools) return [];
    return openaiTools.map(tool => ({
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
    }));
}

function getCorsHeaders() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
        "Access-Control-Max-Age": "86400",
    };
}

function handleOptionsRequest() {
    return new Response(null, { status: 204, headers: getCorsHeaders() });
}

async function handleRequest(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (request.method === "OPTIONS") return handleOptionsRequest();

    if (path === "/" || path === "/index.html") {
        const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Highlight AI API</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f5f5f7; color: #1d1d1f; line-height: 1.6; font-size: 16px; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
        .container { max-width: 720px; margin: 0 auto; padding: 20px 16px; }
        .header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 1px solid #e5e5e7; }
        .header h1 { font-size: 36px; font-weight: 700; letter-spacing: -0.02em; color: #1d1d1f; margin-bottom: 12px; }
        .header p { font-size: 18px; color: #6e6e73; font-weight: 400; }
        .section { background: #ffffff; border-radius: 12px; padding: 20px; margin-bottom: 16px; border: 1px solid #e5e5e7; }
        .section-title { font-size: 20px; font-weight: 600; color: #1d1d1f; margin-bottom: 16px; display: flex; align-items: center; gap: 10px; }
        .step-number { width: 28px; height: 28px; background: #1d1d1f; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 600; }
        .form-group { margin: 16px 0; }
        .form-label { display: block; font-size: 15px; font-weight: 500; color: #1d1d1f; margin-bottom: 6px; }
        .form-input { width: 100%; padding: 12px 16px; border: 1px solid #d2d2d7; border-radius: 8px; font-size: 15px; background: #ffffff; color: #1d1d1f; transition: border-color 0.15s ease; }
        .form-input:focus { outline: none; border-color: #007aff; }
        .btn { display: inline-block; width: 100%; padding: 12px 20px; background: #1d1d1f; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 500; border: none; border-radius: 8px; cursor: pointer; transition: background-color 0.15s ease; text-align: center; }
        .loading { display: none; text-align: center; padding: 16px; color: #6e6e73; font-size: 15px; }
        .loading-spinner { width: 16px; height: 16px; border: 2px solid #d2d2d7; border-top: 2px solid #1d1d1f; border-radius: 50%; display: inline-block; animation: spin 1s linear infinite; margin-right: 8px; vertical-align: middle; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .result { margin-top: 16px; padding: 16px; border-radius: 8px; display: none; }
        .result.success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
        .result.error { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header"><h1>Highlight 2 API</h1></div>
        <div class="section">
            <div class="section-title"><span class="step-number">1</span>生成 API Key</div>
            <div class="form-group">
                <label class="form-label" for="codeInput">授权代码</label>
                <input type="text" id="codeInput" class="form-input" placeholder="粘贴从 highlightai.com 获取的 code">
            </div>
            <button class="btn" onclick="generateApiKey()" id="loginBtn">生成 API Key</button>
            <div class="loading" id="loading"><span class="loading-spinner"></span>正在处理...</div>
        </div>
        <div class="result" id="result"></div>
        <div class="section">
            <div class="section-title"><span class="step-number">2</span>测试 API Key</div>
            <div class="form-group">
                <label class="form-label" for="apiKeyInput">API Key</label>
                <input type="text" id="apiKeyInput" class="form-input" placeholder="粘贴生成的 API Key">
            </div>
            <button class="btn" onclick="loadModels()">获取模型列表</button>
        </div>
        <div class="result" id="modelsResult"></div>
        <div class="section">
            <div class="section-title"><span class="step-number">3</span>测试聊天接口</div>
            <div class="form-group">
                <label class="form-label" for="modelSelect">选择模型</label>
                <select id="modelSelect" class="form-input" disabled><option>请先获取模型列表</option></select>
            </div>
            <div class="form-group">
                <label class="form-label" for="chatMessage">消息</label>
                <textarea id="chatMessage" class="form-input" rows="4" placeholder="输入你的消息..."></textarea>
            </div>
            <button class="btn" onclick="testChat()" id="chatBtn">发送聊天请求</button>
            <div class="loading" id="chatLoading"><span class="loading-spinner"></span>等待响应...</div>
            <div class="result" id="chatResult" style="margin-top: 16px;"></div>
        </div>
    </div>
    <script>
        async function generateApiKey() {
            const code = document.getElementById('codeInput').value.trim();
            if (!code) { showResult('error', '请输入授权代码'); return; }
            document.getElementById('loginBtn').disabled = true;
            document.getElementById('loading').style.display = 'block';
            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code })
                });
                const data = await response.json();
                if (response.ok) {
                    const apiKey = btoa(JSON.stringify(data));
                    showResult('success', 'API Key 生成成功: <br>' + apiKey);
                    document.getElementById('apiKeyInput').value = apiKey;
                } else {
                    showResult('error', '生成失败: ' + data.error);
                }
            } catch (error) {
                showResult('error', '请求失败: ' + error.message);
            } finally {
                document.getElementById('loginBtn').disabled = false;
                document.getElementById('loading').style.display = 'none';
            }
        }
        async function loadModels() {
            const apiKey = document.getElementById('apiKeyInput').value.trim();
            if (!apiKey) { showResult('error', '请输入 API Key', 'modelsResult'); return; }
            try {
                const response = await fetch('/v1/models', { headers: { 'Authorization': 'Bearer ' + apiKey } });
                const data = await response.json();
                if (response.ok) {
                    showResult('success', '获取模型成功: <br>' + JSON.stringify(data.data, null, 2), 'modelsResult');
                    populateModelSelect(data.data);
                } else {
                    showResult('error', '获取失败: ' + data.error, 'modelsResult');
                }
            } catch (error) {
                showResult('error', '请求失败: ' + error.message, 'modelsResult');
            }
        }
        function populateModelSelect(models) {
            const select = document.getElementById('modelSelect');
            select.innerHTML = '';
            if (models && models.length > 0) {
                models.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.id;
                    option.textContent = model.id;
                    select.appendChild(option);
                });
                select.disabled = false;
            } else {
                select.innerHTML = '<option>无可用模型</option>';
                select.disabled = true;
            }
        }
        async function testChat() {
            const apiKey = document.getElementById('apiKeyInput').value.trim();
            const model = document.getElementById('modelSelect').value;
            const message = document.getElementById('chatMessage').value.trim();
            if (!apiKey || !message) { showResult('error', 'API Key 和消息不能为空', 'chatResult'); return; }
            document.getElementById('chatBtn').disabled = true;
            document.getElementById('chatLoading').style.display = 'block';
            try {
                const response = await fetch('/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
                    body: JSON.stringify({ model, messages: [{ role: 'user', content: message }] })
                });
                const data = await response.json();
                if (response.ok) {
                    showResult('success', '响应: <br>' + data.choices[0].message.content, 'chatResult');
                } else {
                    showResult('error', '请求失败: ' + data.error, 'chatResult');
                }
            } catch (error) {
                showResult('error', '请求异常: ' + error.message, 'chatResult');
            } finally {
                document.getElementById('chatBtn').disabled = false;
                document.getElementById('chatLoading').style.display = 'none';
            }
        }
        function showResult(type, content, elementId = 'result') {
            const resultEl = document.getElementById(elementId);
            resultEl.className = 'result ' + type;
            resultEl.innerHTML = content;
            resultEl.style.display = 'block';
        }
    </script>
</body>
</html>`;
        return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", ...getCorsHeaders() } });
    }

    if (path === "/health") {
        return new Response(JSON.stringify({ status: "healthy", timestamp: Math.floor(Date.now() / 1000) }), { headers: { "Content-Type": "application/json", ...getCorsHeaders() } });
    }

    if (path === "/login" && request.method === "POST") {
        try {
            const { code } = await request.json();
            if (!code) return new Response(JSON.stringify({ error: "Missing code parameter" }), { status: 400, headers: { "Content-Type": "application/json", ...getCorsHeaders() } });
            const userInfo = await login(code);
            return new Response(JSON.stringify(userInfo), { headers: { "Content-Type": "application/json", ...getCorsHeaders() } });
        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json", ...getCorsHeaders() } });
        }
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Missing authorization token" }), { status: 401, headers: { "Content-Type": "application/json", ...getCorsHeaders() } });
    const token = authHeader.substring(7);
    const userInfo = parseApiKey(token);
    if (!userInfo || !userInfo.rt) return new Response(JSON.stringify({ error: "Invalid authorization token" }), { status: 401, headers: { "Content-Type": "application/json", ...getCorsHeaders() } });

    if (path === "/v1/models" && request.method === "GET") {
        try {
            const accessToken = await getAccessToken(userInfo.rt);
            const models = await getModels(accessToken);
            const modelList = Array.from(models.entries()).map(([modelName, modelInfo]) => ({ id: modelName, object: "model", created: Math.floor(Date.now() / 1000), owned_by: modelInfo.provider }));
            return new Response(JSON.stringify({ object: "list", data: modelList }), { headers: { "Content-Type": "application/json", ...getCorsHeaders() } });
        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json", ...getCorsHeaders() } });
        }
    }

    if (path === "/v1/chat/completions" && request.method === "POST") {
        try {
            const reqData = await request.json();
            if (!userInfo.user_id || !userInfo.client_uuid) return new Response(JSON.stringify({ error: "Invalid authorization token - missing required fields" }), { status: 401, headers: { "Content-Type": "application/json", ...getCorsHeaders() } });
            const accessToken = await getAccessToken(userInfo.rt);
            const models = await getModels(accessToken);
            const modelInfo = models.get(reqData.model || "gpt-4o");
            if (!modelInfo) return new Response(JSON.stringify({ error: `Model '${reqData.model}' not found` }), { status: 400, headers: { "Content-Type": "application/json", ...getCorsHeaders() } });
            const prompt = formatMessagesToPrompt(reqData.messages);
            const tools = formatOpenAITools(reqData.tools);
            const identifier = await getIdentifier(userInfo.user_id, userInfo.client_uuid, undefined);
            const highlightData = { prompt, attachedContext: [], modelId: modelInfo.id, additionalTools: tools, backendPlugins: [], useMemory: false, useKnowledge: false, ephemeral: false, timezone: "Asia/Hong_Kong" };
            const headers = getHighlightHeaders(accessToken, identifier);
            
            if (reqData.stream) {
                const readable = new ReadableStream({
                    async start(controller) {
                        try {
                            const response = await fetch(`${HIGHLIGHT_BASE_URL}/api/v1/chat`, { method: 'POST', headers, body: JSON.stringify(highlightData) });
                            if (!response.ok) {
                                controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: { message: `Highlight API returned status code ${response.status}`, type: "api_error" } })}\n\n`));
                                controller.close(); return;
                            }
                            const responseId = `chatcmpl-${crypto.randomUUID()}`;
                            const created = Math.floor(Date.now() / 1000);
                            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ id: responseId, object: "chat.completion.chunk", created, model: reqData.model || "gpt-4o", choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }] })}\n\n`));
                            const reader = response.body?.getReader();
                            if (!reader) { controller.close(); return; }
                            let buffer = "";
                            while (true) {
                                const { done, value } = await reader.read();
                                if (done) break;
                                buffer += new TextDecoder().decode(value);
                                while (buffer.includes("\n")) {
                                    const lineEnd = buffer.indexOf("\n");
                                    const line = buffer.substring(0, lineEnd);
                                    buffer = buffer.substring(lineEnd + 1);
                                    if (line.startsWith("data: ")) {
                                        const data = line.substring(6).trim();
                                        if (data) {
                                            try {
                                                const eventData = JSON.parse(data);
                                                if (eventData.type === "text" && eventData.content) {
                                                    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ id: responseId, object: "chat.completion.chunk", created, model: reqData.model || "gpt-4o", choices: [{ index: 0, delta: { content: eventData.content }, finish_reason: null }] })}\n\n`));
                                                }
                                            } catch {}
                                        }
                                    }
                                }
                            }
                            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ id: responseId, object: "chat.completion.chunk", created, model: reqData.model || "gpt-4o", choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\n`));
                            controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
                            controller.close();
                        } catch (error) {
                            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: { message: error.message, type: "server_error" } })}\n\n`));
                            controller.close();
                        }
                    }
                });
                return new Response(readable, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive", ...getCorsHeaders() } });
            } else {
                const response = await fetch(`${HIGHLIGHT_BASE_URL}/api/v1/chat`, { method: 'POST', headers, body: JSON.stringify(highlightData) });
                if (!response.ok) return new Response(JSON.stringify({ error: { message: `Highlight API returned status code ${response.status}`, type: "api_error" } }), { status: response.status, headers: { "Content-Type": "application/json", ...getCorsHeaders() } });
                let fullResponse = "";
                const reader = response.body?.getReader();
                if (reader) {
                    let buffer = "";
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        buffer += new TextDecoder().decode(value);
                        while (buffer.includes("\n")) {
                            const lineEnd = buffer.indexOf("\n");
                            const line = buffer.substring(0, lineEnd);
                            buffer = buffer.substring(lineEnd + 1);
                            if (line.startsWith("data: ")) {
                                const data = line.substring(6).trim();
                                if (data) {
                                    try {
                                        const eventData = JSON.parse(data);
                                        if (eventData.type === "text") fullResponse += eventData.content || "";
                                    } catch {}
                                }
                            }
                        }
                    }
                }
                const responseId = `chatcmpl-${crypto.randomUUID()}`;
                const responseData = { id: responseId, object: "chat.completion", created: Math.floor(Date.now() / 1000), model: reqData.model || "gpt-4o", choices: [{ index: 0, message: { role: "assistant", content: fullResponse }, finish_reason: "stop" }], usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } };
                return new Response(JSON.stringify(responseData), { headers: { "Content-Type": "application/json", ...getCorsHeaders() } });
            }
        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json", ...getCorsHeaders() } });
        }
    }
    return new Response("Not Found", { status: 404, headers: getCorsHeaders() });
}

// onRequest is the entry point for Cloudflare Pages Functions
export async function onRequest(context: any) {
  // context contains: request, env, params, waitUntil, next, data
  return handleRequest(context.request);
}
