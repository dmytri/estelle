@logic
Feature: Enforcing an open-plugin's command custody on pi
  As a pi user running an open-plugin
  I want the plugin's command-custody hook to gate Bash tool calls on pi
  So that the plugin's command rules hold on pi as on a runtime that runs the plugin natively

  Background:
    Given the shim runs an open-plugin whose command-custody hook lets only the role "boatswain" commit and denies every role a push

  Scenario: The shim blocks a command the hook denies
    Given the host acts as the role "crew"
    When a Bash tool call runs "git commit -m x"
    Then the shim blocks the command
    And the block reason carries the hook's denial message

  Scenario: The shim allows a command the hook permits
    Given the host acts as the role "boatswain"
    When a Bash tool call runs "git commit -m x"
    Then the shim allows the command

  Scenario: The shim blocks an outbound command even for a role that may commit
    Given the host acts as the role "boatswain"
    When a Bash tool call runs "git push origin main"
    Then the shim blocks the command

  Scenario: The shim leaves an ungated host command alone
    Given the host acts with no plugin role
    When a Bash tool call runs "git commit -m x"
    Then the shim allows the command
