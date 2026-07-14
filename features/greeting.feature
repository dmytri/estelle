@logic
Feature: Bonny opens the session
  As an operator
  I want Bonny to open by running their Captain opening, orienting from the durable artifacts
  So that a session never opens silent and pending work surfaces without my prompt

  Bonny is seated as the Captain by default, but a seated role is not an invoked
  one: the Captain opening instructions live in their prompt yet never run,
  because startup only injects a canned greeting and never gives them a turn.
  Starting Estelle must actuate the opening the way a /captain invocation does
  elsewhere, every start, so Bonny reads the specs and CAPTAIN.md and speaks to
  the deck before inviting direction. Surfacing a pending review is a duty, so
  Estelle derives it from the specs and carries it into the opening itself
  rather than trusting Bonny to notice it. Bonny frames what the machine
  surfaces. Without a model they cannot take a turn, so they fall back to the
  canned fitting-out steer.

  Scenario: Bonny begins their Captain opening turn when a model is available
    Given an operator directory that carries no Estelle assets
    And provider auth and a default model are configured in the operator's agent directory
    When the operator starts Estelle in that directory
    Then Bonny begins their Captain opening turn before the operator speaks

  Scenario: Bonny steers to fitting out when no model is rigged
    Given an operator directory whose Bonny fitting-out steer asset reads "Commodore, no model is rigged yet. Use /login, then /model."
    And no provider auth is configured in the operator's agent directory
    When the operator starts Estelle in that directory
    Then Bonny opens the session with the guidance "Commodore, no model is rigged yet. Use /login, then /model."

  Scenario: The opening carries the derived pending review to the operator
    Given an operator directory whose specs carry a "@captain" scenario awaiting the Captain's review
    When the operator starts Estelle in that directory
    Then the session's opening carries the pending "@captain" scenario to the operator
