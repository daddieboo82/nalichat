const isNode = typeof window === 'undefined';
const windowObj = isNode ? { localStorage: new Map() } : window;
const storage = windowObj.localStorage;

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
    storage.setItem(storageKey, searchParam);
    return searchParam;
  }
  if (defaultValue) {
    storage.setItem(storageKey, defaultValue);
    return defaultValue;
  }
  const storedValue = storage.getItem(storageKey);
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
    storage.setItem(storageKey, defaultValue);
    return defaultValue;
  }
  storage.removeItem(storageKey);
  return null;
};

const getAppParams = () => {
  const clearAccessToken = getAppParamValue("clear_access_token", { removeFromUrl: true });
  // clear_access_token is a one-shot command, never persistent configuration.
  // getAppParamValue stores URL parameters by default, so remove its storage
  // key immediately or every future app load would keep clearing the session.
  storage.removeItem('base44_clear_access_token');
  if (clearAccessToken === 'true') {
    storage.removeItem('base44_access_token');
    storage.removeItem('base44_token');
    storage.removeItem('token');
  }
  return {
    appId: getRuntimeConfigValue("app_id", import.meta.env.VITE_BASE44_APP_ID),
    token: getAppParamValue("access_token", { removeFromUrl: true }),
    fromUrl: getAppParamValue("from_url", { defaultValue: window.location.href }),
    functionsVersion: getRuntimeConfigValue("functions_version", import.meta.env.VITE_BASE44_FUNCTIONS_VERSION),
    appBaseUrl: getRuntimeConfigValue("app_base_url", import.meta.env.VITE_BASE44_APP_BASE_URL || window.location.origin),
  };
};

export const appParams = {
  ...getAppParams()
};
