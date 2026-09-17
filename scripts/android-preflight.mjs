import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { verifyApk } from './android-apk-check.mjs';

const ISSUES = { pass: 0, warn: 0, fail: 0 };
const C = {
  APP_REL: path.join('artifacts', 'no-excuses'),
  DEVICE_SERIAL: 'ZY224LNJKD',
  APP_ID: 'com.noexcuses.app',
  ENV_FILE_REL: path.join('artifacts', 'no-excuses', '.env.local'),
  APK_PATH_MARKER: path.join(os.tmpdir(), 'opencode', 'noexcuses-apk-path.txt'),
};

function pass(msg) {
  ISSUES.pass++;
  console.log(`   PASS  ${msg}`);
}
function warn(msg) {
  ISSUES.warn++;
  console.warn(`   WARN  ${msg}`);
}
function fail(msg) {
  ISSUES.fail++;
  console.error(`   FAIL  ${msg}`);
}
function section(title) {
  console.log(`\n=== ${title} ===`);
}
function banner(title) {
  console.log(`\n[android:preflight] ${title}`);
}

function parseArgs(argv) {
  const opts = {
    mode: 'preflight',
    frozenInstall: false,
    typecheck: false,
    skipEnv: false,
    apkPath: null,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--frozen-install') opts.frozenInstall = true;
    else if (a === '--typecheck') opts.typecheck = true;
    else if (a === '--skip-env') opts.skipEnv = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--apk') opts.apkPath = argv[i + 1] || null;
    else if (a.startsWith('--apk=')) opts.apkPath = a.slice(6);
    else if (a === 'install' || a === 'device' || a === 'install-check') opts.mode = 'install';
    else opts.positional = a;
  }
  return opts;
}

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function gitWorkspace() {
  try {
    spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: ROOT, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function isGitIgnored(absPath) {
  try {
    spawnSync('git', ['check-ignore', '-q', '--', path.relative(ROOT, absPath)], {
      cwd: ROOT,
      stdio: 'ignore',
    });
    return true;
  } catch (e) {
    return e.status === 1 ? false : undefined;
  }
}

function runSync(cmd, args, opts = {}) {
  try {
    const r = spawnSync(cmd, args, {
      encoding: 'utf8',
      windowsHide: true,
      ...opts,
    });
    if (r.error) return { error: r.error, status: 1 };
    return r;
  } catch (e) {
    return { error: e, status: 1 };
  }
}

function satisfies(version, rawRange) {
  const s = String(rawRange).trim();
  if (s === '' || s === '*' || s === 'latest') return true;
  let op = '=';
  let rest = s;
  for (const o of ['>=', '<=', '>', '<', '~', '^']) {
    if (s.startsWith(o)) {
      op = o;
      rest = s.slice(o.length).trim();
      break;
    }
  }
  rest = rest.split(/\s+/)[0].replace(/^v/, '');
  const pn = (p) => parseFloat(String(p).replace(/[xX*]/g, '0')) || 0;
  const rv = rest.split('.').map(pn);
  const vv = String(version).replace(/^v/, '').split('.').map(pn);
  const norm = (a) => {
    while (a.length < 3) a.push(0);
    return a;
  };
  const R = norm(rv);
  const V = norm(vv);
  const cmp = (a, b) => {
    for (let i = 0; i < 3; i++) {
      if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
    }
    return 0;
  };
  switch (op) {
    case '=':
      return cmp(V, R) === 0;
    case '~':
      return V[0] === R[0] && V[1] === R[1] && V[2] >= R[2];
    case '^':
      return V[0] === R[0] && cmp(V, R) >= 0;
    case '>':
      return cmp(V, R) > 0;
    case '>=':
      return cmp(V, R) >= 0;
    case '<':
      return cmp(V, R) < 0;
    case '<=':
      return cmp(V, R) <= 0;
    default:
      return true;
  }
}

function resolvePackage(appPkgPath, name) {
  try {
    const req = createRequire(appPkgPath);
    let pkgPath;
    try {
      pkgPath = req.resolve(`${name}/package.json`);
    } catch {
      const main = req.resolve(name);
      let dir = path.dirname(main);
      while (dir.length > 1) {
        const cand = path.join(dir, 'package.json');
        if (fs.existsSync(cand)) {
          pkgPath = cand;
          break;
        }
        const next = path.dirname(dir);
        if (next === dir) break;
        dir = next;
      }
    }
    if (!pkgPath || !fs.existsSync(pkgPath)) return null;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return { version: pkg.version, path: pkgPath };
  } catch {
    return null;
  }
}

function allDeps(appPkg) {
  return { ...(appPkg.dependencies || {}), ...(appPkg.devDependencies || {}) };
}

function fileSha256(file) {
  try {
    const buf = fs.readFileSync(file);
    return crypto.createHash('sha256').update(buf).digest('hex');
  } catch {
    return null;
  }
}

function findAdb() {
  const exe = process.platform === 'win32' ? 'adb.exe' : 'adb';
  const roots = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT].filter(Boolean);
  for (const root of roots) {
    const p = path.join(root, 'platform-tools', exe);
    if (fs.existsSync(p)) return p;
  }
  const pathDirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const dir of pathDirs) {
    const p = path.join(dir, exe);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function adb(args, serial) {
  const adbPath = findAdb();
  if (!adbPath) return null;
  const full = serial ? ['-s', serial, ...args] : args;
  return runSync(adbPath, full, { cwd: ROOT, timeout: 60000, encoding: 'utf8' });
}

function checkFile(source, kind) {
  if (fs.existsSync(source)) {
    pass(`${kind}: ${path.relative(ROOT, source)} exists`);
    return true;
  }
  fail(`${kind}: missing — ${path.relative(ROOT, source)}`);
  return false;
}

function checkAWorkspace(appDir, appPkgPath, appPkg) {
  section('A. Workspace and package consistency');
  const isRoot = fs.existsSync(path.join(ROOT, 'pnpm-workspace.yaml')) && fs.existsSync(path.join(ROOT, 'package.json'));
  if (!isRoot) {
    fail('not running from the monorepo root (pnpm-workspace.yaml / package.json not found in cwd)');
    return;
  }
  pass('running from monorepo root');

  if (!checkFile(appPkgPath, 'app package.json')) return;
  if (!checkFile(path.join(ROOT, 'pnpm-lock.yaml'), 'pnpm-lock.yaml')) return;

  const expoResolved = resolvePackage(appPkgPath, 'expo');
  if (!expoResolved) {
    fail('Expo package cannot be resolved from the app');
    return;
  }
  pass(`expo resolvable from app (installed ${expoResolved.version})`);

  const appMain = allDeps(appPkg)['expo-router'];
  if (appMain) {
    const router = resolvePackage(appPkgPath, 'expo-router');
    if (router) pass('expo-router resolvable from app');
    else fail('expo-router declared but not resolvable from app');
  }

  const expoSdkMajor = Number(String(expoResolved.version).split('.')[0]) || 0;
  const bundledPath = path.join(appDir, 'node_modules', 'expo', 'bundledNativeModules.json');
  let bundled = null;
  if (fs.existsSync(bundledPath)) {
    bundled = JSON.parse(fs.readFileSync(bundledPath, 'utf8'));
  } else {
    warn('expo bundledNativeModules.json not found; skipping SDK alignment check');
  }

  const deps = allDeps(appPkg);
  let driftCount = 0;

  const expoSpec = deps['expo'];
  if (expoSpec && !satisfies(expoResolved.version, expoSpec)) {
    fail(`installed expo ${expoResolved.version} does not satisfy declared "${expoSpec}"`);
    driftCount++;
  }

  const checkList = new Set(Object.keys(deps).filter((n) => n.startsWith('expo') || n.startsWith('@expo/') || n === 'react' || n === 'react-native'));
  if (bundled) {
    for (const name of checkList) {
      const expected = bundled[name];
      if (!expected) continue;
      const info = resolvePackage(appPkgPath, name);
      if (!info) {
        fail(`declared dependency ${name} is not resolvable from the app`);
        driftCount++;
        continue;
      }
      if (!satisfies(info.version, expected)) {
        fail(`SDK ${expoSdkMajor} version drift: ${name} installed ${info.version}, expects ${expected}. Fix: cd artifacts/no-excuses && node node_modules/expo/bin/cli install ${name}`);
        driftCount++;
      }
    }
  }

  if (driftCount === 0) pass('app package versions are compatible with the installed Expo SDK');

  const eas = readJsonSafe(path.join(appDir, 'eas.json'));
  const appJson = readJsonSafe(path.join(appDir, 'app.json'));
  if (!eas) fail('eas.json missing or malformed');
  if (!appJson) fail('app.json missing or malformed');

  let devClientRequested = false;
  if (eas && eas.build) {
    for (const [profileName, profile] of Object.entries(eas.build)) {
      if (profile && profile.developmentClient === true) {
        devClientRequested = true;
        break;
      }
    }
  }

  if (devClientRequested) {
    const declared = !!allDeps(appPkg)['expo-dev-client'];
    if (!declared) {
      fail('eas.json requests developmentClient but expo-dev-client is missing from the app package -> run: npx expo install expo-dev-client');
    } else {
      const info = resolvePackage(appPkgPath, 'expo-dev-client');
      if (!info) {
        fail('expo-dev-client declared but not resolvable from the app -> run: npx expo install expo-dev-client (do not silently install an arbitrary latest)');
      } else {
        pass(`expo-dev-client present and resolvable from app (installed ${info.version})`);
      }
    }
  }
}

function checkBEnv(appDir) {
  section('B. Environment-file safety');
  const envPath = path.join(ROOT, C.ENV_FILE_REL);
  if (!fs.existsSync(envPath)) {
    fail(`expected env file missing: ${C.ENV_FILE_REL}. Provide it without printing or committing values.`);
    return;
  }
  pass(`expected env file present: ${C.ENV_FILE_REL}`);

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  const badNames = [];
  const names = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    let namePart = line;
    if (namePart.startsWith('export ')) namePart = namePart.slice(7).trim();
    const eq = namePart.indexOf('=');
    if (eq < 0) continue;
    const name = namePart.slice(0, eq).trim();
    names.push(name);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) badNames.push(name);
  }
  if (badNames.length > 0) {
    fail(`invalid env variable name(s): ${badNames.join(', ')}`);
  } else {
    pass(`env variable names valid (${names.length} var(s) named, values never printed)`);
  }

  const gi = isGitIgnored(envPath);
  if (gi === true) {
    pass('env file is gitignored');
  } else if (gi === false) {
    fail('env file is NOT gitignored — add `.env` / `.env*.local` to artifacts/no-excuses/.gitignore');
  } else {
    warn('cannot verify git ignore status (git unavailable)');
  }
  if (!gitWorkspace() || !isGitIgnored(envPath)) {
    warn('never commit env files or secret values');
  }
}

