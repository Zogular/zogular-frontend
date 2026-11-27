"use strict";
/* eslint-disable @typescript-eslint/no-require-imports -- This Node CommonJS preload and its canaries load synchronously. */
const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { spawnSync } = require("node:child_process");
const net = require("node:net");
const { guardedConnect, dispose, vacancy } = require("./access-fixture-launcher.cjs");

test("dial policy canonicalizes exact fixture sockets without DNS or real dials", () => {
  const calls = [];
  const dial = guardedConnect((...args) => calls.push(args), () => {throw Error("denied");});
  const cb=()=>{};
  dial(5044,"127.0.0.1",cb);
  dial([{port:"3244",host:"127.0.0.1",lookup:()=>assert.fail()},cb]);
  for(const [i,port] of [5044,3244].entries()) {
    assert.deepEqual(calls[i],[{port,host:"127.0.0.1",family:4},cb]);
  }
  for(const args of [[5044],[{host:"localhost",port:5044}],[{host:"example.invalid",port:443}],
    [{host:"::1",port:5044}],[{host:"127.0.0.1",port:3000}],[{path:"pipe",host:"127.0.0.1",port:5044}]]) {
    assert.throws(()=>dial(...args),/denied/);
  }
  assert.equal(calls.length,2);
});

test("production preload is active before the CLI; forbidden socket never reaches transport", () => {
  const file=require.resolve("./access-fixture-launcher.cjs");
  const result=spawnSync(process.execPath,["-r",file,"-e",
    "if(!require("+JSON.stringify(file)+").gateActive)process.exit(2);require('node:net').connect({host:'localhost',port:1})"],
    {env:{},stdio:"ignore",timeout:3000});
  assert.equal(result.status,78);
});

test("literal listen lookup succeeds locally; named lookup, UDP and wildcard listen fail closed", () => {
  const file=require.resolve("./access-fixture-launcher.cjs");
  for (const [code,status] of [
    ["require('node:dns').lookup('127.0.0.1',{all:true},(e,a)=>{if(e||a[0]?.address!=='127.0.0.1')process.exit(2)})",0],
    ["require('node:dns').lookup('localhost',()=>process.exit(2))",78],
    ["require('node:dgram').createSocket('udp4')",78],
    ["require('node:net').createServer().listen(3244,'0.0.0.0')",78],
  ]) {
    assert.equal(spawnSync(process.execPath,["-r",file,"-e",code],
      {env:{},stdio:"ignore",timeout:3000}).status,status);
  }
});

test("stalled child does not prevent fixture closure or either independent vacancy result", async () => {
  const child=Object.assign(new EventEmitter(),{pid:1,exitCode:null,signalCode:null});
  const fixture=Object.assign(new EventEmitter(),{listening:true});
  const calls=[];
  child.kill=signal=>{calls.push(signal);return true;};
  fixture.close=()=>{calls.push("close");queueMicrotask(()=>fixture.emit("close"));};
  fixture.closeAllConnections=()=>calls.push("connections");
  await assert.rejects(dispose(child,fixture,async port=>{calls.push(port);if(port===3244)throw Error();},10),
    /child stop, child kill, vacancy 3244/);
  assert.deepEqual(calls,["SIGTERM","close","connections","SIGKILL",3244,5044]);
});

test("unowned listener rejects the exclusive probe without a readiness request",async () => {
  const decoy=net.createServer(()=>assert.fail("unexpected probe connection"));
  await new Promise((resolve,reject)=>decoy.once("error",reject).listen({host:"127.0.0.1",port:3244,exclusive:true},resolve));
  try {await assert.rejects(vacancy(3244),{code:"EADDRINUSE"});}
  finally {await new Promise((resolve,reject)=>decoy.close(e=>e?reject(e):resolve()));}
  await vacancy(3244);
});

test("an unexpected child exit is not erased by subsequent port vacancy",async () => {
  const probes=[];
  await assert.rejects(dispose({pid:1,exitCode:78},null,async port=>probes.push(port)),/unexpected child exit/);
  assert.deepEqual(probes,[3244,5044]);
});
