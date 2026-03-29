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
        imageCategoriesLabel: '图片分类',
        imageCategoriesHint: '用于标注图片级分类（如未分类、误检等），可增删改名称与颜色。',
        addCategoryButton: '添加分类',
        categoryNamePlaceholder: '分类名称',
        resetCategoriesButton: '恢复默认',
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
        descriptionHint: '最新内容即当前 COCO 文件（直接覆盖）；存档保存在同目录下 .coco_visualizer/ 中，分享该目录即可包含记录。',
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
        imageCategoriesLabel: '图片分类',
        imageCategoriesHint: '用于标注图片级分类（如未分类、误检等），可增删改名称与颜色。',
        addCategoryButton: '添加分类',
        categoryNamePlaceholder: '分类名称',
        resetCategoriesButton: '恢复默认',
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
        chartDensity: '密度分布',
        chartScore: '置信度分布（按类别）'
    }
};

const UNCLASSIFIED_LABEL = '未分类';

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
    // 固定首项为「未分类」，不可被配置覆盖
    if (out.imageCategories && Array.isArray(out.imageCategories) && out.imageCategories.length > 0) {
        out.imageCategories = [UNCLASSIFIED_LABEL, ...out.imageCategories.filter(c => c !== UNCLASSIFIED_LABEL)];
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
    const loadDatasetMerged = async (items, datasetName, rootPath) => {
        if (!items || items.length === 0) { alert('请至少选择一项'); return; }
        setLoading(true);
        try {
            const res = await fetch('/api/load_dataset_merged', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items, dataset_name: datasetName || 'merged', root_path: (rootPath || '').trim() })
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

    const applyDatasetAndFetchImages = async (data, metaFilters) => {
        setDatasetData(data);
        setCategories(data.categories);
        // 若 COCO 文件含有本软件写入的分类定义，完全按原定义加载（保持顺序、颜色、快捷键绑定）
        // 否则清空活跃定义，回退到用户自己的 config
        const catDefs = data.image_category_definitions;
        if (catDefs && Array.isArray(catDefs.categories) && catDefs.categories.length > 0) {
            setActiveImageCategories(catDefs.categories);
            setActiveImageCategoryColors(catDefs.colors || null);
        } else {
            setActiveImageCategories(null);
            setActiveImageCategoryColors(null);
        }
        const body = { dataset_id: data.dataset_id, selected_categories: data.categories };
        if (metaFilters && typeof metaFilters === 'object') {
            if (metaFilters.c_time_start) body.c_time_start = metaFilters.c_time_start;
            if (metaFilters.c_time_end) body.c_time_end = metaFilters.c_time_end;
            if (metaFilters.product_id_query) body.product_id_query = metaFilters.product_id_query;
            if (metaFilters.position) body.position = metaFilters.position;
        }
        const imgRes = await fetch('/api/get_images_by_category', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const imgData = await imgRes.json();
        if (imgData.success) {
            setImages(imgData.images || []);
            const initClass = {};
            const defaultCat = (config.imageCategories && config.imageCategories[0]) || '未分类';
            (imgData.images || []).forEach(img => {
                const cats = img.image_categories;
                initClass[img.image_id] = Array.isArray(cats) && cats.length > 0 ? cats : (img.image_category ? [img.image_category] : [defaultCat]);
            });
            setImageClassifications(initClass);
            const initNotes = {};
            (imgData.images || []).forEach(img => {
                initNotes[img.image_id] = img.note || '';
            });
            setImageNotes(initNotes);
        }
        setPage('gallery');
    };

    // 按图片元数据筛选后重新拉取列表（c_time / product_id / position）
    const refetchImagesWithMetaFilters = useCallback(async (filters) => {
        if (!datasetData) return;
        const body = { dataset_id: datasetData.dataset_id, selected_categories: categories };
        if (filters && typeof filters === 'object') {
            if (filters.c_time_start) body.c_time_start = filters.c_time_start;
            if (filters.c_time_end) body.c_time_end = filters.c_time_end;
            if (filters.product_id_query) body.product_id_query = filters.product_id_query;
            if (filters.position) body.position = filters.position;
        }
        try {
            const res = await fetch('/api/get_images_by_category', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (data.success && data.images) {
                setImages(data.images);
                const defaultCat = (config.imageCategories && config.imageCategories[0]) || '未分类';
                const newClass = {};
                const newNotes = {};
                data.images.forEach(img => {
                    const cats = img.image_categories;
                    newClass[img.image_id] = Array.isArray(cats) && cats.length > 0 ? cats : (img.image_category ? [img.image_category] : [defaultCat]);
                    newNotes[img.image_id] = img.note || '';
                });
                setImageClassifications(newClass);
                setImageNotes(newNotes);
            } else if (data.success && Array.isArray(data.images)) {
                setImages(data.images);
                setImageClassifications({});
                setImageNotes({});
            }
        } catch (err) {
            console.warn('refetch with meta filters failed', err);
        }
    }, [datasetData, categories, config.imageCategories]);

    // ---- 自动保存（防抖 3s）：任何分类/备注变动后静默写回 COCO 文件，下次打开即恢复 ----
    // 用 ref 持有最新数据，避免 timer 回调读到旧闭包
    const _autoSaveRef = useRef({ datasetData: null, images: [], imageClassifications: {}, imageNotes: {}, imageCategories: [], imageCategoryColors: {} });
    const _autoSaveTimer = useRef(null);
    const [autoSaveStatus, setAutoSaveStatus] = useState('idle'); // 'idle' | 'pending' | 'saved' | 'error'

    // 活跃分类定义：若 COCO 文件中有本软件写入的定义则优先采用，否则回退到 config
    const [activeImageCategories, setActiveImageCategories] = useState(null);
    const [activeImageCategoryColors, setActiveImageCategoryColors] = useState(null);

    // 当用户在设置里增删改类别时，同步合并到 activeImageCategories（config 改动优先，保持 COCO 文件定义的顺序）
    const prevConfigCatsRef = React.useRef(null);
    useEffect(() => {
        const configCats = config.imageCategories || DEFAULT_CONFIG.imageCategories;
        const prev = prevConfigCatsRef.current;
        prevConfigCatsRef.current = configCats;
        if (!activeImageCategories) return; // 未从文件加载，无需合并
        if (prev === null) return;          // 首次初始化，跳过
        if (prev === configCats) return;    // 没有变化
        // 计算新增/删除的类别
        const added = configCats.filter(c => !prev.includes(c));
        const removed = prev.filter(c => !configCats.includes(c));
        if (added.length === 0 && removed.length === 0) return;
        setActiveImageCategories(cur => {
            let next = (cur || []).filter(c => !removed.includes(c));
            added.forEach(c => { if (!next.includes(c)) next = [...next, c]; });
            return next;
        });
        if (removed.length > 0 || added.length > 0) {
            setActiveImageCategoryColors(cur => {
                const cols = { ...(cur || {}) };
                removed.forEach(c => delete cols[c]);
                const configColors = config.imageCategoryColors || DEFAULT_CONFIG.imageCategoryColors;
                added.forEach(c => { if (configColors[c]) cols[c] = configColors[c]; });
                return cols;
            });
        }
    }, [config.imageCategories, config.imageCategoryColors]);

    const imageCategories = activeImageCategories || config.imageCategories || DEFAULT_CONFIG.imageCategories;
    const imageCategoryColors = activeImageCategoryColors || config.imageCategoryColors || DEFAULT_CONFIG.imageCategoryColors;

    useEffect(() => {
        _autoSaveRef.current = { datasetData, images, imageClassifications, imageNotes, imageCategories, imageCategoryColors };
    }, [datasetData, images, imageClassifications, imageNotes, imageCategories, imageCategoryColors]);

    const scheduleAutoSave = useCallback(() => {
        setAutoSaveStatus('pending');
        if (_autoSaveTimer.current) clearTimeout(_autoSaveTimer.current);
        // 1 秒防抖：连续快速操作只触发最后一次，每次均生成版本快照
        _autoSaveTimer.current = setTimeout(async () => {
            const { datasetData, images, imageClassifications, imageNotes, imageCategories, imageCategoryColors } = _autoSaveRef.current;
            if (!datasetData || images.length === 0) return;
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
                        skip_version: true,
                        // 同时保存当前分类定义（顺序+颜色），让任何人打开此文件都能精确还原
                        image_category_definitions: { categories: imageCategories, colors: imageCategoryColors }
                    })
                });
                if (!res.ok) {
                    const errBody = await res.json().catch(() => ({}));
                    throw new Error(errBody.error || `HTTP ${res.status}`);
                }
                setAutoSaveStatus('saved');
                setTimeout(() => setAutoSaveStatus('idle'), 2500);
            } catch (e) {
                console.warn('auto-save failed:', e);
                setAutoSaveStatus('error');
                setTimeout(() => setAutoSaveStatus('idle'), 3000);
            }
        }, 1000);
    }, []);

    // 更新图片分类（单类，覆盖）
    const updateImageCategory = (imageId, category) => {
        setImageClassifications(prev => ({ ...prev, [imageId]: [category] }));
        scheduleAutoSave();
    };
    // 更新图片多分类（一图多类）：归入任意非「未分类」类别后自动移除「未分类」
    const updateImageCategories = (imageId, categoriesArray) => {
        const unclassified = (imageCategories && imageCategories[0]) || '未分类';
        let cats = categoriesArray && categoriesArray.length ? categoriesArray : [unclassified];
        // 若包含至少一个非「未分类」的类别，则去掉「未分类」
        if (cats.length > 1 || (cats.length === 1 && cats[0] !== unclassified)) {
            const filtered = cats.filter(c => c !== unclassified);
            if (filtered.length > 0) cats = filtered;
        }
        setImageClassifications(prev => ({ ...prev, [imageId]: cats }));
        scheduleAutoSave();
    };

    // 更新图片备注
    const updateImageNote = (imageId, note) => {
        setImageNotes(prev => ({ ...prev, [imageId]: note }));
        scheduleAutoSave();
    };

    // 批量更新选中图片的分类（每张图设为单类）
    const batchUpdateCategory = (imageIds, category) => {
        setImageClassifications(prev => {
            const newState = { ...prev };
            imageIds.forEach(id => { newState[id] = [category]; });
            return newState;
        });
        scheduleAutoSave();
    };

    // 回滚后重新拉取图片并更新分类/备注（从 COCO 文件读取）
    const refetchImageMetaAfterRollback = useCallback(async () => {
        if (!datasetData) return;
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
                    onUpdateCategory={updateImageCategory}
                    onUpdateCategories={updateImageCategories}
                    onUpdateNote={updateImageNote}
                    onBatchUpdateCategory={batchUpdateCategory}
                    onRollback={refetchImageMetaAfterRollback}
                    metaFilterOptions={datasetData.meta_filter_options}
                    onApplyMetaFilters={refetchImagesWithMetaFilters}
                    autoSaveStatus={autoSaveStatus}
                />
            )}
            {page === 'eda' && datasetData && <EDAPage datasetData={datasetData} />}
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

    const handleDetectLastRecord = async () => {
        const pathToCheck = (cocoPath || rootPath || '').trim();
        if (!pathToCheck) { alert('请先输入或选择目录/文件路径'); return; }
        try {
            const res = await fetch('/api/get_loader_record', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ coco_dir: pathToCheck })
            });
            const data = await res.json();
            if (data.success && data.record) {
                setCocoPath(data.record.coco_json_path);
                setImageDir(data.record.image_dir || '');
                setDatasetName(data.record.dataset_name || 'dataset');
            } else {
                alert('该目录下无上次加载记录');
            }
        } catch (err) {
            alert('读取记录失败: ' + err.message);
        }
    };

    const handleLoadLastFromScanItem = (item) => {
        if (!item.loader_record) return;
        const r = item.loader_record;
        onLoad(r.coco_json_path, r.image_dir || '', r.dataset_name || 'dataset');
    };

    const handleLoadSingleFromScanItem = (item) => {
        const name = item.loader_record?.dataset_name || datasetName;
        onLoad(item.coco_path, item.image_dir || '', name);
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
        onLoadMerged(selected, datasetName, rootPath);
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
                            <div className="load-scan-list-header">已发现 {scanItems.length} 个目录（含 _annotations.coco.json）。用「单文件加载」保存会写入该目录下的 COCO 文件，打包该目录即可把记录发给他人。</div>
                            {scanItems.map((item, i) => (
                                <div key={i} className="load-scan-item" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', flex: '1 1 auto', minWidth: 0 }}>
                                        <input type="checkbox" checked={selectedIndices.has(i)} onChange={() => toggleItem(i)} />
                                        <span className="load-scan-rel">{item.relative_path || '(根)'}</span>
                                        <span className="load-scan-path" title={item.coco_path}>{item.coco_path}</span>
                                    </label>
                                    <button type="button" className="load-btn load-btn-secondary" style={{ flexShrink: 0 }} onClick={() => handleLoadSingleFromScanItem(item)} disabled={loading} title="仅加载此目录的 COCO 文件，保存时写入该目录，便于打包发给他人">
                                        单文件加载
                                    </button>
                                    {item.loader_record && (
                                        <button type="button" className="load-btn load-btn-secondary" style={{ flexShrink: 0 }} onClick={() => handleLoadLastFromScanItem(item)} disabled={loading}>
                                            加载上次
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 方式二：单文件加载 */}
                <div className="load-section">
                    <h2 className="load-section-title">单文件加载</h2>
                    <p className="load-section-desc" style={{ marginBottom: '10px' }}>保存的记录会写在对应 COCO 文件目录下，下次打开可点「检测上次记录」或从扫描列表「加载上次」。</p>
                    <form onSubmit={handleSubmit}>
                        <div className="load-field">
                            <label className="load-label">{lp.cocoPathLabel}</label>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input className="load-input" type="text" value={cocoPath} onChange={(e) => setCocoPath(e.target.value)} placeholder={lp.cocoPathPlaceholder || '/path/to/annotations.json 或 COCO 所在目录'} style={{ flex: 1 }} />
                                <button type="button" className="load-btn load-btn-secondary" onClick={handleDetectLastRecord} title="从该路径（目录或文件）读取上次加载记录并填充">检测上次记录</button>
                            </div>
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

// ==================== 预测评估工具函数 ====================

// AUC-PR 方式计算 AP（与 COCO 评估脚本一致）
function computeAP(precisions, recalls) {
    if (precisions.length === 0) return 0;
    const mrec = [0, ...recalls, 1];
    const mpre = [0, ...precisions, 0];
    for (let i = mpre.length - 2; i >= 0; i--) mpre[i] = Math.max(mpre[i], mpre[i + 1]);
    let ap = 0;
    for (let i = 1; i < mrec.length; i++) {
        if (mrec[i] !== mrec[i - 1]) ap += (mrec[i] - mrec[i - 1]) * mpre[i];
    }
    return ap;
}

// 在指定 IoU 阈值下计算各类别 AP 及统计指标，同时返回 PR 曲线数据
function computeMapAtIou(images, model, iouThreshold, scoreThreshold) {
    const categories = new Set();
    images.forEach(img => (img.annotations || []).forEach(a => { if (a.category && a.bbox) categories.add(a.category); }));
    const perClass = {};
    const prCurves = {};
    categories.forEach(cat => {
        const gtByImg = {};
        images.forEach(img => {
            const gts = (img.annotations || []).filter(a => a.category === cat && a.bbox && a.bbox.length >= 4);
            if (gts.length > 0) gtByImg[img.image_id] = gts.map(g => ({ bbox: g.bbox, matched: false }));
        });
        const numGT = Object.values(gtByImg).reduce((s, gts) => s + gts.length, 0);
        const preds = [];
        images.forEach(img => {
            (img.pred_annotations || [])
                .filter(a => a._pred_source === model && a.category === cat && a.bbox && a.bbox.length >= 4)
                .filter(a => a.score == null || Number(a.score) >= scoreThreshold)
                .forEach(a => preds.push({ bbox: a.bbox, score: Number(a.score) || 0, image_id: img.image_id }));
        });
        preds.sort((a, b) => b.score - a.score);
        const tpArr = [], fpArr = [];
        preds.forEach(pred => {
            const gts = gtByImg[pred.image_id] || [];
            let bestIoU = iouThreshold - 1e-9, bestIdx = -1;
            gts.forEach((gt, i) => {
                if (gt.matched) return;
                const iou = computeIoU(pred.bbox, gt.bbox);
                if (iou > bestIoU) { bestIoU = iou; bestIdx = i; }
            });
            if (bestIdx >= 0) { gts[bestIdx].matched = true; tpArr.push(1); fpArr.push(0); }
            else { tpArr.push(0); fpArr.push(1); }
        });
        let cumTP = 0, cumFP = 0;
        const precs = [], recalls = [];
        tpArr.forEach((t, i) => {
            cumTP += t; cumFP += fpArr[i];
            recalls.push(numGT > 0 ? cumTP / numGT : 0);
            precs.push(cumTP + cumFP > 0 ? cumTP / (cumTP + cumFP) : 0);
        });
        const ap = computeAP(precs, recalls);
        const precision = (cumTP + cumFP) > 0 ? cumTP / (cumTP + cumFP) : 0;
        const recall = numGT > 0 ? cumTP / numGT : 0;
        const f1 = (precision + recall) > 0 ? 2 * precision * recall / (precision + recall) : 0;
        perClass[cat] = { ap, precision, recall, f1, tp: cumTP, fp: cumFP, fn: numGT - cumTP, numGT, numPred: preds.length };
        prCurves[cat] = { precs, recalls };
    });
    const cats = Object.keys(perClass);
    const mAP = cats.length > 0 ? cats.reduce((s, c) => s + perClass[c].ap, 0) / cats.length : 0;
    return { mAP, perClass, prCurves };
}

// 类别无关指标：忽略缺陷类型，只看有没有检出框与GT框重叠
function computeClassAgnosticAtIou(images, model, iouThreshold, scoreThreshold) {
    const gtByImg = {};
    images.forEach(img => {
        const gts = (img.annotations || []).filter(a => a.bbox && a.bbox.length >= 4);
        if (gts.length > 0) gtByImg[img.image_id] = gts.map(g => ({ bbox: g.bbox, matched: false }));
    });
    const numGT = Object.values(gtByImg).reduce((s, gts) => s + gts.length, 0);
    const preds = [];
    images.forEach(img => {
        (img.pred_annotations || [])
            .filter(a => a._pred_source === model && a.bbox && a.bbox.length >= 4)
            .filter(a => a.score == null || Number(a.score) >= scoreThreshold)
            .forEach(a => preds.push({ bbox: a.bbox, score: Number(a.score) || 0, image_id: img.image_id }));
    });
    preds.sort((a, b) => b.score - a.score);
    const tpArr = [], fpArr = [];
    preds.forEach(pred => {
        const gts = gtByImg[pred.image_id] || [];
        let bestIoU = iouThreshold - 1e-9, bestIdx = -1;
        gts.forEach((gt, i) => {
            if (gt.matched) return;
            const iou = computeIoU(pred.bbox, gt.bbox);
            if (iou > bestIoU) { bestIoU = iou; bestIdx = i; }
        });
        if (bestIdx >= 0) { gts[bestIdx].matched = true; tpArr.push(1); fpArr.push(0); }
        else { tpArr.push(0); fpArr.push(1); }
    });
    let cumTP = 0, cumFP = 0;
    const precs = [], recalls = [];
    tpArr.forEach((t, i) => {
        cumTP += t; cumFP += fpArr[i];
        recalls.push(numGT > 0 ? cumTP / numGT : 0);
        precs.push(cumTP + cumFP > 0 ? cumTP / (cumTP + cumFP) : 0);
    });
    const ap = computeAP(precs, recalls);
    const precision = (cumTP + cumFP) > 0 ? cumTP / (cumTP + cumFP) : 0;
    const recall = numGT > 0 ? cumTP / numGT : 0;
    const f1 = (precision + recall) > 0 ? 2 * precision * recall / (precision + recall) : 0;
    return { ap, precision, recall, f1, tp: cumTP, fp: cumFP, fn: numGT - cumTP, numGT, numPred: preds.length, prCurve: { precs, recalls } };
}

// 计算完整报告：mAP@50/75/50:95 + 类别无关 + PR 曲线数据
function computeFullMapReport(images, model, scoreThreshold) {
    const iouThresholds = [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95];
    const at50 = computeMapAtIou(images, model, 0.5, scoreThreshold);
    const at75 = computeMapAtIou(images, model, 0.75, scoreThreshold);
    const allIou = iouThresholds.map(iou => computeMapAtIou(images, model, iou, scoreThreshold));
    const mAP50_95 = allIou.reduce((s, r) => s + r.mAP, 0) / iouThresholds.length;
    const perClassAP75 = Object.fromEntries(Object.keys(at75.perClass).map(c => [c, at75.perClass[c].ap]));
    const perClassAP50_95 = {};
    Object.keys(at50.perClass).forEach(cat => {
        perClassAP50_95[cat] = allIou.reduce((s, r) => s + (r.perClass[cat]?.ap || 0), 0) / iouThresholds.length;
    });
    // 类别无关
    const agn50 = computeClassAgnosticAtIou(images, model, 0.5, scoreThreshold);
    const agn75 = computeClassAgnosticAtIou(images, model, 0.75, scoreThreshold);
    const allIouAgn = iouThresholds.map(iou => computeClassAgnosticAtIou(images, model, iou, scoreThreshold));
    const agnAP50_95 = allIouAgn.reduce((s, r) => s + r.ap, 0) / iouThresholds.length;
    return {
        mAP50: at50.mAP, mAP75: at75.mAP, mAP50_95,
        perClass: at50.perClass, perClassAP75, perClassAP50_95,
        prCurves: at50.prCurves,
        agnostic: { ...agn50, ap75: agn75.ap, ap50_95: agnAP50_95 },
    };
}

// PR 曲线画布
const PR_CURVE_COLORS = ['#52c41a','#1890ff','#faad14','#f5222d','#722ed1','#13c2c2','#fa8c16','#eb2f96','#a0d911','#36cfc9'];
function PRCurveCanvas({ prCurves, agnosticCurve }) {
    const containerRef = React.useRef(null);
    const canvasRef = React.useRef(null);

    React.useEffect(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;
        const W_total = container.clientWidth || 700;
        const H_total = 320;
        canvas.width = W_total;
        canvas.height = H_total;
        const ctx = canvas.getContext('2d');
        const padL = 46, padR = 18, padT = 18, padB = 36;
        const W = W_total - padL - padR;
        const H = H_total - padT - padB;

        ctx.fillStyle = '#111122';
        ctx.fillRect(0, 0, W_total, H_total);

        // 格线
        ctx.strokeStyle = '#1e1e3a';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 10; i++) {
            ctx.beginPath(); ctx.moveTo(padL + W * i / 10, padT); ctx.lineTo(padL + W * i / 10, padT + H); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(padL, padT + H * i / 10); ctx.lineTo(padL + W, padT + H * i / 10); ctx.stroke();
        }
        ctx.strokeStyle = '#334'; ctx.lineWidth = 1;
        ctx.strokeRect(padL, padT, W, H);

        // 坐标刻度
        ctx.font = '10px sans-serif'; ctx.fillStyle = '#556';
        for (let i = 0; i <= 5; i++) {
            ctx.textAlign = 'center';
            ctx.fillText((i / 5).toFixed(1), padL + W * i / 5, padT + H + 14);
            ctx.textAlign = 'right';
            ctx.fillText((1 - i / 5).toFixed(1), padL - 5, padT + H * i / 5 + 3);
        }
        ctx.fillStyle = '#778'; ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Recall →', padL + W / 2, H_total - 4);
        ctx.save(); ctx.translate(11, padT + H / 2); ctx.rotate(-Math.PI / 2);
        ctx.fillText('↑ Precision', 0, 0); ctx.restore();

        // 曲线数据：按类别 + 类别无关
        const sortedCats = Object.keys(prCurves).sort();
        const curves = [
            ...sortedCats.map((cat, i) => ({ label: cat, color: PR_CURVE_COLORS[i % PR_CURVE_COLORS.length], ap: 0, ...prCurves[cat] })),
            { label: '全部缺陷(类别无关)', color: '#ffffff', dash: [7, 3], ap: agnosticCurve.ap || 0, ...agnosticCurve.prCurve },
        ];

        curves.forEach(({ recalls, precs, color, dash }) => {
            if (!recalls || recalls.length < 1) return;
            ctx.strokeStyle = color;
            ctx.lineWidth = dash ? 2.5 : 1.8;
            ctx.setLineDash(dash || []);
            ctx.beginPath();
            ctx.moveTo(padL, padT + H); // 起始点 (0,0) 底部
            // 插入起点
            const pts = [[0, 1], ...recalls.map((r, i) => [r, precs[i]])];
            pts.forEach(([r, p]) => ctx.lineTo(padL + r * W, padT + (1 - p) * H));
            ctx.stroke();
            ctx.setLineDash([]);
        });

        // 图例（右上角）
        const legX = padL + W - 10, legStartY = padT + 8;
        curves.forEach(({ label, color, ap }, i) => {
            const ly = legStartY + i * 15;
            ctx.fillStyle = color; ctx.fillRect(legX - 120, ly - 4, 16, 2.5);
            ctx.fillStyle = color === '#ffffff' ? '#ddd' : color;
            ctx.font = '9.5px sans-serif'; ctx.textAlign = 'left';
            ctx.fillText(`${label}  AP=${(ap * 100).toFixed(1)}%`, legX - 100, ly);
        });
    }, [prCurves, agnosticCurve]);

    return (
        <div ref={containerRef} style={{ width: '100%' }}>
            <canvas ref={canvasRef} style={{ display: 'block', width: '100%', borderRadius: '6px' }} />
        </div>
    );
}

// ==================== mAP 报告弹窗 ====================
function MapReportModal({ images, model, scoreThresh, onClose }) {
    const [computing, setComputing] = React.useState(true);
    const [report, setReport] = React.useState(null);
    const [activeTab, setActiveTab] = React.useState('table'); // 'table' | 'agnostic' | 'pr'

    React.useEffect(() => {
        const t = setTimeout(() => {
            try { setReport(computeFullMapReport(images, model, scoreThresh)); }
            catch (e) { console.error(e); }
            setComputing(false);
        }, 30);
        return () => clearTimeout(t);
    }, []);

    const fmt = v => (v * 100).toFixed(1) + '%';
    const cs = (a = 'center') => ({ padding: '7px 10px', textAlign: a, whiteSpace: 'nowrap' });

    const copyTable = () => {
        if (!report) return;
        const cats = Object.keys(report.perClass).sort();
        const header = ['类别','GT','预测','TP','FP','FN','Precision','Recall','F1','AP@50','AP@75','AP@50:95'].join('\t');
        const rows = cats.map(cat => {
            const r = report.perClass[cat];
            return [cat, r.numGT, r.numPred, r.tp, r.fp, r.fn,
                fmt(r.precision), fmt(r.recall), fmt(r.f1),
                fmt(r.ap), fmt(report.perClassAP75[cat]||0), fmt(report.perClassAP50_95[cat]||0)].join('\t');
        });
        const a = report.agnostic;
        const agnRow = ['[类别无关]', a.numGT, a.numPred, a.tp, a.fp, a.fn,
            fmt(a.precision), fmt(a.recall), fmt(a.f1),
            fmt(a.ap), fmt(a.ap75||0), fmt(a.ap50_95||0)].join('\t');
        const overall = ['mAP','','','','','','','','', fmt(report.mAP50), fmt(report.mAP75), fmt(report.mAP50_95)].join('\t');
        navigator.clipboard.writeText([header, ...rows, agnRow, overall].join('\n'))
            .then(() => alert('已复制到剪贴板')).catch(() => {});
    };

    const TAB_STYLE = (key) => ({
        padding: '6px 16px', fontSize: '13px', cursor: 'pointer', border: 'none',
        background: activeTab === key ? '#2a3a5a' : 'transparent',
        color: activeTab === key ? '#7af' : '#888',
        borderBottom: activeTab === key ? '2px solid #4a7af0' : '2px solid transparent',
        fontWeight: activeTab === key ? 'bold' : 'normal',
    });

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 3000,
            background: 'rgba(0,0,0,0.72)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            overflowY: 'auto', padding: '24px 12px',
        }} onClick={e => e.target === e.currentTarget && onClose()}>
            <div style={{
                background: '#16162e',
                borderRadius: '12px',
                border: '1px solid #2d2d50',
                boxShadow: '0 24px 60px rgba(0,0,0,0.85)',
                maxWidth: '1000px', width: '100%',
                display: 'flex', flexDirection: 'column',
            }}>
                {/* 标题栏 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #2d2d50' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#ddd' }}>📊 检测指标报告 · <span style={{ color: '#7af' }}>{model}</span></span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button className="btn btn-sm btn-secondary" onClick={copyTable} disabled={!report}>📋 复制表格</button>
                        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#888', fontSize: '18px', cursor: 'pointer', lineHeight: 1 }}>✕</button>
                    </div>
                </div>

                <div style={{ padding: '16px 20px 0', overflow: 'hidden' }}>
                    {computing ? (
                        <div style={{ textAlign: 'center', padding: '60px', color: '#666', fontSize: '16px' }}>⏳ 计算中…</div>
                    ) : !report ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#f5222d' }}>计算失败，请检查数据</div>
                    ) : (
                        <>
                            {/* 指标卡片：按类 mAP + 类别无关 AP */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', marginBottom: '16px' }}>
                                {[
                                    { label: 'mAP@50', value: report.mAP50, color: '#52c41a', sub: '按类别' },
                                    { label: 'mAP@75', value: report.mAP75, color: '#1890ff', sub: '按类别' },
                                    { label: 'mAP@50:95', value: report.mAP50_95, color: '#722ed1', sub: 'COCO 标准' },
                                    { label: 'AP@50', value: report.agnostic.ap, color: '#fa8c16', sub: '类别无关' },
                                    { label: 'AP@75', value: report.agnostic.ap75, color: '#eb2f96', sub: '类别无关' },
                                    { label: 'AP@50:95', value: report.agnostic.ap50_95, color: '#13c2c2', sub: '类别无关' },
                                ].map(({ label, value, color, sub }) => (
                                    <div key={label} style={{ background: '#1a1a2e', borderRadius: '8px', padding: '12px 8px', textAlign: 'center', border: `1px solid ${color}44` }}>
                                        <div style={{ fontSize: '10px', color: '#666', marginBottom: '1px' }}>{sub}</div>
                                        <div style={{ fontSize: '22px', fontWeight: 'bold', color, lineHeight: 1.2 }}>{fmt(value)}</div>
                                        <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{label}</div>
                                    </div>
                                ))}
                            </div>

                            {/* 元信息 */}
                            <div style={{ fontSize: '12px', color: '#666', marginBottom: '12px', display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
                                <span>模型：<strong style={{ color: '#aaa' }}>{model}</strong></span>
                                <span>置信度阈值：<strong style={{ color: '#aaa' }}>{scoreThresh.toFixed(2)}</strong></span>
                                <span>图片数：<strong style={{ color: '#aaa' }}>{images.length}</strong></span>
                                <span>类别数：<strong style={{ color: '#aaa' }}>{Object.keys(report.perClass).length}</strong></span>
                                <span style={{ color: '#555' }}>AP = AUC-PR（单调包络）</span>
                            </div>

                            {/* 标签页切换 */}
                            <div style={{ display: 'flex', borderBottom: '1px solid #2d2d50', marginBottom: '0' }}>
                                {[['table','按类别指标'], ['agnostic','类别无关指标'], ['pr','PR 曲线']].map(([k, label]) => (
                                    <button key={k} style={TAB_STYLE(k)} onClick={() => setActiveTab(k)}>{label}</button>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* 标签页内容 */}
                {report && (
                    <div style={{ padding: '16px 20px', overflowY: 'auto', maxHeight: '55vh' }}>
                        {activeTab === 'table' && (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'fixed' }}>
                                    <colgroup>
                                        <col style={{ width: '80px' }} />
                                        {['GT','预测','TP','FP','FN','Precision','Recall','F1','AP@50','AP@75','AP@50:95'].map((_, i) => (
                                            <col key={i} style={{ width: i < 5 ? '52px' : i < 8 ? '72px' : '78px' }} />
                                        ))}
                                    </colgroup>
                                    <thead>
                                        <tr style={{ background: '#1e1e3a', position: 'sticky', top: 0, zIndex: 1 }}>
                                            {[['类别','left'],['GT','center'],['预测','center'],['TP','center'],['FP','center'],['FN','center'],['Precision','center'],['Recall','center'],['F1','center'],['AP@50','center'],['AP@75','center'],['AP@50:95','center']].map(([h, a]) => (
                                                <th key={h} style={{ ...cs(a), fontWeight: 'bold', color: '#bbb', background: '#1e1e3a', borderBottom: '2px solid #3d3d60', fontSize: '12px' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.keys(report.perClass).sort().map((cat, i) => {
                                            const r = report.perClass[cat];
                                            const catColor = PR_CURVE_COLORS[i % PR_CURVE_COLORS.length];
                                            return (
                                                <tr key={cat} style={{ background: i % 2 === 0 ? '#14142a' : '#18183a', borderBottom: '1px solid #252545' }}>
                                                    <td style={{ ...cs('left'), color: catColor, fontWeight: 'bold', fontSize: '12px' }}>{cat}</td>
                                                    <td style={{ ...cs(), color: '#aaa', fontSize: '12px' }}>{r.numGT}</td>
                                                    <td style={{ ...cs(), color: '#aaa', fontSize: '12px' }}>{r.numPred}</td>
                                                    <td style={{ ...cs(), color: '#52c41a', fontWeight: 'bold', fontSize: '12px' }}>{r.tp}</td>
                                                    <td style={{ ...cs(), color: '#f5222d', fontSize: '12px' }}>{r.fp}</td>
                                                    <td style={{ ...cs(), color: '#faad14', fontSize: '12px' }}>{r.fn}</td>
                                                    <td style={{ ...cs(), fontSize: '12px' }}>{fmt(r.precision)}</td>
                                                    <td style={{ ...cs(), fontSize: '12px' }}>{fmt(r.recall)}</td>
                                                    <td style={{ ...cs(), fontSize: '12px' }}>{fmt(r.f1)}</td>
                                                    <td style={{ ...cs(), color: '#52c41a', fontWeight: 'bold', fontSize: '12px' }}>{fmt(r.ap)}</td>
                                                    <td style={{ ...cs(), color: '#1890ff', fontSize: '12px' }}>{fmt(report.perClassAP75[cat]||0)}</td>
                                                    <td style={{ ...cs(), color: '#722ed1', fontSize: '12px' }}>{fmt(report.perClassAP50_95[cat]||0)}</td>
                                                </tr>
                                            );
                                        })}
                                        {/* mAP 汇总行 */}
                                        <tr style={{ background: '#1e1e3a', borderTop: '2px solid #3d3d60' }}>
                                            <td style={{ ...cs('left'), color: '#fff', fontWeight: 'bold', fontSize: '12px' }}>mAP</td>
                                            <td colSpan={8} style={{ borderBottom: 'none' }} />
                                            <td style={{ ...cs(), color: '#52c41a', fontWeight: 'bold', fontSize: '13px' }}>{fmt(report.mAP50)}</td>
                                            <td style={{ ...cs(), color: '#1890ff', fontWeight: 'bold', fontSize: '13px' }}>{fmt(report.mAP75)}</td>
                                            <td style={{ ...cs(), color: '#722ed1', fontWeight: 'bold', fontSize: '13px' }}>{fmt(report.mAP50_95)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {activeTab === 'agnostic' && (() => {
                            const a = report.agnostic;
                            return (
                                <div>
                                    <div style={{ fontSize: '13px', color: '#888', marginBottom: '16px', background: '#1a1a30', padding: '10px 14px', borderRadius: '6px' }}>
                                        <strong style={{ color: '#ccc' }}>类别无关指标</strong>：忽略缺陷类型，只要预测框与任意GT框 IoU 达到阈值，即视为检出。评估模型对缺陷的整体感知能力。
                                    </div>
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                            <thead>
                                                <tr style={{ background: '#1e1e3a', borderBottom: '2px solid #3d3d60' }}>
                                                    {['指标','GT总数','预测总数','TP','FP','FN','Precision','Recall','F1','AP@50','AP@75','AP@50:95'].map(h => (
                                                        <th key={h} style={{ ...cs(h==='指标'?'left':'center'), color: '#bbb', fontWeight: 'bold', fontSize: '12px' }}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr style={{ background: '#14142a', borderBottom: '1px solid #252545' }}>
                                                    <td style={{ ...cs('left'), color: '#fa8c16', fontWeight: 'bold' }}>缺陷检出</td>
                                                    <td style={{ ...cs(), color: '#aaa' }}>{a.numGT}</td>
                                                    <td style={{ ...cs(), color: '#aaa' }}>{a.numPred}</td>
                                                    <td style={{ ...cs(), color: '#52c41a', fontWeight: 'bold' }}>{a.tp}</td>
                                                    <td style={{ ...cs(), color: '#f5222d' }}>{a.fp}</td>
                                                    <td style={{ ...cs(), color: '#faad14' }}>{a.fn}</td>
                                                    <td style={{ ...cs() }}>{fmt(a.precision)}</td>
                                                    <td style={{ ...cs() }}>{fmt(a.recall)}</td>
                                                    <td style={{ ...cs() }}>{fmt(a.f1)}</td>
                                                    <td style={{ ...cs(), color: '#fa8c16', fontWeight: 'bold' }}>{fmt(a.ap)}</td>
                                                    <td style={{ ...cs(), color: '#eb2f96' }}>{fmt(a.ap75||0)}</td>
                                                    <td style={{ ...cs(), color: '#13c2c2' }}>{fmt(a.ap50_95||0)}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                    <div style={{ marginTop: '20px', fontSize: '13px', color: '#666', background: '#111128', borderRadius: '6px', padding: '12px 16px', lineHeight: '1.8' }}>
                                        <div><span style={{color:'#888'}}>漏检数 (FN)：</span><strong style={{color:'#faad14'}}>{a.fn}</strong> 个GT未被任何预测框覆盖</div>
                                        <div><span style={{color:'#888'}}>误检数 (FP)：</span><strong style={{color:'#f5222d'}}>{a.fp}</strong> 个预测框未与任何GT匹配</div>
                                        <div><span style={{color:'#888'}}>漏检率：</span><strong style={{color:'#faad14'}}>{a.numGT > 0 ? fmt(a.fn/a.numGT) : '—'}</strong></div>
                                        <div><span style={{color:'#888'}}>误检率：</span><strong style={{color:'#f5222d'}}>{a.numPred > 0 ? fmt(a.fp/a.numPred) : '—'}</strong></div>
                                    </div>
                                </div>
                            );
                        })()}

                        {activeTab === 'pr' && (
                            <div>
                                <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>PR 曲线基于 IoU@50 计算，曲线下面积即为 AP@50。</div>
                                <PRCurveCanvas prCurves={report.prCurves} agnosticCurve={report.agnostic} />
                            </div>
                        )}
                    </div>
                )}

                {/* 底部 */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 20px', borderTop: '1px solid #2d2d50' }}>
                    <button className="btn btn-secondary" onClick={onClose}>关闭</button>
                </div>
            </div>
        </div>
    );
}

function computeIoU(bbox1, bbox2) {
    const [x1, y1, w1, h1] = bbox1;
    const [x2, y2, w2, h2] = bbox2;
    const xi1 = Math.max(x1, x2), yi1 = Math.max(y1, y2);
    const xi2 = Math.min(x1 + w1, x2 + w2), yi2 = Math.min(y1 + h1, y2 + h2);
    const inter = Math.max(0, xi2 - xi1) * Math.max(0, yi2 - yi1);
    const union = w1 * h1 + w2 * h2 - inter;
    return union > 0 ? inter / union : 0;
}

// 返回 { hasFP, hasFN, tp, fp, fn }
// hasFP: 存在误检（预测框无法匹配任何GT框）
// hasFN: 存在漏检（GT框无法被任何预测框匹配）
function evalImagePred(image, model, iouThresh, scoreThresh) {
    const gtAnns = (image.annotations || []).filter(a => a.bbox && a.bbox.length >= 4);
    const predAnns = (image.pred_annotations || [])
        .filter(a => a._pred_source === model && a.bbox && a.bbox.length >= 4)
        .filter(a => a.score == null || Number(a.score) >= scoreThresh)
        .sort((a, b) => (b.score || 0) - (a.score || 0));

    const gtMatched = new Array(gtAnns.length).fill(false);
    let tp = 0, fp = 0;

    predAnns.forEach(pred => {
        let bestIdx = -1, bestIoU = iouThresh - 1e-9;
        gtAnns.forEach((gt, i) => {
            if (gtMatched[i]) return;
            const iou = computeIoU(pred.bbox, gt.bbox);
            if (iou > bestIoU) { bestIoU = iou; bestIdx = i; }
        });
        if (bestIdx >= 0) { gtMatched[bestIdx] = true; tp++; }
        else { fp++; }
    });

    const fn = gtAnns.length - tp;
    return {
        hasFP: fp > 0,
        hasFN: fn > 0,
        tp, fp, fn,
    };
}

// ==================== 预测评估设置弹窗 ====================
function PredEvalModal({ predModelNames, initModel, initIou, initScore, onApply, onClose }) {
    const [localModel, setLocalModel] = React.useState(initModel || (predModelNames.length === 1 ? predModelNames[0] : null));
    const [localIou, setLocalIou] = React.useState(initIou ?? 0.5);
    const [localScore, setLocalScore] = React.useState(initScore ?? 0.0);

    const handleIouSlider = e => setLocalIou(Number(Number(e.target.value).toFixed(2)));
    const handleScoreSlider = e => setLocalScore(Number(Number(e.target.value).toFixed(2)));
    const handleIouInput = e => { const v = parseFloat(e.target.value); if (!isNaN(v)) setLocalIou(Math.min(1, Math.max(0, v))); };
    const handleScoreInput = e => { const v = parseFloat(e.target.value); if (!isNaN(v)) setLocalScore(Math.min(1, Math.max(0, v))); };

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-dialog" style={{ maxWidth: '420px' }}>
                <div className="modal-header">
                    <span className="modal-title">🔬 预测评估设置</span>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="modal-body">
                    <div style={{ marginBottom: '18px' }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '13px', color: '#ccc' }}>选择预测模型（单选）</div>
                        {predModelNames.map(model => (
                            <label key={model} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', cursor: 'pointer', padding: '6px 10px', background: localModel === model ? '#2a3a5a' : '#1e1e38', borderRadius: '6px', border: localModel === model ? '1px solid #4a7af0' : '1px solid transparent' }}>
                                <input type="radio" name="pred_eval_model" value={model} checked={localModel === model} onChange={() => setLocalModel(model)} />
                                <span style={{ fontFamily: 'monospace', fontSize: '13px' }}>{model}</span>
                            </label>
                        ))}
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '13px', color: '#ccc', marginBottom: '6px' }}>
                            IoU 阈值：<strong style={{ color: '#7af' }}>{localIou.toFixed(2)}</strong>
                            <span style={{ fontSize: '11px', color: '#888', marginLeft: '8px' }}>（预测框与GT框的重叠度 ≥ 此值才算正确）</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input type="range" min="0" max="1" step="0.05" value={localIou} onChange={handleIouSlider} style={{ flex: 1 }} />
                            <input type="number" min="0" max="1" step="0.01" value={localIou} onChange={handleIouInput} className="filter-input" style={{ width: '70px' }} />
                        </div>
                    </div>

                    <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontSize: '13px', color: '#ccc', marginBottom: '6px' }}>
                            置信度阈值：<strong style={{ color: '#7af' }}>{localScore.toFixed(2)}</strong>
                            <span style={{ fontSize: '11px', color: '#888', marginLeft: '8px' }}>（低于此值的预测框不参与评估）</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input type="range" min="0" max="1" step="0.05" value={localScore} onChange={handleScoreSlider} style={{ flex: 1 }} />
                            <input type="number" min="0" max="1" step="0.01" value={localScore} onChange={handleScoreInput} className="filter-input" style={{ width: '70px' }} />
                        </div>
                    </div>

                    <div style={{ fontSize: '12px', color: '#888', marginTop: '14px', background: '#181830', padding: '10px', borderRadius: '6px', lineHeight: '1.7' }}>
                        <div>✓ <strong style={{color:'#52c41a'}}>预测正确</strong>：无误检且无漏检（TP全匹配）</div>
                        <div>⚡ <strong style={{color:'#faad14'}}>误检</strong>：存在未命中GT的预测框（FP &gt; 0）</div>
                        <div>◎ <strong style={{color:'#f5222d'}}>漏检</strong>：存在未被预测框命中的GT框（FN &gt; 0）</div>
                        <div style={{color:'#666', fontSize:'11px', marginTop:'4px'}}>注：一张图可同时属于误检和漏检</div>
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>取消</button>
                    <button
                        className="btn btn-primary"
                        disabled={!localModel}
                        onClick={() => localModel && onApply({ model: localModel, iouThresh: localIou, scoreThresh: localScore })}
                    >
                        应用评估
                    </button>
                </div>
            </div>
        </div>
    );
}

// ==================== 图片宫格页面 ====================
function GalleryPage({ datasetData, images, categories, imageClassifications, imageNotes, imageCategories, imageCategoryColors, onUpdateCategory, onUpdateCategories, onUpdateNote, onBatchUpdateCategory, onRollback, metaFilterOptions, onApplyMetaFilters, autoSaveStatus }) {
    const config = useConfig();
    const gallery = config.gallery || DEFAULT_CONFIG.gallery;
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(gallery.defaultPageSize ?? 20);
    const [selectedLabelCategory, setSelectedLabelCategory] = useState('all'); // 标注类别筛选
    const [selectedImageCategory, setSelectedImageCategory] = useState('all'); // 图片分类筛选
    const [selectedDirectory, setSelectedDirectory] = useState('all'); // 目录筛选（多目录合并时）
    const [searchText, setSearchText] = useState('');
    // 图片元数据筛选（c_time / product_id / position），仅当 COCO 含对应字段时显示
    const [metaCtimeStart, setMetaCtimeStart] = useState('');
    const [metaCtimeEnd, setMetaCtimeEnd] = useState('');
    const [metaProductIdQuery, setMetaProductIdQuery] = useState('');
    const [metaPosition, setMetaPosition] = useState('');
    const [metaFilterApplying, setMetaFilterApplying] = useState(false);
    const [scoreMin, setScoreMin] = useState('');
    const [scoreMax, setScoreMax] = useState('');
    const [selectedImages, setSelectedImages] = useState(new Set());
    const [showExportModal, setShowExportModal] = useState(false);
    const [showVersionModal, setShowVersionModal] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [saving, setSaving] = useState(false);
    // 大图查看器状态：直接存在 GalleryPage，filteredImages 可直接传入
    const [viewerOpen, setViewerOpen] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    // 预测评估状态
    const [predEvalOpen, setPredEvalOpen] = useState(false);
    const [predEvalEnabled, setPredEvalEnabled] = useState(false);
    const [predEvalModel, setPredEvalModel] = useState(null);
    const [predEvalIouThresh, setPredEvalIouThresh] = useState(0.5);
    const [predEvalScoreThresh, setPredEvalScoreThresh] = useState(0.0);
    const [predEvalFilter, setPredEvalFilter] = useState(null); // null | 'correct' | 'fp' | 'fn'
    const [showMapModal, setShowMapModal] = useState(false);
    // 控制哪些预测模型可见（null 表示全显示，Set 表示白名单）
    const [visiblePredModels, setVisiblePredModels] = useState(null);

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

    // 是否存在置信度分数字段（决定是否显示分数筛选器）
    const hasScoreData = React.useMemo(() =>
        images.some(img => img.annotations.some(a => typeof a.score === 'number' && !isNaN(a.score)))
    , [images]);

    // 预测模型列表（只有同时存在GT和预测时才有）
    const predModelNames = React.useMemo(() => {
        const models = new Set();
        images.forEach(img => (img.pred_annotations || []).forEach(a => { if (a._pred_source) models.add(a._pred_source); }));
        return [...models].sort();
    }, [images]);
    const hasPredData = predModelNames.length > 0 && images.some(img => (img.annotations || []).length > 0);

    // 数据集切换时重置可见模型（全部默认可见）
    useEffect(() => {
        setVisiblePredModels(new Set(predModelNames));
    }, [predModelNames.join(',')]); // eslint-disable-line

    // 预测评估结果（各图片 image_id → { hasFP, hasFN, tp, fp, fn }）
    const imageEvalResults = React.useMemo(() => {
        if (!predEvalEnabled || !predEvalModel) return {};
        const res = {};
        images.forEach(img => { res[img.image_id] = evalImagePred(img, predEvalModel, predEvalIouThresh, predEvalScoreThresh); });
        return res;
    }, [images, predEvalEnabled, predEvalModel, predEvalIouThresh, predEvalScoreThresh]);

    // 各类别计数（图片可同时属于误检和漏检）
    const evalStats = React.useMemo(() => {
        if (!predEvalEnabled) return null;
        const c = { correct: 0, fp: 0, fn: 0 };
        Object.values(imageEvalResults).forEach(r => {
            if (!r.hasFP && !r.hasFN) c.correct++;
            if (r.hasFP) c.fp++;
            if (r.hasFN) c.fn++;
        });
        return c;
    }, [imageEvalResults, predEvalEnabled]);

    // 筛选图片（与宫格一致；大图查看器用同一份列表翻页，filteredImages 直接传入 ImageViewer）
    const filteredImages = React.useMemo(() => images.filter(img => {
        if (selectedDirectory !== 'all' && (img.source_path != null ? img.source_path : '') !== selectedDirectory) return false;
        if (selectedLabelCategory !== 'all' && !img.annotations.some(a => a.category === selectedLabelCategory)) return false;
        if (selectedImageCategory !== 'all') {
            const arr = imageClassifications[img.image_id];
            const imgCats = Array.isArray(arr) && arr.length ? arr : [defaultImageCat];
            if (!imgCats.includes(selectedImageCategory)) return false;
        }
        if (searchText && !img.file_name.toLowerCase().includes(searchText.toLowerCase())) return false;
        // 置信度范围筛选：只要图片中任意框的分数在范围内即通过
        if (scoreMin !== '' || scoreMax !== '') {
            const sMin = scoreMin !== '' ? parseFloat(scoreMin) : -Infinity;
            const sMax = scoreMax !== '' ? parseFloat(scoreMax) : Infinity;
            const hit = img.annotations.some(a => {
                const s = typeof a.score === 'number' ? a.score : parseFloat(a.score);
                return !isNaN(s) && s >= sMin && s <= sMax;
            });
            if (!hit) return false;
        }
        // 预测评估筛选
        if (predEvalEnabled && predEvalFilter !== null) {
            const r = imageEvalResults[img.image_id];
            if (!r) return false;
            if (predEvalFilter === 'correct' && (r.hasFP || r.hasFN)) return false;
            if (predEvalFilter === 'fp' && !r.hasFP) return false;
            if (predEvalFilter === 'fn' && !r.hasFN) return false;
        }
        return true;
    }), [images, selectedDirectory, selectedLabelCategory, selectedImageCategory, searchText, imageClassifications, defaultImageCat, scoreMin, scoreMax, predEvalEnabled, predEvalFilter, imageEvalResults]);

    // 筛选条件变化时：当前大图若不在新列表里，跳到第一张；列表为空则关闭
    const selectedImageId = selectedImage && selectedImage.image_id;
    useEffect(() => {
        if (!viewerOpen || selectedImageId == null) return;
        if (filteredImages.length === 0) { setViewerOpen(false); return; }
        const stillIn = filteredImages.some(i => i.image_id === selectedImageId);
        if (!stillIn) setSelectedImage(filteredImages[0]);
    }, [viewerOpen, filteredImages, selectedImageId]);

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

    const hasMetaFilterCapability = metaFilterOptions && (metaFilterOptions.has_c_time || metaFilterOptions.has_product_id || metaFilterOptions.has_position);
    const handleApplyMetaFilters = async () => {
        if (!onApplyMetaFilters) return;
        setMetaFilterApplying(true);
        try {
            await onApplyMetaFilters({
                c_time_start: metaCtimeStart.trim() || undefined,
                c_time_end: metaCtimeEnd.trim() || undefined,
                product_id_query: metaProductIdQuery.trim() || undefined,
                position: (metaPosition && metaPosition !== 'all') ? metaPosition : undefined
            });
            setCurrentPage(1);
        } finally {
            setMetaFilterApplying(false);
        }
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
                const pathMsg = data.saved_path ? `\n写入路径: ${data.saved_path}` : '';
                alert('保存成功！已覆盖原 COCO 文件，存档已写入对应目录 .coco_visualizer/。' + pathMsg);
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
                {hasMetaFilterCapability && (
                    <div className="meta-filter-bar" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', padding: '8px 12px', background: '#f5f5f5', borderRadius: '6px', marginBottom: '10px' }}>
                        <span style={{ fontWeight: 600, marginRight: '4px' }}>元数据筛选:</span>
                        {metaFilterOptions.has_c_time && (
                            <>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ whiteSpace: 'nowrap' }}>时间起</span>
                                    <input type="datetime-local" value={metaCtimeStart} onChange={(e) => setMetaCtimeStart(e.target.value)} style={{ padding: '4px 8px' }} />
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ whiteSpace: 'nowrap' }}>时间止</span>
                                    <input type="datetime-local" value={metaCtimeEnd} onChange={(e) => setMetaCtimeEnd(e.target.value)} style={{ padding: '4px 8px' }} />
                                </label>
                            </>
                        )}
                        {metaFilterOptions.has_product_id && (
                            <>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ whiteSpace: 'nowrap' }}>SN/产品ID</span>
                                    <input type="text" placeholder="输入模糊查询" value={metaProductIdQuery} onChange={(e) => setMetaProductIdQuery(e.target.value)} style={{ padding: '4px 8px', minWidth: '140px' }} />
                                </label>
                                {metaFilterOptions.product_ids && metaFilterOptions.product_ids.length > 0 && (
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <span style={{ whiteSpace: 'nowrap' }}>或选择</span>
                                        <select
                                            value={metaProductIdQuery}
                                            onChange={(e) => setMetaProductIdQuery(e.target.value === '' ? '' : e.target.value)}
                                            style={{ padding: '4px 8px', minWidth: '160px', maxWidth: '220px' }}
                                            title="从已有 SN 中选择"
                                        >
                                            <option value="">全部</option>
                                            {metaFilterOptions.product_ids.map(pid => (
                                                <option key={pid} value={pid} title={pid}>{pid.length > 24 ? pid.slice(0, 21) + '...' : pid}</option>
                                            ))}
                                        </select>
                                    </label>
                                )}
                            </>
                        )}
                        {metaFilterOptions.has_position && metaFilterOptions.positions && metaFilterOptions.positions.length > 0 && (
                            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ whiteSpace: 'nowrap' }}>朝向</span>
                                <select value={metaPosition} onChange={(e) => setMetaPosition(e.target.value)} style={{ padding: '4px 8px' }}>
                                    <option value="all">全部</option>
                                    {metaFilterOptions.positions.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </label>
                        )}
                        <button type="button" className="btn btn-primary btn-sm" onClick={handleApplyMetaFilters} disabled={metaFilterApplying}>
                            {metaFilterApplying ? '筛选中...' : '应用筛选'}
                        </button>
                    </div>
                )}
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
                        {/* 预测模型可见性切换（有预测数据时显示） */}
                        {predModelNames.length > 0 && visiblePredModels && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                                <span style={{ fontSize: '12px', color: '#888' }}>预测模型:</span>
                                {predModelNames.map(model => {
                                    const isOn = visiblePredModels.has(model);
                                    return (
                                        <button
                                            key={model}
                                            className="btn btn-sm"
                                            title={isOn ? `隐藏 ${model} 的预测结果` : `显示 ${model} 的预测结果`}
                                            style={{
                                                fontSize: '11px', padding: '2px 8px',
                                                background: isOn ? '#2a4a7a' : 'transparent',
                                                color: isOn ? '#7af' : '#555',
                                                border: `1px solid ${isOn ? '#4a7af0' : '#444'}`,
                                                fontWeight: isOn ? 'bold' : 'normal',
                                                maxWidth: '120px',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}
                                            onClick={() => {
                                                setVisiblePredModels(prev => {
                                                    const next = new Set(prev);
                                                    if (next.has(model)) next.delete(model);
                                                    else next.add(model);
                                                    return next;
                                                });
                                            }}
                                        >
                                            {isOn ? '◉' : '○'} {model}
                                        </button>
                                    );
                                })}
                            </span>
                        )}
                        {/* 预测评估入口（仅同时有GT和预测时显示） */}
                        {hasPredData && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                                <button
                                    className={`btn btn-sm ${predEvalEnabled ? 'btn-primary' : 'btn-secondary'}`}
                                    style={{ fontSize: '12px', padding: '3px 8px' }}
                                    title={predEvalEnabled ? `当前模型: ${predEvalModel}，点击重新配置` : '开启预测评估筛选'}
                                    onClick={() => setPredEvalOpen(true)}
                                >
                                    🔬 {predEvalEnabled ? predEvalModel : '预测评估'}
                                </button>
                                {predEvalEnabled && evalStats && (
                                    <>
                                        {[
                                            { key: 'correct', label: '✓ 预测正确', color: '#52c41a' },
                                            { key: 'fp', label: '⚡ 误检', color: '#faad14' },
                                            { key: 'fn', label: '◎ 漏检', color: '#f5222d' },
                                        ].map(({ key, label, color }) => (
                                            <button
                                                key={key}
                                                className="btn btn-sm"
                                                style={{
                                                    fontSize: '12px', padding: '3px 8px',
                                                    background: predEvalFilter === key ? color : 'transparent',
                                                    color: predEvalFilter === key ? '#fff' : color,
                                                    border: `1px solid ${color}`,
                                                    fontWeight: predEvalFilter === key ? 'bold' : 'normal',
                                                }}
                                                onClick={() => { setPredEvalFilter(predEvalFilter === key ? null : key); setCurrentPage(1); }}
                                            >
                                                {label} <span style={{ opacity: 0.8 }}>({evalStats[key]})</span>
                                            </button>
                                        ))}
                                        <button
                                            className="btn btn-sm"
                                            style={{ fontSize: '12px', padding: '3px 8px', background: '#1a2a4a', color: '#7af', border: '1px solid #4a7af0' }}
                                            title="计算 mAP 等检测指标"
                                            onClick={() => setShowMapModal(true)}
                                        >📊 指标</button>
                                        <button
                                            className="btn btn-sm btn-secondary"
                                            style={{ fontSize: '12px', padding: '3px 6px' }}
                                            title="关闭预测评估"
                                            onClick={() => { setPredEvalEnabled(false); setPredEvalFilter(null); setPredEvalModel(null); setCurrentPage(1); }}
                                        >✕</button>
                                    </>
                                )}
                            </span>
                        )}
                        {hasScoreData && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                                <span style={{ fontSize: '12px', color: '#555' }}>置信度</span>
                                <input
                                    type="number" min="0" max="1" step="0.01"
                                    className="filter-input"
                                    style={{ width: '62px', padding: '4px 6px' }}
                                    placeholder="下限"
                                    value={scoreMin}
                                    onChange={e => { setScoreMin(e.target.value); setCurrentPage(1); }}
                                />
                                <span style={{ fontSize: '12px', color: '#888' }}>~</span>
                                <input
                                    type="number" min="0" max="1" step="0.01"
                                    className="filter-input"
                                    style={{ width: '62px', padding: '4px 6px' }}
                                    placeholder="上限"
                                    value={scoreMax}
                                    onChange={e => { setScoreMax(e.target.value); setCurrentPage(1); }}
                                />
                                {(scoreMin !== '' || scoreMax !== '') && (
                                    <button
                                        className="btn btn-sm"
                                        style={{ padding: '2px 6px', fontSize: '11px', background: '#f0f0f0', color: '#666' }}
                                        onClick={() => { setScoreMin(''); setScoreMax(''); setCurrentPage(1); }}
                                        title="清除置信度筛选"
                                    >✕</button>
                                )}
                            </span>
                        )}
                        <input className="filter-input" placeholder="搜索文件名..." value={searchText} onChange={(e) => { setSearchText(e.target.value); setCurrentPage(1); }} />
                        {autoSaveStatus === 'pending' && (
                            <span style={{ fontSize: '12px', color: '#aaa', whiteSpace: 'nowrap' }}>⏳ 备份中…</span>
                        )}
                        {autoSaveStatus === 'saved' && (
                            <span style={{ fontSize: '12px', color: '#52c41a', whiteSpace: 'nowrap' }}>✓ 已备份</span>
                        )}
                        {autoSaveStatus === 'error' && (
                            <span style={{ fontSize: '12px', color: '#f5222d', whiteSpace: 'nowrap' }}>⚠ 备份失败</span>
                        )}
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
                                    onClick={() => { setSelectedImage(img); setViewerOpen(true); }}
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

            {showMapModal && predEvalModel && (
                <MapReportModal
                    images={images}
                    model={predEvalModel}
                    scoreThresh={predEvalScoreThresh}
                    onClose={() => setShowMapModal(false)}
                />
            )}

            {predEvalOpen && (
                <PredEvalModal
                    predModelNames={predModelNames}
                    initModel={predEvalModel}
                    initIou={predEvalIouThresh}
                    initScore={predEvalScoreThresh}
                    onApply={({ model, iouThresh, scoreThresh }) => {
                        setPredEvalModel(model);
                        setPredEvalIouThresh(iouThresh);
                        setPredEvalScoreThresh(scoreThresh);
                        setPredEvalEnabled(true);
                        setPredEvalFilter(null);
                        setCurrentPage(1);
                        setPredEvalOpen(false);
                    }}
                    onClose={() => setPredEvalOpen(false)}
                />
            )}

            {viewerOpen && selectedImage && (
                <ImageViewer
                    image={selectedImage}
                    images={filteredImages}
                    datasetId={datasetData.dataset_id}
                    categories={categories}
                    imageClassifications={imageClassifications}
                    imageNotes={imageNotes}
                    imageCategories={imageCategories}
                    visiblePredModels={visiblePredModels}
                    onClose={() => setViewerOpen(false)}
                    onNavigate={(img) => setSelectedImage(img)}
                    onUpdateCategory={onUpdateCategory}
                    onUpdateCategories={onUpdateCategories}
                    onUpdateNote={onUpdateNote}
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
    const imageCategories = config.imageCategories || DEFAULT_CONFIG.imageCategories || [];
    const imageCategoryColors = config.imageCategoryColors || DEFAULT_CONFIG.imageCategoryColors || {};
    const colorPalette = config.colorPalette || DEFAULT_CONFIG.colorPalette || ['#888'];

    const updateViewer = (key, value) => {
        setSettings(prev => ({ ...prev, viewer: { ...(prev.viewer || {}), [key]: value } }));
    };

    const updateCategoryName = (index, newName) => {
        if (index === 0) return; // 首项「未分类」不可改
        const name = (newName || '').trim();
        if (!name || name === imageCategories[index]) return; // 空值或未变则不更新
        setSettings(prev => {
            const cats = [...(prev.imageCategories ?? imageCategories)];
            const cols = { ...(prev.imageCategoryColors ?? imageCategoryColors) };
            const oldName = cats[index];
            cats[index] = name;
            cols[name] = cols[oldName] != null ? cols[oldName] : '#888';
            if (oldName !== name) delete cols[oldName];
            return { ...prev, imageCategories: cats, imageCategoryColors: cols };
        });
    };

    const updateCategoryColor = (index, color) => {
        const name = imageCategories[index];
        if (!name) return;
        setSettings(prev => ({
            ...prev,
            imageCategoryColors: { ...(prev.imageCategoryColors ?? imageCategoryColors), [name]: color }
        }));
    };

    const addCategory = () => {
        let name = '新分类';
        const existing = imageCategories;
        if (existing.includes(name)) {
            let n = 1;
            while (existing.includes(name + ' ' + n)) n++;
            name = name + ' ' + n;
        }
        const newColor = colorPalette[existing.length % colorPalette.length];
        setSettings(prev => ({
            ...prev,
            imageCategories: [...(prev.imageCategories ?? imageCategories), name],
            imageCategoryColors: { ...(prev.imageCategoryColors ?? imageCategoryColors), [name]: newColor }
        }));
    };

    const removeCategory = (index) => {
        if (index === 0 || imageCategories.length <= 1) return; // 首项「未分类」不可删
        setSettings(prev => {
            const cats = [...(prev.imageCategories ?? imageCategories)];
            const cols = { ...(prev.imageCategoryColors ?? imageCategoryColors) };
            const removed = cats[index];
            cats.splice(index, 1);
            delete cols[removed];
            return { ...prev, imageCategories: cats, imageCategoryColors: cols };
        });
    };

    const resetCategoriesToDefault = () => {
        if (!confirm('确定恢复为默认图片分类列表？')) return;
        setSettings(prev => {
            const p = { ...prev };
            delete p.imageCategories;
            delete p.imageCategoryColors;
            return p;
        });
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
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
                    <div className="form-group" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #eee' }}>
                        <label className="form-label">{st.imageCategoriesLabel || '图片分类'}</label>
                        <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>{st.imageCategoriesHint || '用于标注图片级分类，可增删改名称与颜色。'}</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {imageCategories.map((name, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {i === 0 ? (
                                        <span className="form-input" style={{ flex: 1, minWidth: 0, background: '#f0f0f0', color: '#666', cursor: 'not-allowed' }} title="固定，不可修改">未分类</span>
                                    ) : (
                                        <input
                                            key={name}
                                            type="text"
                                            className="form-input"
                                            defaultValue={name}
                                            onBlur={(e) => updateCategoryName(i, e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                            placeholder={st.categoryNamePlaceholder || '分类名称'}
                                            style={{ flex: 1, minWidth: 0 }}
                                        />
                                    )}
                                    <input
                                        type="color"
                                        value={imageCategoryColors[name] || '#888'}
                                        onChange={(e) => updateCategoryColor(i, e.target.value)}
                                        style={{ width: 36, height: 32, padding: 2, cursor: i === 0 ? 'default' : 'pointer', border: '1px solid #ccc', borderRadius: '4px' }}
                                        title="颜色"
                                    />
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => removeCategory(i)}
                                        disabled={i === 0 || imageCategories.length <= 1}
                                        style={{ padding: '6px 10px' }}
                                        title={i === 0 ? '未分类不可删除' : (imageCategories.length <= 1 ? '至少保留一个分类' : '删除')}
                                    >删除</button>
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                            <button type="button" className="btn btn-secondary" onClick={addCategory}>
                                {st.addCategoryButton || '添加分类'}
                            </button>
                            <button type="button" className="btn btn-secondary" onClick={resetCategoriesToDefault}>
                                {st.resetCategoriesButton || '恢复默认'}
                            </button>
                        </div>
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
                    <p style={{marginBottom: '8px', color: '#666', fontSize: '13px'}}>
                        {vm.description}
                    </p>
                    {vm.descriptionHint && (
                        <p style={{marginBottom: '12px', color: '#888', fontSize: '12px'}}>
                            {vm.descriptionHint}
                        </p>
                    )}
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

    const loadJSZip = () => {
        return new Promise((resolve, reject) => {
            if (typeof window.JSZip !== 'undefined') {
                resolve(window.JSZip);
                return;
            }
            const script = document.createElement('script');
            script.src = '/static/vendor/jszip.min.js';
            script.async = false;
            script.onload = () => resolve(window.JSZip);
            script.onerror = () => reject(new Error('jszip.min.js 加载失败'));
            document.head.appendChild(script);
        });
    };

    const handleExport = async () => {
        let JSZipLib = typeof window.JSZip !== 'undefined' ? window.JSZip : null;
        if (!JSZipLib) {
            setExportProgress('正在加载导出组件...');
            try {
                JSZipLib = await loadJSZip();
            } catch (e) {
                setExportProgress('');
                alert('导出组件加载失败。请运行 python3 packaging/fetch_vendor_js.py 将 jszip.min.js 下载到 static/vendor/ 目录，或检查网络与控制台报错。');
                return;
            }
            setExportProgress('');
        }
        const JSZip = JSZipLib;
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
                    images: catImages.map(img => {
                        // 解构出前端专用字段，其余全部保留
                        const { annotations: _a, num_annotations: _n, image_id, image_categories: _ic, ...imgRest } = img;
                        return {
                            ...imgRest,
                            id: image_id,
                            file_name: (imgRest.file_name || '').split('/').pop() || imgRest.file_name,
                            image_category: cat,
                            image_categories: imageClassifications[image_id] || [cat],
                            note: imageNotes[image_id] || imgRest.note || '',
                        };
                    }),
                    annotations: [],
                    categories: datasetData.categories.map((c, idx) => ({ id: idx + 1, name: c }))
                };

                let annId = 1;
                catImages.forEach(img => {
                    img.annotations.forEach(ann => {
                        const catIdx = datasetData.categories.indexOf(ann.category);
                        // 解构出需要重映射或前端专用的字段，其余（score、iscrowd 等）全部原样保留
                        const { category: _c, has_segmentation: _hs, id: _id, image_id: _iid, category_id: _cid, ...annRest } = ann;
                        cocoData.annotations.push({
                            ...annRest,
                            id: annId++,
                            image_id: img.image_id,
                            category_id: catIdx >= 0 ? catIdx + 1 : 1,
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
function ImageViewer({ image, images, datasetId, categories, imageClassifications, imageNotes, imageCategories, visiblePredModels, onClose, onNavigate, onUpdateCategory, onUpdateCategories, onUpdateNote }) {
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
    const [hiddenPredAnns, setHiddenPredAnns] = useState(new Set());
    const [hoveredPredAnnIdx, setHoveredPredAnnIdx] = useState(null);
    const lineWidthOpts = viewer.lineWidthOptions || [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
    const [lineWidth, setLineWidth] = useState(() => {
        const d = viewer.lineWidthDefault;
        return (typeof d === 'number' && lineWidthOpts.includes(d)) ? d : (lineWidthOpts[4] ?? 0.5);
    });
    const [currentImage, setCurrentImage] = useState(image);
    const [noteInput, setNoteInput] = useState('');
    const noteInputRef = useRef(null);

    // 父级因筛选变化等原因更新当前图时，与内部状态同步
    useEffect(() => {
        setCurrentImage(image);
        setHiddenAnns(new Set());
        setHiddenPredAnns(new Set());
        setHoveredPredAnnIdx(null);
    }, [image.image_id]);

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

        // 绘制预测标注（虚线区分，其余交互与 GT 完全一致）
        const PRED_DASH_PATTERNS = [[8,4],[4,4],[2,4],[10,4,2,4],[14,4]];
        const predAnns = currentImage.pred_annotations || [];
        const predModels = [...new Set(predAnns.map(a => a._pred_source))];
        predAnns.forEach((ann, idx) => {
            if (!ann.bbox || ann.bbox.length < 4) return;
            if (hiddenPredAnns.has(idx)) return;
            // 全局模型可见性过滤
            if (visiblePredModels && !visiblePredModels.has(ann._pred_source)) return;
            const [x, y, bw, bh] = ann.bbox;
            const rx = x * sx, ry = y * sy, rw = bw * sx, rh = bh * sy;
            const isHovered = hoveredPredAnnIdx === idx;
            const modelIdx = predModels.indexOf(ann._pred_source);
            const dash = PRED_DASH_PATTERNS[modelIdx % PRED_DASH_PATTERNS.length];
            const color = getCategoryColor(palette, ann.category);
            ctx.strokeStyle = color;
            ctx.lineWidth = isHovered ? Math.max(lineWidth + 0.2, 0.3) : lineWidth;
            ctx.setLineDash(dash);
            ctx.strokeRect(rx, ry, rw, rh);
            ctx.setLineDash([]);
            if (isHovered) {
                const area = bw * bh;
                const lines = [
                    `[预测] ${ann._pred_source}`,
                    ann.category,
                    ann.score !== undefined && ann.score !== null
                        ? `置信度: ${(Number(ann.score) * 100).toFixed(1)}%`
                        : null,
                    `[${Math.round(x)},${Math.round(y)},${Math.round(bw)}×${Math.round(bh)}]`,
                    `面积: ${area.toLocaleString()}`
                ].filter(Boolean);
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
                ctx.strokeStyle = color;
                ctx.lineWidth = 1;
                ctx.setLineDash(dash);
                ctx.strokeRect(tx, ty, boxW, boxH);
                ctx.setLineDash([]);
                ctx.fillStyle = '#fff';
                lines.forEach((line, i) => {
                    ctx.fillText(line, tx + pad, ty + pad + (i + 1) * lineH - 2);
                });
            }
        });
    }, [currentImage, zoom, hiddenAnns, hoveredAnnIdx, lineWidth, palette, hiddenPredAnns, hoveredPredAnnIdx, visiblePredModels]);

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

    useEffect(() => { drawAnnotations(); }, [zoom, hiddenAnns, hoveredAnnIdx, hiddenPredAnns, hoveredPredAnnIdx, lineWidth, drawAnnotations]);

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
    // images 必须参与依赖：否则筛选后列表变短但 imageIdx/当前图 id 未变时，键盘仍沿用旧的「全量」images 闭包
    }, [imageIdx, currentImage.image_id, noteInput, currentNote, catList, currentCategories, onUpdateCategories, onUpdateCategory, images]);

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
                        {currentCategory === (catList[0] || '未分类') ? (
                            <div style={{ fontSize: '12px', color: '#888', marginBottom: '10px' }}>请先选择主分类后再设置多选</div>
                        ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                                {catList.filter(c => c !== currentCategory && c !== (catList[0] || '未分类')).map(cat => (
                                    <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={currentCategories.includes(cat)} onChange={() => toggleCategory(cat)} />
                                        <span style={{ background: (config.imageCategoryColors || {})[cat] || '#666', padding: '2px 6px', borderRadius: '4px', color: '#fff' }}>{cat}</span>
                                    </label>
                                ))}
                            </div>
                        )}
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

                    {/* 预测标注列表（交互与 GT 完全一致，按模型分组） */}
                    {(() => {
                        const allPredAnns = currentImage.pred_annotations || [];
                        if (allPredAnns.length === 0) return null;
                        const PRED_DASH_DESCS = ['— — —', '-- --', '· · ·', '—·—·', '——— '];
                        const allPredModels = [...new Set(allPredAnns.map(a => a._pred_source))];
                        // 保留全部模型的原始索引，但在渲染时区分可见/隐藏
                        const predAnns = allPredAnns;
                        const predModels = allPredModels;
                        const togglePredAnn = (globalIdx) => {
                            setHiddenPredAnns(prev => {
                                const next = new Set(prev);
                                if (next.has(globalIdx)) next.delete(globalIdx); else next.add(globalIdx);
                                return next;
                            });
                        };
                        const toggleModelAll = (model) => {
                            const idxs = predAnns.map((a, i) => a._pred_source === model ? i : -1).filter(i => i >= 0);
                            const allHidden = idxs.every(i => hiddenPredAnns.has(i));
                            setHiddenPredAnns(prev => {
                                const next = new Set(prev);
                                if (allHidden) idxs.forEach(i => next.delete(i));
                                else idxs.forEach(i => next.add(i));
                                return next;
                            });
                        };
                        return (
                            <>
                                <div className="viewer-sidebar-header" style={{marginTop: '10px', background: '#2a2a4a'}}>
                                    <span>预测标注</span>
                                    <span>{predAnns.length}</span>
                                </div>
                                {predModels.map((model, modelIdx) => {
                                    const modelIdxs = predAnns.map((a, i) => a._pred_source === model ? i : -1).filter(i => i >= 0);
                                    const dashDesc = PRED_DASH_DESCS[modelIdx % PRED_DASH_DESCS.length];
                                    const allHidden = modelIdxs.every(i => hiddenPredAnns.has(i));
                                    const globallyHidden = visiblePredModels && !visiblePredModels.has(model);
                                    return (
                                        <div key={model}>
                                            {/* 模型标题行：点击整体切换该模型所有框 */}
                                            <div
                                                onClick={() => !globallyHidden && toggleModelAll(model)}
                                                title={globallyHidden ? '该模型已在工具栏中关闭，点击可在工具栏重新开启' : undefined}
                                                style={{
                                                    padding: '5px 12px',
                                                    background: globallyHidden ? '#1a1a2a' : '#252545',
                                                    fontSize: '11px',
                                                    color: (allHidden || globallyHidden) ? '#444' : '#bbb',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    cursor: globallyHidden ? 'default' : 'pointer',
                                                    userSelect: 'none',
                                                    borderBottom: '1px solid #333355',
                                                    opacity: globallyHidden ? 0.5 : 1,
                                                }}
                                            >
                                                <span style={{fontFamily: 'monospace', fontSize: '13px', letterSpacing: '1px', color: globallyHidden ? '#444' : '#7af'}}>{dashDesc}</span>
                                                <span style={{fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{model}</span>
                                                {globallyHidden && <span style={{fontSize:'10px', color:'#f55', marginLeft:'2px'}}>[已关闭]</span>}
                                                <span style={{marginLeft: 'auto', color: '#666'}}>{modelIdxs.length}</span>
                                                <span style={{color: '#666'}}>{globallyHidden ? '✕' : (allHidden ? '○' : '●')}</span>
                                            </div>
                                            {/* 逐条标注列表（全局隐藏时折叠） */}
                                            {!globallyHidden && modelIdxs.map(globalIdx => {
                                                const ann = predAnns[globalIdx];
                                                const isHidden = hiddenPredAnns.has(globalIdx);
                                                const isHovered = hoveredPredAnnIdx === globalIdx;
                                                return (
                                                    <div
                                                        key={globalIdx}
                                                        className={`viewer-ann-item ${isHidden ? 'hidden' : ''} ${isHovered ? 'viewer-ann-item-hovered' : ''}`}
                                                        style={{ borderLeftColor: getCategoryColor(palette, ann.category) }}
                                                        onClick={() => togglePredAnn(globalIdx)}
                                                        onMouseEnter={() => setHoveredPredAnnIdx(globalIdx)}
                                                        onMouseLeave={() => setHoveredPredAnnIdx(null)}
                                                    >
                                                        <div className="viewer-ann-color" style={{ background: getCategoryColor(palette, ann.category) }}></div>
                                                        <span className="viewer-ann-text">{ann.category}</span>
                                                        {ann.score !== undefined && ann.score !== null && (
                                                            <span className="viewer-ann-score">{(Number(ann.score) * 100).toFixed(1)}%</span>
                                                        )}
                                                        <span style={{marginLeft: 'auto', color: '#666'}}>{isHidden ? '○' : '●'}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                                {/* 底部全显/全隐按钮 */}
                                <div style={{padding: '10px', background: '#2a2a44', display: 'flex', gap: '8px'}}>
                                    <button className="tool-btn" style={{flex: 1}} onClick={() => setHiddenPredAnns(new Set())}>全部显示</button>
                                    <button className="tool-btn" style={{flex: 1}} onClick={() => setHiddenPredAnns(new Set(predAnns.map((_, i) => i)))}>全部隐藏</button>
                                </div>
                            </>
                        );
                    })()}
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
    const scoreRef = useRef(null);
    
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
        // 8. 置信度分布（按类别，兼容无 score 时跳过）
        if (stats.score && stats.score.values && stats.score.values.length > 0 && scoreRef.current) {
            generateBoxPlot(scoreRef, stats.score, '置信度分布（按类别）', '置信度 (0-1)');
        }
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
            'width': '宽度' + suffix, 'height': '高度' + suffix, 'wh_ratio': '宽高比', 'aspect_ratio': '长短边比',
            'score': '置信度'
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
            case 'score': values = catData.score?.values || []; break;
        }

        if (values.length > 0) {
            const metricLabel = metricNames[densityMetric] || densityMetric;
            Plotly.newPlot(densityRef.current, [{
                x: values,
                type: 'histogram',
                nbinsx: densityMetric === 'score' ? 20 : 30,
                marker: { color: getCategoryColor(palette, densityCategory) }
            }], { 
                title: `${densityCategory} - ${metricLabel} ${eda.chartDensity || '密度分布'}`,
                xaxis: { title: metricLabel, range: densityMetric === 'score' ? [0, 1] : undefined },
                yaxis: { title: '频数' },
                height: 400
            }, { responsive: true });
        } else if (densityRef.current && typeof Plotly.purge === 'function') {
            Plotly.purge(densityRef.current);
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
                        {datasetData.all_categories_stats?.score?.values?.length > 0 && (
                            <div className="eda-card">
                                <div className="eda-card-title">{eda.chartScore || '置信度分布（按类别）'}</div>
                                <div ref={scoreRef} className="eda-chart"></div>
                            </div>
                        )}
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
                                    {datasetData.all_categories_stats?.score?.values?.length > 0 && (
                                        <option value="score">置信度</option>
                                    )}
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
