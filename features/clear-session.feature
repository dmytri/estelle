@logic
Feature: Clearing the Captain session
  As an operator
  I want a /clear alias that starts a fresh Bonny session
  So that I can reset a long conversation without leaving the helm or re-reading a greeting

  Scenario: Clearing starts a fresh Captain session
    Given a started Estelle session carrying the operator's message "make the greeting warmer" to Bonny
    When the operator runs the "/clear" command in the started session
    Then the started session's message history excludes the operator's message "make the greeting warmer"
    And the started session stays seated as the Captain "Bonny"

  Scenario: Clearing does not re-greet
    Given a started Estelle session seated as the Captain "Bonny"
    When the operator runs the "/clear" command in the started session
    Then the started session carries no greeting before the operator speaks
