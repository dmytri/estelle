@logic
Feature: Exposing an open-plugin's agent definitions on pi
  As a pi host running an open-plugin
  I want the shim to expose the plugin's agent definitions
  So that pi can run each as a context-isolated session, its equivalent of a subagent

  Scenario: The shim exposes each agent's name and prompt
    Given the shim runs an open-plugin with an agent "qm" described as "verification role" whose prompt is "You are the Quartermaster"
    When the shim reports the plugin's agents
    Then the reported agents include an agent named "qm"
    And the "qm" agent's prompt is "You are the Quartermaster"

  Scenario: The shim reports no agents for a plugin that ships none
    Given the shim runs an open-plugin with no agents directory
    When the shim reports the plugin's agents
    Then the reported agents are empty
