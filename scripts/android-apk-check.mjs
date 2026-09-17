import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { inflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const EXPECTED_PACKAGE = 'com.noexcuses.app';
const KNOWN_SIGNER_SHA1 = '5e8f16062ea3cd2c4a0d547876baa6f38cabf625';

function findSdkRoots() {
  return [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT].filter(Boolean);
}

function compareVersion(a, b) {
  const aa = String(a).split('.').map((p) => Number(p) || 0);
  const bb = String(b).split('.').map((p) => Number(p) || 0);
  for (let i = 0; i < Math.max(aa.length, bb.length); i++) {
    const d = (aa[i] || 0) - (bb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

function findTool(name) {
  const candidates = [];
  for (const root of findSdkRoots()) {
    const bt = path.join(root, 'build-tools');
    if (fs.existsSync(bt)) {
      const vers = fs.readdirSync(bt)
        .filter((d) => /^\d/.test(d))
        .sort(compareVersion)
        .reverse();
      for (const v of vers) {
        candidates.push(path.join(bt, v, name));
      }
    }
    for (const sub of [
      path.join('cmdline-tools', 'latest', 'bin', name),
      path.join('cmdline-tools', name),
    ]) {
      candidates.push(path.join(root, sub));
    }
  }
  const pathDirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const dir of pathDirs) {
    candidates.push(path.join(dir, name));
  }
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function findTools() {
  const win = process.platform === 'win32';
  const aapt2 = findTool(win ? 'aapt2.exe' : 'aapt2');
  const aapt = findTool(win ? 'aapt.exe' : 'aapt');
  return {
    aapt: aapt2 || aapt,
    aaptIsV2: !!aapt2 || aapt === null,
    apksigner: findTool(win ? 'apksigner.bat' : 'apksigner'),
    apkanalyzer: findTool(win ? 'apkanalyzer.bat' : 'apkanalyzer'),
  };
}

function run(cmd, args) {
  let finalCmd = cmd;
  let finalArgs = args;
  if (process.platform === 'win32' && /\.(bat|cmd)$/i.test(cmd)) {
    finalCmd = 'cmd.exe';
    finalArgs = ['/c', cmd, ...args];
  }
  try {
    const r = spawnSync(finalCmd, finalArgs, { encoding: 'utf8', windowsHide: true, timeout: 120000 });
    if (r.error) return { status: -1, stdout: '', stderr: r.error.message };
    return { status: r.status ?? -1, stdout: r.stdout || '', stderr: r.stderr || '' };
  } catch (e) {
    return { status: -1, stdout: '', stderr: String(e) };
  }
}

function findEocd(buf) {
  const min = buf.length - 22;
  const start = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= start; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) return i;
  }
  return -1;
}

function zipEntries(buf) {
  const entries = [];
  const eocd = findEocd(buf);
  if (eocd < 0) return entries;
  const total = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < total; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break;
    const method = buf.readUInt16LE(off + 10);
    const csize = buf.readUInt32LE(off + 20);
    const usize = buf.readUInt32LE(off + 24);
    const nlen = buf.readUInt16LE(off + 28);
    const elen = buf.readUInt16LE(off + 30);
    const clen = buf.readUInt16LE(off + 32);
    const lho = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nlen);
    entries.push({ name, method, csize, usize, lho });
    off += 46 + nlen + elen + clen;
  }
  return entries;
}

function extractEntry(buf, entry) {
  if (!entry) return null;
  if (buf.readUInt32LE(entry.lho) !== 0x04034b50) return null;
  const nlen = buf.readUInt16LE(entry.lho + 26);
  const elen = buf.readUInt16LE(entry.lho + 28);
  const dataStart = entry.lho + 30 + nlen + elen;
  const data = buf.subarray(dataStart, dataStart + entry.csize);
  try {
    if (entry.method === 0) return Buffer.from(data);
    if (entry.method === 8) return inflateRawSync(data, { maxOutputLength: entry.usize || undefined });
  } catch {
    return null;
  }
  return null;
}

function findEntry(entries, name) {
  return entries.find((e) => e.name === name) || null;
}

function containsString(buf, needle) {
  if (buf.includes(needle)) return true;
  return buf.includes(Buffer.from(needle, 'utf16le'));
}

function parseBadging(out) {
  const m = /package:\s*name='([^']+)'/.exec(out);
  return m ? m[1] : null;
}

