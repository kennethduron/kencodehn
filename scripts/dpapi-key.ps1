param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('Protect', 'Unprotect')]
  [string]$Mode,

  [string]$Value
)

$ErrorActionPreference = 'Stop'
if (-not $Value) {
  $Value = [Console]::In.ReadToEnd().Trim()
}
if (-not $Value) {
  throw 'A base64 value is required.'
}
Add-Type -AssemblyName System.Security
$raw = [Convert]::FromBase64String($Value)
if ($Mode -eq 'Protect') {
  $result = [Security.Cryptography.ProtectedData]::Protect(
    $raw,
    $null,
    [Security.Cryptography.DataProtectionScope]::CurrentUser
  )
} else {
  $result = [Security.Cryptography.ProtectedData]::Unprotect(
    $raw,
    $null,
    [Security.Cryptography.DataProtectionScope]::CurrentUser
  )
}
[Convert]::ToBase64String($result)
