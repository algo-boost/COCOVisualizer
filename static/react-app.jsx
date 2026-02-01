// COCO数据集可视化工具 - React版本
const { useState, useEffect, useRef, useCallback, createContext, useContext } = React;

// 默认配置
const DEFAULT_CONFIG = {
    appName: 'COCO Dataset Visualizer',
    loadPage: {
        title: '加载数据集',
        cocoPathLabel: 'COCO JSON 文件路径 *',
        cocoPathPlaceholder: '',
        imageDirLabel: '图片目录（可选）',
        imageDirPlaceholder: '',
        datasetNameLabel: '数据集名称（可选）',
        datasetNamePlaceholder: '',
        loadButtonText: '加载',
        cocoPathRequiredMessage: '请输入COCO JSON路径'
    },
    gallery: {
        defaultPageSize: 20,
        pageSizeOptions: [20, 50, 100],
        pageSizeLabel: '条/页',
        batchSetLabel: '批量设置:',
        exportButtonText: '导出ZIP',
        versionButtonText: '版本',
        saveButtonText: '保存',
        galleryTitlePrefix: '共',
        galleryTitleSuffix: '张图片',
        selectedSuffix: '已选'
    },
    imageCategories: ['未分类', '低置信度', '误检', '漏检', '少数类', '背景'],
    imageCategoryColors: {
        '未分类': '#888888',
        '低置信度': '#FF6B6B',
        '误检': '#F39C12',
        '漏检': '#E74C3C',
        '少数类': '#9B59B6',
        '背景': '#3498DB'
    },
    colorPalette: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1', '#FF69B4', '#32CD32', '#FFD700'],
    viewer: {
        wheelZoomFactorOut: 0.9,
        wheelZoomFactorIn: 1.1,
        zoomMin: 0.02,
        zoomMax: 100,
        wheelZoomWithoutModifier: false,
        lineWidthOptions: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
        lineWidthDefault: 0.5,
        lineWidthLabel: '线宽:',
        backgroundStyle: 'checkerboard',
        backgroundColor: '#1a1a2e',
        checkerboardColor1: '#2d2d44',
        checkerboardColor2: '#252548'
    },
    settings: {
        modalTitle: '设置',
        viewerBackgroundLabel: '查看器背景',
        backgroundStyleCheckerboard: '马赛克',
        backgroundStyleSolid: '纯色',
        lineWidthDefaultLabel: '默认线宽',
        closeButtonText: '关闭'
    },
    help: {
        title: '快捷键说明',
        viewerShortcutsTitle: '图片查看器',
        navKeys: 'A / ← · D / →',
        navKeysDesc: '上一张 / 下一张（光标在输入框时不生效，按 Esc 退出聚焦）',
        noteKey: 'N',
        noteKeyDesc: '聚焦备注输入框',
        catKeys: '1 – 9',
        catKeysDesc: '将当前图片设为第 1–9 个分类',
        escDesc: '在输入框内：仅退出聚焦；否则：关闭查看器',
        zoomDesc: '滚轮缩放（或 Ctrl/Cmd+滚轮，见设置）· 左键拖动平移',
        closeButtonText: '关闭'
    },
    export: {
        defaultAnnotationFilename: '_annotations.coco.json',
        zipFilenameSuffix: '_by_category.zip',
        modalTitle: '按分类导出',
        modalDescription: '选择要导出的图片分类，每个分类将生成独立的COCO数据：',
        exportButtonText: '导出',
        progressGenerating: '正在生成压缩包...'
    },
    saveModal: {
        title: '保存到 COCO 文件',
        description: '将当前图片分类与备注写入原 COCO 文件，并生成一条版本记录。请填写版本说明（必填）。',
        commentPlaceholder: '版本说明（必填）',
        submitButtonText: '保存',
        versionCommentRequired: '请填写版本说明'
    },
    versionModal: {
        title: '版本记录',
        description: '每次「保存」会生成一条版本；回滚将把 COCO 文件恢复为选中版本的内容，并刷新当前页的图片分类与备注。',
        latestBadge: '最新',
        noComment: '(无说明)',
        rollbackButtonText: '回滚到此版本',
        rollingText: '回滚中...',
        emptyMessage: '暂无版本记录，保存一次后会出现。',
        closeButtonText: '关闭'
    },
    settings: {
        modalTitle: '设置',
        viewerBackgroundLabel: '查看器背景',
        backgroundStyleCheckerboard: '马赛克',
        backgroundStyleSolid: '纯色',
        lineWidthDefaultLabel: '默认线宽',
        closeButtonText: '关闭'
    },
    help: {
        title: '快捷键说明',
        viewerShortcutsTitle: '图片查看器',
        navKeys: 'A / ← · D / →',
        navKeysDesc: '上一张 / 下一张（光标在输入框时不生效，按 Esc 退出聚焦）',
        noteKey: 'N',
        noteKeyDesc: '聚焦备注输入框',
        catKeys: '1 – 9',
        catKeysDesc: '将当前图片设为第 1–9 个分类',
        escDesc: '在输入框内：仅退出聚焦；否则：关闭查看器',
        zoomDesc: '滚轮缩放（或 Ctrl/Cmd+滚轮，见设置）· 左键拖动平移',
        closeButtonText: '关闭'
    },
    nav: {
        loadTitle: '加载数据集',
        galleryTitle: '图片浏览',
        edaTitle: '数据分析'
    },
    eda: {
        pageTitle: '数据分析 (EDA)',
        sectionCategory: '类别分布',
        sectionSize: '尺寸分析',
        sectionRatio: '比例分析',
        sectionSpace: '空间分析',
        sectionDensity: '密度分析',
        chartCategoryPie: '类别分布饼图',
        chartCategoryBar: '类别数量柱状图',
        chartArea: '面积分布',
        chartAreaSqrt: '面积平方根分布',
        chartLongEdge: '长边分布',
        chartWidthHeight: '宽度和高度分布',
        chartAspectRatio: '宽高比分布 (宽/高)',
        chartLongShortRatio: '长短边比分布 (长边/短边)',
        chartCenter: '中心点分布',
        chartBbox: 'BBox分布（宽×高）',
        chartDensity: '密度分布'
    }
};

function mergeConfig(defaults, overrides) {
    if (!overrides || typeof overrides !== 'object') return defaults;
    const out = { ...defaults };
    for (const key of Object.keys(overrides)) {
        if (overrides[key] != null && typeof overrides[key] === 'object' && !Array.isArray(overrides[key]) && defaults[key] != null && typeof defaults[key] === 'object' && !Array.isArray(defaults[key])) {
            out[key] = { ...defaults[key], ...overrides[key] };
        } else if (overrides[key] !== undefined) {
            out[key] = overrides[key];
        }
    }
    return out;
}

const ConfigContext = createContext(DEFAULT_CONFIG);
const SettingsContext = createContext(() => {});
function useConfig() { return useContext(ConfigContext); }
function useSettings() { return useContext(SettingsContext); }

const SETTINGS_STORAGE_KEY = 'cocoViewerSettings';

function loadStoredSettings() {
    try {
        const s = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (s) return JSON.parse(s);
    } catch (e) {}
    return {};
}

// 标注类别颜色（按调色板分配）
const categoryColors = {};
function getCategoryColor(palette, category) {
    if (!palette || !palette.length) return '#888';
    if (!categoryColors[category]) {
        categoryColors[category] = palette[Object.keys(categoryColors).length % palette.length];
    }
    return categoryColors[category];
}

// ==================== 配置提供者（config.json + 本地设置） ====================
function ConfigProvider({ children }) {
    const [config, setConfig] = useState(DEFAULT_CONFIG);
    const [localSettings, setLocalSettings] = useState(loadStoredSettings);
    const mergedConfig = React.useMemo(() => mergeConfig(config, localSettings), [config, localSettings]);

    useEffect(() => {
        fetch('/static/config.json')
            .then(r => r.ok ? r.json() : Promise.reject())
            .then(c => setConfig(prev => mergeConfig(prev, c)))
            .catch(() => {});
    }, []);
    useEffect(() => {
        if (mergedConfig.appName) document.title = mergedConfig.appName;
    }, [mergedConfig.appName]);

    const setSettings = useCallback((next) => {
        setLocalSettings(prev => {
            const out = typeof next === 'function' ? next(prev) : next;
            try { localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(out)); } catch (e) {}
            return out;
        });
    }, []);

    return React.createElement(SettingsContext.Provider, { value: setSettings },
        React.createElement(ConfigContext.Provider, { value: mergedConfig }, children)
    );
}

// ==================== 主应用组件 ====================
function App() {
    const config = useConfig();
    const [page, setPage] = useState('load'); // 'load' | 'gallery' | 'eda'
    const [datasetData, setDatasetData] = useState(null);
    const [images, setImages] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [viewerOpen, setViewerOpen] = useState(false);
    
    // 图片分类和备注
    const [imageClassifications, setImageClassifications] = useState({}); // {image_id: category}
    const [imageNotes, setImageNotes] = useState({}); // {image_id: note}

    // 加载数据集（单文件）
    const loadDataset = async (cocoPath, imageDir, name) => {
        setLoading(true);
        try {
            const res = await fetch('/api/load_dataset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ coco_json_path: cocoPath, image_dir: imageDir, dataset_name: name })
            });
            const data = await res.json();
            if (data.success) {
                await applyDatasetAndFetchImages(data);
            } else {
                alert('加载失败: ' + data.error);
            }
        } catch (err) {
            alert('加载错误: ' + err.message);
        }
        setLoading(false);
    };

    // 合并加载（多选目录，约定 COCO 文件名为 _annotations.coco.json，与图片同目录）
    const loadDatasetMerged = async (items, datasetName) => {
        if (!items || items.length === 0) { alert('请至少选择一项'); return; }
        setLoading(true);
        try {
            const res = await fetch('/api/load_dataset_merged', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items, dataset_name: datasetName || 'merged' })
            });
            const data = await res.json();
            if (data.success) {
                await applyDatasetAndFetchImages(data);
            } else {
                alert('加载失败: ' + data.error);
            }
        } catch (err) {
            alert('加载错误: ' + err.message);
        }
        setLoading(false);
    };

    const applyDatasetAndFetchImages = async (data) => {
        setDatasetData(data);
        setCategories(data.categories);
        const imgRes = await fetch('/api/get_images_by_category', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dataset_id: data.dataset_id, selected_categories: data.categories })
        });
        const imgData = await imgRes.json();
        if (imgData.success) {
            setImages(imgData.images);
            const initClass = {};
            const defaultCat = (config.imageCategories && config.imageCategories[0]) || '未分类';
            imgData.images.forEach(img => {
                const cats = img.image_categories;
                initClass[img.image_id] = Array.isArray(cats) && cats.length > 0 ? cats : (img.image_category ? [img.image_category] : [defaultCat]);
            });
            setImageClassifications(initClass);
            const initNotes = {};
            imgData.images.forEach(img => {
                initNotes[img.image_id] = img.note || '';
            });
            setImageNotes(initNotes);
        }
        setPage('gallery');
    };

    // 更新图片分类（单类，覆盖）
    const updateImageCategory = (imageId, category) => {
        setImageClassifications(prev => ({ ...prev, [imageId]: [category] }));
    };
    // 更新图片多分类（一图多类）
    const updateImageCategories = (imageId, categoriesArray) => {
        setImageClassifications(prev => ({ ...prev, [imageId]: categoriesArray && categoriesArray.length ? categoriesArray : [(imageCategories && imageCategories[0]) || '未分类'] }));
    };

    // 更新图片备注
    const updateImageNote = (imageId, note) => {
        setImageNotes(prev => ({ ...prev, [imageId]: note }));
    };

    // 批量更新选中图片的分类（每张图设为单类）
    const batchUpdateCategory = (imageIds, category) => {
        setImageClassifications(prev => {
            const newState = { ...prev };
            imageIds.forEach(id => { newState[id] = [category]; });
            return newState;
        });
    };

    // 回滚后重新拉取图片并更新分类/备注（从 COCO 文件读取）
    const refetchImageMetaAfterRollback = useCallback(async () => {
        if (!datasetData || images.length === 0) return;
        try {
            const res = await fetch('/api/get_images_by_category', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dataset_id: datasetData.dataset_id,
                    selected_categories: categories
                })
            });
            const data = await res.json();
            if (data.success && data.images) {
                const newClass = {};
                const newNotes = {};
                const defaultCat = (config.imageCategories && config.imageCategories[0]) || '未分类';
                data.images.forEach(img => {
                    const cats = img.image_categories;
                    newClass[img.image_id] = Array.isArray(cats) && cats.length > 0 ? cats : (img.image_category ? [img.image_category] : [defaultCat]);
                    newNotes[img.image_id] = img.note || '';
                });
                setImageClassifications(newClass);
                setImageNotes(newNotes);
                setImages(data.images);
            }
        } catch (err) {
            console.warn('refetch after rollback failed', err);
        }
    }, [datasetData, categories]);

    const imageCategories = config.imageCategories || DEFAULT_CONFIG.imageCategories;
    const imageCategoryColors = config.imageCategoryColors || DEFAULT_CONFIG.imageCategoryColors;
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showHelpModal, setShowHelpModal] = useState(false);

    return (
        <div className="app-container">
            <SidebarNav page={page} setPage={setPage} datasetLoaded={!!datasetData} onOpenSettings={() => setShowSettingsModal(true)} onOpenHelp={() => setShowHelpModal(true)} />
            {page === 'load' && <LoadPage onLoad={loadDataset} onLoadMerged={loadDatasetMerged} loading={loading} />}
            {page === 'gallery' && datasetData && (
                <GalleryPage
                    datasetData={datasetData}
                    images={images}
                    categories={categories}
                    imageClassifications={imageClassifications}
                    imageNotes={imageNotes}
                    imageCategories={imageCategories}
                    imageCategoryColors={imageCategoryColors}
                    onImageClick={(img) => { setSelectedImage(img); setViewerOpen(true); }}
                    onUpdateCategory={updateImageCategory}
                    onUpdateCategories={updateImageCategories}
                    onBatchUpdateCategory={batchUpdateCategory}
                    onRollback={refetchImageMetaAfterRollback}
                />
            )}
            {page === 'eda' && datasetData && <EDAPage datasetData={datasetData} />}
            {viewerOpen && selectedImage && (
                <ImageViewer
                    image={selectedImage}
                    images={images}
                    datasetId={datasetData.dataset_id}
                    categories={categories}
                    imageClassifications={imageClassifications}
                    imageNotes={imageNotes}
                    imageCategories={imageCategories}
                    onClose={() => setViewerOpen(false)}
                    onNavigate={(img) => setSelectedImage(img)}
                    onUpdateCategory={updateImageCategory}
                    onUpdateCategories={updateImageCategories}
                    onUpdateNote={updateImageNote}
                />
            )}
            {showSettingsModal && (
                <SettingsModal onClose={() => setShowSettingsModal(false)} />
            )}
            {showHelpModal && (
                <HelpModal onClose={() => setShowHelpModal(false)} />
            )}
        </div>
    );
}

