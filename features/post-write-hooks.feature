@logic
Feature: PostToolUse write-hook reconnection
  As Estelle
  I want the installed Shipshape plugin's PostToolUse Edit and Write hooks to run after a seat writes
  So that the plugin's feature-quality gate reaches the seat as upstream intends

  The shim's PostToolUse dispatch is tool-agnostic and matches the plugin's
  "Edit|Write|MultiEdit" entry, which runs the feature-quality hook. Estelle's
  tool_result seam dispatches PostToolUse only for the "bash" tool, so a write
  or edit never triggers the plugin's feature-quality output. Captain directs
  reconnecting every hook surface pi can consume, so a seat's write runs the
  plugin's PostToolUse write hook and its output reaches the seat.

  Scenario: A write tool call runs the plugin's PostToolUse write hook
    Given a started Estelle session with the Shipshape plugin installed
    And the active seat is the Captain "Bonny"
    When Bonny's write tool call to "features/login.feature" completes in the running session
    Then the plugin's PostToolUse feature-quality output is delivered into the session context

  Scenario: An edit tool call runs the plugin's PostToolUse write hook
    Given a started Estelle session with the Shipshape plugin installed
    And the active seat is the Captain "Bonny"
    When Bonny's edit tool call to "features/login.feature" completes in the running session
    Then the plugin's PostToolUse feature-quality output is delivered into the session context
