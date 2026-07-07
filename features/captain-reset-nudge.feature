@logic
Feature: Captain reset nudge
  As an operator
  I want Bonny to respect the Shipshape reset nudge after a batch ships
  So that the Captain context stays bounded to a batch without me managing it

  The installed Shipshape plugin fires a captain-reset-nudge after a Captain
  outbound command, run through the shim. Estelle must deliver that guidance
  into Bonny's session so Bonny honours it, and Bonny offers the operator a
  fresh context for the next batch. It is a nudge, not a gate: the operator may
  continue instead.

  Scenario: The reset nudge after an outbound command reaches Bonny's session
    Given a started Estelle session seated as the Captain "Bonny"
    When an outbound command runs in the started session and the Shipshape captain-reset-nudge fires
    Then the reset nudge's guidance is delivered into Bonny's session context

  Scenario: A non-outbound command raises no reset nudge
    Given a started Estelle session seated as the Captain "Bonny"
    When a non-outbound command runs in the started session
    Then no reset nudge guidance is delivered into Bonny's session context

  @eval
  Scenario: Bonny offers a fresh context when the reset nudge fires
    Given a started Estelle session seated as the Captain "Bonny"
    And a live eval model is configured for Bonny
    When an outbound command runs in the started session and the Shipshape captain-reset-nudge fires
    And Bonny takes her next turn
    Then Bonny offers the operator a fresh context for the next batch
