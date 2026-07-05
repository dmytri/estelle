@logic
Feature: Running an open-plugin's PostToolUse hooks on pi
  As a pi user running an open-plugin
  I want the shim to run the plugin's PostToolUse hooks after a tool call, without blocking it
  So that a plugin's after-the-fact hooks, such as feature-quality or nudges, run on pi

  Scenario: The shim runs a matching PostToolUse hook after the tool call
    Given the shim runs an open-plugin whose PostToolUse "Bash" hook emits "batch shipped" on a push command
    When a Bash tool call "git push origin main" completes
    Then the plugin's PostToolUse hook output carries "batch shipped"

  Scenario: A PostToolUse hook does not block the tool call
    Given the shim runs an open-plugin whose PostToolUse "Bash" hook exits non-zero
    When a Bash tool call "git push origin main" completes
    Then the tool call is not blocked

  Scenario: The shim skips a PostToolUse hook whose matcher does not match
    Given the shim runs an open-plugin whose only PostToolUse matcher is "Bash"
    When a write tool call to "src/x.ts" completes
    Then no PostToolUse hook runs
