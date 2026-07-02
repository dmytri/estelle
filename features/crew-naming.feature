@logic
Feature: Crew naming
  As Estelle
  I want each Crew hand named by code from the survivor roster
  So that the names honour the dogs who came home and never depend on the model

  Scenario: A Crew hand is named from the survivor roster
    Given the survivor roster in "assets/crew-roster.json"
    When Estelle seats a new Crew hand
    Then the hand name appears in "assets/crew-roster.json"

  Scenario: Estelle assigns the Crew name by code before the model runs
    When Estelle seats a new Crew hand
    Then the Estelle extension assigns the name
    And the name is present before the hand first provider request
