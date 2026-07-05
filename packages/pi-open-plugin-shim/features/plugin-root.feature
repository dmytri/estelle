@logic
Feature: Resolving the plugin root in open-plugin hook commands on pi
  As a pi user running an open-plugin
  I want the shim to resolve ${PLUGIN_ROOT} to the plugin's directory when it spawns a hook
  So that a plugin authored with the neutral ${PLUGIN_ROOT} variable runs on pi unchanged

  Background:
    Given the shim runs an open-plugin whose write hook command is "${PLUGIN_ROOT}/hooks/scripts/write-custody" and denies the role "crew" writing under "features"

  Scenario: The shim resolves the plugin root and spawns the hook
    Given the host acts as the role "crew"
    When a write to "features/login.feature" is attempted
    Then the shim blocks the write

  Scenario: The shim resolves the plugin root for a permitted write
    Given the host acts as the role "crew"
    When a write to "src/login.ts" is attempted
    Then the shim allows the write
