@logic
Feature: Operator address custody
  As Estelle
  I want addressing the operator gated on the seat's own send in the running session
  So that only the Captain reaches the operator through the path a seat takes when it acts

  Estelle exposes an operator-address action only on the launch-time session
  object the tests drive. A live seat reaches the operator through the running
  session, not that test-facing method. Captain directs wiring the seam to a
  real command-reachable and model-reachable path, so the Captain addresses the
  operator through the running session and an internal seat's attempt is blocked
  there.

  Scenario: The Captain addresses the operator through the running session
    Given a started Estelle session with the Shipshape plugin installed
    And the active seat is the Captain "Bonny"
    When Bonny addresses the operator with "Batch confirmed, Commodore." in the running session
    Then the operator receives the message "Batch confirmed, Commodore." in the running session

  Scenario: An internal seat may not address the operator in the running session
    Given a started Estelle session with the Shipshape plugin installed
    And the active seat is the Quartermaster "Misson"
    When Misson attempts to address the operator in the running session
    Then the running session blocks the operator address
    And Estelle reports that only the Captain addresses the operator
