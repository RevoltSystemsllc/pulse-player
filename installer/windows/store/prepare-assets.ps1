# Packaging-only size variants from the existing application icon; no redesign.
[CmdletBinding()]
param([Parameter(Mandatory = $true)][string]$NewOutputDirectory)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
if (Test-Path -LiteralPath $NewOutputDirectory) { throw 'Asset directory must be new.' }
$source = [Drawing.Image]::FromFile((Join-Path $PSScriptRoot '../../../resources/windows/256x256.png'))
try {
    $null = New-Item -ItemType Directory -Path $NewOutputDirectory
    foreach ($entry in @(@('StoreLogo.png', 50), @('Square150x150Logo.png', 150), @('Square44x44Logo.png', 44))) {
        $size = [int]$entry[1]
        $bitmap = New-Object Drawing.Bitmap($size, $size)
        try {
            $graphics = [Drawing.Graphics]::FromImage($bitmap)
            try {
                $graphics.Clear([Drawing.Color]::Transparent)
                $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $graphics.DrawImage($source, 0, 0, $size, $size)
            } finally { $graphics.Dispose() }
            $bitmap.Save((Join-Path $NewOutputDirectory $entry[0]), [Drawing.Imaging.ImageFormat]::Png)
        } finally { $bitmap.Dispose() }
    }
} finally { $source.Dispose() }
