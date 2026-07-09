@logic @property
Feature: Internal API shape conformance
  As the Shipshape pilot
  I want the flagship's and shim's exported surface pinned to a durable contract
  So that a drift in the internal API model surfaces as a discovered target instead
    of drifting silently

  Rule: Captain shapes the internal API surface through the scantling, not prose

  The Captain reshapes the internal API by editing "assets/scantlings/internal-api-shape.d.ts"
  directly. No comment, rationale, or instruction accompanies a change; the contract
  itself is the specification. Crew brings the seam back into conformance with the
  current contract.

    Scenario: The flagship and shim seams discharge against the internal API shape scantling
      Given the flagship seam at "src/index.ts" and the shim seam at "packages/pi-open-plugin-shim/src/index.ts"
      When the verifier checks each seam against the "internal-api-shape" scantling in "assets/scantlings/internal-api-shape.d.ts"
      Then no counterexample is found
