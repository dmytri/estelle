@logic
Feature: Captain reset nudge
  As an operator
  I want Bonny to respect the Shipshape reset nudge after a batch ships
  So that the Captain context stays bounded to a batch without me managing it

  The installed Shipshape plugin fires a captain-reset-nudge after a Captain
  outbound command, run through the shim. Estelle delivers that guidance into
  Bonny's session, and Estelle itself emits the offer of a fresh context to the
  operator. The offer is a duty, so the machine guarantees it and Bonny supplies
  only the voice. An offer the operator reliably receives beats one that arrives
  when the model remembers it. It is a nudge, not a gate: the operator may
  continue instead.

  Scenario: The reset nudge after an outbound command reaches Bonny's session
    Given a started Estelle session seated as the Captain "Bonny"
    When an outbound command runs in the started session and the Shipshape captain-reset-nudge fires
    Then the reset nudge's guidance is delivered into Bonny's session context

  Scenario: A non-outbound command raises no reset nudge
    Given a started Estelle session seated as the Captain "Bonny"
    When a non-outbound command runs in the started session
    Then no reset nudge guidance is delivered into Bonny's session context

  Scenario: The fresh-context offer reaches the operator without a model
    Given a started Estelle session seated as the Captain "Bonny"
    And no live model is configured for Bonny
    When an outbound command runs in the started session and the Shipshape captain-reset-nudge fires
    Then the started session offers the operator a fresh context for the next batch
