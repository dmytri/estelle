@logic
Feature: Installing an open-plugin on pi
  As a pi user
  I want to install an open-plugin so pi runs it the way Claude or Cursor would
  So that any open-plugin works on pi through the shim, with no per-vendor variable rewrite

  Scenario: Installing relocates the plugin into pi's plugin directory and registers it
    Given an open-plugin at a source directory
    When the plugin is installed into a pi plugin directory
    Then the plugin's files are present under that directory
    And the installed plugin is registered for discovery

  Scenario: The shim discovers and enforces an installed plugin's custody
    Given an installed open-plugin whose write hook denies the role "crew" writing under "features"
    And the host acts as the role "crew"
    When a write to "features/login.feature" is attempted
    Then the shim blocks the write

  Scenario: The shim resolves an installed plugin's root to its installed location
    Given an installed open-plugin whose write hook command uses "${PLUGIN_ROOT}"
    And the host acts as the role "crew"
    When a write to "features/login.feature" is attempted
    Then the shim blocks the write
