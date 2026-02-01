"""
COCO EDA 工具 - 项目内实现，无需外部 coco-eda 仓库。
从 COCO JSON 加载数据，提供 CocoEDA 类供 app.py 使用。
"""
from pathlib import Path
import json
import numpy as np
import pandas as pd


class CocoEDA:
    """COCO 数据集探索分析，基于 JSON + pandas，无外部 coco-eda 依赖。"""

    def __init__(self, coco_json_path, name='dataset', image_dir=None):
        self.coco_json_path = str(coco_json_path)
        self.name = name
        self.image_dir = str(image_dir) if image_dir else None

        with open(self.coco_json_path, 'r', encoding='utf-8') as f:
            coco = json.load(f)

        self.images_df = pd.DataFrame(coco.get('images', []))
        self.annotations_df = pd.DataFrame(coco.get('annotations', []))
        self.categories_df = pd.DataFrame(coco.get('categories', []))

        if self.images_df.empty:
            self.images_df = pd.DataFrame(columns=['id', 'file_name', 'width', 'height'])
        if self.annotations_df.empty:
            self.annotations_df = pd.DataFrame(columns=['id', 'image_id', 'category_id', 'bbox'])
        if self.categories_df.empty:
            self.categories_df = pd.DataFrame(columns=['id', 'name'])

    def compute_bbox_features(self):
        """合并 annotations 与 categories，并计算 bbox 相关特征。返回每行一条标注的 DataFrame。"""
        if self.annotations_df.empty:
            df = pd.DataFrame(columns=[
                'name', 'area', 'sqrt_area', 'w', 'h', 'max_side', 'min_side',
                'wh_ratio', 'aspect_ratio', 'c_x', 'c_y', 'image_id'
            ])
            return df

        ann = self.annotations_df.copy()
        cat = self.categories_df[['id', 'name']].copy()
        cat = cat.rename(columns={'id': 'category_id', 'name': 'name'})
        df = ann.merge(cat, on='category_id', how='left')

        # COCO bbox: [x, y, width, height]
        bbox = df['bbox']
        if bbox.isna().all():
            df['w'] = np.nan
            df['h'] = np.nan
            df['area'] = np.nan
            df['sqrt_area'] = np.nan
            df['max_side'] = np.nan
            df['min_side'] = np.nan
            df['wh_ratio'] = np.nan
            df['aspect_ratio'] = np.nan
            df['c_x'] = np.nan
            df['c_y'] = np.nan
            return df

        def parse_bbox(b):
            if b is None or (isinstance(b, (list, tuple)) and len(b) < 4):
                return (np.nan,) * 4
            if isinstance(b, (list, tuple)):
                return (float(b[0]), float(b[1]), float(b[2]), float(b[3]))
            return (np.nan,) * 4

        xywh = np.array([parse_bbox(b) for b in bbox])
        x, y, w, h = xywh[:, 0], xywh[:, 1], xywh[:, 2], xywh[:, 3]

        df['w'] = w
        df['h'] = h
        df['area'] = w * h
        df['sqrt_area'] = np.sqrt(np.maximum(df['area'], 0))
        df['max_side'] = np.maximum(w, h)
        df['min_side'] = np.minimum(w, h)
        df['wh_ratio'] = np.where(h > 0, w / h, np.nan)
        df['aspect_ratio'] = np.where(df['min_side'] > 0, df['max_side'] / df['min_side'], np.nan)
        df['c_x'] = x + w / 2
        df['c_y'] = y + h / 2

        return df

    def get_class_distribution(self):
        """返回各类别数量与占比，DataFrame 列: name, count, percentage。"""
        if self.annotations_df.empty or self.categories_df.empty:
            return pd.DataFrame(columns=['name', 'count', 'percentage'])

        ann = self.annotations_df
        cat = self.categories_df[['id', 'name']]
        merged = ann.merge(cat, left_on='category_id', right_on='id', how='left')
        counts = merged['name'].value_counts().reset_index()
        counts.columns = ['name', 'count']
        total = counts['count'].sum()
        if total > 0:
            counts['percentage'] = (counts['count'] / total * 100).round(2).astype(str) + '%'
        else:
            counts['percentage'] = '0%'
        return counts
