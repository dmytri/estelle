@logic
Feature: Bonny greets the operator
  As an operator
  I want Bonny to greet me when her voice is ready and steer me to fit out when it is not
  So that a session never opens silent

  Scenario: Bonny greets first when an active model is available
    Given an operator directory that carries no Estelle assets
    And provider auth and a default model are configured in the operator's agent directory
    When the operator starts Estelle in that directory
    Then Bonny opens the session with a greeting before the operator speaks

  Scenario: An unfitted session steers the operator to log in and pick a model
    Given an operator directory that carries no Estelle assets
    And no provider auth is configured in the operator's agent directory
    When the operator starts Estelle in that directory
    Then the started session presents fitting-out guidance naming "/login" and "/model"
