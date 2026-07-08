@logic
Feature: Estelle interactive launch
  As an operator
  I want "npx @dk/estelle" to drop me into pi's interactive session as Bonny
  So that I work with the crew alongside and configure pi without leaving the session

  Scenario: Running Estelle starts pi's interactive session as the Captain Bonny
    Given an operator directory that carries no Estelle assets
    When the operator starts Estelle in that directory
    Then Estelle runs pi's interactive session
    And that interactive session boots as the Captain "Bonny"
    And that interactive session has the "estelle" extension loaded

  Scenario: The started session registers a live command for each seat
    Given an operator directory that carries no Estelle assets
    When the operator starts Estelle in that directory
    Then the started session registers the commands "/bonny", "/captain", "/misson", "/crew", "/bellamy", and "/johnson"

  Scenario: The started session resolves provider and model configuration from the operator's agent directory
    Given an operator directory that carries no Estelle assets
    When the operator starts Estelle in that directory
    Then the started session resolves provider auth from the operator's agent directory
    And the started session resolves model configuration from the operator's agent directory

  Scenario: The started session records the conversation for later resume
    Given an operator directory that carries no Estelle assets
    When the operator starts Estelle in that directory
    Then the started session is recorded under the operator's agent directory so the operator can resume it
