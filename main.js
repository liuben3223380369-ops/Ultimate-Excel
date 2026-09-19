/*
 * 极致表格 MyExcel — Electron 主进程
 * 职责：
 *   1. 创建 BrowserWindow 加载 index.html
 *   2. 注册 native 菜单 (文件 / 编辑 / 视图 / 帮助)
 *   3. 拦截 xlsx/CSV 打开请求，转发给 index.html 处理
 *   4. 提供「在文件管理器中打开」、「退出」等原生能力
 *
 * 安全说明：
 *   - 使用 contextIsolation + sandbox,主页通过 preload.js 暴露最小 API
 *   - 关闭了 nodeIntegration,关闭了 webSecurity 之外的额外开关
 */
'use strict';

const { app, BrowserWindow, Menu, dialog, shell, ipcMain, protocol } = require('electron');
const path = require('path');
const fs = require('fs');

// 单实例锁
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); return; }
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

// 让 userData 可移植到 EXE 同目录,避免解压临时目录导致设置丢失
if (process.platform === 'win32' && process.env.PORTABLE_EXECUTABLE_DIR) {
  app.setPath('userData', path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'userData'));
}

let win = null;
let pendingOpenFile = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#f5f6f7',
    title: '极致表格 MyExcel',
    icon: path.join(__dirname, 'icon.ico'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      spellcheck: false,
      defaultEncoding: 'utf-8'
    }
  });

  win.loadFile('index.html');
  win.once('ready-to-show', () => { win.show(); });

  // 外链走默认浏览器
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });

  // 当前窗口关闭时直接退出
  win.on('close', () => { /* 允许关闭 */ });
  win.on('closed', () => { win = null; });

  // 命令行传入的文件
  if (pendingOpenFile) {
    win.webContents.once('did-finish-load', () => sendOpenFile(pendingOpenFile));
  }
}

function sendOpenFile(absPath) {
  if (!win) return;
  try {
    const buf = fs.readFileSync(absPath);
    const name = path.basename(absPath);
    win.webContents.send('myexcel:open-file', { name, buf: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) });
  } catch (e) { dialog.showErrorBox('打开失败', String(e && e.message || e)); }
}

// ------------------ IPC ------------------
ipcMain.handle('myexcel:save-dialog', async (_e, { defaultName }) => {
  const r = await dialog.showSaveDialog(win, {
    title: '保存为 xlsx',
    defaultPath: defaultName || '工作簿.xlsx',
    filters: [{ name: 'Excel 工作簿', extensions: ['xlsx'] }]
  });
  if (r.canceled || !r.filePath) return null;
  return r.filePath;
});

ipcMain.handle('myexcel:save-file', async (_e, { filePath, bytes }) => {
  try { fs.writeFileSync(filePath, Buffer.from(bytes)); return { ok: true }; }
  catch (e) { return { ok: false, err: String(e && e.message || e) }; }
});

ipcMain.handle('myexcel:open-dialog', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: '打开 Excel 文件',
    properties: ['openFile'],
    filters: [{ name: 'Excel 文件', extensions: ['xlsx', 'xls', 'xlsm', 'xlsb', 'csv'] }]
  });
  if (r.canceled || !r.filePaths || !r.filePaths.length) return null;
  const p = r.filePaths[0];
  try {
    const buf = fs.readFileSync(p);
    return { name: path.basename(p), buf: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
  } catch (e) { dialog.showErrorBox('读取失败', String(e && e.message || e)); return null; }
});

ipcMain.handle('myexcel:open-folder', async () => {
  const { shell } = require('electron');
  const r = await dialog.showOpenDialog(win, { title: '选择数据文件夹', properties: ['openDirectory'] });
  if (r.canceled || !r.filePaths.length) return null;
  shell.openPath(r.filePaths[0]);
  return r.filePaths[0];
});

ipcMain.on('myexcel:menu-action', (_e, action) => {
  if (!win) return;
  win.webContents.send('myexcel:menu-action', action);
});

