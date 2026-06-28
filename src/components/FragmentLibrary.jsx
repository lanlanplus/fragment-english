import { useEffect, useState } from 'react';
import { askDeepSeek, parseJsonResponse } from '../services/deepseek.js';
import { addFragment, getFragments } from '../utils/storage.js';

const translateSystemPrompt = `你是一个英语生活助理。用户会发给你一个英文句子或词，请返回以下三项，用 JSON 格式输出，不要有多余文字：
{
  "translation": "中文翻译",
  "scene": "一句话说明这个表达在什么场景用（口语化）",
  "better": "更地道的替换表达，如果没有则返回空字符串"
}`;

export default function FragmentLibrary() {
  const [input, setInput] = useState('');
  const [fragments, setFragments] = useState([]);
  const [latest, setLatest] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    setFragments(getFragments());
  }, []);

  const handleTranslate = async () => {
    const source = input.trim();
    if (!source || status === 'loading') return;

    setStatus('loading');
    setError('');

    try {
      const text = await askDeepSeek([
        { role: 'system', content: translateSystemPrompt },
        { role: 'user', content: source },
      ]);
      const result = parseJsonResponse(text);
      const fragment = {
        id: crypto.randomUUID(),
        source,
        translation: result.translation || '',
        scene: result.scene || '',
        better: result.better || '',
        createdAt: new Date().toISOString(),
      };

      const nextFragments = addFragment(fragment);
      setFragments(nextFragments);
      setLatest(fragment);
      setInput('');
      setStatus('success');
    } catch {
      setError('翻译刚刚走神了，再点一次试试。');
      setStatus('idle');
    }
  };

  return (
    <div className="module">
      <div className="input-card">
        <label htmlFor="fragment-input">今天捡到什么英语碎片？</label>
        <textarea
          id="fragment-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="比如：I’m down for whatever."
          rows="4"
        />
        <button type="button" className="primary-button" onClick={handleTranslate} disabled={!input.trim() || status === 'loading'}>
          {status === 'loading' ? '翻译中...' : '翻译'}
        </button>
        {error && <p className="soft-error">{error}</p>}
      </div>

      {latest && (
        <article className="result-card">
          <p className="card-kicker">刚刚存入词库</p>
          <h2>{latest.source}</h2>
          <p className="translation">{latest.translation}</p>
          <p>{latest.scene}</p>
          {latest.better && <p className="better">更地道：{latest.better}</p>}
        </article>
      )}

      <section className="list-section">
        <h2>碎片词库</h2>
        {fragments.length === 0 ? (
          <div className="empty-state">还没有碎片～去看个vlog，把听不懂的发过来吧 ✨</div>
        ) : (
          <div className="card-list">
            {fragments.map((item) => (
              <article className="library-card" key={item.id}>
                <div>
                  <h3>{item.source}</h3>
                  <p className="translation">{item.translation}</p>
                  <p>{item.scene}</p>
                </div>
                <time>{new Date(item.createdAt).toLocaleDateString('zh-CN')}</time>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
