# Build only. Does not install, enable developer mode or modify certificate trust.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$AppDirectory,
    [Parameter(Mandatory = $true)][string]$AssetsDirectory,
    [Parameter(Mandatory = $true)][string]$NewOutputDirectory,
    [Parameter(Mandatory = $true)][string]$MakeAppx
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if ($env:OS -ne 'Windows_NT') { throw 'Build on an isolated Windows build machine.' }
if (Test-Path -LiteralPath $NewOutputDirectory) { throw 'Lab output must not already exist.' }
$output = [IO.Path]::GetFullPath($NewOutputDirectory)
$null = New-Item -ItemType Directory -Path $output
$identityPath = Join-Path $output 'lab-identity.json'
& node (Join-Path $PSScriptRoot 'lab-identity.cjs') $identityPath
if ($LASTEXITCODE -ne 0) { throw 'Failed to generate separate lab identity.' }
& (Join-Path $PSScriptRoot 'build-msix.ps1') -AppDirectory $AppDirectory `
    -IdentityJson $identityPath -AssetsDirectory $AssetsDirectory `
    -NewOutputDirectory (Join-Path $output 'candidate') -MakeAppx $MakeAppx
$candidate = Join-Path $output 'candidate'
Move-Item -LiteralPath (Join-Path $candidate 'PulsePlayer-UNSIGNED-StoreCandidate.msix') `
    -Destination (Join-Path $output 'PulsePlayer-LAB-ONLY-Windows11.msix')
$report = Get-Content -LiteralPath (Join-Path $candidate 'build-report.json') -Raw | ConvertFrom-Json
$report.file = 'PulsePlayer-LAB-ONLY-Windows11.msix'
$report | Add-Member -NotePropertyName labOnly -NotePropertyValue $true
$report | Add-Member -NotePropertyName storeSubmissionAllowed -NotePropertyValue $false
$report | Add-Member -NotePropertyName sourceCommit -NotePropertyValue $env:GITHUB_SHA
$report | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $output 'lab-build-report.json') -Encoding UTF8
Write-Host 'LAB ONLY: separate identity. Not Store certification, production installation or profile migration.'
