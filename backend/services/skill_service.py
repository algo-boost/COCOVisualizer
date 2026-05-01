"""SKILL.md 解析、frontmatter、关键词、技能 zip 导入。"""
from __future__ import annotations

import re
import zipfile
from datetime import datetime
from pathlib import Path

from ..repositories import agent_modules_repo


def summarize_markdown(text: str) -> tuple[str, str]:
    lines = [ln.strip() for ln in str(text or '').splitlines() if ln.strip()]
    title = ''
    for ln in lines:
        if ln.startswith('#'):
            title = ln.lstrip('#').strip()
            break
    if not title:
        title = lines[0] if lines else 'Skill'
    body = ' '.join(lines[:20])
    return title[:120], body[:600]


def parse_frontmatter(text: str) -> dict:
    text = str(text or '')
    lines = text.splitlines()
    if not lines or lines[0].strip() != '---':
        return {'name': '', 'description': '', 'body': text, 'has_frontmatter': False}
    end = None
    for i in range(1, len(lines)):
        if lines[i].strip() == '---':
            end = i
            break
    if end is None:
        return {'name': '', 'description': '', 'body': text, 'has_frontmatter': False}
    raw_fm = '\n'.join(lines[1:end])
    body = '\n'.join(lines[end + 1:])
    name, description = '', ''
    data = None
    try:
        import yaml  # type: ignore
        data = yaml.safe_load(raw_fm)
    except Exception:
        data = None
    if isinstance(data, dict):
        name = str(data.get('name') or '').strip()
        d = data.get('description')
        description = str(d).strip() if d is not None else ''
    if not name:
        for ln in lines[1:end]:
            m = re.match(r'^name:\s*["\']?([^"\'\n#]+?)["\']?\s*$', ln.strip())
            if m:
                name = m.group(1).strip()
                break
    if not description:
        for ln in lines[1:end]:
            m = re.match(r'^description:\s*["\']?(.+?)["\']?\s*$', ln.strip())
            if m and m.group(1).strip() not in ('>-', '|', '>', '-'):
                description = m.group(1).strip()
                break
    return {
        'name': name.strip()[:80],
        'description': description.strip()[:2048],
        'body': body,
        'has_frontmatter': True,
    }


def validate_parsed(parsed: dict, full_text: str, path: str = '') -> dict:
    body = (parsed.get('body') or '') if parsed.get('has_frontmatter') else full_text
    text_for_usage = f"{full_text}\n{parsed.get('description') or ''}"
    lines = body.splitlines()
    has_h1 = any(ln.strip().startswith('# ') for ln in lines)
    has_usage = (
        ('use when' in text_for_usage.lower())
        or ('何时使用' in text_for_usage)
        or ('使用场景' in text_for_usage)
    )
    has_steps = ('步骤' in body) or ('step' in body.lower()) or ('##' in body)
    warnings: list[str] = []
    if not parsed.get('has_frontmatter'):
        warnings.append('缺少 YAML frontmatter（Cursor：首行 ---，含 name 与 description）')
    else:
        nm = (parsed.get('name') or '').strip()
        if not nm:
            warnings.append('frontmatter 缺少 name')
        elif not re.match(r'^[a-z0-9][a-z0-9-]{0,62}$', nm):
            warnings.append('name 建议使用小写字母、数字、连字符（与 Cursor 一致）')
        desc = (parsed.get('description') or '').strip()
        if not desc:
            warnings.append('frontmatter 缺少 description（应说明能力及 Use when / 触发场景）')
        elif len(desc) > 1024:
            warnings.append(f'description 长度 {len(desc)}，Cursor 建议 ≤1024')
    if not has_h1:
        warnings.append('正文缺少一级标题（建议以 # 技能名 开头）')
    if not has_usage:
        warnings.append('未检测到 “Use when / 何时使用” 类触发说明（可写在 description 或正文）')
    if not has_steps:
        warnings.append('未检测到明确步骤说明（建议用小节列出）')
    if path and 'SKILL.md' not in path:
        warnings.append('文件名不是 SKILL.md（建议按标准命名）')
    return {'valid': len(warnings) == 0, 'warnings': warnings}


