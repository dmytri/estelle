Feature: Seat persona injection
  As Estelle
  I want each seat's character card injected into that seat's system prompt
  So that every seat behaves in character

  Scenario: The Captain carries the Captain character card
    Given the active seat is the Captain "Bonny"
    Then the active seat's system prompt includes its character card

  Scenario: A selected internal seat carries its own character card
    Given the active seat is the Quartermaster "Misson"
    Then the active seat's system prompt includes its character card
