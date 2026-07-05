@logic
Feature: Dispatching a tool call to the open-plugin's matching hooks on pi
  As a pi user running an open-plugin
  I want the shim to match a tool call against the plugin's hook matchers and run every matching hook
  So that any open-plugin, with its own matchers and stacked hooks, enforces on pi

  Scenario: The shim matches a pi tool name against a multi-name matcher pattern
    Given the shim runs an open-plugin whose matcher "Edit|Write|MultiEdit|NotebookEdit" carries a hook that denies the write
    And the host acts as the role "crew"
    When a write to "greeting.md" is attempted
    Then the shim blocks the write

  Scenario: The shim runs every hook a matched entry stacks and blocks if any denies
    Given the shim runs an open-plugin whose write matcher stacks a hook that permits and a hook that denies
    And the host acts as the role "crew"
    When a write to "greeting.md" is attempted
    Then the shim blocks the write
    And the block reason carries the denying hook's message

  Scenario: The shim allows a tool call no matcher matches
    Given the shim runs an open-plugin whose only matcher is "Bash"
    And the host acts as the role "crew"
    When a write to "greeting.md" is attempted
    Then the shim allows the write
