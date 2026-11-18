# Measures Spotify CPU, RAM and GPU (3D engine) use over N seconds.
param([int]$Seconds = 20)
$procs = Get-Process Spotify -ErrorAction SilentlyContinue
if (-not $procs) { "Spotify not running"; exit 1 }
$ids = $procs.Id
$cpu1 = ($procs | Measure-Object CPU -Sum).Sum
$samples = [math]::Max(1, [int]($Seconds / 2))
$gpu = @()
for ($i = 0; $i -lt $samples; $i++) {
    $c = Get-Counter '\GPU Engine(*engtype_3D)\Utilization Percentage' -ErrorAction SilentlyContinue
    $sum = 0
    foreach ($s in $c.CounterSamples) {
        if ($s.InstanceName -match 'pid_(\d+)_' -and $ids -contains [int]$Matches[1]) { $sum += $s.CookedValue }
    }
    $gpu += $sum
    Start-Sleep -Seconds 2
}
$procs2 = Get-Process Spotify
$cpu2 = ($procs2 | Measure-Object CPU -Sum).Sum
$elapsed = $samples * 2
$cores = [Environment]::ProcessorCount
"CPU: {0:N1}% of whole CPU ({1:N2} cores busy)" -f (($cpu2 - $cpu1) / $elapsed / $cores * 100), (($cpu2 - $cpu1) / $elapsed)
"GPU 3D: {0:N1}% avg" -f (($gpu | Measure-Object -Average).Average)
"RAM: {0} MB" -f [math]::Round(($procs2 | Measure-Object WorkingSet64 -Sum).Sum / 1MB)
