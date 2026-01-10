# Load all environment variables from .env file
Get-Content .env | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        [Environment]::SetEnvironmentVariable($key, $value, "Process")
        Write-Host "Set $key"
    }
}

Write-Host "`nEnvironment variables loaded. Starting dev server...`n"

# Start the dev server
pnpm dev
