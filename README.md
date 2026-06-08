# 西门子 SI 渠道销售培训考核学习平台

> Siemens Smart Infrastructure (SI) 渠道销售培训考核 · 一站式学习与考核 Web 平台

面向西门子 **Smart Infrastructure 渠道销售（SI Channel Sales）** 伙伴打造的纯前端学习考核平台：把「**知识考核**」与「**产品资料学习**」合二为一，以考促学、查漏补缺。

---

## ✨ 核心功能

### 📝 考核中心
- **灵活组卷**：综合题库 / 按 5 大能力模块 / 按 25 个知识分类 / 错题本重练
- **题型自适应**：单选 87 题、多选 49 题（含判断题），共 **136 题 / 25 分类**
- **两种模式**：考试模式（交卷统一判分）、练习模式（每题即时解析）
- **答题卡 + 计时**：进度可视化、随时跳题、限时闯关
- **自动判分与评级**：正确率、合格线、优秀/良好/合格评级
- **错题本**：答错自动收集，答对自动移出，支持专项重练

### 📖 学习资料库
- **EA / EP 两大产品线**、**12 个产品分类**、**20 份销售资料**
- PDF **在线预览**（弹窗）、**一键下载**、**型号/关键词搜索**
- **已读标记**与学习进度追踪

### 📊 学习档案
- 历史考核记录、平均/最高正确率、合格次数等 KPI
- 数据保存在浏览器本地（localStorage），无需后端、保护隐私

---

## 🗂️ 能力模块与产品线

| 能力模块 | 涵盖知识分类 |
|---|---|
| 🔌 数字化产品 | MGMS、NXpower、Powermanager、ECX、SC Insights、SCADA、ISED |
| 💼 销售技能 | 潜在客户生成、竞争策略、客户预测、解决方案销售、大客户管理、软技能、武功秘籍 |
| 🤝 谈判与沟通 | 高效谈判、谈判技巧、跨智能沟通协作、向上/向下/平行管理 |
| 🧠 职场软技能 | 情绪管理、冲突解决/管理、面对销售挫折、时间管理 |
| 📈 财务知识 | 企业财务报表分析 |

| 产品线 | 产品分类 |
|---|---|
| ⚡ EA（电气化与自动化 · 中压） | AIS、CS、GIS、保护、数字化、VCB |
| 🔋 EP（电气产品 · 低压） | 8PT、ACB、ATSE/LBS、Digital、MCB/RCD、MCCB |

---

## 🛠️ 技术栈

- **纯前端静态站**：原生 HTML + CSS + JavaScript（ES Modules），**零构建、零依赖**
- 哈希路由 SPA，兼容 **GitHub Pages / Vercel / Netlify** 零配置部署
- 数据驱动：题库与资料清单为 JSON，由 `scripts/build_data.py` 从源文件生成
- 西门子品牌视觉（Siemens Petrol `#009999` / Deep Blue `#000028`）

## 📁 项目结构

```
siemens-si-training/
├── index.html              # 应用外壳
├── css/styles.css          # 西门子品牌样式
├── js/
│   ├── app.js              # 哈希路由 + 全局 PDF 弹窗
│   ├── home.js             # 首页/仪表盘
│   ├── exam.js             # 考核引擎（组卷/答题/判分）
│   ├── library.js          # 学习资料库
│   ├── records.js          # 我的成绩
│   ├── data.js / store.js / util.js
├── data/
│   ├── questions.json      # 136 题题库
│   └── materials.json      # 资料清单
├── materials/ea|ep/...     # PDF 资料（在线预览/下载）
├── scripts/build_data.py   # 由 Excel/PDF 生成数据的脚本
└── 25专家测试题.xlsx        # 题库源文件
```

## 🚀 本地运行

因使用 ES Modules + fetch，需通过 HTTP 访问（不能直接双击打开）：

```bash
# 在项目根目录
python -m http.server 8123
# 浏览器打开 http://127.0.0.1:8123
```

## ☁️ 部署

**Vercel（推荐，最快）**：导入本仓库 → Framework 选 “Other” → 直接 Deploy（无需构建命令）。

**GitHub Pages**：仓库 Settings → Pages → Source 选 `main` 分支 `/ (root)` → 保存，几分钟后即得网址。

## 🔄 重新生成数据（可选）

```bash
pip install openpyxl
python scripts/build_data.py   # 重新生成 data/*.json 并刷新 materials/
```

---

> 本项目为内部培训用途的教学原型，题库与资料版权归西门子（Siemens）所有。
