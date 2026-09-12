// Deterministic packaging of the canonical mark; never redraw or modify the iOS asset.
const Jimp = require('jimp-compact');
const path = require('node:path');
const dir = path.join(__dirname, '../assets/images');
(async () => {
  const canonical = await Jimp.read(path.join(dir, 'icon.png'));
  const mark = canonical.clone();
  // Remove only the near-white background, preserving the original green pixels.
  mark.scan(0, 0, mark.bitmap.width, mark.bitmap.height, function (_x, _y, i) {
    const d = this.bitmap.data;
    if (d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200) d[i + 3] = 0;
  });
  mark.contain(680, 680);
  const foreground = new Jimp(1024, 1024, 0x00000000).composite(mark, 172, 172);
  await foreground.writeAsync(path.join(dir, 'android-icon-foreground.png'));
  await new Jimp(1024, 1024, 0xffffffff).writeAsync(path.join(dir, 'android-icon-background.png'));
  const mono = foreground.clone();
  mono.scan(0, 0, 1024, 1024, function (_x, _y, i) {
    this.bitmap.data[i] = this.bitmap.data[i + 1] = this.bitmap.data[i + 2] = 255;
  });
  await mono.writeAsync(path.join(dir, 'android-icon-monochrome.png'));
})();
