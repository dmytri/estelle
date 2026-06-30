Feature: Captain notes privacy
  As Estelle
  I want "CAPTAIN.md" readable only by the seats the Articles permit
  So that the Captain private notes never leak across a seat

  Background:
    Given a project with a "CAPTAIN.md" file

  Scenario: The Captain reads their own notes
    Given the active seat is the Captain "Bonny"
    When Bonny reads "CAPTAIN.md"
    Then Estelle allows the read
    And the contents of "CAPTAIN.md" are returned

  Scenario: The Bosun may read the Captain notes for hygiene
    Given the active seat is the Bosun "Bellamy"
    When Bellamy reads "CAPTAIN.md"
    Then Estelle allows the read

  Scenario: The Quartermaster may not read the Captain notes
    Given the active seat is the Quartermaster "Misson"
    When Misson attempts to read "CAPTAIN.md"
    Then Estelle blocks the read
    And Estelle reports that "CAPTAIN.md" is private to the Captain
