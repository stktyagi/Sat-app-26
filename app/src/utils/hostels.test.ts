import test from "node:test";
import assert from "node:assert/strict";
import {
  HOSTEL_LIST,
  BOYS_HOSTELS,
  GIRLS_HOSTELS,
  findHostel,
  formatHostelName,
  formatHostelDisplay,
  matchHostelSearch,
  getHostelItemLabels,
} from "../data/hostels.ts";

test("HOSTEL_LIST contains all 19 hostels with correct mappings", () => {
  assert.equal(HOSTEL_LIST.length, 19);
  assert.equal(BOYS_HOSTELS.length, 12);
  assert.equal(GIRLS_HOSTELS.length, 7);

  // Check exceptions FRF and FRG
  const frf = findHostel("Hostel_FRF");
  assert.ok(frf);
  assert.equal(frf.oldName, "Hostel FRF");
  assert.equal(frf.newName, "");
  assert.equal(formatHostelName(frf), "Hostel FRF");

  const frg = findHostel("Hostel_FRG");
  assert.ok(frg);
  assert.equal(frg.oldName, "Hostel FRG");
  assert.equal(frg.newName, "");
  assert.equal(formatHostelName(frg), "Hostel FRG");
});

test("findHostel resolves by code, oldName, newName, and variations", () => {
  // Direct code
  assert.equal(findHostel("Hostel_A")?.newName, "Agira Hall");
  assert.equal(findHostel("hostel_a")?.newName, "Agira Hall");

  // Old name
  assert.equal(findHostel("Hostel A")?.code, "Hostel_A");
  assert.equal(findHostel("hostel b")?.code, "Hostel_B");

  // New name
  assert.equal(findHostel("Agira Hall")?.code, "Hostel_A");
  assert.equal(findHostel("tejas hall")?.code, "Hostel_J");

  // Single letter
  assert.equal(findHostel("A")?.code, "Hostel_A");
  assert.equal(findHostel("M")?.code, "Hostel_M");
});

test("formatHostelDisplay formats hostel name and room number cleanly", () => {
  assert.equal(
    formatHostelDisplay("Hostel_A", "102"),
    "Agira Hall (Hostel A) • Room 102"
  );
  assert.equal(
    formatHostelDisplay("Hostel_FRF", "304"),
    "Hostel FRF • Room 304"
  );
  assert.equal(
    formatHostelDisplay("Hostel_M", ""),
    "Anantam Hall (Hostel M)"
  );
});

test("matchHostelSearch searches by code, old name, new name, and room number", () => {
  assert.ok(matchHostelSearch("Hostel_A", "102", "agira"));
  assert.ok(matchHostelSearch("Hostel_A", "102", "hostel a"));
  assert.ok(matchHostelSearch("Hostel_A", "102", "102"));
  assert.ok(matchHostelSearch("Hostel_FRF", "12", "frf"));
  assert.ok(!matchHostelSearch("Hostel_A", "102", "unknown_search"));
});

test("getHostelItemLabels handles exceptions properly", () => {
  const agira = findHostel("Hostel_A")!;
  const agiraLabels = getHostelItemLabels(agira);
  assert.equal(agiraLabels.primary, "Agira Hall");
  assert.equal(agiraLabels.secondary, "Hostel A");

  const frf = findHostel("Hostel_FRF")!;
  const frfLabels = getHostelItemLabels(frf);
  assert.equal(frfLabels.primary, "Hostel FRF");
  assert.equal(frfLabels.secondary, undefined);
});