// ==================== 侧边导航 ====================
function SidebarNav({ page, setPage, datasetLoaded, onOpenSettings, onOpenHelp }) {
    const config = useConfig();
    const nav = config.nav || DEFAULT_CONFIG.nav;
    return (
        <div className="sidebar-nav">
            <div className={`nav-item ${page === 'load' ? 'active' : ''}`} onClick={() => setPage('load')} title={nav.loadTitle}>📂</div>
            <div className="nav-divider"></div>
            {datasetLoaded && (
                <>
                    <div className={`nav-item ${page === 'gallery' ? 'active' : ''}`} onClick={() => setPage('gallery')} title={nav.galleryTitle}>🖼️</div>
                    <div className={`nav-item ${page === 'eda' ? 'active' : ''}`} onClick={() => setPage('eda')} title={nav.edaTitle}>📊</div>
                </>
            )}
            <div className="nav-divider"></div>
            <div className="nav-item" onClick={() => onOpenSettings && onOpenSettings()} title="设置">⚙️</div>
            <div className="nav-item" onClick={() => onOpenHelp && onOpenHelp()} title="快捷键帮助">❓</div>
        </div>
    );
}

// ==================== 帮助模态框（快捷键说明） ====================
function HelpModal({ onClose }) {
    const config = useConfig();
    const help = config.help || {};
    const title = help.title || '快捷键说明';
    const viewerTitle = help.viewerShortcutsTitle || '图片查看器';
    const navKeys = help.navKeys || 'A / ← · D / →';
    const navDesc = help.navKeysDesc || '上一张 / 下一张（光标在输入框时不生效，按 Esc 退出聚焦）';
    const noteKey = help.noteKey || 'N';
    const noteDesc = help.noteKeyDesc || '聚焦备注输入框';
    const catKeys = help.catKeys || '1 – 9';
    const catDesc = help.catKeysDesc || '将当前图片设为第 1–9 个分类';
    const escDesc = help.escDesc || '在输入框内：仅退出聚焦；否则：关闭查看器';
    const zoomDesc = help.zoomDesc || '滚轮缩放（或 Ctrl/Cmd+滚轮，见设置）· 左键拖动平移';
    const closeBtn = help.closeButtonText || '关闭';

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content help-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
                <div className="modal-header">
                    <h3>{title}</h3>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="modal-body help-modal-body">
                    <h4 className="help-section-title">{viewerTitle}</h4>
                    <table className="help-shortcut-table">
                        <tbody>
                            <tr><td className="help-key">{navKeys}</td><td>{navDesc}</td></tr>
                            <tr><td className="help-key">{noteKey}</td><td>{noteDesc}</td></tr>
                            <tr><td className="help-key">{catKeys}</td><td>{catDesc}</td></tr>
                            <tr><td className="help-key">Esc</td><td>{escDesc}</td></tr>
                            <tr><td className="help-key">滚轮 / 左键拖动</td><td>{zoomDesc}</td></tr>
                        </tbody>
                    </table>
                    <p className="help-tip">线宽可在查看器顶部选择 0.1～1；背景样式与默认线宽可在「设置」中修改。</p>
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn btn-primary" onClick={onClose}>{closeBtn}</button>
                </div>
            </div>
        </div>
    );
}

// ==================== 路径选择弹窗（浏览服务器目录） ====================
function PathPickerModal({ initialPath, onSelect, onClose }) {
    const defaultRoot = (typeof navigator !== 'undefined' && navigator.platform && navigator.platform.toLowerCase().includes('win')) ? 'C:\\' : '/';
    const [currentPath, setCurrentPath] = useState(initialPath || defaultRoot);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const getParentPath = (p) => {
        if (!p || p.length <= 1) return null;
        const sep = p.indexOf('\\') >= 0 ? '\\' : '/';
        const idx = p.lastIndexOf(sep);
        if (idx <= 0) return (sep === '\\' && p.length >= 2) ? (p.substring(0, 2) + sep) : sep;
        return p.substring(0, idx);
    };

    useEffect(() => {
        const base = (currentPath || defaultRoot).trim() || defaultRoot;
        setLoading(true);
        setError('');
        fetch('/api/list_server_paths', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base_path: base })
        })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    setItems(data.items || []);
                } else {
                    setError(data.error || '加载失败');
                    setItems([]);
                }
            })
            .catch(err => {
                setError(err.message || '请求失败');
                setItems([]);
            })
            .finally(() => setLoading(false));
    }, [currentPath || defaultRoot]);

    const parentPath = getParentPath(currentPath);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content path-picker-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px', maxHeight: '80vh' }}>
                <div className="modal-header">
                    <h3>选择根目录</h3>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="modal-body path-picker-body">
                    <div className="path-picker-current">{currentPath || defaultRoot}</div>
                    <div className="path-picker-toolbar">
                        {parentPath != null && (
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCurrentPath(parentPath)}>上一级</button>
                        )}
                    </div>
                    {error && <div className="path-picker-error">{error}</div>}
                    {loading ? (
                        <div className="path-picker-loading">加载中...</div>
                    ) : (
                        <div className="path-picker-list">
                            {items.filter(x => x.is_dir).map((item, i) => (
                                <div key={i} className="path-picker-item" onClick={() => setCurrentPath(item.path)}>
                                    <span className="path-picker-icon">📁</span>
                                    <span className="path-picker-name">{item.name}</span>
                                </div>
                            ))}
                            {items.filter(x => x.is_dir).length === 0 && !error && <div className="path-picker-empty">此目录下无子文件夹</div>}
                        </div>
                    )}
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={onClose}>取消</button>
                    <button type="button" className="btn btn-primary" onClick={() => onSelect(currentPath || defaultRoot)}>选择当前目录</button>
                </div>
            </div>
        </div>
    );
}

