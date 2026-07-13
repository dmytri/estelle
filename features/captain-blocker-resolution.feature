@eval
Feature: Captain blocker resolution
  As the operator
  I want Bonny to resolve a blocker rather than report it and wait
  So that a fault in the project's rigging never stops the work

  Bonny holds the only human-facing seat, so a blocker Bonny reports and
  holds is a blocker nobody is working. A rigging fault is Bonny's to
  repair or to route to Johnson for a refit, and the work continues in
  the same turn. Each scenario asserts a durable file on disk, an outcome
  a narrated blocker report cannot produce.

  Background:
    Given a scratch project whose "RIGGING.md" carries no "focused" command
    And a started Estelle session in the scratch project

  Rule: A blocker is Bonny's to resolve or to route, never to hold

    Scenario: Bonny repairs a rigging fault rather than ending the turn on a blocker
      When the operator asks Bonny to specify a greeting page for the project
      Then the scratch project's "RIGGING.md" carries a "focused" command

    Scenario: Bonny carries the confirmed intent into a durable specification
      When the operator asks Bonny to specify a greeting page for the project
      Then the scratch project carries a specification for the greeting page
