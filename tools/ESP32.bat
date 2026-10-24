@echo off
rem Taling-khlong ESP32 menu (double-click this file or the desktop icon)
chcp 65001 >nul
title Taling ESP32
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0esp32-tool.ps1"
