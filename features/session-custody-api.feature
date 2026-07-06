Feature: Estelle session custody API

  Estelle's programmatic session object exposed read and command custody
  checks alongside the running session's tool-call hook. Seat custody moved
  to the hook, leaving these two methods as a zero-caller duplicate seam.
  Captain condemned them: the tool-call hook is the single custody seam. These
  scenarios are removal work orders. The next harbour pass removes the planked
  "command" and "read" methods and deletes this feature.

  @shipwright
  Scenario: The session command API blocks a Crew hand committing
    Given a started Estelle session seated as a Crew hand named "Belka"
    When the Crew hand runs "git commit -m batch" through the session custody API
    Then the session custody API blocks the command
    And the block reason carries the Shipshape plugin's denial "Boatswain holds local commit custody"

  @shipwright
  Scenario: The session read API blocks a Crew hand reading CAPTAIN.md
    Given a started Estelle session seated as a Crew hand named "Belka"
    When the Crew hand reads "CAPTAIN.md" through the session custody API
    Then the session custody API blocks the read
    And the block reason carries the Shipshape plugin's denial "MUST NOT read CAPTAIN.md"
