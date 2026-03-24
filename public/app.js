const totalUsedEl = document.getElementById("totalUsed");
const totalLimitEl = document.getElementById("totalLimit");
const totalPercentEl = document.getElementById("totalPercent");
const totalUsedLabelEl = document.getElementById("totalUsedLabel");
const totalLimitLabelEl = document.getElementById("totalLimitLabel");
const totalPercentLabelEl = document.getElementById("totalPercentLabel");
const lastUpdatedEl = document.getElementById("lastUpdated");
const refreshHintEl = document.getElementById("refreshHint");
const gridEl = document.getElementById("providerGrid");
const noticeEl = document.getElementById("notice");
const refreshBtn = document.getElementById("refreshBtn");

const titleTextEl = document.getElementById("titleText");
const subtitleTextEl = document.getElementById("subtitleText");
const themeLabelEl = document.getElementById("themeLabel");
const languageLabelEl = document.getElementById("languageLabel");

const themeSelect = document.getElementById("themeSelect");
const langSelect = document.getElementById("langSelect");
const themeDarkOptionEl = document.getElementById("themeDarkOption");
const themeLightOptionEl = document.getElementById("themeLightOption");
const langZhOptionEl = document.getElementById("langZhOption");
const langEnOptionEl = document.getElementById("langEnOption");

const STORAGE_THEME = "token_hub_theme";
const STORAGE_LANG = "token_hub_lang";

const state = {
  theme: "dark",
  lang: "zh",
  payload: null
};

const messages = {
  zh: {
    pageTitle: "Token 用量总览",
    title: "Token 用量总览",
    subtitle: "在一个页面查看各平台 API Token 与免费额度。",
    refresh: "刷新",
    themeLabel: "主题",
    languageLabel: "语言",
    themeDark: "黑夜骑士",
    themeLight: "清新白天",
    langZh: "中文",
    langEn: "English",
    totalUsed: "总已用",
    totalLimit: "总上限",
    overallUsage: "总体占比",
    lastUpdated: "上次更新",
    autoRefresh: "自动刷新",
    everySeconds: "每 {seconds} 秒",
    noProviders: "还没有配置平台，请编辑 providers.config.json。",
    failedLoad: "加载失败：{message}",
    unknownError: "未知错误",
    used: "已用",
    limit: "上限",
    remaining: "剩余",
    usage: "占比",
    unlimited: "无限制",
    statusLive: "实时",
    statusPortal: "跳转",
    statusDisabled: "禁用",
    statusError: "错误",
    statusUnknown: "未知",
    openUsagePage: "打开用量页面",
    openProviderDashboard: "点击下方按钮进入平台控制台。",
    missingPortalUrl: "缺少跳转地址（portalUrl）",
    providerDisabled: "该平台已在配置中禁用。",
    liveData: "实时数据"
  },
  en: {
    pageTitle: "Token Usage Hub",
    title: "Token Usage Hub",
    subtitle: "Monitor API token and free-credit usage from all providers in one place.",
    refresh: "Refresh",
    themeLabel: "Theme",
    languageLabel: "Language",
    themeDark: "Dark Knight",
    themeLight: "Fresh Light",
    langZh: "Chinese",
    langEn: "English",
    totalUsed: "Total Used",
    totalLimit: "Total Limit",
    overallUsage: "Overall Usage",
    lastUpdated: "Last updated",
    autoRefresh: "Auto refresh",
    everySeconds: "every {seconds}s",
    noProviders: "No providers configured yet. Edit providers.config.json.",
    failedLoad: "Failed to load: {message}",
    unknownError: "unknown error",
    used: "Used",
    limit: "Limit",
    remaining: "Remaining",
    usage: "Usage",
    unlimited: "Unlimited",
    statusLive: "Live",
    statusPortal: "Portal",
    statusDisabled: "Disabled",
    statusError: "Error",
    statusUnknown: "Unknown",
    openUsagePage: "Open usage page",
    openProviderDashboard: "Open provider dashboard using the button below.",
    missingPortalUrl: "Missing portal URL (portalUrl)",
    providerDisabled: "Provider disabled in config.",
    liveData: "Live data"
  }
};

