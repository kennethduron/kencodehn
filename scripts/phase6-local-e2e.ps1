param(
  [string[]]$Suite = @("test:m2b:local", "test:phase2:local", "test:phase3:local", "test:phase4:local", "test:phase5:local")
)

$ErrorActionPreference = "Stop"

$ErrorActionPreference = "SilentlyContinue"
$statusLines = & npx.cmd supabase status -o env 2>$null
$ErrorActionPreference = "Stop"
if ($LASTEXITCODE -ne 0) { throw "Local Supabase status failed." }

$values = @{}
foreach ($line in $statusLines) {
  if ($line -match '^([A-Z0-9_]+)="?(.*?)"?$') {
    $values[$matches[1]] = $matches[2]
  }
}

$localUrl = $values["API_URL"]
$publishable = if ($values["PUBLISHABLE_KEY"]) { $values["PUBLISHABLE_KEY"] } else { $values["ANON_KEY"] }
$secret = if ($values["SECRET_KEY"]) { $values["SECRET_KEY"] } else { $values["SERVICE_ROLE_KEY"] }
if (-not $localUrl -or -not $publishable -or -not $secret) { throw "Required local Supabase values are unavailable." }
$uri = [Uri]$localUrl
if ($uri.Host -notin @("127.0.0.1", "localhost")) { throw "Phase 6 E2E refuses non-loopback services." }

$env:SUPABASE_LOCAL_URL = $localUrl
$env:SUPABASE_LOCAL_PUBLISHABLE_KEY = $publishable
$env:SUPABASE_LOCAL_SERVICE_KEY = $secret
$env:SUPABASE_LOCAL_MAILPIT_URL = $values["MAILPIT_URL"]

foreach ($suite in $Suite) {
  $ErrorActionPreference = "SilentlyContinue"
  & npx.cmd supabase db reset --local --no-seed *> $null
  $resetCode = $LASTEXITCODE
  $ErrorActionPreference = "Stop"
  if ($resetCode -ne 0) { throw "Local reset failed before: $suite" }
  & npm.cmd run $suite
  if ($LASTEXITCODE -ne 0) { throw "Local suite failed: $suite" }
}

$completed = $Suite -join ","
Write-Output "{`"target`":`"loopback-only`",`"completedSuites`":`"$completed`",`"status`":`"PASS`",`"externalEmail`":0,`"externalPush`":0,`"manualCron`":false}"
