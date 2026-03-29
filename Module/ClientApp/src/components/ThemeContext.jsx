import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const themes = [
  { id: 'default', color: '250 84% 54%', label: 'Indigo' },
  { id: 'emerald', color: '161 94% 30%', label: 'Emerald' },
  { id: 'rose', color: '346 84% 61%', label: 'Rose' },
  { id: 'amber', color: '38 92% 50%', label: 'Amber' },
  { id: 'sky', color: '199 89% 48%', label: 'Sky' }
];

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(localStorage.getItem('app-theme') || 'default');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