export function verifyApk(opts = {}) {
  const apkPath = path.resolve(opts.apkPath || '');
  const issues = [];
  const info = { isAab: null, isApk: null, package: null, tool: null, devClient: null, signerMatch: null, inspectedByTool: false };

  if (!fs.existsSync(apkPath)) {
    issues.push({ level: 'FAIL', msg: `APK not found: ${apkPath}` });
    return { ok: false, issues, info };
  }
  const stat = fs.statSync(apkPath);
  if (!stat.isFile()) {
    issues.push({ level: 'FAIL', msg: `not a file: ${apkPath}` });
    return { ok: false, issues, info };
  }

  if (stat.size > 2 * 1024 * 1024 * 1024) {
    issues.push({ level: 'FAIL', msg: 'file too large (>2GB); cannot inspect' });
    return { ok: false, issues, info };
  }

  const head = Buffer.alloc(4);
  const fd = fs.openSync(apkPath, 'r');
  fs.readSync(fd, head, 0, 4, 0);
  fs.closeSync(fd);

  const isZip = head.equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) || head.equals(Buffer.from([0x50, 0x4b, 0x05, 0x06])) || head.equals(Buffer.from([0x50, 0x4b, 0x07, 0x08]));
  if (!isZip) {
    issues.push({ level: 'FAIL', msg: 'not a ZIP container — not an APK or AAB' });
    return { ok: false, issues, info };
  }

  const buf = fs.readFileSync(apkPath);
  const entries = zipEntries(buf);
  if (entries.length === 0) {
    issues.push({ level: 'FAIL', msg: 'could not read ZIP central directory (zip64 or corrupt)' });
    return { ok: false, issues, info };
  }

  const isAab = entries.some((e) => e.name === 'BundleConfig.pb');
  info.isAab = isAab;
  if (isAab) {
    issues.push({
      level: 'FAIL',
      msg: 'this is an AAB (app bundle), not an APK — build an APK (eas.json development profile android.buildType=apk) or gradlew assembleDebug',
    });
    return { ok: false, issues, info };
  }

  const tools = findTools();
  const toolOrder = [
    { tool: tools.aapt, kind: 'aapt', args: ['dump', 'badging', apkPath], pkgRegex: /package:\s*name='([^']+)'/ },
    { tool: tools.apkanalyzer, kind: 'apkanalyzer', args: ['manifest', 'application-id', apkPath], pkgRegex: null },
  ];

  for (const t of toolOrder) {
    if (!t.tool) continue;
    const r = run(t.tool, t.args);
    if (r.status === 0) {
      info.inspectedByTool = true;
      info.tool = t.kind;
      if (t.pkgRegex) {
        const m = t.pkgRegex.exec(r.stdout);
        if (m) info.package = m[1];
      } else {
        const out = r.stdout.trim();
        if (out) info.package = out;
      }
      if (info.package) break;
    }
  }

  const manifestEntry = findEntry(entries, 'AndroidManifest.xml');
  const manifestBuffer = manifestEntry ? extractEntry(buf, manifestEntry) : null;

  if (!info.package && manifestBuffer) {
    if (containsString(manifestBuffer, EXPECTED_PACKAGE)) {
      info.package = EXPECTED_PACKAGE;
    } else {
      const m = /package="([^"]+)"/.exec(manifestBuffer.toString('latin1'));
      if (m) info.package = m[1];
    }
  }

  if (info.package) {
    if (info.package === EXPECTED_PACKAGE) {
      issues.push({ level: 'PASS', msg: `package/application ID is ${EXPECTED_PACKAGE}` });
    } else {
      issues.push({ level: 'FAIL', msg: `package/application ID is "${info.package}" — expected ${EXPECTED_PACKAGE}` });
    }
  } else if (info.inspectedByTool) {
    issues.push({ level: 'FAIL', msg: 'APK inspected with Android SDK tool but package/application ID could not be determined' });
  } else {
    issues.push({ level: 'WARN', msg: 'no Android SDK inspection tool (aapt/aapt2/apkanalyzer) found — package/application ID not verified' });
  }

  if (info.inspectedByTool) {
    issues.push({ level: 'PASS', msg: `file is a valid APK (inspected with ${info.tool})` });
  } else if (isZip && !isAab) {
    issues.push({ level: 'WARN', msg: 'no Android SDK tool available — install build-tools (aapt2/apksigner) or set ANDROID_HOME to confirm APK validity' });
  } else {
    issues.push({ level: 'FAIL', msg: 'file could not be confirmed as an APK' });
  }

  if (tools.aapt) {
    const xmltreeArgs = tools.aaptIsV2
      ? ['dump', 'xmltree', '--file', 'AndroidManifest.xml', apkPath]
      : ['dump', 'xmltree', apkPath, 'AndroidManifest.xml'];
    const r = run(tools.aapt, xmltreeArgs);
    if (r.status === 0) {
      info.devClient = /devlauncher|devmenu|dev-client|devrn/i.test(r.stdout + r.stderr);
      issues.push({ level: 'PASS', msg: `development-client build: ${info.devClient ? 'yes' : 'no'}` });
    }
  }
  if (info.devClient === null && manifestBuffer) {
    const raw = manifestBuffer.toString('latin1') + manifestBuffer.toString('utf16le');
    info.devClient = /devlauncher|devmenu|expo-dev-client/i.test(raw);
    issues.push({ level: 'PASS', msg: `development-client build: ${info.devClient ? 'yes' : 'no'} (manifest scan, tool xmltree unavailable)` });
  }
  if (info.devClient === null || info.devClient === false) {
    const dexScan = entries
      .filter((e) => /^classes\d*\.dex$/.test(e.name))
      .some((e) => {
        const dex = extractEntry(buf, e);
        return dex && /DevLauncherActivity|expo\.modules\.dev(launcher|menu)/.test(dex.toString('latin1') + dex.toString('utf16le'));
      });
    if (dexScan) {
      info.devClient = true;
      issues.push({ level: 'PASS', msg: 'development-client build: yes (dev-launcher classes present in dex)' });
    } else if (info.devClient === null) {
      issues.push({ level: 'INFO', msg: 'development-client build: could not be determined' });
    }
  }

  if (opts.expectSignerSha1 && tools.apksigner) {
    const r = run(tools.apksigner, ['verify', '--print-certs', apkPath]);
    if (r.status === 0) {
      const m = /SHA-1 digest:\s*([0-9a-fA-F]{40})/.exec(r.stdout);
      if (m) {
        const actual = m[1].toLowerCase();
        const expected = String(opts.expectSignerSha1).toLowerCase();
        info.signerMatch = actual === expected;
        if (info.signerMatch) {
          issues.push({ level: 'PASS', msg: 'signer certificate matches the expected debug key (install -r is safe for the tracked device)' });
        } else {
          issues.push({ level: 'FAIL', msg: 'signer certificate does NOT match the expected debug key — install -r will be rejected; check keystore backup' });
        }
      } else {
        issues.push({ level: 'WARN', msg: 'apksigner verify ran but no SHA-1 digest was found in its output' });
      }
    } else {
      issues.push({ level: 'WARN', msg: `apksigner could not verify the APK (${(r.stderr || '').split(/\r?\n/)[0] || 'exit ' + r.status})` });
    }
  } else if (opts.expectSignerSha1) {
    issues.push({ level: 'WARN', msg: 'apksigner not found — signing-key match not verified' });
  }

  const failCount = issues.filter((i) => i.level === 'FAIL').length;
  return { ok: failCount === 0, issues, info };
}