// ==================== 加载页面 ====================
function LoadPage({ onLoad, onLoadMerged, loading }) {
    const config = useConfig();
    const lp = config.loadPage || DEFAULT_CONFIG.loadPage;
    const [cocoPath, setCocoPath] = useState('');
    const [imageDir, setImageDir] = useState('');
    const [datasetName, setDatasetName] = useState('dataset');
    const [rootPath, setRootPath] = useState('');
    const [scanItems, setScanItems] = useState([]);
    const [scanning, setScanning] = useState(false);
    const [selectedIndices, setSelectedIndices] = useState(new Set());
    const [showPathPicker, setShowPathPicker] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!cocoPath) { alert(lp.cocoPathRequiredMessage || '请输入COCO JSON路径'); return; }
        onLoad(cocoPath, imageDir, datasetName);
    };

    const handleScan = async () => {
        if (!rootPath.trim()) { alert('请输入根目录路径'); return; }
        setScanning(true);
        try {
            const res = await fetch('/api/scan_folder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ root_path: rootPath.trim() })
            });
            const data = await res.json();
            if (data.success) {
                setScanItems(data.items || []);
                setSelectedIndices(new Set((data.items || []).map((_, i) => i)));
            } else {
                alert('扫描失败: ' + (data.error || '未知错误'));
            }
        } catch (err) {
            alert('扫描错误: ' + err.message);
        }
        setScanning(false);
    };

    const toggleSelectAll = () => {
        if (selectedIndices.size === scanItems.length) setSelectedIndices(new Set());
        else setSelectedIndices(new Set(scanItems.map((_, i) => i)));
    };
    const toggleItem = (i) => {
        const next = new Set(selectedIndices);
        if (next.has(i)) next.delete(i); else next.add(i);
        setSelectedIndices(next);
    };

    const handleLoadMerged = () => {
        const selected = scanItems.filter((_, i) => selectedIndices.has(i));
        if (selected.length === 0) { alert('请至少勾选一个目录'); return; }
        onLoadMerged(selected, datasetName);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const t = (e.dataTransfer && e.dataTransfer.getData('text')) || '';
        if (t) setRootPath(t.trim());
    };
    const handlePaste = (e) => {
        const t = (e.clipboardData && e.clipboardData.getData('text')) || '';
        if (t && (t.includes('\\') || t.includes('/'))) {
            e.preventDefault();
            setRootPath(t.trim());
        }
    };

    return (
        <div className="load-page">
            <div className="load-card load-card-wide">
                <div className="load-title-row">
                    <img src="/static/logo.png" alt="" className="load-logo" />
                    <h1 className="load-title">{config.appName || lp.title}</h1>
                </div>

                {/* 方式一：根目录扫描（递归 _annotations.coco.json，多选加载） */}
                <div className="load-section">
                    <h2 className="load-section-title">从根目录扫描（多选加载）</h2>
                    <p className="load-section-desc">约定：COCO 文件名为 _annotations.coco.json，与图片同目录。支持拖入或粘贴路径。</p>
                    <div className="load-field">
                        <label className="load-label">根目录路径</label>
                        <div className="load-path-row">
                            <div
                                className="load-input load-drop-zone"
                                onDrop={handleDrop}
                                onDragOver={(e) => e.preventDefault()}
                                onPaste={handlePaste}
                                style={{ flex: 1 }}
                            >
                                <input
                                    type="text"
                                    value={rootPath}
                                    onChange={(e) => setRootPath(e.target.value)}
                                    placeholder="例如 D:\data\coco_root 或 /path/to/root"
                                    style={{ border: 'none', background: 'transparent', width: '100%', outline: 'none' }}
                                />
                            </div>
                            <button type="button" className="load-btn load-btn-secondary" onClick={() => setShowPathPicker(true)} title="弹窗选择路径">浏览</button>
                        </div>
                    </div>
                    {showPathPicker && (
                        <PathPickerModal
                            initialPath={rootPath}
                            onSelect={(p) => { setRootPath(p); setShowPathPicker(false); }}
                            onClose={() => setShowPathPicker(false)}
                        />
                    )}
                    <div className="load-actions">
                        <button type="button" className="load-btn load-btn-secondary" onClick={handleScan} disabled={scanning}>
                            {scanning ? '扫描中...' : '扫描'}
                        </button>
                        {scanItems.length > 0 && (
                            <>
                                <button type="button" className="load-btn load-btn-secondary" onClick={toggleSelectAll}>
                                    {selectedIndices.size === scanItems.length ? '取消全选' : '全选'}
                                </button>
                                <span className="load-merged-name">
                                    <label className="load-label">合并名称</label>
                                    <input type="text" value={datasetName} onChange={(e) => setDatasetName(e.target.value)} placeholder="merged" className="load-input load-input-inline" />
                                </span>
                                <button type="button" className="load-btn" onClick={handleLoadMerged} disabled={loading || selectedIndices.size === 0}>
                                    {loading ? '加载中...' : `加载选中 (${selectedIndices.size})`}
                                </button>
                            </>
                        )}
                    </div>
                    {scanItems.length > 0 && (
                        <div className="load-scan-list">
                            <div className="load-scan-list-header">已发现 {scanItems.length} 个目录（含 _annotations.coco.json）</div>
                            {scanItems.map((item, i) => (
                                <label key={i} className="load-scan-item">
                                    <input type="checkbox" checked={selectedIndices.has(i)} onChange={() => toggleItem(i)} />
                                    <span className="load-scan-rel">{item.relative_path || '(根)'}</span>
                                    <span className="load-scan-path" title={item.coco_path}>{item.coco_path}</span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                {/* 方式二：单文件加载 */}
                <div className="load-section">
                    <h2 className="load-section-title">单文件加载</h2>
                    <form onSubmit={handleSubmit}>
                        <div className="load-field">
                            <label className="load-label">{lp.cocoPathLabel}</label>
                            <input className="load-input" type="text" value={cocoPath} onChange={(e) => setCocoPath(e.target.value)} placeholder={lp.cocoPathPlaceholder || '/path/to/annotations.json'} />
                        </div>
                        <div className="load-field">
                            <label className="load-label">{lp.imageDirLabel}</label>
                            <input className="load-input" type="text" value={imageDir} onChange={(e) => setImageDir(e.target.value)} placeholder={lp.imageDirPlaceholder || '/path/to/images/'} />
                        </div>
                        <div className="load-field">
                            <label className="load-label">{lp.datasetNameLabel}</label>
                            <input className="load-input" type="text" value={datasetName} onChange={(e) => setDatasetName(e.target.value)} placeholder={lp.datasetNamePlaceholder} />
                        </div>
                        <button className="load-btn" type="submit" disabled={loading}>
                            {loading ? '加载中...' : lp.loadButtonText}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

// ==================== 图片宫格页面 ====================
function GalleryPage({ datasetData, images, categories, imageClassifications, imageNotes, imageCategories, imageCategoryColors, onImageClick, onUpdateCategory, onUpdateCategories, onBatchUpdateCategory, onRollback }) {
    const config = useConfig();
    const gallery = config.gallery || DEFAULT_CONFIG.gallery;
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(gallery.defaultPageSize ?? 20);
    const [selectedLabelCategory, setSelectedLabelCategory] = useState('all'); // 标注类别筛选
    const [selectedImageCategory, setSelectedImageCategory] = useState('all'); // 图片分类筛选
    const [selectedDirectory, setSelectedDirectory] = useState('all'); // 目录筛选（多目录合并时）
    const [searchText, setSearchText] = useState('');
    const [selectedImages, setSelectedImages] = useState(new Set());
    const [showExportModal, setShowExportModal] = useState(false);
    const [showVersionModal, setShowVersionModal] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [saving, setSaving] = useState(false);

    // 标注类别统计
    const labelCategoryStats = {};
    let totalAnnotations = 0;
    images.forEach(img => {
        img.annotations.forEach(ann => {
            labelCategoryStats[ann.category] = (labelCategoryStats[ann.category] || 0) + 1;
            totalAnnotations++;
        });
    });

    // 图片分类统计（一图可属多类，按归属计数）
    const imageCategoryStats = {};
    (imageCategories || []).forEach(cat => { imageCategoryStats[cat] = 0; });
    const defaultImageCat = (imageCategories && imageCategories[0]) || '未分类';
    images.forEach(img => {
        const cats = imageClassifications[img.image_id];
        const arr = Array.isArray(cats) && cats.length ? cats : [defaultImageCat];
        arr.forEach(cat => { imageCategoryStats[cat] = (imageCategoryStats[cat] || 0) + 1; });
    });

    // 目录列表（多目录合并时用于筛选）
    const directoryOptions = React.useMemo(() => {
        const set = new Set();
        images.forEach(img => { if (img.source_path != null && img.source_path !== '') set.add(img.source_path); });
        return ['all', ...Array.from(set).sort()];
    }, [images]);

    // 筛选图片
    const filteredImages = images.filter(img => {
        // 目录筛选
        if (selectedDirectory !== 'all' && (img.source_path != null ? img.source_path : '') !== selectedDirectory) return false;
        // 标注类别筛选
        if (selectedLabelCategory !== 'all' && !img.annotations.some(a => a.category === selectedLabelCategory)) return false;
        // 图片分类筛选（归属该分类即显示）
        if (selectedImageCategory !== 'all') {
            const arr = imageClassifications[img.image_id];
            const imgCats = Array.isArray(arr) && arr.length ? arr : [defaultImageCat];
            if (!imgCats.includes(selectedImageCategory)) return false;
        }
        // 文件名搜索
        if (searchText && !img.file_name.toLowerCase().includes(searchText.toLowerCase())) return false;
        return true;
    });

    const totalPages = Math.ceil(filteredImages.length / pageSize);
    const startIdx = (currentPage - 1) * pageSize;
    const pageImages = filteredImages.slice(startIdx, startIdx + pageSize);

    // 批量设置分类
    const handleBatchSetCategory = (category) => {
        if (selectedImages.size === 0) {
            alert('请先选择图片');
            return;
        }
        onBatchUpdateCategory(Array.from(selectedImages), category);
        setSelectedImages(new Set());
    };

    // 保存图片级分类与备注到原 COCO 文件（带版本说明）
    const handleSave = async (versionComment) => {
        setSaving(true);
        try {
            const defaultCat = (imageCategories && imageCategories[0]) || '未分类';
            const images_meta = images.map(img => {
                const cats = imageClassifications[img.image_id];
                const arr = Array.isArray(cats) && cats.length ? cats : [defaultCat];
                return { image_id: img.image_id, image_categories: arr, note: imageNotes[img.image_id] || '' };
            });
            const res = await fetch('/api/save_image_metadata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dataset_id: datasetData.dataset_id,
                    images: images_meta,
                    version_comment: versionComment || ''
                })
            });
            const data = await res.json();
            if (data.success) {
                setShowSaveModal(false);
                alert('保存成功！已写入原 COCO 文件并生成版本记录。');
            } else {
                alert('保存失败: ' + (data.error || '未知错误'));
            }
        } catch (err) {
            alert('保存错误: ' + err.message);
        }
        setSaving(false);
    };

    return (
        <>
            <div className="main-content">
                <div className="top-toolbar">
                    <div className="toolbar-left">
                        <div className="tab-group">
                            {(imageCategories || []).map(cat => (
                                <div 
                                    key={cat}
                                    className={`tab-item ${selectedImageCategory === cat ? 'active' : ''}`}
                                    style={{ borderLeft: `3px solid ${(imageCategoryColors || {})[cat] || '#888'}` }}
                                    onClick={() => { setSelectedImageCategory(cat); setCurrentPage(1); }}
                                >
                                    {cat} <span className="count">({imageCategoryStats[cat] || 0})</span>
                                </div>
                            ))}
                            <div 
                                className={`tab-item ${selectedImageCategory === 'all' ? 'active' : ''}`}
                                onClick={() => { setSelectedImageCategory('all'); setCurrentPage(1); }}
                            >
                                全部 <span className="count">({images.length})</span>
                            </div>
                        </div>
                    </div>
                    <div className="toolbar-right">
                        {directoryOptions.length > 1 && (
                            <select className="filter-select" value={selectedDirectory} onChange={(e) => { setSelectedDirectory(e.target.value); setCurrentPage(1); }} title="按目录筛选">
                                <option value="all">全部目录</option>
                                {directoryOptions.filter(d => d !== 'all').map(d => <option key={d} value={d}>{d || '(根)'}</option>)}
                            </select>
                        )}
                        <select className="filter-select" value={selectedLabelCategory} onChange={(e) => { setSelectedLabelCategory(e.target.value); setCurrentPage(1); }}>
                            <option value="all">全部标注类别</option>
                            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                        <input className="filter-input" placeholder="搜索文件名..." value={searchText} onChange={(e) => { setSearchText(e.target.value); setCurrentPage(1); }} />
                        <button className="btn btn-success btn-sm" onClick={() => setShowSaveModal(true)} disabled={saving}>
                            {saving ? '保存中...' : `💾 ${gallery.saveButtonText}`}
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setShowVersionModal(true)}>📋 {gallery.versionButtonText}</button>
                        <button className="btn btn-primary btn-sm" onClick={() => setShowExportModal(true)}>📤 {gallery.exportButtonText}</button>
                    </div>
                </div>

                <div className="content-area">
                    <div className="gallery-section">
                        <div className="gallery-header">
                            <span className="gallery-title">{gallery.galleryTitlePrefix} {filteredImages.length} {gallery.galleryTitleSuffix} {selectedImages.size > 0 && `(${gallery.selectedSuffix} ${selectedImages.size} 张)`}</span>
                            <div className="gallery-actions">
                                <label style={{marginRight: '15px'}}>
                                    <input type="checkbox" onChange={(e) => setSelectedImages(e.target.checked ? new Set(pageImages.map(i => i.image_id)) : new Set())} /> 全选当页
                                </label>
                                {selectedImages.size > 0 && (
                                    <div className="batch-actions">
                                        <span style={{marginRight: '10px', fontSize: '12px', color: '#666'}}>{gallery.batchSetLabel}</span>
                                        {(imageCategories || []).filter(c => c !== (imageCategories && imageCategories[0])).map(cat => (
                                            <button 
                                                key={cat} 
                                                className="btn btn-sm" 
                                                style={{background: (imageCategoryColors || {})[cat] || '#888', color: '#fff', marginRight: '5px'}}
                                                onClick={() => handleBatchSetCategory(cat)}
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="gallery-grid">
                            {pageImages.map(img => (
                                <ImageCard
                                    key={img.image_id}
                                    image={img}
                                    datasetId={datasetData.dataset_id}
                                    selected={selectedImages.has(img.image_id)}
                                    imageCategory={(() => { const c = imageClassifications[img.image_id]; const a = Array.isArray(c) && c.length ? c : [(imageCategories && imageCategories[0]) || '未分类']; return a.length === 1 ? a[0] : a; })()}
                                    imageCategoryColors={imageCategoryColors}
                                    colorPalette={config.colorPalette}
                                    hasNote={!!imageNotes[img.image_id]}
                                    onSelect={(sel) => {
                                        const newSet = new Set(selectedImages);
                                        sel ? newSet.add(img.image_id) : newSet.delete(img.image_id);
                                        setSelectedImages(newSet);
                                    }}
                                    onClick={() => onImageClick(img)}
                                />
                            ))}
                        </div>
                        <div className="pagination">
                            <button className="page-btn" disabled={currentPage <= 1} onClick={() => setCurrentPage(1)}>{'<<'}</button>
                            <button className="page-btn" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>{'<'}</button>
                            <span className="page-info">共{filteredImages.length}条 第{currentPage}/{totalPages || 1}页</span>
                            <button className="page-btn" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>{'>'}</button>
                            <button className="page-btn" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)}>{'>>'}</button>
                            <select className="page-size-select" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}>
                                {(gallery.pageSizeOptions || [20, 50, 100]).map(n => (
                                    <option key={n} value={n}>{n}{gallery.pageSizeLabel || '条/页'}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <ImageCategoryStatsPanel 
                        imageCategoryStats={imageCategoryStats}
                        labelCategoryStats={labelCategoryStats}
                        totalAnnotations={totalAnnotations}
                        categories={categories}
                        imageCategories={imageCategories}
                        imageCategoryColors={imageCategoryColors}
                        colorPalette={config.colorPalette}
                        onImageCategoryClick={(cat) => { setSelectedImageCategory(cat); setCurrentPage(1); }}
                        onLabelCategoryClick={(cat) => { setSelectedLabelCategory(cat); setCurrentPage(1); }}
                    />
                </div>
            </div>

            {showExportModal && (
                <ExportModal
                    images={images}
                    imageClassifications={imageClassifications}
                    imageNotes={imageNotes}
                    datasetData={datasetData}
                    imageCategories={imageCategories}
                    imageCategoryColors={imageCategoryColors}
                    onClose={() => setShowExportModal(false)}
                />
            )}

            {showVersionModal && (
                <VersionModal
                    datasetData={datasetData}
                    onClose={() => setShowVersionModal(false)}
                    onRollback={() => {
                        if (onRollback) onRollback();
                        setShowVersionModal(false);
                    }}
                />
            )}

            {showSaveModal && (
                <SaveModal
                    onClose={() => setShowSaveModal(false)}
                    onSave={handleSave}
                    saving={saving}
                />
            )}
        </>
    );
}

// ==================== 设置模态框 ====================
function SettingsModal({ onClose }) {
    const config = useConfig();
    const setSettings = useSettings();
    const st = config.settings || DEFAULT_CONFIG.settings || {};
    const viewer = config.viewer || DEFAULT_CONFIG.viewer;
    const lineWidthOptions = viewer.lineWidthOptions || [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];

    const updateViewer = (key, value) => {
        setSettings(prev => ({ ...prev, viewer: { ...(prev.viewer || {}), [key]: value } }));
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
                <div className="modal-header">
                    <h3>{st.modalTitle || '设置'}</h3>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="modal-body">
                    <div className="form-group">
                        <label className="form-label">{st.viewerBackgroundLabel || '查看器背景'}</label>
                        <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                <input type="radio" name="bgStyle" checked={(viewer.backgroundStyle || 'checkerboard') === 'checkerboard'} onChange={() => updateViewer('backgroundStyle', 'checkerboard')} />
                                {st.backgroundStyleCheckerboard || '马赛克'}
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                <input type="radio" name="bgStyle" checked={(viewer.backgroundStyle || '') === 'solid'} onChange={() => updateViewer('backgroundStyle', 'solid')} />
                                {st.backgroundStyleSolid || '纯色'}
                            </label>
                        </div>
                        {(viewer.backgroundStyle || 'checkerboard') === 'solid' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                                <span style={{ fontSize: '13px', color: '#666' }}>背景色</span>
                                <input type="color" value={viewer.backgroundColor || '#1a1a2e'} onChange={(e) => updateViewer('backgroundColor', e.target.value)} style={{ width: 36, height: 28, padding: 2, cursor: 'pointer' }} />
                            </div>
                        )}
                    </div>
                    <div className="form-group">
                        <label className="form-label">{st.lineWidthDefaultLabel || '默认线宽'}</label>
                        <select className="form-input" value={viewer.lineWidthDefault ?? 0.5} onChange={(e) => updateViewer('lineWidthDefault', Number(e.target.value))}>
                            {lineWidthOptions.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                        <p style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>0.1～1 共十档，查看器内可随时调整</p>
                    </div>
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn btn-primary" onClick={onClose}>{st.closeButtonText || '关闭'}</button>
                </div>
            </div>
        </div>
    );
}

// ==================== 保存模态框（版本说明） ====================
function SaveModal({ onClose, onSave, saving }) {
    const config = useConfig();
    const sm = config.saveModal || DEFAULT_CONFIG.saveModal;
    const [comment, setComment] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(comment);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{sm.title}</h3>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <p style={{marginBottom: '12px', color: '#666', fontSize: '13px'}}>
                            {sm.description}
                        </p>
                        <div className="form-group">
                            <label className="form-label">{sm.commentPlaceholder}</label>
                            <input
                                type="text"
                                className="form-input"
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder={sm.commentPlaceholder}
                                required
                            />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>取消</button>
                        <button type="submit" className="btn btn-success" disabled={saving || !comment.trim()}>
                            {saving ? '保存中...' : sm.submitButtonText}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ==================== 版本记录模态框 ====================
function VersionModal({ datasetData, onClose, onRollback }) {
    const config = useConfig();
    const vm = config.versionModal || DEFAULT_CONFIG.versionModal;
    const [versions, setVersions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [rolling, setRolling] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const res = await fetch('/api/list_versions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dataset_id: datasetData.dataset_id })
                });
                const data = await res.json();
                if (!cancelled && data.success) {
                    setVersions(data.versions || []);
                }
            } catch (err) {
                if (!cancelled) setVersions([]);
            }
            if (!cancelled) setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [datasetData.dataset_id]);

    const handleRollback = async (versionId) => {
        if (!confirm('确定回滚到该版本？当前未保存的修改将丢失。')) return;
        setRolling(versionId);
        try {
            const res = await fetch('/api/rollback_version', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dataset_id: datasetData.dataset_id, version_id: versionId })
            });
            const data = await res.json();
            if (data.success) {
                alert('回滚成功，页面将刷新分类与备注。');
                onRollback();
            } else {
                alert('回滚失败: ' + (data.error || '未知错误'));
            }
        } catch (err) {
            alert('回滚错误: ' + err.message);
        }
        setRolling(null);
    };

    const formatTime = (iso) => {
        if (!iso) return '';
        try {
            const d = new Date(iso);
            return d.toLocaleString('zh-CN');
        } catch (e) {
            return iso;
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{vm.title}</h3>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="modal-body">
                    <p style={{marginBottom: '12px', color: '#666', fontSize: '13px'}}>
                        {vm.description}
                    </p>
                    {loading ? (
                        <div className="loading">加载中...</div>
                    ) : versions.length === 0 ? (
                        <div className="modal-empty">{vm.emptyMessage}</div>
                    ) : (
                        <div className="version-list">
                            {versions.map((v, index) => (
                                <div key={v.id} className="version-item">
                                    <div className="version-info">
                                        {index === 0 && <span className="version-badge">{vm.latestBadge}</span>}
                                        <span className="version-comment">{v.comment || vm.noComment}</span>
                                        <span className="version-id">{v.id}</span>
                                        <span className="version-time">{formatTime(v.saved_at)}</span>
                                    </div>
                                    <button
                                        className="btn btn-sm btn-secondary"
                                        onClick={() => handleRollback(v.id)}
                                        disabled={rolling !== null}
                                    >
                                        {rolling === v.id ? vm.rollingText : vm.rollbackButtonText}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>{vm.closeButtonText}</button>
                </div>
            </div>
        </div>
    );
}

// ==================== 图片卡片 ====================
function ImageCard({ image, datasetId, selected, imageCategory, imageCategoryColors, colorPalette, hasNote, onSelect, onClick }) {
    let thumbUrl = `/api/get_image?dataset_id=${datasetId}&file_name=${encodeURIComponent(image.file_name)}`;
    if (image.source_path != null && image.source_path !== '') thumbUrl += `&source_path=${encodeURIComponent(image.source_path)}`;
    const labelCategories = [...new Set(image.annotations.map(a => a.category))].slice(0, 3);
    const catColors = imageCategoryColors || {};
    const palette = colorPalette || DEFAULT_CONFIG.colorPalette;
    const defaultCat = DEFAULT_CONFIG.imageCategories && DEFAULT_CONFIG.imageCategories[0];
    const cats = Array.isArray(imageCategory) ? imageCategory : (imageCategory ? [imageCategory] : []);
    const primaryCat = cats[0];
    const showBadge = primaryCat && primaryCat !== defaultCat;

    return (
        <div className={`image-card ${selected ? 'selected' : ''}`} onClick={onClick}>
            <div className="image-card-checkbox" onClick={(e) => { e.stopPropagation(); onSelect(!selected); }}>
                <input type="checkbox" checked={selected} readOnly />
            </div>
            {showBadge && (
                <div className="image-card-category" style={{ background: catColors[primaryCat] || '#888' }} title={cats.length > 1 ? cats.join(', ') : primaryCat}>
                    {cats.length > 1 ? `${primaryCat}+${cats.length - 1}` : primaryCat}
                </div>
            )}
            {hasNote && <div className="image-card-note-icon" title="有备注">📝</div>}
            {image.source_path != null && image.source_path !== '' && (
                <div className="image-card-dir" title={image.source_path}>{image.source_path}</div>
            )}
            <img className="image-card-thumb" src={thumbUrl} alt={image.file_name} loading="lazy" />
            <div className="image-card-info">
                <div className="image-card-name" title={image.file_name}>{image.file_name.split('/').pop()}</div>
                <div className="image-card-tags">
                    {labelCategories.map(cat => <span key={cat} className="image-card-tag" style={{ background: getCategoryColor(palette, cat) }}>{cat}</span>)}
                </div>
            </div>
        </div>
    );
}

// ==================== 图片分类统计面板 ====================
function ImageCategoryStatsPanel({ imageCategoryStats, labelCategoryStats, totalAnnotations, categories, imageCategories, imageCategoryColors, colorPalette, onImageCategoryClick, onLabelCategoryClick }) {
    const [searchText, setSearchText] = useState('');
    const [tab, setTab] = useState('imageCategory'); // 'imageCategory' | 'labelCategory'

    const totalImages = Object.values(imageCategoryStats).reduce((a, b) => a + b, 0);
    const filteredLabelCategories = categories.filter(cat => cat.toLowerCase().includes(searchText.toLowerCase()));
    const sortedLabelCategories = filteredLabelCategories.sort((a, b) => (labelCategoryStats[b] || 0) - (labelCategoryStats[a] || 0));
    const catList = imageCategories || DEFAULT_CONFIG.imageCategories;
    const catColors = imageCategoryColors || DEFAULT_CONFIG.imageCategoryColors;
    const palette = colorPalette || DEFAULT_CONFIG.colorPalette;

    return (
        <div className="stats-panel">
            <div className="stats-header">
                <div className={`stats-tab ${tab === 'imageCategory' ? 'active' : ''}`} onClick={() => setTab('imageCategory')}>图片分类</div>
                <div className={`stats-tab ${tab === 'labelCategory' ? 'active' : ''}`} onClick={() => setTab('labelCategory')}>标注类别</div>
            </div>
            <div className="stats-search">
                <input placeholder="搜索..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />
            </div>
            <div className="stats-list">
                {tab === 'imageCategory' ? (
                    <>
                        {catList.map(cat => {
                            const count = imageCategoryStats[cat] || 0;
                            const percent = totalImages > 0 ? (count / totalImages * 100).toFixed(2) : 0;
                            return (
                                <div key={cat} className="stats-item" onClick={() => onImageCategoryClick(cat)}>
                                    <div className="stats-color" style={{ background: catColors[cat] || '#888' }}></div>
                                    <div className="stats-name">{cat}</div>
                                    <div className="stats-percent">{percent}%</div>
                                    <div className="stats-count">{count}</div>
                                </div>
                            );
                        })}
                    </>
                ) : (
                    <>
                        {sortedLabelCategories.map(cat => {
                            const count = labelCategoryStats[cat] || 0;
                            const percent = totalAnnotations > 0 ? (count / totalAnnotations * 100).toFixed(2) : 0;
                            return (
                                <div key={cat} className="stats-item" onClick={() => onLabelCategoryClick(cat)}>
                                    <div className="stats-color" style={{ background: getCategoryColor(palette, cat) }}></div>
                                    <div className="stats-name">{cat}</div>
                                    <div className="stats-percent">{percent}%</div>
                                    <div className="stats-count">{count}</div>
                                </div>
                            );
                        })}
                    </>
                )}
            </div>
        </div>
    );
}

// 将图片与标注绘制到 canvas，返回 PNG Blob（若有 score 则在框上方写类别+置信度）
function drawImageWithBoxes(blob, width, height, annotations, palette) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const lineWidth = Math.max(1, Math.min(width, height) / 800);
                ctx.lineWidth = lineWidth;
                (annotations || []).forEach(ann => {
                    if (!ann.bbox || ann.bbox.length < 4) return;
                    const [x, y, w, h] = ann.bbox;
                    const color = getCategoryColor(palette, ann.category);
                    ctx.strokeStyle = color;
                    ctx.strokeRect(x, y, w, h);
                    const hasScore = ann.score !== undefined && ann.score !== null;
                    const label = hasScore ? `${ann.category} ${(Number(ann.score) * 100).toFixed(0)}%` : ann.category;
                    const fontSize = Math.max(10, Math.min(width, height) / 60);
                    ctx.font = `${fontSize}px sans-serif`;
                    const metrics = ctx.measureText(label);
                    const tw = metrics.width + 4;
                    const th = fontSize + 4;
                    let tx = x;
                    let ty = y - th - 2;
                    if (ty < 0) ty = y + h + 2;
                    if (tx + tw > width) tx = width - tw;
                    if (tx < 0) tx = 2;
                    ctx.fillStyle = 'rgba(0,0,0,0.75)';
                    ctx.fillRect(tx, ty, tw, th);
                    ctx.strokeStyle = color;
                    ctx.lineWidth = Math.max(1, lineWidth - 0.5);
                    ctx.strokeRect(tx, ty, tw, th);
                    ctx.fillStyle = '#fff';
                    ctx.fillText(label, tx + 2, ty + fontSize);
                });
                canvas.toBlob(b => {
                    URL.revokeObjectURL(url);
                    if (b) resolve(b); else reject(new Error('toBlob failed'));
                }, 'image/png');
            } catch (e) {
                URL.revokeObjectURL(url);
                reject(e);
            }
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Image load failed'));
        };
        img.src = url;
    });
}

// ==================== 导出模态框 ====================
function ExportModal({ images, imageClassifications, imageNotes, datasetData, imageCategories, imageCategoryColors, onClose }) {
    const config = useConfig();
    const exp = config.export || DEFAULT_CONFIG.export;
    const catList = imageCategories || DEFAULT_CONFIG.imageCategories;
    const catColors = imageCategoryColors || DEFAULT_CONFIG.imageCategoryColors;
    const palette = config.colorPalette || DEFAULT_CONFIG.colorPalette;
    const [exporting, setExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState('');
    const [selectedCategories, setSelectedCategories] = useState(() => new Set(catList));
    const [exportWithBoxes, setExportWithBoxes] = useState(true);
    const [exportMultiCategoryMode, setExportMultiCategoryMode] = useState('all'); // 'all' 放入所有归属目录 | 'priority' 仅放入最高优先级目录
    const defaultZipName = `${datasetData?.dataset_name || 'export'}${exp.zipFilenameSuffix || '_by_category.zip'}`;
    const [zipFileName, setZipFileName] = useState(defaultZipName);
    useEffect(() => {
        if (datasetData?.dataset_name) setZipFileName(`${datasetData.dataset_name}${exp.zipFilenameSuffix || '_by_category.zip'}`);
    }, [datasetData?.dataset_name, exp.zipFilenameSuffix]);

    const toggleCategory = (cat) => {
        const newSet = new Set(selectedCategories);
        if (newSet.has(cat)) newSet.delete(cat);
        else newSet.add(cat);
        setSelectedCategories(newSet);
    };

    const handleExport = async () => {
        if (typeof JSZip === 'undefined') {
            alert('请等待页面加载完成后再导出');
            return;
        }
        setExporting(true);
        try {
            const groupedImages = {};
            catList.forEach(cat => { groupedImages[cat] = []; });
            const defaultCat = catList[0] || '未分类';

            images.forEach(img => {
                const cats = imageClassifications[img.image_id];
                const imgCats = Array.isArray(cats) && cats.length ? cats : [defaultCat];
                const imgWithMeta = { ...img, image_category: imgCats[0], note: imageNotes[img.image_id] || '' };
                if (exportMultiCategoryMode === 'all') {
                    imgCats.forEach(cat => {
                        if (selectedCategories.has(cat)) groupedImages[cat].push(imgWithMeta);
                    });
                } else {
                    const firstInOrder = catList.find(c => imgCats.includes(c) && selectedCategories.has(c));
                    if (firstInOrder) groupedImages[firstInOrder].push(imgWithMeta);
                }
            });

            const zip = new JSZip();
            const datasetId = datasetData.dataset_id;
            let exportedDirs = 0;
            const annFilename = exp.defaultAnnotationFilename || '_annotations.coco.json';

            for (const cat of catList) {
                if (!selectedCategories.has(cat) || groupedImages[cat].length === 0) continue;

                const catImages = groupedImages[cat];
                const folderName = cat;
                const categoryFolder = zip.folder(folderName);

                // 1. 生成 COCO JSON（默认文件名）
                const cocoData = {
                    info: {
                        description: `${datasetData.dataset_name} - ${cat}`,
                        date_created: new Date().toISOString()
                    },
                    images: catImages.map(img => ({
                        id: img.image_id,
                        file_name: img.file_name.split('/').pop() || img.file_name,
                        width: img.width,
                        height: img.height,
                        image_category: cat,
                        note: img.note || ''
                    })),
                    annotations: [],
                    categories: datasetData.categories.map((c, idx) => ({ id: idx + 1, name: c }))
                };

                let annId = 1;
                catImages.forEach(img => {
                    img.annotations.forEach(ann => {
                        const catIdx = datasetData.categories.indexOf(ann.category);
                        cocoData.annotations.push({
                            id: annId++,
                            image_id: img.image_id,
                            category_id: catIdx >= 0 ? catIdx + 1 : 1,
                            bbox: ann.bbox,
                            area: ann.area || (ann.bbox ? ann.bbox[2] * ann.bbox[3] : 0),
                            iscrowd: ann.iscrowd || 0
                        });
                    });
                });

                categoryFolder.file(annFilename, JSON.stringify(cocoData, null, 2));

                // 2. 拉取图片并加入压缩包（可选：同时导出带框图片）
                setExportProgress(`正在打包 ${folderName} (${catImages.length} 张)...`);
                for (let i = 0; i < catImages.length; i++) {
                    const img = catImages[i];
                    const imageName = img.file_name.split('/').pop() || img.file_name;
                    try {
                        let url = `/api/get_image?dataset_id=${encodeURIComponent(datasetId)}&file_name=${encodeURIComponent(img.file_name)}`;
                        if (img.source_path != null && img.source_path !== '') url += `&source_path=${encodeURIComponent(img.source_path)}`;
                        const res = await fetch(url);
                        if (res.ok) {
                            const blob = await res.blob();
                            categoryFolder.file(imageName, blob);
                            if (exportWithBoxes && img.annotations && img.annotations.length > 0) {
                                const bboxName = imageName.replace(/\.[^.]+$/, '') + '_bbox.png';
                                try {
                                    const bboxBlob = await drawImageWithBoxes(blob, img.width, img.height, img.annotations, palette);
                                    categoryFolder.file(bboxName, bboxBlob);
                                } catch (e) {
                                    console.warn('Skip bbox image:', img.file_name, e);
                                }
                            }
                        }
                    } catch (e) {
                        console.warn('Skip image:', img.file_name, e);
                    }
                    if ((i + 1) % 10 === 0) {
                        setExportProgress(`${folderName}: ${i + 1}/${catImages.length}`);
                    }
                }

                exportedDirs++;
            }

            if (exportedDirs === 0) {
                setExportProgress('');
                alert('没有选中任何分类或没有图片。');
                setExporting(false);
                return;
            }

            setExportProgress(exp.progressGenerating || '正在生成压缩包...');
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            let name = (zipFileName && zipFileName.trim()) ? zipFileName.trim() : defaultZipName;
            if (!name.endsWith('.zip')) name += '.zip';
            a.download = name.replace(/[/\\?*:|"<>]/g, '_');
            a.click();
            URL.revokeObjectURL(url);
            setExportProgress('');
            alert(`导出成功！共 ${exportedDirs} 个目录，每个目录含图片与 ${annFilename}。`);
            onClose();
        } catch (err) {
            setExportProgress('');
            alert('导出失败: ' + err.message);
        }
        setExporting(false);
    };

    const defaultCat = catList[0] || '未分类';
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{exp.modalTitle}</h3>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="modal-body">
                    <p style={{marginBottom: '15px', color: '#666'}}>{exp.modalDescription}</p>
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#555' }}>ZIP 文件名</label>
                        <input
                            type="text"
                            className="filter-input"
                            value={zipFileName}
                            onChange={(e) => setZipFileName(e.target.value)}
                            placeholder={defaultZipName}
                            style={{ width: '100%', maxWidth: '400px' }}
                        />
                        <span style={{ fontSize: '12px', color: '#888', marginLeft: '8px' }}>（不含路径，未填则用默认名）</span>
                    </div>
                    <div style={{ marginBottom: '15px' }}>
                        <span style={{ fontSize: '13px', color: '#555', marginRight: '10px' }}>多类别图片：</span>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginRight: '16px', cursor: 'pointer' }}>
                            <input type="radio" name="multiCatMode" checked={exportMultiCategoryMode === 'all'} onChange={() => setExportMultiCategoryMode('all')} />
                            <span>放入所有归属目录</span>
                        </label>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                            <input type="radio" name="multiCatMode" checked={exportMultiCategoryMode === 'priority'} onChange={() => setExportMultiCategoryMode('priority')} />
                            <span>仅放入最高优先级目录</span>
                        </label>
                    </div>
                    <label className="export-with-boxes-option" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={exportWithBoxes} onChange={(e) => setExportWithBoxes(e.target.checked)} />
                        <span>同时导出带框图片（每张原图会多生成一张 _bbox.png，框上方显示类别；若有 score 则显示置信度）</span>
                    </label>
                    <div className="export-categories">
                        {catList.map(cat => {
                            const count = images.filter(img => {
                                const c = imageClassifications[img.image_id];
                                const arr = Array.isArray(c) && c.length ? c : [defaultCat];
                                return arr.includes(cat);
                            }).length;
                            return (
                                <label key={cat} className="export-category-item">
                                    <input
                                        type="checkbox"
                                        checked={selectedCategories.has(cat)}
                                        onChange={() => toggleCategory(cat)}
                                    />
                                    <span className="export-category-color" style={{ background: catColors[cat] || '#888' }}></span>
                                    <span className="export-category-name">{cat}</span>
                                    <span className="export-category-count">({count}张)</span>
                                </label>
                            );
                        })}
                    </div>
                </div>
                {exporting && exportProgress && (
                    <div className="modal-progress">
                        <span className="modal-progress-text">{exportProgress}</span>
                    </div>
                )}
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose} disabled={exporting}>取消</button>
                    <button className="btn btn-primary" onClick={handleExport} disabled={exporting || selectedCategories.size === 0}>
                        {exporting ? '导出中...' : exp.exportButtonText}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ==================== 图片查看器（仅查看，支持图片分类与备注） ====================
function ImageViewer({ image, images, datasetId, categories, imageClassifications, imageNotes, imageCategories, onClose, onNavigate, onUpdateCategory, onUpdateCategories, onUpdateNote }) {
    const config = useConfig();
    const viewer = config.viewer || DEFAULT_CONFIG.viewer;
    const catList = imageCategories || DEFAULT_CONFIG.imageCategories;
    const palette = config.colorPalette || DEFAULT_CONFIG.colorPalette;
    const canvasRef = useRef(null);
    const imgRef = useRef(null);
    const wrapperRef = useRef(null);
    const containerRef = useRef(null);
    const dragStartRef = useRef(null);
    const zoomPanRef = useRef({ zoom: 1, panX: 0, panY: 0 });
    const modifierKeyRef = useRef(false);
    const [zoom, setZoom] = useState(1);
    const [panX, setPanX] = useState(0);
    const [panY, setPanY] = useState(0);
    useEffect(() => { zoomPanRef.current = { zoom, panX, panY }; }, [zoom, panX, panY]);
    const [hiddenAnns, setHiddenAnns] = useState(new Set());
    const [hoveredAnnIdx, setHoveredAnnIdx] = useState(null);
    const lineWidthOpts = viewer.lineWidthOptions || [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
    const [lineWidth, setLineWidth] = useState(() => {
        const d = viewer.lineWidthDefault;
        return (typeof d === 'number' && lineWidthOpts.includes(d)) ? d : (lineWidthOpts[4] ?? 0.5);
    });
    const [currentImage, setCurrentImage] = useState(image);
    const [noteInput, setNoteInput] = useState('');
    const noteInputRef = useRef(null);

    const imageIdx = images.findIndex(i => i.image_id === currentImage.image_id);
    let imageUrl = `/api/get_image?dataset_id=${datasetId}&file_name=${encodeURIComponent(currentImage.file_name)}`;
    if (currentImage.source_path != null && currentImage.source_path !== '') imageUrl += `&source_path=${encodeURIComponent(currentImage.source_path)}`;
    const rawCats = imageClassifications[currentImage.image_id];
    const currentCategories = Array.isArray(rawCats) && rawCats.length ? rawCats : [catList[0] || '未分类'];
    const currentCategory = currentCategories[0];
    const currentNote = imageNotes[currentImage.image_id] || '';

    useEffect(() => { setNoteInput(currentNote); }, [currentImage.image_id, currentNote]);

    const fitZoom = useCallback(() => {
        if (!imgRef.current || !containerRef.current) return 1;
        const cw = containerRef.current.clientWidth - 40;
        const ch = containerRef.current.clientHeight - 40;
        const iw = imgRef.current.naturalWidth;
        const ih = imgRef.current.naturalHeight;
        if (iw === 0 || ih === 0) return 1;
        return Math.min(cw / iw, ch / ih, 1);
    }, []);

    // 仅根据容器与图片元数据（宽高）计算适应缩放，不依赖图片加载，任意分辨率打开即自适应
    const getFitZoomFromMeta = useCallback(() => {
        const el = containerRef.current;
        const w = currentImage.width, h = currentImage.height;
        if (!el || !w || !h) return 1;
        const cw = el.clientWidth - 40, ch = el.clientHeight - 40;
        if (cw <= 0 || ch <= 0) return 1;
        return Math.min(cw / w, ch / h, 1);
    }, [currentImage.width, currentImage.height]);

    const drawAnnotations = useCallback(() => {
        const canvas = canvasRef.current;
        const img = imgRef.current;
        if (!canvas || !img || img.naturalWidth === 0) return;
        const w = img.naturalWidth * zoom;
        const h = img.naturalHeight * zoom;
        img.style.width = w + 'px';
        img.style.height = h + 'px';
        canvas.width = w;
        canvas.height = h;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        const ctx = canvas.getContext('2d');
        const sx = w / currentImage.width;
        const sy = h / currentImage.height;
        ctx.clearRect(0, 0, w, h);
        currentImage.annotations.forEach((ann, idx) => {
            if (!ann.bbox || hiddenAnns.has(idx)) return;
            const [x, y, bw, bh] = ann.bbox;
            const rx = x * sx, ry = y * sy, rw = bw * sx, rh = bh * sy;
            const isHovered = hoveredAnnIdx === idx;
            ctx.strokeStyle = getCategoryColor(palette, ann.category);
            ctx.lineWidth = isHovered ? Math.max(lineWidth + 0.2, 0.3) : lineWidth;
            if (isHovered) ctx.setLineDash([6, 4]);
            ctx.strokeRect(rx, ry, rw, rh);
            if (isHovered) ctx.setLineDash([]);
            if (isHovered) {
                const area = bw * bh;
                const lines = [
                    ann.category,
                    `[${Math.round(x)},${Math.round(y)},${Math.round(bw)}×${Math.round(bh)}]`,
                    `面积: ${area.toLocaleString()}`
                ];
                ctx.font = '12px sans-serif';
                const lineH = 14;
                const pad = 6;
                const boxW = Math.max(...lines.map(l => ctx.measureText(l).width)) + pad * 2;
                const boxH = lines.length * lineH + pad * 2;
                let tx = rx, ty = ry - boxH - 4;
                if (ty < 0) ty = ry + rh + 4;
                if (tx + boxW > w) tx = w - boxW;
                if (tx < 0) tx = 4;
                ctx.fillStyle = 'rgba(0,0,0,0.85)';
                ctx.fillRect(tx, ty, boxW, boxH);
                ctx.strokeStyle = getCategoryColor(palette, ann.category);
                ctx.lineWidth = 1;
                ctx.strokeRect(tx, ty, boxW, boxH);
                ctx.fillStyle = '#fff';
                lines.forEach((line, i) => {
                    ctx.fillText(line, tx + pad, ty + pad + (i + 1) * lineH - 2);
                });
            }
        });
    }, [currentImage, zoom, hiddenAnns, hoveredAnnIdx, lineWidth, palette]);

    useEffect(() => {
        setPanX(0);
        setPanY(0);
    }, [currentImage.image_id]);

    // 切换图片时立即按元数据做自适应缩放（不等待图片加载），任意分辨率都先适应屏幕
    useEffect(() => {
        const z = getFitZoomFromMeta();
        setZoom(z);
        const t = requestAnimationFrame(() => {
            setZoom(getFitZoomFromMeta());
        });
        return () => cancelAnimationFrame(t);
    }, [currentImage.image_id, getFitZoomFromMeta]);

    const handleImageLoad = () => {
        setZoom(fitZoom());
        setTimeout(drawAnnotations, 50);
    };

    useEffect(() => { drawAnnotations(); }, [zoom, hiddenAnns, hoveredAnnIdx, lineWidth, drawAnnotations]);

    const navigate = (dir) => {
        if (onUpdateNote && noteInput !== currentNote) onUpdateNote(currentImage.image_id, noteInput);
        const newIdx = imageIdx + dir;
        if (newIdx >= 0 && newIdx < images.length) {
            setCurrentImage(images[newIdx]);
            setHiddenAnns(new Set());
            onNavigate(images[newIdx]);
        }
    };

    const toggleAnn = (idx) => {
        const newSet = new Set(hiddenAnns);
        if (newSet.has(idx)) newSet.delete(idx);
        else newSet.add(idx);
        setHiddenAnns(newSet);
    };

    const handleCategoryChange = (e) => {
        const cat = e.target.value;
        const next = [cat, ...currentCategories.filter(c => c !== cat)];
        if (onUpdateCategories) onUpdateCategories(currentImage.image_id, next); else if (onUpdateCategory) onUpdateCategory(currentImage.image_id, cat);
    };
    const toggleCategory = (cat) => {
        const has = currentCategories.includes(cat);
        const next = has ? currentCategories.filter(c => c !== cat) : [...currentCategories, cat];
        if (next.length === 0) next.push(catList[0] || '未分类');
        if (onUpdateCategories) onUpdateCategories(currentImage.image_id, next);
    };

    const handleNoteBlur = () => {
        if (onUpdateNote && noteInput !== currentNote) onUpdateNote(currentImage.image_id, noteInput);
    };

    useEffect(() => {
        const handleKey = (e) => {
            const inInput = document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);

            if (e.key === 'Escape') {
                if (onUpdateNote && noteInput !== currentNote) onUpdateNote(currentImage.image_id, noteInput);
                if (inInput) {
                    document.activeElement.blur();
                    e.preventDefault();
                } else {
                    onClose();
                }
                return;
            }
            if (inInput) return;

            if (e.key === 'ArrowLeft' || e.key === 'a') navigate(-1);
            else if (e.key === 'ArrowRight' || e.key === 'd') navigate(1);
            else if (e.key.toLowerCase() === 'n') {
                e.preventDefault();
                if (noteInputRef.current) noteInputRef.current.focus();
            } else if (e.key >= '1' && e.key <= '9') {
                const idx = parseInt(e.key, 10) - 1;
                if (catList[idx]) {
                    e.preventDefault();
                    const cat = catList[idx];
                    if (onUpdateCategories) onUpdateCategories(currentImage.image_id, [cat, ...currentCategories.filter(c => c !== cat)]);
                    else if (onUpdateCategory) onUpdateCategory(currentImage.image_id, cat);
                }
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [imageIdx, currentImage.image_id, noteInput, currentNote, catList, currentCategories, onUpdateCategories, onUpdateCategory]);

    // 跟踪 Ctrl/Cmd 按下状态（部分浏览器/系统在 wheel 事件中不设置 ctrlKey/metaKey）
    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.key === 'Control' || e.key === 'Meta') modifierKeyRef.current = true;
        };
        const onKeyUp = (e) => {
            if (e.key === 'Control' || e.key === 'Meta') modifierKeyRef.current = false;
        };
        const onBlur = () => { modifierKeyRef.current = false; };
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('blur', onBlur);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('blur', onBlur);
        };
    }, []);

    // 滚轮缩放：支持 (1) 配置“无需修饰键”时直接滚轮缩放 (2) 否则 Ctrl/Cmd+滚轮；以光标所指图片像素为锚点
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const zoomMin = viewer.zoomMin ?? 0.02;
        const zoomMax = viewer.zoomMax ?? 100;
        const factorOut = viewer.wheelZoomFactorOut ?? 0.9;
        const factorIn = viewer.wheelZoomFactorIn ?? 1.1;
        const noModifier = viewer.wheelZoomWithoutModifier === true;
        const onWheel = (e) => {
            const withModifier = e.ctrlKey || e.metaKey || modifierKeyRef.current;
            if (!noModifier && !withModifier) return;
            e.preventDefault();
            e.stopPropagation();
            const img = imgRef.current;
            const wrapper = wrapperRef.current;
            if (!img || !wrapper || img.naturalWidth === 0) return;
            const wr = wrapper.getBoundingClientRect();
            const z = zoomPanRef.current.zoom;
            const iw = img.naturalWidth;
            const ih = img.naturalHeight;
            // 用 wrapper 实际渲染尺寸计算图片像素，避免 5K/高分辨率下 naturalWidth*zoom 与 DOM 不一致
            const cursorInImageX = e.clientX - wr.left;
            const cursorInImageY = e.clientY - wr.top;
            const imgPixelX = wr.width > 0 ? (cursorInImageX * iw) / wr.width : cursorInImageX / z;
            const imgPixelY = wr.height > 0 ? (cursorInImageY * ih) / wr.height : cursorInImageY / z;
            const unit = e.deltaMode === 0 ? 1 : e.deltaMode === 1 ? 33 : 100;
            const delta = e.deltaY * unit;
            const factor = delta > 0 ? factorOut : factorIn;
            const absDelta = Math.abs(delta);
            const steps = Math.min(Math.max(Math.floor(absDelta / 80), 1), 5);
            const effectiveFactor = Math.pow(factor, steps);
            const newZoom = Math.max(zoomMin, Math.min(zoomMax, z * effectiveFactor));
            const newWrapperW = iw * newZoom;
            const newWrapperH = ih * newZoom;
            // 缩放后要让同一图片像素 (imgPixelX, imgPixelY) 仍落在光标下
            // 即：新 wrapper 左上角 + (imgPixelX*newZoom, imgPixelY*newZoom) = (e.clientX, e.clientY)
            const newWrapperLeft = e.clientX - imgPixelX * newZoom;
            const newWrapperTop = e.clientY - imgPixelY * newZoom;
            // 反解 pan：wrapper 在视口中 left = containerRect.left + (centerX - wrapperW/2 + panX) - scrollLeft
            const containerRect = el.getBoundingClientRect();
            const scrollLeft = el.scrollLeft || 0;
            const scrollTop = el.scrollTop || 0;
            const centerX = el.clientWidth / 2;
            const centerY = el.clientHeight / 2;
            const newPanX = newWrapperLeft - containerRect.left - centerX + newWrapperW / 2 + scrollLeft;
            const newPanY = newWrapperTop - containerRect.top - centerY + newWrapperH / 2 + scrollTop;
            setZoom(newZoom);
            setPanX(newPanX);
            setPanY(newPanY);
        };
        el.addEventListener('wheel', onWheel, { passive: false, capture: true });
        return () => el.removeEventListener('wheel', onWheel, { capture: true });
    }, [viewer.zoomMin, viewer.zoomMax, viewer.wheelZoomFactorOut, viewer.wheelZoomFactorIn, viewer.wheelZoomWithoutModifier]);

    // 左键按下即开始拖动平移（无其他限制）
    const handleMouseDown = (e) => {
        if (e.button !== 0) return; // 仅响应左键
        e.preventDefault();
        e.stopPropagation();
        dragStartRef.current = { clientX: e.clientX, clientY: e.clientY, panX, panY };
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!dragStartRef.current) return;
            e.preventDefault();
            const { clientX: x0, clientY: y0, panX: px0, panY: py0 } = dragStartRef.current;
            setPanX(px0 + e.clientX - x0);
            setPanY(py0 + e.clientY - y0);
        };
        const handleMouseUp = () => {
            dragStartRef.current = null;
        };
        window.addEventListener('mousemove', handleMouseMove, { passive: false });
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    return (
        <div className="viewer-modal">
            <div className="viewer-header">
                <div className="viewer-nav">
                    <button className="viewer-nav-btn" disabled={imageIdx <= 0} onClick={() => navigate(-1)}>‹ 上一张</button>
                    <span className="viewer-info">{imageIdx + 1} / {images.length}</span>
                    <button className="viewer-nav-btn" disabled={imageIdx >= images.length - 1} onClick={() => navigate(1)}>下一张 ›</button>
                </div>
                <div className="viewer-info">
                    {currentImage.file_name.split('/').pop()}
                    {currentImage.source_path != null && currentImage.source_path !== '' && (
                        <span className="viewer-dir" title={currentImage.source_path}> · 目录: {currentImage.source_path}</span>
                    )}
                </div>
                <div className="viewer-controls">
                    <button type="button" className="viewer-nav-btn" onClick={() => setZoom(z => Math.min(viewer?.zoomMax ?? 100, z * 1.2))}>+</button>
                    <span className="viewer-zoom-text">{Math.round(zoom * 100)}%</span>
                    <button type="button" className="viewer-nav-btn" onClick={() => setZoom(z => Math.max(viewer?.zoomMin ?? 0.02, z / 1.2))}>−</button>
                    <button type="button" className="viewer-nav-btn" onClick={() => { setZoom(fitZoom()); setPanX(0); setPanY(0); }}>适应窗口</button>
                    <span style={{margin: '0 10px', color: '#888', fontSize: '12px'}}>{viewer.lineWidthLabel}</span>
                    <select className="viewer-linewidth-select" value={lineWidth} onChange={(e) => setLineWidth(Number(e.target.value))} title="线宽 0.1～1">
                        {lineWidthOpts.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <button className="viewer-nav-btn" onClick={onClose} style={{background: '#dc3545', marginLeft: '20px'}}>✕</button>
                </div>
            </div>

            <div className="viewer-body">
                <div
                    className={`viewer-canvas-area ${(viewer.backgroundStyle || 'checkerboard') === 'checkerboard' ? 'viewer-bg-checkerboard' : 'viewer-bg-solid'}`}
                    ref={containerRef}
                    onMouseDown={handleMouseDown}
                    style={(viewer.backgroundStyle || 'checkerboard') === 'checkerboard'
                        ? { '--checkerboard-1': viewer.checkerboardColor1 || '#2d2d44', '--checkerboard-2': viewer.checkerboardColor2 || '#252548' }
                        : { background: viewer.backgroundColor || '#1a1a2e' }
                    }
                >
                    <div className="viewer-image-wrapper" ref={wrapperRef} style={{ transform: `translate(${panX}px, ${panY}px)` }}>
                        <img ref={imgRef} src={imageUrl} alt="" onLoad={handleImageLoad} draggable={false} />
                        <canvas ref={canvasRef} className="viewer-canvas"></canvas>
                    </div>
                </div>

                <div className="viewer-sidebar">
                    <div className="viewer-sidebar-header">
                        <span>图片信息</span>
                    </div>
                    <div className="viewer-sidebar-form">
                        <label className="viewer-form-label">主分类 (1–9 快捷键)</label>
                        <select className="viewer-form-select" value={currentCategory} onChange={handleCategoryChange}>
                            {catList.map((cat, i) => (
                                <option key={cat} value={cat}>{i < 9 ? `${i + 1}. ${cat}` : cat}</option>
                            ))}
                        </select>
                        <label className="viewer-form-label">也属于（多选）</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                            {catList.filter(c => c !== currentCategory && c !== (catList[0] || '未分类')).map(cat => (
                                <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={currentCategories.includes(cat)} onChange={() => toggleCategory(cat)} />
                                    <span style={{ background: (config.imageCategoryColors || {})[cat] || '#666', padding: '2px 6px', borderRadius: '4px', color: '#fff' }}>{cat}</span>
                                </label>
                            ))}
                        </div>
                        <label className="viewer-form-label">备注 (N 聚焦)</label>
                        <textarea
                            ref={noteInputRef}
                            className="viewer-form-textarea"
                            value={noteInput}
                            onChange={(e) => setNoteInput(e.target.value)}
                            onBlur={handleNoteBlur}
                            placeholder="图片级别备注..."
                            rows={3}
                        />
                    </div>
                    <div className="viewer-sidebar-header" style={{marginTop: '10px'}}>
                        <span>标注列表</span>
                        <span>{currentImage.annotations.length}</span>
                    </div>
                    <div style={{padding: '8px 12px', borderBottom: '1px solid #3d3d5c', fontSize: '11px', color: '#888'}}>
                        <div>文件: {currentImage.file_name.split('/').pop()}</div>
                        <div>尺寸: {currentImage.width} × {currentImage.height}</div>
                    </div>
                    <div className="viewer-sidebar-list">
                        {currentImage.annotations.map((ann, idx) => (
                            <div
                                key={idx}
                                className={`viewer-ann-item ${hiddenAnns.has(idx) ? 'hidden' : ''} ${hoveredAnnIdx === idx ? 'viewer-ann-item-hovered' : ''}`}
                                style={{ borderLeftColor: getCategoryColor(palette, ann.category) }}
                                onClick={() => toggleAnn(idx)}
                                onMouseEnter={() => setHoveredAnnIdx(idx)}
                                onMouseLeave={() => setHoveredAnnIdx(null)}
                            >
                                <div className="viewer-ann-color" style={{ background: getCategoryColor(palette, ann.category) }}></div>
                                <span className="viewer-ann-text">{ann.category}</span>
                                {ann.score !== undefined && <span className="viewer-ann-score">{(ann.score * 100).toFixed(0)}%</span>}
                                <span style={{marginLeft: 'auto', color: '#666'}}>{hiddenAnns.has(idx) ? '○' : '●'}</span>
                            </div>
                        ))}
                    </div>
                    <div style={{padding: '10px', background: '#2d2d44', display: 'flex', gap: '8px'}}>
                        <button className="tool-btn" style={{flex: 1}} onClick={() => setHiddenAnns(new Set())}>全部显示</button>
                        <button className="tool-btn" style={{flex: 1}} onClick={() => setHiddenAnns(new Set(currentImage.annotations.map((_, i) => i)))}>全部隐藏</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ==================== EDA可视化页面 ====================
function EDAPage({ datasetData }) {
    const config = useConfig();
    const eda = config.eda || DEFAULT_CONFIG.eda;
    const palette = config.colorPalette || DEFAULT_CONFIG.colorPalette;
    const pieRef = useRef(null);
    const barRef = useRef(null);
    const areaRef = useRef(null);
    const sqrtAreaRef = useRef(null);
    const maxSideRef = useRef(null);
    const whRatioRef = useRef(null);
    const aspectRatioRef = useRef(null);
    const whRef = useRef(null);
    const centerRef = useRef(null);
    const bboxRef = useRef(null);
    const densityRef = useRef(null);
    
    const [densityCategory, setDensityCategory] = useState('');
    const [densityMetric, setDensityMetric] = useState('area');
    const [edaTab, setEdaTab] = useState('category');
    const [useNormalized, setUseNormalized] = useState(true);

    // 生成箱线图的通用函数
    const generateBoxPlot = (ref, data, title, yLabel) => {
        if (!ref.current || !data) return;
        const cats = [...new Set(data.category)];
        const traces = cats.map(cat => ({
            y: data.values.filter((_, i) => data.category[i] === cat),
            name: cat,
            type: 'box'
        }));
        Plotly.newPlot(ref.current, traces, { title, yaxis: { title: yLabel }, height: 400 }, { responsive: true });
    };

    useEffect(() => {
        if (!datasetData) return;
        
        // 设置默认密度图类别
        if (datasetData.categories?.length > 0 && !densityCategory) {
            setDensityCategory(datasetData.categories[0]);
        }

        // 1. 类别分布饼图
        if (pieRef.current && datasetData.class_distribution_pie) {
            Plotly.newPlot(pieRef.current, [{
                labels: datasetData.class_distribution_pie.labels,
                values: datasetData.class_distribution_pie.values,
                type: 'pie',
                textinfo: 'label+percent',
                hole: 0.3
            }], { title: '类别分布', height: 400 }, { responsive: true });
        }

        // 2. 类别数量柱状图
        if (barRef.current && datasetData.class_counts) {
            Plotly.newPlot(barRef.current, [{
                x: datasetData.class_counts.categories,
                y: datasetData.class_counts.counts,
                type: 'bar',
                marker: { color: '#667eea' }
            }], { title: '类别数量', xaxis: { title: '类别' }, yaxis: { title: '数量' }, height: 400 }, { responsive: true });
        }

        const stats = useNormalized
            ? (datasetData.all_categories_stats || datasetData.all_categories_stats_raw)
            : (datasetData.all_categories_stats_raw || datasetData.all_categories_stats);
        if (!stats) return;

        const isNorm = useNormalized;
        const areaTitle = isNorm ? '面积分布（归一化）' : '面积分布（像素）';
        const areaY = isNorm ? '面积 (0-1)' : '面积 (像素)';
        const sqrtTitle = isNorm ? '面积平方根分布（归一化）' : '面积平方根分布（像素）';
        const sqrtY = isNorm ? 'sqrt(面积) (0-1)' : 'sqrt(面积) (像素)';
        const maxTitle = isNorm ? '长边分布（归一化）' : '长边分布（像素）';
        const maxY = isNorm ? '长边 (0-1)' : '长边 (像素)';
        const whTitle = isNorm ? '宽度和高度分布（归一化）' : '宽度和高度分布（像素）';
        const whY = isNorm ? '归一化 (0-1)' : '像素';
        const centerTitle = isNorm ? '中心点分布（归一化）' : '中心点分布（像素）';
        const centerXY = isNorm ? ' (0-1)' : ' (像素)';
        const bboxTitle = isNorm ? 'BBox分布（宽×高 归一化，按类别）' : 'BBox分布（宽×高 像素，按类别）';
        const bboxXY = isNorm ? ' (0-1)' : ' (像素)';

        // 3. 面积分布
        generateBoxPlot(areaRef, stats.area, areaTitle, areaY);
        // 4. 面积平方根分布
        generateBoxPlot(sqrtAreaRef, stats.sqrt_area, sqrtTitle, sqrtY);
        // 5. 长边分布
        generateBoxPlot(maxSideRef, stats.max_side, maxTitle, maxY);
        // 6. 宽高比分布（无单位，不随切换变化）
        generateBoxPlot(whRatioRef, stats.wh_ratio, '宽高比分布', '宽高比');
        // 7. 长短边比分布
        generateBoxPlot(aspectRatioRef, stats.aspect_ratio, '长短边比分布', '长短边比');
        // 8. 宽度和高度分布
        if (whRef.current && stats.width && stats.height) {
            const traces = [];
            const cats = [...new Set(stats.width.category)];
            cats.forEach(cat => {
                traces.push({
                    y: stats.width.values.filter((_, i) => stats.width.category[i] === cat),
                    name: `${cat} (宽)`,
                    type: 'box'
                });
                traces.push({
                    y: stats.height.values.filter((_, i) => stats.height.category[i] === cat),
                    name: `${cat} (高)`,
                    type: 'box'
                });
            });
            Plotly.newPlot(whRef.current, traces, { title: whTitle, yaxis: { title: whY }, height: 400 }, { responsive: true });
        }
        // 9. 中心点分布
        if (centerRef.current && stats.center) {
            const cats = [...new Set(stats.center.category)];
            const traces = cats.map(cat => ({
                x: stats.center.x.filter((_, i) => stats.center.category[i] === cat),
                y: stats.center.y.filter((_, i) => stats.center.category[i] === cat),
                mode: 'markers',
                type: 'scatter',
                name: cat,
                marker: { size: 5, opacity: 0.6 }
            }));
            Plotly.newPlot(centerRef.current, traces, { 
                title: centerTitle, 
                xaxis: { title: '中心 X' + centerXY }, 
                yaxis: { title: '中心 Y' + centerXY }, 
                height: 500 
            }, { responsive: true });
        }
        // 10. bbox分布
        if (bboxRef.current && stats.width && stats.height) {
            const cats = [...new Set(stats.width.category)];
            const traces = cats.map(cat => {
                const x = stats.width.values.filter((_, i) => stats.width.category[i] === cat);
                const y = stats.height.values.filter((_, i) => stats.height.category[i] === cat);
                return {
                    x, y,
                    mode: 'markers',
                    type: 'scatter',
                    name: cat,
                    marker: { size: 8, opacity: 0.6, color: getCategoryColor(palette, cat) }
                };
            });
            Plotly.newPlot(bboxRef.current, traces, { 
                title: bboxTitle, 
                xaxis: { title: '宽度' + bboxXY }, 
                yaxis: { title: '高度' + bboxXY }, 
                height: 500 
            }, { responsive: true });
        }
    }, [datasetData, useNormalized]);

    // 11. 密度分布图（可选类别和指标，随归一化/像素切换）
    useEffect(() => {
        const categoryData = useNormalized
            ? (datasetData?.category_data || datasetData?.category_data_raw)
            : (datasetData?.category_data_raw || datasetData?.category_data);
        if (!densityRef.current || !categoryData || !densityCategory) return;
        
        const catData = categoryData[densityCategory];
        if (!catData) return;

        let values = [];
        const suffix = useNormalized ? '（归一化）' : '（像素）';
        const metricNames = { 
            'area': '面积' + suffix, 'sqrt_area': '面积平方根' + suffix, 'max_side': '长边' + suffix, 'min_side': '短边' + suffix, 
            'width': '宽度' + suffix, 'height': '高度' + suffix, 'wh_ratio': '宽高比', 'aspect_ratio': '长短边比' 
        };

        switch(densityMetric) {
            case 'area': values = catData.area?.values || []; break;
            case 'sqrt_area': values = catData.area?.sqrt_values || []; break;
            case 'max_side': values = catData.dimensions?.max_side || []; break;
            case 'min_side': values = catData.dimensions?.min_side || []; break;
            case 'width': values = catData.dimensions?.width || []; break;
            case 'height': values = catData.dimensions?.height || []; break;
            case 'wh_ratio': values = catData.ratios?.wh_ratio || []; break;
            case 'aspect_ratio': values = catData.ratios?.aspect_ratio || []; break;
        }

        if (values.length > 0) {
            Plotly.newPlot(densityRef.current, [{
                x: values,
                type: 'histogram',
                nbinsx: 30,
                marker: { color: getCategoryColor(palette, densityCategory) }
            }], { 
                title: `${densityCategory} - ${metricNames[densityMetric]} ${eda.chartDensity || '密度分布'}`,
                xaxis: { title: metricNames[densityMetric] },
                yaxis: { title: '频数' },
                height: 400
            }, { responsive: true });
        }
    }, [densityCategory, densityMetric, datasetData, palette, eda.chartDensity, useNormalized]);

    return (
        <div className="main-content">
            <div className="top-toolbar">
                <div className="toolbar-left">
                    <h2 style={{fontSize: '16px', fontWeight: 500}}>{eda.pageTitle}</h2>
                    <span style={{color: '#888', fontSize: '13px'}}>
                        图片: {datasetData.num_images} | 标注: {datasetData.num_annotations} | 类别: {datasetData.num_categories}
                    </span>
                </div>
                <div className="toolbar-right" style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                    <span style={{fontSize: '13px', color: '#888'}}>统计尺度:</span>
                    <button
                        type="button"
                        className={`eda-tab ${useNormalized ? 'active' : ''}`}
                        onClick={() => setUseNormalized(true)}
                        style={{padding: '6px 12px', fontSize: '13px'}}
                    >归一化</button>
                    <button
                        type="button"
                        className={`eda-tab ${!useNormalized ? 'active' : ''}`}
                        onClick={() => setUseNormalized(false)}
                        style={{padding: '6px 12px', fontSize: '13px'}}
                    >像素值</button>
                </div>
            </div>
            <div className="eda-tabs">
                <button type="button" className={`eda-tab ${edaTab === 'category' ? 'active' : ''}`} onClick={() => setEdaTab('category')}>{eda.sectionCategory}</button>
                <button type="button" className={`eda-tab ${edaTab === 'size' ? 'active' : ''}`} onClick={() => setEdaTab('size')}>{eda.sectionSize}</button>
                <button type="button" className={`eda-tab ${edaTab === 'ratio' ? 'active' : ''}`} onClick={() => setEdaTab('ratio')}>{eda.sectionRatio}</button>
                <button type="button" className={`eda-tab ${edaTab === 'space' ? 'active' : ''}`} onClick={() => setEdaTab('space')}>{eda.sectionSpace}</button>
                <button type="button" className={`eda-tab ${edaTab === 'density' ? 'active' : ''}`} onClick={() => setEdaTab('density')}>{eda.sectionDensity}</button>
            </div>
            <div className="eda-page">
                {/* 类别分布 */}
                <div className="eda-section" style={{ display: edaTab === 'category' ? 'block' : 'none' }}>
                    <h3 className="eda-section-title">{eda.sectionCategory}</h3>
                    <div className="eda-grid">
                        <div className="eda-card">
                            <div className="eda-card-title">{eda.chartCategoryPie}</div>
                            <div ref={pieRef} className="eda-chart"></div>
                        </div>
                        <div className="eda-card">
                            <div className="eda-card-title">{eda.chartCategoryBar}</div>
                            <div ref={barRef} className="eda-chart"></div>
                        </div>
                    </div>
                </div>

                {/* 尺寸分析 */}
                <div className="eda-section" style={{ display: edaTab === 'size' ? 'block' : 'none' }}>
                    <h3 className="eda-section-title">{eda.sectionSize}</h3>
                    <div className="eda-grid">
                        <div className="eda-card">
                            <div className="eda-card-title">{eda.chartArea}</div>
                            <div ref={areaRef} className="eda-chart"></div>
                        </div>
                        <div className="eda-card">
                            <div className="eda-card-title">{eda.chartAreaSqrt}</div>
                            <div ref={sqrtAreaRef} className="eda-chart"></div>
                        </div>
                        <div className="eda-card">
                            <div className="eda-card-title">{eda.chartLongEdge}</div>
                            <div ref={maxSideRef} className="eda-chart"></div>
                        </div>
                        <div className="eda-card">
                            <div className="eda-card-title">{eda.chartWidthHeight}</div>
                            <div ref={whRef} className="eda-chart"></div>
                        </div>
                    </div>
                </div>

                {/* 比例分析 */}
                <div className="eda-section" style={{ display: edaTab === 'ratio' ? 'block' : 'none' }}>
                    <h3 className="eda-section-title">{eda.sectionRatio}</h3>
                    <div className="eda-grid">
                        <div className="eda-card">
                            <div className="eda-card-title">{eda.chartAspectRatio}</div>
                            <div ref={whRatioRef} className="eda-chart"></div>
                        </div>
                        <div className="eda-card">
                            <div className="eda-card-title">{eda.chartLongShortRatio}</div>
                            <div ref={aspectRatioRef} className="eda-chart"></div>
                        </div>
                    </div>
                </div>

                {/* 空间分析 */}
                <div className="eda-section" style={{ display: edaTab === 'space' ? 'block' : 'none' }}>
                    <h3 className="eda-section-title">{eda.sectionSpace}</h3>
                    <div className="eda-grid">
                        <div className="eda-card">
                            <div className="eda-card-title">{eda.chartCenter}</div>
                            <div ref={centerRef} className="eda-chart"></div>
                        </div>
                        <div className="eda-card">
                            <div className="eda-card-title">{eda.chartBbox}</div>
                            <div ref={bboxRef} className="eda-chart"></div>
                        </div>
                    </div>
                </div>

                {/* 密度分析 */}
                <div className="eda-section" style={{ display: edaTab === 'density' ? 'block' : 'none' }}>
                    <h3 className="eda-section-title">{eda.sectionDensity}</h3>
                    <div className="eda-card" style={{maxWidth: '800px'}}>
                        <div className="eda-card-title">
                            {eda.chartDensity}
                            <div style={{display: 'inline-flex', gap: '10px', marginLeft: '20px'}}>
                                <select 
                                    className="filter-select" 
                                    value={densityCategory} 
                                    onChange={(e) => setDensityCategory(e.target.value)}
                                    style={{minWidth: '120px'}}
                                >
                                    {datasetData.categories?.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                                <select 
                                    className="filter-select" 
                                    value={densityMetric} 
                                    onChange={(e) => setDensityMetric(e.target.value)}
                                    style={{minWidth: '120px'}}
                                >
                                    <option value="area">面积</option>
                                    <option value="sqrt_area">面积平方根</option>
                                    <option value="max_side">长边</option>
                                    <option value="min_side">短边</option>
                                    <option value="width">宽度</option>
                                    <option value="height">高度</option>
                                    <option value="wh_ratio">宽高比</option>
                                    <option value="aspect_ratio">长短边比</option>
                                </select>
                            </div>
                        </div>
                        <div ref={densityRef} className="eda-chart"></div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// 渲染应用（从 /static/config.json 加载配置并合并到默认配置）
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<ConfigProvider><App /></ConfigProvider>);