def extract_keywords(name: str, summary: str, content: str, limit: int = 24) -> list[str]:
    base = f'{name} {summary} {content[:1200]}'
    raw = re.findall(r'[A-Za-z_]{3,}|[\u4e00-\u9fff]{2,}', base)
    seen: set = set()
    out: list[str] = []
    stop = {'the', 'and', 'for', 'with', 'this', 'that', 'from', 'into', 'you', 'your', 'skill', 'agent'}
    for t in raw:
        k = t.lower()
        if k in stop or k in seen:
            continue
        seen.add(k)
        out.append(t)
        if len(out) >= limit:
            break
    return out


def index_config_files(skill_dir: Path) -> list[dict]:
    if not skill_dir.is_dir():
        return []
    root_names = (
        'config.json', 'skill_config.json', 'skill.json', 'settings.json',
        'config.yaml', 'config.yml', 'skill.yaml', 'skill.yml',
        'config.toml', 'skill.toml', '.skillrc',
    )
    seen: set = set()
    configs: list[dict] = []
    for name in root_names:
        p = skill_dir / name
        if p.is_file():
            rel = str(p.relative_to(skill_dir))
            if rel not in seen:
                seen.add(rel)
                configs.append({'rel_path': rel, 'path': str(p)})
    cfg_sub = skill_dir / 'config'
    if cfg_sub.is_dir():
        for p in sorted(cfg_sub.rglob('*')):
            if not p.is_file():
                continue
            rel = str(p.relative_to(skill_dir))
            if rel in seen or rel.count('/') > 6:
                continue
            low = p.suffix.lower()
            if low not in ('.json', '.yaml', '.yml', '.toml', ''):
                continue
            if low == '' and p.name not in ('.skillrc',):
                continue
            seen.add(rel)
            configs.append({'rel_path': rel, 'path': str(p)})
    return configs


def match_imported_skills(user_text: str, max_skills: int = 3) -> list[dict]:
    skills = agent_modules_repo.load_skills()
    if not skills:
        return []
    t = str(user_text or '').lower()
    scored: list[tuple[int, dict]] = []
    for s in skills:
        if not s.get('enabled', True):
            continue
        name = str(s.get('name', '')).lower()
        cursor_name = str(s.get('cursor_name', '')).lower()
        desc = str(s.get('description', '')).lower()
        summary = str(s.get('summary', '')).lower()
        score = 0
        for token in (name, cursor_name, desc, summary):
            if token and token in t:
                score += 3
        for kw in re.findall(r'[a-zA-Z_]{3,}|[\u4e00-\u9fff]{2,}', f'{name} {cursor_name} {desc} {summary}')[:32]:
            if kw and kw in t:
                score += 1
        if ('skill' in t or '技能' in t) and score == 0:
            score = 1
        if score > 0:
            scored.append((score, s))
    scored.sort(key=lambda x: x[0], reverse=True)
    out: list[dict] = []
    for score, s in scored[:max_skills]:
        out.append({
            'id': s.get('id', ''),
            'name': s.get('name', 'Skill'),
            'cursor_name': s.get('cursor_name', ''),
            'description': (s.get('description') or '')[:1600],
            'summary': s.get('summary', ''),
            'content': str(s.get('content', ''))[:3500],
            'keywords': s.get('keywords', [])[:16],
            'scripts': s.get('scripts', [])[:20],
            'configs': s.get('configs', [])[:20],
            'default_config_rel': s.get('default_config_rel', ''),
            'skill_dir': s.get('skill_dir', ''),
            'score': score,
        })
    return out


def hydrate_skills_from_store(items: list[dict]) -> list[dict]:
    if not items:
        return []
    store = agent_modules_repo.load_skills()
    idm = {str(x.get('id')): x for x in store}
    out: list[dict] = []
    for it in items:
        if not isinstance(it, dict):
            continue
        sid = str(it.get('id', ''))
        out.append(idm[sid] if sid and sid in idm else it)
    return out


