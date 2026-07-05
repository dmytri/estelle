@logic
Feature: Running an open-plugin's SessionStart hooks on pi
  As a pi user running an open-plugin
  I want the shim to run the plugin's SessionStart hooks when a pi session starts
  So that a plugin's orientation and validation hooks run on pi

  Scenario: The shim runs every SessionStart hook the plugin stacks
    Given the shim runs an open-plugin whose SessionStart entry stacks a hook that emits "orient" and a hook that emits "validate"
    When a pi session starts
    Then the SessionStart hook output carries "orient"
    And the SessionStart hook output carries "validate"

  Scenario: A SessionStart hook does not block the session
    Given the shim runs an open-plugin whose SessionStart hook exits non-zero
    When a pi session starts
    Then the session is not blocked
