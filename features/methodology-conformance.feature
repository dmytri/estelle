@logic @property
Feature: Methodology conformance
  As the Shipshape pilot
  I want the workflow's own methodology rules to run as verification targets
  So that a violation surfaces as a failing run instead of drifting silently

  The Articles hold that passing verification is not proof: a methodology rule
  that no check exercises is unenforced, so QM never discovers a violation. Each
  scenario below makes one such rule executable against this repository, in the
  pattern the shipped gender-neutral check already proves. Each is a standing
  invariant, and each earns its keep only once a planted violation has reddened
  it and its removal has greened it again.

  Scenario: No forbidden double appears in the verification support
    Given the project's step definitions and test support
    Then none of them uses a forbidden verification double

  Scenario: Every plank traces to a live feature step
    Given the project's plank annotations and the feature step text
    Then every plank's step text matches a live feature step

  Scenario: The feature files pass the project gherkin lint
    Given the project's feature files and the gherkin lint configuration
    Then the gherkin linter reports no violation

  Scenario: A green tree carries no live perturbation
    Given the verification suite is green
    Then no perturbation token remains in the production code

  Scenario: A present watchbill has the valid watchbill shape
    Given a "watchbill.json" file is present in the project
    Then it contains only ordered watch objects with scenario references
