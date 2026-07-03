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

  Scenario: Bonny's ready greeting is operator-owned content
    Given an operator directory whose Bonny greeting asset reads "Ahoy again, Commodore. Bonny at the helm."
    And provider auth and a default model are configured in the operator's agent directory
    When the operator starts Estelle in that directory
    Then Bonny opens the session with the greeting "Ahoy again, Commodore. Bonny at the helm."

  Scenario: Bonny's fitting-out steer is operator-owned content
    Given an operator directory whose Bonny fitting-out steer asset reads "Commodore, no model is rigged yet. Use /login, then /model."
    And no provider auth is configured in the operator's agent directory
    When the operator starts Estelle in that directory
    Then Bonny opens the session with the guidance "Commodore, no model is rigged yet. Use /login, then /model."
