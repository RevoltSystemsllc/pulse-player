param(
    [Parameter(Mandatory=$true)][ValidateRange(1,2147483647)][int]$PlayerProcessId,
    [Parameter(Mandatory=$true)][string]$ExpectedExecutable
)
$ErrorActionPreference='Stop'
if ($env:OS -ne 'Windows_NT' -or $env:GITHUB_ACTIONS -ne 'true') {
    throw 'Disposable Windows CI runner only; not an installed-package qualification.'
}
$player=Get-Process -Id $PlayerProcessId -ErrorAction Stop
$expected=(Resolve-Path -LiteralPath $ExpectedExecutable).Path
if (!$player.Path -or ![String]::Equals($player.Path,$expected,[StringComparison]::OrdinalIgnoreCase)) {
    throw 'Player process does not match the candidate executable.'
}
if ($player.MainWindowHandle -eq [IntPtr]::Zero) { throw 'Candidate has no visible main window.' }
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class PulseCiDpi {
    [DllImport("user32.dll")]
    public static extern IntPtr GetWindowDpiAwarenessContext(IntPtr hwnd);
    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool AreDpiAwarenessContextsEqual(IntPtr a, IntPtr b);
    [DllImport("user32.dll")]
    public static extern uint GetDpiForWindow(IntPtr hwnd);
}
'@
$context=[PulseCiDpi]::GetWindowDpiAwarenessContext($player.MainWindowHandle)
$v2=[PulseCiDpi]::AreDpiAwarenessContextsEqual($context,[IntPtr](-4))
$dpi=[PulseCiDpi]::GetDpiForWindow($player.MainWindowHandle)
if ($context -eq [IntPtr]::Zero -or !$v2 -or $dpi -eq 0) {
    throw 'Actual candidate window is not PerMonitorV2 with a valid window DPI.'
}
@{perMonitorV2=$v2;windowDpi=$dpi;settingsChanged=$false;installedMsix=$false;wackPassed=$false} | ConvertTo-Json
