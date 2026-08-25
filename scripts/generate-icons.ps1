$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$workspacePath = Split-Path -Parent $PSScriptRoot
$iconsPath = Join-Path $workspacePath "icons"
New-Item -ItemType Directory -Force -Path $iconsPath | Out-Null

function New-RoundedRectanglePath {
  param(
    [System.Drawing.RectangleF]$Bounds,
    [float]$Radius
  )

  $diameter = $Radius * 2
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $path.AddArc($Bounds.X, $Bounds.Y, $diameter, $diameter, 180, 90)
  $path.AddArc($Bounds.Right - $diameter, $Bounds.Y, $diameter, $diameter, 270, 90)
  $path.AddArc($Bounds.Right - $diameter, $Bounds.Bottom - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($Bounds.X, $Bounds.Bottom - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

foreach ($size in @(16, 32, 48, 128)) {
  $bitmap = [System.Drawing.Bitmap]::new($size, $size)
  $bitmap.SetResolution(96, 96)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $padding = [Math]::Max(1, [Math]::Round($size * 0.06))
  $bounds = [System.Drawing.RectangleF]::new($padding, $padding, $size - (2 * $padding), $size - (2 * $padding))
  $path = New-RoundedRectanglePath -Bounds $bounds -Radius ([Math]::Max(2, $size * 0.2))
  $background = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 23, 32, 29))
  $graphics.FillPath($background, $path)

  $barColor = [System.Drawing.Color]::FromArgb(255, 118, 210, 175)
  $barBrush = [System.Drawing.SolidBrush]::new($barColor)
  $barWidth = [Math]::Max(1.4, $size * 0.075)
  $gap = $size * 0.055
  $heights = @(
    ($size * 0.24),
    ($size * 0.49),
    ($size * 0.34),
    ($size * 0.61)
  )
  $totalWidth = (4 * $barWidth) + (3 * $gap)
  $startX = ($size - $totalWidth) / 2
  for ($index = 0; $index -lt 4; $index++) {
    $barHeight = $heights[$index]
    $barBounds = [System.Drawing.RectangleF]::new(
      $startX + ($index * ($barWidth + $gap)),
      ($size - $barHeight) / 2,
      $barWidth,
      $barHeight
    )
    $barPath = New-RoundedRectanglePath -Bounds $barBounds -Radius ($barWidth / 2)
    $graphics.FillPath($barBrush, $barPath)
    $barPath.Dispose()
  }

  $outputPath = Join-Path $iconsPath "icon-$size.png"
  $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

  $barBrush.Dispose()
  $background.Dispose()
  $path.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

Write-Output "AudioRoute icons generated under $iconsPath."