function printUsage() {
  console.log(`Usage:
  node scripts/android-apk-check.mjs --apk <path-to.apk> [--serial ZY224LNJKD] [--expect-signer-sha1 <hex>]

  --apk <path>            APK to validate (also accepted as a positional first argument)
  --serial <serial>       adb device serial (informational; default ZY224LNJKD)
  --expect-signer-sha1    verify apksigner SHA-1 (default: ${KNOWN_SIGNER_SHA1})

Checks:
  - APK exists
  - APK is an APK, not an AAB
  - package/application ID is ${EXPECTED_PACKAGE}
  - inspected with aapt / apkanalyzer / Android SDK tooling
  - reports whether it is a development-client build
  - does NOT install anything
`);
}

function main() {
  const argv = process.argv.slice(2);
  const opts = { apkPath: null, serial: null, expectSignerSha1: KNOWN_SIGNER_SHA1 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apk') opts.apkPath = argv[i + 1] || null;
    else if (a.startsWith('--apk=')) opts.apkPath = a.slice(6);
    else if (a === '--serial') opts.serial = argv[i + 1] || null;
    else if (a === '--expect-signer-sha1') opts.expectSignerSha1 = (argv[i + 1] || '').toLowerCase();
    else if (a === '--help' || a === '-h') {
      printUsage();
      process.exit(0);
    } else if (!opts.apkPath) opts.apkPath = a;
  }

  if (!opts.apkPath) {
    printUsage();
    process.exit(2);
  }

  const result = verifyApk({ apkPath: opts.apkPath, serial: opts.serial, expectSignerSha1: opts.expectSignerSha1 });
  for (const i of result.issues) {
    const tag = i.level === 'FAIL' ? 'FAIL' : i.level === 'WARN' ? 'WARN' : i.level === 'INFO' ? 'INFO' : 'PASS';
    if (i.level === 'FAIL') console.error(`   [${tag}] ${i.msg}`);
    else console.log(`   [${tag}] ${i.msg}`);
  }
  console.log(`\nRESULT: APK ${result.ok ? 'OK' : 'FAILED'}${opts.serial ? ` (device serial ${opts.serial})` : ''}`);
  console.log('Note: this command does NOT install the APK.');
  process.exit(result.ok ? 0 : 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}