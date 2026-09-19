@echo off
title 极致表格 MyExcel  ·  启动器
chcp 65001 > nul
setlocal

rem ============================================================
rem  启动优先级
rem    1. dist\ 下的 单文件 EXE     (极致表格-MyExcel-*-portable.exe)
rem    2. Electron 本地开发模式     (npm start / npx electron .)
rem    3. Edge/Chrome --app 模式  (HTML 桌面体验)
rem    4. 默认浏览器打开            (兜底)
rem ============================================================

set "ROOT=%~dp0"
cd /d "%ROOT%"

rem ---- 1. 查找已打包的单文件 EXE ----
set "EXE="
for %%f in ("%ROOT%dist\极致表格-MyExcel-*-portable.exe") do (
  if not "%%~ff" == "" (
    set "EXE=%%~ff"
    goto :runExe
  )
)

rem ---- 2. Electron 本地开发 ----
if exist "%ROOT%node_modules\electron\dist\electron.exe" (
  echo [启动器] 使用本地 Electron 开发模式 (npm start) ...
  start "" "%ROOT%node_modules\.bin\electron.cmd" "%ROOT%"
  goto :eof
)
where electron.cmd >nul 2>&1 && (
  echo [启动器] 使用全局 Electron ...
  start "" electron "%ROOT%"
  goto :eof
)

rem ---- 3. Edge/Chrome 应用模式 (HTML 桌面体验) ----
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app="file:///%ROOT:~0,-1%index.html" --window-size=1440,900 --user-data-dir="%LOCALAPPDATA%\MyExcel" --disable-features=Translate --no-first-run
  goto :eof
)
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app="file:///%ROOT:~0,-1%index.html" --window-size=1440,900 --user-data-dir="%LOCALAPPDATA%\MyExcel" --disable-features=Translate --no-first-run
  goto :eof
)

rem ---- 4. 兜底用默认浏览器打开 ----
echo [启动器] 未检测到 Edge,使用默认浏览器打开 index.html
start "" "%ROOT%index.html"
goto :eof

:runExe
echo [启动器] 启动打包后的 EXE: %EXE%
start "" "%EXE%"
goto :eof
