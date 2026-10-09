import AppKit

func createTrayIcon(size: CGFloat, isRetina: Bool) -> Data? {
    let dim = isRetina ? size * 2 : size
    let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: Int(dim),
        pixelsHigh: Int(dim),
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .calibratedRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    )!
    
    NSGraphicsContext.saveGraphicsState()
    let context = NSGraphicsContext(bitmapImageRep: rep)!
    NSGraphicsContext.current = context
    let cg = context.cgContext
    
    // Clear to 100% transparent
    cg.clear(CGRect(x: 0, y: 0, width: dim, height: dim))
    
    let scale = dim / 22.0
    cg.scaleBy(x: scale, y: scale)
    
    // Coordinates in 22x22 space:
    // Base husk leaves (Fresh Emerald)
    let leafPath = CGMutablePath()
    leafPath.move(to: CGPoint(x: 7.5, y: 5.5))
    leafPath.addCurve(to: CGPoint(x: 11, y: 3), control1: CGPoint(x: 7.5, y: 3), control2: CGPoint(x: 9.5, y: 3))
    leafPath.addCurve(to: CGPoint(x: 14.5, y: 5.5), control1: CGPoint(x: 12.5, y: 3), control2: CGPoint(x: 14.5, y: 3))
    leafPath.addCurve(to: CGPoint(x: 11, y: 4.5), control1: CGPoint(x: 13.5, y: 4.5), control2: CGPoint(x: 12, y: 4.5))
    leafPath.closeSubpath()
    
    cg.setFillColor(CGColor(red: 0.06, green: 0.73, blue: 0.51, alpha: 1.0)) // #10b981
    cg.addPath(leafPath)
    cg.fillPath()
    
    // Corn Cob Body (Vibrant Golden Amber)
    let cobRect = CGRect(x: 5.5, y: 4.5, width: 11, height: 14.5)
    let cobPath = CGPath(roundedRect: cobRect, cornerWidth: 5.5, cornerHeight: 6.5, transform: nil)
    
    // Amber gradient: #fbbf24 to #f59e0b
    let colors = [
        CGColor(red: 0.98, green: 0.75, blue: 0.14, alpha: 1.0),
        CGColor(red: 0.96, green: 0.62, blue: 0.04, alpha: 1.0)
    ] as CFArray
    let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0.0, 1.0])!
    
    cg.saveGState()
    cg.addPath(cobPath)
    cg.clip()
    cg.drawLinearGradient(gradient, start: CGPoint(x: 11, y: 19), end: CGPoint(x: 11, y: 4.5), options: [])
    cg.restoreGState()
    
    // Subtle border for crisp definition on all backgrounds
    cg.setStrokeColor(CGColor(red: 0.1, green: 0.1, blue: 0.1, alpha: 0.25))
    cg.setLineWidth(0.6)
    cg.addPath(cobPath)
    cg.strokePath()
    
    // Kernel Texture lines (soft golden highlight)
    cg.setStrokeColor(CGColor(red: 1.0, green: 1.0, blue: 1.0, alpha: 0.35))
    cg.setLineWidth(0.8)
    cg.setLineCap(.round)
    
    cg.strokeLineSegments(between: [CGPoint(x: 8.5, y: 14.5), CGPoint(x: 13.5, y: 14.5)])
    cg.strokeLineSegments(between: [CGPoint(x: 7.5, y: 8.5), CGPoint(x: 14.5, y: 8.5)])
    
    // Center Record Lens / Aperture Housing
    let lensBgRect = CGRect(x: 7.5, y: 8.5, width: 7, height: 7)
    cg.setFillColor(CGColor(red: 0.06, green: 0.09, blue: 0.16, alpha: 0.85)) // #0f172a
    cg.fillEllipse(in: lensBgRect)
    
    // Glowing Ruby Record Dot
    let recRect = CGRect(x: 8.7, y: 9.7, width: 4.6, height: 4.6)
    cg.setFillColor(CGColor(red: 0.94, green: 0.27, blue: 0.27, alpha: 1.0)) // #ef4444
    cg.fillEllipse(in: recRect)
    
    // Lens Glint / Shine
    let glintRect = CGRect(x: 9.3, y: 12.0, width: 1.4, height: 1.4)
    cg.setFillColor(CGColor(red: 1.0, green: 1.0, blue: 1.0, alpha: 0.8))
    cg.fillEllipse(in: glintRect)
    
    NSGraphicsContext.restoreGraphicsState()
    
    return rep.representation(using: .png, properties: [:])
}

