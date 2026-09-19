# 极致表格 MyExcel · 打包为单文件 EXE

本应用是纯前端 HTML / JavaScript,可以直接双击 `index.html` 运行。要打成独立的 EXE 分发,使用 Electron + electron-builder。

---

## 1. 准备工作 (Windows)

需要先安装 Node.js 14+ 和 npm,推荐 18/20 LTS。

```powershell
node -v          # 应显示 v14 以上
npm -v
```

## 2. 一键构建

```powershell
cd excel-app
npm install
npm run build:portable
```

执行成功后,产物在 `dist\` 下:

```
dist\
└── win-unpacked\               (解压运行版,可双击 exe 直接运行)
└── 极致表格-MyExcel-1.0.0-portable.exe      ← ★ 最终交付物 (单文件 EXE)
```

`极致表格-MyExcel-1.0.0-portable.exe` 是一个 **自解压运行** 的单文件 EXE:
- 双击运行,无需安装
- 解压到 `%TEMP%`,启动 Chromium 内核加载 `index.html`
- 关闭后自动清理
- 设置、autosave 文件保存在 EXE 同目录的 `userData\`(可移植)

> 想要安装器(NSIS)而非便携版?执行 `npm run build:installer`,产物在 `dist\` 下 `极致表格-MyExcel-Setup-1.0.0.exe`,可选择安装路径、生成桌面/开始菜单快捷方式。

---

## 3. 两套产物的区别

| 形态         | 文件类型               | 大小       | 是否需安装 | 注册表/快捷方式 | 适用场景       |
| ------------ | ---------------------- | ---------- | ---------- | --------------- | -------------- |
| **portable** | 单文件 EXE             | ~150MB     | 否         | 否              | U盘携带/试用  |
| **nsis**     | 安装器 EXE             | ~150MB     | 是         | 是              | 正式分发      |

> 注:体积来自 Chromium + Node 运行时,与同类产品(MS Office ~3GB、WPS ~600MB、LibreOffice ~300MB)相比已经极致轻量。

---

## 4. 自定义图标

如果要替换默认占位图标:

1. 准备一个 256x256 PNG 文件 `build\icon-src.png`
2. 用任何 ICO 转换工具生成多尺寸 ICO:`build\icon-16.png`、`icon-32.png`、`icon-48.png`、`icon-64.png`、`icon-128.png`、`icon-256.png`
3. 运行 `powershell -File build\build-ico.ps1` 生成 `build\icon.ico`
4. 重新执行 `npm run build:portable`

## 5. 验证打包前的应用

```powershell
npm start
```

这会用本地 Electron 加载 `index.html`,等同于 EXE 内部的体验。便于在打包前调试。

## 6. 验证 XLSX 兼容性

1. 在 Excel 里随便建一个带公式 (VLOOKUP / XLOOKUP / IFS / LAMBDA / FILTER) 的工作簿
2. 保存为 `test.xlsx`
3. 双击 `index.html` (或 `npm start` 后),菜单 `文件` → `打开…`
4. 选 `test.xlsx`,应该完整还原:数据、公式、合并、列宽、字体、底色、边框、数字格式

反向兼容同样:在极致表格里编辑 → `Ctrl+S` 保存为 xlsx → 用 Excel 打开,公式依然工作。

## 7. 已知限制

- **轻量模式**:`1000 行 × 200 列` 是单页最大规模,适合个人/小型团队用例。超过规模后会触发一次性重建警告;更大工作簿可以分多 Sheet 拆分。
- **图表**:基础 4 种 (柱/折/饼/散点) 自绘,Excel 打开后仍是原生图表对象。
- **数据透视**:暂未实现 (HyperFormula 只负责公式引擎)。
- **VBA/宏**:不兼容,这是设计目标 (现代 web 替代方案),不是缺陷。

## 8. 文件清单

```
excel-app/
├── index.html              # 主应用 (~1700 行,HTML+CSS+JS)
├── main.js                 # Electron 主进程
├── preload.js              # Electron preload 桥
├── package.json            # npm + electron-builder 配置
├── LICENSE.txt             # GPL-3.0 EULA
├── 启动极致表格.bat         # 一键启动 (Windows 优先 EXE)
├── lib/
│   ├── hyperformula.min.js # 400+ 公式函数
│   └── xlsx.full.min.js    # xlsx 读写
└── build/
    ├── icon.ico
    ├── icon-{16,32,...}.png
    └── build-ico.ps1
```
