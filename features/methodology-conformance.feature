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

  Scenario: The crew loop decides green by the project's real verification
    Given the crew-loop driver in the implementation
    Then the loop decides a target green by running the project's verification command
    And no crew-loop driver hardcodes a test runner
    And no crew-loop seam treats a written file's contents as proof of a target green

  Scenario: Every plank traces to a live feature step
    Given the project's plank annotations and the feature step text
    Then every plank's step text matches a live feature step

  Scenario: Every plank annotates a seam declaration in docblock form
    Given the project's plank annotations and their placement
    Then every plank is a docblock tag attached to a seam declaration

  Scenario: Every registered command, seat, and tool name has one implementation
    Given the project's command, seat, and tool registrations
    Then each registered name resolves to exactly one implementation

  Scenario: The shim seam does not import the flagship
    Given the shim's source imports
    Then none of them resolves to the flagship package

  Scenario: Catalogued agent-prompt copy is not duplicated in the implementation
    Given the agent-prompt catalog and the project's implementation
    Then no catalogued prompt text appears as a string literal in the implementation

  Scenario: The feature files pass the project gherkin lint
    Given the project's feature files and the gherkin lint configuration
    Then the gherkin linter reports no violation

  Scenario: A green tree carries no live perturbation
    Given the verification suite is green
    Then no perturbation token remains in the production code

  Scenario: A present watchbill has the valid watchbill shape
    Given a "watchbill.json" file is present in the project
    Then it contains only ordered watch objects with scenario references

  Scenario: The implementation passes the project code lint
    Given the project's implementation directories and the code lint configuration
    Then the code linter reports no violation

  Scenario: Every live crew-session step carries a live-step timeout budget
    Given the project's step definitions that await a live crew-session turn
    Then each one declares an explicit timeout at least as long as the live-step budget

  @invariant
  Scenario: One custody implementation decides every write
    Given the project's write-custody decision points in the implementation
    Then each one resolves its decision through the Shipshape plugin's custody hook
    And no decision point applies a write scope written in the implementation

  @invariant
  Scenario: One custody implementation decides every read
    Given the project's read-custody decision points in the implementation
    Then each one resolves its decision through the Shipshape plugin's custody hook

  @invariant
  Scenario: Every role dispatch prompt is served from the agent-prompt catalog
    Given the project's implementation and the agent-prompt catalog
    Then no role dispatch prompt appears as a string literal in the implementation

  @invariant
  Scenario: The upstream Shipshape package is cloned once for the whole run
    Given the project's step definitions that install the upstream Shipshape package
    Then they resolve it from one shared clone provisioned once per run
