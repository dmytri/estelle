Feature: Built-in skills
  As an operator
  I want Estelle to ship its own configuration and skill-management skills
  So that the Captain can configure and extend Estelle without vendoring

  Scenario Outline: Estelle ships each built-in skill
    Given Estelle has launched
    Then the "<skill>" skill is present
    Examples:
      | skill |
      | update-config |
      | find-skills |
