"""Chat 编排：OpenAI 兼容代理 + 思维树 + Skill 注入 + 自动修复重试。

`stream_chat(data)` 返回 Flask Response（SSE）。
"""
from __future__ import annotations

import json
import re
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from flask import Response, stream_with_context

from ..agent_runtime import exec_code
from ..json_utils import safe_log
from ..repositories import agent_modules_repo
from . import agent_service, dataset_service, skill_service


AGENT_SYSTEM_PROMPT = """你是 COCOVisualizer 的 AI 数据分析 Agent。
当前数据集真实统计（由程序实时计算）：
{dataset_context}

## 核心规则（严格遵守）
1. **禁止编造数据**：所有数字必须来自代码执行结果，绝不能凭空猜测或估算。
2. **遇到数据问题必须写代码**：只要用户问数据相关内容（统计、筛选、分析），必须写 Python 代码并等待执行结果后再回答。
3. **使用真实字段名**：访问类别用 `ann['category']`（字符串），不要用 `ann['category_id']`。

## 代码执行环境
`images` 变量已就绪，结构如下（字段名固定，勿猜测）：
- image_id: int
- file_name: str              # 相对文件名，如 "img001.jpg"
- full_path: str              # 完整磁盘路径，如 "/data/dataset/images/img001.jpg"
- width: int, height: int
- annotations: [{category: str, bbox: [x,y,w,h], area: float, score: float|None}]
- pred_annotations: 同上

`images_dir` 变量：数据集图片目录的完整路径（str）
`coco_json_path` 变量：COCO JSON 文件的完整路径（str）

## 代码规范
- 统计/分析：用 print() 输出结果（会被系统自动捕获）
- 筛选图片：最后一行写 `[img['image_id'] for img in images if ...]` 列表
- 可以 import 标准库（Counter, math, statistics 等）
- 代码注释用中文
- 对于“打包数据集 / 可视化 / DF 查看”等任务，优先调用内置函数（见下方），不要只返回解释性文字

## 导出函数（代码中可直接调用）
- `export_csv(data, filename)` — 导出 list[dict] 或 list[list] 为 CSV（UTF-8 BOM，兼容 Excel）
- `export_json(data, filename)` — 导出 Python 对象为 JSON
- `export_txt(text, filename)` — 导出文本报告为 TXT
- `export_coco(image_ids, zip_name='filtered_dataset.zip', with_images=True, preview=True)` — 按 image_id 导出数据集；COCO 标注文件名固定为 `_annotations.coco.json`；若 `with_images=True` 会将图片与标注同级打包到 zip
- **任意 `open(path, 'w')` 写文件**均自动重定向到临时目录，无需 export_* 函数，用户同样可点击下载
- 当用户要求按条件筛选数据集时，必须先 `filter_gallery(image_ids, '说明')` 提供在线预览，再调用 `export_coco` 输出可下载压缩包
- 输出压缩包中，COCO 标注文件名**必须固定**为 `_annotations.coco.json`（不得添加任何前后缀）

## UI 控制函数（直接操控应用界面）
- `navigate_to(page)` — 切换到指定页面，page 可为 'gallery'|'viewer'|'eda'|'chat'|'load'
- `filter_gallery(image_ids, description)` — 将 image_id 列表推送到看图界面并自动切换，description 为筛选说明
- `show_chart(chart_type, labels, datasets, title)` — 在聊天中嵌入可视化图表
  - chart_type: 'bar'|'pie'|'line'|'doughnut'
  - labels: list[str]（X 轴/扇区标签）
  - datasets: list[dict]，每项含 label(str)、data(list[number])、backgroundColor(str 可选)
  - 示例：show_chart('bar', ['猫','狗','鸟'], [{'label':'数量','data':[100,50,30],'backgroundColor':'#4e79a7'}], '类别分布')
- `load_dataset_path(coco_json_path, image_dir='', dataset_name='')` — 加载新的数据集
- `show_table(rows, title='数据预览')` — 在聊天中输出可点击的表格预览，支持弹窗查看详情（rows 可为 list[dict] 或 DataFrame 转换结果）
- `pack_dataset(image_ids, zip_name='filtered_dataset.zip', preview=True)` — 一键打包筛选子集（固定 `_annotations.coco.json` + 图片同级 + zip）
- `show_df(df, title='DF预览', max_rows=300)` — DataFrame 或 list[dict] 的表格预览
- `visualize_df(df, x, y, chart_type='bar', title='DF可视化', topk=30)` — DataFrame 快速图表+表格预览
- `coco_overview()` — 返回数据集总览（图片数、标注数、类别数、平均每图框数）
- `category_stats(source='gt')` — 类别统计（source='gt' 或 'pred'）
- `bbox_stats(source='gt')` — 框尺度统计（面积/宽高比/极小框占比）
- `find_images(gt_min=None, gt_max=None, pred_min=None, pred_max=None, categories=None, score_min=None, score_max=None)` — 多条件筛图，返回 image_id 列表
- `hard_cases(score_low=0.3, score_high=0.6, min_pred=1)` — 返回包含“模糊区间”预测框的疑难样本 image_id
- `read_skill_file` / `load_skill_config` / `run_skill_script` / `run_skill_cli` — 通用 Skill 资源（勿写死 ~/.cursor/skills）
- `run_magic_fox_model_validation(train_id, images, output_dir, mode='full'|...)` / `run_magic_fox_fetch_training_models(url, csv_path)` — Magic-Fox 技能一键封装（需已导入对应 skills.zip）

## Cursor 兼容 Skills 协议（与 IDE 一致）
- 每个技能为目录 + `SKILL.md`；`SKILL.md` 顶部为 YAML frontmatter，**必填** `name`（小写连字符）与 `description`（含能力说明与 *Use when* 触发场景）。
- 系统注入的「按需加载 Skills」块即 Cursor 里的技能正文：须**优先遵守**，脚本路径以包内相对路径为准（如 `scripts/xxx.py`）。
- 运行环境提供 `SKILL_ROOT` / `CURSOR_SKILL_ROOT` / `MAGIC_FOX_SKILL_ROOT`（均指向本应用解压后的技能根目录），**禁止**在代码中写死 `~/.cursor/skills/...`。
- 调用技能脚本的 `skill_name` 参数使用 frontmatter 的 `name` 或界面展示的技能名即可。

## 附件变量（如用户上传了文件，这些变量自动注入）
- `uploaded_data` — 用户上传的 CSV/JSON 数据（list 或 dict）
- `uploaded_text` — 用户上传的文本内容（str）

## 联网搜索
- 当用户需要了解最新技术/方法/资讯时，系统会自动搜索并将结果加入你的上下文

## 内置常用 Agent 模板（优先复用）
- **数据集打包 Agent**：按规则筛选 `image_ids` → `filter_gallery(...)` 在线预览 → `export_coco(image_ids, zip_name='xxx.zip', with_images=True, preview=True)` 导出压缩包
- **DF 可视化 Agent**：对 DataFrame/列表统计后，调用 `show_chart(...)` 输出图表；调用 `show_table(rows, '标题')` 输出可点击表格预览
- **数据加载 Agent**：当用户给出 COCO 路径时，调用 `load_dataset_path(coco_json_path, image_dir)` 直接加载

## 回答格式
1. 先写 ```python 代码块（系统会自动执行）
2. 代码执行后，系统会把真实结果反馈给你
3. 基于真实结果给出简洁分析结论，不要重复代码内容"""


