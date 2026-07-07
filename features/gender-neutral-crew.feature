@logic @property
Feature: Gender-neutral crew
  As the crew
  I want every role and agent written in they/them
  So that the specs and their step definitions honour the Articles' gender-neutral rule

  The Articles require they/them pronouns for all roles and agents. A pronoun
  sweep alone drifts, and it did: an earlier fix missed two step-definition
  bindings because the default discovery excludes the tier they lived in. This
  invariant scans the durable specs and their verification support for gendered
  pronouns so any regression surfaces as a failing target on every run.

  Scenario: No gendered pronoun appears in the specs or their step definitions
    Given the project's feature files and step definitions
    Then none of them contains a gendered pronoun
