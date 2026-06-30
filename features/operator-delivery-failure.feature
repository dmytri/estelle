Feature: Operator delivery failure
  As Estelle
  I want a failed delivery to the operator recorded rather than swallowed
  So that a lost message is visible instead of silent

  Scenario: A delivery the operator never receives is recorded as a failure
    Given the active seat is the Captain "Bonny"
    When Bonny sends a message to the operator
    And the pending deliveries settle
    Then Estelle records one delivery failure