def build_images_list(dataset_id: str) -> list:
    if not dataset_id:
        return []
    eda = dataset_service.get_in_memory(dataset_id)
    if eda is None:
        return []
    try:
        coco_path = getattr(eda, 'coco_json_path', None)
        if not coco_path:
            return []
        coco = json.loads(Path(coco_path).read_text(encoding='utf-8'))
        cat_map = {c['id']: c['name'] for c in coco.get('categories', [])}
        ann_map: dict = {}
        for ann in coco.get('annotations', []):
            iid = ann.get('image_id')
            ann_map.setdefault(iid, []).append({
                'category': cat_map.get(ann.get('category_id'), ''),
                'bbox': ann.get('bbox'),
                'area': ann.get('area'),
                'score': ann.get('score'),
            })
        img_dir_str = _resolve_image_dir(eda)
        images = []
        for img in coco.get('images', []):
            iid = img.get('id')
            fname = img.get('file_name', '')
            full_path = str(Path(img_dir_str) / fname) if (fname and img_dir_str) else fname
            images.append({
                'image_id': iid,
                'file_name': fname,
                'full_path': full_path,
                'width': img.get('width'),
                'height': img.get('height'),
                'annotations': ann_map.get(iid, []),
                'pred_annotations': [],
            })
        return images
    except Exception:
        return []


