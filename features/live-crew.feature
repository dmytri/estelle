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
      And the crew session's heartbeat shows the crew is no longer at rest during the run

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

    Scenario: The handed-off Crew session may write the shim package's production code
      Given a started Estelle session seated as the Captain "Bonny"
      When the operator runs the "/embark" command in the started session
      And Estelle hands the crew off from the Quartermaster to the Crew
      Then the crew session allows a Crew hand to write "packages/pi-open-plugin-shim/src/index.ts"

    Scenario: The handed-off Crew session may write the launch bin
      Given a started Estelle session seated as the Captain "Bonny"
      When the operator runs the "/embark" command in the started session
      And Estelle hands the crew off from the Quartermaster to the Crew
      Then the crew session allows a Crew hand to write "bin/estelle.js"

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
    Scenario: Bonny embarks the crew instead of sending the operator to a role command
      Given a started Estelle session seated as the Captain "Bonny"
      And the project carries a batch of specs ready for the crew to build
      And a live eval model is configured for Bonny
      And the operator confirms the batch is right and tells Bonny to ship it
      When Bonny takes their next turn
      Then Bonny embarks the crew rather than instructing the operator to run a role command
      And the crew runs on while Bonny's turn stays live

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

  Rule: Embark drives the real crew to green, proven against the project's own verification
    On a real project the crew reads the durable artifacts, edits real production code, and the
    project's own verification command decides green. The proof runs the whole loop from Bonny's
    own live turn against a genuinely failing scenario in a real Shipshape project, so no test
    stand-in and no non-empty-file proxy can satisfy it. This tier requires the live model
    credential as fitting-out and assumes it present.

    @eval
    Scenario: Embark turns a genuinely failing project scenario green through real crew work
      Given a scratch Shipshape project whose scenario "adds two numbers" fails its own verification command
      And a started Estelle session seated as the Captain "Bonny" on the scratch project
      And the live eval model is fitted as the session default
      And the operator tells Bonny to embark the crew on the failing scenario
      When Bonny embarks the crew as an ordinary act of their own turn
      Then the crew edits production code in the scratch project during the run
      And the scratch project's own verification command reports the scenario "adds two numbers" green
      And the started session receives the crew's narration and Bonny's completed-run report

  Rule: The crew works any project through its own verification command, and the Boatswain commits
    The crew reads the project's own verification command from its RIGGING.md, so a project that
    verifies with anything other than cucumber still turns green; a hardcoded runner would spin
    forever without an outcome. Every seat is a real working turn: the Quartermaster runs the
    verification, the Crew edits production, and the Boatswain commits. A seat that can only
    narrate produces no durable outcome, so the commit is the proof.

    @eval
    Scenario: The crew greens a non-cucumber project and the Boatswain commits the work
      Given a scratch project verified by its own non-cucumber command, with a failing target
      And a started Estelle session seated as the Captain "Bonny" on the scratch project
      And the live eval model is fitted as the session default
      And the operator tells Bonny to embark the crew on the failing scenario
      When Bonny embarks the crew as an ordinary act of their own turn
      Then the scratch project's own non-cucumber verification passes
      And the Boatswain committed the crew's work

  Rule: Bonny dispatches the Boatswain to take custody, the only path to a commit
    Only the Boatswain may commit: there is no Captain-side commit path, and opening a
    Boatswain session seats an idle Bellamy who never takes custody. So Bonny must be
    able to dispatch Bellamy to recheck the verification and commit the work. On a green
    project with uncommitted work the crew loop has no failing target to chase and seats
    nobody, and the work could never be committed at all. The dispatch is thin by
    contract: the job and the base commit. The operator's conversation never crosses into
    the crew, which works from the durable artifacts alone.

    @eval
    Scenario: Bonny dispatches the Boatswain, who commits the work on an already-green project
      Given a scratch project whose verification is already green, with uncommitted work
      And a started Estelle session seated as the Captain "Bonny" on the scratch project
      And the live eval model is fitted as the session default
      When Bonny dispatches the Boatswain to take custody of the work
      Then the Boatswain committed the crew's work
      And the scratch project's working tree is clean

  Rule: The operator's own "/embark" command sets the crew working, not an idle seat
    The operator must have a deterministic way to set the crew working that does not
    depend on Bonny's model choosing to embark. The "/embark" command drives the real
    crew loop, exactly as Bonny's embark tool does. A command that only opens a crew
    session seats the Quartermaster and does no work, which is the defect.

    @eval
    Scenario: The operator's own "/embark" command drives the crew to green and commits
      Given a scratch project verified by its own non-cucumber command, with a failing target
      And a started Estelle session seated as the Captain "Bonny" on the scratch project
      And the live eval model is fitted as the session default
      When the operator runs the "/embark" command in the started session
      And the crew run completes
      Then the scratch project's own non-cucumber verification passes
      And the Boatswain committed the crew's work
