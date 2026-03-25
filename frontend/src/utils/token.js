const AUTH_TOKEN_KEY = 'authToken';

export const getToken = () => {
  // Tokens are now in HttpOnly cookies and managed by the browser
  return null; 
};

export const setToken = (token) => {
  // Tokens are now set by the backend via Set-Cookie header
};

export const removeToken = () => {
  // Tokens are now removed by the backend /logout/ endpoint
};
