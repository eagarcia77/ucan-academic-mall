$ErrorActionPreference = "Stop"
$version = Invoke-RestMethod "http://localhost:3011/version"
$health = Invoke-RestMethod "http://localhost:3011/health"
$options = Invoke-RestMethod "http://localhost:3011/api/auth/options"
$version | ConvertTo-Json -Depth 6
$health.accounts | ConvertTo-Json -Depth 6
$options.avatarOptions | ConvertTo-Json -Depth 6