def _resolve_image_dir(eda) -> str:
    img_dir = getattr(eda, 'image_dir', None) or ''
    if not img_dir:
        coco_path = getattr(eda, 'coco_json_path', None)
        img_dir = str(Path(coco_path).parent.resolve()) if coco_path else ''
    return str(Path(img_dir).resolve()) if img_dir else ''


def build_agent_context(dataset_id: str) -> str:
    images = build_images_list(dataset_id)
    if not images:
        return '当前未加载数据集，images 变量为空列表。'
    from collections import Counter as _Counter
    n = len(images)
    n_annotated = sum(1 for img in images if img['annotations'])
    n_anns = sum(len(img['annotations']) for img in images)
    widths = [img['width'] for img in images if img.get('width')]
    heights = [img['height'] for img in images if img.get('height')]
    cat_counts = _Counter(ann['category'] for img in images for ann in img['annotations'])
    eda = dataset_service.get_in_memory(dataset_id)
    ds_name = getattr(eda, 'dataset_name', '未知')
    coco_json_path = getattr(eda, 'coco_json_path', '未知')
    img_dir = _resolve_image_dir(eda) if eda else ''
    lines = [
        f'数据集名称：{ds_name}',
        f'COCO JSON 路径：{coco_json_path}',
        f'图片目录：{img_dir}',
        f'总图片数：{n}（已标注：{n_annotated}，未标注：{n - n_annotated}）',
        f'GT 框总数：{n_anns}，平均每张：{round(n_anns / n, 2) if n else 0}',
    ]
    if widths:
        lines.append(f'图片宽度范围：{min(widths)} ~ {max(widths)} px，均值：{round(sum(widths)/len(widths))} px')
    if heights:
        lines.append(f'图片高度范围：{min(heights)} ~ {max(heights)} px，均值：{round(sum(heights)/len(heights))} px')
    if cat_counts:
        lines.append(
            f'类别分布（共 {len(cat_counts)} 类）：'
            + '、'.join(f'{c}({v})' for c, v in cat_counts.most_common(15))
            + ('...' if len(cat_counts) > 15 else '')
        )
    return '\n'.join(lines)


def thought_tree(user_text: str) -> dict:
    t = (user_text or '').lower()
    decision = {'intent': 'general_analysis', 'tools': [], 'reason': '通用分析', 'instruction': ''}
    if any(k in t for k in ['打包', '压缩包', 'zip', '导出子集', '导出数据集', '_annotations.coco.json']):
        decision.update({
            'intent': 'pack_dataset',
            'tools': ['filter_gallery', 'pack_dataset'],
            'reason': '用户意图是筛选后打包导出',
            'instruction': "必须先在线预览后导出：先 filter_gallery(image_ids, '筛选预览')，再 pack_dataset(image_ids, zip_name='filtered_dataset.zip', preview=True)。",
        })
        return decision
    if any(k in t for k in ['可视化', '图表', '柱状图', '折线图', '饼图', 'chart', 'plot']):
        decision.update({
            'intent': 'visualization',
            'tools': ['category_stats', 'bbox_stats', 'show_chart', 'show_table', 'visualize_df'],
            'reason': '用户需要图形化展示',
            'instruction': '请输出 show_chart(...) 图表；若有明细数据，同时输出 show_table(...)。',
        })
        return decision
    if any(k in t for k in ['df', 'dataframe', '表格', '明细', 'table']):
        decision.update({
            'intent': 'table_preview',
            'tools': ['show_df', 'show_table'],
            'reason': '用户需要结构化表格查看',
            'instruction': '请将结果整理为 DataFrame 或 list[dict]，并调用 show_df(...) 展示可点击表格。',
        })
        return decision
    if any(k in t for k in ['类别分布', '类别统计', 'category', '分布']):
        decision.update({
            'intent': 'category_distribution',
            'tools': ['category_stats', 'show_df', 'show_chart'],
            'reason': '用户关注类别维度统计',
            'instruction': "调用 category_stats(source='gt') 或 category_stats(source='pred')，并结合 visualize_df/show_chart 输出图表与表格。",
        })
        return decision
    if any(k in t for k in ['面积', '尺度', '小目标', '宽高比', 'bbox', '尺寸统计']):
        decision.update({
            'intent': 'bbox_statistics',
            'tools': ['bbox_stats', 'show_df', 'show_chart'],
            'reason': '用户关注框尺度特征',
            'instruction': "调用 bbox_stats(source='gt'/'pred') 并输出图表与统计摘要。",
        })
        return decision
    if any(k in t for k in ['疑难', 'hard case', '模糊', '低置信度', '异常样本', '错检', '漏检']):
        decision.update({
            'intent': 'hard_cases',
            'tools': ['hard_cases', 'filter_gallery', 'pack_dataset'],
            'reason': '用户关注疑难样本定位',
            'instruction': '调用 hard_cases(...) 得到 image_ids，先 filter_gallery 在线预览，必要时 pack_dataset 打包导出。',
        })
        return decision
    if any(k in t for k in ['加载数据集', 'coco 路径', 'json路径', '加载路径']):
        decision.update({
            'intent': 'load_dataset',
            'tools': ['load_dataset_path'],
            'reason': '用户需要通过路径加载',
            'instruction': '如果用户给出了路径，请调用 load_dataset_path(coco_json_path, image_dir)。',
        })
        return decision
    return decision


