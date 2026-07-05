@logic
Feature: Seat write custody
  As Estelle
  I want each seat limited to the files its role may write
  So that custody holds without trusting discipline

  The internal seats (Quartermaster, Crew, Boatswain, Shipwright) are gated by
  the installed Shipshape plugin's write-custody hook, run through the shim, so
  Estelle enforces the plugin's real custody rather than a hand-rolled copy. The
  Captain seat is gated by Estelle's flagship layer, because the plugin leaves
  the Captain ungated by design.

  Background:
    Given a started Estelle session with the Shipshape plugin installed

  Scenario: The Crew may write production code
    Given the active seat is a Crew hand
    When the Crew hand writes "src/pay.ts"
    Then Estelle allows the write

  Scenario: The Crew may not write a specification
    Given the active seat is a Crew hand
    When the Crew hand attempts to write "features/pay.feature"
    Then Estelle blocks the write
    And the block reason carries the Shipshape plugin's denial "Captain writes specs"

  Scenario: The Quartermaster may not write production code
    Given the active seat is the Quartermaster "Misson"
    When Misson attempts to write "src/pay.ts"
    Then Estelle blocks the write
    And the block reason carries the Shipshape plugin's denial "Production code belongs to Crew"

  Scenario: The Quartermaster may not write the watchbill
    Given the active seat is the Quartermaster "Misson"
    When Misson attempts to write "watchbill.json"
    Then Estelle blocks the write
    And the block reason carries the Shipshape plugin's denial "Captain-custodied or configuration artifact"

  Scenario: The Captain may not write production code
    Given the active seat is the Captain "Bonny"
    When Bonny attempts to write "src/sneaky.ts"
    Then Estelle blocks the write
    And the block reason names the Captain's write scope
