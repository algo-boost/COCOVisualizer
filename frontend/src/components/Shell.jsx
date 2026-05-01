import { useEffect, useState } from 'react';
import { useConfig } from '../ConfigProvider.jsx';
import { fetchAgentSkills, fetchAgentModules } from '../api/agent.js';

const PAGE_LIST = [
  { id: 'load', label: '加载数据集', desc: '上传或选择 COCO 文件', placeholder: 'LoadPage' },
  { id: 'gallery', label: '图库', desc: '按类别筛选与查看图片', placeholder: 'GalleryPage' },
  { id: 'eda', label: 'EDA 分析', desc: '类别 / 框尺度 / 中心点统计', placeholder: 'EDAPage' },
  { id: 'chat', label: 'AI Chat', desc: 'Agent 写代码 + 自动执行', placeholder: 'ChatPage' },
];

export default function Shell() {
  const { config, loading } = useConfig();
  const [activePage, setActivePage] = useState('load');
  const [agentInfo, setAgentInfo] = useState({ skills: 0, modules: 0 });

  useEffect(() => {
    Promise.all([fetchAgentSkills(), fetchAgentModules()])
      .then(([skills, modules]) => {
        setAgentInfo({
          skills: (skills?.skills || []).length,
          modules: (modules?.modules || []).length,
        });
      })
      .catch(() => {});
  }, []);

  if (loading) {
    return <div className="vite-shell-loading">加载配置…</div>;
  }

  return (
    <div className="vite-shell">
      <header className="vite-shell-header">
        <div className="vite-shell-title">COCOVisualizer · Vite Shell</div>
        <div className="vite-shell-meta">
          后端版本：v2 (Blueprint) · Skills {agentInfo.skills} · 自定义模块 {agentInfo.modules}
        </div>
      </header>

      <nav className="vite-shell-tabs">
        {PAGE_LIST.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`vite-shell-tab${activePage === p.id ? ' active' : ''}`}
            onClick={() => setActivePage(p.id)}
          >
            <strong>{p.label}</strong>
            <span>{p.desc}</span>
          </button>
        ))}
      </nav>

      <main className="vite-shell-main">
        <div className="vite-shell-placeholder">
          <h2>{PAGE_LIST.find((p) => p.id === activePage)?.label}</h2>
          <p>当前为 Vite 脚手架占位页（{PAGE_LIST.find((p) => p.id === activePage)?.placeholder}）。</p>
          <p>
            旧版 React 应用（约 1 万行 JSX）仍可通过 Babel-in-browser 模式运行于
            <code>/static/react-app.jsx</code>。Vite 路径将逐页迁入：
            LoadPage → GalleryPage → EDAPage → ChatPage → ImageViewer。
          </p>
          {config?.default_dataset ? (
            <p>默认数据集 hint: <code>{JSON.stringify(config.default_dataset)}</code></p>
          ) : null}
        </div>
      </main>
    </div>
  );
}
