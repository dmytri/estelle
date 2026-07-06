@logic
Feature: Seat command custody
  As Estelle
  I want each seat limited to the git commands its role may run
  So that only the Boatswain commits locally and outbound stays Captain-only

  The internal seats (Quartermaster, Crew, Boatswain, Shipwright) are gated by
  the installed Shipshape plugin's command-custody hook, run through the shim,
  so Estelle enforces the plugin's real custody rather than a hand-rolled copy.
  The gate holds on the seat's own tool call in the running session, the path a
  seat takes when it acts, not a test-facing method.

  Background:
    Given a started Estelle session with the Shipshape plugin installed

  Scenario: The Boatswain may commit locally
    Given the active seat is the Boatswain "Bellamy"
    When Bellamy runs "git commit -m batch" in the running session
    Then the running session allows the command

  Scenario: The Quartermaster may not commit
    Given the active seat is the Quartermaster "Misson"
    When Misson runs "git commit -m batch" in the running session
    Then the running session blocks the command
    And the block reason carries the Shipshape plugin's denial "Boatswain holds local commit custody"

  Scenario: A Crew hand may not push
    Given the active seat is a Crew hand
    When the Crew hand runs "git push origin main" in the running session
    Then the running session blocks the command
    And the block reason carries the Shipshape plugin's denial "Outbound is Captain-only and requires explicit user approval"

  Scenario: The Boatswain may not push
    Given the active seat is the Boatswain "Bellamy"
    When Bellamy runs "git push origin main" in the running session
    Then the running session blocks the command
    And the block reason carries the Shipshape plugin's denial "Outbound is Captain-only and requires explicit user approval"
