# Pulls the latest Spicy Lyrics changes into Simplify, then tests and rebuilds.
# Stops on a merge conflict so it can be resolved by hand. Run from the repo root.
$ErrorActionPreference = "Stop"
git fetch upstream
git merge --no-edit upstream/main
if ($LASTEXITCODE -ne 0) { throw "Merge conflict: resolve it, then run 'bun test src/utils' and 'bun run build'." }
bun test src/utils
if ($LASTEXITCODE -ne 0) { throw "Tests failed after merging." }
bun run build
if ($LASTEXITCODE -ne 0) { throw "Build failed after merging." }
Copy-Item dist\simplify.js builds\simplify.js -Force
"Merged upstream, tests pass, builds\simplify.js updated. Review the changes, then commit and push."
