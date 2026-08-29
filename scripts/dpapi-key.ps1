param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('Protect', 'Unprotect')]
  [string]$Mode,

  [Parameter(Mandatory = $true)]
  [string]$Value
)

$ErrorActionPreference = 'Stop'
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
