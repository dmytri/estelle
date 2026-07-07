@logic
Feature: Seat commands and composition
  As Estelle
  I want each seat reachable by a command for every name it answers to, its instructions composed from the upstream Shipshape role and its character card
  So that a seat is its role in character, addressable by any of its names, without vendoring upstream

  Scenario Outline: Every seat name is a command that activates the same seat
    Given Estelle has launched
    When the operator runs the command "<command>"
    Then the active seat is the "<seat>" seat
    Examples:
      | command | seat |
      | /bonny | bonny |
      | /captain | bonny |
      | /misson | misson |
      | /quartermaster | misson |
      | /qm | misson |
      | /bellamy | bellamy |
      | /boatswain | bellamy |
      | /johnson | johnson |
      | /shipwright | johnson |
      | /crew | crew |

  Scenario Outline: An active seat's system prompt composes the upstream role with its character card
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

  # A command switch must re-seat the running interactive session, not only flip
  # the custody seat. The seat prompt is composed once, when the session is
  # created (the before_agent_start seam); the interactive TUI runs one session
  # and never recreates it on a switch, so today the seated model keeps the
  # launch seat's identity. The switch must recreate the interactive session for
  # the new seat, the way beginTurn already does. Verification MUST observe the
  # running interactive session the TUI uses, never a manual emit of the
  # composing hook and never the systemPrompt() recompute accessor: both pass
  # while the live model stays the launch seat. The @eval identity scenario is
  # the load-bearing proof.

  Scenario: A command switch recreates the interactive session for the new seat
    Given a started Estelle session seated as the Captain "Bonny"
    When the operator runs the "/bellamy" command in the started session
    Then the interactive session the operator talks to is a fresh session seated as the Boatswain "Bellamy"
    And that session's system prompt includes the "bellamy" character card
    And that session's system prompt includes the upstream "boatswain" role instructions
    But that session's system prompt excludes the "bonny" character card

  # Every seat carries the crew roster so a seat knows its crewmates by name and
  # role, and the Captain knows who they dispatch to.

  Scenario: Every seat carries the crew roster
    Given a started Estelle session seated as the Captain "Bonny"
    When the seated model begins its next turn
    Then the system prompt applied to the turn names the Captain "Bonny", the Quartermaster "Misson", the Crew, the Boatswain "Bellamy", and the Shipwright "Johnson"

  @eval
  Scenario: A switched seat speaks as its own character
    Given a started Estelle session seated as the Captain "Bonny"
    And a live eval model is configured for the seat
    When the operator runs the "/bellamy" command in the started session
    And the operator asks the seated model "state your seat and name"
    Then the seated model's live reply names the Boatswain "Bellamy"
