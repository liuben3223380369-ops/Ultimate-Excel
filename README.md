# 极致表格 MyExcel · Pro

开源免费的 Excel / WPS 替代品 — 纯 HTML + JavaScript 打造，由 **HyperFormula（400+ 函数）** 与 **SheetJS（xlsx 读写）** 驱动，可打包为单文件 EXE 或 Android APK，双击即用、无需安装。

> 仓库地址：<https://github.com/liuben3223380369-ops/Ultimate-Excel>

---

## ✨ 核心特性

- **完整电子表格**：多 Sheet、单元格编辑、合并、列宽行高、字体、底色、边框、数字格式、冻结窗格
- **500 个公式函数**：HyperFormula 内置 400+（含 VLOOKUP / XLOOKUP / IFS / LAMBDA / FILTER 等），另通过 `plugins/15-functions.js` 扩展 77 个金融债券、统计矩阵、动态数组、文本函数
- **xlsx 双向兼容**：打开 Excel 文件完整还原数据/公式/样式；保存后用 Excel 打开公式依然工作；另支持 CSV 导入导出
- **JavaScript 宏系统**（替代 VBA）：宏管理器面板（`Ctrl+Alt+M`）、沙箱 API（读写单元格/区域/样式/工作表）、自动运行宏、逐宏快捷键、JSON 导入导出、localStorage 持久化、静态安全检查
- **21 个功能插件**：图表（ECharts）、PDF 导出、条件格式、数据校验、筛选、批注、超链接、二维码、条码、迷你图、Markdown、图片、i18n、主题、模板、历史、安全等
- **极致轻量**：单文件便携 EXE 约 69MB（对比 MS Office ~3GB、WPS ~600MB、LibreOffice ~300MB）

## 📦 下载安装

到 [Releases 页面](https://github.com/liuben3223380369-ops/Ultimate-Excel/releases/latest) 下载：

| 文件 | 平台 | 说明 |
|---|---|---|
| `MyExcel-x.x.x-portable.exe` | Windows | **绿色便携版**，双击即运行，无需安装；设置保存在 EXE 同目录 `userData\` |
| `MyExcel-Setup-x.x.x.exe` | Windows | 安装版（NSIS），可选安装路径、生成桌面/开始菜单快捷方式 |
| `MyExcel-x.x.x.apk` | Android | 手机版（Capacitor 打包） |

> ⚠️ 更新版本时请先卸载/删除旧版再安装，避免混用旧文件。

## 🚀 快速开始

**方式一：直接运行（零依赖）**

纯前端应用，双击 `index.html` 即可在浏览器中运行。

**方式二：本地开发 / 打包 EXE**

```powershell
cd excel-app
npm install        # 安装 Electron + electron-builder
npm start          # 本地运行（等同 EXE 内部体验）
npm run build:portable   # 构建单文件便携 EXE → dist\
npm run build:installer  # 构建 NSIS 安装器 → dist\
```

**方式三：一键启动（Windows）**

双击仓库中的 `启动极致表格.bat`。

详细构建说明见 [BUILD.md](BUILD.md)。

## 📁 项目结构

```
excel-app/
├── index.html              # 主应用（HTML + CSS + JS 单文件）
├── main.js                 # Electron 主进程
├── preload.js              # Electron preload 桥（contextIsolation + sandbox）
├── package.json            # npm + electron-builder 配置
├── LICENSE.txt             # GPL-3.0
├── lib/                    # 第三方库（本地打包，无需 CDN）
│   ├── hyperformula.min.js # 公式引擎（400+ 函数）
│   ├── xlsx.full.min.js    # xlsx 读写
│   ├── echarts.min.js      # 图表
│   └── ...                 # jspdf / papaparse / qrcode / marked / dayjs 等 19 个
├── plugins/                # 功能插件（21 个）
│   ├── 00-core.js          # 插件框架（面板/右键菜单/事件）
│   ├── 15-functions.js     # 77 个扩展函数（HF 总数 423 → 500）
│   ├── 89-macro.js         # JavaScript 宏系统
│   └── ...                 # 图表/PDF/CSV/条件格式/校验/筛选/批注/超链接/QR/条码/迷你图/Markdown/图片/i18n/主题/模板/历史/安全
├── assets/                 # 静态资源
├── build/                  # 图标与打包资源
└── .github/workflows/      # CI：build-exe.yml（Windows）/ build-apk.yml（Android）
```

## 🔄 持续集成

推送到 `main` 分支后 GitHub Actions 自动构建并发布到 Release：

- **Build Windows EXE**：electron-builder 打包便携版 + 安装版，含 asar 内容校验（插件缺失即构建失败）
- **Build Android APK**：Capacitor 打包 `www/` 为 APK

## ⚠️ 已知限制

- **轻量模式**：单页最大 `1000 行 × 200 列`，适合个人/小型团队；更大工作簿可分多 Sheet 拆分
- **图表**：柱/折/饼/散点等基础类型（ECharts 渲染）
- **数据透视**：暂未实现
- **VBA**：不兼容 `.xlsm` 二进制宏，请使用内置 JavaScript 宏系统

## 📄 许可证

[GPL-3.0](LICENSE.txt) · Copyright © 2026 MyExcel

## 🙏 技术栈致谢

[HyperFormula](https://hyperformula.handsontable.com/) · [SheetJS](https://sheetjs.com/) · [ECharts](https://echarts.apache.org/) · [Electron](https://www.electronjs.org/) · [Capacitor](https://capacitorjs.com/) · jsPDF · PapaParse · dayjs · marked 等
