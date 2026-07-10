@logic
Feature: Agent-facing copy is catalogued
  As Estelle
  I want the crew's agent-facing operational copy sourced from the content catalog
  So that the copy is owned as product material rather than embedded in production seams

  Rule: Agent-facing operational copy is sourced from the "agent-prompts" catalog, not embedded in the seam

  Scenario: The embark tool presents its catalogued description and guidance
    Given the "embark" entry in the agent-prompt catalog
    When the Captain seat registers the embark tool
    Then the tool's description, prompt snippet, and prompt guidelines match the catalogued embark entry

  Scenario: The Captain opening turn carries its catalogued instruction
    Given the "openingTurn" entry in the agent-prompt catalog
    When Estelle opens the Captain's floating opening turn
    Then the opening-turn message carries the catalogued opening instruction

  Scenario: The crew-run summary voicing carries its catalogued prompt
    Given the "crewRunSummary" entry in the agent-prompt catalog
    When Estelle prepares the voiced crew-run summary
    Then the voicing prompt matches the catalogued crew-run summary prompt

  Scenario: The crew-run narration voicing carries its catalogued prompt
    Given the "crewRunNarration" entry in the agent-prompt catalog
    When Estelle prepares the voiced crew-run narration
    Then the voicing prompt matches the catalogued crew-run narration prompt
