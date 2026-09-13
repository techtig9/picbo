import test from "node:test";
import assert from "node:assert/strict";
import {assertRenderOutputPath,RenderOutputPathError} from "../lib/render/output-path";

/**
 * The render worker is an external service that reports its own output
 * location. completeRenderJob() used to trust that path verbatim and create an
 * assets row for it under the job's workspace — so a path belonging to another
 * workspace would have handed this workspace a signed URL to another tenant's
 * file.
 */

const WS="11111111-2222-3333-4444-555555555555";
const OTHER="99999999-8888-7777-6666-555555555555";

test("a correctly-prefixed workspace path is accepted",()=>{
  const p=`${WS}/render-abc/output.mp4`;
  assert.equal(assertRenderOutputPath(p,WS),p);
});

test("a path in another workspace is rejected",()=>{
  assert.throws(
    ()=>assertRenderOutputPath(`${OTHER}/render-abc/output.mp4`,WS),
    (e:any)=>e instanceof RenderOutputPathError&&e.code==="OUTPUT_PATH_WORKSPACE_MISMATCH"
  );
});

test("path traversal out of the workspace prefix is rejected",()=>{
  // Satisfies startsWith() but resolves elsewhere — the reason the traversal
  // check runs before the prefix comparison.
  assert.throws(
    ()=>assertRenderOutputPath(`${WS}/../${OTHER}/output.mp4`,WS),
    (e:any)=>e.code==="PATH_TRAVERSAL"
  );
});

test("a single-dot segment is rejected",()=>{
  assert.throws(()=>assertRenderOutputPath(`${WS}/./output.mp4`,WS),(e:any)=>e.code==="PATH_TRAVERSAL");
});

test("an absolute path is rejected",()=>{
  assert.throws(
    ()=>assertRenderOutputPath(`/${WS}/output.mp4`,WS),
    (e:any)=>e.code==="INVALID_OUTPUT_PATH"
  );
});

test("backslashes are rejected",()=>{
  assert.throws(
    ()=>assertRenderOutputPath(`${WS}\\..\\${OTHER}\\output.mp4`,WS),
    (e:any)=>e.code==="INVALID_OUTPUT_PATH"
  );
});

test("a prefix that only looks like the workspace id is rejected",()=>{
  // "<uuid>-evil/..." must not satisfy the "<uuid>/" prefix.
  assert.throws(
    ()=>assertRenderOutputPath(`${WS}-evil/output.mp4`,WS),
    (e:any)=>e.code==="OUTPUT_PATH_WORKSPACE_MISMATCH"
  );
});

test("an empty or missing path is rejected",()=>{
  assert.throws(()=>assertRenderOutputPath("",WS),(e:any)=>e.code==="MISSING_OUTPUT_PATH");
  assert.throws(()=>assertRenderOutputPath(undefined as any,WS),(e:any)=>e.code==="MISSING_OUTPUT_PATH");
});

test("the workspace prefix alone, with no filename, is rejected",()=>{
  assert.throws(()=>assertRenderOutputPath(`${WS}/`,WS),(e:any)=>e.code==="INVALID_OUTPUT_PATH");
});

test("an absurdly long path is rejected",()=>{
  assert.throws(
    ()=>assertRenderOutputPath(`${WS}/${"a".repeat(1100)}.mp4`,WS),
    (e:any)=>e.code==="OUTPUT_PATH_TOO_LONG"
  );
});

test("a malformed workspace id is rejected rather than trusted",()=>{
  assert.throws(
    ()=>assertRenderOutputPath("anything/output.mp4","not-a-uuid"),
    (e:any)=>e.code==="INVALID_WORKSPACE"
  );
});
