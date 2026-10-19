const { open } = require('./snap')
const { spawn } = require('child_process')
const ff = require('ffmpeg-static')
const FPS = 30, DUR = 22
;(async () => {
  const { browser, page } = await open()
  const enc = spawn(ff, ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-i', 'audio.wav', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', 'video_raw.mp4'], { stdio: ['pipe', 'inherit', 'pipe'] })
  enc.stderr.on('data', () => {})
  const total = FPS * DUR
  for (let f = 0; f < total; f++) {
    await page.evaluate(t => render(t), f / FPS)
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 })
    if (!enc.stdin.write(buf)) await new Promise(r => enc.stdin.once('drain', r))
    if (f % 60 === 0) console.log('frame', f)
  }
  enc.stdin.end()
  await new Promise(r => enc.on('close', r))
  await browser.close()
  console.log('done')
})()
