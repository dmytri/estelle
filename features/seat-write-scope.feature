Feature: Seat write custody
  As Estelle
  I want each seat limited to the files its role may write
  So that custody holds without trusting discipline

  Scenario: The Crew may write production code
    Given the active seat is the Crew hand "Belka"
    When Belka writes the file "src/write-scope.ts"
    Then Estelle allows the write
    And the file "src/write-scope.ts" exists

  Scenario: The Crew may not write a specification
    Given the active seat is the Crew hand "Strelka"
    When Strelka attempts to write the file "features/new-thing.feature"
    Then Estelle blocks the write
    And Estelle reports that the Crew may write only "src/**"

  Scenario: The Captain may not write production code
    Given the active seat is the Captain "Bonny"
    When Bonny attempts to write the file "src/sneaky.ts"
    Then Estelle blocks the write
    And Estelle reports that the Captain writes specs, assets, "CAPTAIN.md", and "watchbill.json"

  Scenario: Only the Captain may write the watchbill
    Given the active seat is the Quartermaster "Misson"
    When Misson attempts to write the file "watchbill.json"
    Then Estelle blocks the write
    And Estelle reports that only the Captain may write "watchbill.json"
