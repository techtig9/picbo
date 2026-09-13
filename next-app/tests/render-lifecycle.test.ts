import {test} from "node:test";
import assert from "node:assert/strict";
import {renderBackoffMs} from "../lib/render/lifecycle";

test("render backoff grows exponentially with attempt count",()=>{
  assert.equal(renderBackoffMs(1),30_000);
  assert.equal(renderBackoffMs(2),60_000);
  assert.equal(renderBackoffMs(3),120_000);
});

test("render backoff is capped at 10 minutes",()=>{
  assert.equal(renderBackoffMs(10),10*60_000);
  assert.equal(renderBackoffMs(20),10*60_000);
});

test("render backoff never goes negative for attempts<=0",()=>{
  assert.equal(renderBackoffMs(0),30_000);
  assert.ok(renderBackoffMs(-5)>=30_000);
});
