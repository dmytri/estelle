Feature: Seat model defaults
  As an operator
  I want each seat to default to the model Estelle ships in "assets/seat-models.json"
  So that the crew runs on sensible models before I configure anything

  Scenario: The Captain defaults to the shipped Captain model
    Given the active seat is the Captain "Bonny"
    When Bonny begins a turn
    Then the provider request uses the model "opencode-go/deepseek-v4-flash"

  Scenario: The Quartermaster defaults to the shipped Quartermaster model
    Given the active seat is the Quartermaster "Misson"
    When Misson begins a turn
    Then the provider request uses the model "opencode-go/deepseek-v4-flash"
