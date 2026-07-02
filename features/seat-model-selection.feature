@logic
Feature: Seat model selection
  As an operator
  I want each seat to run on the model I record in Estelle config
  So that I match each role to the right model

  Scenario: Estelle config sets the Captain model
    Given Estelle config sets the Captain model to "opencode-go/glm-5.2"
    And the active seat is the Captain "Bonny"
    When Bonny begins a turn
    Then the provider request uses the model "opencode-go/glm-5.2"

  Scenario: Estelle config sets the Quartermaster model
    Given Estelle config sets the Quartermaster model to "opencode-go/glm-5.2"
    And the active seat is the Quartermaster "Misson"
    When Misson begins a turn
    Then the provider request uses the model "opencode-go/glm-5.2"

  Scenario: A recorded seat model lands in the operator's agent directory
    When Estelle config sets the Captain model to "opencode-go/glm-5.2"
    Then the "estelle.json" file in the operator's agent directory records the captain model "opencode-go/glm-5.2"

  Scenario: Recording one seat model preserves the other seat models
    Given Estelle config sets the Captain model to "opencode-go/glm-5.2"
    When Estelle config sets the Quartermaster model to "opencode-go/deepseek-v4-flash"
    Then the "estelle.json" file in the operator's agent directory records the captain model "opencode-go/glm-5.2"
    And the "estelle.json" file in the operator's agent directory records the quartermaster model "opencode-go/deepseek-v4-flash"

  Scenario: A seat model recorded in the agent directory is used at launch
    Given the "estelle.json" file in the operator's agent directory records the captain model "opencode-go/glm-5.2"
    And the active seat is the Captain "Bonny"
    When Bonny begins a turn
    Then the provider request uses the model "opencode-go/glm-5.2"
