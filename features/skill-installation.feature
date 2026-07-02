Feature: Estelle skill installation
  As an operator
  I want Estelle to install an upstream skill on request
  So that I can add published skills without vendoring

  @sandbox
  Scenario: Estelle installs an upstream skill
    Given Estelle has launched in a fresh workspace
    When Estelle installs the upstream skill package "dmytri/shipshape"
    Then the "captain" skill is present

  @sandbox
  Scenario: A fresh Estelle installs the upstream Shipshape package on launch
    Given a fresh workspace with no installed pi packages
    When the operator starts Estelle in that workspace
    Then the skills "captain", "qm", "crew", "boatswain", and "shipwright" are present
    And the "https://github.com/dmytri/shipshape" package is persisted in the operator's pi settings

  @sandbox
  Scenario: An unrelated shipshape package does not satisfy the launch install
    Given a fresh workspace whose pi settings already persist the "npm:pi-shipshape" package
    When the operator starts Estelle in that workspace
    Then the "https://github.com/dmytri/shipshape" package is persisted in the operator's pi settings
