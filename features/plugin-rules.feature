@logic
Feature: Plugin rule consumption
  As Estelle
  I want the installed Shipshape plugin's rule files to reach the seat
  So that the plugin's per-role and always-apply checklists steer the seat as upstream intends

  The installed plugin ships "rules/*.mdc": one checklist per role plus an
  always-apply "shipshape" checklist. The shim reports the plugin's commands
  and agents but drops its rules, so no rule reaches any seat. Captain directs
  reconnecting every surface pi can consume, so the shim reports the plugin's
  rules and the flagship carries the acting seat's role rule and the
  always-apply rule into that seat's system prompt.

  Scenario: The shim reports the installed plugin's rules
    Given the shim runs an open-plugin that ships a rule "captain" and an always-apply rule "shipshape"
    When the shim reports the plugin's rules
    Then the reported rules include "captain"
    And the reported rules include "shipshape"

  Scenario: The Captain seat prompt carries the plugin's captain rule
    Given a started Estelle session with the Shipshape plugin installed
    And the active seat is the Captain "Bonny"
    Then the seat system prompt includes the plugin's "captain" rule
    And the seat system prompt includes the plugin's always-apply "shipshape" rule

  Scenario: The Quartermaster seat prompt carries the plugin's quartermaster rule
    Given a started Estelle session with the Shipshape plugin installed
    And the active seat is the Quartermaster "Misson"
    Then the seat system prompt includes the plugin's "qm" rule
    And the seat system prompt excludes the plugin's "captain" rule
