param([switch]$Remove, [switch]$NoApply)
# Installs (or with -Remove, removes) the Focus Mode startup cover in the active
# Spicetify theme's user.css, between the focus-cover markers. Safe to run again.
$ErrorActionPreference = "Stop"
$spicetify = "$env:LOCALAPPDATA\spicetify\spicetify.exe"
$config = "$env:APPDATA\spicetify\config-xpui.ini"
$theme = ((Get-Content $config) | Where-Object { $_ -match '^\s*current_theme\s*=' } | Select-Object -First 1) -replace '^\s*current_theme\s*=\s*', ''
$theme = $theme.Trim()
if (-not $theme) { throw "No current_theme in $config" }
$dir = "$env:APPDATA\spicetify\Themes\$theme"
if (-not (Test-Path $dir)) { throw "Theme folder not found: $dir" }
$userCss = Join-Path $dir "user.css"
$existing = if (Test-Path $userCss) { [IO.File]::ReadAllText($userCss) } else { "" }
$pattern = '(?s)\r?\n?/\* focus-cover:start \*/.*?/\* focus-cover:end \*/\r?\n?'
$clean = [regex]::Replace($existing, $pattern, "`n").TrimEnd()
if ($Remove) {
  $out = $clean
} else {
  $block = [IO.File]::ReadAllText((Join-Path $PSScriptRoot "focus-cover.css")).Trim()
  $out = if ($clean) { "$clean`n`n$block" } else { $block }
}
[IO.File]::WriteAllText($userCss, "$out`n", (New-Object Text.UTF8Encoding $false))
& $spicetify config inject_css 1 | Out-Null
if (-not $NoApply) { & $spicetify apply | Out-Null }
$count = ([regex]::Matches($out, 'focus-cover:start')).Count
"theme=$theme user.css=$userCss cover blocks=$count"
