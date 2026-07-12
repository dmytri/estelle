@logic
Feature: SessionStart hook reconnection
  As Estelle
  I want the installed Shipshape plugin's SessionStart hooks to run when a seat session starts
  So that role orientation, rigging validation, and the update nudge reach the seat as upstream intends

  The shim exposes a SessionStart dispatch that runs the plugin's
  "startup|clear" hooks (session-orient, rigging-validate, update-nudge) and
  returns their combined output. Estelle's session_start seam currently only
  activates the embark tool, so the plugin's orientation output never reaches
  the seat. Captain directs reconnecting every hook surface pi can consume, so
  the seat receives the plugin's SessionStart orientation on every fresh
  session.

  Scenario: A fresh seat session runs the plugin's SessionStart hooks
    Given a started Estelle session with the Shipshape plugin installed
    When a new Bonny session starts
    Then the plugin's SessionStart orientation is delivered into the session context
    And the orientation carries the plugin's rigging-validation output

  Scenario: A SessionStart hook that exits non-zero does not block the session
    Given a started Estelle session with the Shipshape plugin installed
    When a new Bonny session starts and a SessionStart hook exits non-zero
    Then the session still opens as the Captain "Bonny"
