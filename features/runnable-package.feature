@sandbox
Feature: Estelle runnable package
  As an operator
  I want to run the published Estelle package with npx from any directory
  So that I sail with the crew without cloning the repository

  Scenario: The package exposes the estelle launch command
    Given the built Estelle package
    Then the package provides an executable "estelle" command

  Scenario: Estelle boots as the Captain Bonny from a directory without Estelle assets
    Given an operator directory that carries no Estelle assets
    When the operator runs the Estelle package in that directory
    Then the active seat is the Captain "Bonny"
    And the pi session starts with the "estelle" extension loaded

  Scenario: Estelle uses its bundled assets when the operator directory has its own assets folder
    Given an operator directory that has its own unrelated "assets" folder
    When the operator runs the Estelle package in that directory
    Then the active seat is the Captain "Bonny"
    And the pi session starts with the "estelle" extension loaded

  Scenario: The built package boots pi as the Captain Bonny
    Given the built Estelle package
    When the operator runs the built package in a directory without Estelle assets
    Then the active seat is the Captain "Bonny"
    And the pi session starts with the "estelle" extension loaded

  Scenario: The published package ships its runtime and withholds Captain notes
    Given the packaged Estelle artifact
    Then the artifact includes "dist/index.js"
    And the artifact includes "bin/estelle.js"
    And the artifact includes "assets/crew-roster.json"
    And the artifact withholds "CAPTAIN.md"
    And the artifact withholds "src/index.ts"

  Scenario: The estelle command reports a launch failure to the operator
    Given the built Estelle package
    When the operator runs the "estelle" command in a directory whose launch rejects
    Then the command exits with a nonzero status
    And the command prints the launch error to stderr
