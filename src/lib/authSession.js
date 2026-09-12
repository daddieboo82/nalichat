const extractAuthToken = (result) => {
  if (typeof result === 'string') return result;
  return result?.access_token
    || result?.token
    || result?.data?.access_token
    || result?.data?.token
    || null;
};

export const persistAuthResult = (result) => {
  const token = extractAuthToken(result);
  if (!token) return null;

  try {
    localStorage.setItem('base44_access_token', token);
  } catch {}

  return token;
};

export const clearPersistedAuthTokens = () => {
  try {
    localStorage.removeItem('base44_access_token');
    localStorage.removeItem('base44_token');
    localStorage.removeItem('token');
    sessionStorage.removeItem('base44_access_token');
    sessionStorage.removeItem('base44_token');
    sessionStorage.removeItem('token');
  } catch {}
};
