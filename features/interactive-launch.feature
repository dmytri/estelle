@logic
Feature: Estelle interactive launch
  As an operator
  I want "npx @dk/estelle" to drop me into pi's interactive session as Bonny
  So that I work with the crew instead of falling back to my shell

  Scenario: Running Estelle starts pi's interactive session as the Captain Bonny
    Given an operator directory that carries no Estelle assets
    When the operator starts Estelle in that directory
    Then Estelle runs pi's interactive session
    And that interactive session boots as the Captain "Bonny"
    And that interactive session has the "estelle" extension loaded
