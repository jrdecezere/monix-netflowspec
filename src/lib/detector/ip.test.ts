import assert from "node:assert/strict";
import { test } from "node:test";
import { formatIPv4, longestMatch, parseCidr, parseIPv4 } from "./ip";

test("parseIPv4 valida e converte", () => {
  assert.equal(parseIPv4("0.0.0.0"), 0);
  assert.equal(parseIPv4("255.255.255.255"), 4294967295);
  assert.equal(formatIPv4(parseIPv4("203.0.113.77")!), "203.0.113.77");
  assert.equal(parseIPv4("256.1.1.1"), null);
  assert.equal(parseIPv4("1.2.3"), null);
  assert.equal(parseIPv4("a.b.c.d"), null);
});

test("parseCidr normaliza e rejeita lixo", () => {
  assert.equal(parseCidr("203.0.113.77/24")?.cidr, "203.0.113.0/24");
  assert.equal(parseCidr("203.0.113.5")?.cidr, "203.0.113.5/32");
  assert.equal(parseCidr("10.0.0.0/8")?.bits, 8);
  assert.equal(parseCidr("10.0.0.0/0"), null);
  assert.equal(parseCidr("10.0.0.0/33"), null);
  assert.equal(parseCidr("10.0.0.0/"), null);
  assert.equal(parseCidr("10.0.0.0/8/8"), null);
  assert.equal(parseCidr("nada"), null);
});

test("longestMatch escolhe o prefixo mais específico", () => {
  const list = ["203.0.113.0/24", "203.0.113.64/26", "198.51.100.0/24"].map(
    (c) => ({ c, range: parseCidr(c)! }),
  );
  assert.equal(longestMatch("203.0.113.77", list)?.c, "203.0.113.64/26");
  assert.equal(longestMatch("203.0.113.5", list)?.c, "203.0.113.0/24");
  assert.equal(longestMatch("192.0.2.1", list), null);
});