def web_search(query: str, max_results: int = 6) -> str:
    """DuckDuckGo 联网搜索（无需 API Key）。"""
    try:
        url = f'https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}&kl=cn-zh'
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        })
        with urllib.request.urlopen(req, timeout=12) as resp:
            html = resp.read().decode('utf-8', errors='replace')

        def clean(s: str) -> str:
            return re.sub(r'<[^>]+>', '', s).strip()

        results = []
        titles = re.findall(r'class="result__a"[^>]*>(.*?)</a>', html, re.DOTALL)
        snips = re.findall(r'class="result__snippet"[^>]*>(.*?)</a>', html, re.DOTALL)
        for i in range(min(max_results, len(titles), len(snips))):
            t, s = clean(titles[i]), clean(snips[i])
            if t:
                results.append(f'• {t}\n  {s}')
        return '\n\n'.join(results) if results else '未找到相关搜索结果'
    except Exception as e:  # noqa: BLE001
        return f'搜索失败：{e}'


# ----------------------------- 主入口 -----------------------------

def stream_chat(data: dict) -> Response:
    messages = data.get('messages', [])
    api_url = (data.get('api_url') or 'https://api.openai.com/v1/chat/completions').rstrip('/')
    api_key = data.get('api_key', '')
    model = data.get('model', 'gpt-4o-mini')
    max_tokens = int(data.get('max_tokens') or 2000)
    dataset_id = data.get('dataset_id')
    custom_system_prompt = (data.get('custom_system_prompt') or '').strip()
    forced_raw = data.get('forced_skill_ids') or data.get('pinned_skill_ids') or []
    forced_skill_ids = [str(x).strip() for x in forced_raw if str(x).strip()]
    user_text = messages[-1].get('content', '') if messages else ''
    tool_decision = thought_tree(user_text)
    attachments = data.get('attachments', [])

    def sse(obj):
        return f'data: {json.dumps(obj, ensure_ascii=False)}\n\n'

    def call_llm_sync(msgs, stream=False):
        payload = json.dumps({
            'model': model, 'messages': msgs,
            'max_tokens': max_tokens, 'stream': stream,
        }).encode('utf-8')
        hdrs = {'Content-Type': 'application/json', 'Authorization': f'Bearer {api_key}'}
        req = urllib.request.Request(api_url, data=payload, headers=hdrs, method='POST')
        with urllib.request.urlopen(req, timeout=90) as resp:
            if not stream:
                body = json.loads(resp.read())
                return body['choices'][0]['message']['content']
            buf = ''
            for raw in resp:
                line = raw.decode('utf-8', errors='replace').strip()
                if line.startswith('data: '):
                    line = line[6:]
                if line in ('[DONE]', ''):
                    continue
                try:
                    chunk = json.loads(line)
                    buf += chunk.get('choices', [{}])[0].get('delta', {}).get('content', '')
                except Exception:
                    pass
            return buf

    def stream_llm(msgs):
        payload = json.dumps({
            'model': model, 'messages': msgs,
            'max_tokens': max_tokens, 'stream': True,
        }).encode('utf-8')
        hdrs = {'Content-Type': 'application/json', 'Authorization': f'Bearer {api_key}'}
        req = urllib.request.Request(api_url, data=payload, headers=hdrs, method='POST')
        with urllib.request.urlopen(req, timeout=90) as resp:
            for raw in resp:
                line = raw.decode('utf-8', errors='replace').strip()
                if line.startswith('data: '):
                    line = line[6:]
                if line == '[DONE]':
                    return
                try:
                    chunk = json.loads(line)
                    c = chunk.get('choices', [{}])[0].get('delta', {}).get('content', '')
                    if c:
                        yield c
                except Exception:
                    pass

    def extract_py_blocks(text: str) -> list[str]:
        return re.findall(r'```(?:python|py)\n(.*?)```', text, re.DOTALL)

    def llm_select_skills(candidates: list[dict], max_pick: int = 3) -> list[dict]:
        if not candidates:
            return []
        if len(candidates) <= 1:
            return candidates
        catalog = []
        for s in candidates:
            catalog.append({
                'id': s.get('id', ''),
                'name': s.get('name', ''),
                'cursor_name': s.get('cursor_name', ''),
                'description': (s.get('description') or '')[:640],
                'summary': s.get('summary', ''),
                'keywords': s.get('keywords', []),
            })
        prompt = (
            '从下面 skills 候选中，选择最适合当前用户问题的技能。\n'
            f'最多选择 {max_pick} 个；若都不相关返回空数组。\n'
            '只返回 JSON：{"selected_ids": ["id1", "id2"]}\n\n'
            f'用户问题：{user_text}\n\n'
            f'skills候选：{json.dumps(catalog, ensure_ascii=False)}'
        )
        msgs = [
            {'role': 'system', 'content': '你是 skills 路由器。只输出 JSON，不要任何解释。'},
            {'role': 'user', 'content': prompt},
        ]
        try:
            raw = call_llm_sync(msgs, stream=False).strip()
            m = re.search(r'\{.*\}', raw, re.DOTALL)
            obj = json.loads(m.group(0) if m else raw)
            selected_ids = obj.get('selected_ids', [])
            selected_set = {str(x) for x in selected_ids}
            out = [s for s in candidates if str(s.get('id')) in selected_set]
            return out[:max_pick]
        except Exception:
            return candidates[:max_pick]

    def generate():
        ctx = build_agent_context(dataset_id) if dataset_id else build_agent_context('')
        images_list = build_images_list(dataset_id) if dataset_id else []
        eda = dataset_service.get_in_memory(dataset_id) if dataset_id else None
        img_dir = _resolve_image_dir(eda) if eda else ''
        coco_path = getattr(eda, 'coco_json_path', '') if eda else ''

        extra_vars = {'images_dir': img_dir, 'coco_json_path': coco_path}
        attachment_ctx_parts: list[str] = []
        has_vision_img = False
        vision_image = None
        for att in attachments:
            t = att.get('type')
            if t == 'image':
                has_vision_img = True
                vision_image = att
                attachment_ctx_parts.append(f"用户上传了图片：{att.get('name', 'image')}")
            elif t == 'csv':
                rows = att.get('rows', [])
                extra_vars['uploaded_data'] = rows
                col_info = '、'.join(list(rows[0].keys())[:10]) if rows else '无列'
                attachment_ctx_parts.append(
                    f"用户上传了 CSV 文件「{att.get('name')}」，共 {att.get('total_rows', len(rows))} 行，"
                    f'列名：{col_info}，已作为 `uploaded_data`（list of dict）变量注入代码环境。'
                )
            elif t == 'json':
                d = att.get('data')
                if isinstance(d, list):
                    extra_vars['uploaded_data'] = d
                    attachment_ctx_parts.append(
                        f"用户上传了 JSON 文件「{att.get('name')}」（列表，{len(d)} 项），已作为 `uploaded_data` 变量注入。"
                    )
                elif isinstance(d, dict):
                    extra_vars['uploaded_data'] = d
                    attachment_ctx_parts.append(
                        f"用户上传了 JSON 文件「{att.get('name')}」（对象），已作为 `uploaded_data` 注入。"
                    )
            elif t == 'text':
                extra_vars['uploaded_text'] = att.get('content', '')
                attachment_ctx_parts.append(
                    f"用户上传了文本文件「{att.get('name')}」，内容已作为 `uploaded_text` 变量注入。"
                )

        attach_ctx = ('\n\n## 用户上传的文件\n' + '\n'.join(attachment_ctx_parts)) if attachment_ctx_parts else ''
        base_prompt = AGENT_SYSTEM_PROMPT.replace('{dataset_context}', ctx)
        tool_plan = (
            '\n\n## 内置思维树决策\n'
            f"- intent: {tool_decision.get('intent')}\n"
            f"- reason: {tool_decision.get('reason')}\n"
            f"- tools: {', '.join(tool_decision.get('tools', [])) or '无'}\n"
            f"- instruction: {tool_decision.get('instruction') or '按常规流程分析'}\n"
        )
        custom_tools_text = agent_service.list_custom_tools_for_prompt()
        if custom_tools_text:
            tool_plan += '\n## 用户自定义 Agent 工具（可直接在代码中调用）\n' + custom_tools_text + '\n'

        recalled_skills = skill_service.match_imported_skills(user_text, max_skills=8)
        picked = llm_select_skills(recalled_skills, max_pick=3)
        store_map = {str(x.get('id')): x for x in agent_modules_repo.load_skills()}
        forced_full = [store_map[i] for i in forced_skill_ids if i in store_map]
        picked_full = skill_service.hydrate_skills_from_store(picked)
        seen: set = set()
        matched_skills: list[dict] = []
        for s in forced_full + picked_full:
            sid = str(s.get('id', ''))
            if not sid or sid in seen:
                continue
            seen.add(sid)
            matched_skills.append(s)
        matched_skills = matched_skills[:6]
        skill_service.increase_load_counts([s.get('id') for s in matched_skills])

        if matched_skills:
            skill_blocks = []
            for s in matched_skills:
                script_list = ', '.join(
                    [sp.get('rel_path', sp.get('name', '')) for sp in (s.get('scripts') or [])[:8]]
                ) or '无'
                cfg_list = ', '.join([c.get('rel_path', '') for c in (s.get('configs') or [])[:8]]) or '无'
                skill_root = s.get('skill_dir') or str(Path(s.get('path', '')).parent)
                cid = s.get('cursor_name') or s.get('name', '')
                desc = (s.get('description') or '').strip()
                desc_short = (desc[:880] + '…') if len(desc) > 880 else desc
                skill_blocks.append(
                    f"### Skill: {s.get('name')}\n"
                    f'- Cursor skill id (`name` in frontmatter): `{cid}`\n'
                    f"- Description: {desc_short or '(见正文)'}\n"
                    f"- Summary: {s.get('summary')}\n"
                    f'- Runtime skill root: {skill_root}\n'
                    f'- Scripts: {script_list}\n'
                    f'- Config files: {cfg_list}\n'
                    f"- Full SKILL.md:\n{s.get('content')}"
                )
            tool_plan += (
                '\n## 按需加载 Skills（Cursor 兼容：SKILL.md + YAML frontmatter）\n'
                '以下技能与 Cursor 约定一致：`name`、`description` 用于发现；包内为 `scripts/` 等相对路径。'
                '对话中 **固定** 的技能已优先列入，须严格按其步骤与约束执行（优于常识推断）。\n'
                '以下是与当前问题匹配或用户指定的技能（见下文块）。\n\n'
                'Magic-Fox 预测/拉训练列表优先：`run_magic_fox_model_validation(...)`、`run_magic_fox_fetch_training_models(...)`；'
                "其它技能可调用 run_skill_cli(skill_name, script='scripts/xxx.py', args=[...])（自动 SKILL_ROOT/cwd）；"
                "或 run_skill_script(skill_name, script='xxx.py', kwargs={...})；"
                "如需读取技能文件可调用 read_skill_file(skill_name, rel_path='...')；"
                "如需加载包内固定配置可调用 load_skill_config(skill_name)（默认首个索引到的 config.json 等）或 load_skill_config(skill_name, rel_path='config/xxx.json')。\n"
                '注意：不要使用 ~/.cursor/skills/... 这类固定路径，必须使用运行时注入的 skill root。\n\n'
                + '\n\n'.join(skill_blocks)
                + '\n'
            )

        if custom_system_prompt:
            system_content = custom_system_prompt + '\n\n---\n\n' + base_prompt + tool_plan + attach_ctx
        else:
            system_content = base_prompt + tool_plan + attach_ctx
        full_messages = [{'role': 'system', 'content': system_content}]

        if has_vision_img and vision_image and messages:
            *prev, last_user = messages
            img_content = [
                {'type': 'text', 'text': last_user.get('content', '')},
                {'type': 'image_url', 'image_url': {
                    'url': f"data:{vision_image['mime']};base64,{vision_image['data']}"
                }}
            ]
            full_messages += prev
            full_messages += [{'role': 'user', 'content': img_content}]
        else:
            full_messages += messages

        yield sse({'type': 'status', 'msg': f"🧠 决策：{tool_decision.get('reason')}（{tool_decision.get('intent')}）"})
        if matched_skills:
            ids_m = {str(s.get('id')) for s in matched_skills}
            n_pin = len(set(forced_skill_ids) & ids_m)
            names = ', '.join([s.get('name', '') for s in matched_skills])
            msg = f'🧩 已加载 Skills：{names}'
            if n_pin:
                msg += f'（含固定 {n_pin} 个）'
            yield sse({'type': 'status', 'msg': msg})

        search_keywords = ['搜索', '搜一下', '查找最新', '网络上', '联网搜', '最新资讯',
                           '查询资料', '百度', '谷歌', '最新论文', '最新方法']
        need_search = any(kw in user_text for kw in search_keywords)
        if need_search:
            search_q = user_text
            for kw in ['帮我', '请', '搜索', '搜一下', '查找', '联网搜', '查询']:
                search_q = search_q.replace(kw, '').strip()
            search_q = search_q[:100]
            yield sse({'type': 'status', 'msg': f'🌐 搜索：{search_q[:30]}...'})
            search_result = web_search(search_q)
            yield sse({'type': 'search_result', 'query': search_q, 'result': search_result})
            full_messages[0]['content'] += f'\n\n## 联网搜索结果（查询：{search_q}）\n{search_result}'

        yield sse({'type': 'status', 'msg': '🤔 正在分析问题...'})
        try:
            first_reply = call_llm_sync(full_messages, stream=False)
        except urllib.error.HTTPError as e:
            body = e.read().decode('utf-8', errors='replace')
            yield sse({'type': 'error', 'msg': f'HTTP {e.code}: {body[:400]}'})
            yield 'data: [DONE]\n\n'
            return
        except Exception as e:  # noqa: BLE001
            yield sse({'type': 'error', 'msg': str(e)})
            yield 'data: [DONE]\n\n'
            return

        code_blocks = extract_py_blocks(first_reply)
        exec_summaries: list[str] = []
        max_fix_attempts = 3

        if code_blocks and (images_list or extra_vars):
            for i, code in enumerate(code_blocks):
                current_code = code
                final_result = None
                final_attempt = 0
                for attempt in range(max_fix_attempts + 1):
                    final_attempt = attempt
                    label = f'{i + 1}/{len(code_blocks)}'
                    yield sse({'type': 'code', 'code': current_code, 'index': i})
                    if attempt == 0:
                        yield sse({'type': 'status', 'msg': f'⚙️ 执行代码 ({label})...'})
                    else:
                        yield sse({'type': 'status', 'msg': f'🔁 第 {attempt} 次自动修复后重试 ({label})...'})
                    result = exec_code(current_code, images_list, extra_vars)
                    yield sse({'type': 'code_result', 'result': result, 'index': i})
                    final_result = result
                    if result.get('type') != 'error':
                        break
                    if attempt >= max_fix_attempts:
                        break
                    err_text = (result.get('output') or '').strip()[:12000]
                    repair_prompt = (
                        '下面这段 Python 代码在执行时报错，请你修复并返回可执行版本。\n\n'
                        '要求：\n'
                        '1) 仅返回一个 ```python 代码块```，不要额外解释；\n'
                        '2) 保持原始意图不变；\n'
                        '3) 必须兼容当前运行环境中可用变量/函数：images, uploaded_data, uploaded_text, '
                        'filter_gallery, show_chart, show_table, show_df, visualize_df, find_images, hard_cases, '
                        'category_stats, bbox_stats, coco_overview, export_csv, export_json, export_txt, pack_dataset, export_coco；\n'
                        '4) 避免使用未定义变量（例如 filtered_ids 这类未赋值变量）。\n\n'
                        f'原始代码：\n```python\n{current_code}\n```\n\n'
                        f'报错信息：\n```text\n{err_text}\n```'
                    )
                    repair_msgs = [
                        {'role': 'system', 'content': '你是严谨的 Python 代码修复助手。只输出一个可执行 python 代码块。'},
                        {'role': 'user', 'content': repair_prompt},
                    ]
                    try:
                        repair_reply = call_llm_sync(repair_msgs, stream=False)
                        fixed_blocks = extract_py_blocks(repair_reply)
                        fixed_code = (fixed_blocks[0] if fixed_blocks else repair_reply).strip()
                        if not fixed_code:
                            yield sse({'type': 'status', 'msg': f'⚠️ 自动修复未产出有效代码，停止重试（代码块 {i + 1}）'})
                            break
                        current_code = fixed_code
                        yield sse({'type': 'status', 'msg': f'🛠️ 已自动分析报错并生成修复代码（代码块 {i + 1}）'})
                    except Exception as e:  # noqa: BLE001
                        yield sse({'type': 'status', 'msg': f'⚠️ 自动修复调用失败：{e}'})
                        break

                for action in (final_result or {}).get('ui_actions', []):
                    yield sse({'type': 'ui_action', 'action': action})

                if final_result is None:
                    final_result = {'type': 'error', 'output': '代码未执行'}
                exec_summaries.append(
                    f"代码 {i + 1} 执行结果（{final_result.get('type')}，attempt={final_attempt + 1}）：\n"
                    f"{final_result.get('output', '')}"
                )

        if exec_summaries:
            results_text = '\n\n'.join(exec_summaries)
            follow_up = (
                f'上面代码在真实数据集上的执行结果如下：\n\n{results_text}\n\n'
                '请基于这些**真实数据**给出最终分析结论，直接给结论，不要重复代码。'
            )
            phase3_msgs = full_messages + [
                {'role': 'assistant', 'content': first_reply},
                {'role': 'user', 'content': follow_up},
            ]
            yield sse({'type': 'status', 'msg': '💬 基于真实数据生成结论...'})
        else:
            phase3_msgs = None

        yield sse({'type': 'conclusion_start'})
        if phase3_msgs:
            try:
                for chunk in stream_llm(phase3_msgs):
                    yield sse({'type': 'conclusion', 'content': chunk})
            except Exception as e:  # noqa: BLE001
                yield sse({'type': 'error', 'msg': str(e)})
        else:
            for chunk in [first_reply[i:i + 80] for i in range(0, len(first_reply), 80)]:
                yield sse({'type': 'conclusion', 'content': chunk})

        yield 'data: [DONE]\n\n'

    return Response(stream_with_context(generate()), mimetype='text/event-stream',
                    headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'})


def run_code_manual(code: str, dataset_id: str | None) -> dict:
    """手动运行代码（chat/run_code 端点）。"""
    images_list = build_images_list(dataset_id) if dataset_id else []
    eda_obj = dataset_service.get_in_memory(dataset_id) if dataset_id else None
    path_vars = {
        'images_dir': _resolve_image_dir(eda_obj) if eda_obj else '',
        'coco_json_path': getattr(eda_obj, 'coco_json_path', '') if eda_obj else '',
    }
    return exec_code(code, images_list, path_vars)


def parse_chat_upload(filename: str, raw: bytes) -> dict:
    ext = Path(filename).suffix.lower()
    if ext in ('.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'):
        import base64
        mime = {
            'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
            'gif': 'image/gif', 'webp': 'image/webp', 'bmp': 'image/bmp',
        }.get(ext.lstrip('.'), 'image/jpeg')
        b64 = base64.b64encode(raw).decode('utf-8')
        return {'type': 'image', 'name': filename, 'mime': mime, 'data': b64, 'size': len(raw)}
    text = raw.decode('utf-8', errors='replace')
    if ext == '.csv':
        import io
        import csv as _csv
        reader = _csv.DictReader(io.StringIO(text))
        rows = list(reader)
        return {
            'type': 'csv', 'name': filename,
            'rows': rows[:500], 'total_rows': len(rows), 'preview': text[:3000],
        }
    if ext == '.json':
        try:
            data_obj = json.loads(text)
        except Exception:
            data_obj = None
        return {
            'type': 'json', 'name': filename,
            'data': data_obj if isinstance(data_obj, (list, dict)) else None,
            'preview': text[:3000],
        }
    if ext in ('.txt', '.md', '.log'):
        return {'type': 'text', 'name': filename, 'content': text[:15000], 'size': len(text)}
    raise ValueError(f'暂不支持 {ext} 类型，请上传 jpg/png/csv/json/txt 文件')
