@logic
Feature: Registering an open-plugin's commands on pi
  As a pi user running an open-plugin
  I want the shim to expose the plugin's commands so pi can register them
  So that a plugin's slash commands are available on pi

  Scenario: The shim exposes the plugin's commands
    Given the shim runs an open-plugin with the commands "status" and "doctor"
    When the shim reports the plugin's commands
    Then the reported commands include "status"
    And the reported commands include "doctor"

  Scenario: The shim reports no commands for a plugin that ships none
    Given the shim runs an open-plugin with no commands directory
    When the shim reports the plugin's commands
    Then the reported commands are empty
