Feature: Estelle self-configuration
  As an operator
  I want Estelle to carry its own configuration knowledge
  So that I can mend an unavailable model or missing setup from inside the session

  Scenario: Estelle ships its configuration skill
    Given Estelle has launched
    Then the "estelle-config" skill is present

  Scenario: The Captain carries the configuration skill
    Given the active seat is the Captain "Bonny"
    Then the active seat's instructions include the "estelle-config" skill
