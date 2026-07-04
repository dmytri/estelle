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
  # stream. The @eval tier requires the model credential as fitting-out and
  # assumes it present; a missing credential is incomplete fitting-out, a
  # Captain blocker, never a silent skip.

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
    Then the crew session received a live reply from the Quartermaster's model
    And the crew session's heartbeat reflected live activity during the run

  # Slice 3: the Quartermaster -> Crew handoff. Estelle drives the progression:
  # after the Quartermaster's turn it opens a fresh, context-isolated Crew
  # session, so the QM -> Crew firewall holds by fresh context, and custody
  # follows the new seat. The full loop-until-green is a later slice; this pins
  # one handoff. @logic pins fresh context and custody; @eval pins a real
  # Quartermaster turn handing off to a fresh Crew session.

  Scenario: Handing off to the Crew opens a session isolated from the Quartermaster's context
    Given a started Estelle session seated as the Captain "Bonny"
    When the operator runs the "/embark" command in the started session
    And the Quartermaster's crew session carries the message "target greeting.md is red"
    And Estelle hands the crew off from the Quartermaster to the Crew
    Then the crew session is seated as a Crew hand
    And the crew session's message history excludes the Quartermaster's message "target greeting.md is red"

  Scenario: The handed-off Crew session carries Crew custody
    Given a started Estelle session seated as the Captain "Bonny"
    When the operator runs the "/embark" command in the started session
    And Estelle hands the crew off from the Quartermaster to the Crew
    Then the crew session allows a Crew hand to write "src/handoff.ts"
    And the crew session blocks a Crew hand from writing "features/new.feature"

  @eval
  Scenario: A live Quartermaster turn hands off to a fresh Crew session
    Given a started Estelle session seated as the Captain "Bonny"
    And a live eval model is configured for the crew
    When the operator runs the "/embark" command in the started session
    And the crew session runs a turn
    Then the crew session received a live reply from the Quartermaster's model
    When Estelle hands the crew off from the Quartermaster to the Crew
    Then the crew session is seated as a Crew hand
    And the crew session's message history excludes the Quartermaster's turn

  # Slice 4: handoff narration. One small Bonny call per seat handoff, voiced
  # off the completed seat's work, is the paid colour over the free heartbeat.
  # @logic pins that a handoff records a narration for the transition; @eval
  # pins that Bonny voices a real line in her own voice at the handoff.

  Scenario: A handoff records a narration for the seat transition
    Given a started Estelle session seated as the Captain "Bonny"
    When the operator runs the "/embark" command in the started session
    And Estelle hands the crew off from the Quartermaster to the Crew
    Then Bonny's narration log records a handoff from the Quartermaster to the Crew

  @eval
  Scenario: Bonny voices a live line at the seat handoff
    Given a started Estelle session seated as the Captain "Bonny"
    And a live eval model is configured for the crew and Bonny
    When the operator runs the "/embark" command in the started session
    And the crew session runs a turn
    When Estelle hands the crew off from the Quartermaster to the Crew
    Then Bonny's narration for the handoff carries a live line in her voice
