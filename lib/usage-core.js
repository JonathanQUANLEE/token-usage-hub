const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.join(__dirname, "..");
const ENV_PATH = path.join(PROJECT_ROOT, ".env");
const CONFIG_CANDIDATE_PATHS = [
  path.join(PROJECT_ROOT, "providers.config.json"),
  path.join(process.cwd(), "providers.config.json"),
  path.join(process.cwd(), "public", "providers.config.json"),
  path.join(__dirname, "providers.config.json"),
  path.join(__dirname, "..", "providers.config.json"),
  path.join(__dirname, "..", "..", "providers.config.json")
];

const defaultConfig = {
  refreshSeconds: 60,
  providers: []
};

loadDotEnv(ENV_PATH);

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalIndex = trimmed.indexOf("=");
    if (equalIndex <= 0) continue;
    const key = trimmed.slice(0, equalIndex).trim();
    let value = trimmed.slice(equalIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function normalizeConfig(parsed) {
  return {
    refreshSeconds: Number(parsed.refreshSeconds || 60),
    providers: Array.isArray(parsed.providers) ? parsed.providers : []
  };
}

function loadBundledConfig() {
  try {
    const bundledPath = require.resolve("../providers.config.json");
    delete require.cache[bundledPath];
    return require(bundledPath);
  } catch {
    return null;
  }
}

function readConfig() {
  for (const configPath of CONFIG_CANDIDATE_PATHS) {
    if (!fs.existsSync(configPath)) continue;
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw);
    return normalizeConfig(parsed);
  }

  const bundledConfig = loadBundledConfig();
  if (bundledConfig) {
    return normalizeConfig(bundledConfig);
  }

  return defaultConfig;
}

function resolveTemplateString(input) {
  if (typeof input !== "string") return { value: input, missingVars: [] };
  const missingVars = [];
  const value = input.replace(/\$\{([A-Z0-9_]+)\}/g, (_, varName) => {
    if (process.env[varName] == null || process.env[varName] === "") {
      missingVars.push(varName);
      return "";
    }
    return process.env[varName];
  });
  return { value, missingVars };
}

function safeNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function pickPath(obj, dotPath) {
  if (!dotPath) return null;
  const segments = String(dotPath).split(".");
  let current = obj;
  for (const segment of segments) {
    if (current == null) return null;
    const match = segment.match(/^([^\[]+)\[(\d+)\]$/);
    if (match) {
      const key = match[1];
      const index = Number(match[2]);
      current = current[key];
      if (!Array.isArray(current) || current[index] == null) return null;
      current = current[index];
      continue;
    }
    current = current[segment];
  }
  return current == null ? null : current;
}

function summarizeUsage(usedTokens, limitTokens) {
  const used = safeNumber(usedTokens);
  const limit = safeNumber(limitTokens);
  const remaining = limit != null ? Math.max(0, limit - (used || 0)) : null;
  const usagePercent =
    limit && limit > 0 && used != null
      ? Math.min(100, Math.max(0, (used / limit) * 100))
      : null;
  return {
    usedTokens: used,
    limitTokens: limit,
    remainingTokens: remaining,
    usagePercent
  };
}

async function fetchProviderUsage(provider) {
  const portalResolved = resolveTemplateString(provider.portalUrl || "");
  const portalUrl =
    portalResolved.missingVars.length === 0 ? portalResolved.value || null : null;

  const baseResult = {
    id: provider.id || provider.name || "unknown",
    name: provider.name || provider.id || "Unknown",
    unit: provider.unit || "tokens",
    portalUrl,
    linkLabel: provider.linkLabel || "Open usage page"
  };

  if (provider.enabled === false) {
    return {
      ...baseResult,
      status: "disabled",
      message: "Provider disabled in config."
    };
  }

  if (provider.mode === "external-link") {
    if (!provider.portalUrl) {
      return {
        ...baseResult,
        status: "error",
        message: "Missing portalUrl for external-link provider."
      };
    }

    if (portalResolved.missingVars.length > 0) {
      return {
        ...baseResult,
        status: "error",
        message: `Missing env vars: ${Array.from(new Set(portalResolved.missingVars)).join(", ")}`
      };
    }

    return {
      ...baseResult,
      status: "link",
      message: provider.message || "Click button below to open provider dashboard."
    };
  }

  if (provider.mode === "mock") {
    const summary = summarizeUsage(
      provider.mock && provider.mock.usedTokens,
      provider.mock && provider.mock.limitTokens
    );
    return {
      ...baseResult,
      status: "ok",
      ...summary,
      message: "Mock data"
    };
  }

  if (provider.mode !== "http-json") {
    return {
      ...baseResult,
      status: "error",
      message: "Unsupported provider mode. Use 'mock', 'http-json', or 'external-link'."
    };
  }

  const request = provider.request || {};
  const urlResolved = resolveTemplateString(request.url || "");
  const missing = [...urlResolved.missingVars];

  const headers = {};
  const rawHeaders = request.headers || {};
  for (const [headerName, headerValue] of Object.entries(rawHeaders)) {
    const resolved = resolveTemplateString(headerValue);
    headers[headerName] = resolved.value;
    missing.push(...resolved.missingVars);
  }

  if (!urlResolved.value) {
    return {
      ...baseResult,
      status: "error",
      message: "Missing request.url in provider config."
    };
  }

  if (missing.length > 0) {
    return {
      ...baseResult,
      status: "error",
      message: `Missing env vars: ${Array.from(new Set(missing)).join(", ")}`
    };
  }

  const controller = new AbortController();
  const timeoutMs = Number(provider.timeoutMs || 15000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(urlResolved.value, {
      method: request.method || "GET",
      headers,
      signal: controller.signal
    });

    const contentType = response.headers.get("content-type") || "";
    let body = null;

    if (contentType.includes("application/json")) {
      body = await response.json();
    } else {
      const text = await response.text();
      try {
        body = JSON.parse(text);
      } catch {
        body = { text };
      }
    }

    if (!response.ok) {
      return {
        ...baseResult,
        status: "error",
        message: `HTTP ${response.status} ${response.statusText}`
      };
    }

    const mapping = provider.mapping || {};
    const usedRaw = pickPath(body, mapping.usedTokensPath);
    const limitRaw = pickPath(body, mapping.limitTokensPath);
    const summary = summarizeUsage(usedRaw, limitRaw);

    if (summary.usedTokens == null) {
      return {
        ...baseResult,
        status: "error",
        message:
          "Could not extract usedTokens. Check mapping.usedTokensPath and API response JSON."
      };
    }

    return {
      ...baseResult,
      status: "ok",
      ...summary,
      message: "Live data"
    };
  } catch (error) {
    const message =
      error && error.name === "AbortError"
        ? `Request timeout after ${timeoutMs}ms`
        : `Request failed: ${error.message || "unknown error"}`;
    return {
      ...baseResult,
      status: "error",
      message
    };
  } finally {
    clearTimeout(timer);
  }
}

async function buildUsageResponse() {
  let config;
  try {
    config = readConfig();
  } catch (error) {
    return {
      ok: false,
      generatedAt: new Date().toISOString(),
      refreshSeconds: 60,
      providers: [],
      error: `Invalid providers.config.json: ${error.message}`
    };
  }

  const providers = await Promise.all(
    (config.providers || []).map((provider) => fetchProviderUsage(provider))
  );

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    refreshSeconds: Number(config.refreshSeconds || 60),
    providers
  };
}

function buildProvidersMetaResponse() {
  const config = readConfig();
  const safeProviders = (config.providers || []).map((provider) => ({
    id: provider.id || provider.name || "unknown",
    name: provider.name || provider.id || "Unknown",
    mode: provider.mode || "unknown",
    enabled: provider.enabled !== false
  }));

  return {
    ok: true,
    refreshSeconds: Number(config.refreshSeconds || 60),
    providers: safeProviders
  };
}

module.exports = {
  readConfig,
  buildUsageResponse,
  buildProvidersMetaResponse
};