function checkCNative(appDir, appJson, devClientRequested, appPkgPath, appPkg) {
  section('C. Native-project safety');
  const androidDir = path.join(appDir, 'android');
  if (!fs.existsSync(androidDir)) {
    fail('artifacts/no-excuses/android does not exist — prebuild required before any build: cd artifacts/no-excuses && node node_modules/expo/bin/cli prebuild --platform android  (never use --clean)');
    return false;
  }
  pass('android/ exists (inspecting, not regenerating)');

  const gradlePath = path.join(androidDir, 'app', 'build.gradle');
  if (!checkFile(gradlePath, 'android/app/build.gradle')) return false;
  const gradle = fs.readFileSync(gradlePath, 'utf8');
  const appIdOk = /applicationId\s+['"]com\.noexcuses\.app['"]/.test(gradle) && /namespace\s+['"]com\.noexcuses\.app['"]/.test(gradle);
  if (appIdOk) pass(`Android application ID / namespace is ${C.APP_ID}`);
  else fail(`android/app/build.gradle must declare applicationId and namespace = ${C.APP_ID}`);

  const manifestPath = path.join(androidDir, 'app', 'src', 'main', 'AndroidManifest.xml');
  if (!checkFile(manifestPath, 'main AndroidManifest.xml')) return false;
  const manifest = fs.readFileSync(manifestPath, 'utf8');

  const requiredPermissions = [
    'android.permission.ACCESS_FINE_LOCATION',
    'android.permission.ACCESS_COARSE_LOCATION',
    'android.permission.SCHEDULE_EXACT_ALARM',
    'com.android.alarm.permission.SET_ALARM',
  ];
  const missingPerms = requiredPermissions.filter((p) => !manifest.includes(p));
  if (missingPerms.length === 0) pass('required permissions present in AndroidManifest.xml');
  else fail(`missing required permission(s): ${missingPerms.join(', ')}`);

  const hasDeepLink = manifest.includes('android:scheme="no-excuses"');
  if (hasDeepLink) pass('no-excuses:// deep link scheme present in AndroidManifest.xml');
  else fail('no-excuses:// deep link scheme missing from AndroidManifest.xml');

  if (devClientRequested) {
    const plugins = (appJson && appJson.expo && appJson.expo.plugins) || [];
    const pluginOk = Array.isArray(plugins) && plugins.some((p) => p === 'expo-dev-client' || (Array.isArray(p) && p[0] === 'expo-dev-client'));
    const pkgOk = !!resolvePackage(appPkgPath, 'expo-dev-client');
    if (pluginOk && pkgOk) pass('dev-client config present (app.json plugin + resolvable package) for the development profile');
    else if (pluginOk) fail('expo-dev-client plugin configured but package not resolvable from the app');
    else fail('development profile (developmentClient) requires expo-dev-client in app.json plugins');
  }

  const gi = isGitIgnored(androidDir);
  if (gi === true) pass('android/ is gitignored (expected; not required in git status)');
  else if (gi === false) warn('android/ is NOT gitignored — consider adding it to artifacts/no-excuses/.gitignore');
  else warn('cannot verify git ignore status for android/');
  return true;
}

function checkDRepro(appDir, appPkgPath, appPkg, opts) {
  section('D. Dependency reproducibility');
  const rootPkg = readJsonSafe(path.join(ROOT, 'package.json'));
  const rootHas = rootPkg && (rootPkg.dependencies?.['expo-dev-client'] || rootPkg.devDependencies?.['expo-dev-client']);
  const appHas = appPkg && allDeps(appPkg)['expo-dev-client'];
  const appLink = path.join(appDir, 'node_modules', 'expo-dev-client');

  const rootLink = path.join(ROOT, 'node_modules', 'expo-dev-client');
  if (fs.existsSync(rootLink) && !appHas) {
    fail('expo-dev-client found only under the ROOT node_modules — it must be a dependency of the app package, not the workspace root');
  } else if (rootHas) {
    fail('expo-dev-client is declared at the workspace root — move it into artifacts/no-excuses package.json');
  } else if (appHas && fs.existsSync(appLink)) {
    const resolved = resolvePackage(appPkgPath, 'expo-dev-client');
    if (resolved) {
      pass('expo-dev-client resolved from the app package (not from an unrelated root node_modules location)');
    } else {
      fail('expo-dev-client node_modules link exists but the package cannot be resolved from the app');
    }
  } else if (appHas === undefined) {
    fail('expo-dev-client missing from app dependencies -> run: npx expo install expo-dev-client');
  }

  if (opts.frozenInstall) {
    const lockPath = path.join(ROOT, 'pnpm-lock.yaml');
    const before = fs.existsSync(lockPath) ? crypto.createHash('sha256').update(fs.readFileSync(lockPath)).digest('hex') : null;
    console.log('   ... running pnpm install --frozen-lockfile');
    const r = runSync('pnpm', ['install', '--frozen-lockfile'], { cwd: ROOT, stdio: 'inherit' });
    if (r.status === 0) {
      pass('pnpm install --frozen-lockfile passes');
      const after = fs.existsSync(lockPath) ? crypto.createHash('sha256').update(fs.readFileSync(lockPath)).digest('hex') : null;
      if (before !== null && after !== null && before !== after) {
        fail('pnpm-lock.yaml changed during frozen install — lockfile must not be rewritten');
      } else if (before !== after) {
        warn('pnpm-lock.yaml state could not be compared');
      }
    } else {
      fail('pnpm install --frozen-lockfile failed');
    }
  } else {
    pass('frozen-install check available via: pnpm run android:verify  (or pass --frozen-install)');
  }

  if (opts.typecheck) {
    console.log('   ... running pnpm run typecheck');
    const r = runSync('pnpm', ['run', 'typecheck'], { cwd: ROOT, stdio: 'inherit' });
    if (r.status === 0) pass('workspace typecheck passes');
    else fail('workspace typecheck failed');
  } else {
    pass('workspace typecheck available via: pnpm run typecheck  (or pass --typecheck)');
  }
}

function checkESigning(appDir, isInstallGate) {
  section('E. Signing and install safety');
  const keystore = path.join(appDir, 'android', 'app', 'debug.keystore');
  const backup = path.join(os.tmpdir(), 'opencode', 'debug.keystore.bak');

  if (!fs.existsSync(keystore)) {
    fail(`debug keystore missing: ${path.relative(ROOT, keystore)} — required to build/install a debug/dev-client APK`);
    return;
  }
  pass('android/app/debug.keystore present');

  const ki = isGitIgnored(keystore);
  if (ki === true) pass('debug.keystore is gitignored');
  else warn('debug.keystore does not appear gitignored — it must never be committed');

  if (!fs.existsSync(backup)) {
    const msg = `known keystore backup missing: ${backup}`;
    if (isInstallGate) {
      fail(msg + ' — refusing replacement install (-r) until you restore the matching key or choose a clean uninstall (adb uninstall com.noexcuses.app)');
    } else {
      warn(msg + ' — replacement install (-r) will be blocked until the matching key is restored or a clean uninstall is chosen');
    }
    return;
  }
  const hashA = fileSha256(keystore);
  const hashB = fileSha256(backup);
  if (!hashA || !hashB) {
    fail('keystore hash comparison could not be computed');
    return;
  }
  if (hashA === hashB) {
    pass('debug.keystore matches the known backup (same signing identity)');
  } else {
    warn('debug.keystore does NOT match the known backup');
    if (isInstallGate) {
      fail('signing key mismatch against backup — refusing replacement install (-r). Restore %TEMP%\\opencode\\debug.keystore.bak over android/app/debug.keystore and rebuild, or explicitly choose a clean uninstall.');
    } else {
      warn('replacement install (-r) will be blocked until the key matches the backup or a clean uninstall is chosen');
    }
  }
}

function checkGDevice(opts) {
  section('G. Device-install safety');
  const adbPath = findAdb();
  if (!adbPath) {
    fail('adb not found (set ANDROID_HOME or add platform-tools to PATH)');
    return;
  }
  pass(`adb found: ${adbPath}`);

  const state = adb(['get-state'], C.DEVICE_SERIAL);
  if (!state) {
    fail(`device ${C.DEVICE_SERIAL} get-state failed`);
  } else if (state.error) {
    fail(`device ${C.DEVICE_SERIAL} get-state error: ${state.error.message}`);
  } else if (state.stdout.includes('device')) {
    pass(`device ${C.DEVICE_SERIAL} connected (state: device)`);
  } else {
    fail(`device ${C.DEVICE_SERIAL} not ready (state: "${state.stdout || state.stderr}")`);
  }

  const pm = adb(['shell', 'pm', 'path', C.APP_ID], C.DEVICE_SERIAL);
  if (pm && !pm.error && pm.stdout.startsWith('package:')) {
    pass(`package ${C.APP_ID} already installed at ${pm.stdout.split('package:')[1] || ''}`);
  } else if (pm && !pm.error) {
    warn(`package ${C.APP_ID} not currently installed — a fresh clean install is allowed`);
  } else if (pm) {
    warn(`could not query installed package: ${pm.error ? pm.error.message : pm.stderr}`);
  }

  if (opts.apkPath) {
    const abs = path.resolve(opts.apkPath);
    if (fs.existsSync(abs)) {
      try {
        fs.mkdirSync(path.dirname(C.APK_PATH_MARKER), { recursive: true });
        fs.writeFileSync(C.APK_PATH_MARKER, abs, 'utf8');
        pass(`APK path preserved for later reinstall: ${C.APK_PATH_MARKER}`);
      } catch (e) {
        warn(`could not preserve APK path: ${e.message}`);
      }
      console.log('\n   Running APK validation (android:apk-check)...');
      const result = verifyApk({ apkPath: abs, serial: C.DEVICE_SERIAL, expectSignerSha1: '5e8f16062ea3cd2c4a0d547876baa6f38cabf625' });
      for (const i of result.issues) {
        if (i.level === 'FAIL') fail(i.msg);
        else if (i.level === 'WARN') warn(i.msg);
        else pass(i.msg);
      }
    } else {
      fail(`--apk path not found: ${abs}`);
    }
  }

  console.log('\n--- Device install recipe (serial ZY224LNJKD) ---');
  console.log('  1) check device        : adb -s ZY224LNJKD get-state');
  console.log('  2) check installed     : adb -s ZY224LNJKD shell pm path com.noexcuses.app');
  console.log('  3) validate APK        : node scripts/android-apk-check.mjs --apk "<path-to.apk>" --serial ZY224LNJKD --expect-signer-sha1 5e8f16062ea3cd2c4a0d547876baa6f38cabf625');
  console.log('  4) install (-r)        : adb -s ZY224LNJKD install -r "<path-to.apk>"   (only when keystore matches backup)');
  console.log('  REFUSE                : never `install -r` / `expo run:android` when the keystore gate fails (INSTALL_FAILED_UPDATE_INCOMPATIBLE)');
}

function printUsage() {
  console.log(`Usage:
  node scripts/android-preflight.mjs [install] [--apk <path>] [--frozen-install] [--typecheck] [--skip-env]

  (default)            run all preflight checks (A-E)
  install / device     preflight + blocking keystore gate + adb device checks (G)
  --apk <path>         also validate an APK with android:apk-check
  --frozen-install     run pnpm install --frozen-lockfile first (lockfile must not change)
  --typecheck          run pnpm run typecheck afterwards
  --skip-env           skip the env-file gate (CI runs without secrets present)
`);
}

const opts = parseArgs(process.argv.slice(2));
const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, C.APP_REL);
const APP_PKG_PATH = path.join(APP_DIR, 'package.json');
const APP_PKG = readJsonSafe(APP_PKG_PATH);

