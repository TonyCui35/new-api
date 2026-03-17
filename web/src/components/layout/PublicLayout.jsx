import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PublicHeader from './PublicHeader';
import '../../styles/public.css';

const THEME_KEY = 'elkapi-pub-theme';

export default function PublicLayout({ children }) {
  const { t } = useTranslation();
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-pub-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));

  return (
    <div className="pub-root" data-pub-theme={theme}>
      <PublicHeader theme={theme} onThemeToggle={toggleTheme} />
      <main>{children}</main>
      <footer className="pub-footer">
        <div className="pub-footer-inner">
          <div>
            <div className="pub-footer-brand">ElkAPI</div>
            <div className="pub-footer-copy" style={{ marginTop: 4 }}>
              © {new Date().getFullYear()} ElkAPI. {t('保留所有权利。')}
            </div>
          </div>
          <div className="pub-footer-links">
            <Link to="/models" className="pub-footer-link">{t('模型')}</Link>
            <Link to="/pricing" className="pub-footer-link">{t('价格')}</Link>
            <Link to="/about" className="pub-footer-link">{t('关于')}</Link>
            <Link to="/privacy-policy" className="pub-footer-link">{t('隐私政策')}</Link>
            <Link to="/user-agreement" className="pub-footer-link">{t('用户协议')}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
