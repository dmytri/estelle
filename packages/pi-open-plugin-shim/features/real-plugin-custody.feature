@logic
Feature: Enforcing a real open-plugin's dir-scoped custody on pi
  As a pi host running a real open-plugin
  I want the shim to run the plugin's real hook against the project, with the command's quoting handled and the plugin root resolved
  So that a hook that reads the project's RIGGING.md enforces dir scopes on pi, exactly as the real Shipshape write-custody does

  Background:
    Given the shim runs an open-plugin whose write hook is the real Shipshape write-custody script, its hooks.json command quoted and rooted at "${PLUGIN_ROOT}"
    And a project whose RIGGING.md scopes implementation to "src" and specs to "features"

  Scenario: A Quartermaster write to production is blocked by the hook reading the project RIGGING
    Given the host acts as the role "qm" in that project
    When a write to "src/pay.ts" in that project is attempted
    Then the shim blocks the write
    And the block reason carries "Production code belongs to Crew"

  Scenario: A Crew write to production is allowed
    Given the host acts as the role "crew" in that project
    When a write to "src/pay.ts" in that project is attempted
    Then the shim allows the write

  Scenario: A Crew write to a spec is blocked
    Given the host acts as the role "crew" in that project
    When a write to "features/pay.feature" in that project is attempted
    Then the shim blocks the write
