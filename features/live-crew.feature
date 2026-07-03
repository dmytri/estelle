@logic
Feature: Sealing a batch runs the crew
  As an operator
  I want to seal a batch and set the crew working in an isolated session
  So that the crew build from durable artifacts without my discovery conversation leaking in

  Scenario: Sealing a batch seats the Quartermaster to begin the crew run
    Given a started Estelle session seated as the Captain "Bonny"
    When the operator runs the "/ship" command in the started session
    Then the started session's active seat is the Quartermaster "Misson"

  Scenario: Sealing a batch isolates the crew from the operator's conversation
    Given a started Estelle session carrying the operator's message "make the greeting warmer" to Bonny
    When the operator runs the "/ship" command in the started session
    Then the crew session's message history excludes the operator's message "make the greeting warmer"
