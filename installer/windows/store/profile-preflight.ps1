# Report-only preflight. Run as the same standard Windows user that runs Pulse.
# Do not run while the player is being updated or its profile is being migrated.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$LegacyUserData,
    [Parameter(Mandatory = $true)][string]$PackagedUserData,
    [Parameter(Mandatory = $true)][string]$Library
)
$ErrorActionPreference = 'Stop'

function Get-ProfileInventory([string]$Root) {
    $item = Get-Item -LiteralPath $Root -Force -ErrorAction SilentlyContinue
    if ($null -eq $item) { return [ordered]@{ exists = $false; files = @() } }
    if (-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw 'Profile roots must be real directories, not files or reparse points.'
    }
    # Names and presence only: never read credentials, hardware keys or SQLite.
    $files = foreach ($name in @('config.json', 'cms_config.json', 'rendering-preferences.json', 'playerDb.db', 'playerDb.db-wal', 'playerDb.db-shm')) {
        $file = Get-Item -LiteralPath (Join-Path $Root $name) -Force -ErrorAction SilentlyContinue
        if ($null -ne $file) {
            if ($file.PSIsContainer -or ($file.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
                throw 'Expected profile files must be regular files.'
            }
            [ordered]@{ name = $name; bytes = $file.Length }
        }
    }
    return [ordered]@{ exists = $true; files = @($files) }
}

if (-not [IO.Path]::IsPathRooted($LegacyUserData) -or
    -not [IO.Path]::IsPathRooted($PackagedUserData) -or
    -not [IO.Path]::IsPathRooted($Library)) {
    throw 'Use absolute paths observed from the actual legacy and packaged player; do not guess them.'
}
$legacy = Get-ProfileInventory $LegacyUserData
$packaged = Get-ProfileInventory $PackagedUserData
$libraryItem = Get-Item -LiteralPath $Library -Force -ErrorAction SilentlyContinue
[ordered]@{
    reportOnly = $true
    legacy = $legacy
    packaged = $packaged
    libraryExists = ($null -ne $libraryItem -and $libraryItem.PSIsContainer)
    sameTextualProfilePath = ([IO.Path]::GetFullPath($LegacyUserData).TrimEnd('\') -ieq [IO.Path]::GetFullPath($PackagedUserData).TrimEnd('\'))
    migrationAuthorized = $false
    notes = @(
        'Run from an unpackaged PowerShell session as the playback user.',
        'Matching textual paths do not prove matching MSIX virtualized storage.',
        'This does not test library read/write access or package-local files.',
        'Do not copy live SQLite; stop Pulse and preserve a verified backup first.',
        'Preserve device identity, graphics preferences and enrollment; do not print them.'
    )
} | ConvertTo-Json -Depth 6
