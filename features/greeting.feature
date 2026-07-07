@logic
Feature: Bonny opens the session
  As an operator
  I want Bonny to open by running her Captain opening, orienting from the durable artifacts
  So that a session never opens silent and pending work surfaces without my prompt

  Bonny is seated as the Captain by default, but a seated role is not an invoked
  one: the Captain opening instructions live in her prompt yet never run, because
  startup only injects a canned greeting and never gives her a turn. Starting
  Estelle must actuate her opening the way a /captain invocation does elsewhere,
  every start, so she reads the specs and CAPTAIN.md and surfaces pending
  @captain scenarios and blockers before inviting direction. Without a model she
  cannot take a turn, so she falls back to the canned fitting-out steer.

  Scenario: Bonny begins her Captain opening turn when a model is available
    Given an operator directory that carries no Estelle assets
    And provider auth and a default model are configured in the operator's agent directory
    When the operator starts Estelle in that directory
    Then Bonny begins her Captain opening turn before the operator speaks

  Scenario: Bonny steers to fitting out when no model is rigged
    Given an operator directory whose Bonny fitting-out steer asset reads "Commodore, no model is rigged yet. Use /login, then /model."
    And no provider auth is configured in the operator's agent directory
    When the operator starts Estelle in that directory
    Then Bonny opens the session with the guidance "Commodore, no model is rigged yet. Use /login, then /model."

  @eval
  Scenario: Bonny's opening surfaces a pending review from the specs unprompted
    Given a started Estelle session seated as the Captain "Bonny"
    And a live eval model is configured for Bonny
    And the specs carry a "@captain" scenario awaiting the Captain's review
    When Bonny runs her opening turn
    Then Bonny's opening surfaces the pending "@captain" scenario before inviting direction
