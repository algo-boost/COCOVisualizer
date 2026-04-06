// COCO数据集可视化工具 - React版本
const { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext } = React;

// 默认配置
const DEFAULT_CONFIG = {
    appName: 'COCO Dataset Visualizer',
    uiTheme: 'light', // dark | light | dim
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
    imageCategories: ['未分类', '背景误检', '低置信度背景误检', '低置信度正确检出', '高置信度正确检出', '环境误检', '类别误检', '漏检'],
    /** COCO 中无任何 GT 类别（空 categories 或无标注推断）时，用于筛选/打标/导出的默认类别名，可在 config.json 覆盖 */
    defaultAnnotationCategories: ['object'],
    imageCategoryMultiSelect: false,
    imageCategoryColors: {
        '未分类': '#888888',
        '背景误检': '#F39C12',
        '低置信度背景误检': '#E74C3C',
        '低置信度正确检出': '#F6A623',
        '高置信度正确检出': '#27AE60',
        '环境误检': '#E67E22',
        '类别误检': '#8E44AD',
        '漏检': '#3498DB'
    },
    colorPalette: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1', '#FF69B4', '#32CD32', '#FFD700'],
    viewer: {
        wheelZoomFactorOut: 0.9,
        wheelZoomFactorIn: 1.1,
        zoomMin: 0.01,
        zoomMax: 9999,
        wheelZoomWithoutModifier: false,
        lineWidthOptions: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
        lineWidthDefault: 0.5,
        lineWidthLabel: '线宽:',
        backgroundStyle: 'checkerboard',
        backgroundColor: '#1a1a2e',
        checkerboardColor1: '#2d2d44',
        checkerboardColor2: '#252548',
        crossSidebarIouThreshold: 0.5,
        sidebarDock: 'right',
        filmstripHiddenByDefault: true,
        metaFilterFieldMap: {
            c_time: 'c_time',
            product_id: 'product_id',
            position: 'position'
        }
    },
    settings: {
        modalTitle: '设置',
        themeLabel: '界面主题',
        themeHint: '支持深色、浅色与柔和暗色，可随时切换。',
        themeDarkLabel: '深色',
        themeLightLabel: '浅色',
        themeDimLabel: '柔和暗色',
        viewerBackgroundLabel: '查看器背景',
        backgroundStyleCheckerboard: '马赛克',
        backgroundStyleSolid: '纯色',
        lineWidthDefaultLabel: '默认线宽',
        imageCategoriesLabel: '图片级分类（全局默认）',
        imageCategoriesHint: '用于图片级标签（如未分类、误检等），保存在本机；若当前 COCO 含 image_category_definitions 则仍以文件中的定义为准。',
        annotationCategoriesLabel: 'GT 框标注类别（默认）',
        annotationCategoriesHint: '当数据集中没有任何 GT 类别时，使用此处名称作为可选类别（如图库筛选、看图打框）。至少保留一项。',
        categoriesTabTitle: '分类默认值',
        addCategoryButton: '添加分类',
        addAnnotationCategoryButton: '添加类别',
        categoryNamePlaceholder: '分类名称',
        resetCategoriesButton: '恢复默认',
        resetAnnotationCategoriesButton: '恢复 GT 默认',
        categoryScopeSummary: '何时用「设置」里的类别？何时以 COCO 文件为准？',
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
        progressGenerating: '正在生成压缩包...',
        tabCategory: '按分类',
        tabExperiment: '实验 train/valid',
        experimentTitle: '实验数据集（train / valid）',
        experimentDescription: '基于当前已加载的 COCO：导出文件名为原始 basename。默认自动丢弃重名（保留最小 image_id）；也可关闭此项改为遇重名报错。',
        experimentTrainRatio: '训练集比例',
        experimentSeed: '随机种子',
        experimentZipLabel: 'ZIP 文件名',
        experimentOutputPathLabel: '服务端保存路径（可选）',
        experimentOutputPathPlaceholder: '/path/to/dir 或 /path/to/file.zip',
        experimentOutputPathHint: '填写运行本服务的机器上的绝对或相对路径。以 .zip 结尾则视为完整文件路径，否则视为目录并与上方 ZIP 文件名拼接。留空则写入临时目录并触发浏览器下载。',
        experimentExportButton: '导出实验包',
        experimentProgress: '正在生成实验数据集...',
        experimentLead: '合并当前 COCO 中的图片与标注，按种子划分 train / valid，打包为单个 ZIP。',
        experimentSectionParams: '划分参数',
        experimentSectionDup: '重名处理',
        experimentSectionOutput: '输出文件',
        experimentDropDupes: '丢弃重名图片',
        experimentDropDupesHint: '同一文件名（basename）只保留 image_id 最小的一张，其余不参与导出。',
        experimentStrictDupesHint: '关闭后若存在重名将报错终止，需先手动改名。',
        experimentFootnote: '图库筛选不影响本导出；导出的是已加载 COCO 中的全部图片。'
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

/** 置信度过滤：阈值为 0 表示不过滤；无 score 的框始终显示（GT 与预测共用） */
function passesConfThreshold(ann, confThreshold) {
    return confThreshold <= 0 || ann.score == null || Number(ann.score) >= confThreshold;
}

function getMetaFilterMapping(viewerCfg) {
    const m = (viewerCfg && viewerCfg.metaFilterFieldMap) || {};
    const pick = (k, d) => {
        const v = String(m[k] || '').trim();
        return v || d;
    };
    return {
        c_time: pick('c_time', 'c_time'),
        product_id: pick('product_id', 'product_id'),
        position: pick('position', 'position')
    };
}

/** 底部缩略图条占用高度（含下边距），适应窗口时从可视高度扣除，避免压住主图 */
const VIEWER_FILMSTRIP_RESERVE_PX = 92;

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
    useEffect(() => {
        const root = document.documentElement;
        const theme = ['dark', 'light', 'dim'].includes(mergedConfig.uiTheme) ? mergedConfig.uiTheme : 'dark';
        root.setAttribute('data-theme', theme);
    }, [mergedConfig.uiTheme]);

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

    // 最近加载历史工具函数（localStorage）
    const RECENT_LOADS_KEY = 'coco_viz_recent_loads';
    const saveRecentLoad = (entry) => {
        try {
            const raw = localStorage.getItem(RECENT_LOADS_KEY);
            let list = raw ? JSON.parse(raw) : [];
            // 去重（同路径的移到最前）
            list = list.filter(r => r.cocoPath !== entry.cocoPath);
            list.unshift({ ...entry, loadedAt: new Date().toISOString() });
            list = list.slice(0, 6);
            localStorage.setItem(RECENT_LOADS_KEY, JSON.stringify(list));
        } catch (e) {}
    };

    // 加载数据集（单文件）
    const loadDataset = async (cocoPath, imageDir, name) => {
        setLoading(true);
        try {
            const metaFilterMapping = getMetaFilterMapping(config.viewer || DEFAULT_CONFIG.viewer);
            const res = await fetch('/api/load_dataset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ coco_json_path: cocoPath, image_dir: imageDir, dataset_name: name, meta_filter_mapping: metaFilterMapping })
            });
            const data = await res.json();
            if (data.success) {
                saveRecentLoad({ cocoPath, imageDir: imageDir || '', name: name || 'dataset', type: 'single' });
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
            const metaFilterMapping = getMetaFilterMapping(config.viewer || DEFAULT_CONFIG.viewer);
            const res = await fetch('/api/load_dataset_merged', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items, dataset_name: datasetName || 'merged', root_path: (rootPath || '').trim(), meta_filter_mapping: metaFilterMapping })
            });
            const data = await res.json();
            if (data.success) {
                saveRecentLoad({ cocoPath: rootPath || items[0]?.coco_path || '', imageDir: '', name: datasetName || 'merged', type: 'merged', items });
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
        const serverAnnCats = Array.isArray(data.categories) && data.categories.length > 0 ? data.categories : null;
        const fallbackAnn = (config.defaultAnnotationCategories && config.defaultAnnotationCategories.length > 0)
            ? config.defaultAnnotationCategories
            : (DEFAULT_CONFIG.defaultAnnotationCategories || ['object']);
        const effectiveAnnCats = serverAnnCats || fallbackAnn;
        setDatasetData({ ...data, categories: effectiveAnnCats });
        setCategories(effectiveAnnCats);
        // 若 COCO 文件含有本软件写入的分类定义，完全按原定义加载（保持顺序、颜色、快捷键绑定）
        // 否则清空活跃定义，回退到用户自己的 config
        const catDefs = data.image_category_definitions;
        if (catDefs && Array.isArray(catDefs.categories) && catDefs.categories.length > 0) {
            setActiveImageCategories(catDefs.categories);
            setActiveImageCategoryColors(catDefs.colors || null);
            setActiveImageCategoryMultiSelect(
                typeof catDefs.multi_select === 'boolean'
                    ? catDefs.multi_select
                    : (config.imageCategoryMultiSelect ?? DEFAULT_CONFIG.imageCategoryMultiSelect)
            );
        } else {
            setActiveImageCategories(null);
            setActiveImageCategoryColors(null);
            setActiveImageCategoryMultiSelect(null);
        }
        // 服务端无类别时 selected_categories 传 [] 表示不按 GT 类别筛图（仍显示全部图片）；UI 上仍展示默认类别供后续打标
        const body = { dataset_id: data.dataset_id, selected_categories: serverAnnCats || [], meta_filter_mapping: getMetaFilterMapping(config.viewer || DEFAULT_CONFIG.viewer) };
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
            const defaultCat = (activeImageCategories && activeImageCategories[0]) || (config.imageCategories && config.imageCategories[0]) || '未分类';
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
        const body = { dataset_id: datasetData.dataset_id, selected_categories: categories, meta_filter_mapping: getMetaFilterMapping(config.viewer || DEFAULT_CONFIG.viewer) };
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
                const defaultCat = (activeImageCategories && activeImageCategories[0]) || (config.imageCategories && config.imageCategories[0]) || '未分类';
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
    }, [datasetData, categories, config.imageCategories, activeImageCategories]);

    // 类别改名后重新从服务器拉取 images（让 categories 字段也同步更新）
    const reloadImagesFromServer = useCallback(async () => {
        if (!datasetData) return;
        try {
            const res = await fetch('/api/get_images_by_category', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dataset_id: datasetData.dataset_id, selected_categories: categories, meta_filter_mapping: getMetaFilterMapping(config.viewer || DEFAULT_CONFIG.viewer) })
            });
            const data = await res.json();
            if (data.success && data.images) {
                setImages(data.images);
                const defaultCat = (activeImageCategories && activeImageCategories[0]) || (config.imageCategories && config.imageCategories[0]) || '未分类';
                const newClass = {}, newNotes = {};
                data.images.forEach(img => {
                    const cats = img.image_categories;
                    newClass[img.image_id] = Array.isArray(cats) && cats.length ? cats : (img.image_category ? [img.image_category] : [defaultCat]);
                    newNotes[img.image_id] = img.note || '';
                });
                setImageClassifications(newClass);
                setImageNotes(newNotes);
                // 同步更新 categories 列表
                const allCats = new Set();
                data.images.forEach(img => (img.annotations || []).forEach(a => { if (a.category) allCats.add(a.category); }));
                if (allCats.size > 0) setCategories(prev => [...new Set([...prev.filter(c => allCats.has(c)), ...allCats])]);
            }
        } catch (e) { console.warn('reloadImagesFromServer failed', e); }
    }, [datasetData, categories, config.imageCategories, activeImageCategories]); // eslint-disable-line

    // ---- 自动保存（防抖 3s）：任何分类/备注变动后静默写回 COCO 文件，下次打开即恢复 ----
    // 用 ref 持有最新数据，避免 timer 回调读到旧闭包
    const _autoSaveRef = useRef({ datasetData: null, images: [], imageClassifications: {}, imageNotes: {}, imageCategories: [], imageCategoryColors: {}, imageCategoryMultiSelect: false });
    const _autoSaveTimer = useRef(null);
    const [autoSaveStatus, setAutoSaveStatus] = useState('idle'); // 'idle' | 'pending' | 'saved' | 'error'

    // 活跃分类定义：若 COCO 文件中有本软件写入的定义则优先采用，否则回退到 config
    const [activeImageCategories, setActiveImageCategories] = useState(null);
    const [activeImageCategoryColors, setActiveImageCategoryColors] = useState(null);
    const [activeImageCategoryMultiSelect, setActiveImageCategoryMultiSelect] = useState(null);

    const imageCategories = activeImageCategories || config.imageCategories || DEFAULT_CONFIG.imageCategories;
    const imageCategoryColors = activeImageCategoryColors || config.imageCategoryColors || DEFAULT_CONFIG.imageCategoryColors;
    const imageCategoryMultiSelect = (activeImageCategoryMultiSelect ?? (config.imageCategoryMultiSelect ?? DEFAULT_CONFIG.imageCategoryMultiSelect));

    useEffect(() => {
        _autoSaveRef.current = { datasetData, images, imageClassifications, imageNotes, imageCategories, imageCategoryColors, imageCategoryMultiSelect };
    }, [datasetData, images, imageClassifications, imageNotes, imageCategories, imageCategoryColors, imageCategoryMultiSelect]);

    const scheduleAutoSave = useCallback(() => {
        setAutoSaveStatus('pending');
        if (_autoSaveTimer.current) clearTimeout(_autoSaveTimer.current);
        // 1 秒防抖：连续快速操作只触发最后一次，每次均生成版本快照
        _autoSaveTimer.current = setTimeout(async () => {
            const { datasetData, images, imageClassifications, imageNotes, imageCategories, imageCategoryColors, imageCategoryMultiSelect } = _autoSaveRef.current;
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
                        image_category_definitions: { categories: imageCategories, colors: imageCategoryColors, multi_select: !!imageCategoryMultiSelect }
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

    // 批量清空选中图片的标注
    const batchClearAnnotations = async (imageIds) => {
        if (!datasetData || imageIds.length === 0) return;
        if (!window.confirm(`确定清空选中的 ${imageIds.length} 张图片的全部 GT 标注？此操作不可撤销。`)) return;
        const imagesPayload = imageIds.map(id => ({ image_id: id, annotations: [] }));
        try {
            const res = await fetch('/api/save_annotations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dataset_id: datasetData.dataset_id, images: imagesPayload })
            });
            const data = await res.json();
            if (data.success) {
                setImages(prev => prev.map(img =>
                    imageIds.includes(img.image_id) ? { ...img, annotations: [] } : img
                ));
            } else {
                alert('清空失败: ' + (data.error || '未知错误'));
            }
        } catch (e) {
            alert('清空失败: ' + e.message);
        }
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
                const defaultCat = (activeImageCategories && activeImageCategories[0]) || (config.imageCategories && config.imageCategories[0]) || '未分类';
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
    // EDA → 宫格联动：点击图表类别后跳转宫格并过滤
    const [galleryJumpCategory, setGalleryJumpCategory] = useState(null);
    const [agentFilterIds, setAgentFilterIds] = useState(null);
    const [agentFilterMsg, setAgentFilterMsg] = useState('');
    // EDA → 宫格联动：点击散点后跳转并打开对应图片
    const [galleryJumpImageId, setGalleryJumpImageId] = useState(null);

    // ── 聊天会话持久化 ──────────────────────────────────────
    const [chatSessions, setChatSessions] = useState(() => {
        try {
            const raw = localStorage.getItem('cocovis_chat_sessions');
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    });
    const [activeChatId, setActiveChatId] = useState(() => {
        try { return localStorage.getItem('cocovis_active_chat_id') || null; }
        catch { return null; }
    });

    // 任何会话变更时持久化
    useEffect(() => {
        try { localStorage.setItem('cocovis_chat_sessions', JSON.stringify(chatSessions)); }
        catch {}
    }, [chatSessions]);
    useEffect(() => {
        try {
            if (activeChatId) localStorage.setItem('cocovis_active_chat_id', activeChatId);
            else localStorage.removeItem('cocovis_active_chat_id');
        } catch {}
    }, [activeChatId]);

    // ── 流式状态（App 层，切页不丢）────────────────────────
    const [streamingInfo, setStreamingInfo] = useState(null); // {sessionId, msgId} | null

    // 会话管理回调
    const newChatSession = useCallback(() => {
        const id = `chat_${Date.now()}`;
        const sess = { id, title: '新对话', messages: [], createdAt: Date.now(), updatedAt: Date.now() };
        setChatSessions(prev => [sess, ...prev]);
        setActiveChatId(id);
        return id;
    }, []);

    const updateChatMessages = useCallback((id, messages) => {
        setChatSessions(prev => prev.map(s => s.id !== id ? s : {
            ...s, messages,
            title: messages.find(m => m.role === 'user')?.content?.slice(0, 28) || s.title,
            updatedAt: Date.now(),
        }));
    }, []);

    const deleteChatSession = useCallback((id) => {
        setChatSessions(prev => prev.filter(s => s.id !== id));
        setActiveChatId(prev => {
            if (prev !== id) return prev;
            const remaining = chatSessions.filter(s => s.id !== id);
            return remaining[0]?.id || null;
        });
    }, [chatSessions]);

    // ── sendChatMessage：在 App 层执行，切页不中断 ─────────
    const sendChatMessage = useCallback(async (content, attachments = [], sessionIdHint, systemPromptOverride, forcedSkillIds = []) => {
        const apiUrl = (configRef.current?.llm?.apiUrl || 'https://api.openai.com/v1/chat/completions').replace(/\/$/, '');
        const apiKey = configRef.current?.llm?.apiKey || '';
        const model = configRef.current?.llm?.model || 'gpt-4o-mini';
        const maxTokens = configRef.current?.llm?.maxTokens || 2000;
        const customSystemPrompt = systemPromptOverride !== undefined
            ? systemPromptOverride
            : (configRef.current?.llm?.systemPrompt || '');

        // 确保有会话
        let sessionId = sessionIdHint || activeChatId;
        if (!sessionId || !chatSessions.find(s => s.id === sessionId)) {
            sessionId = newChatSession();
        }

        // 获取当前会话的 messages（快照）
        const currentMsgs = chatSessions.find(s => s.id === sessionId)?.messages || [];

        const userMsg = { role: 'user', content, id: Date.now(), attachments };
        const aId = Date.now() + 1;
        const aMsg = { role: 'assistant', id: aId, steps: [], conclusion: '' };

        // 先写入用户消息 + 空 assistant 占位
        updateChatMessages(sessionId, [...currentMsgs, userMsg, aMsg]);
        setStreamingInfo({ sessionId, msgId: aId });

        // 函数式更新 assistant 消息（不依赖 stale ref）
        const updateMsg = (updater) => {
            setChatSessions(prev => prev.map(s => s.id !== sessionId ? s : {
                ...s,
                messages: s.messages.map(m => m.id === aId ? updater(m) : m),
                updatedAt: Date.now(),
            }));
        };

        // 历史消息（供 LLM 上下文）
        const history = currentMsgs.flatMap(m => {
            if (m.role === 'user') return [{ role: 'user', content: m.content }];
            if (m.role === 'assistant' && m.conclusion) return [{ role: 'assistant', content: m.conclusion }];
            return [];
        });

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...history, { role: 'user', content }],
                    api_url: apiUrl, api_key: apiKey, model,
                    max_tokens: maxTokens,
                    dataset_id: datasetData?.dataset_id,
                    attachments,
                    custom_system_prompt: customSystemPrompt,
                    forced_skill_ids: Array.isArray(forcedSkillIds) ? forcedSkillIds : [],
                })
            });
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buf = '';

            const processEvent = (evt) => {
                if (!evt?.type) return;
                switch (evt.type) {
                    case 'status':
                        updateMsg(m => ({ ...m, steps: [...(m.steps || []), { type: 'status', msg: evt.msg }] }));
                        break;
                    case 'code':
                        updateMsg(m => ({ ...m, steps: [...(m.steps || []), { type: 'code', code: evt.code, index: evt.index }] }));
                        break;
                    case 'search_result':
                        updateMsg(m => ({ ...m, steps: [...(m.steps || []), { type: 'search_result', query: evt.query, result: evt.result }] }));
                        break;
                    case 'code_result':
                        updateMsg(m => ({ ...m, steps: [...(m.steps || []), { type: 'code_result', result: evt.result, index: evt.index }] }));
                        break;
                    case 'ui_action': {
                        const action = evt.action || {};
                        if (action.type === 'navigate') {
                            setPage(action.page);
                        } else if (action.type === 'filter_gallery') {
                            setAgentFilterIds(action.image_ids || []);
                            setAgentFilterMsg(action.description || 'Agent 筛选结果');
                        } else if (action.type === 'show_chart') {
                            updateMsg(m => ({ ...m, steps: [...(m.steps || []), { type: 'chart', chart: action.chart }] }));
                        } else if (action.type === 'show_table') {
                            updateMsg(m => ({ ...m, steps: [...(m.steps || []), { type: 'table', table: action.table }] }));
                        } else if (action.type === 'load_dataset') {
                            // 触发数据集加载
                            fetch('/api/load_dataset', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    coco_path: action.coco_json_path,
                                    image_dir: action.image_dir || '',
                                    dataset_name: action.dataset_name || '',
                                })
                            }).then(r => r.json()).then(d => {
                                if (d.error) {
                                    updateMsg(m => ({ ...m, conclusion: (m.conclusion || '') + `\n\n⚠️ 加载数据集失败：${d.error}` }));
                                }
                            }).catch(() => {});
                        }
                        break;
                    }
                    case 'conclusion_start':
                        updateMsg(m => ({ ...m, steps: (m.steps || []).filter(s => s.type !== 'status') }));
                        break;
                    case 'conclusion':
                        updateMsg(m => ({ ...m, conclusion: (m.conclusion || '') + evt.content }));
                        break;
                    case 'error':
                        updateMsg(m => ({ ...m, conclusion: (m.conclusion || '') + `\n\n⚠️ **错误：** ${evt.msg}` }));
                        break;
                }
            };

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buf += decoder.decode(value, { stream: true });
                const parts = buf.split('\n');
                buf = parts.pop();
                for (const part of parts) {
                    const line = part.trim();
                    if (!line.startsWith('data:')) continue;
                    const raw = line.slice(5).trim();
                    if (raw === '[DONE]') break;
                    try { processEvent(JSON.parse(raw)); } catch (_) {}
                }
            }
        } catch (e) {
            updateMsg(m => ({ ...m, conclusion: `⚠️ 请求失败：${e.message}` }));
        }
        setStreamingInfo(null);
    }, [activeChatId, chatSessions, datasetData, newChatSession, updateChatMessages]);

    // 用 ref 暴露最新 config 给 sendChatMessage 闭包（避免闭包过期）
    const appConfig = useConfig();
    const configRef = useRef(appConfig);
    useEffect(() => { configRef.current = appConfig; }, [appConfig]);

    // 标注保存后同步更新内存中的 annotations（避免重新拉取整个列表）
    const updateAnnotationsLocal = useCallback((imageId, newAnns) => {
        setImages(prev => prev.map(img =>
            img.image_id === imageId ? { ...img, annotations: newAnns.map(a => ({ ...a })) } : img
        ));
    }, []);

    const handleAgentFilter = useCallback((imageIds, message) => {
        // Agent 过滤：跳转到图库并用 imageId 集合过滤
        if (imageIds && imageIds.length > 0) {
            setGalleryJumpImageId(null);
            setGalleryJumpCategory(null);
            setAgentFilterIds(imageIds);
            setAgentFilterMsg(message || '');
            setPage('gallery');
        }
    }, []);

    return (
        <div className="app-container">
            <SidebarNav page={page} setPage={setPage} datasetLoaded={!!datasetData} onOpenSettings={() => setShowSettingsModal(true)} onOpenHelp={() => setShowHelpModal(true)} />
            {page === 'load' && <LoadPage onLoad={loadDataset} onLoadMerged={loadDatasetMerged} loading={loading} />}
            {page === 'chat' && (
                <ChatPage
                    datasetData={datasetData}
                    images={images}
                    onFilterByIds={handleAgentFilter}
                    sessions={chatSessions}
                    activeChatId={activeChatId}
                    streamingInfo={streamingInfo}
                    onSendMessage={sendChatMessage}
                    onNewSession={newChatSession}
                    onUpdateMessages={updateChatMessages}
                    onDeleteSession={deleteChatSession}
                    onSwitchSession={setActiveChatId}
                />
            )}
            {page === 'gallery' && datasetData && (
                <GalleryPage
                    datasetData={datasetData}
                    images={images}
                    categories={categories}
                    imageClassifications={imageClassifications}
                    imageNotes={imageNotes}
                    imageCategories={imageCategories}
                    imageCategoryColors={imageCategoryColors}
                    imageCategoryMultiSelect={imageCategoryMultiSelect}
                    onUpdateImageCategories={setActiveImageCategories}
                    onUpdateImageCategoryColors={setActiveImageCategoryColors}
                    onUpdateCategory={updateImageCategory}
                    onUpdateCategories={updateImageCategories}
                    onUpdateNote={updateImageNote}
                    onBatchUpdateCategory={batchUpdateCategory}
                    onBatchClearAnnotations={batchClearAnnotations}
                    onRollback={refetchImageMetaAfterRollback}
                    metaFilterOptions={datasetData.meta_filter_options}
                    onApplyMetaFilters={refetchImagesWithMetaFilters}
                    autoSaveStatus={autoSaveStatus}
                    onAnnotationsSaved={updateAnnotationsLocal}
                    onReloadImages={reloadImagesFromServer}
                    jumpToCategory={galleryJumpCategory}
                    onJumpHandled={() => setGalleryJumpCategory(null)}
                    jumpToImageId={galleryJumpImageId}
                    onJumpImageHandled={() => setGalleryJumpImageId(null)}
                    agentFilterIds={agentFilterIds}
                    agentFilterMsg={agentFilterMsg}
                    onClearAgentFilter={() => { setAgentFilterIds(null); setAgentFilterMsg(''); }}
                    onFilterByIds={handleAgentFilter}
                />
            )}
            {page === 'eda' && datasetData && (
                <EDAPage
                    datasetData={datasetData}
                    images={images}
                    onJumpToGallery={(cat) => { setGalleryJumpCategory(cat); setPage('gallery'); }}
                    onJumpToImage={(imageId) => { setGalleryJumpImageId(imageId); setPage('gallery'); }}
                />
            )}
            {showSettingsModal && (
                <SettingsModal
                    onClose={() => setShowSettingsModal(false)}
                    cocoImageCategoryDefsActive={activeImageCategories != null}
                />
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
    const brandMark = useMemo(() => {
        const raw = (config.appName || 'CV').trim();
        if (raw.length <= 2) return raw.slice(0, 2).toUpperCase();
        const w = raw.split(/\s+/).filter(Boolean);
        if (w.length >= 2) return (w[0][0] + w[1][0]).toUpperCase();
        return raw.slice(0, 2).toUpperCase();
    }, [config.appName]);
    return (
        <div className="sidebar-nav">
            <div className="sidebar-brand-mark" title={config.appName || ''} aria-hidden="true">{brandMark}</div>
            <div className={`nav-item ${page === 'load' ? 'active' : ''}`} onClick={() => setPage('load')} title={nav.loadTitle}>📂</div>
            <div className="nav-divider"></div>
            {datasetLoaded && (
                <>
                    <div className={`nav-item ${page === 'gallery' ? 'active' : ''}`} onClick={() => setPage('gallery')} title={nav.galleryTitle}>🖼️</div>
                    <div className={`nav-item ${page === 'eda' ? 'active' : ''}`} onClick={() => setPage('eda')} title={nav.edaTitle}>📊</div>
                </>
            )}
            <div className={`nav-item ${page === 'chat' ? 'active' : ''}`} onClick={() => setPage('chat')} title="AI 数据助手">🤖</div>
            <div className="nav-divider"></div>
            <div className="nav-item" onClick={() => onOpenSettings && onOpenSettings()} title="设置">⚙️</div>
            <div className="nav-item" onClick={() => onOpenHelp && onOpenHelp()} title="使用文档">📖</div>
        </div>
    );
}

// ==================== 完整使用文档 (User Guide) ====================
function HelpModal({ onClose }) {
    const [activeTab, setActiveTab] = useState('overview');

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content help-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', width: '90vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
                <div className="modal-header">
                    <h3>📖 COCOVisualizer 完整使用文档</h3>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-raised)' }}>
                    {[
                        { id: 'overview', label: '功能总览' },
                        { id: 'load', label: '加载与COCO模板' },
                        { id: 'gallery', label: '图库与筛选' },
                        { id: 'viewer', label: '看图与对比' },
                        { id: 'annotate', label: '画框与打标' },
                        { id: 'agent', label: 'Agent 使用' },
                        { id: 'shortcuts', label: '快捷键' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            style={{
                                flex: 1, padding: '12px 0', border: 'none', background: activeTab === tab.id ? 'var(--bg-surface)' : 'transparent',
                                color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
                                borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                                cursor: 'pointer', fontWeight: activeTab === tab.id ? 'bold' : 'normal', fontSize: '14px'
                            }}
                            onClick={() => setActiveTab(tab.id)}
                        >{tab.label}</button>
                    ))}
                </div>
                <div className="modal-body help-modal-body" style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', lineHeight: '1.6', fontSize: '14px', color: 'var(--text-primary)' }}>
                    {activeTab === 'overview' && (
                        <div>
                            <h4>🚀 功能总览</h4>
                            <p>COCOVisualizer 是一个面向目标检测项目的 <b>数据浏览、对比评估、标注修正、智能分析</b> 一体化工具。</p>
                            <ol style={{ paddingLeft: '20px', marginTop: '10px' }}>
                                <li><b>加载数据：</b>导入 COCO JSON + 图片目录，快速启动可视化。</li>
                                <li><b>图库筛选：</b>按类别、目录、置信度、Python 代码等条件定位目标图片。</li>
                                <li><b>看图对比：</b>同屏查看 GT 与预测，支持独立阈值和联动高亮。</li>
                                <li><b>标注修正：</b>进入编辑模式增删改框，并可接受预测框为 GT。</li>
                                <li><b>智能分析：</b>在 Agent 中用自然语言完成筛图、统计、导出。</li>
                                <li><b>保存回滚：</b>版本化保存，可追溯可回滚。</li>
                            </ol>
                        </div>
                    )}
                    {activeTab === 'load' && (
                        <div>
                            <h4>📂 加载数据与 COCO JSON 模板（重点）</h4>
                            <p>建议优先保证 COCO 结构规范，再加载到系统。最小可用模板如下：</p>
                            <pre style={{ background: 'var(--bg-soft)', border: '1px solid var(--border)', padding: '10px', borderRadius: '8px', overflowX: 'auto', fontSize: '12px' }}>
{`{
  "images": [{"id": 1, "file_name": "images/0001.jpg", "width": 1920, "height": 1080}],
  "annotations": [{"id": 1, "image_id": 1, "category_id": 1, "bbox": [100, 200, 300, 150], "area": 45000, "iscrowd": 0}],
  "categories": [{"id": 1, "name": "defect"}]
}`}
                            </pre>
                            <ul style={{ paddingLeft: '20px' }}>
                                <li><b>必填关系：</b><code>annotations.image_id</code> 必须能关联到 <code>images.id</code>；<code>category_id</code> 必须存在于 <code>categories.id</code>。</li>
                                <li><b>bbox 格式：</b><code>[x, y, w, h]</code>，宽高必须大于 0。</li>
                                <li><b>路径规范：</b>若 <code>file_name</code> 是相对路径，请在加载页填写图片目录。</li>
                                <li><b>宽高建议：</b>建议在 <code>images</code> 中写入 <code>width/height</code>，可提高显示与缩放稳定性。</li>
                            </ul>
                            <p><b>加载步骤：</b>选择 COCO → 选择图片目录（可选）→ 填写数据集名 → 点击加载。</p>
                        </div>
                    )}
                    {activeTab === 'gallery' && (
                        <div>
                            <h4>🖼 图库与代码筛选</h4>
                            <ul style={{ paddingLeft: '20px' }}>
                                <li><b>快速筛选：</b>按 GT 类别、图片级分类、目录、关键词快速过滤；工具栏「无 GT」仅保留无任何 GT 框的图片（与图片级「未分类」无关）。</li>
                                <li><b>代码筛选：</b>点击工具栏「代码筛选」打开弹窗，编写 Python（与 Agent 消息里代码块相同执行环境）。最后一行表达式为 <code>image_id</code> 列表时应用为图库筛选；也可运行统计/导出类脚本在弹窗内查看报告。</li>
                                <li><b>排序：</b>可按文件名、GT 框数、预测框数、文件大小、时间排序。</li>
                                <li><b>批量操作：</b>支持批量打图片级分类、批量清理标注。</li>
                                <li><b>实验导出：</b>「实验 train/valid」：默认同 basename 只保留最小 image_id，其余丢弃；可关闭为遇重名报错。ZIP 默认同数据集名。</li>
                                <li><b>自动联动：</b>Agent 聊天中运行代码块筛选结果会跳转图库；图库内运行筛选与之一致。</li>
                            </ul>
                        </div>
                    )}
                    {activeTab === 'viewer' && (
                        <div>
                            <h4>🔍 看图与对比</h4>
                            <ul style={{ paddingLeft: '20px' }}>
                                <li><b>缩放平移：</b>滚轮缩放，拖拽平移，支持全屏与适应窗口。</li>
                                <li><b>双侧栏：</b>左侧预测、右侧 GT/编辑；无预测时左栏自动隐藏。</li>
                                <li><b>独立阈值：</b>GT 与预测可分开设置置信度阈值。</li>
                                <li><b>联动高亮：</b>悬停一侧框项，另一侧 IoU 达阈值的框会联动高亮（阈值在设置中可调）。</li>
                                <li><b>对比模式：</b>一键切换 GT vs 预测双栏同步对比。</li>
                                <li><b>缩略图导航：</b>底部快速切图，连续审查更高效。</li>
                            </ul>
                        </div>
                    )}
                    {activeTab === 'annotate' && (
                        <div>
                            <h4>✏️ 画框与打标</h4>
                            <p>在看图模式下：<b>双击空白处</b>进入画框模式；<b>双击已有 GT 框</b>进入选择模式并选中该框（可拖拽、改类别）。也可点击 <b>✏️ 标注</b>。</p>
                            <ul style={{ paddingLeft: '20px' }}>
                                <li><b>画框：</b>B 键切画框工具，拖拽即可新建框。</li>
                                <li><b>选框：</b>V 键切选择工具，支持移动/缩放/多选；双击框可快速进入。</li>
                                <li><b>精修：</b>方向键微调，Shift+方向键快速移动，坐标面板可精确改数值。</li>
                                <li><b>预测转 GT：</b>支持单条 <b>+GT</b> 和批量“全部接受”。</li>
                                <li><b>撤销重做：</b><code>Ctrl+Z / Ctrl+Y</code> 全链路可回退。</li>
                                <li><b>保存机制：</b>支持自动保存与手动保存，建议每轮修订及时保存。</li>
                            </ul>
                        </div>
                    )}
                    {activeTab === 'agent' && (
                        <div>
                            <h4>🤖 Agent 使用方法（重点）</h4>
                            <p>Agent 支持用自然语言驱动筛图、统计、导出、页面联动与技能调用。建议按“目标 + 条件 + 输出”提问。</p>
                            <ul style={{ paddingLeft: '20px' }}>
                                <li><b>高效提问模板：</b>“请筛出【条件】的图片，并【输出动作】”。</li>
                                <li><b>结果类型：</b>可返回筛选列表、统计表格、图表、导出文件。</li>
                                <li><b>技能调用：</b>在技能面板启用/固定后，可直接让 Agent “使用某技能完成任务”。</li>
                                <li><b>推荐流程：</b>先筛图 → 再解释原因 → 最后导出复核材料。</li>
                            </ul>
                            <p style={{ marginTop: '8px' }}><b>示例指令：</b></p>
                            <ul style={{ paddingLeft: '20px' }}>
                                <li>“筛出预测框数量&gt;10 且包含漏检的图片，并在图库里只显示这些图。”</li>
                                <li>“统计各类别误检数量，生成表格并导出 CSV。”</li>
                                <li>“使用已启用的验证技能，对当前数据批次生成评估报告。”</li>
                            </ul>
                        </div>
                    )}
                    {activeTab === 'shortcuts' && (
                        <div>
                            <h4>⌨ 快捷键清单</h4>
                            <table className="help-shortcut-table" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                        <tbody>
                                    <tr style={{borderBottom:'1px solid var(--border)'}}><td style={{padding:'8px', fontWeight:'bold'}}>通用 & 导航</td><td></td></tr>
                                    <tr><td className="help-key">← / A 或 → / D</td><td>上一张 / 下一张图片（自带预加载，零延迟秒切）</td></tr>
                                    <tr><td className="help-key">Tab / Shift+Tab</td><td>在当前图的不同标注框之间循环切换并居中高亮</td></tr>
                                    <tr><td className="help-key">N</td><td>快速聚焦到备注输入框</td></tr>
                                    <tr><td className="help-key">0</td><td>图片缩放比例复位（适应窗口大小）</td></tr>
                                    <tr><td className="help-key">F</td><td>全屏 / 退出全屏模式</td></tr>
                                    
                                    <tr style={{borderBottom:'1px solid var(--border)'}}><td style={{padding:'8px', fontWeight:'bold', paddingTop:'16px'}}>标注模式专属</td><td></td></tr>
                                    <tr><td className="help-key">B / V</td><td>切换 画框工具(B) / 选中工具(V)</td></tr>
                                    <tr><td className="help-key">Del / Backspace</td><td>删除选中的标注框</td></tr>
                                    <tr><td className="help-key">Ctrl+C / Ctrl+V</td><td>复制 / 粘贴选中的标注框（支持跨图片粘贴）</td></tr>
                                    <tr><td className="help-key">Ctrl+Z / Ctrl+Y</td><td>撤销 (Undo) / 重做 (Redo)</td></tr>
                                    <tr><td className="help-key">方向键</td><td>微调选中框位置（加按 Shift 每次移动 10px）</td></tr>
                                    <tr><td className="help-key">Space + 拖拽</td><td>画框模式下临时切换为手形工具平移画布</td></tr>
                        </tbody>
                    </table>
                </div>
                    )}
                </div>
                <div className="modal-footer" style={{ borderTop: '1px solid var(--border)' }}>
                    <button type="button" className="btn btn-primary" onClick={onClose}>了解，关闭</button>
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
const RECENT_LOADS_KEY = 'coco_viz_recent_loads';

function LoadPage({ onLoad, onLoadMerged, loading }) {
    const config = useConfig();
    const lp = config.loadPage || DEFAULT_CONFIG.loadPage;
    const [loadTab, setLoadTab] = useState('scan'); // 'scan' | 'single'
    const [cocoPath, setCocoPath] = useState('');
    const [imageDir, setImageDir] = useState('');
    const [datasetName, setDatasetName] = useState('dataset');
    const [rootPath, setRootPath] = useState('');
    const [scanItems, setScanItems] = useState([]);
    const [scanning, setScanning] = useState(false);
    const [selectedIndices, setSelectedIndices] = useState(new Set());
    const [showPathPicker, setShowPathPicker] = useState(false);
    const [recentLoads, setRecentLoads] = useState(() => {
        try { return JSON.parse(localStorage.getItem(RECENT_LOADS_KEY) || '[]'); } catch { return []; }
    });

    const removeRecent = (cocoPath) => {
        try {
            const next = recentLoads.filter(r => r.cocoPath !== cocoPath);
            setRecentLoads(next);
            localStorage.setItem(RECENT_LOADS_KEY, JSON.stringify(next));
        } catch {}
    };

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

    const isLikelyLocalServer = React.useMemo(() => {
        const host = (window.location.hostname || '').toLowerCase();
        return host === 'localhost' || host === '127.0.0.1' || host === '::1';
    }, []);
    const collectDroppedFiles = async (dataTransfer) => {
        if (!dataTransfer) return [];
        const list = [];
        const items = Array.from(dataTransfer.items || []);
        const hasEntryApi = items.some(it => typeof it.webkitGetAsEntry === 'function');

        const walkEntry = async (entry, prefix = '') => {
            if (!entry) return;
            if (entry.isFile) {
                await new Promise((resolve) => {
                    entry.file((file) => {
                        list.push({ file, relativePath: prefix + file.name });
                        resolve();
                    }, () => resolve());
                });
                return;
            }
            if (entry.isDirectory) {
                const reader = entry.createReader();
                const readAll = () => new Promise((resolve) => {
                    const all = [];
                    const loop = () => reader.readEntries((entries) => {
                        if (!entries.length) return resolve(all);
                        all.push(...entries);
                        loop();
                    }, () => resolve(all));
                    loop();
                });
                const entries = await readAll();
                for (const sub of entries) {
                    await walkEntry(sub, `${prefix}${entry.name}/`);
                }
            }
        };

        if (hasEntryApi) {
            for (const it of items) {
                const entry = it.webkitGetAsEntry ? it.webkitGetAsEntry() : null;
                if (entry) await walkEntry(entry, '');
            }
        } else {
            const files = Array.from(dataTransfer.files || []);
            files.forEach((f) => list.push({ file: f, relativePath: f.webkitRelativePath || f.name }));
        }
        return list.filter(x => x && x.file);
    };
    const uploadDroppedFilesAsBundle = async (droppedFiles) => {
        if (!droppedFiles || droppedFiles.length === 0) return null;
        const form = new FormData();
        droppedFiles.forEach(({ file, relativePath }) => {
            form.append('files', file, file.name);
            form.append('paths', relativePath || file.name);
        });
        const res = await fetch('/api/upload_drop_bundle', { method: 'POST', body: form });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || '上传失败');
        return data.root_path || '';
    };
    const handleDrop = async (e) => {
        e.preventDefault();
        const dt = e.dataTransfer;
        const droppedFiles = await collectDroppedFiles(dt);
        const rawTextPath = ((dt && (dt.getData('text/uri-list') || dt.getData('text/plain') || dt.getData('text'))) || '').trim();
        const textPath = rawTextPath.startsWith('file://') ? decodeURIComponent(rawTextPath.replace(/^file:\/\//, '')) : rawTextPath;
        if (isLikelyLocalServer) {
            if (textPath) {
                setRootPath(textPath);
                return;
            }
            const localFile = droppedFiles[0]?.file;
            if (localFile && localFile.path) {
                const p = String(localFile.path || '');
                const dir = p.includes('/') || p.includes('\\') ? p.replace(/[\\/][^\\/]*$/, '') : p;
                if (dir) setRootPath(dir);
                return;
            }
            // 某些浏览器不会暴露本地拖拽路径；本地模式下也兜底为上传后回填服务端路径
            try {
                if (droppedFiles.length > 0) {
                    const uploadedRoot = await uploadDroppedFilesAsBundle(droppedFiles);
                    if (uploadedRoot) {
                        setRootPath(uploadedRoot);
                        return;
                    }
                }
            } catch (err) {
                alert('拖拽处理失败: ' + (err?.message || err));
                return;
            }
            alert('未读取到本地路径，也未上传成功，请直接粘贴目录路径。');
            return;
        }
        try {
            if (droppedFiles.length > 0) {
                const uploadedRoot = await uploadDroppedFilesAsBundle(droppedFiles);
                if (uploadedRoot) {
                    setRootPath(uploadedRoot);
                    return;
                }
            }
            if (textPath) {
                setRootPath(textPath);
                return;
            }
            alert('远程模式下请拖入文件/目录以便上传，或手动输入服务器路径。');
        } catch (err) {
            alert('拖拽上传失败: ' + (err?.message || err));
        }
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
                <div className="load-header-area">
                    {recentLoads.length > 0 && (
                        <div className="load-recent-quick">
                            <select 
                                className="load-recent-select" 
                                onChange={(e) => {
                                    if (!e.target.value) return;
                                    const idx = parseInt(e.target.value, 10);
                                    const r = recentLoads[idx];
                                    if (r) {
                                        if (r.type === 'merged' && r.items) onLoadMerged(r.items, r.name, r.cocoPath);
                                        else onLoad(r.cocoPath, r.imageDir || '', r.name);
                                    }
                                    e.target.value = "";
                                }}
                                defaultValue=""
                            >
                                <option value="" disabled>⏱️ 快速选择最近数据集...</option>
                                {recentLoads.map((r, i) => (
                                    <option key={i} value={i} title={r.cocoPath}>
                                        {r.name} ({r.type === 'merged' ? '多' : '单'}) - {r.cocoPath.split(/[/\\]/).pop()}
                                    </option>
                                ))}
                            </select>
                            <button
                                title="清空历史记录"
                                onClick={() => {
                                    if (window.confirm('确定要清空最近加载历史吗？')) {
                                        localStorage.removeItem(RECENT_LOADS_KEY);
                                        setRecentLoads([]);
                                    }
                                }}
                                className="load-btn-secondary"
                                style={{ padding: '7px 10px', fontSize: '13px', borderRadius: '8px', cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg-base)' }}
                            >清空</button>
                        </div>
                    )}
                    
                <div className="load-title-row">
                    <img src="/static/logo.png" alt="" className="load-logo" />
                    <h1 className="load-title">{config.appName || lp.title}</h1>
                </div>
                    <div className="load-subtitle">专业的计算机视觉数据查看、修正与评估工具</div>
                    
                    <div className="load-tabs">
                        <div className={`load-tab ${loadTab === 'scan' ? 'active' : ''}`} onClick={() => setLoadTab('scan')}>📁 多目录合并扫描</div>
                        <div className={`load-tab ${loadTab === 'single' ? 'active' : ''}`} onClick={() => setLoadTab('single')}>📄 单文件精准加载</div>
                    </div>
                </div>

                <div className="load-body-area">
                    {loadTab === 'scan' && (
                <div className="load-section">
                            <p className="load-section-desc">约定：自动扫描指定目录及其子目录下的 <code>_annotations.coco.json</code> 文件。支持拖入或粘贴路径。</p>
                    <div className="load-field">
                        <label className="load-label">根目录路径</label>
                        <div className="load-path-row">
                            <div
                                        className="load-drop-zone"
                                onDrop={handleDrop}
                                onDragOver={(e) => e.preventDefault()}
                                onPaste={handlePaste}
                                style={{ flex: 1 }}
                            >
                                        <div className="drop-zone-icon">📥</div>
                                        <div className="load-drop-zone-text">{isLikelyLocalServer ? '拖拽目录到此处，自动提取本地路径' : '拖拽目录/文件到此处，自动上传到服务器'}</div>
                                <input
                                    type="text"
                                    value={rootPath}
                                    onChange={(e) => setRootPath(e.target.value)}
                                    placeholder="例如 D:\data\coco_root 或 /path/to/root"
                                            className="load-input"
                                />
                            </div>
                                    <button type="button" className="load-btn load-btn-secondary" onClick={() => setShowPathPicker(true)} title="弹窗选择路径" style={{marginTop: 0, padding: '0 24px', borderRadius: '12px'}}>浏览目录...</button>
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
                                <button type="button" className="load-btn" onClick={handleScan} disabled={scanning} style={{flex: 1}}>
                                    {scanning ? '正在深度扫描中...' : '开始扫描'}
                        </button>
                            </div>
                            
                        {scanItems.length > 0 && (
                                <div className="load-scan-results">
                                    <div className="load-scan-list-header">
                                        已发现 {scanItems.length} 个标注目录
                                        {scanItems.some(it => it.auto_created) && (
                                            <span className="load-scan-header-note">
                                                （含 {scanItems.filter(it => it.auto_created).length} 个自动创建的数据集）
                                </span>
                        )}
                    </div>
                                    <div className="load-scan-scroll">
                            {scanItems.map((item, i) => (
                                            <div
                                                key={i}
                                                className={`load-scan-item ${selectedIndices.has(i) ? 'load-scan-item-selected' : ''}`}
                                            >
                                                <label className="load-scan-item-main">
                                                    <input type="checkbox" checked={selectedIndices.has(i)} onChange={() => toggleItem(i)} className="load-scan-checkbox" />
                                        <span className="load-scan-rel">{item.relative_path || '(根)'}</span>
                                                    {item.auto_created && (
                                                        <span
                                                            className="load-scan-badge-auto"
                                                            title={`该目录含 ${item.num_images ?? '?'} 张图片，已自动创建 _annotations.coco.json`}
                                                        >
                                                            自动创建 · {item.num_images ?? '?'} 张
                                                        </span>
                                                    )}
                                                    <span className="load-scan-path" title={item.coco_path}>{item.coco_path.split(/[/\\]/).pop()}</span>
                                    </label>
                                                <div className="load-scan-item-actions">
                                                    <button type="button" className="load-btn-xs load-btn-secondary" onClick={() => handleLoadSingleFromScanItem(item)} disabled={loading} title="仅加载此目录的 COCO 文件">
                                                        单项加载
                                    </button>
                                    {item.loader_record && (
                                                        <button type="button" className="load-btn-xs load-btn-secondary load-btn-last" onClick={() => handleLoadLastFromScanItem(item)} disabled={loading}>
                                            加载上次
                                        </button>
                                    )}
                                                </div>
                                </div>
                            ))}
                                    </div>
                                    <div className="load-scan-footer">
                                        <div className="load-scan-footer-row">
                                            <button type="button" className="load-btn-secondary load-scan-select-toggle" onClick={toggleSelectAll}>
                                                {selectedIndices.size === scanItems.length ? '取消全选' : '全选'}
                                            </button>
                                            <div className="load-scan-merged-field">
                                                <label htmlFor="load-merged-dataset-name">合并后名称</label>
                                                <input
                                                    id="load-merged-dataset-name"
                                                    type="text"
                                                    value={datasetName}
                                                    onChange={(e) => setDatasetName(e.target.value)}
                                                    placeholder="merged_dataset"
                                                    className="load-input load-scan-merged-input"
                                                />
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className="load-btn load-scan-load-merged"
                                            onClick={handleLoadMerged}
                                            disabled={loading || selectedIndices.size === 0}
                                        >
                                            {loading ? '加载中...' : `加载选中 (${selectedIndices.size})`}
                                        </button>
                                    </div>
                        </div>
                    )}
                </div>
                    )}

                    {loadTab === 'single' && (
                <div className="load-section">
                            <p className="load-section-desc">直接提供精确的 JSON 路径和图片目录进行加载，适用于标准独立的 COCO 数据集。</p>
                    <form onSubmit={handleSubmit}>
                        <div className="load-field">
                            <label className="load-label">{lp.cocoPathLabel}</label>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input className="load-input" type="text" value={cocoPath} onChange={(e) => setCocoPath(e.target.value)} placeholder={lp.cocoPathPlaceholder || '/path/to/annotations.json 或 COCO 所在目录'} style={{ flex: 1 }} />
                                        <button type="button" className="load-btn load-btn-secondary" style={{width: 'auto', margin: 0, padding: '14px 20px', whiteSpace: 'nowrap'}} onClick={handleDetectLastRecord} title="从该路径（目录或文件）读取上次加载记录并填充">检测记录</button>
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
                                <button className="load-btn" type="submit" disabled={loading} style={{marginTop: '30px'}}>
                                    {loading ? '正在加载数据...' : lp.loadButtonText}
                        </button>
                    </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ==================== AI Chat 系统（Agent 模式） ====================

// 解析消息文本，分割为「普通文本段」和「代码块段」
function parseMessageBlocks(text) {
    const blocks = [];
    const codeRe = /```(\w*)\n?([\s\S]*?)```/g;
    let lastIndex = 0;
    let m;
    while ((m = codeRe.exec(text)) !== null) {
        if (m.index > lastIndex) {
            blocks.push({ type: 'text', content: text.slice(lastIndex, m.index) });
        }
        blocks.push({ type: 'code', lang: m[1] || 'text', content: m[2] });
        lastIndex = m.index + m[0].length;
    }
    if (lastIndex < text.length) {
        blocks.push({ type: 'text', content: text.slice(lastIndex) });
    }
    return blocks;
}

// 内联 Markdown 渲染（粗体/斜体/行内代码/链接/删除线）
function renderInlineMarkdown(text) {
    return text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.*?)__/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/_(.*?)_/g, '<em>$1</em>')
        .replace(/~~(.*?)~~/g, '<del>$1</del>')
        .replace(/`([^`]+)`/g, '<code class="chat-inline-code">$1</code>')
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

// 渲染一段普通文本（支持标题/有序列表/无序列表/引用/分隔线）
function ChatTextBlock({ content }) {
    const lines = content.split('\n');
    const elements = [];
    let listItems = null;
    let listType = null; // 'ul' | 'ol'

    const flushList = () => {
        if (!listItems) return;
        const Tag = listType;
        elements.push(<Tag key={`list-${elements.length}`} className="chat-list">{listItems}</Tag>);
        listItems = null;
        listType = null;
    };

    lines.forEach((line, i) => {
        const trimmed = line.trim();

        // 分隔线
        if (/^(-{3,}|={3,}|\*{3,})$/.test(trimmed)) {
            flushList();
            elements.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' }} />);
            return;
        }
        // 标题
        if (/^#{1,6}\s/.test(line)) {
            flushList();
            const lvl = line.match(/^(#+)/)[1].length;
            const txt = line.replace(/^#+\s*/, '');
            const Tag = `h${Math.min(lvl + 2, 6)}`;
            elements.push(<Tag key={i} className={`chat-heading chat-h${lvl}`}
                dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(txt) }} />);
            return;
        }
        // 引用块
        if (/^>\s/.test(line)) {
            flushList();
            const txt = line.replace(/^>\s*/, '');
            elements.push(
                <blockquote key={i} style={{ borderLeft: '3px solid var(--accent)', paddingLeft: '10px', margin: '4px 0', color: 'var(--text-muted)', fontStyle: 'italic' }}
                    dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(txt) }} />
            );
            return;
        }
        // 无序列表
        if (/^[-*+]\s/.test(trimmed)) {
            if (listType !== 'ul') { flushList(); listType = 'ul'; listItems = []; }
            const txt = trimmed.replace(/^[-*+]\s/, '');
            listItems.push(<li key={i} dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(txt) }} />);
            return;
        }
        // 有序列表
        if (/^\d+[.)]\s/.test(trimmed)) {
            if (listType !== 'ol') { flushList(); listType = 'ol'; listItems = []; }
            const txt = trimmed.replace(/^\d+[.)]\s/, '');
            listItems.push(<li key={i} dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(txt) }} />);
            return;
        }
        // 空行
        if (trimmed === '') {
            flushList();
            if (elements.length > 0) elements.push(<div key={i} style={{ height: '5px' }} />);
            return;
        }
        // 普通段落
        flushList();
        elements.push(<p key={i} className="chat-p"
            dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(line) }} />);
    });
    flushList();
    return <>{elements}</>;
}

// 与图库「代码筛选」共用：POST /api/chat/run_code，解析结果
async function runGalleryPythonCode(code, datasetId) {
    try {
        const res = await fetch('/api/chat/run_code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, dataset_id: datasetId })
        });
        let d;
        try {
            d = await res.json();
        } catch {
            return { ok: false, error: '响应解析失败' };
        }
        if (!res.ok) {
            return { ok: false, error: typeof d.error === 'string' ? d.error : (d.error || '执行失败') };
        }
        if (d.success) {
            if (d.type === 'filter') {
                const ids = d.image_ids || [];
                return {
                    ok: true,
                    type: 'filter',
                    image_ids: ids,
                    count: d.count != null ? d.count : ids.length,
                    output: d.output || ''
                };
            }
            return { ok: true, type: 'report', output: d.output || '' };
        }
        return { ok: false, error: d.error || '执行失败' };
    } catch (e) {
        return { ok: false, error: String(e) };
    }
}

const GALLERY_CODE_FILTER_DEFAULT = `# 最后一行表达式为 image_id 列表时，将应用为图库筛选（与 Agent 中 Python 代码块相同）
find_images(gt_min=1, gt_max=None, pred_min=None, pred_max=None)
`;

const GALLERY_CODE_FILTER_STORAGE_KEY = 'coco_gallery_code_filter_v1';
const GALLERY_CODE_REPORT_MAX_CHARS = 16000;

function truncateGalleryReportOutput(text) {
    const s = text == null ? '' : String(text);
    if (s.length <= GALLERY_CODE_REPORT_MAX_CHARS) return s;
    return `${s.slice(0, GALLERY_CODE_REPORT_MAX_CHARS)}\n\n…（输出过长，已截断；调试用请缩小 print 范围或只打印 len(images) 等）`;
}

function GalleryCodeFilterModal({ onClose, datasetId, onFilterByIds }) {
    const [code, setCode] = useState(() => {
        try {
            const s = localStorage.getItem(GALLERY_CODE_FILTER_STORAGE_KEY);
            return (s && s.trim()) ? s : GALLERY_CODE_FILTER_DEFAULT;
        } catch {
            return GALLERY_CODE_FILTER_DEFAULT;
        }
    });
    const [running, setRunning] = useState(false);
    const [runResult, setRunResult] = useState(null);

    useEffect(() => {
        try {
            localStorage.setItem(GALLERY_CODE_FILTER_STORAGE_KEY, code);
        } catch { /* ignore */ }
    }, [code]);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const runFilter = async () => {
        if (running || !datasetId) return;
        setRunning(true);
        setRunResult(null);
        try {
            const r = await runGalleryPythonCode(code, datasetId);
            if (!r.ok) {
                setRunResult({ ok: false, msg: r.error });
            } else if (r.type === 'filter') {
                if (r.image_ids && r.image_ids.length > 0) {
                    onFilterByIds && onFilterByIds(r.image_ids, `图库代码筛选（${r.count} 张）`);
                    onClose();
                } else {
                    setRunResult({ ok: true, type: 'filter', count: 0, msg: '没有符合条件的图片' });
                }
            } else {
                setRunResult({
                    ok: true,
                    type: 'report',
                    output: truncateGalleryReportOutput(r.output)
                });
            }
        } catch (e) {
            setRunResult({ ok: false, msg: String(e) });
        }
        setRunning(false);
    };

    return (
        <div className="modal-overlay gallery-code-filter-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal-content gallery-code-filter-modal" role="dialog" aria-labelledby="gallery-code-filter-title" aria-modal="true" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header gallery-code-filter-modal-header">
                    <div>
                        <h3 id="gallery-code-filter-title" style={{ margin: 0 }}>代码筛选</h3>
                        <p className="gallery-code-filter-modal-sub">
                            与 Agent 中 Python 代码块相同环境；最后一行表达式为 <code>image_id</code> 列表时应用图库筛选
                        </p>
                    </div>
                    <button type="button" className="modal-close" onClick={onClose} aria-label="关闭">✕</button>
                </div>
                <div className="modal-body gallery-code-filter-modal-body">
                    <div className="gallery-code-filter-toolbar">
                        <button type="button" className="chat-code-btn chat-code-btn-run" onClick={runFilter} disabled={running || !datasetId} title="执行代码；筛选成功后将关闭此窗口">
                            {running ? '⏳ 运行中' : '▶ 运行筛选'}
                        </button>
                        <button type="button" className="chat-code-btn" onClick={() => { setCode(GALLERY_CODE_FILTER_DEFAULT); setRunResult(null); }} title="恢复默认示例代码">
                            重置示例
                        </button>
                        <span className="gallery-code-filter-hint">提示：调试大数据请用 <code>len(images)</code>、切片等，避免 <code>print(images)</code> 整表刷屏</span>
                    </div>
                    <label className="gallery-code-filter-label" htmlFor="gallery-code-filter-editor">Python</label>
                    <textarea
                        id="gallery-code-filter-editor"
                        className="gallery-code-filter-editor"
                        value={code}
                        onChange={e => setCode(e.target.value)}
                        spellCheck={false}
                        rows={10}
                    />
                    {runResult && (
                        <div className={`gallery-code-filter-output ${runResult.ok ? 'ok' : 'err'}`}>
                            <div className="gallery-code-filter-output-title">输出</div>
                            {!runResult.ok && <pre className="gallery-code-filter-output-pre">{truncateGalleryReportOutput(runResult.msg)}</pre>}
                            {runResult.ok && runResult.type === 'filter' && (
                                runResult.count > 0
                                    ? <p className="gallery-code-filter-output-line">✅ 已应用筛选，共 {runResult.count} 张{runResult.output ? ` · ${runResult.output}` : ''}</p>
                                    : <p className="gallery-code-filter-output-line">ℹ️ {runResult.msg}</p>
                            )}
                            {runResult.ok && runResult.type === 'report' && (
                                <pre className="gallery-code-filter-output-pre">{runResult.output}</pre>
                            )}
                        </div>
                    )}
                    <details className="gallery-code-filter-docs">
                        <summary>内置对象与函数（与 Agent 代码块一致）</summary>
                        <ul>
                            <li><code>images</code>：当前数据集中每张图的字典列表，含 <code>image_id</code>、<code>file_name</code>、<code>annotations</code>、<code>pred_annotations</code> 等。</li>
                            <li><code>coco_json_path</code>、<code>images_dir</code>：当前 COCO 与图片目录路径（字符串）。</li>
                            <li><code>find_images(gt_min, gt_max, pred_min, pred_max, categories, score_min, score_max)</code>：多条件筛图，返回 <code>image_id</code> 列表。</li>
                            <li><code>hard_cases(score_low, score_high, min_pred)</code>：疑难样本（预测分数落在区间内的框）。</li>
                            <li><code>coco_overview()</code>、<code>category_stats(source)</code>（<code>gt</code>|<code>pred</code>）、<code>bbox_stats()</code>：统计摘要。</li>
                            <li><code>filter_gallery(ids, description)</code>：推送筛选并跳转图库（聊天侧常用）。</li>
                            <li><code>export_coco</code> / <code>export_csv</code> / <code>export_json</code> / <code>export_txt</code>：导出。</li>
                            <li><code>show_chart</code>、<code>show_table</code>、<code>navigate_to</code> 等：界面联动（筛选面板以返回列表为主）。</li>
                            <li>最后一行<strong>表达式</strong>为 <code>image_id</code> 列表时，结果按「筛选」处理；否则为报告输出。亦可设置变量 <code>result</code>。</li>
                        </ul>
                    </details>
                </div>
                <div className="modal-footer gallery-code-filter-modal-footer">
                    <button type="button" className="vbtn vbtn-neutral" onClick={onClose}>关闭</button>
                </div>
            </div>
        </div>
    );
}

// 代码块：带语言标签 + 复制 + 运行筛选按钮
function ChatCodeBlock({ lang, code, datasetId, onFilterByIds }) {
    const [copied, setCopied] = useState(false);
    const [running, setRunning] = useState(false);
    const [runResult, setRunResult] = useState(null);
    const isPython = lang === 'python' || lang === 'py';

    const copyCode = () => {
        navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const runFilter = async () => {
        if (running) return;
        setRunning(true);
        setRunResult(null);
        try {
            const r = await runGalleryPythonCode(code, datasetId);
            if (!r.ok) {
                setRunResult({ ok: false, msg: r.error });
            } else if (r.type === 'filter') {
                if (r.image_ids && r.image_ids.length > 0) {
                    setRunResult({ ok: true, type: 'filter', count: r.count, output: r.output });
                    onFilterByIds && onFilterByIds(r.image_ids, `AI 代码筛选结果（${r.count} 张）`);
                } else {
                    setRunResult({ ok: true, type: 'filter', count: 0, msg: '没有符合条件的图片' });
                }
            } else {
                setRunResult({ ok: true, type: 'report', output: r.output });
            }
        } catch (e) {
            setRunResult({ ok: false, msg: String(e) });
        }
        setRunning(false);
    };

    return (
        <div className="chat-code-block">
            <div className="chat-code-header">
                <span className="chat-code-lang">{lang || 'code'}</span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {isPython && (
                        <button className="chat-code-btn chat-code-btn-run" onClick={runFilter} disabled={running} title="在图库中运行筛选">
                            {running ? '⏳' : '▶'} {running ? '运行中' : '运行筛选'}
                        </button>
                    )}
                    <button className="chat-code-btn" onClick={copyCode} title="复制代码">
                        {copied ? '✓ 已复制' : '复制'}
                    </button>
                </div>
            </div>
            <pre className="chat-code-pre"><code>{code}</code></pre>
            {runResult && (
                <div className={`chat-code-result ${runResult.ok ? 'ok' : 'err'}`}>
                    {!runResult.ok && <span>✗ {runResult.msg}</span>}
                    {runResult.ok && runResult.type === 'filter' && (
                        runResult.count > 0
                            ? <span>✅ 已跳转图库，共 {runResult.count} 张图片{runResult.output ? `（${runResult.output}）` : ''}</span>
                            : <span>ℹ️ {runResult.msg}</span>
                    )}
                    {runResult.ok && runResult.type === 'report' && (
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '12px' }}>
                            {runResult.output}
                        </pre>
                    )}
                </div>
            )}
        </div>
    );
}

// 完整消息渲染器（文本 + 代码块混排）
function ChatMessageRenderer({ content, datasetId, onFilterByIds }) {
    const blocks = parseMessageBlocks(content);
    return (
        <div className="chat-msg-content">
            {blocks.map((b, i) =>
                b.type === 'code'
                    ? <ChatCodeBlock key={i} lang={b.lang} code={b.content} datasetId={datasetId} onFilterByIds={onFilterByIds} />
                    : <ChatTextBlock key={i} content={b.content} />
            )}
        </div>
    );
}

// 快捷提问建议
const CHAT_SUGGESTIONS = [
    '按条件筛选并打包数据集（先预览，再导出 zip）',
    '将筛选结果导出为 zip，标注文件固定为 _annotations.coco.json',
    '把统计结果做成图表并显示明细表格',
    '统计各类别的标注框数量',
    '找出标注框数量超过10个的图片',
    '筛选出没有任何标注的图片',
    '找出包含面积小于100像素的目标的图片',
    '分析数据集的类别分布是否均衡',
    '找出宽高比大于5的细长框',
];

// Agent 消息气泡 — 渲染一条 assistant 消息（含思考步骤、代码执行、最终结论）
// ── Chart 渲染组件（Chart.js via CDN）────────────────────────────────────────
function AgentChart({ chart }) {
    const canvasRef = useRef(null);
    const chartRef = useRef(null);
    const containerId = useRef('chart_' + Math.random().toString(36).slice(2));

    useEffect(() => {
        if (!chart || !canvasRef.current) return;

        const COLORS = ['#4e79a7','#f28e2b','#e15759','#76b7b2','#59a14f',
                         '#edc948','#b07aa1','#ff9da7','#9c755f','#bab0ac'];

        const buildDatasets = () => {
            return (chart.datasets || []).map((ds, di) => {
                const bg = ds.backgroundColor || (
                    ['pie','doughnut','radar'].includes(chart.chart_type)
                        ? (chart.labels || []).map((_, li) => COLORS[li % COLORS.length])
                        : COLORS[di % COLORS.length]
                );
                return { ...ds, backgroundColor: bg, borderColor: typeof bg === 'string' ? bg : undefined, borderWidth: 1 };
            });
        };

        const loadChart = () => {
            if (window.Chart) {
                if (chartRef.current) { chartRef.current.destroy(); }
                chartRef.current = new window.Chart(canvasRef.current, {
                    type: chart.chart_type || 'bar',
                    data: { labels: chart.labels || [], datasets: buildDatasets() },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: {
                            legend: { display: (chart.datasets || []).length > 1 || ['pie','doughnut'].includes(chart.chart_type) },
                            title: chart.title ? { display: true, text: chart.title, font: { size: 13 } } : { display: false },
                        },
                        scales: ['pie','doughnut','radar'].includes(chart.chart_type) ? {} : {
                            x: { ticks: { maxRotation: 45 } },
                            y: { beginAtZero: true },
                        },
                    },
                });
            } else {
                // 动态加载 Chart.js
                const s = document.createElement('script');
                s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js';
                s.onload = loadChart;
                document.head.appendChild(s);
            }
        };
        loadChart();
        return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
    }, [chart]);

    if (!chart) return null;
    return (
        <div className="agent-chart-wrap">
            <canvas ref={canvasRef} style={{ maxHeight: '280px' }} />
        </div>
    );
}

function AgentTable({ table }) {
    const [open, setOpen] = useState(false);
    const rows = Array.isArray(table?.rows) ? table.rows : [];
    const cols = rows.length > 0 && typeof rows[0] === 'object'
        ? Object.keys(rows[0])
        : ['value'];
    const previewRows = rows.slice(0, 8);

    return (
        <div className="agent-chart-wrap">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <strong>{table?.title || '数据预览'}</strong>
                <button className="chat-code-btn" onClick={() => setOpen(true)}>
                    查看详情 ({table?.total_rows || rows.length} 行)
                </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                        <tr>{cols.map(c => <th key={c} style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '6px 8px' }}>{c}</th>)}</tr>
                    </thead>
                    <tbody>
                        {previewRows.map((r, i) => (
                            <tr key={i}>
                                {cols.map(c => <td key={c} style={{ borderBottom: '1px solid var(--border)', padding: '6px 8px' }}>{String(r?.[c] ?? '')}</td>)}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {open && (
                <div className="modal-overlay" onClick={() => setOpen(false)}>
                    <div className="modal-content" style={{ maxWidth: '980px', width: '92vw', maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{table?.title || '数据预览'}（{table?.total_rows || rows.length} 行）</h3>
                            <button className="modal-close" onClick={() => setOpen(false)}>✕</button>
                        </div>
                        <div style={{ padding: 12, overflow: 'auto', maxHeight: '72vh' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                <thead>
                                    <tr>{cols.map(c => <th key={c} style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '8px 10px', position: 'sticky', top: 0, background: 'var(--bg-soft)' }}>{c}</th>)}</tr>
                                </thead>
                                <tbody>
                                    {rows.map((r, i) => (
                                        <tr key={i}>
                                            {cols.map(c => <td key={c} style={{ borderBottom: '1px solid var(--border)', padding: '7px 10px' }}>{String(r?.[c] ?? '')}</td>)}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function AgentBubble({ msg, datasetId, onFilterByIds, onAdoptCodeTemplate, isStreaming }) {
    const [codeExpanded, setCodeExpanded] = useState({});
    const toggleCode = (i) => setCodeExpanded(p => ({ ...p, [i]: !p[i] }));
    const getFilterActions = (result) => (
        (result?.ui_actions || []).filter(
            a => a?.type === 'filter_gallery' && Array.isArray(a.image_ids) && a.image_ids.length > 0
        )
    );

    // 渲染执行结果内的文件下载列表
    const renderFiles = (files) => {
        if (!files || files.length === 0) return null;
        return (
            <div className="agent-file-list">
                {files.map((f, fi) => (
                    <a key={fi} href={`/api/chat/download/${f.file_id}`} download={f.filename}
                        className="agent-file-chip" target="_blank" rel="noreferrer">
                        📄 {f.filename}
                    </a>
                ))}
            </div>
        );
    };

    return (
        <div className="agent-bubble">
            {(msg.steps || []).map((step, i) => (
                <div key={i} className={`agent-step ${step.type}`}>
                    {step.type === 'status' && (
                        <span className="agent-step-status">{step.msg}</span>
                    )}
                    {step.type === 'search_result' && (
                        <div className="agent-search-wrap">
                            <div className="agent-code-header">
                                <span>🌐 搜索：{step.query}</span>
                            </div>
                            <pre className="agent-exec-output" style={{ maxHeight: '150px' }}>{step.result}</pre>
                        </div>
                    )}
                    {step.type === 'code' && (
                        <div className="agent-code-wrap">
                            <div className="agent-code-header" onClick={() => toggleCode(i)} style={{ cursor: 'pointer' }}>
                                <span>🐍 分析代码 {codeExpanded[i] ? '▾' : '▸'}</span>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <button
                                        className="chat-code-btn"
                                        onClick={e => {
                                            e.stopPropagation();
                                            onAdoptCodeTemplate?.(step.code || '', 'AI 生成代码模板');
                                        }}>
                                        采纳为模板
                                    </button>
                                    <button className="chat-code-btn" onClick={e => { e.stopPropagation(); navigator.clipboard?.writeText(step.code); }}>复制</button>
                                </div>
                            </div>
                            {codeExpanded[i] && <pre className="chat-code-pre" style={{ margin: 0 }}><code>{step.code}</code></pre>}
                        </div>
                    )}
                    {step.type === 'code_result' && (
                        <div className={`agent-exec-result ${step.result?.type === 'error' ? 'err' : 'ok'}`}>
                            {step.result?.type === 'filter' && (
                                <div>
                                    <span>✅ 找到 <strong>{step.result.image_ids?.length}</strong> 张图片</span>
                                    {step.result.image_ids?.length > 0 && (
                                        <button className="chat-code-btn chat-code-btn-run" style={{ marginLeft: '10px' }}
                                            onClick={() => onFilterByIds?.(step.result.image_ids, `Agent 筛选（${step.result.image_ids.length} 张）`)}>
                                            🔍 在图库查看
                                        </button>
                                    )}
                                    {step.result.output && <pre className="agent-exec-output">{step.result.output}</pre>}
                                    {renderFiles(step.result.files)}
                                </div>
                            )}
                            {step.result?.type === 'report' && (
                                <div>
                                    {getFilterActions(step.result).map((a, ai) => (
                                        <button
                                            key={ai}
                                            className="chat-code-btn chat-code-btn-run"
                                            style={{ marginBottom: 8, marginRight: 8 }}
                                            onClick={() => onFilterByIds?.(
                                                a.image_ids,
                                                a.description || `Agent 筛选（${a.image_ids.length} 张）`
                                            )}>
                                            🔍 在图库查看（{a.image_ids.length} 张）
                                        </button>
                                    ))}
                                    <pre className="agent-exec-output">{step.result.output}</pre>
                                    {renderFiles(step.result.files)}
                                </div>
                            )}
                            {step.result?.type === 'error' && (
                                <pre className="agent-exec-output err">{step.result.output}</pre>
                            )}
                        </div>
                    )}
                    {step.type === 'chart' && (
                        <AgentChart chart={step.chart} />
                    )}
                    {step.type === 'table' && (
                        <AgentTable table={step.table} />
                    )}
                </div>
            ))}
            {(msg.conclusion || isStreaming) && (
                <div className="agent-conclusion">
                    {msg.conclusion
                        ? <ChatMessageRenderer content={msg.conclusion} datasetId={datasetId} onFilterByIds={onFilterByIds} />
                        : <span className="chat-cursor-blink">▋</span>}
                    {isStreaming && msg.conclusion && <span className="chat-cursor-blink"> ▋</span>}
                </div>
            )}
        </div>
    );
}

function ChatPage({ datasetData, images, onFilterByIds,
    sessions = [], activeChatId, streamingInfo, onSendMessage,
    onNewSession, onUpdateMessages, onDeleteSession, onSwitchSession }) {

    const config = useConfig();
    const llmCfg = config.llm || {};
    const apiKey = llmCfg.apiKey || '';
    const model = llmCfg.model || 'gpt-4o-mini';

    // 当前会话的 messages 来自 sessions props（持久化在 App 层）
    const activeSession = sessions.find(s => s.id === activeChatId) || null;
    const messages = activeSession?.messages || [];

    // 当前 streaming 状态从 App 层 streamingInfo 读取
    const streaming = streamingInfo !== null;
    const activeStreamMsgId = streamingInfo?.msgId || null;

    const [input, setInput] = useState('');
    const [attachments, setAttachments] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [showSysPrompt, setShowSysPrompt] = useState(false);
    const [localSysPrompt, setLocalSysPrompt] = useState(() => llmCfg.systemPrompt || '');
    const [showCodeLibrary, setShowCodeLibrary] = useState(false);
    const [showAgentRegistry, setShowAgentRegistry] = useState(false);
    const [agentModules, setAgentModules] = useState([]);
    const [agentSkills, setAgentSkills] = useState([]);
    const [agentUploading, setAgentUploading] = useState(false);
    const [pendingRegModal, setPendingRegModal] = useState(null); // { module, selected:Set<string> }
    const [skillImportReport, setSkillImportReport] = useState([]);
    const [pinnedSkillIds, setPinnedSkillIds] = useState(() => {
        try {
            const raw = localStorage.getItem('cocovis_pinned_skill_ids');
            const a = raw ? JSON.parse(raw) : [];
            return Array.isArray(a) ? a : [];
        } catch (_) {
            return [];
        }
    });
    const [codeTemplates, setCodeTemplates] = useState(() => {
        try {
            const raw = localStorage.getItem('cocovis_chat_code_templates');
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (_) {
            return [];
        }
    });
    const [activeTemplateId, setActiveTemplateId] = useState('');
    const [templateName, setTemplateName] = useState('');
    const [templateCode, setTemplateCode] = useState('');
    const [templateRunResult, setTemplateRunResult] = useState(null);
    const [templateRunning, setTemplateRunning] = useState(false);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const fileInputRef = useRef(null);
    const agentFileInputRef = useRef(null);
    const agentSkillZipInputRef = useRef(null);
    

    // 确保进入聊天页面时至少有一个会话
    useEffect(() => {
        if (!activeChatId || !sessions.find(s => s.id === activeChatId)) {
            if (sessions.length > 0) {
                onSwitchSession(sessions[0].id);
            } else {
                onNewSession();
            }
        }
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        try {
            localStorage.setItem('cocovis_chat_code_templates', JSON.stringify(codeTemplates));
        } catch (_) {
            // ignore quota errors
        }
    }, [codeTemplates]);

    useEffect(() => {
        try {
            localStorage.setItem('cocovis_pinned_skill_ids', JSON.stringify(pinnedSkillIds));
        } catch (_) {
            // ignore
        }
    }, [pinnedSkillIds]);

    const togglePinSkill = useCallback((skillId) => {
        if (!skillId) return;
        setPinnedSkillIds((prev) => {
            const next = new Set(prev);
            if (next.has(skillId)) next.delete(skillId);
            else next.add(skillId);
            return Array.from(next);
        });
    }, []);

    // 更新当前会话 messages（供 clearCurrentChat 等本地操作使用）
    const setMessages = useCallback((updater) => {
        if (!activeChatId) return;
        onUpdateMessages(activeChatId, typeof updater === 'function' ? updater(messages) : updater);
    }, [activeChatId, messages, onUpdateMessages]);

    // ── 文件上传处理 ──────────────────────────────────────
    const handleFileSelect = async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        setUploading(true);
        const results = [];
        for (const file of files) {
            const fd = new FormData();
            fd.append('file', file);
            try {
                const res = await fetch('/api/chat/upload', { method: 'POST', body: fd });
                const data = await res.json();
                if (data.error) {
                    alert(`上传失败：${data.error}`);
                } else {
                    results.push(data);
                }
            } catch (err) {
                alert(`上传失败：${err.message}`);
            }
        }
        setAttachments(prev => [...prev, ...results]);
        setUploading(false);
        // 清空 input 值以允许重复选同一文件
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeAttachment = (i) => setAttachments(prev => prev.filter((_, idx) => idx !== i));

    // sendMessage 现在委托给 App 层的 onSendMessage
    const sendMessage = (text) => {
        const content = (text || input).trim();
        if (!content || streaming) return;
        setInput('');
        const sentAttachments = [...attachments];
        setAttachments([]);
        onSendMessage(content, sentAttachments, activeChatId, localSysPrompt, pinnedSkillIds);
    };

    const handleInputChange = (e) => {
        const val = e.target.value;
        setInput(val);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    };
    const clearCurrentChat = () => {
        if (messages.length === 0 || window.confirm('确定清空当前对话记录？')) {
            if (activeChatId) onUpdateMessages(activeChatId, []);
        }
    };
    const deleteCurrentSession = () => {
        if (!activeChatId) return;
        if (window.confirm('确定删除此对话？')) onDeleteSession(activeChatId);
    };

    const datasetId = datasetData?.dataset_id;
    const activeTemplate = codeTemplates.find(t => t.id === activeTemplateId) || null;

    const resetTemplateEditor = useCallback(() => {
        setActiveTemplateId('');
        setTemplateName('');
        setTemplateCode('');
        setTemplateRunResult(null);
    }, []);

    const chooseTemplate = useCallback((id) => {
        const tpl = codeTemplates.find(t => t.id === id);
        if (!tpl) return;
        setActiveTemplateId(tpl.id);
        setTemplateName(tpl.name || '');
        setTemplateCode(tpl.code || '');
        setTemplateRunResult(null);
    }, [codeTemplates]);

    const saveTemplate = useCallback(() => {
        const code = (templateCode || '').trim();
        if (!code) {
            alert('代码不能为空');
            return;
        }
        const name = (templateName || '').trim() || '未命名代码块';
        const now = Date.now();
        if (activeTemplate) {
            setCodeTemplates(prev => prev.map(t => (
                t.id === activeTemplate.id
                    ? { ...t, name, code: templateCode, updatedAt: now }
                    : t
            )));
        } else {
            const id = `tpl_${now}_${Math.random().toString(36).slice(2, 7)}`;
            const next = { id, name, code: templateCode, createdAt: now, updatedAt: now };
            setCodeTemplates(prev => [next, ...prev]);
            setActiveTemplateId(id);
        }
        setTemplateRunResult(null);
    }, [activeTemplate, templateCode, templateName]);

    const removeTemplate = useCallback(() => {
        if (!activeTemplate) return;
        if (!window.confirm(`确认删除模板「${activeTemplate.name}」？`)) return;
        setCodeTemplates(prev => prev.filter(t => t.id !== activeTemplate.id));
        resetTemplateEditor();
    }, [activeTemplate, resetTemplateEditor]);

    const runTemplateCode = useCallback(async () => {
        const code = (templateCode || '').trim();
        if (!code) {
            alert('请先输入要执行的代码');
            return;
        }
        if (!datasetId) {
            alert('请先加载数据集');
            return;
        }
        setTemplateRunning(true);
        setTemplateRunResult(null);
        try {
            const res = await fetch('/api/chat/run_code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, dataset_id: datasetId }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.error) {
                setTemplateRunResult({ ok: false, error: data.error || `执行失败（${res.status}）` });
                return;
            }
            setTemplateRunResult({ ok: true, data });
        } catch (err) {
            setTemplateRunResult({ ok: false, error: err?.message || '执行失败' });
        } finally {
            setTemplateRunning(false);
        }
    }, [datasetId, templateCode]);

    const adoptAgentCodeTemplate = useCallback((code, defaultName) => {
        const safeCode = String(code || '').trim();
        if (!safeCode) return;
        setShowCodeLibrary(true);
        setActiveTemplateId('');
        setTemplateName(defaultName || 'AI 采纳模板');
        setTemplateCode(safeCode);
        setTemplateRunResult(null);
    }, []);

    const loadAgentModules = useCallback(async () => {
        try {
            const [res1, res2] = await Promise.all([
                fetch('/api/agent_modules'),
                fetch('/api/agent_skills'),
            ]);
            const d1 = await res1.json().catch(() => ({}));
            const d2 = await res2.json().catch(() => ({}));
            if (!res1.ok || d1.error) throw new Error(d1.error || `加载模块失败（${res1.status}）`);
            if (!res2.ok || d2.error) throw new Error(d2.error || `加载skills失败（${res2.status}）`);
            setAgentModules(Array.isArray(d1.modules) ? d1.modules : []);
            setAgentSkills(Array.isArray(d2.skills) ? d2.skills : []);
        } catch (err) {
            alert(`加载自定义 Agent 模块失败：${err?.message || err}`);
        }
    }, []);

    useEffect(() => {
        if (showAgentRegistry) loadAgentModules();
    }, [showAgentRegistry, loadAgentModules]);

    useEffect(() => {
        if (!agentSkills.length) return;
        const valid = new Set(agentSkills.map((s) => s.id).filter(Boolean));
        setPinnedSkillIds((prev) => {
            const next = prev.filter((id) => valid.has(id));
            return next.length === prev.length ? prev : next;
        });
    }, [agentSkills]);

    const confirmRegisterAgentModule = useCallback(async (m) => {
        const candidates = Array.isArray(m?.register_candidates) ? m.register_candidates : [];
        if (!candidates.length) {
            alert('未检测到可注册函数');
            return;
        }
        const names = candidates.map(c => c?.name).filter(Boolean);
        const selected = new Set(names);
        setPendingRegModal({ module: m, selected });
    }, []);

    const submitPendingRegistration = useCallback(async () => {
        if (!pendingRegModal?.module) return;
        const selected = Array.from(pendingRegModal.selected || []);
        if (!selected.length) {
            alert('请至少选择一个方法');
            return;
        }
        try {
            const res = await fetch(`/api/agent_modules/${pendingRegModal.module.id}/register_functions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ functions: selected }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.error) throw new Error(data.error || `注册失败（${res.status}）`);
            setPendingRegModal(null);
            await loadAgentModules();
        } catch (err) {
            alert(`注册失败：${err?.message || err}`);
        }
    }, [loadAgentModules, pendingRegModal]);

    const uploadAgentModule = useCallback(async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!String(file.name || '').toLowerCase().endsWith('.py')) {
            alert('仅支持上传 .py 脚本');
            e.target.value = '';
            return;
        }
        setAgentUploading(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const name = file.name.replace(/\.py$/i, '');
            fd.append('name', name);
            fd.append('enabled', 'true');
            const res = await fetch('/api/agent_modules/upload', { method: 'POST', body: fd });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.error) throw new Error(data.error || `上传失败（${res.status}）`);
            if (data.need_registration && data.module) {
                setShowAgentRegistry(true);
                setTimeout(() => { confirmRegisterAgentModule(data.module); }, 50);
            }
            await loadAgentModules();
        } catch (err) {
            alert(`上传失败：${err?.message || err}`);
        } finally {
            setAgentUploading(false);
            if (agentFileInputRef.current) agentFileInputRef.current.value = '';
        }
    }, [confirmRegisterAgentModule, loadAgentModules]);

    const importSkillZip = useCallback(async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!String(file.name || '').toLowerCase().endsWith('.zip')) {
            alert('仅支持 .zip');
            e.target.value = '';
            return;
        }
        setAgentUploading(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await fetch('/api/agent_modules/import_skill_zip', { method: 'POST', body: fd });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.error) throw new Error(data.error || `导入失败（${res.status}）`);
            setSkillImportReport(Array.isArray(data.skill_reports) ? data.skill_reports : []);
            await loadAgentModules();
        } catch (err) {
            alert(`导入 skills 失败：${err?.message || err}`);
        } finally {
            setAgentUploading(false);
            if (agentSkillZipInputRef.current) agentSkillZipInputRef.current.value = '';
        }
    }, [loadAgentModules]);

    const toggleAgentModule = useCallback(async (m) => {
        try {
            const res = await fetch(`/api/agent_modules/${m.id}/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !m.enabled }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.error) throw new Error(data.error || `操作失败（${res.status}）`);
            await loadAgentModules();
        } catch (err) {
            alert(`切换失败：${err?.message || err}`);
        }
    }, [loadAgentModules]);

    const removeAgentModule = useCallback(async (m) => {
        if (!window.confirm(`确认删除模块「${m.name || m.id}」？`)) return;
        try {
            const res = await fetch(`/api/agent_modules/${m.id}`, { method: 'DELETE' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.error) throw new Error(data.error || `删除失败（${res.status}）`);
            await loadAgentModules();
        } catch (err) {
            alert(`删除失败：${err?.message || err}`);
        }
    }, [loadAgentModules]);

    // 格式化会话时间
    const fmtTime = (ts) => {
        if (!ts) return '';
        const d = new Date(ts);
        const now = new Date();
        const diff = now - d;
        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} 分前`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
        return `${d.getMonth() + 1}/${d.getDate()}`;
    };

    return (
        <div className="chat-page">
            {/* ── 左侧会话列表 ── */}
            <div className={`chat-sessions-panel ${sidebarCollapsed ? 'collapsed' : ''}`}>
                <div className="chat-sessions-header">
                    {!sidebarCollapsed && <span className="chat-sessions-title">💬 对话记录</span>}
                    <button className="chat-session-icon-btn" title={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
                        onClick={() => setSidebarCollapsed(v => !v)}>
                        {sidebarCollapsed ? '▶' : '◀'}
                    </button>
                </div>
                {!sidebarCollapsed && (
                    <>
                        <button className="chat-new-session-btn" onClick={() => onNewSession()}
                            disabled={streaming}>
                            ✏️ 新建对话
                        </button>
                        <div className="chat-sessions-list">
                            {sessions.length === 0 && (
                                <div className="chat-sessions-empty">暂无对话记录</div>
                            )}
                            {sessions.map(sess => {
                                const isBusy = streamingInfo?.sessionId === sess.id;
                                return (
                                    <div key={sess.id}
                                        className={`chat-session-item ${sess.id === activeChatId ? 'active' : ''}`}
                                        onClick={() => onSwitchSession(sess.id)}>
                                        <div className="chat-session-title">
                                            {isBusy && <span className="chat-session-busy">⏳ </span>}
                                            {sess.title || '新对话'}
                                        </div>
                                        <div className="chat-session-meta">{fmtTime(sess.updatedAt)}</div>
                                        <button className="chat-session-del"
                                            onClick={e => { e.stopPropagation(); onDeleteSession(sess.id); }}
                                            title="删除对话">×</button>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            {/* ── 右侧聊天区域 ── */}
            <div className="chat-main">
                <div className="chat-topbar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className="chat-topbar-title">🤖 AI 数据 Agent</span>
                        <span className="chat-model-badge">{model}</span>
                        {datasetData && <span className="chat-model-badge" style={{ background: 'var(--success)', color: '#fff', borderColor: 'var(--success)', fontSize: '11px', opacity: 0.85 }}>📂 {datasetData.dataset_name}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {!apiKey && <span className="chat-warn-badge">⚠ 未配置 API Key</span>}
                        <button className="vbtn vbtn-neutral" style={{ fontSize: '12px', padding: '3px 10px' }}
                            onClick={() => setShowCodeLibrary(true)}>
                            🧩 代码块库
                        </button>
                        <button className="vbtn vbtn-neutral" style={{ fontSize: '12px', padding: '3px 10px' }}
                            onClick={() => setShowAgentRegistry(true)}>
                            🧠 自定义Agent
                        </button>
                        {messages.length > 0 && (
                            <button className="vbtn vbtn-neutral" style={{ fontSize: '12px', padding: '3px 10px' }}
                                onClick={clearCurrentChat}>🗑 清空</button>
                        )}
                        {activeChatId && (
                            <button className="vbtn vbtn-neutral" style={{ fontSize: '12px', padding: '3px 10px' }}
                                onClick={deleteCurrentSession}>🗑 删除对话</button>
                        )}
                    </div>
                </div>

                <div className="chat-messages">
                    {messages.length === 0 && (
                        <div className="chat-empty">
                            <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>🤖</div>
                            <div className="chat-empty-title">AI 数据集分析 Agent</div>
                            <div className="chat-empty-hint">
                                {datasetData
                                    ? `已加载「${datasetData.dataset_name}」— Agent 会自动执行代码并基于真实数据回答`
                                    : '加载数据集后，Agent 可基于真实数据执行分析'}
                            </div>
                            <div className="chat-suggestions">
                                {CHAT_SUGGESTIONS.map((s, i) => (
                                    <button key={i} className="chat-suggestion-chip" onClick={() => sendMessage(s)}>{s}</button>
                                ))}
                            </div>
                        </div>
                    )}
                    {messages.map(msg => (
                        <div key={msg.id} className={`chat-bubble-row ${msg.role}`}>
                            <div className="chat-avatar">{msg.role === 'user' ? '🧑' : '🤖'}</div>
                            <div className={`chat-bubble ${msg.role}`}>
                                {msg.role === 'user'
                                    ? <div className="chat-msg-content">
                                        <ChatTextBlock content={msg.content} />
                                        {(msg.attachments || []).length > 0 && (
                                            <div className="chat-user-attachments">
                                                {msg.attachments.map((a, i) => (
                                                    <span key={i} className="chat-att-chip">
                                                        {a.type === 'image' ? '🖼' : a.type === 'csv' ? '📊' : a.type === 'json' ? '📋' : '📄'} {a.name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                      </div>
                        : <AgentBubble
                            msg={msg}
                            datasetId={datasetId}
                            onFilterByIds={onFilterByIds}
                            onAdoptCodeTemplate={adoptAgentCodeTemplate}
                            isStreaming={msg.id === activeStreamMsgId}
                        />
                            }
                        </div>
                    </div>
                ))}
                    <div ref={messagesEndRef} />
                </div>

                {showAgentRegistry && (
                    <div className="modal-overlay" onClick={() => setShowAgentRegistry(false)}>
                        <div className="modal-content chat-agent-registry-modal" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3>自定义 Agent 注册中心</h3>
                                <button className="modal-close" onClick={() => setShowAgentRegistry(false)}>✕</button>
                            </div>
                            <div className="chat-agent-registry-body">
                                <div className="chat-agent-registry-toolbar">
                                    <input
                                        ref={agentFileInputRef}
                                        type="file"
                                        accept=".py"
                                        style={{ display: 'none' }}
                                        onChange={uploadAgentModule}
                                    />
                                    <input
                                        ref={agentSkillZipInputRef}
                                        type="file"
                                        accept=".zip"
                                        style={{ display: 'none' }}
                                        onChange={importSkillZip}
                                    />
                                    <button className="vbtn vbtn-primary" onClick={() => agentFileInputRef.current?.click()} disabled={agentUploading}>
                                        {agentUploading ? '⏳ 上传中...' : '⬆ 导入 Python 脚本'}
                                    </button>
                                    <button className="vbtn vbtn-neutral" onClick={() => agentSkillZipInputRef.current?.click()} disabled={agentUploading}>
                                        📦 导入 Skills(zip)
                                    </button>
                                    <button className="vbtn vbtn-neutral" onClick={loadAgentModules}>刷新</button>
                                    <span className="chat-model-badge">.py 可注册函数；skills.zip 仅按 SKILL.md 标准导入</span>
                                </div>
                                <div className="chat-agent-registry-list">
                                    {agentModules.length === 0 && <div className="chat-sessions-empty">暂无模块，先导入一个 .py 脚本</div>}
                                    {agentModules.map((m) => (
                                        <div key={m.id} className="chat-agent-module-card">
                                            <div className="chat-agent-module-head">
                                                <div>
                                                    <strong>{m.name || m.id}</strong>
                                                    <div className="chat-agent-module-meta">{m.path}</div>
                                                </div>
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <button className="chat-code-btn" onClick={() => toggleAgentModule(m)}>
                                                        {m.enabled ? '停用' : '启用'}
                                                    </button>
                                                    <button className="chat-code-btn" onClick={() => removeAgentModule(m)}>删除</button>
                                                </div>
                                            </div>
                                            {!!(m.tools || []).length && (
                                                <div className="agent-file-list" style={{ marginTop: 8 }}>
                                                    {(m.tools || []).map((t, i) => (
                                                        <span key={i} className="agent-file-chip">🔧 {t}</span>
                                                    ))}
                                                </div>
                                            )}
                                            {m.error && <pre className="agent-exec-output err" style={{ marginTop: 8 }}>{m.error}</pre>}
                                            {m.pending_registration && !!(m.register_candidates || []).length && (
                                                <div style={{ marginTop: 8 }}>
                                                    <div className="chat-agent-module-meta" style={{ marginBottom: 6 }}>
                                                        脚本未实现 register()，请确认要注册的方法：
                                                    </div>
                                                    <div className="agent-file-list">
                                                        {(m.register_candidates || []).map((c, i) => (
                                                            <span key={i} className="agent-file-chip">ƒ {c.name}</span>
                                                        ))}
                                                    </div>
                                                    <button
                                                        className="chat-code-btn chat-code-btn-run"
                                                        style={{ marginTop: 8 }}
                                                        onClick={() => confirmRegisterAgentModule(m)}>
                                                        确认并注册方法
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className="chat-agent-registry-list">
                                    <div className="chat-agent-module-card">
                                        <div className="chat-agent-module-head">
                                            <strong>已导入 Skills（标准 SKILL.md）</strong>
                                            <span className="chat-model-badge">{agentSkills.length} 个</span>
                                        </div>
                                        {agentSkills.length === 0 && (
                                            <div className="chat-sessions-empty" style={{ marginTop: 8 }}>暂无 skills</div>
                                        )}
                                        {agentSkills.map((s, i) => (
                                            <div key={s.id || i} className="chat-agent-skill-item">
                                                <div>
                                                    <strong>{s.name}</strong>
                                                    {!!s.cursor_name && (
                                                        <span className="chat-model-badge" style={{ marginLeft: 8 }}>id: {s.cursor_name}</span>
                                                    )}
                                                    <div className="chat-agent-module-meta">{s.path}</div>
                                                    <div className="chat-agent-module-meta">
                                                        匹配次数：{s.load_count || 0}
                                                        {s.last_matched_at ? ` · 最近命中：${new Date(s.last_matched_at).toLocaleString()}` : ''}
                                                    </div>
                                                    <label className="chat-skill-pin-row">
                                                        <input
                                                            type="checkbox"
                                                            checked={pinnedSkillIds.includes(s.id)}
                                                            onChange={() => togglePinSkill(s.id)}
                                                        />
                                                        <span>固定到对话（每轮注入，对齐 Cursor 手动启用）</span>
                                                    </label>
                                                </div>
                                                {!!(s.keywords || []).length && (
                                                    <div className="agent-file-list">
                                                        {(s.keywords || []).slice(0, 8).map((k, ki) => (
                                                            <span key={ki} className="agent-file-chip">#{k}</span>
                                                        ))}
                                                    </div>
                                                )}
                                                {!!(s.scripts || []).length && (
                                                    <div className="agent-file-list" style={{ marginTop: 6 }}>
                                                        {(s.scripts || []).slice(0, 6).map((sp, si) => (
                                                            <span key={si} className="agent-file-chip">🐍 {sp.rel_path || sp.name}</span>
                                                        ))}
                                                    </div>
                                                )}
                                                {!!(s.configs || []).length && (
                                                    <div className="agent-file-list" style={{ marginTop: 6 }}>
                                                        {(s.configs || []).slice(0, 8).map((c, ci) => (
                                                            <span key={ci} className="agent-file-chip">
                                                                ⚙ {typeof c === 'string' ? c : c.rel_path}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                {!!(s.warnings || []).length && (
                                                    <pre className="agent-exec-output" style={{ marginTop: 6 }}>
{`校验提示：\n- ${s.warnings.join('\n- ')}`}
                                                    </pre>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    {!!skillImportReport.length && (
                                        <div className="chat-agent-module-card">
                                            <strong>最近一次 Skills 导入报告</strong>
                                            <div className="chat-agent-registry-list" style={{ marginTop: 8 }}>
                                                {skillImportReport.map((r, i) => (
                                                    <div key={i} className="chat-agent-skill-item">
                                                        <div><strong>{r.name}</strong> {r.valid ? '✅' : '⚠️'}</div>
                                                        {!!(r.keywords || []).length && (
                                                            <div className="agent-file-list">
                                                                {(r.keywords || []).map((k, ki) => (
                                                                    <span key={ki} className="agent-file-chip">#{k}</span>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {!!(r.configs || []).length && (
                                                            <div className="agent-file-list" style={{ marginTop: 6 }}>
                                                                {(r.configs || []).map((cr, cri) => (
                                                                    <span key={cri} className="agent-file-chip">⚙ {cr}</span>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {!!(r.warnings || []).length && (
                                                            <pre className="agent-exec-output" style={{ marginTop: 6 }}>
{`- ${r.warnings.join('\n- ')}`}
                                                            </pre>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {pendingRegModal?.module && (
                    <div className="modal-overlay" onClick={() => setPendingRegModal(null)}>
                        <div className="modal-content chat-agent-registry-modal" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3>确认注册方法：{pendingRegModal.module.name || pendingRegModal.module.id}</h3>
                                <button className="modal-close" onClick={() => setPendingRegModal(null)}>✕</button>
                            </div>
                            <div className="chat-agent-registry-body">
                                <div className="chat-agent-registry-list">
                                    {(pendingRegModal.module.register_candidates || []).map((c, i) => {
                                        const checked = pendingRegModal.selected.has(c.name);
                                        return (
                                            <label key={i} className="chat-agent-candidate-row">
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={(e) => {
                                                        setPendingRegModal(prev => {
                                                            if (!prev) return prev;
                                                            const next = new Set(prev.selected || []);
                                                            if (e.target.checked) next.add(c.name);
                                                            else next.delete(c.name);
                                                            return { ...prev, selected: next };
                                                        });
                                                    }}
                                                />
                                                <span><strong>{c.name}</strong>{c.description ? ` — ${c.description}` : ''}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                                <div className="chat-code-library-actions">
                                    <button className="vbtn vbtn-neutral" onClick={() => setPendingRegModal(null)}>取消</button>
                                    <button className="vbtn vbtn-primary" onClick={submitPendingRegistration}>确认注册</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {showCodeLibrary && (
                    <div className="modal-overlay" onClick={() => setShowCodeLibrary(false)}>
                        <div className="modal-content chat-code-library-modal" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3>代码功能块库（可编辑 + 可执行）</h3>
                                <button className="modal-close" onClick={() => setShowCodeLibrary(false)}>✕</button>
                            </div>
                            <div className="chat-code-library-body">
                                <div className="chat-code-library-left">
                                    <div className="chat-code-library-left-header">
                                        <strong>已保存模板</strong>
                                        <button className="chat-code-btn" onClick={resetTemplateEditor}>+ 新建</button>
                                    </div>
                                    <div className="chat-code-template-list">
                                        {codeTemplates.length === 0 && (
                                            <div className="chat-sessions-empty" style={{ padding: '8px 6px' }}>暂无模板</div>
                                        )}
                                        {codeTemplates.map(t => (
                                            <button
                                                key={t.id}
                                                className={`chat-code-template-item ${activeTemplateId === t.id ? 'active' : ''}`}
                                                onClick={() => chooseTemplate(t.id)}>
                                                <span className="chat-code-template-name">{t.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="chat-code-library-right">
                                    <input
                                        className="chat-code-template-title"
                                        value={templateName}
                                        onChange={e => setTemplateName(e.target.value)}
                                        placeholder="模板名称（例如：Hard Case 导出）"
                                    />
                                    <textarea
                                        className="chat-code-template-editor"
                                        value={templateCode}
                                        onChange={e => setTemplateCode(e.target.value)}
                                        placeholder={'输入可执行 Python 代码。\n可直接调用内置函数，例如：\nids = hard_cases(0.3, 0.6, 1)\nfilter_gallery(ids, "Hard Cases")'}
                                    />
                                    <div className="chat-code-library-actions">
                                        <button className="vbtn vbtn-neutral" onClick={saveTemplate}>💾 保存模板</button>
                                        <button className="vbtn vbtn-primary" onClick={runTemplateCode} disabled={templateRunning || !datasetId}>
                                            {templateRunning ? '⏳ 执行中...' : '▶ 执行代码'}
                                        </button>
                                        <button className="vbtn vbtn-danger" onClick={removeTemplate} disabled={!activeTemplate}>🗑 删除模板</button>
                                    </div>
                                    {templateRunResult && (
                                        <div className={`chat-code-run-result ${templateRunResult.ok ? 'ok' : 'err'}`}>
                                            {!templateRunResult.ok && (
                                                <pre className="agent-exec-output err">{templateRunResult.error}</pre>
                                            )}
                                            {templateRunResult.ok && (
                                                <div>
                                                    {templateRunResult.data.type !== 'filter' && ((templateRunResult.data.ui_actions || []).filter(
                                                        a => a?.type === 'filter_gallery' && Array.isArray(a.image_ids) && a.image_ids.length > 0
                                                    )).map((a, ai) => (
                                                        <button
                                                            key={ai}
                                                            className="chat-code-btn chat-code-btn-run"
                                                            style={{ marginBottom: 8, marginRight: 8 }}
                                                            onClick={() => onFilterByIds?.(
                                                                a.image_ids,
                                                                a.description || `代码模板筛选（${a.image_ids.length} 张）`
                                                            )}>
                                                            🔍 在图库查看（{a.image_ids.length} 张）
                                                        </button>
                                                    ))}
                                                    {templateRunResult.data.type === 'filter' ? (
                                                        <div>
                                                            <div>✅ 筛选到 <strong>{templateRunResult.data.count || 0}</strong> 张图片</div>
                                                            {(templateRunResult.data.image_ids || []).length > 0 && (
                                                                <button
                                                                    className="chat-code-btn chat-code-btn-run"
                                                                    style={{ marginTop: 8 }}
                                                                    onClick={() => onFilterByIds?.(
                                                                        templateRunResult.data.image_ids,
                                                                        `代码模板筛选（${templateRunResult.data.image_ids.length} 张）`
                                                                    )}>
                                                                    🔍 在图库查看
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div>✅ 执行完成</div>
                                                    )}
                                                    {templateRunResult.data.output && (
                                                        <pre className="agent-exec-output">{templateRunResult.data.output}</pre>
                                                    )}
                                                    {!!(templateRunResult.data.files || []).length && (
                                                        <div className="agent-file-list">
                                                            {(templateRunResult.data.files || []).map((f, idx) => (
                                                                <a
                                                                    key={idx}
                                                                    href={`/api/chat/download/${f.file_id}`}
                                                                    download={f.filename}
                                                                    className="agent-file-chip"
                                                                    target="_blank"
                                                                    rel="noreferrer">
                                                                    📄 {f.filename}
                                                                </a>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {showSysPrompt && (
                    <div className="chat-sysprompt-panel">
                        <div className="chat-sysprompt-header">
                            <span>系统提示词覆盖（本次对话生效）</span>
                            <button className="chat-sysprompt-close" onClick={() => setShowSysPrompt(false)}>✕</button>
                        </div>
                        <textarea
                            className="chat-sysprompt-input"
                            value={localSysPrompt}
                            onChange={e => setLocalSysPrompt(e.target.value)}
                            placeholder="留空则使用全局设置中的系统提示词。此处内容会附加在内置 Agent 提示词之前。"
                            rows={4}
                        />
                    </div>
                )}
                <div className="chat-input-bar">
                    {attachments.length > 0 && (
                        <div className="chat-attachments-row">
                            {attachments.map((a, i) => (
                                <div key={i} className="chat-att-preview">
                                    {a.type === 'image'
                                        ? <img src={`data:${a.mime};base64,${a.data}`} alt={a.name} className="chat-att-img" />
                                        : <span className="chat-att-icon">{a.type === 'csv' ? '📊' : a.type === 'json' ? '📋' : '📄'}</span>
                                    }
                                    <span className="chat-att-name">{a.name}</span>
                                    <button className="chat-att-remove" onClick={() => removeAttachment(i)}>×</button>
                                </div>
                            ))}
                        </div>
                    )}
                    {pinnedSkillIds.length > 0 && (
                        <div className="chat-pinned-skills-row">
                            <span className="chat-pinned-skills-label">固定 Skills</span>
                            {pinnedSkillIds.map((pid) => {
                                const sk = agentSkills.find((x) => x.id === pid);
                                return (
                                    <span key={pid} className="agent-file-chip chat-pinned-skill-chip">
                                        {sk?.name || String(pid).slice(0, 10)}
                                        <button type="button" className="chat-pinned-skill-unpin" onClick={() => togglePinSkill(pid)} title="取消固定">×</button>
                                    </span>
                                );
                            })}
                        </div>
                    )}
                    <div className="chat-input-row">
                        <input ref={fileInputRef} type="file" style={{ display: 'none' }}
                            multiple accept=".jpg,.jpeg,.png,.gif,.webp,.csv,.json,.txt,.md"
                            onChange={handleFileSelect} />
                        <button className="chat-attach-btn" title="系统提示词设置"
                            onClick={() => setShowSysPrompt(v => !v)}
                            style={{ opacity: localSysPrompt ? 1 : 0.6 }}>
                            ⚙️
                        </button>
                        <button className="chat-attach-btn" title="上传文件/图片"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={streaming || uploading}>
                            {uploading ? '⏳' : '📎'}
                        </button>
                        <textarea
                            ref={inputRef}
                            className="chat-input"
                            value={input}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            placeholder={streaming ? 'Agent 正在分析...' : '可输入 "搜索 xxx" 联网搜索 · Shift+Enter 换行 · Enter 发送'}
                            rows={1}
                            disabled={streaming}
                            style={{ resize: 'none', overflow: 'hidden' }}
                            onInput={e => {
                                e.target.style.height = 'auto';
                                e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
                            }}
                        />
                        <button
                            className={`chat-send-btn ${streaming ? 'loading' : ''}`}
                            onClick={() => sendMessage()}
                            disabled={streaming || (!input.trim() && attachments.length === 0)}
                            title="发送 (Enter)">
                            {streaming ? '⏳' : '↑'}
                        </button>
                    </div>
                </div>
            </div>{/* end .chat-main */}
        </div>
    );
}

// ==================== AI Chat 系统结束 ====================

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
function getPRCurveColors(theme) {
    if (theme === 'light') {
        return ['#2f8f57','#2f67d8','#bd7b12','#c33d4d','#6a45cc','#15949e','#c26d17','#c03f92','#6b9a10','#1f9d9d'];
    }
    if (theme === 'dim') {
        return ['#48be84','#5b8df6','#d59a33','#e35b6b','#8d6cf0','#25b7b7','#de8938','#d95aae','#8ec41c','#3fbdbd'];
    }
    return ['#52c41a','#1890ff','#faad14','#f5222d','#722ed1','#13c2c2','#fa8c16','#eb2f96','#a0d911','#36cfc9'];
}
function PRCurveCanvas({ prCurves, agnosticCurve }) {
    const config = useConfig();
    const uiTheme = config.uiTheme || DEFAULT_CONFIG.uiTheme || 'dark';
    const prCurveColors = React.useMemo(() => getPRCurveColors(uiTheme), [uiTheme]);
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

        const css = getComputedStyle(document.documentElement);
        const cBg = css.getPropertyValue('--bg-soft').trim() || '#111122';
        const cGrid = css.getPropertyValue('--border').trim() || '#2b3550';
        const cAxis = css.getPropertyValue('--border-strong').trim() || '#3a4870';
        const cTick = css.getPropertyValue('--text-muted').trim() || '#7d88a8';
        const cLabel = css.getPropertyValue('--text-secondary').trim() || '#b0b9d4';
        const cAgnostic = css.getPropertyValue('--text-primary').trim() || '#e6ebff';

        ctx.fillStyle = cBg;
        ctx.fillRect(0, 0, W_total, H_total);

        // 格线
        ctx.strokeStyle = cGrid;
        ctx.lineWidth = 1;
        for (let i = 0; i <= 10; i++) {
            ctx.beginPath(); ctx.moveTo(padL + W * i / 10, padT); ctx.lineTo(padL + W * i / 10, padT + H); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(padL, padT + H * i / 10); ctx.lineTo(padL + W, padT + H * i / 10); ctx.stroke();
        }
        ctx.strokeStyle = cAxis; ctx.lineWidth = 1;
        ctx.strokeRect(padL, padT, W, H);

        // 坐标刻度
        ctx.font = '10px sans-serif'; ctx.fillStyle = cTick;
        for (let i = 0; i <= 5; i++) {
            ctx.textAlign = 'center';
            ctx.fillText((i / 5).toFixed(1), padL + W * i / 5, padT + H + 14);
            ctx.textAlign = 'right';
            ctx.fillText((1 - i / 5).toFixed(1), padL - 5, padT + H * i / 5 + 3);
        }
        ctx.fillStyle = cLabel; ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Recall →', padL + W / 2, H_total - 4);
        ctx.save(); ctx.translate(11, padT + H / 2); ctx.rotate(-Math.PI / 2);
        ctx.fillText('↑ Precision', 0, 0); ctx.restore();

        // 曲线数据：按类别 + 类别无关
        const sortedCats = Object.keys(prCurves).sort();
        const curves = [
            ...sortedCats.map((cat, i) => ({ label: cat, color: prCurveColors[i % prCurveColors.length], ap: 0, ...prCurves[cat] })),
            { label: '全部缺陷(类别无关)', color: cAgnostic, dash: [7, 3], ap: agnosticCurve.ap || 0, ...agnosticCurve.prCurve },
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
            ctx.fillStyle = color;
            ctx.font = '9.5px sans-serif'; ctx.textAlign = 'left';
            ctx.fillText(`${label}  AP=${(ap * 100).toFixed(1)}%`, legX - 100, ly);
        });
    }, [prCurves, agnosticCurve, prCurveColors]);

    return (
        <div ref={containerRef} style={{ width: '100%' }}>
            <canvas ref={canvasRef} style={{ display: 'block', width: '100%', borderRadius: '6px' }} />
        </div>
    );
}

// ==================== mAP 报告弹窗 ====================
function MapReportModal({ images, model, scoreThresh, onClose }) {
    const config = useConfig();
    const uiTheme = config.uiTheme || DEFAULT_CONFIG.uiTheme || 'dark';
    const prCurveColors = React.useMemo(() => getPRCurveColors(uiTheme), [uiTheme]);
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
        padding: '6px 16px', fontSize: 'var(--font-md)', cursor: 'pointer', border: 'none',
        background: activeTab === key ? 'var(--bg-hover)' : 'transparent',
        color: activeTab === key ? 'var(--accent)' : 'var(--text-muted)',
        borderBottom: activeTab === key ? '2px solid var(--accent)' : '2px solid transparent',
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
                background: 'var(--bg-surface)',
                borderRadius: '14px',
                border: '1px solid var(--border-strong)',
                boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
                maxWidth: '1000px', width: '100%',
                display: 'flex', flexDirection: 'column',
            }}>
                {/* 标题栏 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontWeight: 'bold', fontSize: 'var(--font-lg)', color: 'var(--text-primary)' }}>📊 检测指标报告 · <span style={{ color: 'var(--accent)' }}>{model}</span></span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button className="btn btn-sm btn-secondary" onClick={copyTable} disabled={!report}>📋 复制表格</button>
                        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer', lineHeight: 1 }}>✕</button>
                    </div>
                </div>

                <div style={{ padding: '16px 20px 0', overflow: 'hidden' }}>
                    {computing ? (
                        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', fontSize: 'var(--font-xl)' }}>⏳ 计算中…</div>
                    ) : !report ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--danger)' }}>计算失败，请检查数据</div>
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
                                    <div key={label} style={{ background: 'var(--bg-raised)', borderRadius: '8px', padding: '12px 8px', textAlign: 'center', border: `1px solid ${color}44` }}>
                                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '1px' }}>{sub}</div>
                                        <div style={{ fontSize: '22px', fontWeight: 'bold', color, lineHeight: 1.2 }}>{fmt(value)}</div>
                                        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginTop: '2px' }}>{label}</div>
                                    </div>
                                ))}
                            </div>

                            {/* 元信息 */}
                            <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', marginBottom: '12px', display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
                                <span>模型：<strong style={{ color: 'var(--text-primary)' }}>{model}</strong></span>
                                <span>置信度阈值：<strong style={{ color: 'var(--text-primary)' }}>{scoreThresh.toFixed(2)}</strong></span>
                                <span>图片数：<strong style={{ color: 'var(--text-primary)' }}>{images.length}</strong></span>
                                <span>类别数：<strong style={{ color: 'var(--text-primary)' }}>{Object.keys(report.perClass).length}</strong></span>
                                <span style={{ color: 'var(--text-secondary)' }}>AP = AUC-PR（单调包络）</span>
                            </div>

                            {/* 标签页切换 */}
                            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '0' }}>
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
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-md)', tableLayout: 'fixed' }}>
                                    <colgroup>
                                        <col style={{ width: '80px' }} />
                                        {['GT','预测','TP','FP','FN','Precision','Recall','F1','AP@50','AP@75','AP@50:95'].map((_, i) => (
                                            <col key={i} style={{ width: i < 5 ? '52px' : i < 8 ? '72px' : '78px' }} />
                                        ))}
                                    </colgroup>
                                    <thead>
                                        <tr style={{ background: 'var(--bg-raised)', position: 'sticky', top: 0, zIndex: 1 }}>
                                            {[['类别','left'],['GT','center'],['预测','center'],['TP','center'],['FP','center'],['FN','center'],['Precision','center'],['Recall','center'],['F1','center'],['AP@50','center'],['AP@75','center'],['AP@50:95','center']].map(([h, a]) => (
                                                <th key={h} style={{ ...cs(a), fontWeight: 'bold', color: 'var(--text-secondary)', background: 'var(--bg-raised)', borderBottom: `2px solid var(--border-strong)`, fontSize: 'var(--font-sm)' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.keys(report.perClass).sort().map((cat, i) => {
                                            const r = report.perClass[cat];
                                            const catColor = prCurveColors[i % prCurveColors.length];
                                            return (
                                                <tr key={cat} style={{ background: i % 2 === 0 ? 'var(--bg-soft)' : 'var(--bg-raised)', borderBottom: '1px solid var(--border)' }}>
                                                    <td style={{ ...cs('left'), color: catColor, fontWeight: 'bold', fontSize: 'var(--font-sm)' }}>{cat}</td>
                                                    <td style={{ ...cs(), color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>{r.numGT}</td>
                                                    <td style={{ ...cs(), color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>{r.numPred}</td>
                                                    <td style={{ ...cs(), color: '#52c41a', fontWeight: 'bold', fontSize: 'var(--font-sm)' }}>{r.tp}</td>
                                                    <td style={{ ...cs(), color: '#f5222d', fontSize: 'var(--font-sm)' }}>{r.fp}</td>
                                                    <td style={{ ...cs(), color: '#faad14', fontSize: 'var(--font-sm)' }}>{r.fn}</td>
                                                    <td style={{ ...cs(), fontSize: 'var(--font-sm)' }}>{fmt(r.precision)}</td>
                                                    <td style={{ ...cs(), fontSize: 'var(--font-sm)' }}>{fmt(r.recall)}</td>
                                                    <td style={{ ...cs(), fontSize: 'var(--font-sm)' }}>{fmt(r.f1)}</td>
                                                    <td style={{ ...cs(), color: '#52c41a', fontWeight: 'bold', fontSize: 'var(--font-sm)' }}>{fmt(r.ap)}</td>
                                                    <td style={{ ...cs(), color: '#1890ff', fontSize: 'var(--font-sm)' }}>{fmt(report.perClassAP75[cat]||0)}</td>
                                                    <td style={{ ...cs(), color: '#722ed1', fontSize: 'var(--font-sm)' }}>{fmt(report.perClassAP50_95[cat]||0)}</td>
                                                </tr>
                                            );
                                        })}
                                        {/* mAP 汇总行 */}
                                        <tr style={{ background: 'var(--bg-raised)', borderTop: `2px solid var(--border-strong)` }}>
                                            <td style={{ ...cs('left'), color: 'var(--text-primary)', fontWeight: 'bold', fontSize: 'var(--font-sm)' }}>mAP</td>
                                            <td colSpan={8} style={{ borderBottom: 'none' }} />
                                            <td style={{ ...cs(), color: '#52c41a', fontWeight: 'bold', fontSize: 'var(--font-md)' }}>{fmt(report.mAP50)}</td>
                                            <td style={{ ...cs(), color: '#1890ff', fontWeight: 'bold', fontSize: 'var(--font-md)' }}>{fmt(report.mAP75)}</td>
                                            <td style={{ ...cs(), color: '#722ed1', fontWeight: 'bold', fontSize: 'var(--font-md)' }}>{fmt(report.mAP50_95)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {activeTab === 'agnostic' && (() => {
                            const a = report.agnostic;
                            return (
                                <div>
                                    <div style={{ fontSize: 'var(--font-md)', color: 'var(--text-muted)', marginBottom: '16px', background: 'var(--bg-raised)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                                        <strong style={{ color: 'var(--text-secondary)' }}>类别无关指标</strong>：忽略缺陷类型，只要预测框与任意GT框 IoU 达到阈值，即视为检出。评估模型对缺陷的整体感知能力。
                                    </div>
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-md)' }}>
                                            <thead>
                                                <tr style={{ background: 'var(--bg-raised)', borderBottom: `2px solid var(--border-strong)` }}>
                                                    {['指标','GT总数','预测总数','TP','FP','FN','Precision','Recall','F1','AP@50','AP@75','AP@50:95'].map(h => (
                                                        <th key={h} style={{ ...cs(h==='指标'?'left':'center'), color: 'var(--text-secondary)', fontWeight: 'bold', fontSize: 'var(--font-sm)' }}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr style={{ background: 'var(--bg-soft)', borderBottom: `1px solid var(--border)` }}>
                                                    <td style={{ ...cs('left'), color: '#fa8c16', fontWeight: 'bold' }}>缺陷检出</td>
                                                    <td style={{ ...cs(), color: 'var(--text-muted)' }}>{a.numGT}</td>
                                                    <td style={{ ...cs(), color: 'var(--text-muted)' }}>{a.numPred}</td>
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
                                    <div style={{ marginTop: '20px', fontSize: 'var(--font-md)', color: 'var(--text-secondary)', background: 'var(--bg-soft)', borderRadius: '6px', padding: '12px 16px', lineHeight: '1.8' }}>
                                        <div><span style={{color:'var(--text-muted)'}}>漏检数 (FN)：</span><strong style={{color:'#faad14'}}>{a.fn}</strong> 个GT未被任何预测框覆盖</div>
                                        <div><span style={{color:'var(--text-muted)'}}>误检数 (FP)：</span><strong style={{color:'#f5222d'}}>{a.fp}</strong> 个预测框未与任何GT匹配</div>
                                        <div><span style={{color:'var(--text-muted)'}}>漏检率：</span><strong style={{color:'#faad14'}}>{a.numGT > 0 ? fmt(a.fn/a.numGT) : '—'}</strong></div>
                                        <div><span style={{color:'var(--text-muted)'}}>误检率：</span><strong style={{color:'#f5222d'}}>{a.numPred > 0 ? fmt(a.fp/a.numPred) : '—'}</strong></div>
                                    </div>
                                </div>
                            );
                        })()}

                        {activeTab === 'pr' && (
                            <div>
                                <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', marginBottom: '10px' }}>PR 曲线基于 IoU@50 计算，曲线下面积即为 AP@50。</div>
                                <PRCurveCanvas prCurves={report.prCurves} agnosticCurve={report.agnostic} />
                            </div>
                        )}
                    </div>
                )}

                {/* 底部 */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
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
                        <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: 'var(--font-md)', color: 'var(--text-secondary)' }}>选择预测模型（单选）</div>
                        {predModelNames.map(model => (
                            <label key={model} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', cursor: 'pointer', padding: '6px 10px', background: localModel === model ? '#2a3a5a' : '#1e1e38', borderRadius: '6px', border: localModel === model ? '1px solid #4a7af0' : '1px solid transparent' }}>
                                <input type="radio" name="pred_eval_model" value={model} checked={localModel === model} onChange={() => setLocalModel(model)} />
                                <span style={{ fontFamily: 'monospace', fontSize: 'var(--font-md)' }}>{model}</span>
                            </label>
                        ))}
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: 'var(--font-md)', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                            IoU 阈值：<strong style={{ color: '#7af' }}>{localIou.toFixed(2)}</strong>
                            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginLeft: '8px' }}>（预测框与GT框的重叠度 ≥ 此值才算正确）</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input type="range" min="0" max="1" step="0.05" value={localIou} onChange={handleIouSlider} style={{ flex: 1 }} />
                            <input type="number" min="0" max="1" step="0.01" value={localIou} onChange={handleIouInput} className="filter-input" style={{ width: '70px' }} />
                        </div>
                    </div>

                    <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontSize: 'var(--font-md)', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                            置信度阈值：<strong style={{ color: '#7af' }}>{localScore.toFixed(2)}</strong>
                            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginLeft: '8px' }}>（低于此值的预测框不参与评估）</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input type="range" min="0" max="1" step="0.05" value={localScore} onChange={handleScoreSlider} style={{ flex: 1 }} />
                            <input type="number" min="0" max="1" step="0.01" value={localScore} onChange={handleScoreInput} className="filter-input" style={{ width: '70px' }} />
                        </div>
                    </div>

                                    <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', marginTop: '14px', background: 'var(--bg-raised)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', lineHeight: '1.7' }}>
                        <div>✓ <strong style={{color:'#52c41a'}}>预测正确</strong>：无误检且无漏检（TP全匹配）</div>
                        <div>⚡ <strong style={{color:'#faad14'}}>误检</strong>：存在未命中GT的预测框（FP &gt; 0）</div>
                        <div>◎ <strong style={{color:'#f5222d'}}>漏检</strong>：存在未被预测框命中的GT框（FN &gt; 0）</div>
                        <div style={{color:'var(--text-muted)', fontSize:'11px', marginTop:'4px'}}>注：一张图可同时属于误检和漏检</div>
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
function GalleryPage({ datasetData, images, categories, imageClassifications, imageNotes, imageCategories, imageCategoryColors, imageCategoryMultiSelect, onUpdateImageCategories, onUpdateImageCategoryColors, onUpdateCategory, onUpdateCategories, onUpdateNote, onBatchUpdateCategory, onBatchClearAnnotations, onRollback, metaFilterOptions, onApplyMetaFilters, autoSaveStatus, onAnnotationsSaved, onReloadImages, jumpToCategory, onJumpHandled, jumpToImageId, onJumpImageHandled, agentFilterIds, agentFilterMsg, onClearAgentFilter, onFilterByIds }) {
    const config = useConfig();
    const gallery = config.gallery || DEFAULT_CONFIG.gallery;
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(gallery.defaultPageSize ?? 20);
    const [selectedLabelCategory, setSelectedLabelCategory] = useState('all'); // 标注类别筛选
    const [selectedImageCategory, setSelectedImageCategory] = useState('all'); // 图片分类筛选
    const [selectedDirectory, setSelectedDirectory] = useState('all'); // 目录筛选（多目录合并时）
    const [showUnannotatedOnly, setShowUnannotatedOnly] = useState(false); // 仅显示无 GT 框（筛选条件，非图片级分类）
    const [searchText, setSearchText] = useState('');
    // 图片元数据筛选（c_time / product_id / position），仅当 COCO 含对应字段时显示
    const [metaCtimeStart, setMetaCtimeStart] = useState('');
    const [metaCtimeEnd, setMetaCtimeEnd] = useState('');
    const [metaProductIdQuery, setMetaProductIdQuery] = useState('');
    const [metaPosition, setMetaPosition] = useState('');
    const [metaFilterApplying, setMetaFilterApplying] = useState(false);
    const [scoreMin, setScoreMin] = useState('');
    const [scoreMax, setScoreMax] = useState('');
    const [showCodeFilterPanel, setShowCodeFilterPanel] = useState(false);
    const [selectedImages, setSelectedImages] = useState(new Set());
    const [showExportModal, setShowExportModal] = useState(false);
    const [showVersionModal, setShowVersionModal] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showCatMgr, setShowCatMgr] = useState(false); // 类别管理弹窗
    const [galleryMoreToolsOpen, setGalleryMoreToolsOpen] = useState(false); // 收起次要工具，突出保存/导出

    // EDA 联动：收到 jumpToCategory 时自动设置标注类别筛选并跳到第1页
    useEffect(() => {
        if (!jumpToCategory) return;
        setSelectedLabelCategory(jumpToCategory);
        setCurrentPage(1);
        if (onJumpHandled) onJumpHandled();
    }, [jumpToCategory]); // eslint-disable-line

    // EDA 联动：收到 jumpToImageId 时直接打开对应图片查看器
    useEffect(() => {
        if (!jumpToImageId || !images || images.length === 0) return;
        const target = images.find(img => img.image_id === jumpToImageId || img.image_id === Number(jumpToImageId));
        if (target) {
            setSelectedImage(target);
            setViewerOpen(true);
        }
        if (onJumpImageHandled) onJumpImageHandled();
    }, [jumpToImageId, images]); // eslint-disable-line

    // 大图查看器状态：直接存在 GalleryPage，filteredImages 可直接传入
    const [viewerOpen, setViewerOpen] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [sortOrder, setSortOrder] = useState('default'); // 'default'|'name_asc'|'name_desc'|'ann_desc'|'ann_asc'
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

    // 标注类别统计（useMemo 缓存，仅在 images 变化时重算）
    const { labelCategoryStats, totalAnnotations } = React.useMemo(() => {
        const stats = {};
        let total = 0;
    images.forEach(img => {
        img.annotations.forEach(ann => {
                stats[ann.category] = (stats[ann.category] || 0) + 1;
                total++;
        });
    });
        return { labelCategoryStats: stats, totalAnnotations: total };
    }, [images]);

    // 图片分类统计（useMemo 缓存）
    const defaultImageCat = (imageCategories && imageCategories[0]) || '未分类';
    const imageCategoryStats = React.useMemo(() => {
        const stats = {};
        (imageCategories || []).forEach(cat => { stats[cat] = 0; });
    images.forEach(img => {
        const cats = imageClassifications[img.image_id];
        const arr = Array.isArray(cats) && cats.length ? cats : [defaultImageCat];
            arr.forEach(cat => { stats[cat] = (stats[cat] || 0) + 1; });
    });
        return stats;
    }, [images, imageClassifications, imageCategories, defaultImageCat]);

    // 目录列表（多目录合并时用于筛选）
    const directoryOptions = React.useMemo(() => {
        const set = new Set();
        images.forEach(img => { if (img.source_path != null && img.source_path !== '') set.add(img.source_path); });
        return ['all', ...Array.from(set).sort()];
    }, [images]);

    // 是否存在置信度分数字段（决定是否显示分数筛选器）
    const hasScoreData = React.useMemo(() =>
        images.some(img => 
            img.annotations.some(a => typeof a.score === 'number' && !isNaN(a.score)) || 
            (img.pred_annotations && img.pred_annotations.some(a => typeof a.score === 'number' && !isNaN(a.score))) ||
            img.annotations.some(a => typeof a.score === 'string' && a.score !== '') ||
            (img.pred_annotations && img.pred_annotations.some(a => typeof a.score === 'string' && a.score !== ''))
        )
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
    // Agent 过滤 ID 集合
    const agentFilterSet = React.useMemo(() => agentFilterIds ? new Set(agentFilterIds) : null, [agentFilterIds]);

    const _filteredImages = React.useMemo(() => images.filter(img => {
        // Agent 筛选优先
        if (agentFilterSet && !agentFilterSet.has(img.image_id)) return false;
        if (selectedDirectory !== 'all' && (img.source_path != null ? img.source_path : '') !== selectedDirectory) return false;
        if (selectedLabelCategory !== 'all' && !img.annotations.some(a => a.category === selectedLabelCategory)) return false;
        if (showUnannotatedOnly && img.annotations && img.annotations.length > 0) return false;
        if (selectedImageCategory !== 'all') {
            const arr = imageClassifications[img.image_id];
            const imgCats = Array.isArray(arr) && arr.length ? arr : [defaultImageCat];
            if (!imgCats.includes(selectedImageCategory)) return false;
        }
        if (searchText && !img.file_name.toLowerCase().includes(searchText.toLowerCase())) return false;
        // 置信度范围筛选：只要图片中任意 GT 或预测框的分数在范围内即通过
        if (scoreMin !== '' || scoreMax !== '') {
            const sMin = scoreMin !== '' ? parseFloat(scoreMin) : -Infinity;
            const sMax = scoreMax !== '' ? parseFloat(scoreMax) : Infinity;
            const checkScore = (a) => {
                const s = typeof a.score === 'number' ? a.score : parseFloat(a.score);
                return !isNaN(s) && s >= sMin && s <= sMax;
            };
            const hit = img.annotations.some(checkScore) || (img.pred_annotations && img.pred_annotations.some(checkScore));
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
    }), [images, selectedDirectory, selectedLabelCategory, selectedImageCategory, searchText, imageClassifications, defaultImageCat, scoreMin, scoreMax, predEvalEnabled, predEvalFilter, imageEvalResults, showUnannotatedOnly, agentFilterSet]);

    // 排序
    const filteredImages = React.useMemo(() => {
        const arr = [..._filteredImages];
        if (sortOrder === 'name_asc') arr.sort((a, b) => a.file_name.localeCompare(b.file_name));
        else if (sortOrder === 'name_desc') arr.sort((a, b) => b.file_name.localeCompare(a.file_name));
        else if (sortOrder === 'ann_desc') arr.sort((a, b) => (b.annotations?.length || 0) - (a.annotations?.length || 0));
        else if (sortOrder === 'ann_asc') arr.sort((a, b) => (a.annotations?.length || 0) - (b.annotations?.length || 0));
        else if (sortOrder === 'pred_desc') arr.sort((a, b) => (b.pred_annotations?.length || 0) - (a.pred_annotations?.length || 0));
        else if (sortOrder === 'pred_asc') arr.sort((a, b) => (a.pred_annotations?.length || 0) - (b.pred_annotations?.length || 0));
        else if (sortOrder === 'size_desc') arr.sort((a, b) => (b.file_size || 0) - (a.file_size || 0));
        else if (sortOrder === 'size_asc') arr.sort((a, b) => (a.file_size || 0) - (b.file_size || 0));
        else if (sortOrder === 'mtime_desc') arr.sort((a, b) => (b.modified_time || 0) - (a.modified_time || 0));
        else if (sortOrder === 'mtime_asc') arr.sort((a, b) => (a.modified_time || 0) - (b.modified_time || 0));
        return arr;
    }, [_filteredImages, sortOrder]);

    // 标注进度统计（基于全量 images，不受当前筛选影响）
    const annotationProgress = React.useMemo(() => {
        const total = images.length;
        const annotated = images.filter(img => img.annotations && img.annotations.length > 0).length;
        return { total, annotated, unannotated: total - annotated };
    }, [images]);

    // 筛选条件变化时：当前大图若不在新列表里，跳到第一张；列表为空则关闭
    const selectedImageId = selectedImage && selectedImage.image_id;
    useEffect(() => {
        if (!viewerOpen || selectedImageId == null) return;
        if (filteredImages.length === 0) { setViewerOpen(false); return; }
        const stillIn = filteredImages.some(i => i.image_id === selectedImageId);
        if (!stillIn) setSelectedImage(filteredImages[0]);
    }, [viewerOpen, filteredImages, selectedImageId]);

    // Enter 键重新打开上次查看的图片（ESC 关闭后可快速返回）
    useEffect(() => {
        const handler = (e) => {
            if (viewerOpen) return;
            if (!selectedImage) return;
            const tag = (e.target || {}).tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (e.key === 'Enter') {
                e.preventDefault();
                setViewerOpen(true);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [viewerOpen, selectedImage]);

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

    const metaOpts = metaFilterOptions || {};
    const metaFieldMap = getMetaFilterMapping(config.viewer || DEFAULT_CONFIG.viewer);
    const normalizeMetaLabel = (label, fallbackKey, fallbackZh) => {
        const v = (label || '').toString().trim();
        if (!v) return fallbackZh;
        const low = v.toLowerCase();
        if (low === fallbackKey.toLowerCase()) return fallbackZh;
        return v;
    };
    const cTimeLabel = normalizeMetaLabel(metaOpts.c_time_label || metaFieldMap.c_time, 'c_time', '时间');
    const productIdLabel = normalizeMetaLabel(metaOpts.product_id_label || metaFieldMap.product_id, 'product_id', 'SN号');
    const positionLabel = normalizeMetaLabel(metaOpts.position_label || metaFieldMap.position, 'position', '位置');
    const sampleMeta = (images && images[0] && images[0].image_meta) || {};
    const hasMetaFilterCapability = !!(
        (metaOpts.has_c_time || metaOpts.has_product_id || metaOpts.has_position) ||
        (sampleMeta && typeof sampleMeta === 'object' && (
            Object.prototype.hasOwnProperty.call(sampleMeta, metaFieldMap.c_time) ||
            Object.prototype.hasOwnProperty.call(sampleMeta, metaFieldMap.product_id) ||
            Object.prototype.hasOwnProperty.call(sampleMeta, metaFieldMap.position)
        ))
    );
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
                {agentFilterIds && agentFilterIds.length > 0 && (
                    <div style={{ padding: '8px 16px', background: 'var(--accent-dim, rgba(99,102,241,0.12))', borderBottom: '1px solid var(--accent)', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px' }}>
                        <span style={{ flex: 1, color: 'var(--text-primary)' }}>
                            🎯 <strong>当前筛选：</strong>{agentFilterMsg || `已筛选 ${agentFilterIds.length} 张图片`}
                        </span>
                        <button className="vbtn vbtn-on-red" style={{ fontSize: '12px', padding: '3px 10px' }} onClick={onClearAgentFilter}>✕ 清除筛选</button>
                    </div>
                )}
                {hasMetaFilterCapability && (
                    <div className="meta-filter-bar">
                        <span style={{ fontWeight: 600, marginRight: '4px' }}>元数据筛选:</span>
                        {(metaOpts.has_c_time || Object.prototype.hasOwnProperty.call(sampleMeta, metaFieldMap.c_time)) && (
                            <>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ whiteSpace: 'nowrap' }}>{`${cTimeLabel}起`}</span>
                                    <input type="datetime-local" value={metaCtimeStart} onChange={(e) => setMetaCtimeStart(e.target.value)} style={{ padding: '4px 8px' }} />
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ whiteSpace: 'nowrap' }}>{`${cTimeLabel}止`}</span>
                                    <input type="datetime-local" value={metaCtimeEnd} onChange={(e) => setMetaCtimeEnd(e.target.value)} style={{ padding: '4px 8px' }} />
                                </label>
                            </>
                        )}
                        {(metaOpts.has_product_id || Object.prototype.hasOwnProperty.call(sampleMeta, metaFieldMap.product_id)) && (
                            <>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ whiteSpace: 'nowrap' }}>{productIdLabel}</span>
                                    <input type="text" placeholder="输入模糊查询" value={metaProductIdQuery} onChange={(e) => setMetaProductIdQuery(e.target.value)} style={{ padding: '4px 8px', minWidth: '140px' }} />
                                </label>
                                {metaOpts.product_ids && metaOpts.product_ids.length > 0 && (
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <span style={{ whiteSpace: 'nowrap' }}>或选择</span>
                                        <select
                                            value={metaProductIdQuery}
                                            onChange={(e) => setMetaProductIdQuery(e.target.value === '' ? '' : e.target.value)}
                                            style={{ padding: '4px 8px', minWidth: '160px', maxWidth: '220px' }}
                                            title={`从已有${productIdLabel}中选择`}
                                        >
                                            <option value="">全部</option>
                                            {metaOpts.product_ids.map(pid => (
                                                <option key={pid} value={pid} title={pid}>{pid.length > 24 ? pid.slice(0, 21) + '...' : pid}</option>
                                            ))}
                                        </select>
                                    </label>
                                )}
                            </>
                        )}
                        {(metaOpts.has_position || Object.prototype.hasOwnProperty.call(sampleMeta, metaFieldMap.position)) && (
                            <>
                                {metaOpts.positions && metaOpts.positions.length > 0 ? (
                            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <span style={{ whiteSpace: 'nowrap' }}>{positionLabel}</span>
                                <select value={metaPosition} onChange={(e) => setMetaPosition(e.target.value)} style={{ padding: '4px 8px' }}>
                                    <option value="all">全部</option>
                                            {metaOpts.positions.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </label>
                                ) : (
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <span style={{ whiteSpace: 'nowrap' }}>{positionLabel}</span>
                                        <input type="text" placeholder="精确匹配" value={metaPosition === 'all' ? '' : metaPosition} onChange={(e) => setMetaPosition(e.target.value || 'all')} style={{ padding: '4px 8px', minWidth: '120px' }} />
                            </label>
                                )}
                            </>
                        )}
                        <button type="button" className="btn btn-primary btn-sm" onClick={handleApplyMetaFilters} disabled={metaFilterApplying}>
                            {metaFilterApplying ? '筛选中...' : '应用筛选'}
                        </button>
                    </div>
                )}
                <div className="top-toolbar top-toolbar--gallery">
                    <div className="gallery-toolbar-primary">
                        <div className="gallery-toolbar-brand">
                            <span className="gallery-toolbar-heading">图库</span>
                            <span className="gallery-toolbar-dataset" title={datasetData.dataset_name || ''}>{datasetData.dataset_name || '数据集'}</span>
                        </div>
                        <div className="gallery-toolbar-core">
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
                        <input className="filter-input gallery-toolbar-search" placeholder="搜索文件名..." value={searchText} onChange={(e) => { setSearchText(e.target.value); setCurrentPage(1); }} />
                        </div>
                        <div className="gallery-toolbar-cta">
                        <button
                            className="btn btn-success btn-sm gallery-toolbar-cta-save"
                            onClick={() => setShowSaveModal(true)}
                            disabled={saving}
                            title={saving ? '保存中...' : (gallery.saveButtonText || '保存到 COCO')}
                        >
                            {saving ? '⏳ 保存中' : '💾 保存'}
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={() => setShowExportModal(true)} title={gallery.exportButtonText || '导出'}>📤 导出</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setShowVersionModal(true)} title={gallery.versionButtonText || '版本'}>📋</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setShowCatMgr(true)} title="类别管理（跨图批量重命名/合并标注类别）">🏷</button>
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setGalleryMoreToolsOpen(o => !o)}
                            title={galleryMoreToolsOpen ? '收起次要筛选与工具' : '展开预测模型、置信度、排序等'}
                        >
                            {galleryMoreToolsOpen ? '收起工具 ▴' : '更多工具 ▾'}
                        </button>
                        </div>
                    </div>
                    {!galleryMoreToolsOpen && (
                        <p className="gallery-toolbar-collapsed-hint" style={{ margin: '6px 0 0', fontSize: '11px', color: 'var(--text-muted)', width: '100%' }}>
                            预测可见性、置信度区间、排序、代码筛选等已收起到「更多工具 ▾」
                        </p>
                    )}
                    {galleryMoreToolsOpen && (
                    <div className="toolbar-right gallery-toolbar-expanded">
                        {/* 预测模型可见性切换（有预测数据时显示） */}
                        {predModelNames.length > 0 && visiblePredModels && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                                <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)' }}>预测模型:</span>
                                {predModelNames.map(model => {
                                    const isOn = visiblePredModels.has(model);
                                    return (
                                        <button
                                            key={model}
                                            className="btn btn-sm"
                                            title={isOn ? `隐藏 ${model} 的预测结果` : `显示 ${model} 的预测结果`}
                                            style={{
                                                fontSize: 'var(--font-xs)', padding: '2px 8px',
                                                background: isOn ? '#2a4a7a' : 'transparent',
                                                color: isOn ? 'var(--accent)' : 'var(--text-muted)',
                                                border: `1px solid ${isOn ? 'var(--accent)' : 'var(--border)'}`,
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
                                    style={{ fontSize: 'var(--font-sm)', padding: '3px 8px' }}
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
                                                    fontSize: 'var(--font-sm)', padding: '3px 8px',
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
                                            className="btn btn-sm" style={{ fontSize: 'var(--font-sm)', padding: '3px 8px', background: 'rgba(111,140,255,0.12)', color: 'var(--accent)', border: '1px solid var(--accent)' }}
                                            title="计算 mAP 等检测指标"
                                            onClick={() => setShowMapModal(true)}
                                        >📊 指标</button>
                                        <button
                                            className="btn btn-sm btn-secondary"
                                            style={{ fontSize: 'var(--font-sm)', padding: '3px 6px' }}
                                            title="关闭预测评估"
                                            onClick={() => { setPredEvalEnabled(false); setPredEvalFilter(null); setPredEvalModel(null); setCurrentPage(1); }}
                                        >✕</button>
                                    </>
                                )}
                            </span>
                        )}
                        {hasScoreData && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                                <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>置信度</span>
                                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--accent)', minWidth: '88px' }}>
                                    {`${scoreMin === '' ? '0.00' : Number(scoreMin).toFixed(2)} ~ ${scoreMax === '' ? '1.00' : Number(scoreMax).toFixed(2)}`}
                                </span>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    style={{ width: '92px' }}
                                    value={scoreMin === '' ? '0' : scoreMin}
                                    onChange={e => {
                                        const nextMin = Number(e.target.value);
                                        const curMax = scoreMax === '' ? 1 : Number(scoreMax);
                                        const safeMin = Math.min(nextMin, curMax);
                                        setScoreMin(safeMin <= 0 ? '' : safeMin.toFixed(2));
                                        setCurrentPage(1);
                                    }}
                                    title="置信度下限"
                                />
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    style={{ width: '92px' }}
                                    value={scoreMax === '' ? '1' : scoreMax}
                                    onChange={e => {
                                        const nextMax = Number(e.target.value);
                                        const curMin = scoreMin === '' ? 0 : Number(scoreMin);
                                        const safeMax = Math.max(nextMax, curMin);
                                        setScoreMax(safeMax >= 1 ? '' : safeMax.toFixed(2));
                                        setCurrentPage(1);
                                    }}
                                    title="置信度上限"
                                />
                                {(scoreMin !== '' || scoreMax !== '') && (
                                    <button
                                        className="btn btn-sm btn-secondary"
                                        style={{ padding: '2px 6px', fontSize: 'var(--font-xs)' }}
                                        onClick={() => { setScoreMin(''); setScoreMax(''); setCurrentPage(1); }}
                                        title="清除置信度筛选"
                                    >✕</button>
                                )}
                            </span>
                        )}
                        <button
                            className={`btn btn-sm ${showCodeFilterPanel || agentFilterIds ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setShowCodeFilterPanel(true)}
                            title="在弹窗中打开 Python 代码筛选（与 Agent 代码块相同接口）"
                        >
                            代码筛选
                        </button>
                        <select value={sortOrder} onChange={e => { setSortOrder(e.target.value); setCurrentPage(1); }}
                            className="sort-select" title="排序方式">
                            <option value="default">默认顺序</option>
                            <option value="name_asc">文件名 A→Z</option>
                            <option value="name_desc">文件名 Z→A</option>
                            <option value="ann_desc">GT框数 多→少</option>
                            <option value="ann_asc">GT框数 少→多</option>
                            {hasPredData && <option value="pred_desc">预测框数 多→少</option>}
                            {hasPredData && <option value="pred_asc">预测框数 少→多</option>}
                            <option value="size_desc">文件大小 大→小</option>
                            <option value="size_asc">文件大小 小→大</option>
                            <option value="mtime_desc">修改时间 新→旧</option>
                            <option value="mtime_asc">修改时间 旧→新</option>
                        </select>
                        {!viewerOpen && selectedImage && (
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => setViewerOpen(true)}
                                title={`按 Enter 也可返回 · ${selectedImage.file_name}`}
                                style={{ whiteSpace: 'nowrap', fontSize: 'var(--font-sm)' }}
                            >↩ 返回上图</button>
                        )}
                        {autoSaveStatus === 'pending' && (
                            <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>⏳ 备份中…</span>
                        )}
                        {autoSaveStatus === 'saved' && (
                            <span style={{ fontSize: 'var(--font-sm)', color: '#52c41a', whiteSpace: 'nowrap' }}>✓ 已备份</span>
                        )}
                        {autoSaveStatus === 'error' && (
                            <span style={{ fontSize: 'var(--font-sm)', color: '#f5222d', whiteSpace: 'nowrap' }}>⚠ 备份失败</span>
                        )}
                    </div>
                    )}
                </div>

                <div className="content-area">
                    <div className="gallery-section">
                        <div className="gallery-header">
                            <span className="gallery-title">
                                {gallery.galleryTitlePrefix} {filteredImages.length} {gallery.galleryTitleSuffix}
                                {selectedImages.size > 0 && ` (${gallery.selectedSuffix} ${selectedImages.size} 张)`}
                            </span>
                            {/* 标注进度条 */}
                            {annotationProgress.total > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto' }}>
                                    <div style={{ position: 'relative', width: '120px', height: '8px', background: 'var(--bg-hover)', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${annotationProgress.total > 0 ? (annotationProgress.annotated / annotationProgress.total * 100) : 0}%`, background: 'var(--success)', borderRadius: '4px', transition: 'width 0.3s' }} />
                                    </div>
                                    <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                        已标注 <span style={{ color: '#52c41a', fontWeight: 'bold' }}>{annotationProgress.annotated}</span> / {annotationProgress.total}
                                    </span>
                                    {annotationProgress.unannotated > 0 && (
                                        <button
                                            onClick={() => { setShowUnannotatedOnly(v => !v); setCurrentPage(1); }}
                                            title={showUnannotatedOnly ? '显示全部图片' : `仅显示无任何 GT 标注框的图片（${annotationProgress.unannotated} 张）`}
                                                style={{ fontSize: 'var(--font-xs)', padding: '2px 8px', background: showUnannotatedOnly ? 'var(--warning)' : 'transparent', color: showUnannotatedOnly ? '#000' : 'var(--warning)', border: '1px solid var(--warning)', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                        >
                                            {showUnannotatedOnly ? '✕ 取消筛选' : `⚠ 无 GT ${annotationProgress.unannotated}`}
                                        </button>
                                    )}
                                </div>
                            )}
                            <div className="gallery-actions">
                                <label style={{marginRight: '15px'}}>
                                    <input type="checkbox" onChange={(e) => setSelectedImages(e.target.checked ? new Set(pageImages.map(i => i.image_id)) : new Set())} /> 全选当页
                                </label>
                                {selectedImages.size > 0 && (
                                    <div className="batch-actions">
                                        <span style={{marginRight: '10px', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)'}}>{gallery.batchSetLabel}</span>
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
                                        {onBatchClearAnnotations && (
                                            <button
                                                className="btn btn-sm"
                                                style={{ background: 'transparent', border: `1px solid var(--danger)`, color: 'var(--danger)', marginLeft: '8px' }}
                                                title={`清空选中 ${selectedImages.size} 张图片的全部 GT 标注`}
                                                onClick={async () => { await onBatchClearAnnotations(Array.from(selectedImages)); setSelectedImages(new Set()); }}
                                            >🗑 批量清空标注</button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="gallery-grid">
                            {pageImages.length === 0 ? (
                                <div className="gallery-empty">
                                    <p className="gallery-empty-title">当前页没有可显示的图片</p>
                                    <p className="gallery-empty-hint">可能受分类、搜索、元数据筛选或预测评估条件影响，可放宽条件或清空搜索后再试。</p>
                                </div>
                            ) : (
                                pageImages.map(img => (
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
                                ))
                            )}
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

            {showCatMgr && (
                <CategoryManagerModal
                    datasetData={datasetData}
                    images={images}
                    onClose={() => setShowCatMgr(false)}
                    onRenamed={() => {
                        if (onReloadImages) onReloadImages();
                    }}
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

            {showCodeFilterPanel && (
                <GalleryCodeFilterModal
                    onClose={() => setShowCodeFilterPanel(false)}
                    datasetId={datasetData?.dataset_id}
                    onFilterByIds={(ids, msg) => {
                        setCurrentPage(1);
                        onFilterByIds && onFilterByIds(ids, msg);
                    }}
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
                    imageCategoryColors={imageCategoryColors}
                    imageCategoryMultiSelect={imageCategoryMultiSelect}
                    onUpdateImageCategories={onUpdateImageCategories}
                    onUpdateImageCategoryColors={onUpdateImageCategoryColors}
                    visiblePredModels={visiblePredModels}
                    onClose={() => setViewerOpen(false)}
                    onNavigate={(img) => setSelectedImage(img)}
                    onUpdateCategory={onUpdateCategory}
                    onUpdateCategories={onUpdateCategories}
                    onUpdateNote={onUpdateNote}
                    onAnnotationsSaved={onAnnotationsSaved}
                />
            )}
        </>
    );
}

// ==================== 设置模态框 ====================
function SettingsModal({ onClose, cocoImageCategoryDefsActive = false }) {
    const config = useConfig();
    const setSettings = useSettings();
    const st = config.settings || DEFAULT_CONFIG.settings || {};
    const viewer = config.viewer || DEFAULT_CONFIG.viewer;
    const lineWidthOptions = viewer.lineWidthOptions || [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
    const colorPalette = config.colorPalette || DEFAULT_CONFIG.colorPalette || ['#888'];
    const currentTheme = config.uiTheme || DEFAULT_CONFIG.uiTheme || 'dark';
    const [activeTab, setActiveTab] = useState('appearance'); // appearance | imageCategories | llm

    const updateViewer = (key, value) => {
        setSettings(prev => ({ ...prev, viewer: { ...(prev.viewer || {}), [key]: value } }));
    };

    const categories = config.imageCategories || DEFAULT_CONFIG.imageCategories || [];
    const categoryColors = config.imageCategoryColors || DEFAULT_CONFIG.imageCategoryColors || {};
    const annDefaults = (config.defaultAnnotationCategories && config.defaultAnnotationCategories.length > 0)
        ? config.defaultAnnotationCategories
        : (DEFAULT_CONFIG.defaultAnnotationCategories || ['object']);

    const updateCategoryName = (index, newName) => {
        if (index === 0) return; // 首项「未分类」不可改
        const name = (newName || '').trim();
        if (!name || name === categories[index]) return;
        const cats = [...categories];
        const cols = { ...categoryColors };
        const oldName = cats[index];
        cats[index] = name;
        cols[name] = cols[oldName] != null ? cols[oldName] : '#888';
        if (oldName !== name) delete cols[oldName];
        setSettings(prev => ({ ...prev, imageCategories: cats, imageCategoryColors: cols }));
    };

    const updateCategoryColor = (index, color) => {
        const name = categories[index];
        if (!name) return;
        setSettings(prev => ({ ...prev, imageCategoryColors: { ...(prev.imageCategoryColors || categoryColors), [name]: color } }));
    };

    const addCategory = () => {
        let name = '新分类';
        const existing = categories;
        if (existing.includes(name)) {
            let n = 1;
            while (existing.includes(name + ' ' + n)) n++;
            name = name + ' ' + n;
        }
        const newColor = colorPalette[existing.length % colorPalette.length];
        setSettings(prev => ({
            ...prev,
            imageCategories: [...(prev.imageCategories || categories), name],
            imageCategoryColors: { ...(prev.imageCategoryColors || categoryColors), [name]: newColor },
        }));
    };

    const removeCategory = (index) => {
        if (index === 0 || categories.length <= 1) return;
        const cats = [...categories];
        const cols = { ...categoryColors };
        const removed = cats[index];
        cats.splice(index, 1);
        delete cols[removed];
        setSettings(prev => ({ ...prev, imageCategories: cats, imageCategoryColors: cols }));
    };

    const resetCategoriesToDefault = () => {
        if (!confirm('确定恢复为默认图片级分类列表？将写入本机设置。')) return;
        setSettings(prev => ({
            ...prev,
            imageCategories: [...DEFAULT_CONFIG.imageCategories],
            imageCategoryColors: { ...DEFAULT_CONFIG.imageCategoryColors },
        }));
    };

    const updateAnnDefaultName = (index, newName) => {
        const name = (newName || '').trim();
        const arr = [...annDefaults];
        if (!name || name === arr[index]) return;
        arr[index] = name;
        setSettings(prev => ({ ...prev, defaultAnnotationCategories: arr }));
    };

    const addAnnDefaultCategory = () => {
        const arr = [...annDefaults];
        let name = 'class';
        if (arr.includes(name)) {
            let n = 1;
            while (arr.includes(name + n)) n++;
            name = name + n;
        }
        setSettings(prev => ({ ...prev, defaultAnnotationCategories: [...arr, name] }));
    };

    const removeAnnDefaultCategory = (index) => {
        if (annDefaults.length <= 1) return;
        const arr = annDefaults.filter((_, i) => i !== index);
        setSettings(prev => ({ ...prev, defaultAnnotationCategories: arr }));
    };

    const resetAnnDefaultsToDefault = () => {
        if (!confirm('确定恢复为内置 GT 默认类别（object）？')) return;
        setSettings(prev => ({ ...prev, defaultAnnotationCategories: [...(DEFAULT_CONFIG.defaultAnnotationCategories || ['object'])] }));
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content settings-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{st.modalTitle || '设置'}</h3>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="modal-body">
                    <div className="settings-layout">
                        <div className="settings-nav">
                            <button
                                type="button"
                                className={`settings-nav-item ${activeTab === 'appearance' ? 'active' : ''}`}
                                onClick={() => setActiveTab('appearance')}
                            >🎨 外观</button>
                            <button
                                type="button"
                                className={`settings-nav-item ${activeTab === 'imageCategories' ? 'active' : ''}`}
                                onClick={() => setActiveTab('imageCategories')}
                            >{st.categoriesTabTitle || '🏷 分类默认值'}</button>
                            <button
                                type="button"
                                className={`settings-nav-item ${activeTab === 'llm' ? 'active' : ''}`}
                                onClick={() => setActiveTab('llm')}
                            >🤖 AI 助手</button>
                        </div>

                        <div className="settings-panel">
                            {activeTab === 'appearance' && (
                                <>
                                    <div className="form-group">
                                        <label className="form-label">{st.themeLabel || '界面主题'}</label>
                                        <select
                                            className="form-input"
                                            value={currentTheme}
                                            onChange={(e) => setSettings(prev => ({ ...prev, uiTheme: e.target.value }))}
                                        >
                                            <option value="dark">{st.themeDarkLabel || '深色'}</option>
                                            <option value="light">{st.themeLightLabel || '浅色'}</option>
                                            <option value="dim">{st.themeDimLabel || '柔和暗色'}</option>
                                        </select>
                                        <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', marginTop: '4px' }}>
                                            {st.themeHint || '支持深色、浅色与柔和暗色，可随时切换。'}
                                        </p>
                                    </div>
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
                                                <span style={{ fontSize: 'var(--font-md)', color: 'var(--text-secondary)' }}>背景色</span>
                                <input type="color" value={viewer.backgroundColor || '#1a1a2e'} onChange={(e) => updateViewer('backgroundColor', e.target.value)} style={{ width: 36, height: 28, padding: 2, cursor: 'pointer' }} />
                            </div>
                        )}
                    </div>
                    <div className="form-group">
                        <label className="form-label">{st.lineWidthDefaultLabel || '默认线宽'}</label>
                        <select className="form-input" value={viewer.lineWidthDefault ?? 0.5} onChange={(e) => updateViewer('lineWidthDefault', Number(e.target.value))}>
                            {lineWidthOptions.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                                        <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', marginTop: '4px' }}>0.1～1 共十档，查看器内可随时调整</p>
                    </div>
                                    <div className="form-group">
                                        <label className="form-label">底部缩略图导航</label>
                                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
                                            <input
                                                type="checkbox"
                                                style={{ marginTop: '3px' }}
                                                checked={viewer.filmstripHiddenByDefault !== true}
                                                onChange={(e) => updateViewer('filmstripHiddenByDefault', !e.target.checked)}
                                            />
                                            <span style={{ fontSize: 'var(--font-md)', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                                                打开看图时显示底部缩略图（不勾选则默认隐藏，可在看图界面点击「🎞 缩略图」打开；显示时会为缩略条预留空间，避免「适应窗口」压住图片）
                                            </span>
                                        </label>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">元筛选字段映射</label>
                                        <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                            用于指定 COCO images 里的字段名，例如时间字段、SN/产品号字段、位置字段。
                                        </p>
                                        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px', alignItems: 'center' }}>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)' }}>时间字段</span>
                                            <input
                                                className="form-input"
                                                value={(viewer.metaFilterFieldMap && viewer.metaFilterFieldMap.c_time) || 'c_time'}
                                                onChange={(e) => updateViewer('metaFilterFieldMap', { ...(viewer.metaFilterFieldMap || {}), c_time: e.target.value })}
                                                placeholder="例如 c_time / capture_time"
                                            />
                                            <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)' }}>SN/产品号字段</span>
                                            <input
                                                className="form-input"
                                                value={(viewer.metaFilterFieldMap && viewer.metaFilterFieldMap.product_id) || 'product_id'}
                                                onChange={(e) => updateViewer('metaFilterFieldMap', { ...(viewer.metaFilterFieldMap || {}), product_id: e.target.value })}
                                                placeholder="例如 product_id / sn / serial_no"
                                            />
                                            <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)' }}>位置字段</span>
                                            <input
                                                className="form-input"
                                                value={(viewer.metaFilterFieldMap && viewer.metaFilterFieldMap.position) || 'position'}
                                                onChange={(e) => updateViewer('metaFilterFieldMap', { ...(viewer.metaFilterFieldMap || {}), position: e.target.value })}
                                                placeholder="例如 position / station"
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">查看器侧栏停靠位置</label>
                                        <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                                <input type="radio" name="sidebarDock" checked={(viewer.sidebarDock || 'right') === 'left'} onChange={() => updateViewer('sidebarDock', 'left')} />
                                                左侧
                                            </label>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                                <input type="radio" name="sidebarDock" checked={(viewer.sidebarDock || 'right') === 'right'} onChange={() => updateViewer('sidebarDock', 'right')} />
                                                右侧
                                            </label>
                                        </div>
                                        <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', marginTop: '4px' }}>
                                            默认右侧。查看器顶部也可一键切换。
                                        </p>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">GT/预测侧栏联动 IoU 阈值</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <input
                                                type="range"
                                                min="0.1"
                                                max="1"
                                                step="0.05"
                                                value={viewer.crossSidebarIouThreshold ?? 0.5}
                                                onChange={(e) => updateViewer('crossSidebarIouThreshold', Number(e.target.value))}
                                                style={{ flex: 1, accentColor: 'var(--accent)' }}
                                            />
                                            <span style={{ minWidth: '44px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                                                {Number(viewer.crossSidebarIouThreshold ?? 0.5).toFixed(2)}
                                            </span>
                                        </div>
                                        <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', marginTop: '4px' }}>
                                            当鼠标悬停在某侧框项时，另一侧 IoU 大于该阈值的框会联动高亮。
                                        </p>
                                    </div>
                                </>
                            )}

                            {activeTab === 'imageCategories' && (
                                <>
                                <details className="settings-scope-details" style={{ marginBottom: '18px', padding: '12px 14px', background: 'var(--bg-soft)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                    <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 'var(--font-sm)', userSelect: 'none' }}>
                                        {st.categoryScopeSummary || '何时用「设置」里的类别？何时以 COCO 文件为准？'}
                                    </summary>
                                    <div style={{ marginTop: '12px', fontSize: 'var(--font-sm)', color: 'var(--text-muted)', lineHeight: 1.55 }}>
                                        <p style={{ margin: '0 0 8px' }}><strong>GT 默认类别</strong>与<strong>图片级分类（全局默认）</strong>保存在本机浏览器；在数据集<strong>没有任何 GT 类别名</strong>或<strong>未写入图片分类定义</strong>时，使用此处列表。</p>
                                        <p style={{ margin: '0 0 8px' }}>若当前 COCO 已包含 <code style={{ background: 'var(--bg-raised)', padding: '1px 5px', borderRadius: '3px' }}>image_category_definitions</code>，则<strong>图片级分类</strong>以<strong>文件内定义</strong>为准（优先级高于下方「图片级分类」全局默认）。</p>
                                        {cocoImageCategoryDefsActive ? (
                                            <p style={{ margin: 0, color: 'var(--accent)', fontWeight: 600 }}>当前已加载数据集：<span style={{ textDecoration: 'underline' }}>正在使用 COCO 文件中的图片分类定义</span>。</p>
                                        ) : (
                                            <p style={{ margin: 0 }}>当前已加载数据集：<strong>未</strong>使用文件内图片分类定义，图库/看图中的图片级标签来自上方全局默认。</p>
                                        )}
                                    </div>
                                </details>
                                <div className="form-group">
                                    <label className="form-label">{st.annotationCategoriesLabel || 'GT 框标注类别（默认）'}</label>
                                    <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', marginBottom: '10px' }}>{st.annotationCategoriesHint || ''}</p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {annDefaults.map((name, i) => (
                                            <div key={`ann-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    defaultValue={name}
                                                    onBlur={(e) => updateAnnDefaultName(i, e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                                    placeholder="类别名"
                                                    style={{ flex: 1, minWidth: 0 }}
                                                />
                                                <button
                                                    type="button"
                                                    className="btn btn-secondary"
                                                    onClick={() => removeAnnDefaultCategory(i)}
                                                    disabled={annDefaults.length <= 1}
                                                    style={{ padding: '6px 10px' }}
                                                    title={annDefaults.length <= 1 ? '至少保留一项' : '删除'}
                                                >删除</button>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                                        <button type="button" className="btn btn-secondary" onClick={addAnnDefaultCategory}>
                                            {st.addAnnotationCategoryButton || '添加类别'}
                                        </button>
                                        <button type="button" className="btn btn-secondary" onClick={resetAnnDefaultsToDefault}>
                                            {st.resetAnnotationCategoriesButton || '恢复 GT 默认'}
                                        </button>
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                        <label className="form-label">{st.imageCategoriesLabel || '图片级分类（全局默认）'}</label>
                                    <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', marginBottom: '10px' }}>{st.imageCategoriesHint || ''}</p>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', cursor: 'pointer', userSelect: 'none' }}>
                                        <input
                                            type="checkbox"
                                            checked={!!(config.imageCategoryMultiSelect ?? DEFAULT_CONFIG.imageCategoryMultiSelect)}
                                            onChange={(e) => setSettings(prev => ({ ...prev, imageCategoryMultiSelect: e.target.checked }))}
                                        />
                                        <span style={{ fontSize: 'var(--font-md)', color: 'var(--text-secondary)' }}>允许图片多分类</span>
                                        <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)' }}>（默认单选，勾选后可为一张图片打多个分类标签）</span>
                                    </label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {categories.map((name, i) => (
                                <div key={`ic-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {i === 0 ? (
                                                    <span className="form-input" style={{ flex: 1, minWidth: 0, background: 'var(--bg-soft)', color: 'var(--text-muted)', cursor: 'not-allowed' }} title="固定，不可修改">未分类</span>
                                    ) : (
                                        <input
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
                                                    value={categoryColors[name] || '#888'}
                                        onChange={(e) => updateCategoryColor(i, e.target.value)}
                                                    style={{ width: 36, height: 32, padding: 2, cursor: i === 0 ? 'default' : 'pointer', border: '1px solid var(--border-strong)', borderRadius: '4px' }}
                                        title="颜色"
                                    />
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => removeCategory(i)}
                                                    disabled={i === 0 || categories.length <= 1}
                                        style={{ padding: '6px 10px' }}
                                                    title={i === 0 ? '未分类不可删除' : (categories.length <= 1 ? '至少保留一个分类' : '删除')}
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
                                </>
                            )}

                            {activeTab === 'llm' && (
                                <div className="form-group">
                                    <label className="form-label">🤖 AI 数据助手 — LLM 配置</label>
                                    <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', marginBottom: '12px' }}>
                                        支持 OpenAI 及兼容接口（如本地 Ollama、Qwen、DeepSeek 等）。API Key 仅保存在本地。
                                    </p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <div>
                                            <label style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>API 地址</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={(config.llm || {}).apiUrl || 'https://api.openai.com/v1/chat/completions'}
                                                onChange={e => setSettings(prev => ({ ...prev, llm: { ...(prev.llm || {}), apiUrl: e.target.value } }))}
                                                placeholder="https://api.openai.com/v1/chat/completions"
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>API Key</label>
                                            <input
                                                type="password"
                                                className="form-input"
                                                value={(config.llm || {}).apiKey || ''}
                                                onChange={e => setSettings(prev => ({ ...prev, llm: { ...(prev.llm || {}), apiKey: e.target.value } }))}
                                                placeholder="sk-..."
                                            />
                                        </div>
                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>模型</label>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    value={(config.llm || {}).model || 'gpt-4o-mini'}
                                                    onChange={e => setSettings(prev => ({ ...prev, llm: { ...(prev.llm || {}), model: e.target.value } }))}
                                                    placeholder="gpt-4o-mini"
                                                />
                                            </div>
                                            <div style={{ width: '100px' }}>
                                                <label style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>最大 Token</label>
                                                <input
                                                    type="number"
                                                    className="form-input"
                                                    value={(config.llm || {}).maxTokens || 2000}
                                                    onChange={e => setSettings(prev => ({ ...prev, llm: { ...(prev.llm || {}), maxTokens: parseInt(e.target.value) || 2000 } }))}
                                                    placeholder="2000"
                                                />
                                            </div>
                                        </div>
                                        <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                                            💡 本地模型示例：Ollama 地址填 <code style={{ background: 'var(--bg-soft)', padding: '1px 4px', borderRadius: '3px' }}>http://localhost:11434/v1/chat/completions</code>，API Key 填任意字符串，模型填 <code style={{ background: 'var(--bg-soft)', padding: '1px 4px', borderRadius: '3px' }}>qwen2.5</code> 等本地已拉取的模型名。
                                        </p>
                                        <div>
                                            <label style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                                                自定义系统提示词
                                                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginLeft: '6px' }}>（会附加在内置提示词之前，留空则只用内置提示词）</span>
                                            </label>
                                            <textarea
                                                className="form-input"
                                                rows={5}
                                                style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.5' }}
                                                value={(config.llm || {}).systemPrompt || ''}
                                                onChange={e => setSettings(prev => ({ ...prev, llm: { ...(prev.llm || {}), systemPrompt: e.target.value } }))}
                                                placeholder={'例如：\n你是一个专注于行人检测数据集的分析专家，回答请尽量简洁，数字保留两位小数。'}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
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

// ==================== 类别管理弹窗（跨图批量重命名/合并） ====================
function CategoryManagerModal({ datasetData, images, onClose, onRenamed }) {
    const config = useConfig();
    const palette = config.colorPalette || DEFAULT_CONFIG.colorPalette;
    // 从 images 中统计所有 GT 类别及数量
    const catStats = React.useMemo(() => {
        const m = {};
        images.forEach(img => {
            (img.annotations || []).forEach(ann => {
                if (ann.category) m[ann.category] = (m[ann.category] || 0) + 1;
            });
        });
        return Object.entries(m).sort((a, b) => b[1] - a[1]);
    }, [images]);

    const [editMap, setEditMap] = useState(() => Object.fromEntries(catStats.map(([c]) => [c, c])));
    const [busy, setBusy] = useState(false);
    const [results, setResults] = useState([]); // [{oldName, newName, status, msg}]

    const handleApply = async () => {
        const changes = catStats.filter(([c]) => editMap[c] && editMap[c].trim() && editMap[c].trim() !== c);
        if (changes.length === 0) { alert('没有需要修改的类别'); return; }
        if (!window.confirm(`即将修改 ${changes.length} 个类别，操作将写入 COCO 文件（自动存档版本），确认？`)) return;
        setBusy(true);
        const newResults = [];
        let anySuccess = false;
        for (const [oldName] of changes) {
            const newName = editMap[oldName].trim();
            try {
                const res = await fetch('/api/rename_category', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dataset_id: datasetData.dataset_id, old_name: oldName, new_name: newName })
                });
                const d = await res.json();
                if (d.success) {
                    newResults.push({ oldName, newName, status: 'ok', msg: d.message });
                    anySuccess = true;
                } else {
                    newResults.push({ oldName, newName, status: 'err', msg: d.error });
                }
            } catch (e) {
                newResults.push({ oldName, newName, status: 'err', msg: e.message });
            }
        }
        setResults(newResults);
        setBusy(false);
        // 全部操作结束后，若有任意成功则触发一次刷新
        if (anySuccess && onRenamed) onRenamed();
    };

    return (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center'}} onClick={onClose}>
            <div style={{background:'var(--bg-surface)', border:'1px solid var(--border-strong)', borderRadius:'12px', padding:'20px', width:'480px', maxWidth:'95vw', maxHeight:'80vh', display:'flex', flexDirection:'column', gap:'12px', boxShadow:'0 16px 48px rgba(0,0,0,0.55)'}} onClick={e => e.stopPropagation()}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <span style={{fontWeight:'bold', fontSize:'15px', color:'var(--text-primary)'}}>🏷 类别管理（跨图批量重命名/合并）</span>
                    <button onClick={onClose} style={{background:'none', border:'none', color:'var(--text-muted)', fontSize:'18px', cursor:'pointer'}}>✕</button>
                </div>
                <div style={{fontSize:'12px', color:'var(--text-muted)'}}>修改右侧输入框中的类别名称，点「应用修改」即可跨全部图片批量改名。若目标名已存在则自动合并。操作前会自动存档版本。</div>

                {results.length > 0 && (
                    <div style={{background:'rgba(62,207,142,0.06)', border:'1px solid rgba(62,207,142,0.2)', borderRadius:'6px', padding:'8px 12px', maxHeight:'120px', overflowY:'auto'}}>
                        {results.map((r, i) => (
                            <div key={i} style={{fontSize:'12px', color: r.status === 'ok' ? '#6f6' : '#f66', padding:'2px 0'}}>
                                {r.status === 'ok' ? '✓' : '✕'} {r.oldName} → {r.newName}：{r.msg}
                            </div>
                        ))}
                    </div>
                )}

                <div style={{overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:'4px'}}>
                    {catStats.length === 0 && <div style={{color:'var(--text-muted)', fontSize:'13px', padding:'20px', textAlign:'center'}}>当前数据集无 GT 标注类别</div>}
                    {catStats.map(([cat, cnt]) => (
                        <div key={cat} style={{display:'flex', alignItems:'center', gap:'8px', padding:'4px 0', borderBottom:'1px solid var(--border)'}}>
                            <div style={{width:'10px', height:'10px', borderRadius:'50%', background: getCategoryColor(palette, cat), flexShrink:0}}></div>
                            <span style={{fontSize:'13px', color:'var(--text-secondary)', flex:'0 0 auto', minWidth:'100px', maxWidth:'160px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}} title={cat}>{cat}</span>
                            <span style={{fontSize:'11px', color:'var(--text-muted)', flex:'0 0 auto'}}>{cnt} 个框</span>
                            <span style={{color:'var(--text-muted)', fontSize:'12px', flex:'0 0 auto'}}>→</span>
                            <input
                                value={editMap[cat] ?? cat}
                                onChange={e => setEditMap(m => ({...m, [cat]: e.target.value}))}
                                style={{flex:1, background: editMap[cat] !== cat ? 'rgba(62,207,142,0.14)' : 'var(--bg-soft)', border:`1px solid ${editMap[cat] !== cat ? 'rgba(62,207,142,0.5)' : 'var(--border)'}`, color: editMap[cat] !== cat ? 'var(--success)' : 'var(--text-secondary)', borderRadius:'4px', padding:'3px 8px', fontSize:'12px', outline:'none'}}
                            />
                        </div>
                    ))}
                </div>

                <div style={{display:'flex', gap:'10px', justifyContent:'flex-end'}}>
                    <button onClick={onClose} className="btn btn-secondary" style={{padding:'6px 18px', borderRadius:'5px', cursor:'pointer'}}>取消</button>
                    <button
                        onClick={handleApply}
                        disabled={busy || catStats.every(([c]) => !editMap[c] || editMap[c].trim() === c)}
                        className="btn btn-success" style={{padding:'6px 18px', borderRadius:'5px', cursor: busy ? 'not-allowed' : 'pointer', fontWeight:'bold', opacity: busy ? 0.5 : 1}}
                    >{busy ? '处理中…' : '应用修改'}</button>
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
                        <p style={{marginBottom: '12px', color: 'var(--text-muted)', fontSize: 'var(--font-md)'}}>
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
                    <p style={{marginBottom: '8px', color: 'var(--text-muted)', fontSize: 'var(--font-md)'}}>
                        {vm.description}
                    </p>
                    {vm.descriptionHint && (
                        <p style={{marginBottom: '12px', color: 'var(--text-muted)', fontSize: 'var(--font-sm)'}}>
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
    const isUnannotated = !image.annotations || image.annotations.length === 0;
    const catColors = imageCategoryColors || {};
    const palette = colorPalette || DEFAULT_CONFIG.colorPalette;
    const defaultCat = DEFAULT_CONFIG.imageCategories && DEFAULT_CONFIG.imageCategories[0];
    const cats = Array.isArray(imageCategory) ? imageCategory : (imageCategory ? [imageCategory] : []);
    const primaryCat = cats[0];
    const showBadge = primaryCat && primaryCat !== defaultCat;

    return (
        <div className={`image-card ${selected ? 'selected' : ''}`} onClick={onClick}
            style={isUnannotated ? { outline: '2px solid rgba(240,160,64,0.5)', outlineOffset: '-2px' } : undefined}>
            <div className="image-card-thumb-wrapper">
                <img className="image-card-thumb" src={thumbUrl} alt={image.file_name} loading="lazy" />
            <div className="image-card-checkbox" onClick={(e) => { e.stopPropagation(); onSelect(!selected); }}>
                <input type="checkbox" checked={selected} readOnly />
            </div>
                {isUnannotated && (
                    <div className="image-card-badge image-card-badge-warning" title="无任何 GT 标注框（非图片级分类）">
                        无 GT
                    </div>
                )}
            {showBadge && (
                    <div className="image-card-category" style={{ background: catColors[primaryCat] || 'var(--text-muted)' }} title={cats.length > 1 ? cats.join(', ') : primaryCat}>
                    {cats.length > 1 ? `${primaryCat}+${cats.length - 1}` : primaryCat}
                </div>
            )}
            {hasNote && <div className="image-card-note-icon" title="有备注">📝</div>}
            </div>
            
            <div className="image-card-info">
                <div className="image-card-header">
                    <div className="image-card-name" title={image.file_name}>{image.file_name.split('/').pop()}</div>
            {image.source_path != null && image.source_path !== '' && (
                <div className="image-card-dir" title={image.source_path}>{image.source_path}</div>
            )}
                </div>
                
                <div className="image-card-meta">
                    <span title="GT 标注数">GT: <strong>{image.annotations?.length || 0}</strong></span>
                    {(image.pred_annotations && image.pred_annotations.length > 0) && (
                        <span title="预测框数" style={{color: 'var(--accent)'}}>Pred: <strong>{image.pred_annotations.length}</strong></span>
                    )}
                </div>

                {labelCategories.length > 0 && (
                <div className="image-card-tags">
                    {labelCategories.map(cat => <span key={cat} className="image-card-tag" style={{ background: getCategoryColor(palette, cat) }}>{cat}</span>)}
                        {image.annotations?.length > 3 && <span className="image-card-tag-more">...</span>}
                </div>
                )}
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
                        <div key="all" className="stats-item" onClick={() => onImageCategoryClick('all')}>
                            <div className="stats-color" style={{ background: '#888' }}></div>
                            <div className="stats-name">全部</div>
                            <div className="stats-percent">100%</div>
                            <div className="stats-count">{totalImages}</div>
                        </div>
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

function drawImageWithBoxes(blob, width, height, annotations, palette, format = 'image/jpeg', quality = 0.85) {
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
                }, format, quality);
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

// ==================== 缩略图导航带 (Filmstrip) ====================
function Filmstrip({ images, currentIndex, datasetId, onNavigateTo, leftInset = 12, rightInset = 'calc(var(--viewer-sidebar-width, 260px) + 12px)' }) {
    const stripRef = useRef(null);
    
    // 当当前图片变化时，让选中的缩略图滚动到视图中央
    useEffect(() => {
        if (!stripRef.current) return;
        const activeEl = stripRef.current.querySelector('.filmstrip-item-active');
        if (activeEl) {
            const containerCenter = stripRef.current.clientWidth / 2;
            const elCenter = activeEl.offsetLeft + activeEl.offsetWidth / 2;
            stripRef.current.scrollTo({
                left: elCenter - containerCenter,
                behavior: 'smooth'
            });
        }
    }, [currentIndex]);

    // 计算要显示的图片范围，避免渲染太多导致卡顿。当前后各取 20 张
    const startIdx = Math.max(0, currentIndex - 20);
    const endIdx = Math.min(images.length - 1, currentIndex + 20);
    const visibleImages = [];
    for (let i = startIdx; i <= endIdx; i++) {
        visibleImages.push({ img: images[i], idx: i });
    }

    return (
        <div 
            ref={stripRef}
            style={{
                position: 'absolute',
                bottom: '12px',
                left: typeof leftInset === 'number' ? `${leftInset}px` : leftInset,
                right: typeof rightInset === 'number' ? `${rightInset}px` : rightInset,
                display: 'flex',
                gap: '8px',
                padding: '8px 12px',
                background: 'rgba(15,17,23,0.85)',
                border: '1px solid var(--border-strong)',
                borderRadius: '8px',
                overflowX: 'auto',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                zIndex: 900
            }}
            className="filmstrip-container custom-scrollbar"
            onWheel={(e) => {
                // 将上下滚轮转换为左右滚动
                if (e.deltaY !== 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    stripRef.current.scrollLeft += e.deltaY;
                }
            }}
        >
            {visibleImages.map(({ img, idx }) => {
                const isActive = idx === currentIndex;
                let thumbUrl = `/api/get_image?dataset_id=${datasetId}&file_name=${encodeURIComponent(img.file_name)}`;
                if (img.source_path != null && img.source_path !== '') thumbUrl += `&source_path=${encodeURIComponent(img.source_path)}`;
                
                return (
                    <div 
                        key={img.image_id}
                        className={isActive ? 'filmstrip-item-active' : ''}
                        onClick={(e) => { e.stopPropagation(); onNavigateTo(idx); }}
                        style={{
                            flexShrink: 0,
                            width: '60px',
                            height: '45px',
                            borderRadius: '4px',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            border: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                            opacity: isActive ? 1 : 0.6,
                            transition: 'all 0.2s',
                            background: 'var(--bg-base)'
                        }}
                        title={img.file_name.split('/').pop()}
                        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={e => { if (!isActive) e.currentTarget.style.opacity = '0.6'; }}
                    >
                        <img 
                            src={thumbUrl} 
                            alt="" 
                            draggable={false}
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                            loading="lazy"
                        />
                    </div>
                );
            })}
        </div>
    );
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
    const [exportWithBoxes, setExportWithBoxes] = useState(false);
    const [exportMultiCategoryMode, setExportMultiCategoryMode] = useState('all'); // 'all' 放入所有归属目录 | 'priority' 仅放入最高优先级目录
    const [exportTab, setExportTab] = useState('category'); // 'category' | 'experiment'
    const [expProgressPct, setExpProgressPct] = useState(null); // 实验导出进度 0–100（服务端真实进度），null 表示不显示
    const [expTrainRatio, setExpTrainRatio] = useState(0.8);
    const [expSeed, setExpSeed] = useState(42);
    const [expDropDupes, setExpDropDupes] = useState(true);
    const defaultZipName = `${datasetData?.dataset_name || 'export'}_分类导出.zip`;
    const [zipFileName, setZipFileName] = useState(defaultZipName);
    const [expZipName, setExpZipName] = useState(() => {
        const n = datasetData?.dataset_name || 'export';
        return n.toLowerCase().endsWith('.zip') ? n : `${n}.zip`;
    });
    const [expOutputPath, setExpOutputPath] = useState(() => {
        try {
            return localStorage.getItem('cocovis_experiment_output_path') || '';
        } catch (e) {
            return '';
        }
    });
    useEffect(() => {
        if (datasetData?.dataset_name) setZipFileName(`${datasetData.dataset_name}_分类导出.zip`);
    }, [datasetData?.dataset_name]);
    useEffect(() => {
        if (datasetData?.dataset_name) {
            const n = datasetData.dataset_name;
            setExpZipName(n.toLowerCase().endsWith('.zip') ? n : `${n}.zip`);
        }
    }, [datasetData?.dataset_name]);

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
                                const bboxName = imageName.replace(/\.[^.]+$/, '') + '_bbox.jpg';
                                try {
                                    const bboxBlob = await drawImageWithBoxes(blob, img.width, img.height, img.annotations, palette, 'image/jpeg', 0.85);
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

    const handleExperimentExport = async () => {
        if (!datasetData?.dataset_id) {
            alert('请先加载数据集');
            return;
        }
        setExporting(true);
        setExportProgress(exp.experimentProgress || '连接服务器…');
        setExpProgressPct(0);
        try {
            const defName = (() => {
                const n = datasetData.dataset_name || 'export';
                return n.toLowerCase().endsWith('.zip') ? n : `${n}.zip`;
            })();
            let name = (expZipName && expZipName.trim()) ? expZipName.trim() : defName;
            if (!name.endsWith('.zip')) name += '.zip';
            const res = await fetch('/api/export_experiment_dataset_stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dataset_id: datasetData.dataset_id,
                    train_ratio: expTrainRatio,
                    seed: expSeed,
                    zip_name: name,
                    dataset_name: datasetData.dataset_name || 'dataset',
                    drop_duplicate_basenames: expDropDupes,
                    ...(expOutputPath.trim() ? { output_path: expOutputPath.trim() } : {}),
                }),
            });
            if (!res.ok) {
                let errMsg = `HTTP ${res.status}`;
                try {
                    const errBody = await res.json();
                    if (errBody.error) errMsg = errBody.error;
                } catch (e) { /* ignore */ }
                alert(errMsg);
                return;
            }
            const reader = res.body && res.body.getReader ? res.body.getReader() : null;
            if (!reader) {
                alert('浏览器不支持流式响应');
                return;
            }
            const decoder = new TextDecoder();
            let buffer = '';
            let donePayload = null;
            while (true) {
                const { done, value } = await reader.read();
                if (value) buffer += decoder.decode(value, { stream: !done });
                let nl;
                while ((nl = buffer.indexOf('\n')) >= 0) {
                    const line = buffer.slice(0, nl).trim();
                    buffer = buffer.slice(nl + 1);
                    if (!line) continue;
                    let obj;
                    try {
                        obj = JSON.parse(line);
                    } catch (e) {
                        continue;
                    }
                    if (obj.type === 'progress') {
                        if (typeof obj.pct === 'number') setExpProgressPct(Math.min(100, Math.max(0, obj.pct)));
                        if (obj.message) setExportProgress(obj.message);
                    } else if (obj.type === 'error') {
                        setExpProgressPct(0);
                        alert(obj.message || '导出失败');
                        return;
                    } else if (obj.type === 'done') {
                        donePayload = obj;
                        setExpProgressPct(100);
                    }
                }
                if (done) break;
            }
            const tail = buffer.trim();
            if (tail && !donePayload) {
                try {
                    const obj = JSON.parse(tail);
                    if (obj.type === 'done') {
                        donePayload = obj;
                        setExpProgressPct(100);
                    }
                    else if (obj.type === 'error') {
                        setExpProgressPct(0);
                        alert(obj.message || '导出失败');
                        return;
                    }
                } catch (e) { /* ignore */ }
            }
            const savedPath = donePayload.saved_path || (donePayload.stats && donePayload.stats.saved_path);
            if (!donePayload || (!donePayload.download_url && !savedPath)) {
                alert('未收到完成结果，请重试');
                return;
            }
            if (donePayload.download_url) {
                window.open(donePayload.download_url, '_blank');
            }
            const st = donePayload.stats || {};
            const dupN = st.dedupe_dropped_count;
            let msg = `导出成功。\n训练 ${st.train ?? '?'} 张，验证 ${st.valid ?? '?'} 张（种子 ${st.seed ?? expSeed}）。`;
            if (dupN > 0) {
                msg += `\n已丢弃 ${dupN} 张重名图片（保留较小 image_id）。`;
            }
            if (typeof st.zip_size_bytes === 'number' && st.zip_size_bytes > 0) {
                msg += `\nZIP 约 ${(st.zip_size_bytes / (1024 * 1024)).toFixed(1)} MB。`;
            }
            if (st.storage_note) {
                msg += `\n${st.storage_note}`;
            }
            if (savedPath) {
                msg += `\n文件路径：${savedPath}`;
            }
            if (donePayload.download_url) {
                msg += '\n若未自动下载，请检查浏览器弹窗拦截。';
            }
            alert(msg);
            onClose();
        } catch (err) {
            setExpProgressPct(0);
            alert('导出失败: ' + err.message);
        } finally {
            setExportProgress('');
            setExporting(false);
            setExpProgressPct(null);
        }
    };

    const defaultCat = catList[0] || '未分类';
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: exportTab === 'experiment' ? '580px' : undefined }}>
                <div className="modal-header">
                    <h3>{exportTab === 'category' ? exp.modalTitle : (exp.experimentTitle || '实验数据集导出')}</h3>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="modal-body">
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            className={exportTab === 'category' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                            onClick={() => setExportTab('category')}
                            disabled={exporting}
                        >{exp.tabCategory || '按分类'}</button>
                        <button
                            type="button"
                            className={exportTab === 'experiment' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                            onClick={() => setExportTab('experiment')}
                            disabled={exporting}
                        >{exp.tabExperiment || '实验 train/valid'}</button>
                    </div>
                    {exportTab === 'category' ? (
                    <>
                    <p style={{marginBottom: '15px', color: 'var(--text-muted)'}}>{exp.modalDescription}</p>
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: 'var(--font-md)', color: 'var(--text-secondary)' }}>ZIP 文件名</label>
                        <input
                            type="text"
                            className="filter-input"
                            value={zipFileName}
                            onChange={(e) => setZipFileName(e.target.value)}
                            placeholder={defaultZipName}
                            style={{ width: '100%', maxWidth: '400px' }}
                        />
                        <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', marginLeft: '8px' }}>（不含路径，未填则用默认名）</span>
                    </div>
                    <div style={{ marginBottom: '15px' }}>
                        <span style={{ fontSize: 'var(--font-md)', color: 'var(--text-secondary)', marginRight: '10px' }}>多类别图片：</span>
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
                        <span>同时导出带框图片（每张原图会多生成一张 _bbox.jpg，框上方显示类别；若有 score 则显示置信度）</span>
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
                    </>
                    ) : (
                    <div className="export-experiment-panel">
                        <p className="export-experiment-lead">{exp.experimentLead || exp.experimentDescription}</p>

                        <div className="export-experiment-section-title">{exp.experimentSectionParams || '划分参数'}</div>
                        <div className="export-experiment-grid">
                            <div className="export-experiment-field">
                                <label className="export-experiment-label">{exp.experimentTrainRatio || '训练集比例'}</label>
                                <input
                                    type="number"
                                    className="filter-input export-experiment-input"
                                    min={0.05}
                                    max={0.95}
                                    step={0.05}
                                    value={expTrainRatio}
                                    onChange={(e) => setExpTrainRatio(parseFloat(e.target.value) || 0.8)}
                                />
                                <span className="export-experiment-unit">0–1</span>
                            </div>
                            <div className="export-experiment-field">
                                <label className="export-experiment-label">{exp.experimentSeed || '随机种子'}</label>
                                <input
                                    type="number"
                                    className="filter-input export-experiment-input"
                                    step={1}
                                    value={expSeed}
                                    onChange={(e) => setExpSeed(parseInt(e.target.value, 10) || 0)}
                                />
                            </div>
                        </div>

                        <div className="export-experiment-section-title">{exp.experimentSectionDup || '重名处理'}</div>
                        <div className="export-experiment-dup-box">
                            <label className="export-experiment-checkbox-row">
                                <input
                                    type="checkbox"
                                    checked={expDropDupes}
                                    onChange={(e) => setExpDropDupes(e.target.checked)}
                                    disabled={exporting}
                                />
                                <span className="export-experiment-checkbox-title">{exp.experimentDropDupes || '丢弃重名图片'}</span>
                            </label>
                            <p className="export-experiment-hint">{exp.experimentDropDupesHint}</p>
                            {!expDropDupes && (
                                <p className="export-experiment-hint export-experiment-hint--warn">{exp.experimentStrictDupesHint}</p>
                            )}
                        </div>

                        <div className="export-experiment-section-title">{exp.experimentSectionOutput || '输出文件'}</div>
                        <div className="export-experiment-field export-experiment-field--full">
                            <label className="export-experiment-label">{exp.experimentZipLabel || 'ZIP 文件名'}</label>
                            <input
                                type="text"
                                className="filter-input export-experiment-input-full"
                                value={expZipName}
                                onChange={(e) => setExpZipName(e.target.value)}
                                placeholder={(() => {
                                    const n = datasetData?.dataset_name || 'export';
                                    return n.toLowerCase().endsWith('.zip') ? n : `${n}.zip`;
                                })()}
                            />
                        </div>
                        <div className="export-experiment-field export-experiment-field--full">
                            <label className="export-experiment-label">{exp.experimentOutputPathLabel || '服务端保存路径（可选）'}</label>
                            <input
                                type="text"
                                className="filter-input export-experiment-input-full"
                                value={expOutputPath}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    setExpOutputPath(v);
                                    try {
                                        localStorage.setItem('cocovis_experiment_output_path', v);
                                    } catch (err) { /* ignore */ }
                                }}
                                placeholder={exp.experimentOutputPathPlaceholder || '/path/to/dir 或 /path/to/file.zip'}
                                autoComplete="off"
                                spellCheck={false}
                            />
                            <p className="export-experiment-hint" style={{ marginTop: '8px' }}>{exp.experimentOutputPathHint || ''}</p>
                        </div>
                        <p className="export-experiment-footnote">{exp.experimentFootnote}</p>
                    </div>
                    )}
                </div>
                {exporting && exportProgress && (
                    <div className="modal-progress">
                        <span className="modal-progress-text">{exportProgress}</span>
                        {exportTab === 'experiment' && expProgressPct != null && (
                            <>
                                <div
                                    className="export-progress-track"
                                    role="progressbar"
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-valuenow={expProgressPct}
                                    aria-label="实验数据集导出进度"
                                >
                                    <div className="export-progress-fill" style={{ width: `${expProgressPct}%` }} />
                                </div>
                                <div className="export-progress-meta">{expProgressPct}%</div>
                            </>
                        )}
                    </div>
                )}
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose} disabled={exporting}>取消</button>
                    {exportTab === 'category' ? (
                        <button className="btn btn-primary" onClick={handleExport} disabled={exporting || selectedCategories.size === 0}>
                            {exporting ? '导出中...' : exp.exportButtonText}
                        </button>
                    ) : (
                        <button className="btn btn-primary" onClick={handleExperimentExport} disabled={exporting}>
                            {exporting ? '导出中...' : (exp.experimentExportButton || '导出实验包')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ==================== 标注类别选择弹窗 ====================
// C10: 对比面板（独立可缩放/平移）
function ComparePane({ syncState, image, imageUrl, type, palette, lineWidth, annFill, hiddenCats, brightness, contrast, visiblePredModels, confOpacity, confThreshold = 0 }) {
    const canvasRef = useRef(null);
    const imgRef = useRef(null);
    const containerRef = useRef(null);
    const dragRef = useRef(null);
    
    const [localZoom, setLocalZoom] = useState(0.5);
    const [localPanX, setLocalPanX] = useState(0);
    const [localPanY, setLocalPanY] = useState(0);

    const zoom = syncState ? syncState.zoom : localZoom;
    const setZoom = syncState ? syncState.setZoom : setLocalZoom;
    const panX = syncState ? syncState.panX : localPanX;
    const setPanX = syncState ? syncState.setPanX : setLocalPanX;
    const panY = syncState ? syncState.panY : localPanY;
    const setPanY = syncState ? syncState.setPanY : setLocalPanY;

    const [imgLoaded, setImgLoaded] = useState(false);

    const calcFit = () => {
        const el = containerRef.current;
        if (!el) return 0.5;
        const iw = image.width || (imgRef.current ? imgRef.current.naturalWidth : 1) || 1;
        const ih = image.height || (imgRef.current ? imgRef.current.naturalHeight : 1) || 1;
        return Math.min((el.clientWidth - 16) / iw, (el.clientHeight - 16) / ih, 1);
    };

    // 绘制标注到 canvas
    const drawAnns = useCallback(() => {
        const canvas = canvasRef.current, img = imgRef.current;
        if (!canvas || !img || img.naturalWidth === 0) return;
        const iw = image.width || img.naturalWidth, ih = image.height || img.naturalHeight;
        const dw = iw * zoom, dh = ih * zoom;
        canvas.width = dw; canvas.height = dh;
        canvas.style.width = dw + 'px'; canvas.style.height = dh + 'px';
        const ctx = canvas.getContext('2d');
        const sx = dw / iw, sy = dh / ih;
        ctx.clearRect(0, 0, dw, dh);
        const DASHES = [[8,4],[4,4],[2,4],[10,4,2,4],[14,4]];
        if (type === 'gt') {
            image.annotations.forEach(ann => {
                if (!ann.bbox || hiddenCats.has(ann.category)) return;
                if (!passesConfThreshold(ann, confThreshold)) return;
                const [x, y, bw, bh] = ann.bbox;
                const color = getCategoryColor(palette, ann.category);
                ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, lineWidth * zoom * 4);
                ctx.strokeRect(x*sx, y*sy, bw*sx, bh*sy);
                if (annFill) { ctx.fillStyle = color+'22'; ctx.fillRect(x*sx, y*sy, bw*sx, bh*sy); }
                const label = ann.score != null
                    ? `${ann.category}  ${Math.round(bw)}×${Math.round(bh)}  ${(Number(ann.score)*100).toFixed(0)}%`
                    : `${ann.category}  ${Math.round(bw)}×${Math.round(bh)}`;
                ctx.font = 'bold 11px sans-serif';
                const lw2 = ctx.measureText(label).width + 8, lh = 16;
                const lx = x*sx, ly = y*sy > lh+2 ? y*sy-lh-2 : y*sy+2;
                ctx.fillStyle = color; ctx.fillRect(lx, ly, lw2, lh);
                ctx.fillStyle = '#fff'; ctx.fillText(label, lx+4, ly+lh-4);
            });
        } else {
            const predAnns = image.pred_annotations || [];
            const predModels = [...new Set(predAnns.map(a => a._pred_source))];
            predAnns.forEach(ann => {
                if (!ann.bbox || hiddenCats.has(ann.category)) return;
                if (visiblePredModels && !visiblePredModels.has(ann._pred_source)) return;
                if (!passesConfThreshold(ann, confThreshold)) return;
                const [x, y, bw, bh] = ann.bbox;
                const color = getCategoryColor(palette, ann.category);
                ctx.globalAlpha = confOpacity && ann.score != null ? Math.max(0.25, Number(ann.score)) : 1;
                const dash = DASHES[predModels.indexOf(ann._pred_source) % DASHES.length];
                ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, lineWidth * zoom * 4);
                ctx.setLineDash(dash); ctx.strokeRect(x*sx, y*sy, bw*sx, bh*sy); ctx.setLineDash([]);
                if (annFill) { ctx.fillStyle = color+'22'; ctx.fillRect(x*sx, y*sy, bw*sx, bh*sy); }
                ctx.globalAlpha = 1;
                const label = ann.score != null
                    ? `${ann.category}  ${Math.round(bw)}×${Math.round(bh)}  ${(ann.score*100).toFixed(0)}%`
                    : `${ann.category}  ${Math.round(bw)}×${Math.round(bh)}`;
                ctx.font = 'bold 11px sans-serif';
                const lw2 = ctx.measureText(label).width + 8, lh = 16;
                const lx = x*sx, ly = y*sy > lh+2 ? y*sy-lh-2 : y*sy+2;
                ctx.fillStyle = color+'cc'; ctx.fillRect(lx, ly, lw2, lh);
                ctx.fillStyle = '#fff'; ctx.fillText(label, lx+4, ly+lh-4);
            });
        }
    }, [image, zoom, type, palette, lineWidth, annFill, hiddenCats, visiblePredModels, confOpacity, confThreshold, imgLoaded]);

    useEffect(() => { drawAnns(); }, [drawAnns]);

    // 滚轮缩放（无需 Ctrl）
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const h = (e) => {
            if (!e.deltaY) return; // 忽略纯横向滚动，避免意外缩放
            e.preventDefault();
            e.stopPropagation();
            // 放开缩放上限，允许放大到任意尺度 (原限制为 50)
            setZoom(z => Math.max(0.01, z * (e.deltaY < 0 ? 1.12 : 0.9)));
        };
        el.addEventListener('wheel', h, { passive: false, capture: true });
        return () => el.removeEventListener('wheel', h, { capture: true });
    }, [setZoom]);

    const handleLoad = () => {
        setImgLoaded(true);
        // 等 DOM 稳定后计算 fit
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const z = calcFit();
                const newZ = z > 0.01 ? z : 0.5;
                if (syncState && syncState.registerLoad) {
                    syncState.registerLoad(newZ);
                } else {
                    setZoom(newZ);
                }
                if (!syncState) { setPanX(0); setPanY(0); }
            });
        });
    };

    // ResizeObserver: 容器尺寸变化时重新计算 fit
    useEffect(() => {
        const el = containerRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return;
        const ro = new ResizeObserver(() => {
            if (imgRef.current && imgRef.current.naturalWidth > 0) {
                const z = calcFit();
                if (z > 0.01) {
                    if (syncState && syncState.registerLoad) {
                        // Let the layout sync it, but avoid infinite loops
                    } else {
                        setZoom(z); setPanX(0); setPanY(0);
                    }
                }
            }
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, [syncState]); // eslint-disable-line

    // 图片切换时重置
    useEffect(() => {
        setImgLoaded(false);
        if (!syncState) { setPanX(0); setPanY(0); }
        const t = setTimeout(() => {
            if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
                handleLoad();
            }
        }, 150);
        return () => clearTimeout(t);
    }, [image.image_id, syncState]); // eslint-disable-line

    const iw = (image.width || 1) * zoom, ih = (image.height || 1) * zoom;
    const filterStyle = brightness !== 100 || contrast !== 100 ? { filter:`brightness(${brightness}%) contrast(${contrast}%)` } : {};

    return (
        <div style={{position:'absolute', inset:0, overflow:'hidden', cursor: dragRef.current ? 'grabbing' : 'grab'}} ref={containerRef}
            onMouseDown={e => { e.preventDefault(); dragRef.current = { x:e.clientX, y:e.clientY, px:panX, py:panY }; }}
            onMouseMove={e => { if (!dragRef.current) return; setPanX(dragRef.current.px+e.clientX-dragRef.current.x); setPanY(dragRef.current.py+e.clientY-dragRef.current.y); }}
            onMouseUp={() => { dragRef.current = null; }}
            onMouseLeave={() => { dragRef.current = null; }}
        >
            {/* 居中定位，通过 panX/panY 偏移 */}
            <div style={{position:'absolute', left:`calc(50% + ${panX}px)`, top:`calc(50% + ${panY}px)`, transform:'translate(-50%,-50%)', lineHeight:0, userSelect:'none'}}>
                <img ref={imgRef} src={imageUrl} alt="" draggable={false}
                    style={{ width: iw, height: ih, display:'block', ...filterStyle }}
                    onLoad={handleLoad} />
                <canvas ref={canvasRef} style={{position:'absolute', top:0, left:0, pointerEvents:'none', width:iw, height:ih}}></canvas>
            </div>
            {/* 缩放提示 */}
            <div style={{position:'absolute', bottom:4, right:6, fontSize:'10px', color:'var(--text-muted)', pointerEvents:'none', background:'rgba(0,0,0,0.5)', padding:'2px 6px', borderRadius:'4px'}}>
                {Math.round(zoom*100)}%
            </div>
        </div>
    );
}

// 包装组件：实现双栏状态同步
function CompareLayout({ currentImage, imageUrl, palette, lineWidth, annFill, hiddenCats, brightness, contrast, visiblePredModels, confOpacity, confThresholdGT, confThresholdPred }) {
    const [zoom, setZoom] = useState(0.5);
    const [panX, setPanX] = useState(0);
    const [panY, setPanY] = useState(0);
    const loadsRef = useRef(0);

    useEffect(() => {
        loadsRef.current = 0;
        setPanX(0);
        setPanY(0);
    }, [currentImage.image_id]);

    const syncState = {
        zoom, setZoom, panX, setPanX, panY, setPanY,
        registerLoad: (z) => {
            loadsRef.current++;
            if (loadsRef.current === 1 || z < zoom) {
                setZoom(z);
            }
        }
    };

    const gtVisCount = (() => { const g = currentImage.annotations; const vis = g.filter(a => passesConfThreshold(a, confThresholdGT)).length; const tot = g.length; return confThresholdGT > 0 && g.some(a => a.score != null) ? `${vis}/${tot}` : String(tot); })();
    const predVisCount = (() => { const preds = currentImage.pred_annotations || []; const inModel = preds.filter(a => !visiblePredModels || visiblePredModels.has(a._pred_source)); const vis = inModel.filter(a => passesConfThreshold(a, confThresholdPred)).length; const tot = inModel.length; return confThresholdPred > 0 && preds.some(a => a.score != null) ? `${vis}/${tot}` : String(tot); })();

    return (
        <div style={{display:'flex', flex:1, overflow:'hidden', gap:'2px'}}>
            {/* 左：GT 标注 */}
            <div style={{flex:1, display:'flex', flexDirection:'column', overflow:'hidden', borderRight:'2px solid #333'}}>
                <div className="compare-pane-label compare-pane-label--gt">✔ GT 标注 ({gtVisCount})</div>
                <div style={{flex:1, overflow:'hidden', position:'relative', background:'var(--bg-soft)'}}>
                    <ComparePane syncState={syncState} image={currentImage} imageUrl={imageUrl} type="gt" palette={palette} lineWidth={lineWidth} annFill={annFill} hiddenCats={hiddenCats} brightness={brightness} contrast={contrast} confThreshold={confThresholdGT} />
                </div>
            </div>
            {/* 右：预测结果 */}
            <div style={{flex:1, display:'flex', flexDirection:'column', overflow:'hidden'}}>
                <div className="compare-pane-label compare-pane-label--pred">⋯ 预测结果 ({predVisCount})</div>
                <div style={{flex:1, overflow:'hidden', position:'relative', background:'var(--bg-soft)'}}>
                    <ComparePane syncState={syncState} image={currentImage} imageUrl={imageUrl} type="pred" palette={palette} lineWidth={lineWidth} annFill={annFill} hiddenCats={hiddenCats} brightness={brightness} contrast={contrast} visiblePredModels={visiblePredModels} confOpacity={confOpacity} confThreshold={confThresholdPred} />
                </div>
            </div>
        </div>
    );
}

function CategoryPicker({ categories, lastCategory, onConfirm, onCancel }) {
    const [newCat, setNewCat] = React.useState('');
    const inputRef = React.useRef(null);
    React.useEffect(() => { inputRef.current && inputRef.current.focus(); }, []);

    // 上次类别排在最前
    const orderedCats = lastCategory
        ? [lastCategory, ...categories.filter(c => c !== lastCategory)]
        : categories;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9800,
            background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'all',
        }} onClick={e => e.target === e.currentTarget && onCancel()}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: '12px', padding: '18px 22px', minWidth: '260px', maxWidth: '380px', boxShadow: '0 16px 48px rgba(0,0,0,0.55)' }}>
                <div style={{ color: 'var(--text-primary)', fontWeight: '600', marginBottom: '12px', fontSize: 'var(--font-lg)' }}>选择标注类别
                    {lastCategory && <span style={{fontSize:'11px',color:'var(--text-muted)',fontWeight:'normal',marginLeft:'8px'}}>Enter = 重用上次类别</span>}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                    {orderedCats.map((cat, i) => (
                        <button key={cat} onClick={() => onConfirm(cat)} style={{
                            padding: '5px 12px', borderRadius: '6px',
                            border: `1px solid ${i === 0 && lastCategory ? '#ffaa00' : '#4a7af0'}`,
                            background: i === 0 && lastCategory ? '#2a2000' : '#1a2a4a',
                            color: i === 0 && lastCategory ? '#ffdd00' : '#7af',
                            cursor: 'pointer', fontSize: 'var(--font-md)',
                            fontWeight: i === 0 && lastCategory ? 'bold' : 'normal',
                        }}>
                            {i === 0 && lastCategory ? `★ ${cat}` : cat}
                        </button>
                    ))}
                </div>
                <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', marginBottom: '6px' }}>或输入新类别：</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                        ref={inputRef}
                        type="text"
                        value={newCat}
                        onChange={e => setNewCat(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                if (newCat.trim()) onConfirm(newCat.trim());
                                else if (lastCategory) onConfirm(lastCategory);
                            }
                            if (e.key === 'Escape') onCancel();
                        }}
                        placeholder={lastCategory ? `回车重用: ${lastCategory}` : '新类别名称'}
                        className="form-input" style={{ flex: 1, padding: '5px 10px', fontSize: 'var(--font-md)' }}
                    />
                    <button onClick={() => { if (newCat.trim()) onConfirm(newCat.trim()); else if (lastCategory) onConfirm(lastCategory); }}
                        className="btn btn-primary" style={{ padding: '5px 14px', fontSize: 'var(--font-md)' }}>确认</button>
                    <button onClick={onCancel} className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: 'var(--font-md)' }}>取消</button>
                </div>
            </div>
        </div>
    );
}

// ==================== 图片查看器（查看 + 标注编辑） ====================
function ImageViewer({ image, images, datasetId, categories, imageClassifications, imageNotes, imageCategories, imageCategoryColors, imageCategoryMultiSelect, onUpdateImageCategories, onUpdateImageCategoryColors, visiblePredModels, onClose, onNavigate, onUpdateCategory, onUpdateCategories, onUpdateNote, onAnnotationsSaved }) {
    const config = useConfig();
    const setSettings = useSettings();
    const viewer = config.viewer || DEFAULT_CONFIG.viewer;
    const catList = imageCategories || DEFAULT_CONFIG.imageCategories;
    const palette = config.colorPalette || DEFAULT_CONFIG.colorPalette;
    const multiSelectCat = !!(imageCategoryMultiSelect ?? config.imageCategoryMultiSelect ?? DEFAULT_CONFIG.imageCategoryMultiSelect);
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
    const crossSidebarIouThreshold = Math.max(0, Math.min(1, Number(viewer.crossSidebarIouThreshold ?? 0.5)));
    const lineWidthOpts = viewer.lineWidthOptions || [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
    const [lineWidth, setLineWidth] = useState(() => {
        const d = viewer.lineWidthDefault;
        return (typeof d === 'number' && lineWidthOpts.includes(d)) ? d : (lineWidthOpts[4] ?? 0.5);
    });
    const [currentImage, setCurrentImage] = useState(image || null);
    const [noteInput, setNoteInput] = useState('');
    const noteInputRef = useRef(null);
    const [newImageCategoryName, setNewImageCategoryName] = useState('');

    // ---- 标注编辑模式 ----
    const editCanvasRef = useRef(null);
    const [annotateMode, setAnnotateMode] = useState(false);
    const [localAnns, setLocalAnns] = useState([]); // 编辑中的 annotations 深拷贝
    const [annoTool, setAnnoTool] = useState('draw'); // 'draw' | 'select'
    const [drawingBox, setDrawingBox] = useState(null); // { x0, y0, x1, y1 } 图片坐标
    const [selectedAnnIdx, setSelectedAnnIdx] = useState(null);
    const [dragOp, setDragOp] = useState(null); // null | 'move' | 'resize-nw' | 'resize-n' | ...
    const annoEditRef = useRef(null); // { imgX0, imgY0, origBbox, annIdx }
    const undoStack = useRef([]);
    const redoStack = useRef([]);
    const [categoryPickerBbox, setCategoryPickerBbox] = useState(null); // 待分类的新框 bbox
    const [saveStatus, setSaveStatus] = useState('idle'); // 'idle'|'saving'|'saved'|'error'
    const [dirty, setDirty] = useState(false);
    const annotateModeRef = useRef(false);
    useEffect(() => { annotateModeRef.current = annotateMode; }, [annotateMode]);
    const annoToolRef = useRef('draw');
    useEffect(() => { annoToolRef.current = annoTool; }, [annoTool]);
    const spaceRef = useRef(false);        // 空格键按住（标注模式临时平移）
    const lastCategoryRef = useRef('');    // 上次使用的类别（快速标注）
    const [quickMode, setQuickMode] = useState(false); // 快速标注：使用上次类别不弹窗
    const [editCursor, setEditCursor] = useState('crosshair'); // editCanvas 动态光标
    const localAnnsRef = useRef([]);       // 同步 localAnns 到 ref 供事件闭包使用
    useEffect(() => { localAnnsRef.current = localAnns; }, [localAnns]);
    const dirtyRef = useRef(false);
    useEffect(() => { dirtyRef.current = dirty; }, [dirty]);
    /** 标注变更必须同步写 dirtyRef：同一次事件里若只 setDirty(true)，scheduleAutoSave 会在 useEffect 之前读到旧的 false */
    const markAnnotationDirty = useCallback(() => {
        dirtyRef.current = true;
        setDirty(true);
    }, []);
    const currentImageRef = useRef(null);
    useEffect(() => { currentImageRef.current = currentImage; }, [currentImage]);
    const bboxFocusedRef = useRef(false);  // 坐标输入框是否已压入 undo 快照
    // ---- 新增功能 state/ref ----
    const copiedAnnRef = useRef(null);                 // B1: 复制的标注框
    const crossImageClipboardRef = useRef(null);       // B4: 跨图复制标注
    const [selectedAnnIdxSet, setSelectedAnnIdxSet] = useState(new Set()); // B2: 多选集合
    const [selRect, setSelRect] = useState(null);      // B2: 拖拽框选矩形 {x0,y0,x1,y1}
    const [snapEnabled, setSnapEnabled] = useState(true); // B5: 贴边吸附
    const snapEnabledRef = useRef(true);
    useEffect(() => { snapEnabledRef.current = snapEnabled; }, [snapEnabled]);
    const [brightness, setBrightness] = useState(100); // B7: 亮度
    const [contrast, setContrast] = useState(100);     // B7: 对比度
    const [annFill, setAnnFill] = useState(false);     // B3: 半透明填充（默认关）
    const [annSearchText, setAnnSearchText] = useState(''); // B6: 标注搜索
    const [showHelp, setShowHelp] = useState(false);   // B9: 帮助面板
    const minimapCanvasRef = useRef(null);             // B8: 小地图
    // 十字辅助线 refs
    const crosshairXRef = useRef(null);
    const crosshairYRef = useRef(null);

    // ---- 查看模式增强 ----
    const [lockedAnn, setLockedAnn] = useState(null);  // C1: 锁定信息面板 {type,ann,sx,sy}
    const [isFullscreen, setIsFullscreen] = useState(false); // C4: 全屏
    const viewerModalRef = useRef(null);
    const [hiddenCats, setHiddenCats] = useState(new Set()); // C5: 类别筛选
    const [showBoxIndex, setShowBoxIndex] = useState(false); // C6: 框序号
    const [confOpacity, setConfOpacity] = useState(false);   // C7: 置信度透明
    const [confThresholdGT, setConfThresholdGT] = useState(0);   // GT 置信度过滤阈值（0 = 不过滤）
    const [confThresholdPred, setConfThresholdPred] = useState(0); // 预测置信度过滤阈值（0 = 不过滤）
    const [compareMode, setCompareMode] = useState(false);   // C10: 对比模式
    const [sidebarDock, setSidebarDock] = useState((viewer.sidebarDock === 'left') ? 'left' : 'right');
    useEffect(() => { setSidebarDock((viewer.sidebarDock === 'left') ? 'left' : 'right'); }, [viewer.sidebarDock]);
    const toggleSidebarDock = () => {
        const next = sidebarDock === 'left' ? 'right' : 'left';
        setSidebarDock(next);
        setSettings(prev => ({ ...prev, viewer: { ...(prev.viewer || {}), sidebarDock: next } }));
    };
    const [showFilmstrip, setShowFilmstrip] = useState(() => viewer.filmstripHiddenByDefault !== true);
    const [viewerLeftTab, setViewerLeftTab] = useState('annotate'); // 左侧栏：标注 | 属性
    const [mainSidebarWidth, setMainSidebarWidth] = useState(() => {
        try { const w = parseInt(localStorage.getItem('cocoViewerMainSidebarW'), 10); return !Number.isNaN(w) ? Math.min(560, Math.max(220, w)) : 280; } catch (e) { return 280; }
    });
    const [predSidebarWidth, setPredSidebarWidth] = useState(() => {
        try { const w = parseInt(localStorage.getItem('cocoViewerPredSidebarW'), 10); return !Number.isNaN(w) ? Math.min(520, Math.max(160, w)) : 260; } catch (e) { return 260; }
    });
    const resizeDragRef = useRef(null);
    const mainSidebarWRef = useRef(mainSidebarWidth);
    const predSidebarWRef = useRef(predSidebarWidth);
    useEffect(() => { mainSidebarWRef.current = mainSidebarWidth; }, [mainSidebarWidth]);
    useEffect(() => { predSidebarWRef.current = predSidebarWidth; }, [predSidebarWidth]);
    const beginResizePred = (e) => { e.preventDefault(); resizeDragRef.current = { which: 'pred', startX: e.clientX, startW: predSidebarWRef.current }; document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; };
    const beginResizeMain = (e) => { e.preventDefault(); resizeDragRef.current = { which: 'main', startX: e.clientX, startW: mainSidebarWRef.current }; document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; };
    useEffect(() => {
        const onMove = (e) => {
            const d = resizeDragRef.current;
            if (!d) return;
            e.preventDefault();
            const dx = e.clientX - d.startX;
            if (d.which === 'pred') {
                setPredSidebarWidth(Math.min(520, Math.max(160, d.startW + dx)));
            } else {
                setMainSidebarWidth(Math.min(560, Math.max(220, d.startW + dx)));
            }
        };
        const onUp = () => {
            if (!resizeDragRef.current) return;
            resizeDragRef.current = null;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            try {
                localStorage.setItem('cocoViewerMainSidebarW', String(mainSidebarWRef.current));
                localStorage.setItem('cocoViewerPredSidebarW', String(predSidebarWRef.current));
            } catch (err) {}
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    }, []);
    useEffect(() => { if (annotateMode) setViewerLeftTab('annotate'); }, [annotateMode]);
    const [showLabels, setShowLabels] = useState(true);       // 查看模式：常显类别标签
    const clickStartRef = useRef(null); // 用于 C1 点击检测（mousedown 位置）
    const [exportModal, setExportModal] = useState(null); // C9: 导出弹窗 { dataUrl, fileName }
    const [ctxMenu, setCtxMenu] = useState(null); // opt6: 右键菜单 { x, y, ann, type, annIdx }
    // ---- 流水线标注辅助 refs ----
    const keepAnnotateModeRef = useRef(false); // navigate 时是否保持标注模式
    const pendingSaveRef = useRef(null);       // { imageId, anns } — navigate 前捕获旧图待保存数据
    const autoSaveTimerRef = useRef(null);     // 画框后延迟自动保存的 timer
    const autoSaveInFlightRef = useRef(false);
    const queuedAutoSaveRef = useRef(null);    // { imageId, anns }，写入进行中时仅保留最新一次
    const [undoToast, setUndoToast] = useState(null); // { msg, id } 撤销/重做提示
    const undoToastTimerRef = useRef(null);

    // 图片切换时同步状态（自动保存旧图、可选保持标注模式）
    useEffect(() => {
        // 处理 navigate() 预先捕获的旧图保存任务
        const pending = pendingSaveRef.current;
        if (pending) {
            pendingSaveRef.current = null;
            fetch('/api/save_annotations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dataset_id: datasetId,
                    images: [{ image_id: pending.imageId, annotations: pending.anns.map(a => ({ category_id: a.category_id, category: a.category, bbox: a.bbox, area: a.bbox ? a.bbox[2] * a.bbox[3] : 0, iscrowd: a.iscrowd || 0 })) }]
                })
            }).then(r => r.json()).then(data => {
                if (data.success && onAnnotationsSaved) onAnnotationsSaved(pending.imageId, pending.anns);
            }).catch(e => console.warn('auto-save on navigate:', e));
        }
        // 清除画框自动保存 timer（切图后旧 timer 无意义）
        if (autoSaveTimerRef.current) { clearTimeout(autoSaveTimerRef.current); autoSaveTimerRef.current = null; }

        const wasAnnotating = keepAnnotateModeRef.current;
        keepAnnotateModeRef.current = false;

        setCurrentImage(image);
        setHiddenAnns(new Set());
        setHiddenPredAnns(new Set());
        setHoveredPredAnnIdx(null);
        setSelectedAnnIdx(null);
        setSelectedAnnIdxSet(new Set());
        setDrawingBox(null);
        setSelRect(null);
        setDirty(false);
        dirtyRef.current = false;
        undoStack.current = [];
        redoStack.current = [];

        if (wasAnnotating) {
            // 保持标注模式，加载新图的标注
            setAnnotateMode(true);
            setAnnoTool('draw');
            setLocalAnns((image.annotations || []).map(a => ({ ...a, bbox: [...(a.bbox || [])] })));
        } else {
            setAnnotateMode(false);
            setLocalAnns([]);
        }
    }, [image?.image_id]); // eslint-disable-line

    if (!currentImage || !currentImage.file_name) {
        return (
            <div className="viewer-overlay" onClick={onClose}>
                <div className="viewer-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="viewer-header">
                        <h3>看图界面</h3>
                        <button className="viewer-close" onClick={onClose}>✕</button>
                    </div>
                    <div style={{ padding: '20px', color: 'var(--text-secondary)' }}>
                        当前图片数据缺失（file_name 为空），请返回宫格重试或切换到下一张图片。
                    </div>
                </div>
            </div>
        );
    }

    const imageIdx = images.findIndex(i => i.image_id === currentImage.image_id);
    let imageUrl = `/api/get_image?dataset_id=${datasetId}&file_name=${encodeURIComponent(currentImage.file_name)}`;
    if (currentImage.source_path != null && currentImage.source_path !== '') imageUrl += `&source_path=${encodeURIComponent(currentImage.source_path)}`;
    
    // 前后图预加载
    useEffect(() => {
        if (imageIdx < 0) return;
        const preload = (idx) => {
            if (idx >= 0 && idx < images.length) {
                const img = images[idx];
                let url = `/api/get_image?dataset_id=${datasetId}&file_name=${encodeURIComponent(img.file_name)}`;
                if (img.source_path != null && img.source_path !== '') url += `&source_path=${encodeURIComponent(img.source_path)}`;
                const imageObj = new Image();
                imageObj.src = url;
            }
        };
        preload(imageIdx + 1);
        preload(imageIdx - 1);
    }, [imageIdx, images, datasetId]);

    const rawCats = imageClassifications[currentImage.image_id];
    const currentCategories = Array.isArray(rawCats) && rawCats.length ? rawCats : [catList[0] || '未分类'];
    const currentCategory = currentCategories[0];
    const currentNote = imageNotes[currentImage.image_id] || '';
    const hasPredAnnotations = (currentImage.pred_annotations || []).length > 0;
    const sidebarsTotalInsetPx = React.useMemo(() => {
        const handlePad = 6;
        let w = 12 + mainSidebarWidth + handlePad;
        if (hasPredAnnotations) w += predSidebarWidth + handlePad;
        return w;
    }, [hasPredAnnotations, mainSidebarWidth, predSidebarWidth]);
    const filmstripLeftInsetPx = sidebarDock === 'left' ? sidebarsTotalInsetPx : 12;
    const filmstripRightInsetPx = sidebarDock === 'right' ? sidebarsTotalInsetPx : 12;
    const metaFieldMap = getMetaFilterMapping(viewer);
    const formatMetaVal = (v) => {
        if (v == null) return '—';
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
        try { return JSON.stringify(v); } catch (e) { return String(v); }
    };
    const propertyRowsPrimary = React.useMemo(() => {
        if (!currentImage) return [];
        const raw = (currentImage.image_meta && typeof currentImage.image_meta === 'object') ? currentImage.image_meta : {};
        const rows = [];
        rows.push({ label: '文件名', value: currentImage.file_name || '—' });
        if (currentImage.source_path != null && currentImage.source_path !== '') {
            rows.push({ label: '目录', value: String(currentImage.source_path) });
        }
        rows.push({ label: '尺寸', value: `${currentImage.width} × ${currentImage.height}` });
        const tKey = metaFieldMap.c_time;
        if (raw[tKey] != null && String(raw[tKey]).trim() !== '') rows.push({ label: '时间', value: formatMetaVal(raw[tKey]) });
        const pKey = metaFieldMap.position;
        if (raw[pKey] != null && String(raw[pKey]).trim() !== '') rows.push({ label: '位置', value: formatMetaVal(raw[pKey]) });
        const snKey = metaFieldMap.product_id;
        if (raw[snKey] != null && String(raw[snKey]).trim() !== '') rows.push({ label: 'SN / 产品号', value: formatMetaVal(raw[snKey]) });
        const nv = (noteInput || '').trim();
        if (nv) rows.push({ label: '备注', value: nv });
        return rows;
    }, [currentImage, metaFieldMap, noteInput]);
    const propertyRowsExtra = React.useMemo(() => {
        const raw = (currentImage && currentImage.image_meta && typeof currentImage.image_meta === 'object') ? currentImage.image_meta : {};
        const used = new Set(['id', 'file_name', 'width', 'height', 'source_path', 'note', 'image_category', 'image_categories', metaFieldMap.c_time, metaFieldMap.position, metaFieldMap.product_id]);
        return Object.entries(raw)
            .filter(([k]) => !used.has(k) && raw[k] != null && String(raw[k]).trim() !== '')
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => ({ label: k, value: formatMetaVal(v) }));
    }, [currentImage, metaFieldMap]);
    const linkedPredIdxSet = React.useMemo(() => {
        if (hoveredAnnIdx == null) return new Set();
        const gtAnn = currentImage.annotations?.[hoveredAnnIdx];
        if (!gtAnn?.bbox) return new Set();
        const out = new Set();
        (currentImage.pred_annotations || []).forEach((pred, idx) => {
            if (!pred?.bbox) return;
            if (computeIoU(gtAnn.bbox, pred.bbox) >= crossSidebarIouThreshold) out.add(idx);
        });
        return out;
    }, [currentImage, hoveredAnnIdx, crossSidebarIouThreshold]);
    const linkedGtIdxSet = React.useMemo(() => {
        if (hoveredPredAnnIdx == null) return new Set();
        const predAnn = (currentImage.pred_annotations || [])[hoveredPredAnnIdx];
        if (!predAnn?.bbox) return new Set();
        const out = new Set();
        (currentImage.annotations || []).forEach((gt, idx) => {
            if (!gt?.bbox) return;
            if (computeIoU(predAnn.bbox, gt.bbox) >= crossSidebarIouThreshold) out.add(idx);
        });
        return out;
    }, [currentImage, hoveredPredAnnIdx, crossSidebarIouThreshold]);

    useEffect(() => { setNoteInput(currentNote); }, [currentImage.image_id, currentNote]);

    // 使用 annotateModeRef 而非 annotateMode，避免「看图 ↔ 标注」切换时 useCallback 依赖变化触发下方「自动适应」effect，把缩放/平移打回初始
    const fitZoom = useCallback(() => {
        if (!imgRef.current || !containerRef.current) return 1;
        const am = annotateModeRef.current;
        const stripReserve = (!am && showFilmstrip) ? VIEWER_FILMSTRIP_RESERVE_PX : 0;
        const cw = containerRef.current.clientWidth - 40;
        const ch = containerRef.current.clientHeight - 40 - stripReserve;
        const iw = imgRef.current.naturalWidth;
        const ih = imgRef.current.naturalHeight;
        if (iw === 0 || ih === 0) return 1;
        return Math.min(cw / iw, ch / ih, 1);
    }, [showFilmstrip]);

    // 仅根据容器与图片元数据（宽高）计算适应缩放，不依赖图片加载，任意分辨率打开即自适应
    const getFitZoomFromMeta = useCallback(() => {
        const el = containerRef.current;
        const w = currentImage.width, h = currentImage.height;
        if (!el || !w || !h) return 1;
        const am = annotateModeRef.current;
        const stripReserve = (!am && showFilmstrip) ? VIEWER_FILMSTRIP_RESERVE_PX : 0;
        const cw = el.clientWidth - 40;
        const ch = el.clientHeight - 40 - stripReserve;
        if (cw <= 0 || ch <= 0) return 1;
        return Math.min(cw / w, ch / h, 1);
    }, [currentImage.width, currentImage.height, showFilmstrip]);

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

        // 标注模式下绘制 localAnns，否则绘制 currentImage.annotations
        const annsToShow = annotateMode ? localAnns : currentImage.annotations;
        annsToShow.forEach((ann, idx) => {
            if (!ann.bbox || (!annotateMode && hiddenAnns.has(idx))) return;
            if (!annotateMode && !passesConfThreshold(ann, confThresholdGT)) return;
            // C5: 类别筛选（查看模式下隐藏已过滤类别）
            if (!annotateMode && hiddenCats.has(ann.category)) return;
            const [x, y, bw, bh] = ann.bbox;
            const rx = x * sx, ry = y * sy, rw = bw * sx, rh = bh * sy;
            const isHovered = !annotateMode && hoveredAnnIdx === idx;
            const isSelected = annotateMode && selectedAnnIdx === idx;
            const isMultiSel = annotateMode && selectedAnnIdxSet.has(idx);
            const color = getCategoryColor(palette, ann.category);
            ctx.strokeStyle = isMultiSel && !isSelected ? '#ffaa00' : color;
            ctx.lineWidth = (isHovered || isSelected || isMultiSel) ? Math.max(lineWidth + 0.3, 0.4) : lineWidth;
            if (isSelected) ctx.setLineDash([5, 3]);
            if (isMultiSel && !isSelected) ctx.setLineDash([4, 2]);
            ctx.strokeRect(rx, ry, rw, rh);
            ctx.setLineDash([]);
            // B3: 半透明填充
            if (annFill) {
                ctx.fillStyle = color + (isSelected || isMultiSel ? '30' : '1a');
                ctx.fillRect(rx, ry, rw, rh);
            }
            // 标注模式 or 查看模式常显标签：绘制类别标签
            if ((annotateMode || (!annotateMode && showLabels)) && ann.category) {
                ctx.font = 'bold 11px sans-serif';
                const labelW = ctx.measureText(ann.category).width + 8;
                const labelH = 16;
                const lx = rx, ly = ry > labelH + 2 ? ry - labelH - 2 : ry + 2;
                ctx.fillStyle = color + 'cc';
                ctx.fillRect(lx, ly, labelW, labelH);
                ctx.fillStyle = '#fff';
                ctx.fillText(ann.category, lx + 4, ly + labelH - 4);
            }
            if (isHovered) {
                const area = bw * bh;
                const lines = [
                    ann.category,
                    ann.score != null ? `置信度: ${(Number(ann.score) * 100).toFixed(1)}%` : null,
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
            ctx.strokeStyle = getCategoryColor(palette, ann.category);
                ctx.lineWidth = 1;
                ctx.strokeRect(tx, ty, boxW, boxH);
                ctx.fillStyle = '#fff';
                lines.forEach((line, i) => {
                    ctx.fillText(line, tx + pad, ty + pad + (i + 1) * lineH - 2);
                });
            }
            // C6: 框序号
            if (!annotateMode && showBoxIndex) {
                const numStr = String(idx + 1);
                ctx.font = 'bold 11px monospace';
                const nw = ctx.measureText(numStr).width + 6, nh = 15;
                ctx.fillStyle = 'rgba(0,0,0,0.7)';
                ctx.fillRect(rx, ry, nw, nh);
                ctx.fillStyle = '#fff';
                ctx.fillText(numStr, rx + 3, ry + nh - 3);
            }
        });

        // 预测标注（标注模式下半透明参考显示）
        {
            const PRED_DASH_PATTERNS = [[8,4],[4,4],[2,4],[10,4,2,4],[14,4]];
            const predAnns = currentImage.pred_annotations || [];
            const predModels = [...new Set(predAnns.map(a => a._pred_source))];
            if (annotateMode) ctx.globalAlpha = 0.38;
            predAnns.forEach((ann, idx) => {
                if (!ann.bbox || ann.bbox.length < 4) return;
                if (!annotateMode && hiddenPredAnns.has(idx)) return;
                if (visiblePredModels && !visiblePredModels.has(ann._pred_source)) return;
                if (!passesConfThreshold(ann, confThresholdPred)) return;
                // C5: 类别筛选
                if (!annotateMode && hiddenCats.has(ann.category)) return;
                const [x, y, bw, bh] = ann.bbox;
                const rx = x * sx, ry = y * sy, rw = bw * sx, rh = bh * sy;
                const isHovered = hoveredPredAnnIdx === idx;
                const modelIdx = predModels.indexOf(ann._pred_source);
                const dash = PRED_DASH_PATTERNS[modelIdx % PRED_DASH_PATTERNS.length];
                const color = getCategoryColor(palette, ann.category);
                // C7: 置信度渐变透明度
                const baseAlpha = annotateMode ? 0.38 : 1;
                const confAlpha = (confOpacity && !annotateMode && ann.score != null)
                    ? Math.max(0.25, Number(ann.score)) : 1;
                ctx.globalAlpha = baseAlpha * confAlpha;
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
                // 查看模式常显标签（预测框）
                if (!annotateMode && showLabels && ann.category && !isHovered) {
                    ctx.globalAlpha = baseAlpha * confAlpha;
                    ctx.font = '10px sans-serif';
                    const scoreStr = ann.score != null ? ` ${(Number(ann.score)*100).toFixed(0)}%` : '';
                    const labelTxt = ann.category + scoreStr;
                    const labelW = ctx.measureText(labelTxt).width + 6;
                    const labelH = 14;
                    const lx = rx + rw - labelW, ly = ry > labelH + 1 ? ry - labelH - 1 : ry + 1;
                    ctx.fillStyle = 'rgba(0,0,0,0.6)';
                    ctx.fillRect(lx, ly, labelW, labelH);
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 0.5;
                    ctx.setLineDash([]);
                    ctx.strokeRect(lx, ly, labelW, labelH);
                    ctx.fillStyle = color;
                    ctx.fillText(labelTxt, lx + 3, ly + labelH - 3);
                }
                // C6: 预测框序号
                if (!annotateMode && showBoxIndex) {
                    ctx.globalAlpha = 1;
                    const numStr = `p${idx + 1}`;
                    ctx.font = 'bold 10px monospace';
                    const nw = ctx.measureText(numStr).width + 5, nh = 13;
                    ctx.fillStyle = 'rgba(60,60,0,0.8)';
                    ctx.fillRect(rx + rw - nw, ry, nw, nh);
                    ctx.fillStyle = '#ffdd00';
                    ctx.fillText(numStr, rx + rw - nw + 2, ry + nh - 2);
                }
            });
            ctx.globalAlpha = 1;
        }
    }, [currentImage, zoom, hiddenAnns, hoveredAnnIdx, lineWidth, palette, hiddenPredAnns, hoveredPredAnnIdx, visiblePredModels, annotateMode, localAnns, selectedAnnIdx, selectedAnnIdxSet, annFill, hiddenCats, showBoxIndex, confOpacity, confThresholdGT, confThresholdPred, showLabels]);

    useEffect(() => {
        setPanX(0);
        setPanY(0);
    }, [currentImage.image_id]);

    // 换图或缩略图条显隐时重算「适应窗口」缩放；不在 annotateMode / 拉框·选择工具 切换时触发，以保留当前缩放与平移
    useEffect(() => {
        const z = getFitZoomFromMeta();
        setZoom(z);
        const t = requestAnimationFrame(() => {
            setZoom(getFitZoomFromMeta());
        });
        return () => cancelAnimationFrame(t);
    }, [currentImage.image_id, getFitZoomFromMeta, showFilmstrip]);

    const handleImageLoad = () => {
        setZoom(fitZoom());
        setTimeout(drawAnnotations, 50);
    };

    useEffect(() => { drawAnnotations(); }, [zoom, hiddenAnns, hoveredAnnIdx, hiddenPredAnns, hoveredPredAnnIdx, lineWidth, drawAnnotations]);

    // ---- editCanvas: 绘制正在拖拽的新框 + 选中框的控制点 ----
    const HANDLE_R_IMG = 5; // 控制点半径（图片坐标）
    function getHandles(bbox) {
        const [x, y, bw, bh] = bbox;
        return [
            { id: 'nw', cx: x,        cy: y },
            { id: 'n',  cx: x + bw/2, cy: y },
            { id: 'ne', cx: x + bw,   cy: y },
            { id: 'e',  cx: x + bw,   cy: y + bh/2 },
            { id: 'se', cx: x + bw,   cy: y + bh },
            { id: 's',  cx: x + bw/2, cy: y + bh },
            { id: 'sw', cx: x,        cy: y + bh },
            { id: 'w',  cx: x,        cy: y + bh/2 },
        ];
    }
    const HANDLE_CURSORS = { nw:'nw-resize', n:'n-resize', ne:'ne-resize', e:'e-resize', se:'se-resize', s:'s-resize', sw:'sw-resize', w:'w-resize' };

    const drawEditCanvas = useCallback(() => {
        const ec = editCanvasRef.current;
        const img = imgRef.current;
        if (!ec || !img || img.naturalWidth === 0) return;
        const w = img.naturalWidth * zoom;
        const h = img.naturalHeight * zoom;
        ec.width = w; ec.height = h;
        ec.style.width = w + 'px'; ec.style.height = h + 'px';
        const ctx = ec.getContext('2d');
        ctx.clearRect(0, 0, w, h);
        if (!annotateMode) return;
        const sx = zoom, sy = zoom;
        // 绘制正在画的框
        if (drawingBox) {
            const rx = Math.min(drawingBox.x0, drawingBox.x1) * sx;
            const ry = Math.min(drawingBox.y0, drawingBox.y1) * sy;
            const rw = Math.abs(drawingBox.x1 - drawingBox.x0) * sx;
            const rh = Math.abs(drawingBox.y1 - drawingBox.y0) * sy;
            ctx.strokeStyle = '#ffdd00';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 3]);
            ctx.strokeRect(rx, ry, rw, rh);
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(255,221,0,0.08)';
            ctx.fillRect(rx, ry, rw, rh);
            // ★ 实时尺寸标签（Shift 时提示正方形模式）
            const imgW = Math.round(Math.abs(drawingBox.x1 - drawingBox.x0));
            const imgH = Math.round(Math.abs(drawingBox.y1 - drawingBox.y0));
            const isSquare = imgW === imgH;
            const label = isSquare ? `⬛ ${imgW} × ${imgH}` : `${imgW} × ${imgH}`;
            ctx.font = 'bold 12px monospace';
            const lw = ctx.measureText(label).width + 10;
            const lh = 18;
            let lx = rx + rw / 2 - lw / 2;
            let ly = ry + rh + 4;
            if (ly + lh > h) ly = ry - lh - 4;
            if (lx < 2) lx = 2;
            if (lx + lw > w - 2) lx = w - lw - 2;
            ctx.fillStyle = 'rgba(0,0,0,0.72)';
            ctx.fillRect(lx, ly, lw, lh);
            ctx.fillStyle = '#ffdd00';
            ctx.fillText(label, lx + 5, ly + lh - 4);
        }
        // 绘制选中框的控制点
        if (selectedAnnIdx !== null && localAnns[selectedAnnIdx]) {
            const handles = getHandles(localAnns[selectedAnnIdx].bbox);
            handles.forEach(h => {
                ctx.fillStyle = '#fff';
                ctx.strokeStyle = '#4a7af0';
                ctx.lineWidth = 1.5;
                const hx = h.cx * sx - HANDLE_R_IMG, hy = h.cy * sy - HANDLE_R_IMG;
                const hs = HANDLE_R_IMG * 2;
                ctx.fillRect(hx, hy, hs, hs);
                ctx.strokeRect(hx, hy, hs, hs);
            });
        }
        // B2: 绘制框选矩形
        if (selRect) {
            const rx = Math.min(selRect.x0, selRect.x1) * sx;
            const ry = Math.min(selRect.y0, selRect.y1) * sy;
            const rw = Math.abs(selRect.x1 - selRect.x0) * sx;
            const rh = Math.abs(selRect.y1 - selRect.y0) * sy;
            ctx.strokeStyle = '#ffdd00';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 3]);
            ctx.strokeRect(rx, ry, rw, rh);
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(255,221,0,0.06)';
            ctx.fillRect(rx, ry, rw, rh);
        }
    }, [annotateMode, zoom, drawingBox, selectedAnnIdx, localAnns, selRect]);

    // B8: 小地图绘制
    useEffect(() => {
        const mc = minimapCanvasRef.current;
        const img = imgRef.current;
        const container = containerRef.current;
        if (!mc || !img || img.naturalWidth === 0 || !container) return;
        const MAP_W = 150, MAP_H = 100;
        const scale = Math.min(MAP_W / img.naturalWidth, MAP_H / img.naturalHeight);
        const mw = img.naturalWidth * scale, mh = img.naturalHeight * scale;
        mc.width = mw; mc.height = mh;
        mc.style.width = mw + 'px'; mc.style.height = mh + 'px';
        const ctx = mc.getContext('2d');
        ctx.clearRect(0, 0, mw, mh);
        try { ctx.drawImage(img, 0, 0, mw, mh); } catch(e) { /* cross-origin */ }
        // 绘制视口矩形
        const cw = container.clientWidth, ch = container.clientHeight;
        const vpW = (cw / zoom) * scale, vpH = (ch / zoom) * scale;
        const vpX = (-panX / zoom) * scale, vpY = (-panY / zoom) * scale;
        ctx.strokeStyle = '#ffaa00';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(vpX, vpY, vpW, vpH);
        ctx.fillStyle = 'rgba(255,170,0,0.12)';
        ctx.fillRect(vpX, vpY, vpW, vpH);
    }, [zoom, panX, panY, currentImage.image_id]);

    useEffect(() => { drawEditCanvas(); }, [drawEditCanvas]);

    // ---- 标注模式工具函数 ----
    // C1: 查看模式下将 clientXY 转换为图片像素坐标
    function viewClientToImage(clientX, clientY) {
        const wrapper = wrapperRef.current;
        if (!wrapper) return { x: 0, y: 0 };
        const rect = wrapper.getBoundingClientRect();
        return { x: (clientX - rect.left) / zoom, y: (clientY - rect.top) / zoom };
    }

    /** 查看模式下：命中可见 GT 框则返回其下标，否则 -1（从后往前，与点击锁定一致） */
    function hitTestGtAnnAtClient(clientX, clientY) {
        const { x: imgX, y: imgY } = viewClientToImage(clientX, clientY);
        const anns = currentImage.annotations;
        for (let i = anns.length - 1; i >= 0; i--) {
            const ann = anns[i];
            if (!ann.bbox || hiddenAnns.has(i) || hiddenCats.has(ann.category)) continue;
            if (!passesConfThreshold(ann, confThresholdGT)) continue;
            const [x, y, bw, bh] = ann.bbox;
            if (imgX >= x && imgX <= x + bw && imgY >= y && imgY <= y + bh) return i;
        }
        return -1;
    }

    // C4: 全屏切换
    function toggleFullscreen() {
        const el = viewerModalRef.current;
        if (!el) return;
        if (!document.fullscreenElement) {
            el.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen();
        }
    }

    // 居中到指定标注框（image坐标系中的bbox）
    function centerOnAnnotation(bbox) {
        if (!bbox || bbox.length < 4 || !containerRef.current || !imgRef.current) return;
        const [bx, by, bw, bh] = bbox;
        const imgW = currentImage.width || imgRef.current.naturalWidth || 1;
        const imgH = currentImage.height || imgRef.current.naturalHeight || 1;
        const container = containerRef.current;
        const cw = container.clientWidth, ch = container.clientHeight;
        // 框中心的 image 归一化坐标
        const cx = (bx + bw / 2) / imgW;
        const cy = (by + bh / 2) / imgH;
        // 适当放大以便看清该框（不超过2倍屏幕），至少让框占据屏幕40%
        const targetZoomW = cw * 0.6 / (bw / imgW * (currentImage.width || imgW));
        const targetZoomH = ch * 0.6 / (bh / imgH * (currentImage.height || imgH));
        const targetZoom = Math.min(targetZoomW, targetZoomH, zoom * 3, 8);
        const newZoom = Math.max(targetZoom, zoom);
        // pan使框中心位于容器中心
        const newPanX = cw / 2 - cx * imgW * newZoom;
        const newPanY = ch / 2 - cy * imgH * newZoom;
        setZoom(newZoom);
        setPanX(newPanX);
        setPanY(newPanY);
        zoomPanRef.current = { zoom: newZoom, panX: newPanX, panY: newPanY };
    }

    // C9: 带标注截图导出
    async function exportAnnotatedImage() {
        const img = imgRef.current;
        if (!img || img.naturalWidth === 0) { alert('图片尚未加载完成'); return; }
        const SCALE = Math.min(1, 1200 / Math.max(img.naturalWidth, img.naturalHeight)); // 限制最大边1200px
        const offW = Math.round(img.naturalWidth * SCALE), offH = Math.round(img.naturalHeight * SCALE);
        const imgMeta = currentImage;
        const imgW = imgMeta.width || img.naturalWidth, imgH = imgMeta.height || img.naturalHeight;
        const sx = offW / imgW, sy = offH / imgH;
        const PRED_DASH_PATTERNS = [[8,4],[4,4],[2,4],[10,4,2,4],[14,4]];
        const allPredAnns = imgMeta.pred_annotations || [];
        const predModels = [...new Set(allPredAnns.map(a => a._pred_source))];
        // 收集可见标注信息（用于信息条）
        const visGT = imgMeta.annotations.filter((a, i) => a.bbox && !hiddenAnns.has(i) && !hiddenCats.has(a.category) && passesConfThreshold(a, confThresholdGT));
        const visPred = allPredAnns.filter((a, i) => a.bbox && !hiddenPredAnns.has(i) && !hiddenCats.has(a.category) && (!visiblePredModels || visiblePredModels.has(a._pred_source)) && passesConfThreshold(a, confThresholdPred));
        // 信息条高度
        const FONT_SZ = 13, LINE_H = 20, PAD = 8;
        const infoLines = [
            `文件: ${imgMeta.file_name.split('/').pop()}   尺寸: ${imgMeta.width}×${imgMeta.height}`,
            ...visGT.map(a => `  [GT] ${a.category}  ${Math.round(a.bbox[2])}×${Math.round(a.bbox[3])}`),
            ...visPred.map(a => `  [预测] ${a.category}  ${Math.round(a.bbox[2])}×${Math.round(a.bbox[3])}${a.score != null ? `  置信度:${(a.score*100).toFixed(1)}%` : ''}`),
        ];
        const infoH = infoLines.length * LINE_H + PAD * 2;
        // 合成画布
        const off = document.createElement('canvas');
        off.width = offW; off.height = offH + infoH;
        const ctx = off.getContext('2d');
        // 绘制图片
        if (brightness !== 100 || contrast !== 100) ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
        ctx.drawImage(img, 0, 0, offW, offH);
        ctx.filter = 'none';
        // 绘制 GT 框
        visGT.forEach(ann => {
            const [x, y, bw, bh] = ann.bbox;
            const color = getCategoryColor(palette, ann.category);
            ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, 2 * SCALE * 2);
            ctx.strokeRect(x*sx, y*sy, bw*sx, bh*sy);
            if (annFill) { ctx.fillStyle = color+'22'; ctx.fillRect(x*sx, y*sy, bw*sx, bh*sy); }
            const label = `${ann.category}  ${Math.round(bw)}×${Math.round(bh)}`;
            ctx.font = `bold ${Math.max(11, FONT_SZ*SCALE)}px sans-serif`;
            const lw = ctx.measureText(label).width + 8, lh = Math.max(15, 15*SCALE);
            const lx = x*sx, ly = y*sy > lh+2 ? y*sy-lh-2 : y*sy+2;
            ctx.fillStyle = color; ctx.fillRect(lx, ly, lw, lh);
            ctx.fillStyle = '#fff'; ctx.fillText(label, lx+4, ly+lh-4);
        });
        // 绘制预测框
        visPred.forEach(ann => {
            const [x, y, bw, bh] = ann.bbox;
            const color = getCategoryColor(palette, ann.category);
            const dash = PRED_DASH_PATTERNS[predModels.indexOf(ann._pred_source) % PRED_DASH_PATTERNS.length].map(v => v * Math.max(1, SCALE*2));
            ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.5, 1.5*SCALE*2);
            ctx.setLineDash(dash); ctx.strokeRect(x*sx, y*sy, bw*sx, bh*sy); ctx.setLineDash([]);
            const label = ann.score != null
                ? `${ann.category}  ${Math.round(bw)}×${Math.round(bh)}  ${(ann.score*100).toFixed(1)}%`
                : `${ann.category}  ${Math.round(bw)}×${Math.round(bh)}`;
            ctx.font = `bold ${Math.max(11, FONT_SZ*SCALE)}px sans-serif`;
            const lw = ctx.measureText(label).width + 8, lh = Math.max(15, 15*SCALE);
            const lx = x*sx, ly = y*sy > lh+2 ? y*sy-lh-2 : y*sy+2;
            ctx.fillStyle = color+'cc'; ctx.fillRect(lx, ly, lw, lh);
            ctx.fillStyle = '#fff'; ctx.fillText(label, lx+4, ly+lh-4);
        });
        // 绘制信息条（深色背景）
        ctx.fillStyle = '#111827';
        ctx.fillRect(0, offH, offW, infoH);
        ctx.font = `${FONT_SZ}px monospace`;
        infoLines.forEach((line, i) => {
            const isHeader = i === 0;
            ctx.fillStyle = isHeader ? '#9ca3af' : (line.includes('[GT]') ? '#6ee7b7' : '#93c5fd');
            if (isHeader) ctx.font = `bold ${FONT_SZ}px monospace`;
            else ctx.font = `${FONT_SZ}px monospace`;
            ctx.fillText(line, PAD, offH + PAD + (i + 1) * LINE_H - 4);
        });
        const fileName = imgMeta.file_name.split('/').pop().replace(/\.[^.]+$/, '') + '_annotated.jpg';
        const dataUrl = off.toDataURL('image/jpeg', 0.88);
        setExportModal({ dataUrl, fileName, canvas: off });
    }

    // B5: 贴边吸附：将坐标吸附到候选值列表中的最近值
    function snapCoord(val, candidates, snapDist) {
        const dist = snapDist || 8;
        let best = null, bestD = dist + 1;
        for (const c of candidates) {
            const d = Math.abs(val - c);
            if (d < bestD) { bestD = d; best = c; }
        }
        return bestD <= dist ? best : val;
    }

    // B4: 跨图复制
    function copyAnnotationsToClipboard() {
        crossImageClipboardRef.current = localAnns.map(a => ({ ...a, bbox: [...a.bbox] }));
        alert(`已复制 ${localAnns.length} 个标注框到跨图剪贴板，切换到其他图片后点击"粘贴"即可。`);
    }
    function pasteAnnotationsFromClipboard() {
        const clip = crossImageClipboardRef.current;
        if (!clip || clip.length === 0) return;
        commitChange([...localAnns, ...clip.map(a => ({ ...a, bbox: [...a.bbox] }))]);
    }

    function clientToImage(clientX, clientY) {
        const ec = editCanvasRef.current;
        if (!ec) return { x: 0, y: 0 };
        const rect = ec.getBoundingClientRect();
        return { x: (clientX - rect.left) / zoom, y: (clientY - rect.top) / zoom };
    }

    function hitTestHandles(bbox, clientX, clientY) {
        const ec = editCanvasRef.current;
        if (!ec) return null;
        const rect = ec.getBoundingClientRect();
        const handles = getHandles(bbox);
        for (const h of handles) {
            const sx = h.cx * zoom + rect.left, sy = h.cy * zoom + rect.top;
            if (Math.abs(clientX - sx) <= HANDLE_R_IMG + 3 && Math.abs(clientY - sy) <= HANDLE_R_IMG + 3) return h.id;
        }
        return null;
    }

    function hitTestBox(bbox, imgX, imgY) {
        const [x, y, bw, bh] = bbox;
        return imgX >= x && imgX <= x + bw && imgY >= y && imgY <= y + bh;
    }

    function commitChange(nextAnns) {
        const normalized = nextAnns.map(a => ({ ...a, bbox: [...(a.bbox || [])] }));
        undoStack.current = [...undoStack.current, localAnns.map(a => ({ ...a, bbox: [...a.bbox] }))];
        redoStack.current = [];
        // 必须在 setState 之前同步 ref：scheduleAutoSave 同步执行，useEffect 尚未更新 ref
        localAnnsRef.current = normalized;
        setLocalAnns(normalized);
        markAnnotationDirty();
        scheduleAutoSave(); // 所有标注变更（移动/删除/粘贴等）均触发自动保存
    }

    function showUndoToast(msg) {
        if (undoToastTimerRef.current) clearTimeout(undoToastTimerRef.current);
        setUndoToast({ msg, id: Date.now() });
        undoToastTimerRef.current = setTimeout(() => setUndoToast(null), 1500);
    }

    function undo() {
        if (!undoStack.current.length) { showUndoToast('已无可撤销操作'); return; }
        redoStack.current = [...redoStack.current, localAnns.map(a => ({ ...a, bbox: [...a.bbox] }))];
        const prev = undoStack.current[undoStack.current.length - 1];
        undoStack.current = undoStack.current.slice(0, -1);
        localAnnsRef.current = prev.map(a => ({ ...a, bbox: [...a.bbox] }));
        setLocalAnns(prev);
        setSelectedAnnIdx(null);
        showUndoToast(`已撤销（还可撤销 ${undoStack.current.length} 步）`);
    }

    function redo() {
        if (!redoStack.current.length) { showUndoToast('已无可重做操作'); return; }
        undoStack.current = [...undoStack.current, localAnns.map(a => ({ ...a, bbox: [...a.bbox] }))];
        const next = redoStack.current[redoStack.current.length - 1];
        redoStack.current = redoStack.current.slice(0, -1);
        localAnnsRef.current = next.map(a => ({ ...a, bbox: [...a.bbox] }));
        setLocalAnns(next);
        setSelectedAnnIdx(null);
        showUndoToast(`已重做`);
    }

    const switchAnnoTool = (nextTool) => {
        if (annotateModeRef.current) {
            setAnnoTool(nextTool);
            setEditCursor(nextTool === 'draw' ? 'crosshair' : 'default');
            return;
        }
        enterAnnotateMode(nextTool);
    };

    function enterAnnotateMode(preferredTool = 'draw', selectAnnIdx = null) {
        const initial = currentImage.annotations.map(a => ({ ...a, bbox: [...(a.bbox || [])] }));
        localAnnsRef.current = initial;
        setLocalAnns(initial);
        undoStack.current = [];
        redoStack.current = [];
        const sel = selectAnnIdx != null && selectAnnIdx >= 0 && selectAnnIdx < initial.length ? selectAnnIdx : null;
        setSelectedAnnIdx(sel);
        setSelectedAnnIdxSet(new Set());
        setDrawingBox(null);
        setDirty(false);
        dirtyRef.current = false;
        setSaveStatus('idle');
        annotateModeRef.current = true;
        setAnnotateMode(true);
        setAnnoTool(preferredTool);
        setEditCursor(preferredTool === 'draw' ? 'crosshair' : 'default');
        spaceRef.current = false;
    }

    async function exitAnnotateMode(force) {
        // 有未保存修改时自动保存，不再弹确认框
        if (dirtyRef.current) {
            if (force) {
                // 强制退出：放弃修改
                setDirty(false);
                dirtyRef.current = false;
            } else {
                await saveAnnotations();
            }
        }
        // 清除待自动保存的 timer
        if (autoSaveTimerRef.current) { clearTimeout(autoSaveTimerRef.current); autoSaveTimerRef.current = null; }
        annotateModeRef.current = false;
        setAnnotateMode(false);
        keepAnnotateModeRef.current = false;
        setSelectedAnnIdx(null);
        setSelectedAnnIdxSet(new Set());
        setDrawingBox(null);
        setSaveStatus('idle');
    }

    async function saveAnnotations() {
        const imageId = currentImageRef.current?.image_id || currentImage.image_id;
        const annsToSave = (localAnnsRef.current || []).map(a => ({ ...a, bbox: [...(a.bbox || [])] }));
        setSaveStatus('saving');
        try {
            const res = await fetch('/api/save_annotations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dataset_id: datasetId,
                    images: [{
                        image_id: imageId,
                        annotations: annsToSave.map(a => ({
                            category_id: a.category_id,
                            category: a.category,
                            bbox: a.bbox,
                            area: a.bbox ? a.bbox[2] * a.bbox[3] : 0,
                            iscrowd: a.iscrowd || 0,
                        }))
                    }]
                })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || '保存失败');
            setSaveStatus('saved');
            setDirty(false);
            dirtyRef.current = false;
            // 同步回父组件 images 状态
            if (onAnnotationsSaved) onAnnotationsSaved(imageId, annsToSave);
            // 更新 currentImage.annotations，确保退出标注模式后查看模式能显示最新标注
            setCurrentImage(prev => ({ ...prev, annotations: annsToSave }));
            // dirty 已清，不会再次请求保存；回到看图状态（与自动保存一致）
            await exitAnnotateMode(false);
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (e) {
            setSaveStatus('error');
            alert('保存失败: ' + e.message);
            setTimeout(() => setSaveStatus('idle'), 3000);
        }
    }

    async function persistAnnotationsNow(imageId, anns) {
        const res = await fetch('/api/save_annotations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dataset_id: datasetId,
                images: [{
                    image_id: imageId,
                    annotations: (anns || []).map(a => ({
                        category_id: a.category_id,
                        category: a.category,
                        bbox: a.bbox,
                        area: a.bbox ? a.bbox[2] * a.bbox[3] : 0,
                        iscrowd: a.iscrowd || 0,
                    })),
                }],
            }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || '保存失败');
    }

    // 标注修改后实时写入（串行，若正在写则只保留最新一次）
    function scheduleAutoSave() {
        const imgId = currentImageRef.current?.image_id;
        const anns = (localAnnsRef.current || []).map(a => ({ ...a, bbox: [...(a.bbox || [])] }));
        if (!imgId || !dirtyRef.current) return;
        const request = { imageId: imgId, anns };
        if (autoSaveInFlightRef.current) {
            queuedAutoSaveRef.current = request;
            return;
        }
        autoSaveInFlightRef.current = true;
        setSaveStatus('saving');
        (async () => {
            try {
                await persistAnnotationsNow(request.imageId, request.anns);
                setDirty(false);
                dirtyRef.current = false;
                if (onAnnotationsSaved) onAnnotationsSaved(request.imageId, request.anns);
                setCurrentImage(prev => ({ ...prev, annotations: request.anns }));
                setSaveStatus('saved');
                await exitAnnotateMode(false);
                setTimeout(() => setSaveStatus('idle'), 800);
            } catch (e) {
                console.warn('scheduleAutoSave:', e);
                setSaveStatus('error');
            } finally {
                autoSaveInFlightRef.current = false;
                if (queuedAutoSaveRef.current) {
                    const latest = queuedAutoSaveRef.current;
                    queuedAutoSaveRef.current = null;
                    if (latest.imageId === currentImageRef.current?.image_id) {
                        dirtyRef.current = true;
                        scheduleAutoSave();
                    }
                }
            }
        })();
    }

    // ---- 标注模式鼠标事件处理 ----
    // editCanvas 上的 mousedown
    const handleEditMouseDown = useCallback((e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();

        // 空格+拖拽：临时平移模式
        if (spaceRef.current) {
            const { panX: px0, panY: py0 } = zoomPanRef.current;
            dragStartRef.current = { clientX: e.clientX, clientY: e.clientY, panX: px0, panY: py0 };
            return;
        }

        const { x: imgX, y: imgY } = clientToImage(e.clientX, e.clientY);

        if (annoToolRef.current === 'select') {
            // 先测试选中框的控制点
            if (selectedAnnIdx !== null && localAnns[selectedAnnIdx]) {
                const handleId = hitTestHandles(localAnns[selectedAnnIdx].bbox, e.clientX, e.clientY);
                if (handleId) {
                    undoStack.current = [...undoStack.current, localAnns.map(a => ({ ...a, bbox: [...a.bbox] }))];
                    redoStack.current = [];
                    annoEditRef.current = { imgX0: imgX, imgY0: imgY, origBbox: [...localAnns[selectedAnnIdx].bbox], annIdx: selectedAnnIdx };
                    setDragOp('resize-' + handleId);
                    return;
                }
            }
            // 测试是否点击了某个框内部（从后往前）
            let hit = -1;
            for (let i = localAnns.length - 1; i >= 0; i--) {
                if (localAnns[i].bbox && hitTestBox(localAnns[i].bbox, imgX, imgY)) { hit = i; break; }
            }
            if (hit >= 0) {
                if (e.ctrlKey || e.metaKey) {
                    // B2: Ctrl+点击 → 多选切换
                    setSelectedAnnIdxSet(prev => {
                        const next = new Set(prev);
                        if (next.has(hit)) next.delete(hit); else next.add(hit);
                        return next;
                    });
                    setSelectedAnnIdx(hit);
                } else {
                    // 普通点击 → 单选（清空多选集）
                    setSelectedAnnIdx(hit);
                    setSelectedAnnIdxSet(new Set());
                    undoStack.current = [...undoStack.current, localAnns.map(a => ({ ...a, bbox: [...a.bbox] }))];
                    redoStack.current = [];
                    annoEditRef.current = { imgX0: imgX, imgY0: imgY, origBbox: [...localAnns[hit].bbox], annIdx: hit };
                    setDragOp('move');
                }
            } else {
                // 选择工具点击空白：开始拖动画布
                setSelectedAnnIdx(null);
                setSelectedAnnIdxSet(new Set());
                const { panX: px0, panY: py0 } = zoomPanRef.current;
                dragStartRef.current = { clientX: e.clientX, clientY: e.clientY, panX: px0, panY: py0 };
            }
        } else {
            // draw 模式：开始画框
            setDrawingBox({ x0: imgX, y0: imgY, x1: imgX, y1: imgY });
        }
    }, [selectedAnnIdx, localAnns, zoom]); // eslint-disable-line

    // 在 window 上注册 mousemove / mouseup（标注模式）
    useEffect(() => {
        if (!annotateMode) return;
        const imgW = currentImage.width || 1e6;
        const imgH = currentImage.height || 1e6;

        const onMove = (e) => {
            // 平移时不做标注操作（空格平移/选择工具空白拖动）
            if (dragStartRef.current) return;

            const { x: imgX, y: imgY } = clientToImage(e.clientX, e.clientY);

            if (drawingBox) {
                let cx = Math.max(0, Math.min(imgW, imgX));
                let cy = Math.max(0, Math.min(imgH, imgY));
                // B5: 贴边吸附（画框时）
                if (snapEnabledRef.current) {
                    const xCands = [0, imgW, ...localAnnsRef.current.flatMap(a => a.bbox ? [a.bbox[0], a.bbox[0]+a.bbox[2]] : [])];
                    const yCands = [0, imgH, ...localAnnsRef.current.flatMap(a => a.bbox ? [a.bbox[1], a.bbox[1]+a.bbox[3]] : [])];
                    cx = snapCoord(cx, xCands);
                    cy = snapCoord(cy, yCands);
                }
                // Shift 锁正方形：取较大的边长，保持宽高相等
                if (e.shiftKey) {
                    const dx = cx - drawingBox.x0, dy = cy - drawingBox.y0;
                    const side = Math.max(Math.abs(dx), Math.abs(dy));
                    cx = drawingBox.x0 + (dx >= 0 ? side : -side);
                    cy = drawingBox.y0 + (dy >= 0 ? side : -side);
                    cx = Math.max(0, Math.min(imgW, cx));
                    cy = Math.max(0, Math.min(imgH, cy));
                }
                setDrawingBox(prev => prev ? { ...prev, x1: cx, y1: cy } : null);
                return;
            }
            // B2: 更新框选矩形
            if (selRect) {
                setSelRect(prev => prev ? { ...prev, x1: imgX, y1: imgY } : null);
                return;
            }

            // 没有拖拽操作时：更新 cursor（hover 在控制点上显示方向箭头）
            if (!dragOp && annoToolRef.current === 'select') {
                let cursor = 'default';
                for (let i = localAnnsRef.current.length - 1; i >= 0; i--) {
                    const ann = localAnnsRef.current[i];
                    if (!ann.bbox) continue;
                    if (i === selectedAnnIdx) {
                        const hid = hitTestHandles(ann.bbox, e.clientX, e.clientY);
                        if (hid) { cursor = HANDLE_CURSORS[hid] || 'nw-resize'; break; }
                    }
                    if (hitTestBox(ann.bbox, imgX, imgY)) { cursor = 'move'; break; }
                }
                setEditCursor(cursor);
            }

            if (dragOp && annoEditRef.current) {
                const { imgX0, imgY0, origBbox, annIdx } = annoEditRef.current;
                const dx = imgX - imgX0, dy = imgY - imgY0;
                let [bx, by, bw, bh] = origBbox;
                if (dragOp === 'move') {
                    bx += dx; by += dy;
                } else if (dragOp === 'resize-nw') { bx += dx; by += dy; bw -= dx; bh -= dy; }
                else if (dragOp === 'resize-n')  { by += dy; bh -= dy; }
                else if (dragOp === 'resize-ne') { by += dy; bw += dx; bh -= dy; }
                else if (dragOp === 'resize-e')  { bw += dx; }
                else if (dragOp === 'resize-se') { bw += dx; bh += dy; }
                else if (dragOp === 'resize-s')  { bh += dy; }
                else if (dragOp === 'resize-sw') { bx += dx; bw -= dx; bh += dy; }
                else if (dragOp === 'resize-w')  { bx += dx; bw -= dx; }
                // 最小尺寸
                if (bw < 1) { if (dragOp.includes('w')) bx = bx + bw - 1; bw = 1; }
                if (bh < 1) { if (dragOp.includes('n')) by = by + bh - 1; bh = 1; }
                // ★ clamp 到图片边界
                bx = Math.max(0, Math.min(imgW - bw, bx));
                by = Math.max(0, Math.min(imgH - bh, by));
                bw = Math.min(bw, imgW - bx);
                bh = Math.min(bh, imgH - by);
                setLocalAnns(prev => {
                    const next = prev.map(a => ({ ...a, bbox: [...a.bbox] }));
                    next[annIdx].bbox = [bx, by, bw, bh];
                    localAnnsRef.current = next.map(a => ({ ...a, bbox: [...a.bbox] }));
                    return next;
                });
            }
        };

        const onUp = () => {
            if (dragStartRef.current) {
                dragStartRef.current = null;
                return;
            }
            if (drawingBox) {
                const { x0, y0, x1, y1 } = drawingBox;
                const bw = Math.abs(x1 - x0), bh = Math.abs(y1 - y0);
                setDrawingBox(null);
                if (bw < 5 || bh < 5) return;
                const newBbox = [
                    Math.round(Math.max(0, Math.min(x0, x1))),
                    Math.round(Math.max(0, Math.min(y0, y1))),
                    Math.round(Math.min(bw, imgW)),
                    Math.round(Math.min(bh, imgH)),
                ];
                // ★ 快速标注：有上次类别则直接使用，否则弹窗
                if (quickMode && lastCategoryRef.current) {
                    const cat = lastCategoryRef.current;
                    const snap = localAnnsRef.current.map(a => ({ ...a, bbox: [...a.bbox] }));
                    undoStack.current = [...undoStack.current, snap];
                    redoStack.current = [];
                    const newAnn = { category: cat, bbox: newBbox, area: newBbox[2] * newBbox[3], iscrowd: 0 };
                    const next = [...localAnnsRef.current.map(a => ({ ...a, bbox: [...a.bbox] })), newAnn];
                    localAnnsRef.current = next;
                    setLocalAnns(next);
                    setSelectedAnnIdx(next.length - 1);
                    markAnnotationDirty();
                    scheduleAutoSave(); // 画框后自动保存
                } else {
                    setCategoryPickerBbox(newBbox);
                }
                return;
            }
            if (dragOp) {
                markAnnotationDirty();
                scheduleAutoSave(); // 拖拽移动/缩放结束后立即进入自动保存
                setDragOp(null);
                annoEditRef.current = null;
            }
            // B2: 完成框选 → 将矩形内的框加入多选集
            if (selRect) {
                const sx0 = Math.min(selRect.x0, selRect.x1), sx1 = Math.max(selRect.x0, selRect.x1);
                const sy0 = Math.min(selRect.y0, selRect.y1), sy1 = Math.max(selRect.y0, selRect.y1);
                if (sx1 - sx0 > 4 && sy1 - sy0 > 4) {
                    const hit = new Set();
                    localAnnsRef.current.forEach((a, i) => {
                        if (!a.bbox) return;
                        const [bx, by, bw, bh] = a.bbox;
                        // 框内任意部分重叠即选中
                        if (bx < sx1 && bx+bw > sx0 && by < sy1 && by+bh > sy0) hit.add(i);
                    });
                    if (hit.size > 0) setSelectedAnnIdxSet(hit);
                }
                setSelRect(null);
            }
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    }, [annotateMode, drawingBox, dragOp, selectedAnnIdx, quickMode, selRect, currentImage.width, currentImage.height, markAnnotationDirty]); // eslint-disable-line

    // 键盘快捷键（标注模式专属 + 通用）
    const navigate = async (dir) => {
        if (onUpdateNote && noteInput !== currentNote) onUpdateNote(currentImage.image_id, noteInput);
        const newIdx = imageIdx + dir;
        if (newIdx < 0 || newIdx >= images.length) return;
        // 标注状态下：切图前立即落盘，确保和图片分类一样“操作后切图即写入”
        if (annotateModeRef.current && dirtyRef.current) {
            const savingAnns = localAnnsRef.current.map(a => ({ ...a, bbox: [...(a.bbox || [])] }));
            try {
                setSaveStatus('saving');
                await persistAnnotationsNow(currentImage.image_id, savingAnns);
                setDirty(false);
                dirtyRef.current = false;
                if (onAnnotationsSaved) onAnnotationsSaved(currentImage.image_id, savingAnns);
                setCurrentImage(prev => ({ ...prev, annotations: savingAnns }));
                setSaveStatus('saved');
                setTimeout(() => setSaveStatus('idle'), 1200);
            } catch (e) {
                setSaveStatus('error');
                alert('切图前保存失败: ' + e.message);
                setTimeout(() => setSaveStatus('idle'), 2000);
                return; // 保存失败不切图，避免数据丢失
            }
        }
        // 标注模式导航后保持标注模式
        if (annotateModeRef.current) keepAnnotateModeRef.current = true;
            setCurrentImage(images[newIdx]);
            setHiddenAnns(new Set());
            onNavigate(images[newIdx]);
    };

    const toggleAnn = (idx) => {
        const newSet = new Set(hiddenAnns);
        if (newSet.has(idx)) newSet.delete(idx);
        else newSet.add(idx);
        setHiddenAnns(newSet);
    };

    const handleCategoryChange = (e) => {
        const cat = e.target.value;
        const unclassified = catList[0] || '未分类';
        if (multiSelectCat && cat !== unclassified) {
            // 多选模式且非"未分类"：提到首位，同时去掉"未分类"
            const next = [cat, ...currentCategories.filter(c => c !== cat && c !== unclassified)];
        if (onUpdateCategories) onUpdateCategories(currentImage.image_id, next); else if (onUpdateCategory) onUpdateCategory(currentImage.image_id, cat);
        } else {
            // 单选模式，或选了"未分类"（互斥，清空其它）：只保留该分类
            if (onUpdateCategories) onUpdateCategories(currentImage.image_id, [cat]); else if (onUpdateCategory) onUpdateCategory(currentImage.image_id, cat);
        }
    };
    const addImageCategoryInline = () => {
        const name = (newImageCategoryName || '').trim();
        if (!name) return;
        const existing = Array.isArray(catList) ? catList : [];
        if (existing.includes(name)) {
            setNewImageCategoryName('');
            handleCategoryChange({ target: { value: name } });
            return;
        }
        const currentColors = imageCategoryColors || config.imageCategoryColors || DEFAULT_CONFIG.imageCategoryColors || {};
        const nextColor = palette[(existing.length || 0) % palette.length] || '#888888';
        onUpdateImageCategories?.([...existing, name]);
        onUpdateImageCategoryColors?.({ ...currentColors, [name]: nextColor });
        setNewImageCategoryName('');
        handleCategoryChange({ target: { value: name } });
    };
    const toggleCategory = (cat) => {
        // 仅多选模式下使用；"未分类"与其它分类互斥
        const unclassified = catList[0] || '未分类';
        const has = currentCategories.includes(cat);
        // 去掉"未分类"再操作（选了具体分类就不应留"未分类"）
        let next = currentCategories.filter(c => c !== unclassified);
        if (has) {
            next = next.filter(c => c !== cat);
        } else {
            next = [...next, cat];
        }
        if (next.length === 0) next = [unclassified]; // 全取消时回退"未分类"
        if (onUpdateCategories) onUpdateCategories(currentImage.image_id, next);
    };

    const handleNoteBlur = () => {
        if (onUpdateNote && noteInput !== currentNote) onUpdateNote(currentImage.image_id, noteInput);
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            const inInput = document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);

            // 标注模式快捷键
            if (annotateModeRef.current) {
                // Enter: 强制保存并退出到看图状态（等价“保存后点 X”）
                if (e.key === 'Enter' && !e.shiftKey) {
                    // 类别弹窗输入时保留原 Enter 行为（确认类别）
                    if (categoryPickerBbox) return;
                    e.preventDefault();
                    e.stopPropagation();
                    exitAnnotateMode(false);
                    return;
                }
                // 空格：临时切换平移模式
                if (e.key === ' ' && !inInput) {
                    e.preventDefault();
                    spaceRef.current = true;
                    setEditCursor('grab');
                    return;
                }
                if (e.key === 'Escape') { setSelectedAnnIdx(null); setSelectedAnnIdxSet(new Set()); setDrawingBox(null); setSelRect(null); return; }
                if ((e.key === 'Delete' || e.key === 'Backspace') && !inInput) {
                    e.preventDefault();
                    const toDelete = selectedAnnIdxSet.size > 0 ? selectedAnnIdxSet : (selectedAnnIdx !== null ? new Set([selectedAnnIdx]) : new Set());
                    if (toDelete.size > 0) {
                        const next = localAnnsRef.current.filter((_, i) => !toDelete.has(i));
                        commitChange(next);
                        setSelectedAnnIdx(null);
                        setSelectedAnnIdxSet(new Set());
                    }
                    return;
                }
                if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
                if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
                if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveAnnotations(); return; }
                // B1: 复制粘贴
                if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !inInput) {
                    e.preventDefault();
                    if (selectedAnnIdx !== null && localAnns[selectedAnnIdx]) {
                        copiedAnnRef.current = { ...localAnns[selectedAnnIdx], bbox: [...localAnns[selectedAnnIdx].bbox] };
                    }
                    return;
                }
                if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !inInput) {
                    e.preventDefault();
                    const src = copiedAnnRef.current;
                    if (src) {
                        const newBbox = [src.bbox[0]+10, src.bbox[1]+10, src.bbox[2], src.bbox[3]];
                        const newAnn = { ...src, bbox: newBbox };
                        commitChange([...localAnns, newAnn]);
                        setSelectedAnnIdx(localAnns.length);
                    }
                    return;
                }
                // B9: 帮助面板
                if (!inInput && e.key === '?') { setShowHelp(prev => !prev); return; }
                if (!inInput && e.key.toLowerCase() === 'v') { setAnnoTool('select'); setEditCursor('default'); return; }
                if (!inInput && e.key.toLowerCase() === 'b') { setAnnoTool('draw'); setEditCursor('crosshair'); return; }
                if (!inInput && e.key.toLowerCase() === 'q') { setQuickMode(prev => !prev); return; }
                // 数字键1-9：有选中框时切换该框类别，否则切换图片主分类
                if (!inInput && e.key >= '1' && e.key <= '9') {
                    const catIdx = parseInt(e.key) - 1;
                    if (selectedAnnIdx !== null && categories.length > 0 && categories[catIdx]) {
                        e.preventDefault();
                        const newCat = categories[catIdx];
                        lastCategoryRef.current = newCat;
                        commitChange(localAnnsRef.current.map((a, i) => i === selectedAnnIdx ? { ...a, category: newCat } : a));
                        return;
                    }
                }
                // 方向键微调选中框（1px 或 Shift+10px）
                // 无选中框时：左/右方向键切换图片（会自动保存）
                if (!inInput && selectedAnnIdx === null && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                    e.preventDefault();
                    navigate(e.key === 'ArrowLeft' ? -1 : 1);
                    return;
                }
                if (!inInput && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key) && selectedAnnIdx !== null) {
                    e.preventDefault();
                    const step = e.shiftKey ? 10 : 1;
                    const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
                    const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
                    setLocalAnns(prev => {
                        const cur = prev[selectedAnnIdx];
                        if (!cur || !cur.bbox) return prev;
                        if (!e.repeat) {
                            undoStack.current = [...undoStack.current, prev.map(a=>({...a,bbox:[...a.bbox]}))];
                            redoStack.current = [];
                        }
                        const imgW = currentImage.width || 1e6;
                        const imgH = currentImage.height || 1e6;
                        const [bx, by, bw, bh] = cur.bbox;
                        const nx = Math.max(0, Math.min(imgW - bw, bx + dx));
                        const ny = Math.max(0, Math.min(imgH - bh, by + dy));
                        const next = prev.map((a,i) => i === selectedAnnIdx ? {...a, bbox:[nx,ny,bw,bh]} : a);
                        markAnnotationDirty();
                        if (!e.repeat) scheduleAutoSave(); // 松手后保存（repeat时防抖已处理）
                        return next;
                    });
                    return;
                }
                return; // 标注模式不响应其他键
            }

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

            if (e.key === '?') { setShowHelp(prev => !prev); return; }
            // C4: 全屏
            if (e.key.toLowerCase() === 'f') { e.preventDefault(); toggleFullscreen(); return; }
            // C8: 快捷缩放 0=适应窗口
            if (e.key === '0') { e.preventDefault(); setZoom(fitZoom()); setPanX(0); setPanY(0); return; }
            // C2: Tab 键循环切换高亮框
            if (e.key === 'Tab') {
                e.preventDefault();
                const anns = currentImage.annotations.filter((ann, i) => ann.bbox && !hiddenAnns.has(i) && !hiddenCats.has(ann.category) && passesConfThreshold(ann, confThresholdGT));
                if (!anns.length) return;
                const visIdxs = currentImage.annotations.map((ann, i) => ({ ann, i })).filter(({ ann, i }) => ann.bbox && !hiddenAnns.has(i) && !hiddenCats.has(ann.category) && passesConfThreshold(ann, confThresholdGT)).map(({ i }) => i);
                const curPos = hoveredAnnIdx !== null ? visIdxs.indexOf(hoveredAnnIdx) : -1;
                const nextPos = e.shiftKey ? (curPos - 1 + visIdxs.length) % visIdxs.length : (curPos + 1) % visIdxs.length;
                setHoveredAnnIdx(visIdxs[nextPos]);
                return;
            }
            if (e.key === 'Escape') { setLockedAnn(null); setShowHelp(false); }
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
                    const unclassified = catList[0] || '未分类';
                    let next;
                    if (multiSelectCat && cat !== unclassified) {
                        // 多选且非"未分类"：提到首位并去掉"未分类"
                        next = [cat, ...currentCategories.filter(c => c !== cat && c !== unclassified)];
                    } else {
                        // 单选或选了"未分类"：清空其它
                        next = [cat];
                    }
                    if (onUpdateCategories) onUpdateCategories(currentImage.image_id, next);
                    else if (onUpdateCategory) onUpdateCategory(currentImage.image_id, cat);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [imageIdx, currentImage.image_id, noteInput, currentNote, catList, currentCategories, onUpdateCategories, onUpdateCategory, images, selectedAnnIdx, localAnns, confThresholdGT, hiddenAnns, hiddenCats, hoveredAnnIdx, categoryPickerBbox, markAnnotationDirty]); // eslint-disable-line

    // 兜底：窗口关闭/刷新前，若有脏数据则尽力落盘
    useEffect(() => {
        const onBeforeUnload = () => {
            if (!dirtyRef.current || !currentImageRef.current?.image_id) return;
            const payload = {
                dataset_id: datasetId,
                images: [{
                    image_id: currentImageRef.current.image_id,
                    annotations: (localAnnsRef.current || []).map(a => ({
                        category_id: a.category_id,
                        category: a.category,
                        bbox: a.bbox,
                        area: a.bbox ? a.bbox[2] * a.bbox[3] : 0,
                        iscrowd: a.iscrowd || 0,
                    })),
                }],
            };
            try {
                const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
                navigator.sendBeacon('/api/save_annotations', blob);
            } catch (e) {}
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [datasetId]);

    // 跟踪 Ctrl/Cmd 和 Space 按键松开
    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.key === 'Control' || e.key === 'Meta') modifierKeyRef.current = true;
        };
        const onKeyUp = (e) => {
            if (e.key === 'Control' || e.key === 'Meta') modifierKeyRef.current = false;
            if (e.key === ' ') {
                spaceRef.current = false;
                dragStartRef.current = null; // 释放空格时终止平移
                // 恢复工具对应的光标
                setEditCursor(annoToolRef.current === 'draw' ? 'crosshair' : 'default');
            }
        };
        const onBlur = () => { modifierKeyRef.current = false; spaceRef.current = false; };
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
        const zoomMin = viewer.zoomMin ?? 0.01;
        const zoomMax = viewer.zoomMax ?? 9999;
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

    // 左键按下：标注模式下禁用平移（由 editCanvas 接管），查看模式下拖拽平移
    const handleMouseDown = (e) => {
        if (e.button !== 0) return;
        if (annotateModeRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        dragStartRef.current = { clientX: e.clientX, clientY: e.clientY, panX, panY };
        // C1: 记录点击起点，用于 mouseup 时判断是否是点击（非拖拽）
        clickStartRef.current = { clientX: e.clientX, clientY: e.clientY };
    };

    // C1: 查看模式点击检测（mouseup 时比较位移）
    const handleViewClick = (e) => {
        if (annotateModeRef.current) return;
        const cs = clickStartRef.current;
        if (!cs) return;
        const dist = Math.hypot(e.clientX - cs.clientX, e.clientY - cs.clientY);
        if (dist > 6) return; // 拖拽，不是点击
        clickStartRef.current = null;
        const { x: imgX, y: imgY } = viewClientToImage(e.clientX, e.clientY);
        // 检测命中 GT 框（从后往前）
        const anns = currentImage.annotations;
        for (let i = anns.length - 1; i >= 0; i--) {
            const ann = anns[i];
            if (!ann.bbox || hiddenAnns.has(i) || hiddenCats.has(ann.category)) continue;
            if (!passesConfThreshold(ann, confThresholdGT)) continue;
            const [x, y, bw, bh] = ann.bbox;
            if (imgX >= x && imgX <= x + bw && imgY >= y && imgY <= y + bh) {
                if (lockedAnn && lockedAnn.type === 'gt' && lockedAnn.idx === i) {
                    setLockedAnn(null); // 再次点击同一框 → 解锁
                } else {
                    setLockedAnn({ type: 'gt', idx: i, ann, sx: e.clientX, sy: e.clientY });
                }
                return;
            }
        }
        // 检测命中预测框
        const predAnns = currentImage.pred_annotations || [];
        for (let i = predAnns.length - 1; i >= 0; i--) {
            const ann = predAnns[i];
            if (!ann.bbox || hiddenPredAnns.has(i) || hiddenCats.has(ann.category)) continue;
            if (visiblePredModels && !visiblePredModels.has(ann._pred_source)) continue;
            if (!passesConfThreshold(ann, confThresholdPred)) continue;
            const [x, y, bw, bh] = ann.bbox;
            if (imgX >= x && imgX <= x + bw && imgY >= y && imgY <= y + bh) {
                if (lockedAnn && lockedAnn.type === 'pred' && lockedAnn.idx === i) {
                    setLockedAnn(null);
                } else {
                    setLockedAnn({ type: 'pred', idx: i, ann, sx: e.clientX, sy: e.clientY });
                }
                return;
            }
        }
        setLockedAnn(null);
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!dragStartRef.current) return;
            e.preventDefault();
            const { clientX: x0, clientY: y0, panX: px0, panY: py0 } = dragStartRef.current;
            setPanX(px0 + e.clientX - x0);
            setPanY(py0 + e.clientY - y0);
        };
        const handleMouseUp = (e) => {
            dragStartRef.current = null;
            handleViewClick(e);
        };
        window.addEventListener('mousemove', handleMouseMove, { passive: false });
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [lockedAnn, currentImage, hiddenAnns, hiddenCats, hiddenPredAnns, visiblePredModels, confThresholdGT, confThresholdPred]); // eslint-disable-line

    // C4: 全屏状态同步
    useEffect(() => {
        const onChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', onChange);
        return () => document.removeEventListener('fullscreenchange', onChange);
    }, []);

    return (
        <div className={`viewer-modal${annotateMode ? ' viewer-modal--annotate' : ''}`} ref={viewerModalRef}>
            <div className="viewer-header">
                <div className="viewer-nav">
                    <button className="viewer-nav-btn" disabled={imageIdx <= 0} onClick={() => navigate(-1)}>‹ 上一张</button>
                    <span className="viewer-info" style={{display:'flex', alignItems:'center', gap:'4px'}}>
                        <input
                            type="number" min={1} max={images.length}
                            defaultValue={imageIdx + 1}
                            key={imageIdx}
                            onKeyDown={e => {
                                if (e.key === 'Enter') {
                                    const n = parseInt(e.target.value, 10);
                                    if (!isNaN(n) && n >= 1 && n <= images.length) {
                                        const diff = n - 1 - imageIdx;
                                        if (diff !== 0) navigate(diff);
                                    }
                                    e.target.blur();
                                }
                            }}
                            className="viewer-mini-input" style={{width:'44px'}}
                            title="输入序号后回车跳转"
                        />
                        <span style={{color:'var(--text-muted)', fontSize:'12px'}}>/ {images.length}</span>
                    </span>
                    <button className="viewer-nav-btn" disabled={imageIdx >= images.length - 1} onClick={() => navigate(1)}>下一张 ›</button>
                </div>
                <div className="viewer-info" style={{display:'flex', alignItems:'center', gap:'6px'}}>
                    <span title={currentImage.file_name}>{currentImage.file_name.split('/').pop()}</span>
                    {currentImage.source_path != null && currentImage.source_path !== '' && (
                        <span className="viewer-dir" title={currentImage.source_path}> · 目录: {currentImage.source_path}</span>
                    )}
                    <button
                        title="复制文件名"
                        onClick={() => navigator.clipboard.writeText(currentImage.file_name.split('/').pop()).then(() => {}).catch(()=>{})}
                        className="vbtn-neutral" style={{borderRadius:'3px', fontSize:'11px', padding:'1px 5px', cursor:'pointer', flexShrink:0}}
                    >⎘</button>
                </div>
                <div className="viewer-controls">
                    {!annotateMode ? (
                        <>
                            <div className="viewer-toolbar-group">
                                <button type="button" className="viewer-nav-btn" onClick={() => setZoom(z => Math.min(viewer?.zoomMax ?? 9999, z * 1.2))}>+</button>
                                <input
                                    type="number" min={Math.round((viewer?.zoomMin??0.01)*100)} max={Math.round((viewer?.zoomMax??9999)*100)}
                                    value={Math.round(zoom * 100)}
                                    onChange={e => {
                                        const v = parseInt(e.target.value, 10);
                                        if (!isNaN(v) && v >= 1) {
                                            const newZ = Math.max(viewer?.zoomMin??0.01, Math.min(viewer?.zoomMax??9999, v/100));
                                            setZoom(newZ);
                                            zoomPanRef.current = { ...zoomPanRef.current, zoom: newZ };
                                        }
                                    }}
                                    onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
                                    className="viewer-mini-input" style={{width:'52px'}}
                                    title="输入缩放百分比后回车"
                                />
                                <span style={{fontSize:'11px', color:'var(--text-muted)'}}>%</span>
                                <button type="button" className="viewer-nav-btn" onClick={() => setZoom(z => Math.max(viewer?.zoomMin ?? 0.01, z / 1.2))}>−</button>
                    <button type="button" className="viewer-nav-btn" onClick={() => { setZoom(fitZoom()); setPanX(0); setPanY(0); }}>适应窗口</button>
                            </div>
                            <div className="viewer-toolbar-group">
                                <span style={{color: 'var(--text-muted)', fontSize: 'var(--font-sm)'}}>线宽:</span>
                    <select className="viewer-linewidth-select" value={lineWidth} onChange={(e) => setLineWidth(Number(e.target.value))} title="线宽 0.1～1">
                        {lineWidthOpts.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                </div>
                            <div className="viewer-toolbar-group">
                                <button
                                    className={`viewer-nav-btn vbtn ${annFill ? 'vbtn-on-cyan' : 'vbtn-off'}`}
                                    title={`标注填充 (${annFill ? '开' : '关'})`}
                                    onClick={() => setAnnFill(f => !f)}
                                >▦</button>
                                <button
                                    className={`viewer-nav-btn vbtn ${showLabels ? 'vbtn-on-green' : 'vbtn-off'}`}
                                    title={`类别标签 (${showLabels ? '开' : '关'})`}
                                    onClick={() => setShowLabels(s => !s)}
                                >Aa</button>
                                <button
                                    className={`viewer-nav-btn vbtn ${showBoxIndex ? 'vbtn-on-yellow' : 'vbtn-off'}`}
                                    title={`序号 (${showBoxIndex ? '开' : '关'})`}
                                    onClick={() => setShowBoxIndex(s => !s)}
                                >#</button>
                                <button
                                    className={`viewer-nav-btn vbtn ${confOpacity ? 'vbtn-on-purple' : 'vbtn-off'}`}
                                    title={`置信度透明 (${confOpacity ? '开' : '关'})`}
                                    onClick={() => setConfOpacity(c => !c)}
                                >∿</button>
            </div>
                            <div className="viewer-toolbar-group">
                                <button
                                    className="viewer-nav-btn vbtn vbtn-info"
                                    title="截图（含标注框信息）"
                                    onClick={exportAnnotatedImage}
                                >📷</button>
                                <button
                                    className={`viewer-nav-btn vbtn ${compareMode ? 'vbtn-on-blue' : 'vbtn-neutral'}`}
                                    title="GT vs 预测对比 (C)"
                                    onClick={() => setCompareMode(m => !m)}
                                >⊞</button>
                                <button
                                    className={`viewer-nav-btn vbtn ${showFilmstrip ? 'vbtn-on-teal' : 'vbtn-neutral'}`}
                                    title={showFilmstrip ? '隐藏底部缩略图' : '显示底部缩略图'}
                                    onClick={() => setShowFilmstrip(s => !s)}
                                >🎞</button>
                            </div>
                            <div className="viewer-toolbar-group">
                                <button
                                    className="viewer-nav-btn vbtn vbtn-neutral"
                                    title={`全屏 (F) ${isFullscreen ? '退出' : ''}`}
                                    onClick={toggleFullscreen}
                                >{isFullscreen ? '⊡' : '⊞'}</button>
                                <button
                                    className={`viewer-nav-btn vbtn ${sidebarDock === 'left' ? 'vbtn-on-blue' : 'vbtn-neutral'}`}
                                    title={`侧栏停靠：${sidebarDock === 'left' ? '左侧' : '右侧'}（点击切换）`}
                                    onClick={toggleSidebarDock}
                                >{sidebarDock === 'left' ? '⇤' : '⇥'}</button>
                                <button
                                    className="viewer-nav-btn vbtn vbtn-neutral"
                                    title="快捷键帮助 (?)"
                                    onClick={() => setShowHelp(h => !h)}
                                >?</button>
                            </div>
                            <div className="viewer-toolbar-group">
                                <button
                                    className={`viewer-nav-btn vbtn ${annoTool === 'draw' ? 'vbtn-on-green' : 'vbtn-off'}`}
                                    title="打标：拉框 (B)"
                                    onClick={() => switchAnnoTool('draw')}
                                >⬛</button>
                                <button
                                    className={`viewer-nav-btn vbtn ${annoTool === 'select' ? 'vbtn-on-blue' : 'vbtn-off'}`}
                                    title="选择：框上移动/调整，空白处长按拖动画布 (V)"
                                    onClick={() => switchAnnoTool('select')}
                                >⬡</button>
                            </div>
                        </>
                    ) : (
                        // 标注模式工具栏（模式文案见上方 viewer-mode-strip）
                        <>
                            <div className="viewer-toolbar-group">
                                <button
                                    className={`viewer-nav-btn vbtn ${annoTool === 'draw' ? 'vbtn-on-green' : 'vbtn-off'}`}
                                    title="打标：拉框 (B)"
                                    onClick={() => switchAnnoTool('draw')}
                                >⬛</button>
                                <button
                                    className={`viewer-nav-btn vbtn ${annoTool === 'select' ? 'vbtn-on-blue' : 'vbtn-off'}`}
                                    title="选择：框上移动/调整，空白处长按拖动画布 (V)"
                                    onClick={() => switchAnnoTool('select')}
                                >⬡</button>
                                <button
                                    className={`viewer-nav-btn vbtn ${quickMode ? 'vbtn-on-lime' : 'vbtn-off'}`}
                                    title={`快速模式${quickMode ? '开启' : '关闭'}: 画完框直接使用上次类别 (Q)`}
                                    onClick={() => setQuickMode(q => !q)}
                                >{quickMode ? '⚡快速' : '⚡'}</button>
                            </div>
                            <div className="viewer-toolbar-group">
                                <button className="viewer-nav-btn" title="撤销 Ctrl+Z" onClick={undo} style={{fontSize:'15px', padding:'1px 6px'}}>↩</button>
                                <button className="viewer-nav-btn" title="重做 Ctrl+Y" onClick={redo} style={{fontSize:'15px', padding:'1px 6px'}}>↪</button>
                                <button
                                    className="viewer-nav-btn"
                                    style={{ background: saveStatus === 'saved' ? 'rgba(62,207,142,0.2)' : 'rgba(111,140,255,0.2)', color: saveStatus === 'error' ? 'var(--danger)' : saveStatus === 'saved' ? 'var(--success)' : 'var(--accent)', border: `1px solid ${saveStatus === 'error' ? 'var(--danger)' : saveStatus === 'saved' ? 'var(--success)' : 'var(--accent)'}`, minWidth: '70px' }}
                                    onClick={saveAnnotations}
                                    disabled={saveStatus === 'saving'}
                                    title="保存 Ctrl+S"
                                >
                                    {saveStatus === 'saving' ? '保存中…' : saveStatus === 'saved' ? '✓ 已保存' : saveStatus === 'error' ? '✗ 失败' : `💾 保存${dirty ? ' *' : ''}`}
                                </button>
                            </div>
                            <div className="viewer-toolbar-group">
                                <button
                                    className={`viewer-nav-btn vbtn ${annFill ? 'vbtn-on-cyan' : 'vbtn-off'}`}
                                    title={`半透明填充 (${annFill ? '开' : '关'})`}
                                    onClick={() => setAnnFill(f => !f)}
                                >▦</button>
                                <button
                                    className={`viewer-nav-btn vbtn ${snapEnabled ? 'vbtn-on-purple' : 'vbtn-off'}`}
                                    title={`贴边吸附 (${snapEnabled ? '开' : '关'})`}
                                    onClick={() => setSnapEnabled(s => !s)}
                                >⊕</button>
                            </div>
                            <div className="viewer-toolbar-group">
                                <button
                                    className="viewer-nav-btn vbtn vbtn-neutral"
                                    title="复制全部标注到跨图剪贴板"
                                    onClick={copyAnnotationsToClipboard}
                                >⎘ 跨图</button>
                                {crossImageClipboardRef.current && crossImageClipboardRef.current.length > 0 && (
                                    <button
                                        className="viewer-nav-btn vbtn vbtn-on-teal"
                                        title={`粘贴跨图标注 (${crossImageClipboardRef.current.length} 个框)`}
                                        onClick={pasteAnnotationsFromClipboard}
                                    >⎘ 粘贴</button>
                                )}
                            </div>
                            <div className="viewer-toolbar-group">
                                <button
                                    className="viewer-nav-btn vbtn vbtn-neutral"
                                    title="快捷键帮助 (?)"
                                    onClick={() => setShowHelp(h => !h)}
                                >?</button>
                            </div>
                        </>
                    )}
                    <button className="viewer-nav-btn btn-danger" onClick={onClose} style={{border:'none', marginLeft: '8px'}}>✕</button>
                </div>
            </div>
            <div
                className={`viewer-mode-strip${!annotateMode ? ' viewer-mode-strip--view' : ''}${annotateMode && annoTool === 'draw' ? ' viewer-mode-strip--annotate viewer-mode-strip--draw' : ''}${annotateMode && annoTool === 'select' ? ' viewer-mode-strip--annotate viewer-mode-strip--select' : ''}`}
                role="status"
            >
                <span className="viewer-mode-strip-badge">
                    {!annotateMode ? '看图' : (annoTool === 'draw' ? '标注 · 拉框' : '标注 · 拖框 / 调整')}
                </span>
                {!annotateMode && (
                    <span className="viewer-mode-strip-hint">浏览 · 滚轮缩放 · 拖动画布</span>
                )}
                {annotateMode && (
                    <span className="viewer-mode-strip-hint">
                        {annoTool === 'draw'
                            ? '拖拽绘制新框 · 快捷键 B 拉框 / V 选择'
                            : '点选框以移动或调整 · 空白处拖动画布'}
                        <span className="viewer-mode-strip-kbd"> Enter 保存并退出 · Esc 关闭看图</span>
                    </span>
                )}
            </div>
            {/* 标注模式：缩放操作栏 */}
            {annotateMode && (
                <div style={{ display:'flex', alignItems:'center', gap:'6px', padding:'4px 12px', background:'var(--bg-soft)', borderBottom:'1px solid var(--border)', fontSize:'12px', color:'var(--text-muted)' }}>
                    <span>缩放:</span>
                    <button type="button" className="viewer-nav-btn" style={{padding:'2px 8px',fontSize:'13px'}} onClick={() => setZoom(z => Math.min(viewer?.zoomMax ?? 9999, z * 1.2))}>+</button>
                    <span style={{color:'var(--text-secondary)'}}>{Math.round(zoom * 100)}%</span>
                    <button type="button" className="viewer-nav-btn" style={{padding:'2px 8px',fontSize:'13px'}} onClick={() => setZoom(z => Math.max(viewer?.zoomMin ?? 0.01, z / 1.2))}>−</button>
                    <button type="button" className="viewer-nav-btn" style={{padding:'2px 8px',fontSize:'13px'}} onClick={() => { setZoom(fitZoom()); setPanX(0); setPanY(0); }}>适应</button>
                    <span style={{width:'1px', height:'14px', background:'var(--border)', margin:'0 8px'}}></span>
                    <span style={{color:'var(--text-muted)', fontSize:'11px'}}>亮度</span>
                    <input type="range" min="30" max="200" value={brightness} onChange={e=>setBrightness(Number(e.target.value))}
                        style={{width:'70px', accentColor:'#ffaa00'}} title={`亮度 ${brightness}%`} />
                    <span style={{color: brightness!==100?'#ffaa00':'var(--text-muted)', fontSize:'10px', minWidth:'30px'}}>{brightness}%</span>
                    <span style={{color:'var(--text-muted)', fontSize:'11px'}}>对比度</span>
                    <input type="range" min="30" max="300" value={contrast} onChange={e=>setContrast(Number(e.target.value))}
                        style={{width:'70px', accentColor:'#7af'}} title={`对比度 ${contrast}%`} />
                    <span style={{color: contrast!==100?'#7af':'var(--text-muted)', fontSize:'10px', minWidth:'30px'}}>{contrast}%</span>
                    <button onClick={() => { setBrightness(100); setContrast(100); }}
                        title="重置亮度和对比度"
                        style={{fontSize:'10px', padding:'1px 5px', background: (brightness!==100||contrast!==100)?'rgba(255,200,0,0.1)':'transparent', border:`1px solid ${(brightness!==100||contrast!==100)?'var(--text-muted)':'var(--border)'}`, color:(brightness!==100||contrast!==100)?'var(--text-secondary)':'var(--text-muted)', borderRadius:'3px', cursor:'pointer'}}>↺</button>
                    <span style={{marginLeft:'auto', color:'var(--text-secondary)'}}>{localAnns.length} 个框{selectedAnnIdxSet.size > 0 ? ` | 已多选 ${selectedAnnIdxSet.size}` : ''}</span>
                </div>
            )}

            <div className={`viewer-body ${hasPredAnnotations ? 'has-left-pred' : ''} ${sidebarDock === 'right' ? 'dock-right' : 'dock-left'}`}>
                {hasPredAnnotations && (
                    <div className="viewer-sidebar viewer-sidebar-left viewer-sidebar-pred viewer-slot-pred" style={{ width: predSidebarWidth, flexShrink: 0, minWidth: 0 }}>
                        <div className="viewer-sidebar-header">
                            <span>{annotateMode ? '预测参考框' : '预测标注'}</span>
                            <span>{(currentImage.pred_annotations || []).length}</span>
                        </div>
                        <div className="viewer-sidebar-list">
                            {!annotateMode && (
                                <div style={{ padding: '6px 0 10px', borderBottom: '1px solid var(--border)', marginBottom: '8px' }}>
                                    <div style={{ padding: '0 2px 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>预测置信度 ≥</span>
                                        <span style={{ fontSize: 'var(--font-xs)', color: confThresholdPred > 0 ? 'var(--accent)' : 'var(--text-muted)', fontFamily: 'monospace', marginLeft: 'auto' }}>
                                            {confThresholdPred > 0 ? (confThresholdPred * 100).toFixed(1) + '%' : 'off'}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.05"
                                            value={confThresholdPred}
                                            onChange={e => setConfThresholdPred(Number(e.target.value))}
                                            style={{ flex: 1, accentColor: 'var(--accent)' }}
                                        />
                                        {confThresholdPred > 0 && (
                                            <button type="button" onClick={() => setConfThresholdPred(0)} className="vbtn vbtn-neutral" style={{ padding: '0 6px', fontSize: '11px' }}>✕</button>
                                        )}
                                    </div>
                                </div>
                            )}
                            {annotateMode ? (
                                (() => {
                                    const predAnns = (currentImage.pred_annotations || []).filter(a => !visiblePredModels || visiblePredModels.has(a._pred_source));
                                    if (predAnns.length === 0) return <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>当前无可见预测框</div>;
                                    return (
                                        <>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '6px' }}>
                                                <button
                                                    title="全部接受为 GT"
                                                    onClick={() => {
                                                        const toAdd = predAnns.map(a => ({ category: a.category, category_id: null, bbox: [...a.bbox], iscrowd: 0, _from_pred: a._pred_source || true }));
                                                        commitChange([...localAnns, ...toAdd]);
                                                    }}
                                                    className="vbtn vbtn-on-teal"
                                                    style={{ fontSize: '11px', padding: '1px 8px', borderRadius: '4px', cursor: 'pointer' }}
                                                >全部接受</button>
                                            </div>
                                            {predAnns.map((ann, idx) => (
                                                <div key={idx} className="viewer-ann-item" style={{ borderLeftColor: getCategoryColor(palette, ann.category) }}>
                                                    <div className="viewer-ann-color" style={{ background: getCategoryColor(palette, ann.category) }}></div>
                                                    <span className="viewer-ann-text" title={ann.category}>{ann.category}</span>
                                                    {ann.score !== undefined && <span className="viewer-ann-score">{(ann.score * 100).toFixed(1)}%</span>}
                                                    <button
                                                        title="接受为 GT 标注"
                                                        onClick={() => {
                                                            const newAnn = { category: ann.category, category_id: null, bbox: [...ann.bbox], iscrowd: 0, _from_pred: ann._pred_source || true };
                                                            commitChange([...localAnns, newAnn]);
                                                        }}
                                                        className="vbtn vbtn-on-teal"
                                                        style={{ marginLeft: 'auto', cursor: 'pointer', fontSize: '11px', padding: '1px 6px', borderRadius: '3px', flexShrink: 0 }}
                                                    >+GT</button>
                                                </div>
                                            ))}
                                        </>
                                    );
                                })()
                            ) : (
                                (currentImage.pred_annotations || []).map((ann, idx) => {
                                    if (!passesConfThreshold(ann, confThresholdPred)) return null;
                                    const modelHidden = visiblePredModels && !visiblePredModels.has(ann._pred_source);
                                    return (
                                        <div
                                            key={idx}
                                            className={`viewer-ann-item ${hiddenPredAnns.has(idx) || modelHidden ? 'hidden' : ''} ${(hoveredPredAnnIdx === idx || linkedPredIdxSet.has(idx)) ? 'viewer-ann-item-hovered' : ''}`}
                                            style={{ borderLeftColor: getCategoryColor(palette, ann.category) }}
                                            onClick={() => { if (!modelHidden && !hiddenPredAnns.has(idx)) centerOnAnnotation(ann.bbox); }}
                                            onMouseEnter={() => setHoveredPredAnnIdx(idx)}
                                            onMouseLeave={() => setHoveredPredAnnIdx(null)}
                                        >
                                            <div className="viewer-ann-color" style={{ background: getCategoryColor(palette, ann.category) }}></div>
                                            <span className="viewer-ann-text" title={ann._pred_source || ''}>{ann.category}</span>
                                            {ann.score != null && <span className="viewer-ann-score">{(Number(ann.score) * 100).toFixed(1)}%</span>}
                                            <button
                                                className="vbtn vbtn-neutral"
                                                title="隐藏/显示此预测框"
                                                style={{ marginLeft: 'auto', padding: '0 4px', fontSize: '10px' }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setHiddenPredAnns(prev => {
                                                        const next = new Set(prev);
                                                        if (next.has(idx)) next.delete(idx); else next.add(idx);
                                                        return next;
                                                    });
                                                }}
                                            >
                                                {hiddenPredAnns.has(idx) ? '○ 显示' : '● 隐藏'}
                                            </button>
                    </div>
                                    );
                                })
                            )}
                </div>
                    </div>
                )}
                {hasPredAnnotations && (
                    <div className="viewer-resize-handle viewer-resize-pred viewer-slot-pred-handle" onMouseDown={beginResizePred} role="separator" aria-orientation="vertical" title="拖拽调整预测栏宽度" />
                )}
                <div className="viewer-sidebar viewer-sidebar-main viewer-sidebar-left viewer-slot-main" style={{ width: mainSidebarWidth, flexShrink: 0, minWidth: 0 }}>
                    <div className="viewer-sidebar-tabbar">
                        <button type="button" className={`viewer-tab ${viewerLeftTab === 'annotate' ? 'viewer-tab-active' : ''}`} onClick={() => setViewerLeftTab('annotate')}>标注</button>
                        <button type="button" className={`viewer-tab ${viewerLeftTab === 'props' ? 'viewer-tab-active' : ''}`} onClick={() => setViewerLeftTab('props')}>属性</button>
                    </div>
                    <div className="viewer-sidebar-tabbody">
                        {viewerLeftTab === 'props' ? (
                            <div className="viewer-props-panel" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1, overflow: 'hidden' }}>
                                <div className="viewer-sidebar-header"><span>图片属性</span></div>
                                <div className="viewer-sidebar-form" style={{ padding: '8px 12px 12px', flex: 1, overflow: 'auto' }}>
                                    {propertyRowsPrimary.map((row, i) => (
                                        <div key={`p-${i}`} style={{ marginBottom: '10px' }}>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>{row.label}</div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-primary)', wordBreak: 'break-word' }}>{row.value}</div>
                                        </div>
                                    ))}
                                    {propertyRowsExtra.length > 0 && (
                                        <>
                                            <div style={{ borderTop: '1px solid var(--border)', margin: '12px 0 8px', paddingTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>其他元数据</div>
                                            {propertyRowsExtra.map((row, i) => (
                                                <div key={`pe-${row.label}-${i}`} style={{ marginBottom: '8px' }}>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>{row.label}</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', wordBreak: 'break-word' }}>{row.value}</div>
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </div>
                            </div>
                        ) : (
                        <>
                    {!annotateMode ? (
                        <>
                    <div className="viewer-sidebar-header">
                        <span>分类与筛选</span>
                    </div>
                        {/* C5: 类别筛选 */}
                        {(() => {
                            const allCats = [...new Set([
                                ...currentImage.annotations.map(a => a.category),
                                ...(currentImage.pred_annotations || []).map(a => a.category)
                            ].filter(Boolean))];
                            if (allCats.length === 0) return null;
                            return (
                                <div style={{padding:'6px 10px', borderBottom:'1px solid var(--border)', background:'var(--bg-raised)'}}>
                                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px'}}>
                                        <span style={{fontSize:'11px', color:'var(--text-muted)'}}>类别显隐</span>
                                        <div style={{display:'flex', gap:'4px'}}>
                                            <button onClick={() => setHiddenCats(new Set())} className="vbtn-neutral" style={{fontSize:'10px',padding:'1px 5px',borderRadius:'3px',cursor:'pointer'}}>全显</button>
                                            <button onClick={() => setHiddenCats(new Set(allCats))} className="vbtn-neutral" style={{fontSize:'10px',padding:'1px 5px',borderRadius:'3px',cursor:'pointer'}}>全隐</button>
                                        </div>
                                    </div>
                                    <div style={{display:'flex', flexWrap:'wrap', gap:'4px'}}>
                                        {allCats.map(cat => {
                                            const hidden = hiddenCats.has(cat);
                                            const color = getCategoryColor(palette, cat);
                                            return (
                                                <button key={cat} onClick={() => setHiddenCats(prev => { const n = new Set(prev); if (n.has(cat)) n.delete(cat); else n.add(cat); return n; })}
                                                    style={{fontSize:'11px', padding:'2px 7px', borderRadius:'12px', cursor:'pointer', border:`1px solid ${hidden ? 'var(--border)' : color}`, background: hidden ? 'transparent' : color + '22', color: hidden ? 'var(--text-muted)' : color, textDecoration: hidden ? 'line-through' : 'none', transition:'all 0.15s'}}
                                                >{cat}</button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })()}
                    <div className="viewer-sidebar-form">
                            <label className="viewer-form-label">{multiSelectCat ? '主分类 (1–9 快捷键)' : '图片分类 (1–9 快捷键)'}</label>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '8px' }}>
                            <select className="viewer-form-select" style={{ marginBottom: 0, flex: 1 }} value={currentCategory} onChange={handleCategoryChange}>
                            {catList.map((cat, i) => (
                                <option key={cat} value={cat}>{i < 9 ? `${i + 1}. ${cat}` : cat}</option>
                            ))}
                        </select>
                            <button
                                type="button"
                                className="vbtn-neutral"
                                style={{ padding: '4px 9px', whiteSpace: 'nowrap' }}
                                title="新增图片分类"
                                onClick={addImageCategoryInline}
                            >
                                +
                            </button>
                        </div>
                        <input
                            className="viewer-form-select"
                            style={{ marginBottom: '10px', height: '30px' }}
                            value={newImageCategoryName}
                            onChange={(e) => setNewImageCategoryName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    addImageCategoryInline();
                                }
                            }}
                            placeholder="新增分类名称，回车创建"
                        />
                            {multiSelectCat && (<>
                        <label className="viewer-form-label">也属于（多选）</label>
                        {currentCategory === (catList[0] || '未分类') ? (
                            <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', marginBottom: '10px' }}>请先选择主分类后再设置多选</div>
                        ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                                {catList.filter(c => c !== currentCategory && c !== (catList[0] || '未分类')).map(cat => (
                                    <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--font-sm)', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={currentCategories.includes(cat)} onChange={() => toggleCategory(cat)} />
                                        <span style={{ background: (imageCategoryColors || config.imageCategoryColors || {})[cat] || '#666', padding: '2px 6px', borderRadius: '4px', color: '#fff' }}>{cat}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                            </>)}
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
                        </>
                    ) : (
                        // 标注模式侧边栏
                        <div className="viewer-sidebar-form" style={{paddingBottom:'4px'}}>
                            <div style={{fontSize:'12px', color:'var(--text-muted)', padding:'6px 12px', borderBottom:'1px solid var(--border)'}}>
                                <div style={{marginTop:'2px'}}>
                                    <span style={{color:'#52c41a'}}>GT {localAnns.length}</span>
                                    {(currentImage.pred_annotations || []).length > 0 && (
                                        <span style={{color:'var(--accent)', marginLeft:'8px'}}>预测 {(currentImage.pred_annotations || []).length}</span>
                                    )}
                                </div>
                                <div style={{marginTop:'4px', color: dirty ? 'var(--warning)' : 'var(--text-muted)'}}>{dirty ? '● 有未保存修改' : '○ 已保存'}</div>
                                <div style={{marginTop:'6px', fontSize:'11px'}}>文件名与元数据见「属性」标签</div>
                            </div>
                        </div>
                    )}
                    <div className="viewer-sidebar-header" style={{marginTop: '10px'}}>
                        <span>{annotateMode ? '编辑中的标注' : '标注列表'}</span>
                        <span>{annotateMode ? localAnns.length : (confThresholdGT > 0 && currentImage.annotations.some(a => a.score != null) ? `${currentImage.annotations.filter(a => passesConfThreshold(a, confThresholdGT)).length}/${currentImage.annotations.length}` : currentImage.annotations.length)}</span>
                    </div>
                    {/* B6: 类别搜索 */}
                    <div style={{padding:'5px 10px', borderBottom:'1px solid var(--border)'}}>
                        <input
                            type="text"
                            placeholder="搜索类别…"
                            value={annSearchText}
                            onChange={e => setAnnSearchText(e.target.value)}
                            className="viewer-mini-input" style={{width:'100%', boxSizing:'border-box', padding:'3px 7px', fontSize:'12px'}}
                        />
                    </div>
                    <div style={{padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 'var(--font-xs)', color: 'var(--text-muted)'}}>
                        {!annotateMode && (
                            <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'center' }}>
                                <span><span style={{color:'#52c41a', fontWeight:'bold'}}>
                                    {confThresholdGT > 0 && currentImage.annotations.some(a => a.score != null)
                                        ? `${currentImage.annotations.filter(a => passesConfThreshold(a, confThresholdGT)).length}/${currentImage.annotations.length}`
                                        : currentImage.annotations.length}
                                </span> GT 标注</span>
                                {(currentImage.pred_annotations || []).length > 0 && (
                                    <span><span style={{color:'var(--accent)', fontWeight:'bold'}}>{(currentImage.pred_annotations || []).length}</span> 预测框</span>
                                )}
                                <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>详情见「属性」</span>
                            </div>
                        )}
                    </div>
                    {!annotateMode && currentImage.annotations.some(a => a.score != null) && (
                        <div style={{padding: '6px 12px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px'}}>
                            <span style={{fontSize: 'var(--font-xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap'}} title="仅作用于 GT">GT 置信度 ≥</span>
                            <input
                                type="range"
                                min="0" max="1" step="0.05"
                                value={confThresholdGT}
                                onChange={e => setConfThresholdGT(Number(e.target.value))}
                                style={{flex: 1, accentColor: 'var(--accent)'}}
                            />
                            <span style={{fontSize: 'var(--font-xs)', color: confThresholdGT > 0 ? 'var(--accent)' : 'var(--text-muted)', fontFamily: 'monospace', minWidth: '32px', textAlign: 'right'}}>
                                {confThresholdGT > 0 ? (confThresholdGT * 100).toFixed(1) + '%' : 'off'}
                            </span>
                            {confThresholdGT > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setConfThresholdGT(0)}
                                    style={{background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 'var(--font-xs)', padding: '0 2px'}}
                                    title="重置过滤"
                                >✕</button>
                            )}
                        </div>
                    )}
                    {/* 选中框坐标精确输入面板 */}
                    {annotateMode && selectedAnnIdx !== null && localAnns[selectedAnnIdx]?.bbox && (
                        <div style={{padding:'8px 12px', borderBottom:'1px solid var(--border)', background:'var(--bg-raised)'}}>
                            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'5px'}}>
                            <span style={{fontSize:'11px', color:'var(--text-muted)'}}>精确坐标 (像素)</span>
                            <span style={{fontSize:'10px', color: getCategoryColor(palette, localAnns[selectedAnnIdx]?.category), fontWeight:'bold'}}>{localAnns[selectedAnnIdx]?.category}</span>
                        </div>
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px'}}>
                                {['X','Y','W','H'].map((field, fi) => {
                                    const bbox = localAnns[selectedAnnIdx].bbox;
                                    return (
                                        <label key={field} style={{display:'flex', alignItems:'center', gap:'4px', fontSize:'12px'}}>
                                            <span style={{color:'var(--text-secondary)', width:'16px', flexShrink:0}}>{field}:</span>
                                            <input
                                                type="number"
                                                value={Math.round(bbox[fi])}
                                                onFocus={() => {
                                                    if (!bboxFocusedRef.current) {
                                                        bboxFocusedRef.current = true;
                                                        undoStack.current = [...undoStack.current, localAnns.map(a=>({...a,bbox:[...a.bbox]}))];
                                                        redoStack.current = [];
                                                    }
                                                }}
                                                onChange={e => {
                                                    const n = parseFloat(e.target.value);
                                                    if (isNaN(n)) return;
                                                    setLocalAnns(prev => {
                                                        const next = prev.map((a,i) => i === selectedAnnIdx ? {...a, bbox:[...a.bbox]} : a);
                                                        next[selectedAnnIdx].bbox[fi] = n;
                                                        localAnnsRef.current = next.map(a => ({ ...a, bbox: [...a.bbox] }));
                                                        return next;
                                                    });
                                                    markAnnotationDirty();
                                                }}
                                                onBlur={() => {
                                                    bboxFocusedRef.current = false;
                                                    // blur 时做边界 clamp 并通过 commitChange 触发自动保存
                                                    const cur = localAnnsRef.current[selectedAnnIdx];
                                                    if (!cur?.bbox) return;
                                                    const imgW = currentImage.width || 1e6;
                                                    const imgH = currentImage.height || 1e6;
                                                    let [bx,by,bw,bh] = cur.bbox;
                                                    bw = Math.max(1, Math.min(imgW, bw));
                                                    bh = Math.max(1, Math.min(imgH, bh));
                                                    bx = Math.max(0, Math.min(imgW - bw, bx));
                                                    by = Math.max(0, Math.min(imgH - bh, by));
                                                    const clamped = localAnnsRef.current.map((a,i) => i === selectedAnnIdx ? {...a, bbox:[bx,by,bw,bh]} : a);
                                                    localAnnsRef.current = clamped.map(a => ({ ...a, bbox: [...a.bbox] }));
                                                    setLocalAnns(clamped);
                                                    markAnnotationDirty();
                                                    scheduleAutoSave();
                                                }}
                                                className="viewer-mini-input" style={{flex:1, minWidth:0, padding:'2px 4px', fontSize:'12px'}}
                                            />
                                        </label>
                                    );
                                })}
                            </div>
                                <div style={{fontSize:'10px', color:'var(--text-muted)', marginTop:'4px'}}>方向键微调 · Shift+方向键×10 · 数字键1-9切换类别</div>
                        </div>
                    )}
                    {/* 多选批量改类别 */}
                    {annotateMode && selectedAnnIdxSet.size > 1 && categories.length > 0 && (
                        <div style={{padding:'6px 10px', borderBottom:'1px solid var(--border)', background:'var(--bg-raised)'}}>
                            <div style={{fontSize:'11px', color:'#faad14', marginBottom:'5px'}}>批量改类别 ({selectedAnnIdxSet.size} 个框)</div>
                            <div style={{display:'flex', flexWrap:'wrap', gap:'4px'}}>
                                {categories.map(cat => (
                                    <button key={cat} onClick={() => {
                                        commitChange(localAnns.map((a, i) => selectedAnnIdxSet.has(i) ? { ...a, category: cat } : a));
                                        lastCategoryRef.current = cat;
                                    }} style={{
                                        padding:'2px 8px', fontSize:'11px', borderRadius:'4px', cursor:'pointer',
                                        border:`1px solid ${getCategoryColor(palette, cat)}`,
                                        background: getCategoryColor(palette, cat) + '22',
                                        color: getCategoryColor(palette, cat),
                                    }}>{cat}</button>
                                ))}
                            </div>
                        </div>
                    )}
                    {/* 标注模式：类别统计 + 清空按钮 */}
                    {annotateMode && (
                        <div style={{padding:'5px 10px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'4px'}}>
                            <div style={{display:'flex', flexWrap:'wrap', gap:'3px'}}>
                                {Object.entries(localAnns.reduce((acc, a) => { acc[a.category] = (acc[a.category]||0)+1; return acc; }, {})).map(([cat, cnt]) => (
                                    <span key={cat} style={{fontSize:'10px', padding:'1px 5px', borderRadius:'3px', background: getCategoryColor(palette, cat)+'33', color: getCategoryColor(palette, cat), border:`1px solid ${getCategoryColor(palette, cat)}66`}}>
                                        {cat} {cnt}
                                    </span>
                                ))}
                                {localAnns.length === 0 && <span style={{fontSize:'10px', color:'var(--text-muted)'}}>暂无标注</span>}
                            </div>
                            {localAnns.length > 0 && (
                                <button onClick={() => { if(window.confirm(`清空本图全部 ${localAnns.length} 个标注？`)) { commitChange([]); setSelectedAnnIdx(null); setSelectedAnnIdxSet(new Set()); } }}
                                    title="清空本图所有标注（可撤销）"
                                    style={{fontSize:'10px', padding:'1px 6px', background:'transparent', border:`1px solid var(--danger)`, color:'var(--danger)', borderRadius:'3px', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0}}>
                                    🗑 清空
                                </button>
                            )}
                        </div>
                    )}
                    <div className="viewer-sidebar-list">
                        {annotateMode ? (
                            // 标注模式：显示 localAnns，支持选中/删除/改类别
                            localAnns.map((ann, idx) => {
                                // B6: 搜索过滤
                                if (annSearchText && !ann.category?.toLowerCase().includes(annSearchText.toLowerCase())) return null;
                                const isSelected = selectedAnnIdx === idx;
                                const isMultiSel = selectedAnnIdxSet.has(idx);
                                return (
                                    <div key={idx} style={{ borderLeft: `3px solid ${isMultiSel && !isSelected ? '#ffaa00' : getCategoryColor(palette, ann.category)}`, background: isSelected ? '#1a2a3a' : isMultiSel ? '#1a1a30' : 'transparent' }}>
                                        <div
                                            className={`viewer-ann-item ${isSelected ? 'viewer-ann-item-hovered' : ''}`}
                                            style={{ borderLeftColor: 'transparent', background: 'transparent' }}
                                            onClick={() => { setSelectedAnnIdx(isSelected ? null : idx); setSelectedAnnIdxSet(new Set()); }}
                                        >
                                            <div className="viewer-ann-color" style={{ background: getCategoryColor(palette, ann.category) }}></div>
                                            <span className="viewer-ann-text" title={ann.category}>{ann.category}</span>
                                            {ann.bbox && <span style={{fontSize:'10px', color:'var(--text-muted)', marginLeft:'4px'}}>{Math.round(ann.bbox[2])}×{Math.round(ann.bbox[3])}</span>}
                                            <button
                                                title="删除此框"
                                                onClick={e => { e.stopPropagation(); commitChange(localAnns.filter((_,i)=>i!==idx)); if(selectedAnnIdx===idx) setSelectedAnnIdx(null); }}
                                                style={{marginLeft:'auto', background:'transparent', border:'none', color:'#f55', cursor:'pointer', fontSize:'13px', padding:'0 4px'}}
                                            >✕</button>
                                        </div>
                                        {/* 选中时展开类别修改行 */}
                                        {isSelected && (
                                            <div style={{ padding: '4px 8px 6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                {(categories.length > 0 ? categories : [ann.category]).map(cat => (
                                                    <button
                                                        key={cat}
                                                        onClick={() => {
                                                            if (cat === ann.category) return;
                                                            commitChange(localAnns.map((a, i) => i === idx ? { ...a, category: cat } : a));
                                                        }}
                                                        style={{
                                                            padding: '2px 8px', fontSize: 'var(--font-xs)', borderRadius: '4px', cursor: 'pointer',
                                                            border: `1px solid ${cat === ann.category ? getCategoryColor(palette, cat) : 'var(--border)'}`,
                                                            background: cat === ann.category ? getCategoryColor(palette, cat) + '33' : 'transparent',
                                                            color: cat === ann.category ? getCategoryColor(palette, cat) : '#888',
                                                        }}
                                                    >{cat}</button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                        // 查看模式
                        currentImage.annotations.map((ann, idx) => {
                            if (annSearchText && !ann.category?.toLowerCase().includes(annSearchText.toLowerCase())) return null;
                            const belowThreshold = !passesConfThreshold(ann, confThresholdGT);
                            if (belowThreshold) return (
                            <div
                                key={idx}
                                    className="viewer-ann-item hidden"
                                    style={{ borderLeftColor: getCategoryColor(palette, ann.category), opacity: 0.35 }}
                                    title={ann.score != null ? `置信度 ${(Number(ann.score)*100).toFixed(1)}% 低于阈值 ${(confThresholdGT*100).toFixed(1)}%` : undefined}
                                >
                                    <div className="viewer-ann-color" style={{ background: getCategoryColor(palette, ann.category) }}></div>
                                    <span className="viewer-ann-text">{ann.category}</span>
                                    {ann.score != null && <span className="viewer-ann-score" style={{textDecoration: 'line-through'}}>{(Number(ann.score) * 100).toFixed(1)}%</span>}
                                    <span style={{marginLeft: 'auto', color: 'var(--text-muted)'}}>⊘</span>
                                </div>
                            );
                            return (
                            <div
                                key={idx}
                                className={`viewer-ann-item ${hiddenAnns.has(idx) ? 'hidden' : ''} ${(hoveredAnnIdx === idx || linkedGtIdxSet.has(idx)) ? 'viewer-ann-item-hovered' : ''}`}
                                style={{ borderLeftColor: getCategoryColor(palette, ann.category) }}
                                onClick={() => { if (!hiddenAnns.has(idx)) centerOnAnnotation(ann.bbox); toggleAnn(idx); }}
                                onMouseEnter={() => setHoveredAnnIdx(idx)}
                                onMouseLeave={() => setHoveredAnnIdx(null)}
                            >
                                <div className="viewer-ann-color" style={{ background: getCategoryColor(palette, ann.category) }}></div>
                                <span className="viewer-ann-text">{ann.category}</span>
                                {ann.score != null && <span className="viewer-ann-score">{(Number(ann.score) * 100).toFixed(1)}%</span>}
                                <button 
                                    className="vbtn vbtn-neutral" 
                                    title="点击居中并隐藏/显示此框" 
                                    style={{marginLeft: 'auto', padding: '0 4px', fontSize: '10px'}}
                                    onClick={(e) => { e.stopPropagation(); toggleAnn(idx); }}
                                >
                                    {hiddenAnns.has(idx) ? '○ 显示' : '● 隐藏'}
                                </button>
                            </div>
                            );
                        })
                        )}
                    </div>
                    {!annotateMode && (
                    <div style={{padding: '10px', background: 'var(--bg-raised)', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px'}}>
                        <button className="tool-btn" style={{flex: 1}} onClick={() => {
                            if (hiddenAnns.size > 0) {
                                setHiddenAnns(new Set()); // 全部显示
                            } else {
                                const allIdxs = new Set();
                                currentImage.annotations.forEach((a, i) => { if(a.bbox) allIdxs.add(i); });
                                setHiddenAnns(allIdxs); // 全部隐藏
                            }
                        }}>
                            {hiddenAnns.size > 0 ? '显示全部' : '隐藏全部'}
                        </button>
                    </div>
                    )}
                    {annotateMode && (
                    <div style={{padding: '8px 10px', background: 'rgba(26,80,26,0.25)', borderTop: '1px solid var(--border)', display: 'flex', gap: '6px'}}>
                        <button className="tool-btn" style={{flex:1, color:'var(--danger)', borderColor:'var(--danger)'}} onClick={() => { if(localAnns.length > 0 && window.confirm('清空所有标注框？')) commitChange([]); setSelectedAnnIdx(null); }}>清空全部</button>
                </div>
                    )}

                        </>
                        )}
                    </div>
                </div>
                <div className="viewer-resize-handle viewer-resize-main viewer-slot-main-handle" onMouseDown={beginResizeMain} role="separator" aria-orientation="vertical" title="拖拽调整主侧栏宽度" />
                {/* C10: 对比模式 */}
                {compareMode && !annotateMode ? (
                    <CompareLayout 
                        currentImage={currentImage} 
                        imageUrl={imageUrl} 
                        palette={palette} 
                        lineWidth={lineWidth} 
                        annFill={annFill} 
                        hiddenCats={hiddenCats} 
                        brightness={brightness} 
                        contrast={contrast} 
                        visiblePredModels={visiblePredModels} 
                        confOpacity={confOpacity} 
                        confThresholdGT={confThresholdGT}
                        confThresholdPred={confThresholdPred}
                    />
                ) : (
                <div
                    className={`viewer-canvas-area viewer-slot-canvas ${(viewer.backgroundStyle || 'checkerboard') === 'checkerboard' ? 'viewer-bg-checkerboard' : 'viewer-bg-solid'}`}
                    ref={containerRef}
                    onMouseDown={handleMouseDown}
                    onDoubleClick={(e) => {
                        if (annotateMode) return;
                        e.preventDefault();
                        e.stopPropagation();
                        const hit = hitTestGtAnnAtClient(e.clientX, e.clientY);
                        if (hit >= 0) enterAnnotateMode('select', hit);
                        else enterAnnotateMode('draw');
                    }}
                    onContextMenu={!annotateMode ? (e) => {
                        e.preventDefault();
                        const wrapper = wrapperRef.current;
                        if (!wrapper) return;
                        const rect = wrapper.getBoundingClientRect();
                        const imgX = (e.clientX - rect.left) / zoom, imgY = (e.clientY - rect.top) / zoom;
                        const tol = Math.max(4, 8 / zoom);
                        // 检测 GT 框
                        const anns = currentImage.annotations;
                        for (let i = anns.length - 1; i >= 0; i--) {
                            const ann = anns[i];
                            if (!ann.bbox || hiddenAnns.has(i) || hiddenCats.has(ann.category)) continue;
                            if (!passesConfThreshold(ann, confThresholdGT)) continue;
                            const [x, y, bw, bh] = ann.bbox;
                            if (imgX >= x - tol && imgX <= x + bw + tol && imgY >= y - tol && imgY <= y + bh + tol) {
                                setCtxMenu({ x: e.clientX, y: e.clientY, ann, type: 'gt', annIdx: i });
                                return;
                            }
                        }
                        // 检测预测框
                        const predAnns = currentImage.pred_annotations || [];
                        for (let i = predAnns.length - 1; i >= 0; i--) {
                            const ann = predAnns[i];
                            if (!ann.bbox || hiddenPredAnns.has(i) || hiddenCats.has(ann.category)) continue;
                            if (visiblePredModels && !visiblePredModels.has(ann._pred_source)) continue;
                            if (!passesConfThreshold(ann, confThresholdPred)) continue;
                            const [x, y, bw, bh] = ann.bbox;
                            if (imgX >= x - tol && imgX <= x + bw + tol && imgY >= y - tol && imgY <= y + bh + tol) {
                                setCtxMenu({ x: e.clientX, y: e.clientY, ann, type: 'pred', annIdx: i });
                                return;
                            }
                        }
                        setCtxMenu(null);
                    } : undefined}
                    onMouseMove={(e) => {
                        if (annotateMode) {
                            if (crosshairXRef.current && crosshairYRef.current) {
                                const rect = containerRef.current.getBoundingClientRect();
                                crosshairXRef.current.style.top = (e.clientY - rect.top) + 'px';
                                crosshairYRef.current.style.left = (e.clientX - rect.left) + 'px';
                                crosshairXRef.current.style.display = 'block';
                                crosshairYRef.current.style.display = 'block';
                            }
                        } else {
                            if (crosshairXRef.current && crosshairYRef.current) {
                                crosshairXRef.current.style.display = 'none';
                                crosshairYRef.current.style.display = 'none';
                            }
                            // 查看模式：鼠标在框线上时高亮并显示 tooltip
                            const wrapper = wrapperRef.current;
                            if (!wrapper) return;
                            const rect = wrapper.getBoundingClientRect();
                            const imgX = (e.clientX - rect.left) / zoom, imgY = (e.clientY - rect.top) / zoom;
                            const tol = Math.max(4, 6 / zoom); // 容差（图片像素）
                            // 检测 GT 框线
                            const anns = currentImage.annotations;
                            for (let i = anns.length - 1; i >= 0; i--) {
                                const ann = anns[i];
                                if (!ann.bbox || hiddenAnns.has(i) || hiddenCats.has(ann.category)) continue;
                                if (!passesConfThreshold(ann, confThresholdGT)) continue;
                                const [x, y, bw, bh] = ann.bbox;
                                const onBorder = imgX >= x - tol && imgX <= x + bw + tol && imgY >= y - tol && imgY <= y + bh + tol
                                    && !(imgX > x + tol && imgX < x + bw - tol && imgY > y + tol && imgY < y + bh - tol);
                                if (onBorder) { setHoveredAnnIdx(i); setHoveredPredAnnIdx(null); return; }
                            }
                            // 检测预测框线
                            const predAnns = currentImage.pred_annotations || [];
                            for (let i = predAnns.length - 1; i >= 0; i--) {
                                const ann = predAnns[i];
                                if (!ann.bbox || hiddenPredAnns.has(i) || hiddenCats.has(ann.category)) continue;
                                if (visiblePredModels && !visiblePredModels.has(ann._pred_source)) continue;
                                if (!passesConfThreshold(ann, confThresholdPred)) continue;
                                const [x, y, bw, bh] = ann.bbox;
                                const onBorder = imgX >= x - tol && imgX <= x + bw + tol && imgY >= y - tol && imgY <= y + bh + tol
                                    && !(imgX > x + tol && imgX < x + bw - tol && imgY > y + tol && imgY < y + bh - tol);
                                if (onBorder) { setHoveredPredAnnIdx(i); setHoveredAnnIdx(null); return; }
                            }
                            setHoveredAnnIdx(null);
                            setHoveredPredAnnIdx(null);
                        }
                    }}
                    onMouseLeave={() => {
                        if (crosshairXRef.current && crosshairYRef.current) {
                            crosshairXRef.current.style.display = 'none';
                            crosshairYRef.current.style.display = 'none';
                        }
                        if (!annotateMode) {
                            setHoveredAnnIdx(null);
                            setHoveredPredAnnIdx(null);
                        }
                    }}
                    style={{
                        paddingBottom: (!annotateMode && showFilmstrip) ? VIEWER_FILMSTRIP_RESERVE_PX : 0,
                        ...((viewer.backgroundStyle || 'checkerboard') === 'checkerboard'
                            ? { '--checkerboard-1': viewer.checkerboardColor1 || '#2d2d44', '--checkerboard-2': viewer.checkerboardColor2 || '#252548' }
                            : { background: viewer.backgroundColor || '#1a1a2e' }),
                    }}
                >
                    {/* 十字辅助线 (仅标注模式显示) */}
                    <div ref={crosshairXRef} style={{ display: 'none', position: 'absolute', left: 0, right: 0, height: '1px', borderTop: '1px dashed rgba(255,255,255,0.7)', pointerEvents: 'none', zIndex: 100 }} />
                    <div ref={crosshairYRef} style={{ display: 'none', position: 'absolute', top: 0, bottom: 0, width: '1px', borderLeft: '1px dashed rgba(255,255,255,0.7)', pointerEvents: 'none', zIndex: 100 }} />
                    
                    <div className="viewer-image-wrapper" ref={wrapperRef} style={{ transform: `translate(${panX}px, ${panY}px)` }}>
                        <img ref={imgRef} src={imageUrl} alt="" onLoad={handleImageLoad} draggable={false}
                            style={brightness !== 100 || contrast !== 100 ? { filter: `brightness(${brightness}%) contrast(${contrast}%)` } : undefined} />
                        <canvas ref={canvasRef} className="viewer-canvas"></canvas>
                        {/* 标注交互层 Canvas */}
                        <canvas
                            ref={editCanvasRef}
                            className="viewer-canvas"
                            style={{
                                pointerEvents: annotateMode ? 'all' : 'none',
                                cursor: annotateMode ? editCursor : 'none',
                            }}
                            onMouseDown={annotateMode ? handleEditMouseDown : undefined}
                        ></canvas>
                        {/* opt6: 右键菜单 */}
                        {ctxMenu && !annotateMode && (() => {
                            const { x, y, ann, type, annIdx } = ctxMenu;
                            const containerRect = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
                            const menuX = x - containerRect.left, menuY = y - containerRect.top;
                            const infoLines = type === 'gt'
                                ? [`GT · ${ann.category}`, `位置 [${Math.round(ann.bbox[0])}, ${Math.round(ann.bbox[1])}]`, `大小 ${Math.round(ann.bbox[2])}×${Math.round(ann.bbox[3])}`]
                                : [`预测 · ${ann.category}`, ann.score != null ? `置信度 ${(ann.score*100).toFixed(1)}%` : null, `位置 [${Math.round(ann.bbox[0])}, ${Math.round(ann.bbox[1])}]`, `大小 ${Math.round(ann.bbox[2])}×${Math.round(ann.bbox[3])}`].filter(Boolean);
                            return (
                                <div
                                    style={{ position:'absolute', left: menuX, top: menuY, zIndex: 9900, background:'var(--bg-surface)', border:'1px solid var(--border-strong)', borderRadius:'8px', boxShadow:'0 8px 28px rgba(0,0,0,0.55)', minWidth:'180px', fontSize:'12px', overflow:'hidden' }}
                                    onMouseLeave={() => setCtxMenu(null)}
                                >
                                    <div style={{ padding:'6px 10px', background:'var(--bg-raised)', borderBottom:'1px solid var(--border)', color:'var(--text-muted)' }}>
                                        {infoLines.map((l, i) => <div key={i}>{l}</div>)}
                    </div>
                                    <div style={{ padding:'4px 0' }}>
                                        <div className="ctx-menu-item" onClick={() => {
                                            const bbox = ann.bbox;
                                            const info = `${ann.category} [${bbox.map(v => Math.round(v)).join(', ')}]${ann.score != null ? ` conf=${(ann.score*100).toFixed(1)}%` : ''}`;
                                            navigator.clipboard.writeText(info).catch(() => {});
                                            setCtxMenu(null);
                                        }}>📋 复制框信息</div>
                                        <div className="ctx-menu-item" onClick={() => {
                                            setHiddenCats(prev => { const n = new Set(prev); n.add(ann.category); return n; });
                                            setCtxMenu(null);
                                        }}>🚫 隐藏此类别</div>
                                        {type === 'gt' && (
                                            <div className="ctx-menu-item" onClick={() => {
                                                centerOnAnnotation(ann.bbox);
                                                setCtxMenu(null);
                                            }}>🎯 居中到此框</div>
                                        )}
                                        <div className="ctx-menu-item" onClick={() => {
                                            enterAnnotateMode(type === 'gt' ? 'select' : 'draw', type === 'gt' ? annIdx : null);
                                            setCtxMenu(null);
                                        }}>✏ 进入标注模式</div>
                </div>
                                </div>
                            );
                        })()}
                        {/* opt9: Undo/Redo toast */}
                        {undoToast && (
                            <div key={undoToast.id} style={{
                                position:'absolute', bottom:'60px', left:'50%', transform:'translateX(-50%)',
                                background:'rgba(0,0,0,0.75)', color:'#fff', fontSize:'12px',
                                padding:'5px 14px', borderRadius:'16px', pointerEvents:'none',
                                whiteSpace:'nowrap', zIndex:9000,
                                animation:'fadeInOut 1.5s ease forwards'
                            }}>{undoToast.msg}</div>
                        )}
                        {/* B8: 小地图 */}
                        <canvas
                            ref={minimapCanvasRef}
                            style={{
                                position:'absolute', bottom:'8px', right:'8px',
                                border:'1px solid var(--border-strong)', borderRadius:'6px',
                                opacity: 0.88, pointerEvents:'none',
                                display: zoom > 1.5 ? 'block' : 'none',
                                background:'var(--bg-raised)',
                            }}
                        ></canvas>
                    </div>
                    {/* 类别选择弹窗（画完框后弹出）— 在 wrapper 外，不受 pan/zoom transform 影响 */}
                    {annotateMode && categoryPickerBbox && (
                        <CategoryPicker
                            categories={categories.length > 0 ? categories : ['目标']}
                            lastCategory={lastCategoryRef.current}
                            onConfirm={(cat) => {
                                lastCategoryRef.current = cat;
                                const newAnn = { category: cat, bbox: categoryPickerBbox, area: categoryPickerBbox[2] * categoryPickerBbox[3], iscrowd: 0 };
                                commitChange([...localAnns, newAnn]);
                                setSelectedAnnIdx(localAnns.length);
                                setCategoryPickerBbox(null);
                            }}
                            onCancel={() => setCategoryPickerBbox(null)}
                        />
                    )}
                    {/* C1: 锁定信息面板 */}
                    {lockedAnn && !annotateMode && (() => {
                        const { type, ann, sx, sy } = lockedAnn;
                        const container = containerRef.current;
                        const cr = container ? container.getBoundingClientRect() : { left:0, top:0, right:800, bottom:600 };
                        const relX = sx - cr.left + 12, relY = sy - cr.top + 12;
                        const lines = type === 'gt' ? [
                            ann.category,
                            `位置: [${Math.round(ann.bbox[0])}, ${Math.round(ann.bbox[1])}]`,
                            `大小: ${Math.round(ann.bbox[2])} × ${Math.round(ann.bbox[3])}`,
                            `面积: ${Math.round(ann.bbox[2] * ann.bbox[3]).toLocaleString()} px²`,
                        ] : [
                            `[预测] ${ann._pred_source || ''}`,
                            ann.category,
                            ann.score != null ? `置信度: ${(Number(ann.score) * 100).toFixed(1)}%` : null,
                            `位置: [${Math.round(ann.bbox[0])}, ${Math.round(ann.bbox[1])}]`,
                            `大小: ${Math.round(ann.bbox[2])} × ${Math.round(ann.bbox[3])}`,
                            `面积: ${Math.round(ann.bbox[2] * ann.bbox[3]).toLocaleString()} px²`,
                        ].filter(Boolean);
                        const color = getCategoryColor(palette, ann.category);
                        const panelW = 190;
                        const left = relX + panelW > cr.right - cr.left ? relX - panelW - 24 : relX;
                        const top = relY;
                        return (
                            <div style={{
                                position:'absolute', left, top, zIndex:10, pointerEvents:'auto',
                                background:'rgba(10,10,30,0.95)', border:`1px solid ${color}`,
                                borderRadius:'7px', padding:'10px 13px', minWidth:'160px', maxWidth:`${panelW}px`,
                                boxShadow:'0 4px 20px rgba(0,0,0,0.6)', backdropFilter:'blur(4px)',
                            }}>
                                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px'}}>
                                    <span style={{fontSize:'11px', color: type === 'gt' ? '#5d5' : '#7af', fontWeight:'bold'}}>
                                        {type === 'gt' ? '● GT' : '⋯ 预测'}
                                    </span>
                                    <button onClick={() => setLockedAnn(null)} style={{background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:'14px', padding:'0 2px'}}>✕</button>
                                </div>
                                {lines.map((l, i) => (
                                    <div key={i} style={{fontSize:'12px', color: i === 0 ? '#fff' : '#aaa', padding:'1px 0', fontWeight: i === 0 ? 'bold' : 'normal'}}>{l}</div>
                                ))}
                                <div style={{marginTop:'6px', fontSize:'10px', color:'var(--text-muted)'}}>再次点击框解锁</div>
                    </div>
                        );
                    })()}
                    {/* 双击提示（查看模式无标注时） */}
                    {!annotateMode && !lockedAnn && (
                        <div style={{position:'absolute', bottom:'8px', left:'50%', transform:'translateX(-50%)', fontSize:'11px', color:'var(--text-muted)', pointerEvents:'none', userSelect:'none'}}>
                            双击空白画框 · 双击 GT 框则选中编辑 · Tab 切换工具 · 0=适应窗口
                    </div>
                    )}
                </div>
                )}

            </div>
            {/* C9: 导出弹窗 */}
            {exportModal && (
                <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.75)', zIndex:1001, display:'flex', alignItems:'center', justifyContent:'center'}} onClick={() => setExportModal(null)}>
                    <div style={{background:'var(--bg-surface)', border:'1px solid var(--border-strong)', borderRadius:'12px', padding:'16px', maxWidth:'90vw', maxHeight:'90vh', display:'flex', flexDirection:'column', gap:'12px', boxShadow:'0 16px 48px rgba(0,0,0,0.6)'}} onClick={e => e.stopPropagation()}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                            <span style={{fontWeight:'bold', fontSize:'14px', color:'var(--text-primary)'}}>📷 截图预览</span>
                            <button onClick={() => setExportModal(null)} style={{background:'none', border:'none', color:'var(--text-muted)', fontSize:'18px', cursor:'pointer'}}>✕</button>
                        </div>
                        <img src={exportModal.dataUrl} alt="预览" style={{maxWidth:'70vw', maxHeight:'60vh', objectFit:'contain', borderRadius:'8px', border:'1px solid var(--border)'}} />
                        <div style={{display:'flex', gap:'10px'}}>
                            <button
                                onClick={() => {
                                    const a = document.createElement('a');
                                    a.href = exportModal.dataUrl;
                                    a.download = exportModal.fileName;
                                    a.click();
                                }}
                                className="btn btn-primary" style={{flex:1, padding:'8px 0', fontSize:'13px'}}
                            >⬇ 下载 JPG</button>
                            <button
                                onClick={async () => {
                                    try {
                                        // 使用 PNG blob 写入剪贴板（浏览器仅支持 PNG）
                                        const pngUrl = exportModal.canvas.toDataURL('image/png');
                                        const res = await fetch(pngUrl);
                                        const blob = await res.blob();
                                        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                                        alert('✓ 已复制到剪贴板，可直接粘贴到聊天窗口');
                                    } catch(err) {
                                        // 降级：复制 data URL
                                        try {
                                            await navigator.clipboard.writeText(exportModal.dataUrl);
                                            alert('已复制图片 Data URL（需手动粘贴）');
                                        } catch(e2) {
                                            alert('复制失败，请手动右键图片另存为');
                                        }
                                    }
                                }}
                                className="btn btn-success" style={{flex:1, padding:'8px 0', fontSize:'13px'}}
                            >⎘ 复制到剪贴板</button>
                        </div>
                        <div style={{fontSize:'11px', color:'var(--text-muted)', textAlign:'center'}}>点击空白处关闭</div>
                    </div>
                </div>
            )}
            {/* B7: 查看模式下的亮度/对比度控制条 */}
            {!annotateMode && (brightness !== 100 || contrast !== 100) && (
                <div style={{position:'fixed', bottom: (!annotateMode && showFilmstrip) ? '85px' : '24px', left:'50%', transform:'translateX(-50%)', background:'rgba(15,17,23,0.94)', border:'1px solid var(--border-strong)', borderRadius:'10px', padding:'6px 16px', display:'flex', gap:'12px', alignItems:'center', fontSize:'12px', zIndex:999, backdropFilter:'blur(8px)', boxShadow:'0 8px 24px rgba(0,0,0,0.5)'}}>
                    <span style={{color:'#ffaa00', fontWeight:'500'}}>图像调整</span>
                    <span style={{color:'var(--text-muted)'}}>亮度</span>
                    <input type="range" min="30" max="200" value={brightness} onChange={e=>setBrightness(Number(e.target.value))} style={{width:'80px', accentColor:'#ffaa00'}} />
                    <span style={{color:'var(--text-secondary)', width:'34px'}}>{brightness}%</span>
                    <span style={{color:'var(--text-muted)'}}>对比度</span>
                    <input type="range" min="30" max="300" value={contrast} onChange={e=>setContrast(Number(e.target.value))} style={{width:'80px', accentColor:'#7af'}} />
                    <span style={{color:'var(--text-secondary)', width:'34px'}}>{contrast}%</span>
                    <button onClick={() => { setBrightness(100); setContrast(100); }} className="vbtn-neutral" style={{padding:'2px 8px', borderRadius:'4px', cursor:'pointer', fontSize:'11px'}}>重置</button>
                </div>
            )}
            
            {/* 缩略图导航带 (仅在查看模式显示，可隐藏) */}
            {!annotateMode && showFilmstrip && (
                <Filmstrip 
                    images={images} 
                    currentIndex={imageIdx} 
                    datasetId={datasetId} 
                    onNavigateTo={(idx) => navigate(idx - imageIdx)}
                    leftInset={filmstripLeftInsetPx}
                    rightInset={filmstripRightInsetPx}
                />
            )}

            {/* B9: 快捷键帮助面板 */}
            {showHelp && (
                <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.7)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center'}} onClick={() => setShowHelp(false)}>
                    <div style={{background:'var(--bg-surface)', border:'1px solid var(--border-strong)', borderRadius:'12px', padding:'20px 28px', minWidth:'340px', maxWidth:'480px', maxHeight:'80vh', overflowY:'auto', boxShadow:'0 16px 48px rgba(0,0,0,0.55)'}} onClick={e => e.stopPropagation()}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px'}}>
                            <span style={{fontWeight:'bold', fontSize:'15px', color:'var(--text-primary)'}}>⌨ 快捷键一览</span>
                            <button onClick={() => setShowHelp(false)} style={{background:'transparent', border:'none', color:'var(--text-muted)', fontSize:'18px', cursor:'pointer'}}>✕</button>
                        </div>
                        {[
                            { group: '导航 & 通用', items: [
                                ['← / A / → / D', '上/下一张图片'],
                                ['Tab / Shift+Tab', '循环切换高亮标注框'],
                                ['N', '聚焦到备注输入框'],
                                ['1-9', '快速设置主分类'],
                                ['0', '缩放适应窗口'],
                                ['F', '全屏 / 退出全屏'],
                                ['Esc', '关闭查看器 / 清除锁定'],
                                ['?', '显示/隐藏帮助'],
                                ['（工具栏）🎞 缩略图', '显示/隐藏底部缩略图导航'],
                                ['双击空白', '进入画框模式'],
                                ['双击 GT 框', '进入选择模式并选中该框'],
                                ['单击标注框', '锁定/解锁信息面板'],
                            ]},
                            { group: '标注工具', items: [
                                ['B', '切换到画框工具'],
                                ['V', '切换到选择工具'],
                                ['Enter', '保存标注并回到看图状态'],
                                ['Q', '快速模式（记住上次类别）'],
                                ['Del / Backspace', '删除选中框（支持多选）'],
                                ['Ctrl+C', '复制选中框'],
                                ['Ctrl+V', '粘贴（偏移10px）'],
                                ['Ctrl+Z', '撤销'],
                                ['Ctrl+Y / Ctrl+Shift+Z', '重做'],
                                ['Ctrl+S', '保存标注'],
                            ]},
                            { group: '移动 & 调整', items: [
                                ['方向键', '微调选中框位置 (1px)'],
                                ['Shift + 方向键', '快速微调 (10px)'],
                                ['Shift + 画框', '锁定正方形（宽=高）'],
                                ['Space + 拖拽', '临时平移视图'],
                                ['Ctrl + 点击', '多选框'],
                                ['拖拽空白区域', '框选多个框'],
                            ]},
                            { group: '图像显示', items: [
                                ['滚轮 (Ctrl+滚轮)', '缩放'],
                                ['▦ 填充按钮', '切换半透明填充'],
                                ['# 序号按钮', '框序号显示'],
                                ['∿ 置信度按钮', '置信度渐变透明'],
                                ['⊕ 吸附按钮（标注模式）', '贴边吸附'],
                                ['⊞ 对比按钮', 'GT vs 预测对比视图'],
                                ['↓PNG 按钮', '导出带标注截图'],
                                ['亮度/对比度滑块', '调整图像显示'],
                            ]},
                        ].map(({ group, items }) => (
                            <div key={group} style={{marginBottom:'14px'}}>
                                <div style={{fontSize:'11px', color:'var(--accent)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'6px', borderBottom:'1px solid var(--border)', paddingBottom:'3px'}}>{group}</div>
                                <table style={{width:'100%', borderCollapse:'collapse'}}>
                                    <tbody>
                                        {items.map(([key, desc]) => (
                                            <tr key={key}>
                                                <td style={{padding:'2px 8px 2px 0', color:'var(--text-secondary)', fontFamily:'monospace', fontSize:'12px', whiteSpace:'nowrap'}}>{key}</td>
                                                <td style={{padding:'2px 0', color:'var(--text-secondary)', fontSize:'12px'}}>{desc}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                        <div style={{textAlign:'center', color:'var(--text-muted)', fontSize:'11px', marginTop:'8px'}}>点击空白处或 Esc 关闭</div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ==================== EDA可视化页面 ====================
function EDAPage({ datasetData, images, onJumpToGallery, onJumpToImage }) {
    const config = useConfig();
    const eda = config.eda || DEFAULT_CONFIG.eda;
    const palette = config.colorPalette || DEFAULT_CONFIG.colorPalette;
    const onJumpToGalleryRef = useRef(onJumpToGallery);
    useEffect(() => { onJumpToGalleryRef.current = onJumpToGallery; }, [onJumpToGallery]);
    const onJumpToImageRef = useRef(onJumpToImage);
    useEffect(() => { onJumpToImageRef.current = onJumpToImage; }, [onJumpToImage]);
    const pieRef = useRef(null);
    const barRef = useRef(null);
    const dirCompareRef = useRef(null);
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

    const uiTheme = config.uiTheme || DEFAULT_CONFIG.uiTheme || 'dark';
    const plotlyBase = React.useMemo(() => {
        if (uiTheme === 'light') {
            return {
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(244,247,252,0.86)',
                font: { color: '#3d4c6b', family: 'system-ui, sans-serif', size: 12 },
                title: { font: { color: '#1c2436', size: 13 } },
                xaxis: { gridcolor: '#d4deef', linecolor: '#aebedb', tickcolor: '#667896', zerolinecolor: '#d4deef' },
                yaxis: { gridcolor: '#d4deef', linecolor: '#aebedb', tickcolor: '#667896', zerolinecolor: '#d4deef' },
                legend: { bgcolor: 'rgba(238,243,251,0.88)', bordercolor: '#c8d4ea', borderwidth: 1, font: { color: '#3d4c6b' } },
                hoverlabel: { bgcolor: '#ffffff', bordercolor: '#aebedb', font: { color: '#1c2436' } },
                margin: { t: 40, r: 16, b: 50, l: 50 },
            };
        }
        if (uiTheme === 'dim') {
            return {
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(26,31,44,0.86)',
                font: { color: '#a8b6d4', family: 'system-ui, sans-serif', size: 12 },
                title: { font: { color: '#dbe4f6', size: 13 } },
                xaxis: { gridcolor: '#32405b', linecolor: '#44557a', tickcolor: '#7d8baa', zerolinecolor: '#32405b' },
                yaxis: { gridcolor: '#32405b', linecolor: '#44557a', tickcolor: '#7d8baa', zerolinecolor: '#32405b' },
                legend: { bgcolor: 'rgba(35,42,58,0.88)', bordercolor: '#32405b', borderwidth: 1, font: { color: '#a8b6d4' } },
                hoverlabel: { bgcolor: '#232a3a', bordercolor: '#44557a', font: { color: '#dbe4f6' } },
                margin: { t: 40, r: 16, b: 50, l: 50 },
            };
        }
        return {
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(21,25,38,0.85)',
            font: { color: '#b0b9d4', family: 'system-ui, sans-serif', size: 12 },
            title: { font: { color: '#e6ebff', size: 13 } },
            xaxis: { gridcolor: '#2b3550', linecolor: '#3a4870', tickcolor: '#7d88a8', zerolinecolor: '#2b3550' },
            yaxis: { gridcolor: '#2b3550', linecolor: '#3a4870', tickcolor: '#7d88a8', zerolinecolor: '#2b3550' },
            legend: { bgcolor: 'rgba(28,34,51,0.85)', bordercolor: '#2b3550', borderwidth: 1, font: { color: '#b0b9d4' } },
            hoverlabel: { bgcolor: '#1c2233', bordercolor: '#3a4870', font: { color: '#e6ebff' } },
            margin: { t: 40, r: 16, b: 50, l: 50 },
        };
    }, [uiTheme]);
    const plotlyAccent = uiTheme === 'light' ? '#4569e0' : (uiTheme === 'dim' ? '#7f97ff' : '#6f8cff');
    const plotlyPieText = uiTheme === 'light' ? '#1c2436' : '#e6ebff';
    const dirComparePalette = uiTheme === 'light'
        ? ['#4569e0','#c27e14','#1d9d66','#d14152','#7a56d8','#1996a0','#c37228','#3f7bd6']
        : uiTheme === 'dim'
            ? ['#7f97ff','#e2a644','#49c592','#f06c79','#9d82f5','#35bfc8','#ec9650','#58a0ec']
            : ['#667eea','#f6a623','#50c878','#e74c3c','#9b59b6','#1abc9c','#e67e22','#3498db'];
    const plotlyMerge = (specific) => ({ ...plotlyBase, ...specific,
        xaxis: { ...plotlyBase.xaxis, ...(specific.xaxis || {}) },
        yaxis: { ...plotlyBase.yaxis, ...(specific.yaxis || {}) },
        title: { ...plotlyBase.title, ...(typeof specific.title === 'string' ? { text: specific.title } : specific.title || {}) },
    });

    // 生成箱线图的通用函数
    const generateBoxPlot = (ref, data, title, yLabel) => {
        if (!ref.current || !data) return;
        const cats = [...new Set(data.category)];
        const traces = cats.map(cat => ({
            y: data.values.filter((_, i) => data.category[i] === cat),
            name: cat,
            type: 'box'
        }));
        Plotly.newPlot(ref.current, traces, plotlyMerge({ title, yaxis: { title: yLabel }, height: 400 }), { responsive: true });
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
                hole: 0.3,
                textfont: { color: plotlyPieText },
            }], plotlyMerge({ title: '类别分布（点击扇区跳转宫格）', height: 400 }), { responsive: true });
            pieRef.current.on('plotly_click', (data) => {
                const pt = data.points && data.points[0];
                if (pt && pt.label && onJumpToGalleryRef.current) onJumpToGalleryRef.current(pt.label);
            });
        }

        // 2. 类别数量柱状图
        if (barRef.current && datasetData.class_counts) {
            Plotly.newPlot(barRef.current, [{
                x: datasetData.class_counts.categories,
                y: datasetData.class_counts.counts,
                type: 'bar',
                marker: { color: plotlyAccent }
            }], plotlyMerge({ title: '类别数量（点击柱子跳转宫格）', xaxis: { title: '类别' }, yaxis: { title: '数量' }, height: 400 }), { responsive: true });
            barRef.current.on('plotly_click', (data) => {
                const pt = data.points && data.points[0];
                if (pt && pt.x && onJumpToGalleryRef.current) onJumpToGalleryRef.current(pt.x);
            });
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
            Plotly.newPlot(whRef.current, traces, plotlyMerge({ title: whTitle, yaxis: { title: whY }, height: 400 }), { responsive: true });
        }
        // 9. 中心点分布（点击跳转对应图片）
        if (centerRef.current && stats.center) {
            const cats = [...new Set(stats.center.category)];
            const hasId = stats.center.image_id && stats.center.image_id.length > 0;
            const centerTraces = cats.map(cat => {
                const idxs = stats.center.category.map((c, i) => c === cat ? i : -1).filter(i => i >= 0);
                return {
                    x: idxs.map(i => stats.center.x[i]),
                    y: idxs.map(i => stats.center.y[i]),
                    customdata: hasId ? idxs.map(i => [stats.center.image_id[i], (stats.center.file_name || [])[i] || '']) : undefined,
                    hovertemplate: hasId ? `%{customdata[1]}<br>X: %{x:.3f}<br>Y: %{y:.3f}<extra>${cat}</extra>` : undefined,
                mode: 'markers',
                type: 'scatter',
                name: cat,
                    marker: { size: 6, opacity: 0.7, color: getCategoryColor(palette, cat) }
                };
            });
            Plotly.newPlot(centerRef.current, centerTraces, plotlyMerge({
                title: centerTitle + (hasId ? '  ← 点击散点跳转图片' : ''),
                xaxis: { title: '中心 X' + centerXY }, 
                yaxis: { title: '中心 Y' + centerXY }, 
                height: 500 
            }), { responsive: true });
            // purge 旧事件后重新绑定
            centerRef.current.removeAllListeners && centerRef.current.removeAllListeners('plotly_click');
            if (hasId) {
                centerRef.current.on('plotly_click', (data) => {
                    const pt = data.points && data.points[0];
                    if (pt && pt.customdata != null && onJumpToImageRef.current) {
                        onJumpToImageRef.current(pt.customdata[0]);
                    }
                });
            }
        }
        // 10. bbox分布（点击跳转对应图片）
        if (bboxRef.current && stats.width && stats.height) {
            const cats = [...new Set(stats.width.category)];
            const hasId = stats.width.image_id && stats.width.image_id.length > 0;
            const bboxTraces = cats.map(cat => {
                const idxs = stats.width.category.map((c, i) => c === cat ? i : -1).filter(i => i >= 0);
                return {
                    x: idxs.map(i => stats.width.values[i]),
                    y: idxs.map(i => stats.height.values[i]),
                    customdata: hasId ? idxs.map(i => [stats.width.image_id[i], (stats.width.file_name || [])[i] || '']) : undefined,
                    hovertemplate: hasId ? `%{customdata[1]}<br>宽: %{x:.4f}<br>高: %{y:.4f}<extra>${cat}</extra>` : undefined,
                    mode: 'markers',
                    type: 'scatter',
                    name: cat,
                    marker: { size: 8, opacity: 0.65, color: getCategoryColor(palette, cat) }
                };
            });
            Plotly.newPlot(bboxRef.current, bboxTraces, plotlyMerge({
                title: bboxTitle + (hasId ? '  ← 点击散点跳转图片' : ''),
                xaxis: { title: '宽度' + bboxXY }, 
                yaxis: { title: '高度' + bboxXY }, 
                height: 500 
            }), { responsive: true });
            // purge 旧事件后重新绑定
            bboxRef.current.removeAllListeners && bboxRef.current.removeAllListeners('plotly_click');
            if (hasId) {
                bboxRef.current.on('plotly_click', (data) => {
                    const pt = data.points && data.points[0];
                    if (pt && pt.customdata != null && onJumpToImageRef.current) {
                        onJumpToImageRef.current(pt.customdata[0]);
                    }
                });
            }
        }
    }, [datasetData, useNormalized, uiTheme]);

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
            }], plotlyMerge({ 
                title: `${densityCategory} - ${metricLabel} ${eda.chartDensity || '密度分布'}`,
                xaxis: { title: metricLabel, range: densityMetric === 'score' ? [0, 1] : undefined },
                yaxis: { title: '频数' },
                height: 400
            }), { responsive: true });
        } else if (densityRef.current && typeof Plotly.purge === 'function') {
            Plotly.purge(densityRef.current);
        }
    }, [densityCategory, densityMetric, datasetData, palette, eda.chartDensity, useNormalized, uiTheme]);

    return (
        <div className="main-content">
            <div className="top-toolbar">
                <div className="toolbar-left">
                    <h2 style={{fontSize: 'var(--font-xl)', fontWeight: 500}}>{eda.pageTitle}</h2>
                    <span style={{color: 'var(--text-muted)', fontSize: 'var(--font-md)'}}>
                        图片: {datasetData.num_images} | 标注: {datasetData.num_annotations} | 类别: {datasetData.num_categories}
                    </span>
                </div>
                <div className="toolbar-right" style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                    <span style={{fontSize: 'var(--font-md)', color: 'var(--text-muted)'}}>统计尺度:</span>
                    <button
                        type="button"
                        className={`eda-tab ${useNormalized ? 'active' : ''}`}
                        onClick={() => setUseNormalized(true)}
                        style={{padding: '6px 12px', fontSize: 'var(--font-md)'}}
                    >归一化</button>
                    <button
                        type="button"
                        className={`eda-tab ${!useNormalized ? 'active' : ''}`}
                        onClick={() => setUseNormalized(false)}
                        style={{padding: '6px 12px', fontSize: 'var(--font-md)'}}
                    >像素值</button>
                </div>
            </div>
            <div className="eda-tabs">
                <button type="button" className={`eda-tab ${edaTab === 'category' ? 'active' : ''}`} onClick={() => setEdaTab('category')}>{eda.sectionCategory}</button>
                <button type="button" className={`eda-tab ${edaTab === 'size' ? 'active' : ''}`} onClick={() => setEdaTab('size')}>{eda.sectionSize}</button>
                <button type="button" className={`eda-tab ${edaTab === 'ratio' ? 'active' : ''}`} onClick={() => setEdaTab('ratio')}>{eda.sectionRatio}</button>
                <button type="button" className={`eda-tab ${edaTab === 'space' ? 'active' : ''}`} onClick={() => setEdaTab('space')}>{eda.sectionSpace}</button>
                <button type="button" className={`eda-tab ${edaTab === 'density' ? 'active' : ''}`} onClick={() => setEdaTab('density')}>{eda.sectionDensity}</button>
                {images && [...new Set(images.map(i => i.source_path).filter(Boolean))].length > 1 && (
                    <button type="button" className={`eda-tab ${edaTab === 'dircompare' ? 'active' : ''}`} onClick={() => setEdaTab('dircompare')}>目录对比</button>
                )}
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

                {/* 目录对比（opt12） */}
                {images && edaTab === 'dircompare' && (() => {
                    const dirs = [...new Set(images.map(i => i.source_path).filter(Boolean))].sort();
                    if (dirs.length < 2) return <div style={{padding:'20px', color:'var(--text-muted)'}}>只有一个目录时无对比数据。</div>;
                    const palette2 = dirComparePalette;
                    const categories = datasetData.categories || [];
                    // 每个目录下各类别的标注数
                    const dirCatCount = {};
                    dirs.forEach(d => { dirCatCount[d] = {}; categories.forEach(c => { dirCatCount[d][c] = 0; }); });
                    images.forEach(img => {
                        const d = img.source_path;
                        if (!d || !dirCatCount[d]) return;
                        (img.annotations || []).forEach(ann => {
                            if (ann.category && dirCatCount[d][ann.category] !== undefined)
                                dirCatCount[d][ann.category] = (dirCatCount[d][ann.category] || 0) + 1;
                        });
                    });
                    // 每个目录的图片数
                    const dirImgCount = {};
                    dirs.forEach(d => { dirImgCount[d] = images.filter(i => i.source_path === d).length; });
                    // 每个目录的总标注数
                    const dirAnnTotal = {};
                    dirs.forEach(d => { dirAnnTotal[d] = Object.values(dirCatCount[d]).reduce((a,b)=>a+b,0); });
                    return (
                        <div className="eda-section">
                            <h3 className="eda-section-title">目录对比</h3>
                            {/* 汇总表 */}
                            <div className="eda-card" style={{overflowX:'auto'}}>
                                <div className="eda-card-title">各目录概况</div>
                                <table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px'}}>
                                    <thead>
                                        <tr style={{background:'var(--bg-raised)', borderBottom:'1px solid var(--border)'}}>
                                            <th style={{padding:'8px 12px', textAlign:'left', color:'var(--text-secondary)'}}>目录</th>
                                            <th style={{padding:'8px 12px', textAlign:'right', color:'var(--text-secondary)'}}>图片数</th>
                                            <th style={{padding:'8px 12px', textAlign:'right', color:'var(--text-secondary)'}}>标注数</th>
                                            <th style={{padding:'8px 12px', textAlign:'right', color:'var(--text-secondary)'}}>每图平均标注</th>
                                            {categories.map(cat => <th key={cat} style={{padding:'8px 12px', textAlign:'right', color:'var(--text-secondary)'}}>{cat}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dirs.map((d, i) => (
                                            <tr key={d} style={{borderBottom:'1px solid var(--border)', background: i%2===0?'transparent':'var(--bg-soft)'}}>
                                                <td style={{padding:'7px 12px', color:'var(--text-secondary)', fontFamily:'monospace', fontSize:'12px'}}>{d || '（根目录）'}</td>
                                                <td style={{padding:'7px 12px', textAlign:'right', color:'var(--accent)'}}>{dirImgCount[d]}</td>
                                                <td style={{padding:'7px 12px', textAlign:'right', color:'var(--success)'}}>{dirAnnTotal[d]}</td>
                                                <td style={{padding:'7px 12px', textAlign:'right', color:'var(--warning)'}}>{dirImgCount[d] > 0 ? (dirAnnTotal[d]/dirImgCount[d]).toFixed(1) : '—'}</td>
                                                {categories.map(cat => (
                                                    <td key={cat} style={{padding:'7px 12px', textAlign:'right', color:'var(--text-secondary)'}}>{dirCatCount[d][cat] || 0}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {/* 各类别在各目录的分布柱状图 */}
                            <div style={{display:'flex', flexWrap:'wrap', gap:'16px', marginTop:'8px'}}>
                                {categories.map((cat, ci) => {
                                    const counts = dirs.map(d => dirCatCount[d][cat] || 0);
                                    const maxCount = Math.max(...counts, 1);
                                    return (
                                        <div key={cat} className="eda-card" style={{minWidth:'200px', flex:'1'}}>
                                            <div className="eda-card-title" style={{fontSize:'13px'}}>{cat}</div>
                                            <div style={{display:'flex', flexDirection:'column', gap:'5px', padding:'6px 0'}}>
                                                {dirs.map((d, di) => {
                                                    const cnt = dirCatCount[d][cat] || 0;
                                                    const pct = dirImgCount[d] > 0 ? (cnt / dirImgCount[d] * 100).toFixed(1) : 0;
                                                    return (
                                                        <div key={d}>
                                                            <div style={{fontSize:'11px', color:'var(--text-muted)', marginBottom:'2px'}} title={d}>{d || '根目录'}</div>
                                                            <div style={{display:'flex', alignItems:'center', gap:'6px'}}>
                                                                <div style={{flex:1, background:'var(--bg-hover)', borderRadius:'3px', height:'12px', position:'relative'}}>
                                                                    <div style={{width:`${cnt/maxCount*100}%`, background:palette2[ci%palette2.length], borderRadius:'3px', height:'100%', transition:'width 0.3s'}} />
                                                                </div>
                                                                <span style={{fontSize:'11px', color:'var(--text-secondary)', minWidth:'50px', textAlign:'right'}}>{cnt} ({pct}%)</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })()}
            </div>
        </div>
    );
}

// 渲染应用（从 /static/config.json 加载配置并合并到默认配置）
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<ConfigProvider><App /></ConfigProvider>);
