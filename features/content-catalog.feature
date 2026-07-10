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