def increase_load_counts(skill_ids: list[str]) -> None:
    if not skill_ids:
        return
    all_skills = agent_modules_repo.load_skills()
    id_to_item = {str(x.get('id')): x for x in all_skills}
    now_iso = datetime.now().isoformat()
    changed = False
    for sid in skill_ids:
        sid = str(sid or '')
        if sid and sid in id_to_item:
            it = id_to_item[sid]
            it['load_count'] = int(it.get('load_count', 0)) + 1
            it['last_matched_at'] = now_iso
            changed = True
    if changed:
        agent_modules_repo.save_skills(list(id_to_item.values()))


def import_skill_zip(zip_path: Path, root_dir: Path, source_filename: str) -> dict:
    """解压 skill zip 并索引 SKILL.md。返回 import 报告。"""
    try:
        with zipfile.ZipFile(zip_path, 'r') as zf:
            zf.extractall(str(root_dir))
    except Exception as exc:
        raise ValueError(f'解压失败：{exc}')

    py_files = [p for p in root_dir.rglob('*.py') if p.is_file()]
    skill_md_files = [p for p in root_dir.rglob('SKILL.md') if p.is_file()]
    if not skill_md_files:
        raise ValueError('zip 中未找到 SKILL.md（标准 skills 包应包含该文件）')

    skill_items = agent_modules_repo.load_skills()
    skill_reports: list[dict] = []
    import time as _t

    for md in skill_md_files:
        try:
            text = md.read_text(encoding='utf-8', errors='replace')
            parsed = parse_frontmatter(text)
            body_for_title = (parsed.get('body') or text).strip() or text
            title, body_summary = summarize_markdown(body_for_title)
            validation = validate_parsed(parsed, text, str(md))
            cursor_name = (parsed.get('name') or '').strip()
            description = (parsed.get('description') or '').strip()
            display_name = cursor_name or title or md.parent.name
            summary = description[:800] if description else body_summary
            keywords = extract_keywords(display_name, summary, text)
            sid = f'skilldef_{int(_t.time() * 1000)}_{len(skill_reports)}'
            skill_dir = md.parent
            scripts = []
            for sp in sorted(skill_dir.rglob('*.py')):
                if not sp.is_file():
                    continue
                scripts.append({
                    'name': sp.name,
                    'rel_path': str(sp.relative_to(skill_dir)),
                    'path': str(sp),
                })
            configs = index_config_files(skill_dir)
            default_cfg = configs[0]['rel_path'] if configs else ''
            item = {
                'id': sid,
                'cursor_name': cursor_name,
                'description': description,
                'name': display_name,
                'summary': summary,
                'content': text[:12000],
                'path': str(md),
                'skill_dir': str(skill_dir),
                'enabled': True,
                'source_zip': source_filename,
                'keywords': keywords,
                'scripts': scripts,
                'configs': configs,
                'default_config_rel': default_cfg,
                'load_count': 0,
                'last_matched_at': '',
                'valid': validation.get('valid', False),
                'warnings': validation.get('warnings', []),
            }
            skill_items.insert(0, item)
            skill_reports.append({
                'name': item['name'],
                'cursor_name': item.get('cursor_name', ''),
                'path': item['path'],
                'valid': item['valid'],
                'warnings': item['warnings'],
                'description': (description[:200] + '…') if len(description) > 200 else description,
                'keywords': item['keywords'][:10],
                'scripts': [s.get('rel_path') for s in scripts[:8]],
                'configs': [c.get('rel_path') for c in configs[:8]],
            })
        except Exception:
            continue

    agent_modules_repo.save_skills(skill_items)
    return {
        'modules': [],
        'count': 0,
        'skills_count': len(skill_md_files),
        'skill_reports': skill_reports,
        'ignored_py_count': len(py_files),
    }
