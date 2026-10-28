param(
  [Parameter(Mandatory = $true)][long]$WindowHandle,
  [Parameter(Mandatory = $true)][int]$AppProcessId,
  [Parameter(Mandatory = $true)][ValidateRange(0, 2)][int]$ButtonIndex
)

$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class MelodifyTaskbarTest {
  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool PostMessageW(IntPtr window, uint message, UIntPtr wParam, IntPtr lParam);
}
'@

$ownerId = [uint32]0
[void][MelodifyTaskbarTest]::GetWindowThreadProcessId([IntPtr]$WindowHandle, [ref]$ownerId)
if ($ownerId -ne $AppProcessId) { throw 'Test window does not belong to the expected process.' }
# Electron 30 uses thumbnail IDs 40001..40003. The shell sends WM_COMMAND
# (0x111) with THBN_CLICKED (0x1800) in the high word of wParam.
$notification = [uint32](0x18000000 -bor (40001 + $ButtonIndex))
if (-not [MelodifyTaskbarTest]::PostMessageW([IntPtr]$WindowHandle, 0x111, [UIntPtr]$notification, [IntPtr]::Zero)) {
  throw 'Windows rejected the thumbnail click notification.'
}
