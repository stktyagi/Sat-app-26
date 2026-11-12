import test from "node:test";
import assert from "node:assert/strict";
import {
  SUPPORT_CATEGORIES,
  SUPPORT_NODES,
  FEST_COORDINATORS,
  searchSupportTree,
} from "../data/supportDecisionTree.ts";

test("supportDecisionTree: categories are well-formed and link to valid root nodes", () => {
  assert.ok(SUPPORT_CATEGORIES.length >= 4, "Expected at least 4 categories");

  for (const cat of SUPPORT_CATEGORIES) {
    assert.ok(cat.id, "Category must have an id");
    assert.ok(cat.title, "Category must have a title");
    assert.ok(cat.rootNodeId, "Category must have a rootNodeId");
    assert.ok(
      SUPPORT_NODES[cat.rootNodeId],
      `Root node ${cat.rootNodeId} for category ${cat.id} must exist in SUPPORT_NODES`
    );
  }
});

test("supportDecisionTree: all option targets exist in SUPPORT_NODES", () => {
  for (const [nodeId, node] of Object.entries(SUPPORT_NODES)) {
    if (node.options) {
      for (const opt of node.options) {
        assert.ok(
          SUPPORT_NODES[opt.targetNodeId],
          `Option target ${opt.targetNodeId} in node ${nodeId} must exist in SUPPORT_NODES`
        );
      }
    }
  }
});

test("supportDecisionTree: all resolutions and escalations are valid", () => {
  for (const [nodeId, node] of Object.entries(SUPPORT_NODES)) {
    if (node.type === "resolution") {
      assert.ok(node.resolution, `Resolution node ${nodeId} must have resolution content`);
      assert.ok(node.resolution.title, `Resolution node ${nodeId} must have a title`);
      assert.ok(node.resolution.steps.length > 0, `Resolution node ${nodeId} must have steps`);

      if (node.resolution.escalationNodeId) {
        assert.ok(
          SUPPORT_NODES[node.resolution.escalationNodeId],
          `Escalation target ${node.resolution.escalationNodeId} in node ${nodeId} must exist in SUPPORT_NODES`
        );
      }
    }
  }
});

test("supportDecisionTree: all contact nodes refer to valid FEST_COORDINATORS with name and phone", () => {
  for (const [nodeId, node] of Object.entries(SUPPORT_NODES)) {
    if (node.type === "contact") {
      assert.ok(node.contact, `Contact node ${nodeId} must have contact content`);
      const coordIds = node.contact.coordinatorIds || (node.contact.coordinatorId ? [node.contact.coordinatorId] : []);
      assert.ok(coordIds.length > 0, `Contact node ${nodeId} must have at least one coordinator ID`);

      for (const cid of coordIds) {
        const coordinator = FEST_COORDINATORS[cid];
        assert.ok(coordinator, `Coordinator ${cid} in node ${nodeId} must exist in FEST_COORDINATORS`);
        assert.ok(coordinator.name, `Coordinator ${cid} must have a name`);
        assert.ok(coordinator.phone, `Coordinator ${cid} must have a phone number`);
      }
    }
  }
});

test("supportDecisionTree: coordinator directory matches user specifications", () => {
  // Events
  assert.equal(FEST_COORDINATORS.sivansh.name, "Sivansh Satpathy");
  assert.equal(FEST_COORDINATORS.sivansh.phone, "+91 87796 87009");
  assert.equal(FEST_COORDINATORS.aniket.name, "Aniket Gupta");
  assert.equal(FEST_COORDINATORS.aniket.phone, "+91 93507 16440");

  // Hospitality
  assert.equal(FEST_COORDINATORS.aarush.name, "Aarush");
  assert.equal(FEST_COORDINATORS.aarush.phone, "+91 98769 72101");
  assert.equal(FEST_COORDINATORS.aadil.name, "Aadil");
  assert.equal(FEST_COORDINATORS.aadil.phone, "+91 98721 00693");

  // Payments and App bugs
  assert.equal(FEST_COORDINATORS.rakshit.name, "Rakshit Dhamija");
  assert.equal(FEST_COORDINATORS.rakshit.phone, "+91 95013 49322");
});

test("supportDecisionTree: mess timings node is present in accommodation with exact requested schedule", () => {
  const messNode = SUPPORT_NODES["node_acc_mess_res"];
  assert.ok(messNode, "node_acc_mess_res must exist");
  assert.equal(messNode.category, "accommodation");
  assert.equal(messNode.resolution?.description, "Meals are served in your respective hostels allotted.");
  assert.ok(messNode.resolution?.steps.includes("Breakfast : 7:00 AM – 9:00 AM"));
  assert.ok(messNode.resolution?.steps.includes("Lunch : 12:00 PM – 2:00 PM"));
  assert.ok(messNode.resolution?.steps.includes("Dinner : 7:00 PM – 9:00 PM"));
  assert.ok(messNode.resolution?.steps.includes("Breakfast : 7:30 AM – 9:30 AM"));
  assert.ok(messNode.resolution?.steps.includes("Lunch : 12:30 PM – 2:30 PM"));
  assert.equal(messNode.resolution?.mealSchedule?.[0].slots[0].time, "7:00 AM – 9:00 AM");
  assert.equal(messNode.resolution?.mealSchedule?.[1].slots[0].time, "7:30 AM – 9:30 AM");
});

test("searchSupportTree: keyword search returns relevant results", () => {
  const payResults = searchSupportTree("payment");
  assert.ok(payResults.length > 0, "Expected search results for 'payment'");
  assert.ok(payResults.some((r) => r.category === "payments"));

  const messResults = searchSupportTree("mess");
  assert.ok(messResults.length > 0, "Expected search results for 'mess'");
  assert.ok(messResults.some((r) => r.category === "accommodation"));

  const hostelResults = searchSupportTree("hostel");
  assert.ok(hostelResults.length > 0, "Expected search results for 'hostel'");
  assert.ok(hostelResults.some((r) => r.category === "accommodation"));

  const emptyResults = searchSupportTree("a");
  assert.equal(emptyResults.length, 0, "Single character should return empty results");
});