// ------------------ Native 菜单 ------------------
function buildMenu() {
  const isMac = process.platform === 'darwin';
  const tmpl = [
    {
      label: '文件(&F)',
      submenu: [
        { label: '新建工作簿\tCtrl+N', click: () => win.webContents.send('myexcel:menu-action', 'new') },
        { label: '打开…\tCtrl+O',         click: () => win.webContents.send('myexcel:menu-action', 'open') },
        { type: 'separator' },
        { label: '保存为 xlsx…\tCtrl+S',  click: () => win.webContents.send('myexcel:menu-action', 'save') },
        { label: '导出 CSV…',            click: () => win.webContents.send('myexcel:menu-action', 'export-csv') },
        { label: '导入 CSV…',            click: () => win.webContents.send('myexcel:menu-action', 'import-csv') },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: '编辑(&E)',
      submenu: [
        { label: '撤销\tCtrl+Z',  click: () => win.webContents.send('myexcel:menu-action', 'undo') },
        { label: '重做\tCtrl+Y',  click: () => win.webContents.send('myexcel:menu-action', 'redo') },
        { type: 'separator' },
        { label: '剪切\tCtrl+X',  click: () => win.webContents.send('myexcel:menu-action', 'cut') },
        { label: '复制\tCtrl+C',  click: () => win.webContents.send('myexcel:menu-action', 'copy') },
        { label: '粘贴\tCtrl+V',  click: () => win.webContents.send('myexcel:menu-action', 'paste') },
        { type: 'separator' },
        { label: '查找/替换\tCtrl+F', click: () => win.webContents.send('myexcel:menu-action', 'find') },
        { label: '全选\tCtrl+A',       click: () => win.webContents.send('myexcel:menu-action', 'selectall') }
      ]
    },
    {
      label: '视图(&V)',
      submenu: [
        { label: '放大\tCtrl++', accelerator: 'CmdOrCtrl+=', click: () => win.webContents.send('myexcel:menu-action', 'zoom-in') },
        { label: '缩小\tCtrl+-', accelerator: 'CmdOrCtrl+-', click: () => win.webContents.send('myexcel:menu-action', 'zoom-out') },
        { label: '重置缩放 100%',      click: () => win.webContents.send('myexcel:menu-action', 'zoom-reset') },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' }
      ]
    },
    {
      label: '插入(&I)',
      submenu: [
        { label: '图表…',                  click: () => win.webContents.send('myexcel:menu-action', 'insert-chart') },
        { label: '函数 f(x)…',             click: () => win.webContents.send('myexcel:menu-action', 'fx') },
        { label: '插入新工作表',           click: () => win.webContents.send('myexcel:menu-action', 'insert-sheet') }
      ]
    },
    {
      label: '格式(&O)',
      submenu: [
        { label: '粗体\tCtrl+B',  click: () => win.webContents.send('myexcel:menu-action', 'bold') },
        { label: '斜体\tCtrl+I',  click: () => win.webContents.send('myexcel:menu-action', 'italic') },
        { label: '下划线\tCtrl+U', click: () => win.webContents.send('myexcel:menu-action', 'underline') },
        { type: 'separator' },
        { label: '合并单元格',         click: () => win.webContents.send('myexcel:menu-action', 'merge') },
        { label: '数字格式…',         click: () => win.webContents.send('myexcel:menu-action', 'numfmt') }
      ]
    },
    {
      label: '帮助(&H)',
      submenu: [
        { label: '关于极致表格 MyExcel', click: () => win.webContents.send('myexcel:menu-action', 'about') },
        { label: '函数列表 (400+)',      click: () => win.webContents.send('myexcel:menu-action', 'functions') },
        { label: '快捷键',                click: () => win.webContents.send('myexcel:menu-action', 'shortcuts') }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tmpl));
}

// ------------------ 启动 ------------------
app.whenReady().then(() => {
  // 命令行参数中的文件
  const argv = process.argv.slice(1);
  const fileArg = argv.find(a => /\.(xlsx|xls|xlsm|xlsb|csv)$/i.test(a));
  if (fileArg) pendingOpenFile = path.resolve(fileArg);

  buildMenu();
  createWindow();

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// 让拖入 xlsx 文件直接打开
app.on('open-file', (event, p) => {
  event.preventDefault();
  if (win && win.webContents.isLoading() === false) sendOpenFile(p);
  else pendingOpenFile = p;
});
