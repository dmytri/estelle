Feature: pi command pass-through
  As an operator
  I want the estelle command to pass pi commands through to pi
  So that I manage packages with estelle exactly as I would with pi

  @sandbox
  Scenario: estelle passes the install command through to pi
    Given a fresh workspace with no installed pi packages
    When the operator runs estelle with the arguments "install npm:pi-web-access"
    Then the "npm:pi-web-access" package is persisted in the operator's pi settings

  @sandbox
  Scenario: estelle passes the remove command through to pi
    Given a fresh workspace whose pi settings already persist the "npm:pi-web-access" package
    When the operator runs estelle with the arguments "remove npm:pi-web-access"
    Then the "npm:pi-web-access" package is absent from the operator's pi settings
