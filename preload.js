/*
 * 极致表格 MyExcel — Preload 桥
 *
 * 只暴露必要的、经过宿主审批的 API 给渲染进程。
 * 不暴露 Node.js 全局,避免安全风险。
 */
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('myexcel', {
  /** 弹窗选择保存路径,返回完整路径或 null */
  saveDialog: (defaultName) => ipcRenderer.invoke('myexcel:save-dialog', { defaultName }),

  /** 把 Uint8Array 写入已选定的文件路径 */
  saveToFile: (filePath, bytes) => ipcRenderer.invoke('myexcel:save-file', { filePath, bytes }),

  /** 弹窗选择本地 xlsx/csv 并读取为字节数组 */
  openDialog: () => ipcRenderer.invoke('myexcel:open-dialog'),

  /** 选择文件夹并用资源管理器打开 */
  openFolder: () => ipcRenderer.invoke('myexcel:open-folder'),

  /** 启动后或拖放 / 命令行 传进来的待打开文件 */
  onOpenFile: (cb) => ipcRenderer.on('myexcel:open-file', (_e, payload) => cb(payload)),

  /** 主进程菜单触发的动作 ('new'|'open'|'save'|...) */
  onMenuAction: (cb) => ipcRenderer.on('myexcel:menu-action', (_e, action) => cb(action)),

  /** 平台信息 */
  platform: process.platform
});
