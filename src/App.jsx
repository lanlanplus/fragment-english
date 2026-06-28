import { useEffect, useRef, useState } from 'react';
import FragmentLibrary from './components/FragmentLibrary.jsx';
import GachaMachine from './components/GachaMachine.jsx';
import SpeakingPractice from './components/SpeakingPractice.jsx';
import DiaryModule from './components/DiaryModule.jsx';

const tabs = [
  { id: 'fragments', label: '碎片', icon: '✦' },
  { id: 'gacha', label: '扭蛋', icon: '◌' },
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

export default function App() {
  const [activeTab, setActiveTab] = useState('fragments');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'purple');
  const [isThemePickerOpen, setIsThemePickerOpen] = useState(false);
  const themePickerRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

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
    if (activeTab === 'gacha') return <GachaMachine />;
    if (activeTab === 'speak') return <SpeakingPractice />;
    if (activeTab === 'diary') return <DiaryModule />;
    return <FragmentLibrary />;
  };

  return (
    <main className="app-shell">
      <section className="app-frame">
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
            </button>

            {isThemePickerOpen && (
              <div className="theme-popover" role="menu" aria-label="主题颜色">
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
            )}
          </div>
        </header>

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
