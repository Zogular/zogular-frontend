"use strict";
/* eslint-disable @typescript-eslint/no-require-imports -- This Node CommonJS preload and its canaries load synchronously. */

// Trusted Next fixture only: this is a Node transport guard, not an OS sandbox.
const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");
const { spawn, spawnSync } = require("node:child_process");
const { once } = require("node:events");
const repo = path.resolve(__dirname, "../..");
const host = "127.0.0.1", appPort = 3244, apiPort = 5044;
const api = "http://127.0.0.1:5044/api/v1";
const cli = path.join(repo, "node_modules/next/dist/bin/next");

// Node http/undici may supply normalized [options, callback] to Socket.connect.
// Reconstruct the destination: never forward path, fd, lookup or alternative host.
function guardedConnect(connect, deny) {
  return function (...args) {
    const parts = Array.isArray(args[0]) ? args[0] : args;
    const opt = typeof parts[0] === "object" ? parts[0] : {port:parts[0], host:parts[1]};
    if (!opt || opt.host !== host || opt.path != null || opt.socketPath != null ||
        ![appPort, apiPort, String(appPort), String(apiPort)].includes(opt.port)) return deny();
    const callback = args.findLast(v => typeof v === "function") ?? parts.findLast(v => typeof v === "function");
    return connect.call(this, {host, port:Number(opt.port), family:4}, ...(callback ? [callback] : []));
  };
}

// Loaded before the fixed CLI and inherited by its Node workers. An attempted
// prohibited dial ends the process even if application code would catch an error.
const gateActive = module.isPreloading;
if (gateActive) {
  const deny = () => process.exit(78);
  Object.defineProperty(net.Socket.prototype, "connect", {
    value:guardedConnect(net.Socket.prototype.connect, deny), configurable:false, writable:false,
  });
  const listen = net.Server.prototype.listen;
  Object.defineProperty(net.Server.prototype,"listen",{
    value:function (port,address,...rest) {
      if (port !== appPort || address !== host) return deny();
      return listen.call(this,port,host,...rest);
    },configurable:false,writable:false,
  });
  const udp = require("node:dgram");
  udp.createSocket = udp.Socket.prototype.send = udp.Socket.prototype.connect = udp.Socket.prototype.bind = deny;
  require("node:tls").connect = deny;
  const dns = require("node:dns");
  for (const target of [dns,dns.promises,dns.Resolver.prototype,dns.promises.Resolver.prototype]) {
    for (const key of Object.getOwnPropertyNames(target)) {
      if (!/^(lookup|resolve|reverse)/.test(key) || typeof target[key] !== "function") continue;
      const original = target[key];
      // Node's listen(host) calls lookup even on literal IPv4; its isIP fast
      // path returns the literal on nextTick without consulting any resolver.
      target[key] = key === "lookup" ? function (address,...args) {
        return address === host ? original.call(this,host,...args) : deny();
      } : deny;
    }
  }
  require("node:module").syncBuiltinESMExports();
}

function standalone() {
  const names = fs.readdirSync(repo);
  if (names.some(n => /^(?:\.git$|\.env(?:\.|$)|\.next$)/i.test(n)) ||
      [repo, cli, __filename].some(p => fs.realpathSync.native(p) !== p)) {
    throw Error("Fresh physical Access scratch required");
  }
}

