# Publish the SpaceTimeDB chat module (preserves existing messages/rooms).
# Requires: spacetime CLI logged in, Rust wasm32 target.
#
# Install CLI (Windows PowerShell):
#   Invoke-WebRequest -Uri "https://github.com/clockworklabs/SpacetimeDB/releases/latest/download/spacetimedb-update-x86_64-pc-windows-msvc.exe" -OutFile "$env:TEMP\spacetime-install.exe"
#   & "$env:TEMP\spacetime-install.exe" -y
#
# Usage:
#   cd spacetime-chat
#   spacetime version use 2.4.1
#   spacetime build
#   spacetime publish worqs-a8jpe -y

param(
  [string]$DatabaseName = $(if ($env:NEXT_PUBLIC_SPACETIMEDB_NAME) { $env:NEXT_PUBLIC_SPACETIMEDB_NAME } else { "worqs-a8jpe" })
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location (Join-Path $Root "spacetime-chat")

Write-Host "Building SpaceTimeDB module..."
spacetime build

Write-Host "Publishing to database '$DatabaseName' (existing data preserved)..."
spacetime publish $DatabaseName -y

Write-Host "Done. Company group chat now supports ChatMember + ensure_chat_member."
