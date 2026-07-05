@logic
Feature: Captain notes privacy
  As Estelle
  I want "CAPTAIN.md" readable only by the seats the Articles permit
  So that the Captain private notes never leak across a seat

  The internal seats' reads of "CAPTAIN.md" are gated by the installed Shipshape
  plugin's captain-notes-guard hook, run through the shim, so Estelle enforces the
  plugin's real bulkhead rather than a hand-rolled copy. The Captain seat reads its
  own notes through Estelle's flagship layer.

  Background:
    Given a started Estelle session with the Shipshape plugin installed
    And a project with a "CAPTAIN.md" file

  Scenario: The Captain reads their own notes
    Given the active seat is the Captain "Bonny"
    When Bonny reads "CAPTAIN.md"
    Then Estelle allows the read
    And the contents of "CAPTAIN.md" are returned

  Scenario: The Boatswain may read the Captain notes for hygiene
    Given the active seat is the Boatswain "Bellamy"
    When Bellamy reads "CAPTAIN.md"
    Then Estelle allows the read

  Scenario: The Quartermaster may not read the Captain notes
    Given the active seat is the Quartermaster "Misson"
    When Misson attempts to read "CAPTAIN.md"
    Then Estelle blocks the read
    And the block reason carries the Shipshape plugin's denial "MUST NOT read CAPTAIN.md"
