import React, { createContext, useContext } from 'react';

const AuthContext = createContext({
  user: null,
  isAuthenticated: false,
  isLoadingAuth: false,
  isLoadingPublicSettings: false,
  authError: null,
  authChecked: true,
  navigateToLogin: () => {},
});

export const AuthProvider = ({ children }) => (
  <AuthContext.Provider value={{
    user: null,
    isAuthenticated: false,
    isLoadingAuth: false,
    isLoadingPublicSettings: false,
    authError: null,
    authChecked: true,
    navigateToLogin: () => {},
  }}>
    {children}
  </AuthContext.Provider>
);

export const useAuth = () => useContext(AuthContext);