// The only launch capability is returned by a successful fresh build. No
// build selector, supplied env, prebuilt output or separately editable receipt.
/** @returns {() => import("node:child_process").ChildProcessByStdio<null, import("node:stream").Readable, null>} */
function prepareApplication() {
  standalone();
  const temp = fs.mkdtempSync(path.join(path.dirname(repo), "fixture-"));
  const fonts = path.join(temp, "fonts.json"), responses = {};
  for (const family of ["Inter","Geist","Geist Mono"]) {
    const font = path.join(repo, "node_modules/next/dist/next-devtools/server/font",
      family === "Geist Mono" ? "geist-mono-latin.woff2" : "geist-latin.woff2");
    if (fs.realpathSync.native(font) !== font) throw Error("Unexpected fixture font");
    // Next's installed test loader reads slash-prefixed local files on the cwd drive.
    const local = font.replace(/^[A-Za-z]:/, "").replaceAll("\\", "/");
    responses["https://fonts.googleapis.com/css2?family="+family.replaceAll(" ","+")+":wght@100..900&display=swap"] =
      "/* latin */\n@font-face {\n font-family: '"+family+"';\n font-weight: 100 900;\n src: url("+local+") format('woff2');\n}";
  }
  fs.writeFileSync(fonts, JSON.stringify(responses), {flag:"wx"});
  const env = {
    ...(process.platform === "win32" ? {SystemRoot:"C:\\Windows"} : {}),
    TEMP:temp,TMP:temp,TMPDIR:temp,NODE_ENV:"production",NO_COLOR:"1",NEXT_TELEMETRY_DISABLED:"1",
    ADMIN_API_URL:api, INTERNAL_BACKEND_URL:api, NEXT_PUBLIC_API_URL:api,
    NEXT_PUBLIC_API_PROXY_URL:"/api/backend", ADMIN_AUTH_SESSION_ENDPOINT:"/user/me",
    NODE_OPTIONS:'--require "'+__filename.replaceAll("\\","/")+'"',
  };
  const bootstrap = path.join(temp,"checked-next.cjs");
  fs.writeFileSync(bootstrap,"if(!require("+JSON.stringify(__filename)+").gateActive)process.exit(78);"+
    "process.argv[1]="+JSON.stringify(cli)+";require(process.argv[1]);",{flag:"wx"});
  const result = spawnSync(process.execPath,[bootstrap,"build","--webpack"],{cwd:repo,
    env:{...env,NEXT_FONT_GOOGLE_MOCKED_RESPONSES:fonts},stdio:"ignore",windowsHide:true,timeout:300000,killSignal:"SIGKILL"});
  if (result.error || result.status !== 0 || result.signal) throw Error("Private loopback Access build failed");
  const id = path.join(repo,".next/BUILD_ID");
  if (fs.realpathSync.native(id) !== id || !fs.statSync(id).size) throw Error("Missing fresh Access build");
  let used = false;
  return () => {
    if (used) throw Error("Access launch already consumed");
    used = true;
    return spawn(process.execPath,[bootstrap,"start","--hostname",host,"--port",String(appPort)],
      {cwd:repo,env,windowsHide:true,stdio:["ignore","pipe","ignore"]});
  };
}

async function vacancy(port) {
  const probe = net.createServer();
  const listening = once(probe,"listening");
  probe.listen({host,port,exclusive:true});
  await listening;
  const closed = once(probe,"close");
  probe.close();
  await closed;
}

async function bounded(task, ms) {
  let timer;
  try {
    await Promise.race([Promise.resolve().then(task),new Promise((_,reject) => {
      timer=setTimeout(() => reject(Error("Access disposal deadline")),ms);
    })]);
  } finally { clearTimeout(timer); }
}

async function dispose(child, fixture, probe = vacancy, ms = 2000) {
  const failures = [];
  async function check(label,task) {
    try { await bounded(task,ms); } catch { failures.push(label); }
  }
  const alive = () => child?.pid && child.exitCode === null && child.signalCode === null;
  async function stop(signal) {
    const exited = once(child,"exit");
    if (!child.kill(signal)) throw Error("Access child signal refused");
    await exited;
  }
  await Promise.all([ (async () => {
    if (!alive()) {
      if (child) failures.push("unexpected child exit");
      return;
    }
    await check("child stop",() => stop("SIGTERM"));
    if (alive()) await check("child kill",() => stop("SIGKILL"));
  })(), check("API close",async () => {
    if (!fixture?.listening) return;
    const closed = once(fixture,"close");
    fixture.close();
    fixture.closeAllConnections();
    await closed;
  }) ]);
  await Promise.all([appPort,apiPort].map(port => check("vacancy "+port,() => probe(port))));
  if (failures.length) throw Error("Access fixture disposal unverified: "+failures.join(", "));
}

module.exports = {prepareApplication, guardedConnect, dispose, vacancy, gateActive};
