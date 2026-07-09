@logic
Feature: Captain perturbation command
  As the Captain
  I want to mark a behaviour-stable seam for reimplementation
  So that a changed durable requirement becomes a failing target without my writing a test

  A perturbation reddens a seam that still passes every step but has fallen out
  of compliance with a changed durable requirement. The Captain adds only the
  perturbation statement from "RIGGING.md" at the seam. The Captain adds no step
  text, scenario name, or rationale, so the perturbation carries a defect signal
  and no hidden instruction. Only the Captain seat perturbs; the perturbation
  policy carries the reddening and removal mechanics.

  Scenario: The Captain perturbs a seam with the perturbation statement
    Given the active seat is the Captain "Bonny"
    When Bonny perturbs a named production seam
    Then the seam carries the perturbation statement from "RIGGING.md"
    And the perturbed seam carries no step text, scenario name, or rationale

  Scenario: An internal seat may not perturb
    Given the active seat is the Quartermaster "Misson"
    When Misson attempts to perturb a named production seam
    Then Estelle blocks the perturbation
    And Estelle reports that only the Captain perturbs
