@logic
Feature: Enforcing an open-plugin's read custody on pi
  As a pi user running an open-plugin
  I want the plugin's read-custody hook to gate read tool calls on pi
  So that the plugin's read rules hold on pi as on a runtime that runs the plugin natively

  Background:
    Given the shim runs an open-plugin whose read-custody hook denies the role "crew" reading "CAPTAIN.md" and permits the role "boatswain"

  Scenario: The shim blocks a read the hook denies
    Given the host acts as the role "crew"
    When a read tool call opens "CAPTAIN.md"
    Then the shim blocks the read
    And the block reason carries the hook's denial message

  Scenario: The shim allows a read the hook permits
    Given the host acts as the role "boatswain"
    When a read tool call opens "CAPTAIN.md"
    Then the shim allows the read

  Scenario: The shim leaves an ungated host read alone
    Given the host acts with no plugin role
    When a read tool call opens "CAPTAIN.md"
    Then the shim allows the read

  Scenario: The shim synchronously blocks a read the hook denies
    Given the host acts as the role "crew"
    When a read tool call synchronously opens "CAPTAIN.md"
    Then the shim blocks the read
    And the block reason carries the hook's denial message

  Scenario: The shim synchronously allows a read the hook permits
    Given the host acts as the role "boatswain"
    When a read tool call synchronously opens "CAPTAIN.md"
    Then the shim allows the read
