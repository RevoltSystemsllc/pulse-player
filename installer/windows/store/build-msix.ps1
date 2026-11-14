# Build-only wrapper: never installs, signs, changes trust, or submits a package.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$AppDirectory,
    [Parameter(Mandatory = $true)][string]$IdentityJson,
    [Parameter(Mandatory = $true)][string]$AssetsDirectory,
    [Parameter(Mandatory = $true)][string]$NewOutputDirectory,
    [Parameter(Mandatory = $true)][string]$MakeAppx
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if ($env:OS -ne 'Windows_NT') { throw 'Run this build step on an isolated Windows build machine.' }
foreach ($inputPath in @($AppDirectory, $IdentityJson, $AssetsDirectory, $MakeAppx)) {
    if (-not (Test-Path -LiteralPath $inputPath)) { throw "Missing input: $inputPath" }
}
if (Test-Path -LiteralPath $NewOutputDirectory) { throw 'Output directory must not already exist.' }
$tool = Get-Item -LiteralPath $MakeAppx
if ($tool.Name -ine 'makeappx.exe' -or $tool.PSIsContainer) { throw 'Supply the Windows SDK MakeAppx.exe.' }
$signature = Get-AuthenticodeSignature -LiteralPath $tool.FullName
if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'O=Microsoft Corporation(?:,|$)') {
    throw 'MakeAppx must have a valid Microsoft signature.'
}
$output = [IO.Path]::GetFullPath($NewOutputDirectory)
$null = New-Item -ItemType Directory -Path $output
$staging = Join-Path $output 'staging'
& node (Join-Path $PSScriptRoot 'prepare.cjs') $AppDirectory $IdentityJson $AssetsDirectory $staging
if ($LASTEXITCODE -ne 0) { throw 'Staging failed; no package was created.' }
$package = Join-Path $output 'PulsePlayer-UNSIGNED-StoreCandidate.msix'
# /no prevents overwriting. Omitting /nv keeps SDK semantic validation enabled.
& $tool.FullName pack /d $staging /p $package /h SHA256 /no
if ($LASTEXITCODE -ne 0) { throw 'MakeAppx validation/pack failed. Do not submit any partial artifact.' }
$hash = (Get-FileHash -LiteralPath $package -Algorithm SHA256).Hash.ToLowerInvariant()
[ordered]@{
    candidateOnly = $true
    file = [IO.Path]::GetFileName($package)
    sha256 = $hash
    bytes = (Get-Item -LiteralPath $package).Length
    sdk = $tool.VersionInfo.FileVersion
    sdkSemanticValidationPassed = $true
    certificationPassed = $false
    installed = $false
    submitted = $false
} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $output 'build-report.json') -Encoding UTF8
Write-Host 'Unsigned candidate created. WACK, real-device qualification and owner-approved Store submission remain required.'
