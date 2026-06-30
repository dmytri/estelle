Feature: Seat tool custody
  As Estelle
  I want only the Captain to address the operator
  So that the crew speaks to the world through one voice

  Scenario: The Captain addresses the operator
    Given the active seat is the Captain "Bonny"
    When Bonny sends a message to the operator
    Then Estelle delivers the message to the operator

  Scenario: An internal seat may not address the operator
    Given the active seat is the Quartermaster "Misson"
    When Misson attempts to send a message to the operator
    Then Estelle blocks the message
    And Estelle reports that only the Captain addresses the operator
