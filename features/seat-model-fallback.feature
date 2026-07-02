@logic
Feature: Seat model fallback
  As an operator
  I want a seat to keep running when I configure a model pi does not know
  So that a typo in my config does not stop the crew

  Scenario: An unavailable seat model falls back to an available model
    Given Estelle config sets the Captain model to "opencode-go/nonexistent-model-9000"
    And the active seat is the Captain "Bonny"
    When Bonny begins a turn
    Then the provider request uses an available model

  Scenario: An unavailable seat model is reported as unavailable
    Given Estelle config sets the Captain model to "opencode-go/nonexistent-model-9000"
    And the active seat is the Captain "Bonny"
    When Bonny begins a turn
    Then Estelle reports that the model "opencode-go/nonexistent-model-9000" is unavailable