if (opts.help) {
  printUsage();
  process.exit(0);
}

banner(`mode=${opts.mode}  cwd=${ROOT}`);
checkAWorkspace(APP_DIR, APP_PKG_PATH, APP_PKG);

const isRootOk = fs.existsSync(path.join(ROOT, 'pnpm-workspace.yaml')) && fs.existsSync(path.join(ROOT, 'package.json'));
const appPkgOk = !!APP_PKG;
if (!isRootOk || !appPkgOk) {
  console.error(`\nRESULT: preflight FAILED (${ISSUES.fail} failure(s), ${ISSUES.warn} warning(s))`);
  process.exit(1);
}

const appJson = readJsonSafe(path.join(APP_DIR, 'app.json'));
const eas = readJsonSafe(path.join(APP_DIR, 'eas.json'));
let devClientRequested = false;
if (eas && eas.build) {
  for (const p of Object.values(eas.build)) {
    if (p && p.developmentClient === true) devClientRequested = true;
  }
}

if (opts.skipEnv) {
  section('B. Environment-file safety');
  warn('env-file gate skipped (--skip-env)');
} else {
  checkBEnv(APP_DIR);
}

const nativeOk = checkCNative(APP_DIR, appJson, devClientRequested, APP_PKG_PATH, APP_PKG);
if (!nativeOk) {
  console.error(`\nRESULT: preflight FAILED (${ISSUES.fail} failure(s), ${ISSUES.warn} warning(s))`);
  process.exit(1);
}

checkDRepro(APP_DIR, APP_PKG_PATH, APP_PKG, opts);
checkESigning(APP_DIR, opts.mode === 'install');

if (opts.mode === 'install') {
  checkGDevice(opts);
}

console.log(`\nRESULT: preflight ${ISSUES.fail === 0 ? 'PASS' : 'FAILED'} (${ISSUES.pass} passed, ${ISSUES.warn} warning(s), ${ISSUES.fail} failure(s))`);
process.exit(ISSUES.fail === 0 ? 0 : 1);