@logic
Feature: Embarking runs the crew alongside Bonny
  As an operator
  I want to embark a batch and set the crew working in a session beside Bonny
  So that the crew build from durable artifacts while my conversation with Bonny stays live and unpolluted

  Scenario: Embarking opens a crew session alongside the started session
    Given a started Estelle session seated as the Captain "Bonny"
    When the operator runs the "/embark" command in the started session
    Then a crew session opens alongside the started session
    And the crew session is seated as the Quartermaster "Misson"

  Scenario: Embarking keeps the started session live beside the crew
    Given a started Estelle session carrying the operator's message "make the greeting warmer" to Bonny
    When the operator runs the "/embark" command in the started session
    Then the started session stays seated as the Captain "Bonny"
    And the started session still carries the operator's message "make the greeting warmer"

  Scenario: Embarking isolates the crew session from the started session's conversation
    Given a started Estelle session carrying the operator's message "make the greeting warmer" to Bonny
    When the operator runs the "/embark" command in the started session
    Then the crew session opens alongside the started session
    And the crew session's message history excludes the operator's message "make the greeting warmer"

  # Slice 2: the crew's heartbeat — the operator-visible sign the crew is alive
  # and moving. The hermetic tier pins the heartbeat surface and its resting
  # state; the @eval tier pins that it tracks a real run off the live event
  # stream, and skips (never fails) when no model credential is present.

  Scenario: Embarking exposes the crew's heartbeat at rest
    Given a started Estelle session seated as the Captain "Bonny"
    When the operator runs the "/embark" command in the started session
    Then the crew session reports a heartbeat naming the Quartermaster "Misson"
    And the crew session's heartbeat shows the crew at rest before it runs

  @eval
  Scenario: A live crew run drives the heartbeat off the real event stream
    Given a started Estelle session seated as the Captain "Bonny"
    And a live eval model is configured for the crew
    When the operator runs the "/embark" command in the started session
    And the crew session runs a turn
    Then the crew session's heartbeat reflected live activity during the run
