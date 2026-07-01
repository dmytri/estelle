Feature: Estelle skill authoring
  As an operator
  I want to ask Estelle to create a new skill in my workspace
  So that I can extend the crew without leaving the session

  Scenario: Estelle creates a workspace skill on request
    Given Estelle has launched
    When the operator asks Estelle to create the skill "harbour-report"
    Then the "harbour-report" skill is present
