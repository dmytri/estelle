@logic
Feature: Built-in skills
  As an operator
  I want Estelle to ship its own configuration and skill-management skills
  So that the Captain can configure and extend Estelle without vendoring

  Scenario Outline: Estelle serves each built-in skill from the package in a clean operator directory
    Given a fresh operator directory with no Estelle assets or installed skills
    When the operator runs the Estelle package in that directory
    Then the "<skill>" skill is present
    Examples:
      | skill |
      | update-config |
      | find-skills |
