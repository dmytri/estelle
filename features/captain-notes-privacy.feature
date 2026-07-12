@logic
Feature: Captain notes privacy
  As Estelle
  I want "CAPTAIN.md" readable only by the seats the Articles permit
  So that the Captain private notes never leak across a seat

  The internal seats' reads of "CAPTAIN.md" are gated by the installed Shipshape
  plugin's captain-notes-guard hook, run through the shim, so Estelle enforces the
  plugin's real bulkhead rather than a hand-rolled copy. The Captain seat reads its
  own notes through Estelle's flagship layer. The gate holds on the seat's own tool
  call in the running session, the path a seat takes when it acts, not a test-facing
  method.

  Background:
    Given a started Estelle session with the Shipshape plugin installed
    And a project with a "CAPTAIN.md" file

  Scenario: The Captain reads their own notes
    Given the active seat is the Captain "Bonny"
    When Bonny reads "CAPTAIN.md" in the running session
    Then the running session allows the read
    And the contents of "CAPTAIN.md" are returned

  Scenario: The Boatswain may not read the Captain notes
    Given the active seat is the Boatswain "Bellamy"
    When Bellamy reads "CAPTAIN.md" in the running session
    Then the running session blocks the read
    And the block reason carries the Shipshape plugin's denial "MUST NOT read CAPTAIN.md"

  Scenario: The Quartermaster may not read the Captain notes
    Given the active seat is the Quartermaster "Misson"
    When Misson reads "CAPTAIN.md" in the running session
    Then the running session blocks the read
    And the block reason carries the Shipshape plugin's denial "MUST NOT read CAPTAIN.md"
