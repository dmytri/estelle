Feature: Estelle launch
  As an operator
  I want "npx @dk/estelle" to boot pi with the Estelle extension and the upstream Shipshape skills
  So that I sail with the crew without vendoring anything

  Scenario: Launching Estelle boots pi with the Estelle extension active
    Given a fresh workspace
    When the operator runs "npx @dk/estelle"
    Then the pi session starts with the "estelle" extension loaded
    And the active seat is the Captain "Bonny"

  Scenario: Estelle serves the Shipshape skills from upstream
    Given Estelle has launched
    When the operator lists the available skills
    Then the skills "captain", "qm", "crew", "boatswain", and "shipwright" are present
    And the "captain" skill resolves from the upstream Shipshape install
