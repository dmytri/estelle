Feature: Estelle skill authoring
  As an operator
  I want to ask Estelle to create a new skill in my workspace
  So that I can extend the crew without leaving the session

  Scenario: An authored skill lands in the workspace and loads with its content
    Given Estelle has launched
    When the operator asks Estelle to create a skill named "deploy-notes" with the body "Record deploy notes for the current release."
    Then the "deploy-notes" skill is present
    And the "deploy-notes" skill body is "Record deploy notes for the current release."
