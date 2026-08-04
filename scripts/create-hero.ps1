param(
    [string]$EvidenceDirectory = (Join-Path $PSScriptRoot '..\evidence'),
    [string]$OutputPath = (Join-Path $PSScriptRoot '..\evidence\hero-comparison.png')
)

Add-Type -AssemblyName System.Drawing

$canvasWidth = 1920
$canvasHeight = 1200
$margin = 28
$gap = 20
$tileWidth = [int](($canvasWidth - ($margin * 2) - $gap) / 2)
$tileHeight = [int](($canvasHeight - ($margin * 2) - $gap) / 2)
$items = @(
    @{ Id = 'R1'; Path = 'capture-R1-desktop.png' },
    @{ Id = 'R2'; Path = 'capture-R2-desktop.png' },
    @{ Id = 'R3'; Path = 'capture-R3-desktop.png' },
    @{ Id = 'R4'; Path = 'capture-R4-desktop.png' }
)

$bitmap = [System.Drawing.Bitmap]::new($canvasWidth, $canvasHeight)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#070B14'))
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

$borderPen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#334155'), 2)
$labelBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#050810'))
$textBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
$font = [System.Drawing.Font]::new('Segoe UI', 22, [System.Drawing.FontStyle]::Bold)

try {
    for ($index = 0; $index -lt $items.Count; $index++) {
        $column = $index % 2
        $row = [math]::Floor($index / 2)
        $x = $margin + ($column * ($tileWidth + $gap))
        $y = $margin + ($row * ($tileHeight + $gap))
        $path = Join-Path $EvidenceDirectory $items[$index].Path
        $image = [System.Drawing.Image]::FromFile($path)

        try {
            $scale = [math]::Min($tileWidth / $image.Width, $tileHeight / $image.Height)
            $drawWidth = [int]($image.Width * $scale)
            $drawHeight = [int]($image.Height * $scale)
            $drawX = $x + [int](($tileWidth - $drawWidth) / 2)
            $drawY = $y + [int](($tileHeight - $drawHeight) / 2)

            $graphics.FillRectangle([System.Drawing.Brushes]::Black, $x, $y, $tileWidth, $tileHeight)
            $graphics.DrawImage($image, $drawX, $drawY, $drawWidth, $drawHeight)
            $graphics.DrawRectangle($borderPen, $x, $y, $tileWidth, $tileHeight)
            $graphics.FillRectangle($labelBrush, $x + 14, $y + 14, 74, 46)
            $graphics.DrawString($items[$index].Id, $font, $textBrush, $x + 24, $y + 18)
        }
        finally {
            $image.Dispose()
        }
    }

    $outputDirectory = Split-Path $OutputPath -Parent
    if (-not (Test-Path $outputDirectory)) {
        New-Item -ItemType Directory -Path $outputDirectory | Out-Null
    }
    $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
}
finally {
    $font.Dispose()
    $textBrush.Dispose()
    $labelBrush.Dispose()
    $borderPen.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}

Write-Output $OutputPath