let refreshTimer = null;

function t(key, vars) {
  const table = messages[state.lang] || messages.zh;
  const fallback = messages.en;
  const template = table[key] || fallback[key] || key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name) => {
    if (vars[name] == null) return `{${name}}`;
    return String(vars[name]);
  });
}

function currentLocale() {
  return state.lang === "zh" ? "zh-CN" : "en-US";
}

function formatNumber(value) {
  if (value == null) return "-";
  return new Intl.NumberFormat(currentLocale()).format(Math.round(value));
}

function formatPercent(value) {
  if (value == null || Number.isNaN(value)) return "-";
  return `${value.toFixed(1)}%`;
}

function showNotice(message) {
  if (!message) {
    noticeEl.classList.add("hidden");
    noticeEl.textContent = "";
    return;
  }
  noticeEl.classList.remove("hidden");
  noticeEl.textContent = message;
}

function applyTheme(theme) {
  const resolvedTheme = theme === "light" ? "light" : "dark";
  state.theme = resolvedTheme;
  document.documentElement.setAttribute("data-theme", resolvedTheme);
  themeSelect.value = resolvedTheme;
  localStorage.setItem(STORAGE_THEME, resolvedTheme);
}

function applyLanguage(lang) {
  const resolvedLang = lang === "en" ? "en" : "zh";
  state.lang = resolvedLang;
  document.documentElement.lang = resolvedLang === "zh" ? "zh-CN" : "en";
  langSelect.value = resolvedLang;
  localStorage.setItem(STORAGE_LANG, resolvedLang);

  document.title = t("pageTitle");
  titleTextEl.textContent = t("title");
  subtitleTextEl.textContent = t("subtitle");
  refreshBtn.textContent = t("refresh");

  themeLabelEl.textContent = t("themeLabel");
  languageLabelEl.textContent = t("languageLabel");
  themeDarkOptionEl.textContent = t("themeDark");
  themeLightOptionEl.textContent = t("themeLight");
  langZhOptionEl.textContent = t("langZh");
  langEnOptionEl.textContent = t("langEn");

  totalUsedLabelEl.textContent = t("totalUsed");
  totalLimitLabelEl.textContent = t("totalLimit");
  totalPercentLabelEl.textContent = t("overallUsage");

  if (state.payload) {
    render(state.payload);
  } else {
    updateStatusLine(null, 60);
  }
}

function statusText(status) {
  if (status === "ok") return t("statusLive");
  if (status === "link") return t("statusPortal");
  if (status === "disabled") return t("statusDisabled");
  if (status === "error") return t("statusError");
  return t("statusUnknown");
}

function statusClass(status) {
  if (status === "ok") return "ok";
  if (status === "link") return "link";
  if (status === "disabled") return "disabled";
  return "error";
}

function fallbackMessage(provider) {
  if (provider.status === "link") return t("openProviderDashboard");
  if (provider.status === "disabled") return t("providerDisabled");
  if (provider.status === "ok") return t("liveData");
  return "";
}

function updateStatusLine(payload, fallbackRefreshSeconds) {
  const updatedAt = payload && payload.generatedAt ? new Date(payload.generatedAt) : null;
  const seconds = Math.max(10, Number((payload && payload.refreshSeconds) || fallbackRefreshSeconds || 60));

  lastUpdatedEl.textContent = `${t("lastUpdated")}: ${updatedAt ? updatedAt.toLocaleString(currentLocale()) : "-"}`;
  refreshHintEl.textContent = `${t("autoRefresh")}: ${t("everySeconds", { seconds })}`;
}

