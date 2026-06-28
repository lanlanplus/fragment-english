import { useState } from 'react';
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

export default function App() {
  const [activeTab, setActiveTab] = useState('fragments');

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
          <p className="eyebrow">no class, just play</p>
          <h1>碎片英语小宇宙</h1>
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