// Generate 1x and 2x Retina PNGs (Full Color)
if let png1x = createTrayIcon(size: 22, isRetina: false) {
    try? png1x.write(to: URL(fileURLWithPath: "/Users/user/screen_recorder/build/trayIcon.png"))
}

if let png2x = createTrayIcon(size: 22, isRetina: true) {
    try? png2x.write(to: URL(fileURLWithPath: "/Users/user/screen_recorder/build/trayIcon@2x.png"))
}

// Generate Template version (Monochrome with transparent background)
func createTemplateIcon(size: CGFloat, isRetina: Bool) -> Data? {
    let dim = isRetina ? size * 2 : size
    let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: Int(dim),
        pixelsHigh: Int(dim),
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .calibratedRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    )!
    
    NSGraphicsContext.saveGraphicsState()
    let context = NSGraphicsContext(bitmapImageRep: rep)!
    NSGraphicsContext.current = context
    let cg = context.cgContext
    
    // Clear to 100% transparent
    cg.clear(CGRect(x: 0, y: 0, width: dim, height: dim))
    
    let scale = dim / 22.0
    cg.scaleBy(x: scale, y: scale)
    
    // Base leaves
    let leafPath = CGMutablePath()
    leafPath.move(to: CGPoint(x: 7.5, y: 5.5))
    leafPath.addCurve(to: CGPoint(x: 11, y: 3), control1: CGPoint(x: 7.5, y: 3), control2: CGPoint(x: 9.5, y: 3))
    leafPath.addCurve(to: CGPoint(x: 14.5, y: 5.5), control1: CGPoint(x: 12.5, y: 3), control2: CGPoint(x: 14.5, y: 3))
    leafPath.addCurve(to: CGPoint(x: 11, y: 4.5), control1: CGPoint(x: 13.5, y: 4.5), control2: CGPoint(x: 12, y: 4.5))
    leafPath.closeSubpath()
    
    cg.setFillColor(CGColor(red: 0, green: 0, blue: 0, alpha: 0.8))
    cg.addPath(leafPath)
    cg.fillPath()
    
    // Cob Body
    let cobRect = CGRect(x: 5.5, y: 4.5, width: 11, height: 14.5)
    let cobPath = CGPath(roundedRect: cobRect, cornerWidth: 5.5, cornerHeight: 6.5, transform: nil)
    cg.setFillColor(CGColor(red: 0, green: 0, blue: 0, alpha: 1.0))
    cg.addPath(cobPath)
    cg.fillPath()
    
    // Cutout Center Lens Hole (Clear transparent)
    cg.setBlendMode(.clear)
    let lensBgRect = CGRect(x: 7.5, y: 8.5, width: 7, height: 7)
    cg.fillEllipse(in: lensBgRect)
    
    // Put inner dot back
    cg.setBlendMode(.normal)
    let recRect = CGRect(x: 8.7, y: 9.7, width: 4.6, height: 4.6)
    cg.setFillColor(CGColor(red: 0, green: 0, blue: 0, alpha: 1.0))
    cg.fillEllipse(in: recRect)
    
    NSGraphicsContext.restoreGraphicsState()
    return rep.representation(using: .png, properties: [:])
}

if let tmpl1x = createTemplateIcon(size: 22, isRetina: false) {
    try? tmpl1x.write(to: URL(fileURLWithPath: "/Users/user/screen_recorder/build/trayIconTemplate.png"))
}

if let tmpl2x = createTemplateIcon(size: 22, isRetina: true) {
    try? tmpl2x.write(to: URL(fileURLWithPath: "/Users/user/screen_recorder/build/trayIconTemplate@2x.png"))
}

print("All tray icons generated successfully!")

