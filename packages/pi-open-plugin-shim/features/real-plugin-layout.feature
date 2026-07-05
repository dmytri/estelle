@logic
Feature: Loading a real open-plugin's layout on pi
  As a pi host running an open-plugin
  I want the shim to load a plugin shaped like a real open-plugin
  So that the actual Shipshape plugin, not only a purpose-built fixture, runs on pi

  A real open-plugin declares its components as directories, not manifest fields:
  hooks live in "hooks/hooks.json" under a top-level "hooks" key, and agents and
  commands live in their own directories. The shim discovers them by convention.

  Scenario: The shim finds hooks by directory convention, not a manifest field
    Given the shim runs an open-plugin whose manifest declares no hooks and whose "hooks/hooks.json" nests a write hook under a top-level "hooks" key, denying the role "crew" writing under "features"
    And the host acts as the role "crew"
    When a write to "features/login.feature" is attempted
    Then the shim blocks the write

  Scenario: The shim reports agents and commands found by directory convention
    Given the shim runs an open-plugin whose manifest declares no components and which ships an agent "qm" and a command "status"
    When the shim reports the plugin's agents
    And the shim reports the plugin's commands
    Then the reported agents include an agent named "qm"
    And the reported commands include "status"
