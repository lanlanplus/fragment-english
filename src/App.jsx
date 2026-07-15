import { useEffect, useRef, useState } from 'react';
import AuthPanel from './components/AuthPanel.jsx';
import FragmentLibrary from './components/FragmentLibrary.jsx';
import StarMap from './components/StarMap.jsx';
import SpeakingPractice from './components/SpeakingPractice.jsx';
import DiaryModule from './components/DiaryModule.jsx';
import { supabase } from './utils/supabase.js';
import { APP_STATE_SYNCED_EVENT, getSettings, saveSettings, syncUserState } from './utils/storage.js';

const tabs = [
  { id: 'fragments', label: '碎片', icon: '✦' },
  { id: 'stars', label: '拾星', icon: '✦' },
  { id: 'speak', label: '开口', icon: '♡' },
  { id: 'diary', label: '日记', icon: '✏️' },
];

const themes = [
  { id: 'coral', label: '珊瑚红' },
  { id: 'purple', label: '莫兰迪灰紫' },
  { id: 'sage', label: '鼠尾草绿' },
  { id: 'pink', label: '莫兰迪灰粉' },
  { id: 'blue', label: '雾霾蓝灰' },
  { id: 'latte', label: '奶茶棕' },
];

function maskEmail(email) {
  const [name, domain = ''] = email.split('@');
  return `${name.slice(0, 4)}***@${domain}`;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('fragments');
  const [theme, setTheme] = useState(() => getSettings().theme || 'purple');
  const [isThemePickerOpen, setIsThemePickerOpen] = useState(false);
  const [session, setSession] = useState(null);
  const [syncMessage, setSyncMessage] = useState('');
  const [isSigningOut, setIsSigningOut] = useState(false);
  const themePickerRef = useRef(null);
  const userEmail = session?.user?.email || '';
  const maskedEmail = userEmail ? maskEmail(userEmail) : '';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    saveSettings({ theme });
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.toggle('stars-page-active', activeTab === 'stars');
    return () => document.documentElement.classList.remove('stars-page-active');
  }, [activeTab]);

  useEffect(() => {
    let isMounted = true;

    async function syncSession(nextSession) {
      setSession(nextSession);
      if (!nextSession?.user) {
        setSyncMessage('');
        return;
      }

      setSyncMessage('正在同步云端状态...');
      const result = await syncUserState(nextSession.user);
      if (!isMounted) return;
      setSyncMessage(result.message);
    }

    supabase.auth.getSession().then(({ data }) => {
      syncSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setTimeout(() => {
        syncSession(nextSession);
      }, 0);
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const refreshSettings = () => {
      setTheme(getSettings().theme || 'purple');
    };

    window.addEventListener(APP_STATE_SYNCED_EVENT, refreshSettings);
    return () => window.removeEventListener(APP_STATE_SYNCED_EVENT, refreshSettings);
  }, []);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!themePickerRef.current?.contains(event.target)) {
        setIsThemePickerOpen(false);
      }
    };

    if (isThemePickerOpen) {
      document.addEventListener('pointerdown', handlePointerDown);
    }

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isThemePickerOpen]);

  const renderActiveTab = () => {
    if (activeTab === 'stars') return <StarMap />;
    if (activeTab === 'speak') return <SpeakingPractice />;
    if (activeTab === 'diary') return <DiaryModule />;
    return <FragmentLibrary />;
  };

  const signOut = async () => {
    if (isSigningOut) return;

    setIsSigningOut(true);
    setIsThemePickerOpen(false);
    try {
      await supabase.auth.signOut();
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <main className={`app-shell ${activeTab === 'stars' ? 'stars-active-shell' : ''}`}>
      <section className={`app-frame ${activeTab === 'stars' ? 'stars-active' : ''}`}>
        <header className="app-header">
          <div>
            <p className="eyebrow">no class, just play</p>
            <h1>碎片英语小宇宙</h1>
          </div>

          <div className="theme-picker" ref={themePickerRef}>
            <button
              type="button"
              className="theme-toggle"
              aria-label="切换主题"
              aria-expanded={isThemePickerOpen}
              onClick={() => setIsThemePickerOpen((isOpen) => !isOpen)}
            >
              🎨
              {session?.user && <span className="theme-sync-dot" aria-hidden="true" />}
            </button>

            {isThemePickerOpen && (
              <div className="theme-popover" role="menu" aria-label="主题颜色">
                <div className="theme-swatch-row">
                  {themes.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`theme-swatch ${theme === item.id ? 'selected' : ''}`}
                      data-theme-option={item.id}
                      aria-label={item.label}
                      aria-pressed={theme === item.id}
                      onClick={() => {
                        setTheme(item.id);
                        setIsThemePickerOpen(false);
                      }}
                    />
                  ))}
                </div>

                {session?.user && (
                  <div className="theme-account">
                    <p>👤 {maskedEmail}</p>
                    <button type="button" onClick={signOut} disabled={isSigningOut}>
                      退出登录
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {!session?.user && <AuthPanel session={session} syncMessage={syncMessage} />}

        <div className="screen-area">{renderActiveTab()}</div>

        <nav className="tab-bar" aria-label="底部导航">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span aria-hidden="true">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </section>
    </main>
  );
}
