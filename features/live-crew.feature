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

  Rule: The crew's heartbeat is the operator-visible sign the crew is alive and moving
    The fast tier pins the heartbeat surface and its resting state. The live-eval tier pins
    that the heartbeat tracks a real run off the live event stream. The live-eval tier
    requires the model credential as fitting-out and assumes it present. A missing
    credential is incomplete fitting-out, a Captain blocker, never a silent skip.

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

  Rule: Estelle drives the Quartermaster to Crew handoff
    After the Quartermaster's turn, Estelle opens a fresh, context-isolated Crew session, so
    the Quartermaster to Crew firewall holds by fresh context and custody follows the new
    seat. The full loop-until-green is a separate Rule; this Rule pins one handoff. The
    fast tier pins fresh context and custody. The live-eval tier pins a real Quartermaster
    turn handing off to a fresh Crew session.

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

  Rule: A handoff records narration voiced off the completed seat's work
    One small Bonny call per seat handoff, voiced off the completed seat's work, is the paid
    colour over the free heartbeat. The fast tier pins that a handoff records a narration
    for the transition. The live-eval tier pins that Bonny voices a real line in their own
    voice at the handoff.

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
      Then Bonny's narration for the handoff carries a live line in their voice

  Rule: The crew's run is reported back into Bonny's session when it ends
    Estelle summarizes the result back into Bonny's session so they can speak to what
    shipped, while the firewall holds: Bonny receives the distilled summary, never the
    crew's raw context. The fast tier pins the report seam and the firewall. The live-eval
    tier pins a real model summary of the crew's work.

    Scenario: The crew's run is reported back into Bonny's session without leaking raw context
      Given a started Estelle session seated as the Captain "Bonny"
      When the operator runs the "/embark" command in the started session
      And the Quartermaster's crew session carries the message "greeting.md warmer; three planks green"
      And Estelle reports the crew's run back to Bonny
      Then the started session records a crew-run report
      And the started session's history excludes the crew's raw message "greeting.md warmer; three planks green"

    @eval
    Scenario: Bonny's crew-run report carries a live summary
      Given a started Estelle session seated as the Captain "Bonny"
      And a live eval model is configured for the crew and Bonny
      When the operator runs the "/embark" command in the started session
      And the crew session runs a turn
      When Estelle reports the crew's run back to Bonny
      Then Bonny's crew-run report carries a live summary of the crew's work

  Rule: Estelle drives the full crew loop until every target is green
    Estelle drives the whole run, not one handoff: it reads the Quartermaster's verdict and
    decides the next seat, sends the Crew to each failing target, seats the Boatswain to
    commit, and loops the Quartermaster until every target is green. The decision logic is a
    pure function of the verdict, pinned deterministically at the fast tier. The live-eval
    tier pins a genuine live run of the whole loop to green.

    Scenario: Estelle sends the Crew to the target the Quartermaster names
      Given a started Estelle session seated as the Captain "Bonny"
      When the operator runs the "/embark" command in the started session
      And the Quartermaster reports the failing target "greeting.md"
      And Estelle advances the crew loop
      Then Estelle sends the Crew to the target "greeting.md"

    Scenario: Estelle ends the run when the Quartermaster reports all green
      Given a started Estelle session seated as the Captain "Bonny"
      When the operator runs the "/embark" command in the started session
      And the Quartermaster reports all targets green
      And Estelle advances the crew loop
      Then the crew run ends without sending the Crew

    Scenario: Estelle loops the Crew until the Quartermaster's verdict turns green
      Given a started Estelle session seated as the Captain "Bonny"
      When the operator runs the "/embark" command in the started session
      And the Quartermaster reports the failing target "greeting.md"
      And Estelle advances the crew loop
      And the Quartermaster then reports all targets green
      And Estelle advances the crew loop
      Then Estelle sent the Crew exactly once
      And the crew run ends

    Scenario: The loop seats the Boatswain to commit, isolated from the Crew
      Given a started Estelle session seated as the Captain "Bonny"
      When the operator runs the "/embark" command in the started session
      And the Quartermaster reports the failing target "greeting.md"
      And Estelle advances the crew loop through the Crew to the Boatswain
      Then the crew session is seated as the Boatswain "Bellamy"
      And the crew session lets only the Boatswain commit
      And the crew session's message history excludes the Crew's context

    @captain
    Scenario: The crew session blocks a Crew hand from committing
      Given a started Estelle session seated as the Captain "Bonny"
      When the operator runs the "/embark" command in the started session
      And Estelle hands the crew off from the Quartermaster to the Crew
      Then the crew session blocks a Crew hand from committing

    @eval
    Scenario: A live embark runs the crew loop through every seat to green
      Given a started Estelle session seated as the Captain "Bonny"
      And a live eval model is configured for the crew and Bonny
      And a target that is red until the Crew fixes it
      When the operator runs the "/embark" command in the started session
      And Estelle runs the crew loop to completion
      Then the crew loop ran the Quartermaster, the Crew, and the Boatswain live
      And the crew loop ended with every target green
      And Bonny's crew-run report carries a live summary of the run

  Rule: Bonny embarks the batch from their own turn and drives the whole loop
    The operator's real run must drive the loop from embark itself, and Bonny must embark
    from their own turn rather than the operator typing /embark. The conversation with Bonny
    stays live while the crew runs.

    Scenario: Bonny embarks the batch from their own turn
      Given a started Estelle session seated as the Captain "Bonny"
      When Bonny embarks the batch from their turn
      Then a crew session opens alongside the started session
      And the crew session is seated as the Quartermaster "Misson"
      And the started session stays seated as the Captain "Bonny"

    Scenario: Embark drives the crew loop to completion, not only opens the crew session
      Given a started Estelle session seated as the Captain "Bonny"
      And the Quartermaster's verdict reports all targets green
      When Bonny embarks the batch from their turn
      Then Estelle runs the crew loop to completion without a further operator step
      And the crew run is reported back into Bonny's session

    @eval
    Scenario: A live Bonny embark runs the crew loop to green from their own turn
      Given a started Estelle session seated as the Captain "Bonny"
      And a live eval model is configured for the crew and Bonny
      And a target that is red until the Crew fixes it
      When Bonny embarks the batch from their turn
      And Estelle runs the crew loop to completion
      Then the crew loop ran the Quartermaster, the Crew, and the Boatswain live
      And the crew loop ended with every target green
      And Bonny's crew-run report carries a live summary of the run

  Rule: The loop-driving, narration, and report-back reach the operator's own session
    These behaviours live in Estelle's core, triggered by embark, so they reach the
    operator's own session on the real run and not only through a test-supplied interactive
    callback. The operator stays seated as Bonny, who narrates the crew's progress. Bonny
    embarks the crew rather than sending the operator to a role command.

    Scenario: Embarking narrates the crew's progress into the operator's session
      Given a started Estelle session seated as the Captain "Bonny"
      And the Quartermaster's verdict reports all targets green
      When Bonny embarks the batch from their turn
      Then the started session receives the crew's narration as the crew runs
      And the started session receives Bonny's report when the run ends
      And the started session stays seated as the Captain "Bonny"

    @eval
    Scenario: A live embark narrates the crew's run to the operator
      Given a started Estelle session seated as the Captain "Bonny"
      And a live eval model is configured for the crew and Bonny
      And a target that is red until the Crew fixes it
      When Bonny embarks the batch from their turn
      Then the started session shows live narration of the crew's run
      And the started session shows Bonny's report of the completed run

    @eval
    Scenario: Bonny embarks the crew instead of sending the operator to a role command
      Given a started Estelle session seated as the Captain "Bonny"
      And the project carries a batch of specs ready for the crew to build
      And a live eval model is configured for Bonny
      And the operator confirms the batch is right and tells Bonny to ship it
      When Bonny takes their next turn
      Then Bonny embarks the crew rather than instructing the operator to run a role command

  Rule: A manually dispatched role starts in an isolated session alongside, not by seat-switching
    A manual role command invokes that role into an isolated session alongside, the same
    mechanism as embark, rather than switching the operator's seat. The operator stays
    seated with Bonny, who narrates. The isolated role starts with clean context, so it
    proceeds rather than refusing the Captain to role bulkhead.

    Scenario: A manually dispatched role starts with clean context
      Given a started Estelle session carrying the operator's message "make the greeting warmer" to Bonny
      When the operator runs the "/qm" command in the started session
      Then the crew session opens alongside the started session
      And the crew session's message history excludes the operator's message "make the greeting warmer"

    @eval
    Scenario: A manually invoked Quartermaster proceeds instead of refusing for unclean context
      Given a started Estelle session seated as the Captain "Bonny"
      And a live eval model is configured for the crew and Bonny
      And the operator has discussed intent with Bonny in the started session
      When the operator runs the "/qm" command in the started session
      And the alongside Quartermaster takes a turn
      Then the alongside Quartermaster does not refuse for unclean context

  Rule: Embarking drives the real crew, proven where it cannot be faked
    The shipped live run only opens an idle, invisible crew session unless embark drives it,
    so /embark and /qm must do something the operator can see. This Rule pins the registered
    embark tool the live model calls, and asserts an outcome only real crew work produces: a
    genuinely failing project target passes the project's real verification after the run,
    and the run surfaces into the operator's own session.

    @eval
    Scenario: Embarking drives the real crew to turn a failing target green
      Given a started Estelle session seated as the Captain "Bonny"
      And a live eval model is configured for the crew and Bonny
      And the project carries a verification target that is failing
      When Bonny embarks the crew from their own turn
      Then Estelle drives the Quartermaster, the Crew, and the Boatswain against the failing target
      And the failing target passes the project's verification after the run
      And the started session receives the crew's narration and Bonny's completed-run report

    @eval
    Scenario: The operator's own embark act, not a test shortcut, is what turns the failing target green
      Given a started Estelle session seated as the Captain "Bonny"
      And a live eval model is configured for the crew and Bonny
      And the project carries a verification target that is failing
      When the operator tells Bonny to embark the crew on the failing target
      And Bonny embarks the crew as an ordinary act of their own turn, with no further step standing in for their decision
      Then the crew's real work, driven only by that one embark act, turns the failing target green
      And the started session receives the crew's narration and Bonny's completed-run report
      And no test-only stand-in for embark was needed to reach this outcome
