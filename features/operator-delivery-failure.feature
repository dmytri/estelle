Feature: Operator delivery failure
  As Estelle
  I want a failed delivery to the operator recorded rather than swallowed
  So that a lost message is visible instead of silent

  @logic
  Scenario: A delivery the operator never receives is recorded as a failure
    Given the active seat is the Captain "Bonny"
    When Bonny sends a message to the operator
    And the pending deliveries settle
    Then Estelle records one delivery failure

  @eval
  Scenario: A failed operator delivery in the running session surfaces in session state
    Given a started Estelle session with the Shipshape plugin installed
    And the active seat is the Captain "Bonny"
    When Bonny addresses the operator in the running session and the delivery fails
    Then the running session records the delivery failure in its own session state
    And the recorded failure is observable without a test-facing method
