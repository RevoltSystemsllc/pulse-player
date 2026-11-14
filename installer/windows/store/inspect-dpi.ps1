param(
    [Parameter(Mandatory=$true)]
    [ValidateRange(1,2147483647)]
    [int]$PlayerProcessId
)
$ErrorActionPreference='Stop'
if ($env:OS -ne 'Windows_NT') { throw 'Windows-only, read-only diagnostic.' }
$player=Get-Process -Id $PlayerProcessId -ErrorAction Stop
$package=@(Get-AppxPackage | Where-Object {
    $_.Name -in @('PulseDigitalCMS.PulseDigitalCMSPlayer','PulseDigitalCMS.PulseDigitalCMSPlayer.Lab') -and
    $_.Status -eq 'Ok' -and $player.Path -and
    $player.Path.StartsWith($_.InstallLocation+'\',[StringComparison]::OrdinalIgnoreCase)
})
if ($package.Count -ne 1) { throw 'PID is not an installed Pulse Store/lab package for this user.' }
if ($player.MainWindowHandle -eq [IntPtr]::Zero) {
    throw 'No main window is visible to this session. Run as the interactive playback user.'
}
if (-not ('PulseReadOnlyDpi' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class PulseReadOnlyDpi {
    [DllImport("user32.dll")]
    public static extern IntPtr GetWindowDpiAwarenessContext(IntPtr hwnd);
    [DllImport("user32.dll")]
    public static extern int GetAwarenessFromDpiAwarenessContext(IntPtr context);
    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool AreDpiAwarenessContextsEqual(IntPtr first, IntPtr second);
    [DllImport("user32.dll")]
    public static extern uint GetDpiForWindow(IntPtr hwnd);
}
'@
}
$context=[PulseReadOnlyDpi]::GetWindowDpiAwarenessContext($player.MainWindowHandle)
if ($context -eq [IntPtr]::Zero) { throw 'Windows did not return a valid window DPI context.' }
$awareness=[PulseReadOnlyDpi]::GetAwarenessFromDpiAwarenessContext($context)
if ($awareness -lt 0 -or $awareness -gt 2) { throw 'Windows returned an invalid DPI awareness value.' }
$dpi=[PulseReadOnlyDpi]::GetDpiForWindow($player.MainWindowHandle)
if ($dpi -eq 0) { throw 'Windows could not query the window DPI.' }
$labels=@('Unaware','SystemAware','PerMonitorAware')
[ordered]@{
    packageName=$package[0].Name
    packageVersion=$package[0].Version.ToString()
    processId=$player.Id
    awareness=$labels[$awareness]
    perMonitorV2=[PulseReadOnlyDpi]::AreDpiAwarenessContextsEqual($context,[IntPtr](-4))
    windowDpi=$dpi
    perMonitorAware=($awareness -eq 2)
    settingsChanged=$false
    wackPassed=$false
    scope='Current installed package/window only. Not varied-monitor scaling, WACK or Store certification qualification.'
} | ConvertTo-Json
