const isNode = typeof window === 'undefined';
const windowObj = isNode ? {} : window;

let storage = null;
if (!isNode) {
  try { storage = windowObj.localStorage; } catch {}
}

const safeStorageGet = (key) => {
  try { return storage?.getItem?.(key) ?? null; } catch { return null; }
};

const safeStorageSet = (key, value) => {
  try { storage?.setItem?.(key, value); } catch {}
};

const safeStorageRemove = (key) => {
  try { storage?.removeItem?.(key); } catch {}
};

const toSnakeCase = (str) => {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase();
};

const getAppParamValue = (paramName, { defaultValue = undefined, removeFromUrl = false } = {}) => {
  if (isNode) {
    return defaultValue;
  }
  const storageKey = `base44_${toSnakeCase(paramName)}`;
  const urlParams = new URLSearchParams(window.location.search);
  const searchParam = urlParams.get(paramName);
  if (removeFromUrl) {
    urlParams.delete(paramName);
    const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ""}${window.location.hash}`;
    window.history.replaceState({}, document.title, newUrl);
  }
  if (searchParam) {
    safeStorageSet(storageKey, searchParam);
    return searchParam;
  }
  if (defaultValue) {
    safeStorageSet(storageKey, defaultValue);
    return defaultValue;
  }
  const storedValue = safeStorageGet(storageKey);
  if (storedValue) {
    return storedValue;
  }
  return null;
};

const runtimeConfigOverridesAllowed = () => {
  if (isNode) return false;
  const host = window.location.hostname.toLowerCase();
  return host === 'localhost'
    || host === '127.0.0.1'
    || host.includes('preview')
    || host.includes('sandbox');
};

const getRuntimeConfigValue = (paramName, defaultValue) => {
  if (isNode) return defaultValue || null;
  const storageKey = `base44_${toSnakeCase(paramName)}`;

  if (runtimeConfigOverridesAllowed()) {
    return getAppParamValue(paramName, { defaultValue });
  }

  // On normal/production hosts, URL and previously persisted overrides for
  // backend/app configuration are untrusted. Always heal storage back to the
  // build-time value instead of allowing a crafted same-origin link to repoint
  // the SDK at another app/backend.
  if (defaultValue) {
    safeStorageSet(storageKey, defaultValue);
    return defaultValue;
  }
  safeStorageRemove(storageKey);
  return null;
};

const getAppParams = () => {
  const clearAccessToken = getAppParamValue("clear_access_token", { removeFromUrl: true });
  // clear_access_token is a one-shot command, never persistent configuration.
  // getAppParamValue stores URL parameters by default, so remove its storage
  // key immediately or every future app load would keep clearing the session.
  safeStorageRemove('base44_clear_access_token');
  if (clearAccessToken === 'true') {
    safeStorageRemove('base44_access_token');
    safeStorageRemove('base44_token');
    safeStorageRemove('token');
  }
  return {
    appId: getRuntimeConfigValue("app_id", import.meta.env.VITE_BASE44_APP_ID),
    token: getAppParamValue("access_token", { removeFromUrl: true }),
    fromUrl: getAppParamValue("from_url", { defaultValue: window.location.href }),
    functionsVersion: getRuntimeConfigValue("functions_version", import.meta.env.VITE_BASE44_FUNCTIONS_VERSION),
    serverUrl: getRuntimeConfigValue("backend_url", import.meta.env.VITE_BASE44_BACKEND_URL || 'https://base44.app'),
    appBaseUrl: getRuntimeConfigValue("app_base_url", import.meta.env.VITE_BASE44_APP_BASE_URL || window.location.origin),
  };
};

export const appParams = {
  ...getAppParams()
};
