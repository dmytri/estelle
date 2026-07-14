@logic @property
Feature: Verification conformance
  As the Shipshape pilot
  I want the Verification agreement's rules checked against the verification support
  So that green verification debt surfaces as a failing target instead of drifting

  Rule: A new debt kind lands as a rule entry, never as a new scenario

  The rule set lives at "scantlings/verification-conformance.json". The Captain
  adds a rule entry when routing a verification-debt finding, and this one
  scenario discharges every entry. A debt kind that earns its own scenario splits
  the check across surfaces that drift apart.

    @captain @invariant
    Scenario: The verification support discharges against the verification-conformance rule set
      Given the verification support and the implementation directories the rule set names
      When the verifier checks each rule in "scantlings/verification-conformance.json"
      Then no counterexample is found
