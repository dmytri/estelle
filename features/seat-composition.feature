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

  Scenario Outline: An active seat's instructions compose the upstream role with its character card
    Given the active seat is the "<seat>" seat
    Then the active seat's instructions include the upstream "<role>" role instructions
    And the active seat's instructions include the "<seat>" character card
    And the active seat's instructions identify it as both "<character>" and "<role-name>"
    Examples:
      | seat | role | character | role-name |
      | bonny | captain | Bonny | Captain |
      | misson | qm | Misson | Quartermaster |
      | crew | crew | Crew | Crew |
      | bellamy | boatswain | Bellamy | Boatswain |
      | johnson | shipwright | Johnson | Shipwright |

  Scenario: Estelle does not vendor the upstream Shipshape role instructions
    Given Estelle has launched
    Then the upstream Shipshape role instructions resolve from outside the Estelle repository
