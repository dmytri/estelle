@logic
Feature: Seat model defaults
  As an operator
  I want a seat with no recorded model to run on my pi default model
  So that my pi configuration wins until I record per-seat models

  Scenario: A seat with no recorded model runs on the operator's pi default model
    Given the active seat is the Captain "Bonny"
    When Bonny begins a turn
    Then the provider request uses the operator's pi default model
