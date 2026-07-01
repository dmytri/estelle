Feature: Estelle extension installation
  As an operator
  I want Estelle to install a pi extension on request
  So that I can add published capabilities without vendoring

  @sandbox
  Scenario: Estelle installs a pi extension
    Given Estelle has launched in a fresh workspace
    When Estelle installs the pi extension package "npm:pi-web-access"
    Then the command "/websearch" is present