function buildProviderCard(provider) {
  const card = document.createElement("article");
  card.className = "provider-card";

  const linkLabel = provider.linkLabel || t("openUsagePage");
  const message = provider.message || fallbackMessage(provider);

  if (provider.status === "link") {
    card.innerHTML = `
      <header>
        <h3>${provider.name}</h3>
        <span class="pill link">${statusText(provider.status)}</span>
      </header>
      <p class="provider-message">${message}</p>
      ${
        provider.portalUrl
          ? `<a class="quick-link" href="${provider.portalUrl}" target="_blank" rel="noopener noreferrer">${linkLabel}</a>`
          : `<p class="provider-message">${t("missingPortalUrl")}</p>`
      }
    `;
    return card;
  }

  const used = formatNumber(provider.usedTokens);
  const limit = provider.limitTokens == null ? t("unlimited") : formatNumber(provider.limitTokens);
  const remaining = provider.remainingTokens == null ? "-" : formatNumber(provider.remainingTokens);
  const percent = formatPercent(provider.usagePercent);

  card.innerHTML = `
    <header>
      <h3>${provider.name}</h3>
      <span class="pill ${statusClass(provider.status)}">${statusText(provider.status)}</span>
    </header>
    <div class="metric-row"><span>${t("used")}</span><strong>${used} ${provider.unit || "tokens"}</strong></div>
    <div class="metric-row"><span>${t("limit")}</span><strong>${limit}</strong></div>
    <div class="metric-row"><span>${t("remaining")}</span><strong>${remaining}</strong></div>
    <div class="metric-row"><span>${t("usage")}</span><strong>${percent}</strong></div>
    <div class="progress"><div style="width: ${provider.usagePercent || 0}%"></div></div>
    <p class="provider-message">${message}</p>
    ${
      provider.portalUrl
        ? `<a class="quick-link" href="${provider.portalUrl}" target="_blank" rel="noopener noreferrer">${linkLabel}</a>`
        : ""
    }
  `;

  return card;
}

function render(payload) {
  state.payload = payload;
  const providers = Array.isArray(payload.providers) ? payload.providers : [];

  const usedTotal = providers
    .filter((provider) => provider.status === "ok" && provider.usedTokens != null)
    .reduce((sum, provider) => sum + provider.usedTokens, 0);

  const limitTotal = providers
    .filter((provider) => provider.status === "ok" && provider.limitTokens != null)
    .reduce((sum, provider) => sum + provider.limitTokens, 0);

  const percentTotal = limitTotal > 0 ? (usedTotal / limitTotal) * 100 : null;

  totalUsedEl.textContent = formatNumber(usedTotal);
  totalLimitEl.textContent = limitTotal > 0 ? formatNumber(limitTotal) : "-";
  totalPercentEl.textContent = formatPercent(percentTotal);

  updateStatusLine(payload, 60);

  if (providers.length === 0) {
    showNotice(t("noProviders"));
  } else {
    showNotice(payload.error || "");
  }

  gridEl.innerHTML = "";
  for (const provider of providers) {
    gridEl.appendChild(buildProviderCard(provider));
  }
}

async function loadUsage() {
  refreshBtn.disabled = true;
  try {
    const response = await fetch("/api/usage", { cache: "no-store" });
    const payload = await response.json();
    render(payload);

    if (refreshTimer) clearInterval(refreshTimer);
    const intervalMs = Math.max(10, Number(payload.refreshSeconds || 60)) * 1000;
    refreshTimer = setInterval(loadUsage, intervalMs);
  } catch (error) {
    showNotice(
      t("failedLoad", {
        message: (error && error.message) || t("unknownError")
      })
    );
  } finally {
    refreshBtn.disabled = false;
  }
}

function initializePreferences() {
  const savedTheme = localStorage.getItem(STORAGE_THEME) || "dark";
  const savedLang = localStorage.getItem(STORAGE_LANG) || "zh";
  applyTheme(savedTheme);
  applyLanguage(savedLang);
}

refreshBtn.addEventListener("click", () => loadUsage());

themeSelect.addEventListener("change", (event) => {
  applyTheme(event.target.value);
});

langSelect.addEventListener("change", (event) => {
  applyLanguage(event.target.value);
});

initializePreferences();
loadUsage();
