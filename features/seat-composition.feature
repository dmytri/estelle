@logic
Feature: Seat commands and composition
  As Estelle
  I want each role reachable by a command for every name it answers to, its instructions composed from the upstream Shipshape role and its character card
  So that a role is itself in character, addressable by any of its names, without vendoring upstream

  The operator is always the Captain. The /bonny and /captain commands name the
  operator's own seat; the internal-role commands invoke that role in an isolated
  session alongside (see the alongside scenarios in the crew feature), never by
  switching the operator's seat. The prompt composition and crew roster apply to
  whichever session runs a role, the operator's Captain session and every
  alongside role session alike.

  Scenario Outline: The Captain commands keep the operator seated as Bonny
    Given Estelle has launched
    When the operator runs the command "<command>"
    Then the active seat is the "bonny" seat
    Examples:
      | command |
      | /bonny |
      | /captain |

  Scenario Outline: A role's system prompt composes the upstream role with its character card
    Given the active seat is the "<seat>" seat
    Then the seat system prompt includes the upstream "<role>" role instructions
    And the seat system prompt includes the "<seat>" character card
    Examples:
      | seat | role |
      | bonny | captain |
      | misson | qm |
      | crew | crew |
      | bellamy | boatswain |
      | johnson | shipwright |

  Scenario: Estelle does not vendor the upstream Shipshape role instructions
    Given Estelle has launched
    Then the upstream Shipshape role instructions resolve from outside the Estelle repository

  Scenario: A role's session carries the crew roster
    Given a started Estelle session seated as the Captain "Bonny"
    When the seated model begins its next turn
    Then the system prompt applied to the turn names the Captain "Bonny", the Quartermaster "Misson", the Crew, the Boatswain "Bellamy", and the Shipwright "Johnson"
