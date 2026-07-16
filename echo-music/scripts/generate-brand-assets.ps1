Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$build = Join-Path $root 'build'

function New-RoundedRectPath([float]$x, [float]$y, [float]$w, [float]$h, [float]$radius) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $radius * 2
  $path.AddArc($x, $y, $diameter, $diameter, 180, 90)
  $path.AddArc($x + $w - $diameter, $y, $diameter, $diameter, 270, 90)
  $path.AddArc($x + $w - $diameter, $y + $h - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($x, $y + $h - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-EchoBitmap([int]$size) {
  $bitmap = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $scale = $size / 128.0

  $path = New-RoundedRectPath (2 * $scale) (2 * $scale) (124 * $scale) (124 * $scale) (19 * $scale)
  $background = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#08090b'))
  $graphics.FillPath($background, $path)

  $mint = [System.Drawing.ColorTranslator]::FromHtml('#38e0c1')
  $text = [System.Drawing.ColorTranslator]::FromHtml('#eef1f3')
  $amber = [System.Drawing.ColorTranslator]::FromHtml('#f2b84b')
  $penOuter = New-Object System.Drawing.Pen $mint, (7 * $scale)
  $penMid = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(158, $mint)), (5 * $scale)
  $penInner = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(230, $text)), (4 * $scale)
  $penSignal = New-Object System.Drawing.Pen $text, (5 * $scale)
  $penSignal.StartCap = $penSignal.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $amberBrush = New-Object System.Drawing.SolidBrush $amber

  $graphics.DrawEllipse($penOuter, 23 * $scale, 29 * $scale, 70 * $scale, 70 * $scale)
  $graphics.DrawEllipse($penMid, 36 * $scale, 42 * $scale, 44 * $scale, 44 * $scale)
  $graphics.DrawEllipse($penInner, 48 * $scale, 54 * $scale, 20 * $scale, 20 * $scale)
  $graphics.DrawLine($penSignal, 77 * $scale, 64 * $scale, 106 * $scale, 64 * $scale)
  $graphics.FillEllipse($amberBrush, 99 * $scale, 58 * $scale, 12 * $scale, 12 * $scale)

  $background.Dispose(); $path.Dispose(); $penOuter.Dispose(); $penMid.Dispose()
  $penInner.Dispose(); $penSignal.Dispose(); $amberBrush.Dispose(); $graphics.Dispose()
  return $bitmap
}

function Convert-BitmapToPngBytes([System.Drawing.Bitmap]$bitmap) {
  $stream = New-Object System.IO.MemoryStream
  $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  $bytes = $stream.ToArray()
  $stream.Dispose()
  return $bytes
}

function Write-EchoIcon([string]$path) {
  $sizes = @(16, 24, 32, 48, 64, 128, 256)
  $images = @()
  foreach ($size in $sizes) {
    $bitmap = New-EchoBitmap $size
    $images += ,(Convert-BitmapToPngBytes $bitmap)
    $bitmap.Dispose()
  }

  $stream = [System.IO.File]::Create($path)
  $writer = New-Object System.IO.BinaryWriter $stream
  $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$sizes.Count)
  $offset = 6 + (16 * $sizes.Count)
  for ($i = 0; $i -lt $sizes.Count; $i++) {
    $sizeByte = if ($sizes[$i] -eq 256) { 0 } else { $sizes[$i] }
    $writer.Write([byte]$sizeByte); $writer.Write([byte]$sizeByte)
    $writer.Write([byte]0); $writer.Write([byte]0)
    $writer.Write([uint16]1); $writer.Write([uint16]32)
    $writer.Write([uint32]$images[$i].Length); $writer.Write([uint32]$offset)
    $offset += $images[$i].Length
  }
  foreach ($image in $images) { $writer.Write([byte[]]$image) }
  $writer.Dispose(); $stream.Dispose()
}

function New-InstallerBitmap([int]$width, [int]$height) {
  $bitmap = New-Object System.Drawing.Bitmap $width, $height, ([System.Drawing.Imaging.PixelFormat]::Format32bppRgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
  $graphics.Clear([System.Drawing.Color]::White)
  return @($bitmap, $graphics)
}

$icon = New-EchoBitmap 512
$icon.Save((Join-Path $build 'icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$icon.Dispose()
Write-EchoIcon (Join-Path $build 'icon.ico')

$header = New-InstallerBitmap 150 57
$hb = $header[0]; $hg = $header[1]
$mintBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#38e0c1'))
$amberBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#f2b84b'))
$inkBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#111217'))
$mutedBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#6b7280'))
$titleFont = New-Object System.Drawing.Font 'Microsoft YaHei UI', 10, ([System.Drawing.FontStyle]::Bold)
$smallFont = New-Object System.Drawing.Font 'Microsoft YaHei UI', 6
$hg.FillRectangle($mintBrush, 13, 13, 2, 31)
$hg.FillEllipse($amberBrush, 123, 23, 10, 10)
$hg.DrawString('Echo Music', $titleFont, $inkBrush, 24, 10)
$hg.DrawString('Setup Wizard', $smallFont, $mutedBrush, 25, 34)
$hg.Dispose(); $hb.Save((Join-Path $build 'installerHeader.bmp'), [System.Drawing.Imaging.ImageFormat]::Bmp); $hb.Dispose()

$side = New-InstallerBitmap 164 314
$sb = $side[0]; $sg = $side[1]
$brandFont = New-Object System.Drawing.Font 'Microsoft YaHei UI', 6, ([System.Drawing.FontStyle]::Bold)
$heroFont = New-Object System.Drawing.Font 'Microsoft YaHei UI', 19, ([System.Drawing.FontStyle]::Bold)
$bodyFont = New-Object System.Drawing.Font 'Microsoft YaHei UI', 7
$sideTitleFont = New-Object System.Drawing.Font 'Microsoft YaHei UI', 7, ([System.Drawing.FontStyle]::Bold)
$linePen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#dfe3e7')), 1
$mintPen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#38e0c1')), 3
$inkPen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#111217')), 3
$sg.FillRectangle($mintBrush, 21, 35, 2, 31)
$sg.DrawString('ECHO MUSIC', $brandFont, $mintBrush, 35, 34)
$sg.DrawString('MUSIC', $heroFont, $inkBrush, 34, 58)
$sg.DrawString('SIGNAL AND LYRICS', $bodyFont, $mutedBrush, 35, 98)
$sg.DrawLine($linePen, 24, 146, 142, 146)
$sg.DrawLine($mintPen, 33, 178, 77, 178)
$sg.DrawLine($inkPen, 33, 192, 109, 192)
$sg.FillEllipse($amberBrush, 110, 189, 6, 6)
$sg.DrawString('INSTALL', $sideTitleFont, $inkBrush, 34, 238)
$sg.DrawString('D:\EchoMusic', $bodyFont, $mutedBrush, 34, 258)
$sg.Dispose(); $sb.Save((Join-Path $build 'installerSidebar.bmp'), [System.Drawing.Imaging.ImageFormat]::Bmp); $sb.Dispose()

$mintBrush.Dispose(); $amberBrush.Dispose(); $inkBrush.Dispose(); $mutedBrush.Dispose()
$titleFont.Dispose(); $smallFont.Dispose(); $brandFont.Dispose(); $heroFont.Dispose(); $bodyFont.Dispose(); $sideTitleFont.Dispose()
$linePen.Dispose(); $mintPen.Dispose(); $inkPen.Dispose()

Write-Host 'Echo Music brand assets generated.'
