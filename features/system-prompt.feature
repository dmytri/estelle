@logic
Feature: Estelle system prompt
  As Estelle
  I want every seat to carry Estelle's house rules above its role and character
  So that the crew shares one voice with the Commodore

  Scenario Outline: Every seat carries Estelle's house rules
    Given the active seat is the "<seat>" seat
    Then the seat system prompt addresses the operator as "Commodore"
    Examples:
      | seat |
      | bonny |
      | misson |
