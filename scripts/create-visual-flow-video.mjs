#!/usr/bin/env node
import { mkdir, writeFile, copyFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const args = process.argv.slice(2);

function argValue(name) {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] || null;
}

const musicArg = argValue('--music');
const withNarration = args.includes('--narration');
const voice = argValue('--voice') || 'af_heart';
const duration = Number(argValue('--duration') || (withNarration ? 52 : 38));
const width = Number(argValue('--width') || 1920);
const height = Number(argValue('--height') || 1080);
const outDirName = withNarration ? 'visual-flow-map-narrated' : 'visual-flow-map';
const outDir = resolve(repoRoot, 'videos', outDirName);

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function run(cmd, cmdArgs, opts = {}) {
  const result = spawnSync(cmd, cmdArgs, {
    cwd: opts.cwd || repoRoot,
    stdio: opts.stdio || 'inherit',
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${cmdArgs.join(' ')} failed with status ${result.status}`);
  }
  return result;
}

async function prepareNarration() {
  if (!withNarration) return null;
  const script = `pacs.crypto is a visual reference for a narrow bank to VASP payment flow.
It starts with Travel Rule identity and remittance data, then a quote, then an executable instruction linked to that record.
The chain adapter moves the instruction from pending, to broadcast, to confirming, to final.
From there, the reference stack exposes status, finality, reporting, and an evidence pack for reviewers.
For returns and reversals, the visual keeps pacs dot zero zero four and pacs dot zero zero seven terminology, because those names are meaningful to payment practitioners.
Cancellation stays limited to the pre-broadcast camt dot zero fifty six window.
The richer investigation family remains useful draft machinery, not a locked standard shape.
The question for Tom is simple: does this make the spec discussion easier?`;
  await writeFile(resolve(outDir, 'narration.txt'), script);
  run('npx', ['hyperframes', 'tts', 'narration.txt', '--voice', voice, '--output', 'narration.wav'], { cwd: outDir });
  return 'narration.wav';
}

async function prepareMusic() {
  const target = resolve(outDir, 'background-music.mp3');
  if (musicArg) {
    const src = resolve(process.cwd(), musicArg);
    await copyFile(src, target);
    return 'background-music.mp3';
  }

  // Copyright-safe ambient bed: three quiet sine layers with fade-in/out.
  // Replace with --music /path/to/track.mp3 when a human-selected track exists.
  run('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', `sine=frequency=110:duration=${duration}:sample_rate=48000`,
    '-f', 'lavfi', '-i', `sine=frequency=220:duration=${duration}:sample_rate=48000`,
    '-f', 'lavfi', '-i', `sine=frequency=329.63:duration=${duration}:sample_rate=48000`,
    '-filter_complex',
    `[0:a]volume=0.11[a0];[1:a]volume=0.055[a1];[2:a]volume=0.035[a2];[a0][a1][a2]amix=inputs=3:duration=longest,afade=t=in:st=0:d=2,afade=t=out:st=${Math.max(duration - 3, 1)}:d=3`,
    '-codec:a', 'libmp3lame', '-q:a', '5',
    target,
  ]);
  return 'background-music.mp3';
}

function html(musicFile, narrationFile) {
  const sceneDuration = duration / 6;
  const starts = Array.from({ length: 6 }, (_, i) => +(i * sceneDuration).toFixed(3));
  const sceneDur = +Math.max(sceneDuration - 0.08, 0).toFixed(3);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>pacs.crypto Visual Flow Map Video</title>
<style>
  :root {
    --bg: #07111f;
    --panel: #0d1b2e;
    --panel-2: #12243a;
    --text: #eef7ff;
    --muted: #9fb4ca;
    --cyan: #36d6ff;
    --green: #5cf2a9;
    --amber: #f7c45f;
    --rose: #ff6b91;
    --line: #6f879f;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #000; }
  body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  #stage {
    width: ${width}px;
    height: ${height}px;
    position: relative;
    overflow: hidden;
    color: var(--text);
    background:
      radial-gradient(circle at 20% 10%, rgba(54, 214, 255, 0.2), rgba(54, 214, 255, 0) 28%),
      radial-gradient(circle at 80% 20%, rgba(92, 242, 169, 0.16), rgba(92, 242, 169, 0) 30%),
      linear-gradient(135deg, #06101e 0%, #07111f 45%, #0b1525 100%);
  }
  #stage::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px);
    background-size: 48px 48px;
    opacity: 0.55;
  }
  .scene {
    position: absolute;
    inset: 0;
    padding: 72px 88px;
    display: grid;
    grid-template-rows: auto 1fr auto;
    gap: 34px;
    opacity: 0;
    background-color: rgba(7, 17, 31, 0.01);
  }
  .kicker {
    color: var(--cyan);
    font-size: 26px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    font-weight: 800;
  }
  h1, h2 {
    margin: 0;
    line-height: 0.98;
    letter-spacing: -0.055em;
    max-width: 1420px;
  }
  h1 { font-size: 112px; }
  h2 { font-size: 86px; }
  .subtitle {
    position: absolute;
    left: 50%;
    bottom: 28px;
    transform: translateX(-50%);
    width: min(1220px, calc(100% - 320px));
    padding: 0;
    border: 0;
    border-radius: 0;
    color: rgba(238, 247, 255, 0.95);
    background: transparent;
    box-shadow: none;
    font-size: 30px;
    line-height: 1.14;
    text-align: center;
    font-weight: 680;
    text-shadow: 0 3px 18px rgba(0,0,0,0.75), 0 0 28px rgba(54,214,255,0.12);
  }
  .map {
    align-self: center;
    justify-self: center;
    width: 1580px;
    height: 560px;
    border: 1px solid rgba(159, 180, 202, 0.28);
    border-radius: 34px;
    background: rgba(13, 27, 46, 0.78);
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.035), 0 30px 90px rgba(0,0,0,0.3);
    position: relative;
    overflow: hidden;
  }
  .node {
    position: absolute;
    width: 230px;
    height: 118px;
    border-radius: 24px;
    padding: 22px 24px;
    background: var(--panel-2);
    border: 2px solid var(--green);
    box-shadow: 0 16px 44px rgba(0,0,0,0.25);
  }
  .node.partial { border-color: var(--amber); }
  .node.draft { border-color: var(--rose); border-style: dashed; }
  .node b { display:block; font-size: 28px; line-height: 1; }
  .node span { display:block; margin-top: 11px; color: var(--muted); font-size: 20px; font-family: JetBrains Mono, monospace; }
  .n1 { left: 70px; top: 72px; }
  .n2 { left: 346px; top: 72px; }
  .n3 { left: 622px; top: 72px; }
  .n4 { left: 898px; top: 72px; }
  .n5 { left: 1174px; top: 72px; }
  .n6 { left: 1036px; top: 318px; }
  .n7 { left: 760px; top: 318px; }
  .n8 { left: 484px; top: 318px; }
  .n9 { left: 208px; top: 318px; }
  .caption-small {
    position:absolute;
    color: var(--muted);
    font-size: 22px;
    font-family: JetBrains Mono, monospace;
  }
  svg.lines { position:absolute; inset:0; width:100%; height:100%; overflow: visible; }
  .line { fill:none; stroke: var(--line); stroke-width: 4; marker-end: url(#arrow); opacity: 0.9; }
  .line.return { stroke: var(--amber); }
  .line.draft { stroke: var(--rose); stroke-dasharray: 10 10; }
  .cards { display:grid; grid-template-columns: repeat(3, 1fr); gap: 30px; align-self:center; }
  .card {
    min-height: 300px;
    padding: 34px;
    border-radius: 30px;
    background: rgba(13,27,46,0.82);
    border: 1px solid rgba(159,180,202,0.26);
    box-shadow: 0 24px 70px rgba(0,0,0,0.28);
  }
  .card strong { display:block; color: var(--cyan); font-size: 26px; letter-spacing:0.08em; text-transform:uppercase; }
  .card p { margin: 18px 0 0; color: var(--text); font-size: 34px; line-height: 1.12; font-weight: 760; }
  .pillrow { display:flex; gap: 18px; flex-wrap:wrap; align-self:center; }
  .pill { padding: 22px 28px; border-radius: 999px; background: rgba(13,27,46,0.88); border: 1px solid rgba(159,180,202,0.32); font-size: 34px; font-weight: 760; }
  .pill.green { border-color: var(--green); }
  .pill.amber { border-color: var(--amber); }
  .pill.rose { border-color: var(--rose); }
  .footer-note { color: var(--muted); font-size: 25px; align-self:end; }
  .accent { color: var(--cyan); }
  .green { color: var(--green); }
  .amber { color: var(--amber); }
  .rose { color: var(--rose); }
</style>
</head>
<body>
<div id="stage" data-composition-id="root" data-start="0" data-duration="${duration}" data-width="${width}" data-height="${height}">
  <audio id="music" data-start="0" data-duration="${duration}" data-track-index="0" data-volume="${narrationFile ? '0.16' : '0.42'}" src="${musicFile}"></audio>
  ${narrationFile ? `<audio id="narration" data-start="0" data-duration="${duration}" data-track-index="2" data-volume="1" src="${narrationFile}"></audio>` : ''}

  <section id="scene-1" class="clip scene" data-start="${starts[0]}" data-duration="${sceneDur}" data-track-index="1">
    <div>
      <div class="kicker">pacs.crypto visual reference</div>
      <h1>From ISO 20022 message semantics to executable blockchain payment flows.</h1>
    </div>
    <div class="pillrow">
      <div class="pill green">Travel Rule</div>
      <div class="pill green">Instruction</div>
      <div class="pill green">Finality</div>
      <div class="pill amber">Return / reversal</div>
      <div class="pill rose">Investigation draft</div>
    </div>
    <div class="subtitle">Visual reference for reviewing the pacs.crypto lifecycle.</div>
  </section>

  <section id="scene-2" class="clip scene" data-start="${starts[1]}" data-duration="${sceneDur}" data-track-index="1">
    <div>
      <div class="kicker">Implemented wedge</div>
      <h2>One narrow corridor first: bank → sending VASP → chain → receiving VASP.</h2>
    </div>
    <div class="map">
      <svg class="lines" viewBox="0 0 1580 560"><defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="#6f879f"/></marker></defs><path class="line" d="M300 126 H346"/><path class="line" d="M576 126 H622"/><path class="line" d="M852 126 H898"/><path class="line" d="M1128 126 H1174"/><path class="line" d="M1290 180 V318"/><path class="line" d="M1036 372 H990"/><path class="line" d="M760 372 H714"/><path class="line" d="M484 372 H438"/></svg>
      <div class="node n1"><b>Travel Rule</b><span>pacs.008 data</span></div>
      <div class="node n2"><b>Quote</b><span>fees + slippage</span></div>
      <div class="node n3"><b>Instruction</b><span>linked record</span></div>
      <div class="node n4"><b>Chain</b><span>PENDING → FINAL</span></div>
      <div class="node n5"><b>Finality</b><span>camt.025-like</span></div>
      <div class="node n6"><b>Status</b><span>GET /instruction</span></div>
      <div class="node n7"><b>Reporting</b><span>camt.054/052/053</span></div>
      <div class="node n8"><b>Evidence</b><span>reviewer pack</span></div>
      <div class="node n9"><b>Demo</b><span>visual console</span></div>
    </div>
    <div class="subtitle">Narrow lifecycle: identity, quote, instruction, chain, finality.</div>
  </section>

  <section id="scene-3" class="clip scene" data-start="${starts[2]}" data-duration="${sceneDur}" data-track-index="1">
    <div>
      <div class="kicker">Tom alignment</div>
      <h2>Keep recognised ISO names where they clarify the blockchain remediation path.</h2>
    </div>
    <div class="cards">
      <div class="card"><strong>Return</strong><p><span class="amber">pacs.004</span> remains the industry-readable return vocabulary.</p></div>
      <div class="card"><strong>Reverse</strong><p><span class="amber">pacs.007</span> stays aligned with post-settlement remediation.</p></div>
      <div class="card"><strong>Cancel</strong><p><span class="amber">camt.056</span> is only realistic before public-chain broadcast.</p></div>
    </div>
    <div class="subtitle">Return and reversal stay aligned with pacs.004 and pacs.007.</div>
  </section>

  <section id="scene-4" class="clip scene" data-start="${starts[3]}" data-duration="${sceneDur}" data-track-index="1">
    <div>
      <div class="kicker">Investigation boundary</div>
      <h2>The exception-family layer stays useful, but not locked into the spec yet.</h2>
    </div>
    <div class="map">
      <svg class="lines" viewBox="0 0 1580 560"><defs><marker id="arrow2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="#ff6b91"/></marker></defs><path class="line return" d="M420 126 H760"/><path class="line return" d="M990 126 H1210"/><path class="line draft" marker-end="url(#arrow2)" d="M875 235 V318"/></svg>
      <div class="node n2"><b>Instruction</b><span>FINAL</span></div>
      <div class="node n7"><b>Return case</b><span>pacs.004</span></div>
      <div class="node n5"><b>Reverse path</b><span>pacs.007</span></div>
      <div class="node draft" style="left:760px;top:318px;width:330px"><b>Investigation family</b><span>camt.026 / 027 / 087 TBD</span></div>
      <div class="caption-small" style="left: 715px; top: 262px;">draft input, not normative lock-in</div>
    </div>
    <div class="subtitle">Investigation and E&I flows stay draft until the API shape is agreed.</div>
  </section>

  <section id="scene-5" class="clip scene" data-start="${starts[4]}" data-duration="${sceneDur}" data-track-index="1">
    <div>
      <div class="kicker">Reviewer package</div>
      <h2>The visual layer points reviewers to what is implemented, partial, and still draft.</h2>
    </div>
    <div class="cards">
      <div class="card"><strong class="green">Implemented</strong><p>Reference server routes, simulators, happy-path evidence, status, finality, reporting.</p></div>
      <div class="card"><strong class="amber">Partial</strong><p>Pre-broadcast cancellation window and testnet execution caveats.</p></div>
      <div class="card"><strong class="rose">Draft</strong><p>Richer investigation and request-for-information family.</p></div>
    </div>
    <div class="subtitle">Green is implemented, amber is partial, rose remains draft.</div>
  </section>

  <section id="scene-6" class="clip scene" data-start="${starts[5]}" data-duration="${sceneDur}" data-track-index="1">
    <div>
      <div class="kicker">Next review question</div>
      <h2>Is this visual format useful for spec and reference-implementation discussion?</h2>
    </div>
    <div class="pillrow">
      <div class="pill green">Lifecycle map</div>
      <div class="pill green">Sequence diagram</div>
      <div class="pill amber">Return/reversal split</div>
      <div class="pill rose">Investigation TBD</div>
    </div>
    <div class="subtitle">Next pass can focus on E&I and liquidity management.</div>
  </section>
</div>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<script>
  window.__timelines = window.__timelines || {};
  const tl = gsap.timeline({ paused: true });
  const sceneStarts = ${JSON.stringify(starts)};
  const sceneDuration = ${sceneDur};

  sceneStarts.forEach((start, index) => {
    const scene = '#scene-' + (index + 1);
    tl.fromTo(scene, { opacity: 0, filter: 'blur(18px)' }, { opacity: 1, filter: 'blur(0px)', duration: 0.38, ease: 'power2.out' }, start + 0.02);
    tl.from(scene + ' .kicker', { opacity: 0, y: -24, duration: 0.48, ease: 'power3.out' }, start + 0.28);
    tl.from(scene + ' h1, ' + scene + ' h2', { opacity: 0, y: 42, scale: 0.985, duration: 0.75, ease: 'expo.out' }, start + 0.45);
    tl.from(scene + ' .node, ' + scene + ' .card, ' + scene + ' .pill', { opacity: 0, y: 32, scale: 0.96, duration: 0.5, stagger: 0.07, ease: 'back.out(1.35)' }, start + 1.05);
    const lines = gsap.utils.toArray(scene + ' .line');
    if (lines.length) {
      tl.from(lines, { opacity: 0, duration: 0.5, stagger: 0.05, ease: 'power2.out' }, start + 1.15);
    }
    tl.from(scene + ' .subtitle', { opacity: 0, duration: 0.55, ease: 'power3.out' }, start + Math.max(sceneDuration - 2.1, 1.3));

    if (index < sceneStarts.length - 1) {
      tl.to(scene, { opacity: 0, filter: 'blur(10px)', duration: 0.12, ease: 'power2.inOut' }, start + sceneDuration - 0.12);
    } else {
      tl.to(scene, { opacity: 0, filter: 'blur(12px)', duration: 0.6, ease: 'power2.inOut' }, start + sceneDuration - 0.7);
    }
  });

  window.__timelines.root = tl;
</script>
</body>
</html>`;
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const musicFile = await prepareMusic();
  const narrationFile = await prepareNarration();
  await writeFile(resolve(outDir, 'index.html'), html(musicFile, narrationFile));
  await writeFile(resolve(outDir, 'DESIGN.md'), `# pacs.crypto visual flow video design\n\n## Style Prompt\nTechnical, dark, calm, reviewer-facing. The video should feel like a standards/reference-stack briefing, not a crypto hype reel.\n\n## Colors\n- Deep navy canvas: #07111f\n- Panel navy: #0d1b2e\n- Cyan accent: #36d6ff\n- Green implemented: #5cf2a9\n- Amber partial/remediation: #f7c45f\n- Rose draft/TBD: #ff6b91\n\n## Typography\n- Inter/system sans for headings and subtitles.\n- ui-monospace/SFMono for endpoint and ISO identifiers.\n\n## What NOT to Do\n- No speculative standards claims.\n- No token-price, moon, or trading visuals.\n- Narration is optional and generated locally when --narration is passed.\n- No fast glitch transitions that make ISO identifiers unreadable.\n`);
  await writeFile(resolve(outDir, 'README.md'), `# pacs.crypto visual flow video\n\nGenerated by \`scripts/create-visual-flow-video.mjs\`.\n\n## Build\n\nFrom repo root:\n\n\`\`\`bash\nnode scripts/create-visual-flow-video.mjs\nnpx hyperframes lint videos/visual-flow-map\nnpx hyperframes validate videos/visual-flow-map\nnpx hyperframes inspect videos/visual-flow-map\nnpx hyperframes render videos/visual-flow-map --quality draft --fps 24 --workers 1 --output videos/visual-flow-map/renders/pacs-crypto-visual-flow-draft.mp4\n\`\`\`\n\nUse your own background track:\n\n\`\`\`bash\nnode scripts/create-visual-flow-video.mjs --music /path/to/background.mp3\n\`\`\`\n\nNo narration is included. Captions are baked into the composition as scene subtitles.\n`);

  console.log(`Created HyperFrames project at ${relative(repoRoot, outDir)}`);
  console.log(`Music: ${musicFile}${musicArg ? ' (copied from --music)' : ' (generated copyright-safe placeholder)'}`);
  if (narrationFile) console.log(`Narration: ${narrationFile} (voice ${voice})`);
  console.log('Next: npx hyperframes lint videos/visual-flow-map');
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
