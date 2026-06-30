Feature: Seat model selection
  As an operator
  I want each seat to run on the model I set in Estelle config
  So that I match each role to the right model

  Scenario: The Captain runs on the configured Captain model
    Given Estelle config sets the Captain model to "glm-5.2"
    And the active seat is the Captain "Bonny"
    When Bonny begins a turn
    Then the provider request uses the model "glm-5.2"

  Scenario: The Quartermaster runs on the configured Quartermaster model
    Given Estelle config sets the Quartermaster model to "deepseek-v4-flash"
    And the active seat is the Quartermaster "Misson"
    When Misson begins a turn
    Then the provider request uses the model "deepseek-v4-flash"
