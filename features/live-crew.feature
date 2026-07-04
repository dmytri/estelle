@logic
Feature: Embarking runs the crew alongside Bonny
  As an operator
  I want to embark a batch and set the crew working in a session beside Bonny
  So that the crew build from durable artifacts while my conversation with Bonny stays live and unpolluted

  Scenario: Embarking seats the Quartermaster to begin the crew run
    Given a started Estelle session seated as the Captain "Bonny"
    When the operator runs the "/embark" command in the started session
    Then the crew session is seated as the Quartermaster "Misson"

  Scenario: Embarking keeps Bonny's session live beside the crew
    Given a started Estelle session carrying the operator's message "make the greeting warmer" to Bonny
    When the operator runs the "/embark" command in the started session
    Then the started session stays seated as the Captain "Bonny"
    And the started session still carries the operator's message "make the greeting warmer"

  Scenario: Embarking isolates the crew from the operator's conversation
    Given a started Estelle session carrying the operator's message "make the greeting warmer" to Bonny
    When the operator runs the "/embark" command in the started session
    Then the crew session's message history excludes the operator's message "make the greeting warmer"
