@logic
Feature: Fitting out an unfitted project
  As an operator
  I want Estelle to steer me to fit out a project that has no rigging
  So that I reach a fitted deck before I try to sail

  Shipshape routing holds that a project without "RIGGING.md" is not fitted out,
  and the Shipwright fits it out before any other work. Estelle makes that
  routing real: on an unfitted project the Captain steers the operator to the
  Shipwright seat Johnson, and on a fitted project the session opens at the helm.
  A missing model steers to login first, since even fitting out needs a model, so
  the unfitted-project steer is the behaviour when a model is already rigged.

  Scenario: Estelle steers to fitting out when the project is unfitted
    Given a project directory with no "RIGGING.md"
    And a model is rigged
    When the operator launches Estelle in that directory
    Then Bonny steers the operator to fit out with the Shipwright "Johnson"

  Scenario: A fitted project opens to the Captain
    Given a project directory that carries "RIGGING.md"
    When the operator launches Estelle in that directory
    Then the active seat is the Captain "Bonny"
