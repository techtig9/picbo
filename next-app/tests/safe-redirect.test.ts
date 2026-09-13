import test from "node:test";
import assert from "node:assert/strict";
import {safeNextPath} from "../lib/auth/safe-redirect";

/**
 * Open-redirect defence for the OAuth callback's `next` parameter. The
 * callback runs on a freshly-authenticated request, which makes it the most
 * valuable open-redirect target in the app.
 */

test("a normal in-app path passes through",()=>{
  assert.equal(safeNextPath("/dashboard"),"/dashboard");
  assert.equal(safeNextPath("/create/image?mode=edit"),"/create/image?mode=edit");
});

test("absent or empty next falls back to the dashboard",()=>{
  assert.equal(safeNextPath(null),"/dashboard");
  assert.equal(safeNextPath(undefined),"/dashboard");
  assert.equal(safeNextPath(""),"/dashboard");
});

test("protocol-relative URLs are rejected",()=>{
  assert.equal(safeNextPath("//evil.com"),"/dashboard");
  assert.equal(safeNextPath("//evil.com/path"),"/dashboard");
});

test("absolute URLs are rejected",()=>{
  assert.equal(safeNextPath("https://evil.com"),"/dashboard");
  assert.equal(safeNextPath("http://evil.com"),"/dashboard");
});

test("scheme injection is rejected",()=>{
  assert.equal(safeNextPath("javascript:alert(1)"),"/dashboard");
  assert.equal(safeNextPath("data:text/html,<script>"),"/dashboard");
});

test("backslash variants are rejected",()=>{
  // Some browsers normalise \ to / before resolving, turning /\evil.com into //evil.com
  assert.equal(safeNextPath("/\\evil.com"),"/dashboard");
  assert.equal(safeNextPath("/\\/evil.com"),"/dashboard");
});

test("percent-encoded protocol-relative URLs are rejected",()=>{
  // Would otherwise pass a naive startsWith("//") check and only become
  // dangerous once the browser decoded it.
  assert.equal(safeNextPath("/%2f%2fevil.com"),"/dashboard");
  assert.equal(safeNextPath("%2f%2fevil.com"),"/dashboard");
});

test("double-encoded payloads are rejected",()=>{
  assert.equal(safeNextPath("/%252f%252fevil.com"),"/dashboard");
});

test("control characters and CRLF injection are rejected",()=>{
  assert.equal(safeNextPath("/dashboard\r\nSet-Cookie: a=b"),"/dashboard");
  assert.equal(safeNextPath("/dash\u0000board"),"/dashboard");
});

test("a custom fallback is honoured",()=>{
  assert.equal(safeNextPath("https://evil.com","/auth/sign-in"),"/auth/sign-in");
});

test("malformed percent-encoding falls back rather than throwing",()=>{
  assert.equal(safeNextPath("/%E0%A4%A"),"/dashboard");
});
