import React, { useContext, useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UserContext } from '../../context/User';

/* ── Icon: sun / moon for theme toggle ── */
function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  );
}

export default function PublicHeader({ theme, onThemeToggle }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [userState] = useContext(UserContext);
  const [searchQ, setSearchQ] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQ.trim()) navigate(`/models?q=${encodeURIComponent(searchQ.trim())}`);
  };

  return (
    <header className="pub-header">
      <div className="pub-header-inner">
        {/* Logo */}
        <Link to="/" className="pub-logo">
          <span className="pub-logo-dot" />
          ElkAPI
        </Link>

        {/* Nav links */}
        <nav className="pub-nav">
          <NavLink
            to="/models"
            className={({ isActive }) => 'pub-nav-link' + (isActive ? ' active' : '')}
          >
            {t('模型')}
          </NavLink>
          <NavLink
            to="/pricing"
            className={({ isActive }) => 'pub-nav-link' + (isActive ? ' active' : '')}
          >
            {t('价格')}
          </NavLink>
          <a
            href="https://api.elkapi.com/v1"
            className="pub-nav-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('文档')}
          </a>
        </nav>

        <div className="pub-header-spacer" />

        {/* Inline search (compact) */}
        <form onSubmit={handleSearch} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            className="pub-search"
            style={{ height: 34, width: 180, borderRadius: 6, fontSize: 13 }}
            placeholder={t('搜索模型...')}
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
          />
          <span className="pub-search-icon" style={{ right: 10, fontSize: 13 }}>
            <SearchIcon />
          </span>
        </form>

        {/* Theme toggle */}
        <button
          className="pub-theme-toggle"
          onClick={onThemeToggle}
          title={theme === 'dark' ? t('切换到浅色模式') : t('切换到深色模式')}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>

        {/* Auth actions */}
        <div className="pub-header-actions">
          {userState?.user ? (
            <Link to="/console" className="pub-btn pub-btn-primary pub-btn-sm">
              {t('控制台')}
            </Link>
          ) : (
            <>
              <Link to="/login" className="pub-btn pub-btn-ghost pub-btn-sm">
                {t('登录')}
              </Link>
              <Link to="/register" className="pub-btn pub-btn-primary pub-btn-sm">
                {t('免费注册')}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
