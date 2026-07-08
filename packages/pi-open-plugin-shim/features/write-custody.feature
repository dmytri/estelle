@logic
Feature: Enforcing an open-plugin's write custody on pi
  As a pi user running an open-plugin
  I want the plugin's write-custody hook to gate tool writes on pi
  So that the plugin's custody rules hold on pi as on a runtime that runs the plugin natively

  Background:
    Given the shim runs an open-plugin whose write-custody hook denies the role "crew" writing under "features" and permits it writing under "src"

  Scenario: The shim blocks a write the hook denies
    Given the host acts as the role "crew"
    When a write to "features/login.feature" is attempted
    Then the shim blocks the write
    And the block reason carries the hook's denial message

  Scenario: The shim allows a write the hook permits
    Given the host acts as the role "crew"
    When a write to "src/login.ts" is attempted
    Then the shim allows the write

  Scenario: The shim leaves an ungated host write alone
    Given the host acts with no plugin role
    When a write to "features/login.feature" is attempted
    Then the shim allows the write

  @captain
  Scenario: The shim synchronously blocks a write the hook denies
    Given the host acts as the role "crew"
    When a write to "features/login.feature" is synchronously attempted
    Then the shim blocks the write
    And the block reason carries the hook's denial message

  @captain
  Scenario: The shim synchronously allows a write the hook permits
    Given the host acts as the role "crew"
    When a write to "src/login.ts" is synchronously attempted
    Then the shim allows the write
