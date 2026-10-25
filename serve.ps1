$root = "d:\waste proeject\public\image-compressor"
$port = 8080
$url  = "http://localhost:$port/"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($url)
$listener.Start()
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Server running at: $url" -ForegroundColor Green
Write-Host "  Press Ctrl+C to stop." -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan

Start-Process $url

while ($listener.IsListening) {
    $ctx  = $listener.GetContext()
    $req  = $ctx.Request
    $res  = $ctx.Response

    $urlPath = $req.Url.LocalPath
    if ($urlPath -eq "/" -or $urlPath -eq "") { $urlPath = "/index.html" }

    $filePath = Join-Path $root $urlPath.TrimStart("/")

    if (Test-Path $filePath -PathType Leaf) {
        $ext  = [System.IO.Path]::GetExtension($filePath).ToLower()
        $mime = switch ($ext) {
            ".html" { "text/html; charset=utf-8" }
            ".css"  { "text/css" }
            ".js"   { "application/javascript" }
            ".xml"  { "application/xml; charset=utf-8" }
            ".txt"  { "text/plain; charset=utf-8" }
            ".png"  { "image/png" }
            ".jpg"  { "image/jpeg" }
            ".jpeg" { "image/jpeg" }
            ".webp" { "image/webp" }
            ".gif"  { "image/gif" }
            ".svg"  { "image/svg+xml" }
            ".ico"  { "image/x-icon" }
            default { "application/octet-stream" }
        }
        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        $res.ContentType     = $mime
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $res.StatusCode = 404
        $msg = [System.Text.Encoding]::UTF8.GetBytes("404 - Not Found")
        $res.ContentType     = "text/plain"
        $res.ContentLength64 = $msg.Length
        $res.OutputStream.Write($msg, 0, $msg.Length)
    }
    $res.OutputStream.Close()
}
