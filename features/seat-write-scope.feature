@logic
Feature: Seat write custody
  As Estelle
  I want each seat limited to the files its role may write
  So that custody holds without trusting discipline

  Every seat, including the Captain, is gated by the installed Shipshape
  plugin's write-custody hook, run through the shim, so Estelle enforces the
  plugin's real custody rather than a hand-rolled copy. The plugin leaves the
  Captain open on production code, for perturbation, and on "RIGGING.md",
  denying only the verification directory. The gate holds on the seat's own tool
  call in the running session, the path a seat takes when it acts, not a
  test-facing method.

  Background:
    Given a started Estelle session with the Shipshape plugin installed

  Scenario: The Crew may write production code
    Given the active seat is a Crew hand
    When the Crew hand writes "src/pay.ts" in the running session
    Then the running session allows the write

  Scenario: The Crew may not write a specification
    Given the active seat is a Crew hand
    When the Crew hand writes "features/pay.feature" in the running session
    Then the running session blocks the write
    And the block reason carries the Shipshape plugin's denial "Captain writes specs"

  Scenario: The Quartermaster may not write production code
    Given the active seat is the Quartermaster "Misson"
    When Misson writes "src/pay.ts" in the running session
    Then the running session blocks the write
    And the block reason carries the Shipshape plugin's denial "Production code belongs to Crew"

  Scenario: The Quartermaster may not write the watchbill
    Given the active seat is the Quartermaster "Misson"
    When Misson writes "watchbill.json" in the running session
    Then the running session blocks the write
    And the block reason carries the Shipshape plugin's denial "Captain-custodied or configuration artifact"

  Scenario: The Captain may write a specification
    Given the active seat is the Captain "Bonny"
    When Bonny writes "features/pay.feature" in the running session
    Then the running session allows the write

  Scenario: The Captain may write production code
    Given the active seat is the Captain "Bonny"
    When Bonny writes "src/pay.ts" in the running session
    Then the running session allows the write

  Scenario: The Captain may not write the verification directory
    Given the active seat is the Captain "Bonny"
    When Bonny writes "features/steps/pay.steps.ts" in the running session
    Then the running session blocks the write
    And the block reason carries the Shipshape plugin's denial for the Captain writing verification support

  Scenario: The Captain may not write verification support through the session write seam
    Given the active seat is the Captain "Bonny"
    When Bonny writes "features/steps/pay.steps.ts" through the Estelle session write seam
    Then the session write seam blocks the write
    And the block reason carries the Shipshape plugin's denial for the Captain writing verification support

  Scenario: The Captain may write the rigging through the session write seam
    Given the active seat is the Captain "Bonny"
    When Bonny writes "RIGGING.md" through the Estelle session write seam
    Then the session write seam allows the write

  Scenario: The Captain may write production code through the session write seam
    Given the active seat is the Captain "Bonny"
    When Bonny writes "src/pay.ts" through the Estelle session write seam
    Then the session write seam allows the write
